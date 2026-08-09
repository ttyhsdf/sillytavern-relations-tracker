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
import { applyRelationshipDecay, normalizeStats } from "./mechanics.js";
import { initInfoblock, updateInfoblock } from "./infoblock.js";

const extensionName = "sillytavern-relations-tracker";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let relationsData = [];
let historyMap = {};
let milestonesMap = {};
let pendingChanges = null;
let isGenerating = false;
let graphInstance = null;
let saveRelationsDebounceTimer = null;

// =====================
// Utilities
// =====================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debugLog(...args) {
    if (extension_settings[extensionName]?.debug) console.log("[RT]", ...args);
}

// =====================
// Settings
// =====================
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
    enableAdvStats: true,
    enableSystemMessages: false,
    customBonds: [],
    resumeLength: 'short',
    nlResume: null,
};

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

/**
 * Load settings FROM storage INTO the UI.
 * Never reads UI values — only writes them.
 */
function applySettingsToUI() {
    const settings = getSettings();
    $('.rt-mode-btn').removeClass('active');
    $(`.rt-mode-btn[data-mode="${settings.mode}"]`).addClass('active');
    $('#rt-smart-scan').prop('checked', settings.smartScan);
    $('#rt-scan-depth').val(settings.scanDepth);
    $('#rt-prompt-lang').val(settings.promptLang);
    $('#rt-connection-profile').val(settings.connectionProfile);
    $('#rt-resume-length').val(settings.resumeLength || 'short');
    $('#rt-debug').prop('checked', settings.debug);
    $('#rt-enable-decay').prop('checked', settings.enableDecay ?? true);
    $('#rt-enable-adv-stats').prop('checked', settings.enableAdvStats ?? true);
    updateCustomBonds(settings.customBonds || []);
    loadRelationsFromSettings();
}

/**
 * Read settings FROM the UI and save to storage.
 * Only call this when UI is guaranteed to be ready.
 */
function saveSettings() {
    const current = extension_settings[extensionName] || {};
    const activeMode = $('.rt-mode-btn.active').data('mode') || current.mode || 'auto';
    extension_settings[extensionName] = Object.assign({}, current, {
        mode: activeMode,
        smartScan: $('#rt-smart-scan').prop('checked') ?? current.smartScan,
        scanDepth: parseInt($('#rt-scan-depth').val(), 10) || current.scanDepth || 10,
        promptLang: $('#rt-prompt-lang').val() || current.promptLang || 'EN',
        connectionProfile: $('#rt-connection-profile').val() ?? current.connectionProfile ?? '',
        debug: $('#rt-debug').prop('checked') ?? current.debug,
        enableDecay: $('#rt-enable-decay').prop('checked') ?? current.enableDecay ?? true,
        enableAdvStats: $('#rt-enable-adv-stats').prop('checked') ?? current.enableAdvStats ?? true,
        resumeLength: $('#rt-resume-length').val() || current.resumeLength || 'short',
    });
    saveSettingsDebounced();
}

function saveRelations() {
    const chatKey = getChatKey();
    if (!chatKey) return;
    if (!extension_settings[extensionName]) extension_settings[extensionName] = Object.assign({}, defaultSettings);
    const s = extension_settings[extensionName];
    if (!s.relations) s.relations = {};
    if (!s.history) s.history = {};
    if (!s.milestones) s.milestones = {};
    s.relations[chatKey] = JSON.parse(JSON.stringify(relationsData));
    s.history[chatKey] = JSON.parse(JSON.stringify(historyMap));
    s.milestones[chatKey] = JSON.parse(JSON.stringify(milestonesMap));

    // Debounced save
    clearTimeout(saveRelationsDebounceTimer);
    saveRelationsDebounceTimer = setTimeout(() => {
        saveSettingsDebounced();
        updateFloatingWidget();
    }, 400);
}

function loadRelationsFromSettings() {
    const settings = getSettings();
    const chatKey = getChatKey();
    relationsData = chatKey && settings.relations?.[chatKey]
        ? JSON.parse(JSON.stringify(settings.relations[chatKey]))
        : [];
    historyMap = chatKey && settings.history?.[chatKey]
        ? JSON.parse(JSON.stringify(settings.history[chatKey]))
        : {};
    milestonesMap = chatKey && settings.milestones?.[chatKey]
        ? JSON.parse(JSON.stringify(settings.milestones[chatKey]))
        : {};
    renderCards();
    updateFloatingWidget();
}

function loadConnectionProfiles() {
    const context = getContext();
    const select = $('#rt-connection-profile');
    const currentValue = getSettings().connectionProfile;
    select.empty();
    select.append('<option value="">-- Use Main API --</option>');
    if (context?.extensionSettings?.connectionManager?.profiles) {
        context.extensionSettings.connectionManager.profiles.forEach(p => {
            select.append(`<option value="${p.id}">${escapeHtml(p.name)}</option>`);
        });
    }
    if (currentValue) select.val(currentValue);
}

// =====================
// Robust JSON Extractor
// =====================
/**
 * Multi-strategy JSON array extractor.
 * Handles: clean responses, reasoning models, markdown fences, bond full-names.
 * Returns parsed array or null on total failure.
 */
