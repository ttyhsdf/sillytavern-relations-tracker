import { extension_settings, getContext } from "../../../extensions.js";
import { eventSource, event_types, generateRaw, saveSettingsDebounced, setExtensionPrompt, saveChatDebounced } from "../../../../script.js";
import { ConnectionManagerRequestService } from "../../shared.js";
import { systemPrompts, VALID_TIERS, VALID_BONDS, resumePrompts, customBondPrompt } from "./prompts.js";
import { getTierFromCP, getTierLabel, getTierLabelsForBond } from "./tiers.js";
import { ALL_BONDS, isTransitionAllowed, clampCP, updateCustomBonds, VALID_BONDS as RULES_VALID_BONDS } from "./rules.js";
import { createHistoryEntry, addHistoryEntry, getPairKey, renderHistoryHTML } from "./history.js";
import { smartScan, fullScan } from "./scanner.js";
import { checkInteraction, calculateDecay } from "./decay.js";
import { addMilestone, getMilestones, renderMilestonesHTML, createMilestoneFromAI } from "./milestones.js";
import { RelationGraph } from "./graph.js";

const extensionName = "sillytavern-relations-tracker";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let relationsData = [];
let historyMap = {};
let milestonesMap = {};
let pendingChanges = null;
let isGenerating = false;
let graphInstance = null;

const defaultSettings = {
    mode: 'auto',
    smartScan: true,
    scanDepth: 10,
    promptLang: 'EN',
    connectionProfile: '',
    debug: false,
    relations: {},
    history: {},
    milestones: {},
    enableDecay: true,
    customBonds: [],
    resumeLength: 'short'
};

// =====================
// Settings
// =====================
function getSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    return Object.assign({}, defaultSettings, extension_settings[extensionName]);
}

function getChatKey() {
    const context = getContext();
    if (!context || !context.characterId) return null;
    const chatFile = context.chatId || context.characters?.[context.characterId]?.chat;
    return `${context.characterId}_${chatFile || 'default'}`;
}

function loadSettings() {
    const settings = getSettings();
    $('.rt-mode-btn').removeClass('active');
    $(`.rt-mode-btn[data-mode="${settings.mode}"]`).addClass('active');
    $('#rt-smart-scan').prop('checked', settings.smartScan);
    $('#rt-scan-depth').val(settings.scanDepth);
    $('#rt-prompt-lang').val(settings.promptLang);
    $('#rt-connection-profile').val(settings.connectionProfile);
    $('#rt-resume-length').val(settings.resumeLength || 'short');
    $('#rt-debug').prop('checked', settings.debug);
    
    updateCustomBonds(settings.customBonds);
    
    loadRelationsFromSettings();
}

function loadRelationsFromSettings() {
    const settings = getSettings();
    const chatKey = getChatKey();
    if (chatKey && settings.relations?.[chatKey]) {
        relationsData = JSON.parse(JSON.stringify(settings.relations[chatKey]));
    } else {
        relationsData = [];
    }
    if (chatKey && settings.history?.[chatKey]) {
        historyMap = JSON.parse(JSON.stringify(settings.history[chatKey]));
    } else {
        historyMap = {};
    }
    if (chatKey && settings.milestones?.[chatKey]) {
        milestonesMap = JSON.parse(JSON.stringify(settings.milestones[chatKey]));
    } else {
        milestonesMap = {};
    }
    renderCards();
    updateFloatingWidget();
}

function saveSettings() {
    const current = getSettings();
    const activeMode = $('.rt-mode-btn.active').data('mode') || 'auto';
    extension_settings[extensionName] = {
        mode: activeMode,
        smartScan: $('#rt-smart-scan').prop('checked'),
        scanDepth: parseInt($('#rt-scan-depth').val(), 10) || 10,
        promptLang: $('#rt-prompt-lang').val(),
        connectionProfile: $('#rt-connection-profile').val(),
        debug: $('#rt-debug').prop('checked'),
        relations: current.relations || {},
        history: current.history || {},
        milestones: current.milestones || {},
        enableDecay: current.enableDecay !== undefined ? current.enableDecay : true,
        customBonds: current.customBonds || [],
        resumeLength: $('#rt-resume-length').val() || 'short'
    };
    saveSettingsDebounced();
}

function saveRelations() {
    const chatKey = getChatKey();
    if (!chatKey) return;
    if (!extension_settings[extensionName]) extension_settings[extensionName] = Object.assign({}, defaultSettings);
    if (!extension_settings[extensionName].relations) extension_settings[extensionName].relations = {};
    if (!extension_settings[extensionName].history) extension_settings[extensionName].history = {};
    if (!extension_settings[extensionName].milestones) extension_settings[extensionName].milestones = {};
    extension_settings[extensionName].relations[chatKey] = JSON.parse(JSON.stringify(relationsData));
    extension_settings[extensionName].history[chatKey] = JSON.parse(JSON.stringify(historyMap));
    extension_settings[extensionName].milestones[chatKey] = JSON.parse(JSON.stringify(milestonesMap));
    saveSettingsDebounced();
    updateFloatingWidget();
}

function loadConnectionProfiles() {
    const context = getContext();
    const select = $('#rt-connection-profile');
    const currentValue = select.val();
    select.empty();
    select.append('<option value="">-- Use Main API --</option>');
    if (context?.extensionSettings?.connectionManager?.profiles) {
        context.extensionSettings.connectionManager.profiles.forEach(p => {
            select.append(`<option value="${p.id}">${p.name}</option>`);
        });
    }
    if (currentValue) select.val(currentValue);
}

