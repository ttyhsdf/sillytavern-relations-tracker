import { extension_settings, getContext } from "../../../extensions.js";
import { eventSource, event_types, generateRaw, saveSettingsDebounced, setExtensionPrompt } from "../../../../script.js";
import { ConnectionManagerRequestService } from "../../shared.js";
import { systemPrompts, VALID_TIERS, VALID_BONDS } from "./prompts.js";
import { getTierFromCP, getTierLabel, getTierLabelsForBond } from "./tiers.js";
import { ALL_BONDS, isTransitionAllowed, clampCP } from "./rules.js";
import { createHistoryEntry, addHistoryEntry, getPairKey, renderHistoryHTML } from "./history.js";
import { smartScan, fullScan } from "./scanner.js";

const extensionName = "sillytavern-relations-tracker";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let relationsData = [];
let historyMap = {};
let pendingChanges = null;
let isGenerating = false;

const defaultSettings = {
    mode: 'auto',
    smartScan: true,
    scanDepth: 10,
    promptLang: 'EN',
    connectionProfile: '',
    debug: false,
    relations: {},
    history: {}
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
    $('#rt-debug').prop('checked', settings.debug);
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
    renderCards();
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
        history: current.history || {}
    };
    saveSettingsDebounced();
}

function saveRelations() {
    const chatKey = getChatKey();
    if (!chatKey) return;
    if (!extension_settings[extensionName]) extension_settings[extensionName] = Object.assign({}, defaultSettings);
    if (!extension_settings[extensionName].relations) extension_settings[extensionName].relations = {};
    if (!extension_settings[extensionName].history) extension_settings[extensionName].history = {};
    extension_settings[extensionName].relations[chatKey] = JSON.parse(JSON.stringify(relationsData));
    extension_settings[extensionName].history[chatKey] = JSON.parse(JSON.stringify(historyMap));
    saveSettingsDebounced();
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
    for (let i = context.chat.length - 1; i >= 0; i--) {
        const msg = context.chat[i].mes;
        if (!msg) continue;
        const parsed = parseRelationsTag(msg);
        if (parsed) {
            relationsData = parsed;
            renderCards();
            injectIntoPrompt();
            saveRelations();
            return;
        }
    }
}

function injectIntoPrompt() {
    const tag = buildRelationsTag();
    if (!tag) return;
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
    for (const newRel of newRelations) {
        const oldRel = relationsData.find(r => r.source === newRel.source && r.target === newRel.target);
        if (oldRel) {
            const entry = createHistoryEntry(oldRel, newRel, msgIndex);
            if (entry) {
                addHistoryEntry(historyMap, getPairKey(newRel.source, newRel.target), entry);
                const diff = newRel.cp - oldRel.cp;
                if (diff !== 0) changeSummary.push(`${newRel.source} (${diff > 0 ? '+' : ''}${diff} CP)`);
            }
            newRel.locked = oldRel.locked || false;
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
    switch(bond) {
        case '[R]': return '#ff6b81';
        case '[F]': return '#70a1ff';
        case '[P]': return '#7bed9f';
        case '[PL]': return '#ffd32a';
        case '[H]': return '#ff4757';
        case '[C]': return '#a29bfe';
        default: return '#ffa502';
    }
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
        if (historyContent) historyContent.innerHTML = renderHistoryHTML(historyMap[pairKey] || []);

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
        $('#rt-prompt-lang, #rt-connection-profile').on('change', saveSettings);

        document.getElementById('rt-add-btn').addEventListener('click', addRelationship);
        document.getElementById('rt-refresh-btn').addEventListener('click', () => scanChatForRelations());
        document.getElementById('rt-export-btn').addEventListener('click', exportRelations);
        document.getElementById('rt-import-btn').addEventListener('click', () => document.getElementById('rt-import-file').click());
        document.getElementById('rt-import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) { importRelations(e.target.files[0]); e.target.value = ''; }
        });

        document.getElementById('rt-hybrid-apply').addEventListener('click', () => {
            if (pendingChanges) { applyChanges(pendingChanges.newRelations, pendingChanges.msgIndex); hideHybridBanner(); }
        });
        document.getElementById('rt-hybrid-dismiss').addEventListener('click', () => {
            hideHybridBanner();
            if (typeof toastr !== "undefined") toastr.info("Dismissed.", "RT");
        });

    } catch (error) {
        console.error("[RT] Init failed:", error);
    }
}

jQuery(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.type = 'text/css';
    link.href = `${extensionFolderPath}/style.css`;
    document.head.appendChild(link);
    await initUI();
    setTimeout(() => scanChatForRelations(), 1000);
    if (eventSource) {
        eventSource.on(event_types.MESSAGE_RECEIVED, async () => { scanChatForRelations(); await runAIAnalysis(); });
        eventSource.on(event_types.CHAT_CHANGED, () => { loadRelationsFromSettings(); scanChatForRelations(); });
    }
});