function extractAndParseRelations(raw) {
    if (!raw || typeof raw !== 'string') return null;

    // Pre-normalize bond full names: "[P] Platonic" → "[P]" etc.
    let text = raw
        .replace(/"(\[R\])\s*Romantic"/g, '"$1"')
        .replace(/"(\[PL\])\s*Platonic\s*Love"/g, '"$1"')
        .replace(/"(\[P\])\s*Platonic"/g, '"$1"')
        .replace(/"(\[F\])\s*Family"/g, '"$1"')
        .replace(/"(\[H\])\s*Hostile"/g, '"$1"')
        .replace(/"(\[C\])\s*Complicated"/g, '"$1"');

    // Strategy 1: direct parse (clean response)
    try {
        const p = JSON.parse(text.trim());
        if (Array.isArray(p)) return p;
    } catch (_) {}

    // Strategy 2: scan ALL `[…]` arrays via bracket-depth walk,
    // collect all parseable arrays, return the best one (most relation-like objects).
    // KEY FIX: instead of break on first fail, we continue scanning the rest of the text.
    const candidates = [];
    let scanFrom = 0;
    while (scanFrom < text.length) {
        const start = text.indexOf('[', scanFrom);
        if (start === -1) break;

        let depth = 0, inStr = false, esc = false;
        let found = false;
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '[' || ch === '{') depth++;
            else if (ch === ']' || ch === '}') {
                depth--;
                if (depth === 0) {
                    try {
                        const p = JSON.parse(text.slice(start, i + 1));
                        if (Array.isArray(p)) candidates.push(p);
                    } catch (_) {}
                    scanFrom = i + 1; // continue scanning AFTER this bracket group
                    found = true;
                    break;
                }
            }
        }
        if (!found) break; // no matching bracket found, stop
    }

    if (candidates.length > 0) {
        // Return the best candidate: one that has objects with char_a/char_b or source/target keys
        const relationsLike = (arr) => arr.length > 0 && typeof arr[0] === 'object' &&
            arr[0] !== null &&
            (('char_a' in arr[0] || 'source' in arr[0]) || ('char_b' in arr[0] || 'target' in arr[0]));

        const best = candidates.find(relationsLike) || candidates[candidates.length - 1];
        return best;
    }

    // Strategy 3: strip markdown fences then retry
    const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
    try {
        const p = JSON.parse(stripped);
        if (Array.isArray(p)) return p;
    } catch (_) {}

    return null;
}


/**
 * Extract text content from any shape of response that ConnectionManagerRequestService might return.
 * Logs all branches so we can debug in F12 console.
 */
function extractTextFromResponse(response) {
    if (!response) {
        console.warn("[RT] extractTextFromResponse: response is null/undefined");
        return '';
    }

    // Shape 1: plain string (some ST versions return text directly)
    if (typeof response === 'string') {
        console.log("[RT] Response shape: plain string, length:", response.length);
        return response.trim();
    }

    // Shape 2: { text: "..." } — ST wraps extracted content
    if (typeof response.text === 'string' && response.text.trim()) {
        console.log("[RT] Response shape: { text }, length:", response.text.length);
        return response.text.trim();
    }

    // Shape 3: OpenAI-style { choices: [{ message: { content, reasoning_content } }] }
    if (response.choices?.[0]?.message) {
        const msg = response.choices[0].message;
        console.log("[RT] Response shape: OpenAI choices[]. content length:", msg.content?.length, "reasoning length:", msg.reasoning_content?.length);

        // Prefer content over reasoning_content
        if (msg.content && msg.content.trim()) {
            return msg.content.trim();
        }
        // Reasoning model returned empty content — fall back to reasoning_content
        if (msg.reasoning_content && msg.reasoning_content.trim()) {
            console.warn("[RT] content was empty, using reasoning_content as fallback");
            return msg.reasoning_content.trim();
        }
        return '';
    }

    // Shape 4: { content: "..." } — some wrappers
    if (typeof response.content === 'string' && response.content.trim()) {
        console.log("[RT] Response shape: { content }");
        return response.content.trim();
    }

    // Shape 5: { message: { content } } — another possible wrapper
    if (response.message?.content) {
        console.log("[RT] Response shape: { message.content }");
        return String(response.message.content).trim();
    }

    // Unknown — log it fully and stringify
    console.warn("[RT] Unknown response shape:", JSON.stringify(response).substring(0, 500));
    return String(response).trim();
}


// =====================
// Chat Tag Parsing
// =====================
function parseRelationsTag(text) {
    const match = text.match(/<!--RELATIONS_ARCHIVE:\s*(.+?)\s*-->/s);
    if (!match) return null;
    const relations = match[1].split('/').map(r => r.trim()).filter(Boolean);
    const parsed = [];
    for (const rel of relations) {
        const arrowSplit = rel.split(/→|->/, 2);
        if (arrowSplit.length < 2) continue;
        const source = arrowSplit[0].trim();
        const rest = arrowSplit[1];
        const eqIdx = rest.indexOf('=');
        if (eqIdx === -1) continue;
        const target = rest.slice(0, eqIdx).trim();
        const fields = rest.slice(eqIdx + 1).split(',').map(f => f.trim());
        const cp = parseInt(fields[0]) || 0;
        parsed.push({
            source, target,
            cp,
            tier: getTierFromCP(cp), // Always derive from cp, never trust stored tier string
            bond: fields[2] || "[P]",
            label: fields[3] || "",
            locked: false
        });
    }
    return parsed;
}

function buildRelationsTag() {
    if (relationsData.length === 0) return "";
    const parts = relationsData.map(r =>
        `${r.source}→${r.target}=${r.cp},${getTierFromCP(r.cp)},${r.bond},${r.label || ''}`
    );
    return `<!--RELATIONS_ARCHIVE:${parts.join(' / ')}-->`;
}