function debugLog(...args) {
    if (extension_settings[extensionName]?.debug) console.log("[RT]", ...args);
}

// =====================
// Parsing & Building
// =====================
function parseRelationsTag(text) {
    const regex = /<!--RELATIONS_ARCHIVE:\s*(.+?)\s*-->/s;
    const match = text.match(regex);
    if (!match) return null;
    const relations = match[1].split('/').map(r => r.trim()).filter(r => r);
    const parsed = [];
    for (const rel of relations) {
        const arrowSplit = rel.split(/→|->/);
        if (arrowSplit.length < 2) continue;
        const source = arrowSplit[0].trim();
        const rest = arrowSplit[1];
        const equalsSplit = rest.split('=');
        if (equalsSplit.length < 2) continue;
        const target = equalsSplit[0].trim();
        const dataPart = equalsSplit.slice(1).join('=');
        const fields = dataPart.split(',').map(f => f.trim());
        parsed.push({
            source, target,
            cp: parseInt(fields[0]) || 0,
            tier: fields[1] || "Neutral",
            bond: fields[2] || "[P]",
            label: fields[3] || "",
            locked: false
        });
    }
    return parsed;
}

function buildRelationsTag() {
    if (relationsData.length === 0) return "";
    const parts = relationsData.map(r => `${r.source}→${r.target}=${r.cp},${r.tier},${r.bond},${r.label}`);
    return `<!--RELATIONS_ARCHIVE:${parts.join(' / ')}-->`;
}

function scanChatForRelations() {
    const context = getContext();
    if (!context?.chat?.length) return;
    const settings = getSettings();
    const currentMsgCount = context.chat.length;

    for (let i = context.chat.length - 1; i >= 0; i--) {
        const msg = context.chat[i].mes;
        if (!msg) continue;
        const parsed = parseRelationsTag(msg);
        if (parsed) {
            relationsData = parsed;
            
            if (settings.enableDecay) {
                let changed = false;
                for (const rel of relationsData) {
                    if (rel.lastInteractionMsg === undefined) {
                        rel.lastInteractionMsg = checkInteraction(context.chat, rel.source, rel.target, 0);
                        changed = true;
                    } else {
                        const newInteraction = checkInteraction(context.chat, rel.source, rel.target, rel.lastInteractionMsg);
                        if (newInteraction > rel.lastInteractionMsg) {
                            rel.lastInteractionMsg = newInteraction;
                            changed = true;
                        }
                    }
                    
                    const decayedCp = calculateDecay(rel, currentMsgCount);
                    if (decayedCp !== rel.cp && !rel.locked) {
                        rel.cp = decayedCp;
                        rel.tier = getTierFromCP(rel.cp);
                        changed = true;
                    }
                }
                if (changed) {
                    injectIntoPrompt();
                    saveRelations();
                }
            }

            renderCards();
            updateFloatingWidget();
            injectIntoPrompt();
            saveRelations();
            return;
        }
    }
}

function injectIntoPrompt() {
    let tag = buildRelationsTag();
    if (!tag) return;
    
    const settings = getSettings();
    if (settings.nlResume) {
        if (typeof settings.nlResume === 'string') {
            tag += `\n[RELATIONS SUMMARY: ${settings.nlResume}]`;
        } else if (Array.isArray(settings.nlResume)) {
            const summaryStr = settings.nlResume.map(c => `${c.character}: ${c.summary}`).join('\n');
            tag += `\n[RELATIONS SUMMARY:\n${summaryStr}\n]`;
        }
    }
    
    try {
        setExtensionPrompt(extensionName, tag, 1, 0);
    } catch {
        const context = getContext();
        if (context?.extensionPrompt) context.extensionPrompt["relationsTracker"] = tag;
    }
}

// =====================
// AI Analysis
// =====================
async function runAIAnalysis() {
    const settings = getSettings();
    if (settings.mode === 'manual') return;
    if (isGenerating || relationsData.length === 0) return;

    const context = getContext();
    if (!context?.chat?.length) return;

    const depth = settings.scanDepth;
    const recentMessages = settings.smartScan
        ? smartScan(context.chat, depth)
        : fullScan(context.chat, depth);

    const relationsJson = JSON.stringify(relationsData, null, 2);
    let promptInstruction = systemPrompts[settings.promptLang] || systemPrompts['EN'];
    promptInstruction = promptInstruction.replace('{{RELATIONS_JSON}}', relationsJson);
    
    let customBondsListStr = "";
    let customBondsRulesStr = "";
    if (settings.customBonds && settings.customBonds.length > 0) {
        customBondsListStr = ", " + settings.customBonds.map(b => `${b.code} ${b.name}`).join(", ");
        customBondsRulesStr = "\n" + settings.customBonds.map(b => `• ${b.code} ${b.name}: ${b.behavior || 'Follow standard relationship rules.'}`).join("\n");
    }
    promptInstruction = promptInstruction.replace('{{CUSTOM_BONDS_LIST}}', customBondsListStr);
    promptInstruction = promptInstruction.replace('{{CUSTOM_BONDS_RULES}}', customBondsRulesStr);

    const sysPrompt = `You are a background relation tracking AI.\n\n${promptInstruction}`;

    try {
        isGenerating = true;
        debugLog("AI analysis. Mode:", settings.mode, "Depth:", depth);
        await new Promise(r => setTimeout(r, 2000));

        let result = "";

        if (settings.connectionProfile) {
            // Use Connection Manager API (correct static class import)
            debugLog("Using Connection Profile:", settings.connectionProfile);
            try {
                const messages = [
                    { role: "system", content: sysPrompt },
                    { role: "user", content: recentMessages }
                ];
                const response = await ConnectionManagerRequestService.sendRequest(
                    settings.connectionProfile,
                    messages,
                    undefined,
                    { stream: false, extractData: true }
                );
                if (response) {
                    if (typeof response === 'string') {
                        result = response;
                    } else if (response.text) {
                        result = response.text;
                    } else {
                        result = String(response);
                    }
                }
            } catch (connErr) {
                console.warn("[RT] Connection Profile failed, falling back to Main API:", connErr);
                result = await generateRaw({ prompt: recentMessages, systemPrompt: sysPrompt, quietToLoud: true });
            }
        } else {
            debugLog("Using Main API");
            result = await generateRaw({ prompt: recentMessages, systemPrompt: sysPrompt, quietToLoud: true });
        }

        debugLog("AI Response:", result);

        const jsonMatch = result.match(/\[\s*\{.*?\}\s*\]/s);
        const jsonStr = jsonMatch ? jsonMatch[0] : result;
        const newRelations = JSON.parse(jsonStr);
        if (!Array.isArray(newRelations)) return;

        // Normalize & validate against rules
        for (const rel of newRelations) {
            if (rel.char_a) rel.source = rel.char_a;
            if (rel.char_b) rel.target = rel.char_b;
            if (!VALID_BONDS.includes(rel.bond)) rel.bond = '[P]';
            rel.cp = Math.max(-100, Math.min(100, parseInt(rel.cp) || 0));
            rel.cp = clampCP(rel.bond, rel.cp);

            const tierMatch = VALID_TIERS.find(t => t.toLowerCase() === (rel.tier || '').toLowerCase());
            rel.tier = tierMatch || getTierFromCP(rel.cp);

            // In auto/hybrid, auto-sync tier to CP
            rel.tier = getTierFromCP(rel.cp);

            // Check bond transitions
            const oldRel = relationsData.find(r => r.source === rel.source && r.target === rel.target);
            if (oldRel && oldRel.bond !== rel.bond) {
                if (oldRel.locked || !isTransitionAllowed(oldRel.bond, rel.bond, rel.cp)) {
                    debugLog(`Blocked transition: ${oldRel.bond} → ${rel.bond} for ${rel.source}→${rel.target}`);
                    rel.bond = oldRel.bond;
                }
            }
        }

        const msgIndex = context.chat.length;

        if (settings.mode === 'hybrid') {
            pendingChanges = { newRelations, msgIndex };
            showHybridBanner(newRelations, msgIndex);
        } else {
            applyChanges(newRelations, msgIndex);
            await generateResume(newRelations);
        }

    } catch (err) {
        console.error("[RT] AI analysis failed:", err);
        if (typeof toastr !== "undefined") toastr.warning("AI analysis failed. Check console.", "Relations Tracker");
    } finally {
        isGenerating = false;
    }
}

function applyChanges(newRelations, msgIndex) {
    let changeSummary = [];
    const context = getContext();
    for (const newRel of newRelations) {
        const pairKey = getPairKey(newRel.source, newRel.target);
        
        if (newRel.milestone && newRel.milestone.event) {
            const ms = createMilestoneFromAI(newRel.milestone, msgIndex);
            addMilestone(milestonesMap, pairKey, ms);
            changeSummary.push(`🏆 Milestone for ${newRel.source}→${newRel.target}`);
            if (getSettings().enableSystemMessages !== false) {
                pushSystemMessage(`[RT_EVENT] 🏆 Milestone: ${newRel.source} & ${newRel.target}: ${ms.event}`);
            }
        }
        delete newRel.milestone;

        newRel.lastInteractionMsg = checkInteraction(context?.chat || [], newRel.source, newRel.target, Math.max(0, msgIndex - 10));

        const oldRel = relationsData.find(r => r.source === newRel.source && r.target === newRel.target);
        if (oldRel) {
            const entry = createHistoryEntry(oldRel, newRel, msgIndex);
            if (entry) {
                addHistoryEntry(historyMap, pairKey, entry);
                const diff = newRel.cp - oldRel.cp;
                if (diff !== 0) changeSummary.push(`${newRel.source} (${diff > 0 ? '+' : ''}${diff} CP)`);
                
                if (oldRel.tier !== newRel.tier && getSettings().enableSystemMessages !== false) {
                    pushSystemMessage(`[RT_EVENT] Relationship between ${newRel.source} and ${newRel.target} shifted to ${newRel.tier}.`);
                }
            }
            newRel.locked = oldRel.locked || false;
            if (newRel.lastInteractionMsg === undefined) {
                newRel.lastInteractionMsg = oldRel.lastInteractionMsg;
            }
        } else {
            // New relationship pair detected by AI
            newRel.locked = false;
            changeSummary.push(`New: ${newRel.source}→${newRel.target}`);
        }
    }
    relationsData = newRelations;
    renderCards();
    injectIntoPrompt();
    saveRelations();
    if (changeSummary.length > 0 && typeof toastr !== "undefined") {
        toastr.success(`${changeSummary.join(', ')}`, "Relations Tracker");
    }
}