// =====================
// Chat Scanning
// =====================
function scanChatForRelations() {
    const context = getContext();
    if (!context?.chat?.length) return;
    const settings = getSettings();
    const currentMsgCount = context.chat.length;

    // Scan backwards for the most recent tag
    for (let i = context.chat.length - 1; i >= 0; i--) {
        const msg = context.chat[i]?.mes;
        if (!msg) continue;
        const parsed = parseRelationsTag(msg);
        if (parsed) {
            // Found tag — use it as base, then apply decay if enabled
            relationsData = parsed;

            if (settings.enableDecay) {
                let changed = false;
                for (const rel of relationsData) {
                    const lastInt = checkInteraction(context.chat, rel.source, rel.target, rel.lastInteractionMsg ?? 0);
                    if (lastInt > (rel.lastInteractionMsg ?? 0)) {
                        rel.lastInteractionMsg = lastInt;
                        changed = true;
                    }
                    const decayed = calculateDecay(rel, currentMsgCount);
                    if (decayed !== rel.cp && !rel.locked) {
                        rel.cp = decayed;
                        rel.tier = getTierFromCP(rel.cp);
                        changed = true;
                    }
                }
                if (changed) saveRelations();
            }

            renderCards();
            updateFloatingWidget();
            injectIntoPrompt();
            return; // Done — don't fall through to settings load
        }
    }

    // No tag in chat — fall back to settings (do NOT reset to [])
    loadRelationsFromSettings();
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
async function runAIAnalysis(force = false) {
    const settings = getSettings();
    if (settings.mode === 'manual' && !force) return;
    if (isGenerating) return;

    const context = getContext();
    // Need at least one exchange (bot intro + user response)
    if (!context?.chat?.length || context.chat.length < 2) return;

    // Only analyze real chat messages — skip system messages
    const chatMessages = context.chat.filter(m => !m.is_system);
    if (chatMessages.length < 2) return;

    const depth = settings.scanDepth || 10;
    const recentMessages = settings.smartScan
        ? smartScan(chatMessages, depth)
        : fullScan(chatMessages, depth);

    if (!recentMessages || !recentMessages.trim()) return;

    const relationsJson = JSON.stringify(relationsData, null, 2);
    let promptInstruction = systemPrompts[settings.promptLang] || systemPrompts['EN'];
    promptInstruction = promptInstruction.replace('{{RELATIONS_JSON}}', relationsJson);

    let customBondsListStr = "";
    let customBondsRulesStr = "";
    if (settings.customBonds?.length > 0) {
        customBondsListStr = ", " + settings.customBonds.map(b => `${b.code} ${b.name}`).join(", ");
        customBondsRulesStr = "\n" + settings.customBonds.map(b =>
            `• ${b.code} ${b.name}: ${b.behavior || 'Follow standard relationship rules.'}`
        ).join("\n");
    }
    promptInstruction = promptInstruction
        .replace('{{CUSTOM_BONDS_LIST}}', customBondsListStr)
        .replace('{{CUSTOM_BONDS_RULES}}', customBondsRulesStr);

    const sysPrompt = `You are a background relation tracking AI.\n\n${promptInstruction}`;

    isGenerating = true;
    try {
        debugLog("AI analysis. Mode:", settings.mode, "Depth:", depth);

        // Small delay to ensure the last message is committed to context
        await new Promise(r => setTimeout(r, 800));

        let result = "";

        if (settings.connectionProfile) {
            debugLog("Using Connection Profile:", settings.connectionProfile);
            const messages = [
                { role: "system", content: sysPrompt },
                { role: "user", content: recentMessages }
            ];
            let response;
            try {
                response = await ConnectionManagerRequestService.sendRequest(
                    settings.connectionProfile,
                    messages,
                    undefined,
                    { stream: false } // No extractData — we extract manually for full control
                );
            } catch (connErr) {
                // Connection Profile failed — log and bail, DO NOT fall back to Main API
                console.error("[RT] Connection Profile request failed:", connErr);
                if (typeof toastr !== "undefined") toastr.warning("RT: Connection Profile failed. Check API settings.", "Relations Tracker");
                return;
            }
            // Always log the raw response so users can debug in F12 console
            console.log("[RT] Raw response from Connection Profile:", response);
            result = extractTextFromResponse(response);
        } else {
            debugLog("Using Main API");
            try {
                result = await generateRaw({ prompt: recentMessages, systemPrompt: sysPrompt, quietToLoud: true });
            } catch (mainErr) {
                console.error("[RT] Main API request failed:", mainErr);
                return;
            }
        }

        debugLog("AI Response:", result);

        if (!result || !result.trim()) {
            console.warn("[RT] AI returned empty content. If using a reasoning model, try increasing max_tokens in Connection Profile.");
            if (typeof toastr !== "undefined") toastr.info("RT: AI returned empty content. Increase max_tokens.", "Relations Tracker");
            return;
        }

        const newRelations = extractAndParseRelations(result);
        if (newRelations === null) {
            console.error("[RT] All JSON extraction strategies failed. Raw response:", result);
            if (typeof toastr !== "undefined") toastr.info("RT: Could not parse AI response as JSON. Check console.", "Relations Tracker");
            return;
        }

        if (!Array.isArray(newRelations) || newRelations.length === 0) {
            debugLog("AI returned empty relations array — no changes.");
            if (typeof toastr !== "undefined") toastr.info("Scan complete — no new relations found.", "Relations Tracker");
            return;
        }

        // Normalize & validate each relation
        const normalizedRelations = [];
        for (const rel of newRelations) {
            // Map char_a/char_b → source/target
            if (rel.char_a) rel.source = rel.char_a;
            if (rel.char_b) rel.target = rel.char_b;
            if (!rel.source || !rel.target) continue; // skip malformed

            // Bond: extract code from full name e.g. "[P] Platonic" → "[P]"
            if (rel.bond) {
                const m = rel.bond.match(/^\[([A-Z]+)\]/);
                if (m) rel.bond = `[${m[1]}]`;
            }
            if (!VALID_BONDS.includes(rel.bond)) rel.bond = '[P]';

            // Normalize new stats using mechanics
            normalizeStats(rel);
            rel.cp = clampCP(rel.bond, rel.cp);

            // Tier is always derived from CP — never trust AI's tier value
            rel.tier = getTierFromCP(rel.cp);

            // Bond transition rules
            const oldRel = relationsData.find(r => r.source === rel.source && r.target === rel.target);
            if (oldRel && oldRel.bond !== rel.bond) {
                if (oldRel.locked || !isTransitionAllowed(oldRel.bond, rel.bond, rel.cp)) {
                    debugLog(`Blocked transition: ${oldRel.bond} → ${rel.bond} for ${rel.source}→${rel.target}`);
                    rel.bond = oldRel.bond;
                }
            }

            normalizedRelations.push(rel);
        }

        if (normalizedRelations.length === 0) return;

        const msgIndex = context.chat.length;

        if (settings.mode === 'hybrid') {
            pendingChanges = { newRelations: normalizedRelations, msgIndex };
            showHybridBanner(normalizedRelations, msgIndex);
        } else {
            applyChanges(normalizedRelations, msgIndex);
        }

    } catch (err) {
        console.error("[RT] AI analysis error:", err);
        if (typeof toastr !== "undefined") toastr.warning("RT: AI analysis failed. Check console.", "Relations Tracker");
    } finally {
        isGenerating = false;
    }
}

function applyChanges(newRelations, msgIndex) {
    const changeSummary = [];
    const context = getContext();
    let mergedData = [...relationsData];

    for (const newRel of newRelations) {
        const pairKey = getPairKey(newRel.source, newRel.target);

        // Handle milestones
        if (newRel.milestone?.event) {
            const ms = createMilestoneFromAI(newRel.milestone, msgIndex);
            addMilestone(milestonesMap, pairKey, ms);
            changeSummary.push(`🏆 ${newRel.source}↔${newRel.target}`);
            if (getSettings().enableSystemMessages) {
                pushSystemMessage(`[RT_EVENT] 🏆 Milestone: ${newRel.source} & ${newRel.target}: ${ms.event}`);
            }
        }
        delete newRel.milestone;

        newRel.lastInteractionMsg = checkInteraction(
            context?.chat || [], newRel.source, newRel.target, Math.max(0, msgIndex - 10)
        );

        // Normalize source/target — strip stray leading/trailing punctuation like "(Seraphina" → "Seraphina"
        newRel.source = newRel.source.replace(/^[^\w]+|[^\w]+$/g, '').trim() || newRel.source;
        newRel.target = newRel.target.replace(/^[^\w]+|[^\w]+$/g, '').trim() || newRel.target;

        const oldIndex = mergedData.findIndex(r =>
            // Match in either direction — AI may flip char_a/char_b
            (r.source === newRel.source && r.target === newRel.target) ||
            (r.source === newRel.target && r.target === newRel.source)
        );
        if (oldIndex !== -1) {
            const oldRel = mergedData[oldIndex];
            const entry = createHistoryEntry(oldRel, newRel, msgIndex);
            if (entry) {
                addHistoryEntry(historyMap, pairKey, entry);
                const diff = newRel.cp - oldRel.cp;
                if (diff !== 0) changeSummary.push(`${newRel.source} (${diff > 0 ? '+' : ''}${diff} CP)`);
                if (oldRel.tier !== newRel.tier && getSettings().enableSystemMessages) {
                    pushSystemMessage(`[RT_EVENT] ${newRel.source} & ${newRel.target} → ${newRel.tier}`);
                }
            }
            newRel.locked = oldRel.locked || false;
            if (newRel.lastInteractionMsg === undefined) newRel.lastInteractionMsg = oldRel.lastInteractionMsg;
            // Maintain advanced stats (if AI didn't return them, keep old values)
            newRel.trust = newRel.trust !== undefined ? newRel.trust : (oldRel.trust !== undefined ? oldRel.trust : 0);
            newRel.lust = newRel.lust !== undefined ? newRel.lust : (oldRel.lust !== undefined ? oldRel.lust : 0);
            if (!newRel.status) newRel.status = oldRel.status || "";
            
            mergedData[oldIndex] = newRel;
        } else {
            newRel.locked = false;
            if (newRel.trust === undefined) newRel.trust = 0;
            if (newRel.lust === undefined) newRel.lust = 0;
            if (newRel.status === undefined) newRel.status = "";
            changeSummary.push(`New: ${newRel.source}↔${newRel.target}`);
            mergedData.push(newRel);
        }
    }

    // Apply relationship decay to the whole roster
    applyRelationshipDecay(mergedData, msgIndex, getSettings());

    relationsData = mergedData;
    renderCards();
    injectIntoPrompt();
    saveRelations();

    if (typeof toastr !== "undefined") {
        if (changeSummary.length > 0) {
            toastr.success(changeSummary.join(', '), "Relations Tracker");
        } else {
            toastr.info("Scan complete — no changes.", "Relations Tracker");
        }
    }
}

// =====================
// Hybrid Mode
// =====================
function showHybridBanner(newRelations, msgIndex) {
    const banner = document.getElementById('rt-hybrid-banner');
    const summary = document.getElementById('rt-hybrid-summary');
    if (!banner || !summary) return;

    const lines = [];
    for (const newRel of newRelations) {
        const oldRel = relationsData.find(r => r.source === newRel.source && r.target === newRel.target);
        if (oldRel) {
            const parts = [];
            if (oldRel.cp !== newRel.cp) { const d = newRel.cp - oldRel.cp; parts.push(`CP ${oldRel.cp}→${newRel.cp} (${d > 0 ? '+' : ''}${d})`); }
            if (oldRel.tier !== newRel.tier) parts.push(`${oldRel.tier}→${newRel.tier}`);
            if (oldRel.bond !== newRel.bond) parts.push(`${oldRel.bond}→${newRel.bond}`);
            if (parts.length > 0) lines.push(`<b>${escapeHtml(newRel.source)} → ${escapeHtml(newRel.target)}:</b> ${parts.join(', ')}`);
        } else {
            lines.push(`<b>New:</b> ${escapeHtml(newRel.source)} → ${escapeHtml(newRel.target)} (${newRel.bond} CP:${newRel.cp})`);
        }
    }
    summary.innerHTML = lines.length ? lines.join('<br>') : 'No changes detected.';
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
    const info = ALL_BONDS.find(b => b.code === bond);
    return info?.color || '#ffa502';
}

function updateSliderStyle(slider, cp, bond = null) {
    const percent = ((cp + 100) / 200) * 100;
    slider.style.setProperty('--slider-progress', `${percent}%`);
    if (bond) slider.style.setProperty('--slider-color', getBondColor(bond));
}

function updateCardAccent(card, bond) {
    card.setAttribute('data-bond', bond);
    const bondLabel = card.querySelector('.rt-bond-label');
    if (bondLabel) {
        bondLabel.setAttribute('data-bond', bond);
        const info = ALL_BONDS.find(b => b.code === bond);
        bondLabel.textContent = info ? info.name : bond;
    }
    const cpValue = card.querySelector('.rt-cp-value');
    if (cpValue) cpValue.style.color = getBondColor(bond);
}

function updateTierDropdown(tierSelect, bond, currentTier) {
    const labels = getTierLabelsForBond(bond);
    const TIER_VALUES = ['Frozen', 'Cold', 'Distant', 'Neutral', 'Warm', 'Close', 'Devoted'];
    tierSelect.innerHTML = '';
    labels.forEach((label, i) => {
        const opt = document.createElement('option');
        opt.value = TIER_VALUES[i];
        opt.textContent = label;
        tierSelect.appendChild(opt);
    });
    // Set correct value — fallback to first option if not found
    if (currentTier && TIER_VALUES.includes(currentTier)) {
        tierSelect.value = currentTier;
    } else {
        tierSelect.value = TIER_VALUES[0];
    }
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
        // Ensure tier is always valid
        if (!VALID_TIERS.includes(rel.tier)) {
            rel.tier = getTierFromCP(rel.cp);
        }

        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.rt-card');
        card.dataset.index = index;

        card.querySelector('.rt-source').textContent = rel.source;
        card.querySelector('.rt-target').textContent = rel.target;
        card.querySelector('.rt-bond-type').value = rel.bond;

        const tierSelect = card.querySelector('.rt-tier');
        updateTierDropdown(tierSelect, rel.bond, rel.tier);

        card.querySelector('.rt-label').value = rel.label || '';
        card.querySelector('.rt-cp-slider').value = rel.cp;
        card.querySelector('.rt-cp-value').textContent = rel.cp;

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

        const tierLabel = card.querySelector('.rt-tier-label');
        if (tierLabel) tierLabel.textContent = getTierLabel(rel.cp, rel.bond);

        // History + Milestones panel
        const pairKey = getPairKey(rel.source, rel.target);
        const historyContent = card.querySelector('.rt-history-content');
        if (historyContent) {
            const milestonesList = getMilestones(milestonesMap, pairKey);
            let html = '';
            if (milestonesList?.length > 0) {
                html += renderMilestonesHTML(milestonesList) + '<hr style="border-color:rgba(255,255,255,0.1);margin:6px 0;">';
            }
            html += renderHistoryHTML(historyMap[pairKey] || []);
            historyContent.innerHTML = html;
        }

        const histToggle = card.querySelector('.rt-history-toggle');
        const histPanel = card.querySelector('.rt-history-panel');
        if (histToggle && histPanel) {
            histToggle.addEventListener('click', () => {
                histPanel.style.display = histPanel.style.display === 'none' ? 'block' : 'none';
            });
        }

        // Advanced Stats
        const advPanel = card.querySelector('.rt-adv-panel');
        if (advPanel) {
            const settings = getSettings();
            if (!settings.enableAdvStats) {
                advPanel.style.display = 'none';
            } else {
                advPanel.style.display = 'block';
                
                const trustVal = card.querySelector('.rt-trust-val');
                const trustSlider = card.querySelector('.rt-trust-slider');
                if (trustSlider && trustVal) {
                    trustSlider.value = rel.trust || 0;
                    trustVal.textContent = trustSlider.value;
                    updateSliderStyle(trustSlider, trustSlider.value);
                    
                    trustSlider.addEventListener('input', (e) => {
                        const val = parseInt(e.target.value, 10);
                        trustVal.textContent = val;
                        relationsData[index].trust = val;
                        updateSliderStyle(e.target, val);
                        injectIntoPrompt();
                        saveRelations();
                    });
                }
                
                const lustVal = card.querySelector('.rt-lust-val');
                const lustSlider = card.querySelector('.rt-lust-slider');
                if (lustSlider && lustVal) {
                    lustSlider.value = rel.lust || 0;
                    lustVal.textContent = lustSlider.value;
                    updateSliderStyle(lustSlider, lustSlider.value);
                    
                    lustSlider.addEventListener('input', (e) => {
                        const val = parseInt(e.target.value, 10);
                        lustVal.textContent = val;
                        relationsData[index].lust = val;
                        updateSliderStyle(e.target, val);
                        injectIntoPrompt();
                        saveRelations();
                    });
                }
            }
        }

        // Status Badge
        const statusBadge = card.querySelector('.rt-status-badge');
        if (statusBadge) {
            if (rel.status) {
                statusBadge.textContent = rel.status;
                statusBadge.style.display = 'block';
            } else {
                statusBadge.style.display = 'none';
            }
        }

        // CP slider
        sliderElement.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            val = clampCP(relationsData[index].bond, val);
            e.target.value = val;
            card.querySelector('.rt-cp-value').textContent = val;
            relationsData[index].cp = val;
            relationsData[index].tier = getTierFromCP(val);
            tierSelect.value = relationsData[index].tier;
            if (tierLabel) tierLabel.textContent = getTierLabel(val, relationsData[index].bond);
            updateSliderStyle(e.target, val, relationsData[index].bond);
            injectIntoPrompt();
            saveRelations();
        });

        // Bond type change
        card.querySelector('.rt-bond-type').addEventListener('change', (e) => {
            const newBond = e.target.value;
            relationsData[index].bond = newBond;
            relationsData[index].cp = clampCP(newBond, relationsData[index].cp);
            sliderElement.value = relationsData[index].cp;
            card.querySelector('.rt-cp-value').textContent = relationsData[index].cp;
            relationsData[index].tier = getTierFromCP(relationsData[index].cp);
            updateTierDropdown(tierSelect, newBond, relationsData[index].tier);
            if (tierLabel) tierLabel.textContent = getTierLabel(relationsData[index].cp, newBond);
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

    updateInfoblock(relationsData, getBondColor, getSettings);
}

// =====================
// Add / Export / Import
// =====================
function addRelationship() {
    const context = getContext();
    const charName = context?.name2 || "Character";
    const userName = context?.name1 || "User";
    relationsData.push({ source: charName, target: userName, cp: 0, tier: "Neutral", bond: "[P]", label: "Just met", locked: false });
    renderCards(); injectIntoPrompt(); saveRelations();
}

function exportRelations() {
    const data = { relations: relationsData, history: historyMap, milestones: milestonesMap, chatKey: getChatKey(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relations_${getChatKey() || 'export'}.json`; a.click();
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
                milestonesMap = data.milestones || {};
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
// Floating Widget
// =====================
function updateFloatingWidget() {
    const list = document.getElementById('rt-float-list');
    if (!list) return;
    list.innerHTML = '';
    if (relationsData.length === 0) {
        list.innerHTML = '<div style="font-size:0.8em;color:gray;">No relations</div>';
        return;
    }
    relationsData.forEach((rel, index) => {
        const item = document.createElement('div');
        item.className = 'rt-float-item';
        item.innerHTML = `
            <div class="rt-float-pair">${escapeHtml(rel.source)} &rarr; ${escapeHtml(rel.target)}</div>
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
// System Messages
// =====================
function pushSystemMessage(text) {
    const context = getContext();
    if (!context?.chat) return;
    context.chat.push({
        is_system: true,
        name: "System",
        mes: `<i>${text}</i>`,
        send_date: Date.now(),
        is_user: false
    });
    // NOTE: do NOT emit CHAT_CHANGED here — it creates a feedback loop
    if (typeof saveChatDebounced !== 'undefined') saveChatDebounced();
}

// =====================
// Generate Resume
// =====================
async function generateResume(data) {
    const settings = getSettings();
    const cp = settings.connectionProfile;
    if (!cp) {
        if (typeof toastr !== "undefined") toastr.warning("Select a Connection Profile to generate a resume.", "Relations Tracker");
        return;
    }

    const promptTemplate = resumePrompts[settings.promptLang] || resumePrompts['EN'];
    const lang = settings.promptLang || 'EN';
    const lengthDict = {
        'EN': {
            short: "Keep it very brief (1-3 sentences total).",
            medium: "Provide a moderate amount of detail (1 paragraph per major character).",
            detailed: "Provide a highly detailed summary covering every nuanced relationship (2-3 sentences per character)."
        },
        'RU': {
            short: "Сделай это очень кратко (всего 1-3 предложения).",
            medium: "Предоставь умеренное количество деталей (1 абзац на каждого главного персонажа).",
            detailed: "Предоставь очень подробную сводку, охватывающую все нюансы отношений (2-3 предложения на персонажа)."
        },
        'UK': {
            short: "Зроби це дуже стисло (всього 1-3 речення).",
            medium: "Надай помірну кількість деталей (1 абзац на кожного головного персонажа).",
            detailed: "Надай дуже детальне зведення, що охоплює всі нюанси стосунків (2-3 речення на персонажа)."
        }
    };
    const dict = lengthDict[lang] || lengthDict['EN'];
    const lengthInstruction = dict[settings.resumeLength] || dict['short'];

    const prompt = promptTemplate
        .replace('{{RELATIONS_JSON}}', JSON.stringify(data || relationsData, null, 2))
        .replace('{{LENGTH_INSTRUCTION}}', lengthInstruction);

    if (typeof toastr !== "undefined") toastr.info("Generating resume...", "Relations Tracker");

    try {
        const response = await ConnectionManagerRequestService.sendRequest(
            cp,
            [{ role: "user", content: prompt }],
            undefined,
            { stream: false, extractData: true }
        );
        const summary = extractTextFromResponse(response);

        if (summary) {
            // Try to parse as JSON array, fallback to raw string
            let parsedCards = extractAndParseRelations(summary);
            if (parsedCards === null) parsedCards = summary; // store raw text if not JSON

            extension_settings[extensionName].nlResume = parsedCards;
            saveSettingsDebounced();
            renderResumeCards(parsedCards);
            injectIntoPrompt();
            if (typeof toastr !== "undefined") toastr.success("Resume generated!", "Relations Tracker");
        }
    } catch (err) {
        console.error("[RT] Generate resume failed:", err);
        if (typeof toastr !== "undefined") toastr.error("Resume generation failed.", "Relations Tracker");
    }
}

function renderResumeCards(cards) {
    const container = document.getElementById('rt-nl-resume-cards');
    if (!container) return;
    if (!cards) {
        container.innerHTML = '<div style="text-align:center;color:var(--grey50);font-size:0.8em;font-style:italic;padding:10px;">No character cards generated yet.</div>';
        return;
    }
    if (typeof cards === 'string') {
        container.innerHTML = `<div style="padding:10px;font-style:italic;color:var(--grey50);font-size:0.85em;">${escapeHtml(cards)}</div>`;
        return;
    }
    if (Array.isArray(cards) && cards.length > 0) {
        container.innerHTML = cards.map(c => `
            <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;margin-bottom:5px;">
                <div style="background:rgba(0,0,0,0.3);padding:5px 10px;font-weight:bold;font-size:0.9em;border-bottom:1px solid rgba(255,255,255,0.1);color:var(--SmartThemeBodyColor);">
                    <i class="fa-solid fa-user" style="margin-right:5px;color:#a29bfe;"></i>${escapeHtml(c.character || 'Unknown')}
                </div>
                <div style="padding:8px 10px;font-size:0.85em;color:var(--SmartThemeBodyColor);line-height:1.4;">${escapeHtml(c.summary || '')}</div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div style="text-align:center;color:var(--grey50);font-size:0.8em;font-style:italic;padding:10px;">AI returned empty cards list.</div>';
    }
}

// =====================
// Custom Bonds
// =====================
function renderCustomBonds() {
    const list = document.getElementById('rt-custom-bonds-list');
    if (!list) return;
    const cbs = getSettings().customBonds || [];
    if (cbs.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:var(--grey50);font-size:0.8em;">No custom bonds yet.</div>';
        return;
    }
    list.innerHTML = cbs.map((cb, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.2);padding:5px;border-radius:4px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:12px;height:12px;border-radius:50%;background:${cb.color}"></div>
                <b>${escapeHtml(cb.code)} ${escapeHtml(cb.name)}</b>
            </div>
            <div class="menu_button fa-solid fa-trash" style="padding:5px;" onclick="window.deleteCustomBond(${idx})" title="Delete"></div>
        </div>
        <div style="font-size:0.8em;color:var(--grey50);padding:0 5px 5px 25px;">${escapeHtml(cb.behavior || '')}</div>
    `).join('');
}

// =====================
// Gallery
// =====================
function renderGallery() {
    const container = document.getElementById('rt-gallery-container');
    if (!container) return;
    let all = [];
    for (const pairKey in milestonesMap) {
        for (const ms of milestonesMap[pairKey]) {
            all.push({ pairKey, ...ms });
        }
    }
    all.sort((a, b) => b.timestamp - a.timestamp);

    if (all.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--grey50);font-size:0.8em;">No milestones recorded yet.</div>';
        return;
    }
    container.innerHTML = all.map(ms => {
        const timeStr = new Date(ms.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<div style="margin-bottom:5px;background:rgba(0,0,0,0.2);padding:5px;border-radius:4px;border-left:3px solid #ffeb3b;">
            <div style="font-size:0.8em;color:var(--grey50);display:flex;justify-content:space-between;">
                <span>${escapeHtml(ms.pairKey)}</span><span>${timeStr}</span>
            </div>
            <div>${ms.icon} ${escapeHtml(ms.event)}</div>
        </div>`;
    }).join('');
}

// =====================
// Init
// =====================
async function initUI() {
    try {
        const htmlResponse = await fetch(`${extensionFolderPath}/index.html`);
        if (!htmlResponse.ok) throw new Error("Failed to load index.html");
        
        // Load Infoblock CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${extensionFolderPath}/infoblock.css`;
        document.head.appendChild(link);

        // Initialize Infoblock HTML
        await initInfoblock(extensionFolderPath);
        const htmlContent = await htmlResponse.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const extSettings = document.getElementById('extensions_settings');
        if (extSettings) extSettings.appendChild(tempDiv);
        else { console.error("[RT] #extensions_settings not found"); return; }

        loadConnectionProfiles();
        applySettingsToUI(); // Load settings INTO ui — not FROM ui

        // Mode buttons
        $(document).on('click', '.rt-mode-btn', function () {
            $('.rt-mode-btn').removeClass('active');
            $(this).addClass('active');
            saveSettings();
        });

        // Settings controls
        $('#rt-smart-scan, #rt-debug').on('change', saveSettings);
        $('#rt-scan-depth').on('input change', saveSettings);
        $('#rt-prompt-lang, #rt-connection-profile, #rt-resume-length').on('change', saveSettings);

        // Action buttons
        document.getElementById('rt-add-btn').addEventListener('click', addRelationship);
        document.getElementById('rt-refresh-btn').addEventListener('click', async () => {
            if (typeof toastr !== 'undefined') toastr.info("Scanning chat...", "Relations Tracker");
            scanChatForRelations();
            await runAIAnalysis(true);
        });
        document.getElementById('rt-export-btn').addEventListener('click', exportRelations);
        document.getElementById('rt-import-btn').addEventListener('click', () => document.getElementById('rt-import-file').click());
        document.getElementById('rt-import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) { importRelations(e.target.files[0]); e.target.value = ''; }
        });

        // Hybrid banner
        document.getElementById('rt-hybrid-apply')?.addEventListener('click', async () => {
            if (pendingChanges) {
                applyChanges(pendingChanges.newRelations, pendingChanges.msgIndex);
                hideHybridBanner();
                await generateResume(relationsData);
            }
        });
        document.getElementById('rt-hybrid-dismiss')?.addEventListener('click', () => {
            hideHybridBanner();
        });

        // Regex rules installer
        document.getElementById('rt-install-regex-btn')?.addEventListener('click', () => {
            if (!extension_settings.regex) extension_settings.regex = [];
            let added = 0;

            if (!extension_settings.regex.find(r => r.scriptName === "RT_EVENT_FORMAT")) {
                extension_settings.regex.push({
                    id: crypto.randomUUID?.() ?? "rt_fmt_" + Date.now(),
                    scriptName: "RT_EVENT_FORMAT",
                    findRegex: "^\\[RT_EVENT\\]\\s*(.*)",
                    replaceString: '<div style="color:#a29bfe;font-style:italic;text-align:center;margin:15px 0;padding:10px;background:rgba(162,155,254,0.1);border-radius:8px;">✧ $1 ✧</div>',
                    placement: [1, 2], disabled: false, markdownOnly: false, promptOnly: false,
                    runOnEdit: true, substituteRegex: false, only_format_display: true, only_format_prompt: false
                });
                added++;
            }
            if (!extension_settings.regex.find(r => r.scriptName === "RT_EVENT_HIDE")) {
                extension_settings.regex.push({
                    id: crypto.randomUUID?.() ?? "rt_hide_" + Date.now(),
                    scriptName: "RT_EVENT_HIDE",
                    findRegex: "^\\[RT_EVENT\\].*\\n?",
                    replaceString: "",
                    placement: [1, 2], disabled: false, markdownOnly: false, promptOnly: false,
                    runOnEdit: true, substituteRegex: false, only_format_display: false, only_format_prompt: true
                });
                added++;
            }

            if (added > 0) {
                saveSettingsDebounced();
                if (typeof toastr !== "undefined") toastr.success("Regex rules installed! Reload the page (F5) to see them.", "Relations Tracker");
            } else {
                if (typeof toastr !== "undefined") toastr.info("Regex rules already installed.", "Relations Tracker");
            }
        });

        // Custom Bonds — Generate
        document.getElementById('rt-cb-generate')?.addEventListener('click', async () => {
            const settings = getSettings();
            const name = document.getElementById('rt-cb-name').value.trim();
            const hint = document.getElementById('rt-cb-behavior').value.trim();
            if (!name) return toastr?.warning("Enter a Name first (e.g. Mentor)");

            const cp = settings.connectionProfile;
            if (!cp) return toastr?.error("Select a Connection Profile first.");

            const hintSection = hint
                ? `The user has provided a hint: "${hint}". Expand on this idea.`
                : "The user has not provided a hint, use your imagination based on the name.";

            const prompt = customBondPrompt
                .replace('{{BOND_NAME}}', name)
                .replace('{{HINT_SECTION}}', hintSection);

            toastr?.info("Generating options via AI...", "Relations Tracker");
            try {
                const response = await ConnectionManagerRequestService.sendRequest(
                    cp, [{ role: "user", content: prompt }], undefined, { stream: false, extractData: true }
                );
                const rawText = extractTextFromResponse(response);

                let options = extractAndParseRelations(rawText);
                if (!options) {
                    // Fallback: split by newlines
                    options = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 5).slice(0, 3);
                }

                const optContainer = document.getElementById('rt-cb-options');
                optContainer.innerHTML = '';
                optContainer.style.display = 'flex';

                if (!options || options.length === 0) return toastr?.error("AI failed to generate valid options.");

                options.forEach((opt, idx) => {
                    const btn = document.createElement('div');
                    btn.className = 'menu_button interactable';
                    btn.style.cssText = 'white-space:normal;text-align:left;padding:6px;font-size:0.85em;line-height:1.2;';
                    btn.innerHTML = `<b>Option ${idx + 1}:</b> ${escapeHtml(String(opt))}`;
                    btn.addEventListener('click', () => {
                        document.getElementById('rt-cb-behavior').value = String(opt);
                        optContainer.style.display = 'none';
                        toastr?.success("Option applied!");
                    });
                    optContainer.appendChild(btn);
                });
            } catch (e) {
                console.error("[RT] Custom bond generation failed:", e);
                toastr?.error("Failed to generate behavior.");
            }
        });

        // Custom Bonds — Add
        document.getElementById('rt-cb-add')?.addEventListener('click', () => {
            const settings = getSettings();
            const code = document.getElementById('rt-cb-code').value.trim();
            const name = document.getElementById('rt-cb-name').value.trim();
            const color = document.getElementById('rt-cb-color').value;
            const behavior = document.getElementById('rt-cb-behavior').value.trim();

            if (!code || !name) return toastr?.warning("Code and Name are required");
            if (!code.startsWith('[')) return toastr?.warning("Code must start with '[' e.g. [M]");
            if (!behavior) return toastr?.warning("Behavior prompt is required.");

            const bonds = settings.customBonds || [];
            bonds.push({ code, name, color, behavior });
            extension_settings[extensionName].customBonds = bonds;
            saveSettings();

            document.getElementById('rt-cb-code').value = '';
            document.getElementById('rt-cb-name').value = '';
            document.getElementById('rt-cb-behavior').value = '';
            updateCustomBonds(bonds);
            renderCustomBonds();
        });

        window.deleteCustomBond = function (idx) {
            const settings = getSettings();
            const bonds = settings.customBonds || [];
            if (bonds[idx] !== undefined) {
                bonds.splice(idx, 1);
                extension_settings[extensionName].customBonds = bonds;
                saveSettings();
                updateCustomBonds(bonds);
                renderCustomBonds();
            }
        };

        // Generate resume button
        document.getElementById('rt-generate-resume-btn')?.addEventListener('click', async () => {
            await generateResume(relationsData);
        });

        // Floating widget
        const widgetIcon = document.querySelector('.rt-float-icon');
        const widgetPanel = document.querySelector('.rt-float-panel');
        if (widgetIcon && widgetPanel) {
            widgetIcon.addEventListener('mouseenter', () => widgetPanel.style.display = 'block');
            document.getElementById('rt-float-widget')?.addEventListener('mouseleave', () => widgetPanel.style.display = 'none');
            if (document.getElementById('rt-float-widget')) document.getElementById('rt-float-widget').style.display = 'flex';
        }

        // Graph
        document.getElementById('rt-graph-btn')?.addEventListener('click', () => {
            const popup = document.getElementById('rt-graph-popup');
            if (!popup) return;
            popup.style.display = 'flex';

            if (typeof $ !== 'undefined' && $.fn.draggable && !$(popup).hasClass('ui-draggable')) {
                $(popup).draggable({ handle: '.rt-graph-header', containment: 'window' });
            }

            if (graphInstance) graphInstance.destroy();
            const canvas = document.getElementById('rt-graph-canvas');

            if (!popup.hasAttribute('data-ro-attached')) {
                new ResizeObserver(() => {
                    if (popup.style.display !== 'none' && graphInstance) {
                        canvas.width = popup.clientWidth;
                        canvas.height = popup.clientHeight - (popup.querySelector('.rt-graph-header')?.clientHeight || 0);
                        graphInstance.width = canvas.width;
                        graphInstance.height = canvas.height;
                        graphInstance.draw?.();
                    }
                }).observe(popup);
                popup.setAttribute('data-ro-attached', 'true');
            }

            canvas.width = popup.clientWidth;
            canvas.height = popup.clientHeight - (popup.querySelector('.rt-graph-header')?.clientHeight || 0);
            graphInstance = new RelationGraph(canvas, relationsData);
            graphInstance.width = canvas.width;
            graphInstance.height = canvas.height;
            graphInstance.init();
        });

        document.getElementById('rt-graph-close')?.addEventListener('click', () => {
            const popup = document.getElementById('rt-graph-popup');
            if (popup) popup.style.display = 'none';
            if (graphInstance) { graphInstance.destroy?.(); graphInstance = null; }
        });

    } catch (error) {
        console.error("[RT] Init failed:", error);
    }
}

// =====================
// Bootstrap
// =====================
jQuery(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.type = 'text/css';
    link.href = `${extensionFolderPath}/style.css`;
    document.head.appendChild(link);

    await initUI();
    renderCustomBonds();
    renderGallery();
    renderResumeCards(getSettings().nlResume);

    // Initial scan — load from settings first, then check for tags in chat
    setTimeout(() => {
        loadRelationsFromSettings();
        scanChatForRelations();
    }, 1000);

    if (eventSource) {
        // GENERATION_ENDED fires after the AI finishes streaming, not during.
        // Fallback to MESSAGE_RECEIVED for older ST versions.
        const doneEvent = (event_types.GENERATION_ENDED !== undefined)
            ? event_types.GENERATION_ENDED
            : event_types.MESSAGE_RECEIVED;

        eventSource.on(doneEvent, async () => {
            // Wait for ST to finalize message in context
            await new Promise(r => setTimeout(r, 600));
            scanChatForRelations();
            await runAIAnalysis();
        });

        eventSource.on(event_types.CHAT_CHANGED, () => {
            loadRelationsFromSettings();
            setTimeout(() => scanChatForRelations(), 300);
        });
    }
});