// =====================
// Hybrid Mode UI
// =====================
function showHybridBanner(newRelations, msgIndex) {
    const banner = document.getElementById('rt-hybrid-banner');
    const summary = document.getElementById('rt-hybrid-summary');
    if (!banner || !summary) return;
    let lines = [];
    for (const newRel of newRelations) {
        const oldRel = relationsData.find(r => r.source === newRel.source && r.target === newRel.target);
        if (oldRel) {
            const parts = [];
            if (oldRel.cp !== newRel.cp) { const d = newRel.cp - oldRel.cp; parts.push(`CP ${oldRel.cp}→${newRel.cp} (${d > 0 ? '+' : ''}${d})`); }
            if (oldRel.tier !== newRel.tier) parts.push(`${oldRel.tier}→${newRel.tier}`);
            if (oldRel.bond !== newRel.bond) parts.push(`${oldRel.bond}→${newRel.bond}`);
            if (parts.length > 0) lines.push(`<b>${newRel.source} → ${newRel.target}:</b> ${parts.join(', ')}`);
        } else {
            lines.push(`<b>New:</b> ${newRel.source} → ${newRel.target} (${newRel.bond} CP:${newRel.cp})`);
        }
    }
    if (lines.length === 0) lines.push('No changes detected.');
    summary.innerHTML = lines.join('<br>');
    banner.style.display = 'block';
}

function hideHybridBanner() {
    const banner = document.getElementById('rt-hybrid-banner');
    if (banner) banner.style.display = 'none';
    pendingChanges = null;
}

// =====================
// Visual Helpers
// =====================
function getBondColor(bond) {
    const bondInfo = ALL_BONDS.find(b => b.code === bond);
    if (bondInfo && bondInfo.color) return bondInfo.color;
    return '#ffa502'; // default
}

function updateSliderStyle(slider, cp, bond) {
    const percent = ((cp + 100) / 200) * 100;
    const color = getBondColor(bond);
    slider.style.setProperty('--slider-progress', `${percent}%`);
    slider.style.setProperty('--slider-color', color);
}

function updateCardAccent(card, bond) {
    card.setAttribute('data-bond', bond);
    const bondLabel = card.querySelector('.rt-bond-label');
    if (bondLabel) {
        bondLabel.setAttribute('data-bond', bond);
        const bondInfo = ALL_BONDS.find(b => b.code === bond);
        bondLabel.textContent = bondInfo ? bondInfo.name : bond;
    }
    const cpValue = card.querySelector('.rt-cp-value');
    if (cpValue) cpValue.style.color = getBondColor(bond);
}

function updateTierDropdown(tierSelect, bond) {
    const labels = getTierLabelsForBond(bond);
    const TIER_VALUES = ['Frozen', 'Cold', 'Distant', 'Neutral', 'Warm', 'Close', 'Devoted'];
    tierSelect.innerHTML = '';
    labels.forEach((label, i) => {
        const opt = document.createElement('option');
        opt.value = TIER_VALUES[i];
        opt.textContent = label;
        tierSelect.appendChild(opt);
    });
}

// =====================
// Render Cards
// =====================
function renderCards() {
    const container = document.getElementById('rt-cards-container');
    if (!container) return;
    container.innerHTML = '';

    if (relationsData.length === 0) {
        container.innerHTML = '<div class="rt-empty-state">No relationship data. Open a chat and click "Add" or "Scan Chat".</div>';
        return;
    }

    const template = document.getElementById('rt-card-template');
    if (!template) return;

    relationsData.forEach((rel, index) => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.rt-card');
        card.dataset.index = index;

        card.querySelector('.rt-source').textContent = rel.source;
        card.querySelector('.rt-target').textContent = rel.target;
        card.querySelector('.rt-bond-type').value = rel.bond;

        // Build tier dropdown for this bond type
        const tierSelect = card.querySelector('.rt-tier');
        updateTierDropdown(tierSelect, rel.bond);
        tierSelect.value = rel.tier;

        card.querySelector('.rt-label').value = rel.label;
        card.querySelector('.rt-cp-slider').value = rel.cp;
        card.querySelector('.rt-cp-value').textContent = rel.cp;

        // Lock checkbox
        const lockCb = card.querySelector('.rt-lock');
        if (lockCb) {
            lockCb.checked = rel.locked || false;
            lockCb.addEventListener('change', (e) => {
                relationsData[index].locked = e.target.checked;
                saveRelations();
            });
        }

        const sliderElement = card.querySelector('.rt-cp-slider');
        updateSliderStyle(sliderElement, rel.cp, rel.bond);
        updateCardAccent(card, rel.bond);

        // Tier label display
        const tierLabel = card.querySelector('.rt-tier-label');
        if (tierLabel) tierLabel.textContent = getTierLabel(rel.cp, rel.bond);

        // History panel
        const pairKey = getPairKey(rel.source, rel.target);
        const historyContent = card.querySelector('.rt-history-content');
        if (historyContent) {
            const historyHtml = renderHistoryHTML(historyMap[pairKey] || []);
            const milestonesList = getMilestones(milestonesMap, pairKey);
            const milestonesHtml = renderMilestonesHTML(milestonesList);
            
            let combinedHtml = '';
            if (milestonesList && milestonesList.length > 0) {
                combinedHtml += milestonesHtml + '<hr style="border-color: rgba(255,255,255,0.1); margin: 6px 0;">';
            }
            combinedHtml += historyHtml;
            historyContent.innerHTML = combinedHtml;
        }

        const histToggle = card.querySelector('.rt-history-toggle');
        const histPanel = card.querySelector('.rt-history-panel');
        if (histToggle && histPanel) {
            histToggle.addEventListener('click', () => {
                histPanel.style.display = histPanel.style.display === 'none' ? 'block' : 'none';
            });
        }

        // CP slider
        card.querySelector('.rt-cp-slider').addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            val = clampCP(relationsData[index].bond, val);
            e.target.value = val;
            card.querySelector('.rt-cp-value').textContent = val;
            relationsData[index].cp = val;
            // Auto-Tier in auto/hybrid
            const mode = getSettings().mode;
            if (mode !== 'manual') {
                relationsData[index].tier = getTierFromCP(val);
                tierSelect.value = relationsData[index].tier;
            }
            updateSliderStyle(e.target, val, relationsData[index].bond);
            injectIntoPrompt();
            saveRelations();
        });

        // Bond type change
        card.querySelector('.rt-bond-type').addEventListener('change', (e) => {
            const newBond = e.target.value;
            relationsData[index].bond = newBond;
            relationsData[index].cp = clampCP(newBond, relationsData[index].cp);
            card.querySelector('.rt-cp-slider').value = relationsData[index].cp;
            card.querySelector('.rt-cp-value').textContent = relationsData[index].cp;
            updateTierDropdown(tierSelect, newBond);
            relationsData[index].tier = getTierFromCP(relationsData[index].cp);
            tierSelect.value = relationsData[index].tier;
            updateSliderStyle(sliderElement, relationsData[index].cp, newBond);
            updateCardAccent(card, newBond);
            injectIntoPrompt();
            saveRelations();
        });

        // Tier change
        card.querySelector('.rt-tier').addEventListener('change', (e) => {
            relationsData[index].tier = e.target.value;
            injectIntoPrompt();
            saveRelations();
        });

        // Label
        card.querySelector('.rt-label').addEventListener('input', (e) => {
            relationsData[index].label = e.target.value;
            injectIntoPrompt();
            saveRelations();
        });

        // Label presets
        const labelPresets = card.querySelector('.rt-label-presets');
        if (labelPresets) {
            labelPresets.addEventListener('change', (e) => {
                if (e.target.value) {
                    card.querySelector('.rt-label').value = e.target.value;
                    relationsData[index].label = e.target.value;
                    e.target.selectedIndex = 0;
                    injectIntoPrompt();
                    saveRelations();
                }
            });
        }

        // Name editing
        card.querySelector('.rt-source').addEventListener('blur', (e) => {
            relationsData[index].source = e.target.textContent.trim();
            injectIntoPrompt(); saveRelations();
        });
        card.querySelector('.rt-target').addEventListener('blur', (e) => {
            relationsData[index].target = e.target.textContent.trim();
            injectIntoPrompt(); saveRelations();
        });

        // Delete
        card.querySelector('.rt-delete-btn').addEventListener('click', () => {
            relationsData.splice(index, 1);
            renderCards(); injectIntoPrompt(); saveRelations();
        });

        container.appendChild(card);
    });
}

// =====================
// Add / Export / Import
// =====================
function addRelationship() {
    const context = getContext();
    let charName = "Character", userName = "User";
    if (context) {
        if (context.name2) charName = context.name2;
        if (context.name1) userName = context.name1;
    }
    relationsData.push({ source: charName, target: userName, cp: 0, tier: "Neutral", bond: "[P]", label: "Just met", locked: false });
    renderCards(); injectIntoPrompt(); saveRelations();
}

function exportRelations() {
    const data = { relations: relationsData, history: historyMap, chatKey: getChatKey(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `relations_${getChatKey() || 'export'}.json`; a.click();
    URL.revokeObjectURL(url);
    if (typeof toastr !== "undefined") toastr.info("Relations exported!", "Relations Tracker");
}

function importRelations(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.relations && Array.isArray(data.relations)) {
                relationsData = data.relations;
                historyMap = data.history || {};
                renderCards(); injectIntoPrompt(); saveRelations();
                if (typeof toastr !== "undefined") toastr.success(`Imported ${relationsData.length} relationship(s)!`, "RT");
            }
        } catch (err) {
            console.error("[RT] Import failed:", err);
            if (typeof toastr !== "undefined") toastr.error("Import failed.", "RT");
        }
    };
    reader.readAsText(file);
}

function updateFloatingWidget() {
    const list = document.getElementById('rt-float-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (relationsData.length === 0) {
        list.innerHTML = '<div style="font-size:0.8em; color:gray;">No relations</div>';
        return;
    }
    
    relationsData.forEach((rel, index) => {
        const item = document.createElement('div');
        item.className = 'rt-float-item';
        item.innerHTML = `
            <div class="rt-float-pair">${rel.source} &rarr; ${rel.target}</div>
            <div class="rt-float-status" style="color:${getBondColor(rel.bond)}">
                <span>${rel.bond}</span> <span>${rel.cp}</span>
            </div>
        `;
        item.addEventListener('click', () => {
            const card = document.querySelector(`.rt-card[data-index="${index}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.boxShadow = `0 0 15px ${getBondColor(rel.bond)}`;
                setTimeout(() => card.style.boxShadow = '', 1500);
            }
        });
        list.appendChild(item);
    });
}

// =====================
// Init
// =====================
async function initUI() {
    try {
        const htmlResponse = await fetch(`${extensionFolderPath}/index.html`);
        if (!htmlResponse.ok) throw new Error("Failed to load HTML");
        const htmlContent = await htmlResponse.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const extSettings = document.getElementById('extensions_settings');
        if (extSettings) extSettings.appendChild(tempDiv);
        else { console.error("[RT] #extensions_settings not found"); return; }

        loadConnectionProfiles();
        loadSettings();

        $(document).on('click', '.rt-mode-btn', function() {
            $('.rt-mode-btn').removeClass('active');
            $(this).addClass('active');
            saveSettings();
        });

        $('#rt-smart-scan, #rt-debug').on('change', saveSettings);
        $('#rt-scan-depth').on('input change', saveSettings);
        $('#rt-prompt-lang, #rt-connection-profile, #rt-resume-length').on('change', saveSettings);

        document.getElementById('rt-add-btn').addEventListener('click', addRelationship);
        document.getElementById('rt-refresh-btn').addEventListener('click', () => scanChatForRelations());
        document.getElementById('rt-export-btn').addEventListener('click', exportRelations);
        document.getElementById('rt-import-btn').addEventListener('click', () => document.getElementById('rt-import-file').click());
        document.getElementById('rt-import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) { importRelations(e.target.files[0]); e.target.value = ''; }
        });

        document.getElementById('rt-hybrid-apply').addEventListener('click', async () => {
            if (pendingChanges) { 
                applyChanges(pendingChanges.newRelations, pendingChanges.msgIndex); 
                hideHybridBanner(); 
                await generateResume(relationsData);
            }
        });
        document.getElementById('rt-hybrid-dismiss').addEventListener('click', () => {
            hideHybridBanner();
            if (typeof toastr !== "undefined") toastr.info("Dismissed.", "RT");
        });

        // Auto-install Regex Rules
        document.getElementById('rt-install-regex-btn').addEventListener('click', () => {
            if (!extension_settings.regex) extension_settings.regex = [];
            let added = 0;

            const formatRule = extension_settings.regex.find(r => r.scriptName === "RT_EVENT_FORMAT");
            if (!formatRule) {
                extension_settings.regex.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : "rt_fmt_" + Date.now(),
                    scriptName: "RT_EVENT_FORMAT",
                    findRegex: "^\\[RT_EVENT\\]\\s*(.*)",
                    replaceString: "<div style=\"color: #a29bfe; font-style: italic; text-align: center; margin: 15px 0; padding: 10px; background: rgba(162, 155, 254, 0.1); border-radius: 8px; font-family: 'Georgia', serif;\">✧ $1 ✧</div>",
                    trimString: "",
                    placement: [1, 2],
                    disabled: false,
                    markdownOnly: false,
                    promptOnly: false,
                    runOnEdit: true,
                    substituteRegex: false,
                    minDepth: null,
                    maxDepth: null,
                    only_format_display: true,
                    only_format_prompt: false
                });
                added++;
            }

            const hideRule = extension_settings.regex.find(r => r.scriptName === "RT_EVENT_HIDE");
            if (!hideRule) {
                extension_settings.regex.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : "rt_hide_" + Date.now(),
                    scriptName: "RT_EVENT_HIDE",
                    findRegex: "^\\[RT_EVENT\\].*\\n?",
                    replaceString: "",
                    trimString: "",
                    placement: [1, 2],
                    disabled: false,
                    markdownOnly: false,
                    promptOnly: false,
                    runOnEdit: true,
                    substituteRegex: false,
                    minDepth: null,
                    maxDepth: null,
                    only_format_display: false,
                    only_format_prompt: true
                });
                added++;
            }

            if (added > 0) {
                saveSettingsDebounced();
                if (typeof toastr !== "undefined") toastr.success("Regex rules installed! Please refresh the page (F5) to see them in the Regex tab.", "Relations Tracker");
            } else {
                if (typeof toastr !== "undefined") toastr.info("Regex rules are already installed.", "Relations Tracker");
            }
        });

        // Custom Bonds Generate Button
        document.getElementById('rt-cb-generate').addEventListener('click', async () => {
            const settings = getSettings();
            const name = document.getElementById('rt-cb-name').value.trim();
            const hint = document.getElementById('rt-cb-behavior').value.trim();
            
            if (!name) return typeof toastr !== 'undefined' ? toastr.warning("Please enter a Name first (e.g. Mentor)") : null;
            
            const cp = settings.connectionProfile;
            if (!cp) return typeof toastr !== 'undefined' ? toastr.error("Select a Connection Profile first for auto-generation.") : null;
            
            let hintSection = "";
            if (hint) hintSection = `The user has provided a hint/idea for this bond: "${hint}". Expand on this idea.`;
            else hintSection = `The user has not provided a hint, use your imagination based on the name.`;
            
            const prompt = customBondPrompt
                .replace('{{BOND_NAME}}', name)
                .replace('{{HINT_SECTION}}', hintSection);
            
            if (typeof toastr !== 'undefined') toastr.info("Generating options via AI...", "Relations Tracker");
            try {
                const response = await ConnectionManagerRequestService.sendRequest(
                    cp, [{ role: "user", content: prompt }], undefined, { stream: false, extractData: true }
                );
                
                let rawText = "";
                if (typeof response === 'string') rawText = response;
                else if (response && response.text) rawText = response.text;
                
                let options = [];
                try {
                    // Try parsing JSON array directly or extracting it via regex
                    const jsonMatch = rawText.match(/\[([\s\S]*?)\]/);
                    if (jsonMatch) {
                        options = JSON.parse(jsonMatch[0]);
                    } else {
                        options = JSON.parse(rawText);
                    }
                } catch (e) {
                    console.error("[RT] Failed to parse JSON options, falling back to split", rawText);
                    // Fallback if AI didn't return valid JSON array
                    options = rawText.split('\n').filter(l => l.trim().length > 5).slice(0, 3);
                }
                
                const container = document.getElementById('rt-cb-options');
                container.innerHTML = '';
                container.style.display = 'flex';
                
                if (!options || options.length === 0) {
                    return typeof toastr !== 'undefined' ? toastr.error("AI failed to generate valid options.") : null;
                }
                
                options.forEach((opt, idx) => {
                    const btn = document.createElement('div');
                    btn.className = 'menu_button interactable';
                    btn.style.cssText = 'white-space: normal; text-align: left; padding: 6px; font-size: 0.85em; line-height: 1.2;';
                    btn.innerHTML = `<b>Option ${idx + 1}:</b> ${escapeHtml(opt)}`;
                    btn.addEventListener('click', () => {
                        document.getElementById('rt-cb-behavior').value = opt;
                        container.style.display = 'none';
                        if (typeof toastr !== 'undefined') toastr.success("Option applied!");
                    });
                    container.appendChild(btn);
                });
                
            } catch (e) {
                console.error("[RT] Generation failed:", e);
                return typeof toastr !== 'undefined' ? toastr.error("Failed to generate behavior.") : null;
            }
        });

        // Custom Bonds Add Button
        document.getElementById('rt-cb-add').addEventListener('click', async () => {
            const settings = getSettings();
            const code = document.getElementById('rt-cb-code').value.trim();
            const name = document.getElementById('rt-cb-name').value.trim();
            const color = document.getElementById('rt-cb-color').value;
            const behavior = document.getElementById('rt-cb-behavior').value.trim();
            
            if (!code || !name) return typeof toastr !== 'undefined' ? toastr.warning("Code and Name are required") : null;
            if (!code.startsWith('[')) return typeof toastr !== 'undefined' ? toastr.warning("Code must start with '[' e.g. [M]") : null;
            if (!behavior) return typeof toastr !== 'undefined' ? toastr.warning("Behavior prompt is required. Use the Generate button if needed.") : null;
            
            if (!settings.customBonds) settings.customBonds = [];
            settings.customBonds.push({ code, name, color, behavior });
            saveSettings();
            
            document.getElementById('rt-cb-code').value = '';
            document.getElementById('rt-cb-name').value = '';
            document.getElementById('rt-cb-behavior').value = '';
            updateCustomBonds(settings.customBonds);
            renderCustomBonds();
        });
        
        // Expose global delete for CB
        window.deleteCustomBond = function(idx) {
            const settings = getSettings();
            if (settings.customBonds && settings.customBonds[idx]) {
                settings.customBonds.splice(idx, 1);
                saveSettings();
                updateCustomBonds(settings.customBonds);
                renderCustomBonds();
            }
        };

        // Widget logic
        const widgetIcon = document.querySelector('.rt-float-icon');
        const widgetPanel = document.querySelector('.rt-float-panel');
        if (widgetIcon && widgetPanel) {
            widgetIcon.addEventListener('mouseenter', () => widgetPanel.style.display = 'block');
            document.getElementById('rt-float-widget').addEventListener('mouseleave', () => widgetPanel.style.display = 'none');
            document.getElementById('rt-float-widget').style.display = 'flex';
        }
        
        // Graph logic
        document.getElementById('rt-graph-btn').addEventListener('click', () => {
            const popup = document.getElementById('rt-graph-popup');
            if (popup) {
                popup.style.display = 'flex';
                if (graphInstance) graphInstance.destroy();
                const canvas = document.getElementById('rt-graph-canvas');
                graphInstance = new RelationGraph(canvas, relationsData);
                graphInstance.init();
            }
        });
        document.getElementById('rt-graph-close').addEventListener('click', () => {
            const popup = document.getElementById('rt-graph-popup');
            if (popup) popup.style.display = 'none';
            if (graphInstance) graphInstance.destroy();
        });

    } catch (error) {
        console.error("[RT] Init failed:", error);
    }
}

function renderCustomBonds() {
    const list = document.getElementById('rt-custom-bonds-list');
    if (!list) return;
    const settings = getSettings();
    const cbs = settings.customBonds || [];
    if (cbs.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:var(--grey50);font-size:0.8em;">No custom bonds yet.</div>`;
        return;
    }
    list.innerHTML = cbs.map((cb, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cb.color}"></div>
                <b>${cb.code} ${cb.name}</b>
            </div>
            <div class="menu_button fa-solid fa-trash" style="padding: 5px;" onclick="window.deleteCustomBond(${idx})" title="Delete"></div>
        </div>
        <div style="font-size: 0.8em; color: var(--grey50); padding: 0 5px 5px 25px;">${cb.behavior}</div>
    `).join('');
}

function renderGallery() {
    const container = document.getElementById('rt-gallery-container');
    if (!container) return;
    let allMilestones = [];
    for (const pairKey in milestonesMap) {
        for (const ms of milestonesMap[pairKey]) {
            allMilestones.push({ pairKey, ...ms });
        }
    }
    allMilestones.sort((a, b) => b.timestamp - a.timestamp); // newest first
    
    if (allMilestones.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--grey50); font-size: 0.8em;">No milestones recorded yet.</div>`;
        return;
    }
    
    container.innerHTML = allMilestones.map(ms => {
        const timeStr = new Date(ms.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `<div style="margin-bottom: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px; border-left: 3px solid #ffeb3b;">
            <div style="font-size: 0.8em; color: var(--grey50); display: flex; justify-content: space-between;">
                <span>${ms.pairKey}</span>
                <span>${timeStr}</span>
            </div>
            <div>${ms.icon} ${ms.event}</div>
        </div>`;
    }).join('');
}

function pushSystemMessage(text) {
    const context = getContext();
    if (!context || !context.chat) return;
    
    context.chat.push({
        is_system: true,
        name: "System",
        mes: `<i>${text}</i>`,
        send_date: Date.now(),
        is_user: false
    });
    
    if (typeof saveChatDebounced !== 'undefined') saveChatDebounced();
    if (eventSource) eventSource.emit(event_types.CHAT_CHANGED);
}

async function generateResume(relationsData) {
    const settings = getSettings();
    const cp = settings.connectionProfile;
    if (!cp) return; 
    
    const promptTemplate = resumePrompts[settings.promptLang] || resumePrompts['EN'];
    const lang = settings.promptLang || 'EN';
    const lengthDict = {
        'EN': {
            'short': "Keep it very brief (1-3 sentences total).",
            'medium': "Provide a moderate amount of detail (1 paragraph per major character).",
            'detailed': "Provide a highly detailed summary covering every nuanced relationship (2-3 sentences per character)."
        },
        'RU': {
            'short': "Сделай это очень кратко (всего 1-3 предложения).",
            'medium': "Предоставь умеренное количество деталей (1 абзац на каждого главного персонажа).",
            'detailed': "Предоставь очень подробную сводку, охватывающую все нюансы отношений (2-3 предложения на персонажа)."
        },
        'UK': {
            'short': "Зроби це дуже стисло (всього 1-3 речення).",
            'medium': "Надай помірну кількість деталей (1 абзац на кожного головного персонажа).",
            'detailed': "Надай дуже детальне зведення, що охоплює всі нюанси стосунків (2-3 речення на персонажа)."
        }
    };
    const dict = lengthDict[lang] || lengthDict['EN'];
    let lengthInstruction = dict[settings.resumeLength] || dict['short'];
    
    const prompt = promptTemplate
        .replace('{{RELATIONS_JSON}}', JSON.stringify(relationsData, null, 2))
        .replace('{{LENGTH_INSTRUCTION}}', lengthInstruction);
    
    try {
        const response = await ConnectionManagerRequestService.sendRequest(
            cp,
            [{ role: "user", content: prompt }],
            undefined,
            { stream: false, extractData: true }
        );
        let summary = "";
        if (typeof response === 'string') summary = response.trim();
        else if (response && response.text) summary = response.text.trim();
        
        if (summary) {
            let parsedCards = [];
            try {
                const match = summary.match(/\[([\s\S]*?)\]/);
                if (match) parsedCards = JSON.parse(match[0]);
                else parsedCards = JSON.parse(summary);
            } catch(e) {
                console.warn("[RT] Could not parse AI resume as JSON, storing raw text", summary);
                parsedCards = summary;
            }
            settings.nlResume = parsedCards;
            saveSettings();
            renderResumeCards(parsedCards);
            injectIntoPrompt();
        }
    } catch (err) {
        console.error("[RT] Generate resume failed:", err);
    }
}

function renderResumeCards(cards) {
    const container = document.getElementById('rt-nl-resume-cards');
    if (!container) return;
    if (!cards) {
        container.innerHTML = '<div style="text-align: center; color: var(--grey50); font-size: 0.8em; font-style: italic; padding: 10px;">No character cards generated yet.</div>';
        return;
    }
    if (typeof cards === 'string') {
        container.innerHTML = `<div style="padding: 10px; font-style: italic; color: var(--grey50); font-size: 0.85em;">${escapeHtml(cards)}</div>`;
        return;
    }
    if (Array.isArray(cards) && cards.length > 0) {
        container.innerHTML = cards.map(c => `
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden; margin-bottom: 5px;">
                <div style="background: rgba(0,0,0,0.3); padding: 5px 10px; font-weight: bold; font-size: 0.9em; border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--SmartThemeBodyColor);">
                    <i class="fa-solid fa-user" style="margin-right: 5px; color: #a29bfe;"></i> ${escapeHtml(c.character || 'Unknown')}
                </div>
                <div style="padding: 8px 10px; font-size: 0.85em; color: var(--SmartThemeBodyColor); line-height: 1.4;">
                    ${escapeHtml(c.summary || '')}
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div style="text-align: center; color: var(--grey50); font-size: 0.8em; font-style: italic; padding: 10px;">AI returned empty cards list.</div>';
    }
}

jQuery(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.type = 'text/css';
    link.href = `${extensionFolderPath}/style.css`;
    document.head.appendChild(link);
    await initUI();
    renderCustomBonds();
    renderGallery();
    const settings = getSettings();
    renderResumeCards(settings.nlResume);
    
    setTimeout(() => scanChatForRelations(), 1000);
    if (eventSource) {
        eventSource.on(event_types.MESSAGE_RECEIVED, async () => { scanChatForRelations(); await runAIAnalysis(); });
        eventSource.on(event_types.CHAT_CHANGED, () => { loadRelationsFromSettings(); scanChatForRelations(); });
    }
});
