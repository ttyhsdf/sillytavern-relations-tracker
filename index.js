import { extension_settings, getContext } from "../../../extensions.js";
import { eventSource, event_types, generateRaw, saveSettingsDebounced, setExtensionPrompt } from "../../../../script.js";
import { systemPrompts, VALID_TIERS, VALID_BONDS } from "./prompts.js";

const extensionName = "sillytavern-relations-tracker";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let relationsData = [];
let isGenerating = false;

const BOND_LABELS = {
    '[R]': 'Romantic',
    '[P]': 'Platonic',
    '[F]': 'Family',
    '[H]': 'Hostile'
};

// Default Settings
const defaultSettings = {
    autoAiMode: false,
    scanDepth: 5,
    promptLang: 'EN',
    connectionProfile: '',
    debug: false,
    relations: {} // Keyed by chatId
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

function loadSettings() {
    const settings = getSettings();
    
    $('#rt-auto-ai').prop('checked', settings.autoAiMode);
    $('#rt-scan-depth').val(settings.scanDepth);
    $('#rt-prompt-lang').val(settings.promptLang);
    $('#rt-connection-profile').val(settings.connectionProfile);
    $('#rt-debug').prop('checked', settings.debug);
    
    // Load saved relations for current chat
    loadRelationsFromSettings();
}

function loadRelationsFromSettings() {
    const settings = getSettings();
    const chatKey = getChatKey();
    if (chatKey && settings.relations && settings.relations[chatKey]) {
        relationsData = JSON.parse(JSON.stringify(settings.relations[chatKey]));
    } else {
        relationsData = [];
    }
    renderCards();
}

function saveSettings() {
    const current = getSettings();
    
    extension_settings[extensionName] = {
        autoAiMode: $('#rt-auto-ai').prop('checked'),
        scanDepth: parseInt($('#rt-scan-depth').val(), 10) || 5,
        promptLang: $('#rt-prompt-lang').val(),
        connectionProfile: $('#rt-connection-profile').val(),
        debug: $('#rt-debug').prop('checked'),
        relations: current.relations || {}
    };
    saveSettingsDebounced();
}

function saveRelations() {
    const chatKey = getChatKey();
    if (!chatKey) return;
    
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = Object.assign({}, defaultSettings);
    }
    if (!extension_settings[extensionName].relations) {
        extension_settings[extensionName].relations = {};
    }
    
    extension_settings[extensionName].relations[chatKey] = JSON.parse(JSON.stringify(relationsData));
    saveSettingsDebounced();
}

function loadConnectionProfiles() {
    const context = getContext();
    const select = $('#rt-connection-profile');
    const currentValue = select.val();
    
    select.empty();
    select.append('<option value="">-- Use Main API --</option>');
    
    if (context?.extensionSettings?.connectionManager?.profiles) {
        const profiles = context.extensionSettings.connectionManager.profiles;
        profiles.forEach(p => {
            select.append(`<option value="${p.id}">${p.name}</option>`);
        });
    }
    
    if (currentValue) {
        select.val(currentValue);
    }
}

function debugLog(...args) {
    if (extension_settings[extensionName]?.debug) {
        console.log("[Relations Tracker]", ...args);
    }
}

// Parse RELATIONS_ARCHIVE tag
function parseRelationsTag(text) {
    const regex = /<!--RELATIONS_ARCHIVE:\s*(.+?)\s*-->/s;
    const match = text.match(regex);
    if (!match) return null;
    
    const content = match[1];
    const relations = content.split('/').map(r => r.trim()).filter(r => r);
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
            source,
            target,
            cp: parseInt(fields[0]) || 0,
            tier: fields[1] || "",
            bond: fields[2] || "[R]",
            label: fields[3] || ""
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
    if (!context || !context.chat || context.chat.length === 0) return;
    
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
    
    // Use ST's official API for reliable injection
    try {
        setExtensionPrompt(extensionName, tag, 1, 0);
    } catch {
        // Fallback for older ST versions
        const context = getContext();
        if (context?.extensionPrompt) {
            context.extensionPrompt["relationsTracker"] = tag;
        }
    }
}

async function handleAutoAI() {
    const settings = extension_settings[extensionName];
    if (!settings?.autoAiMode) return;
    if (isGenerating) return;
    
    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) return;
    if (relationsData.length === 0) return;
    
    const depth = settings.scanDepth;
    const recentMessages = context.chat.slice(-depth).map(m => `${m.is_user ? 'User' : m.name}: ${m.mes}`).join('\n\n');
    
    const relationsJson = JSON.stringify(relationsData, null, 2);
    let promptInstruction = systemPrompts[settings.promptLang] || systemPrompts['EN'];
    promptInstruction = promptInstruction.replace('{{RELATIONS_JSON}}', relationsJson);

    const sysPrompt = `You are a background relation tracking AI. Read the recent chat history and update the relationship state.\n\n${promptInstruction}`;

    try {
        isGenerating = true;
        debugLog("Sending Auto AI request. Depth:", depth);
        
        await new Promise(r => setTimeout(r, 2000));

        let result = "";
        
        if (settings.connectionProfile && context.ConnectionManagerRequestService) {
            debugLog("Using Connection Profile:", settings.connectionProfile);
            const messages = [
                { role: "system", content: sysPrompt },
                { role: "user", content: recentMessages }
            ];
            
            const generator = await context.ConnectionManagerRequestService.sendRequest(
                settings.connectionProfile,
                messages,
                undefined,
                { stream: false }
            );
            
            if (generator) {
                if (typeof generator[Symbol.asyncIterator] === 'function') {
                    for await (const chunk of generator) {
                        result += chunk || "";
                    }
                } else if (typeof generator === 'string') {
                    result = generator;
                } else {
                    result = String(generator);
                }
            }
        } else {
            debugLog("Using Main API via generateRaw");
            result = await generateRaw({
                prompt: recentMessages,
                systemPrompt: sysPrompt,
                quietToLoud: true
            });
        }

        debugLog("AI Raw Response:", result);
        
        const jsonMatch = result.match(/\[\s*\{.*?\}\s*\]/s);
        let jsonStr = jsonMatch ? jsonMatch[0] : result;
        
        const newRelations = JSON.parse(jsonStr);
        
        if (Array.isArray(newRelations)) {
            // Normalize AI output to match valid dropdown values
            for (const rel of newRelations) {
                rel.cp = Math.max(-100, Math.min(100, parseInt(rel.cp) || 0));
                
                // Fix tier: case-insensitive match
                const tierMatch = VALID_TIERS.find(t => t.toLowerCase() === (rel.tier || '').toLowerCase());
                rel.tier = tierMatch || 'Neutral';
                
                // Fix bond: must be exact
                if (!VALID_BONDS.includes(rel.bond)) rel.bond = '[P]';
            }
            
            let changed = false;
            let changeSummary = [];
            
            for (let i = 0; i < newRelations.length; i++) {
                const oldRel = relationsData.find(r => r.source === newRelations[i].source && r.target === newRelations[i].target);
                if (oldRel) {
                    if (oldRel.cp !== newRelations[i].cp) {
                        changed = true;
                        const diff = newRelations[i].cp - oldRel.cp;
                        changeSummary.push(`${oldRel.source} (${diff > 0 ? '+' : ''}${diff} CP)`);
                    }
                }
            }
            
            relationsData = newRelations;
            renderCards();
            injectIntoPrompt();
            saveRelations();
            
            if (changed && typeof toastr !== "undefined") {
                toastr.success(`AI updated relations: ${changeSummary.join(', ')}`, "Relations Tracker");
            }
        }
    } catch (err) {
        console.error("[Relations Tracker] Auto AI parsing failed:", err);
        if (typeof toastr !== "undefined") {
            toastr.warning("Auto AI failed to parse response. Check console (F12) for details.", "Relations Tracker");
        }
    } finally {
        isGenerating = false;
    }
}

function getBondColor(bond) {
    switch(bond) {
        case '[R]': return '#ff6b81';
        case '[F]': return '#70a1ff';
        case '[P]': return '#7bed9f';
        case '[H]': return '#ff4757';
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
        bondLabel.textContent = BOND_LABELS[bond] || bond;
    }
    // Also color the CP value text
    const cpValue = card.querySelector('.rt-cp-value');
    if (cpValue) {
        cpValue.style.color = getBondColor(bond);
    }
}

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
        card.querySelector('.rt-tier').value = rel.tier;
        card.querySelector('.rt-label').value = rel.label;
        
        card.querySelector('.rt-cp-slider').value = rel.cp;
        card.querySelector('.rt-cp-value').textContent = rel.cp;
        
        const sliderElement = card.querySelector('.rt-cp-slider');
        updateSliderStyle(sliderElement, rel.cp, rel.bond);
        updateCardAccent(card, rel.bond);
        
        card.querySelector('.rt-cp-slider').addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            card.querySelector('.rt-cp-value').textContent = val;
            relationsData[index].cp = val;
            updateSliderStyle(e.target, val, relationsData[index].bond);
            injectIntoPrompt();
            saveRelations();
        });
        
        card.querySelector('.rt-bond-type').addEventListener('change', (e) => {
            relationsData[index].bond = e.target.value;
            updateSliderStyle(sliderElement, relationsData[index].cp, e.target.value);
            updateCardAccent(card, e.target.value);
            injectIntoPrompt();
            saveRelations();
        });
        
        card.querySelector('.rt-tier').addEventListener('change', (e) => {
            relationsData[index].tier = e.target.value;
            injectIntoPrompt();
            saveRelations();
        });
        
        card.querySelector('.rt-label').addEventListener('input', (e) => {
            relationsData[index].label = e.target.value;
            injectIntoPrompt();
            saveRelations();
        });
        
        // Label preset dropdown fills the text field
        const labelPresets = card.querySelector('.rt-label-presets');
        if (labelPresets) {
            labelPresets.addEventListener('change', (e) => {
                if (e.target.value) {
                    card.querySelector('.rt-label').value = e.target.value;
                    relationsData[index].label = e.target.value;
                    e.target.selectedIndex = 0; // Reset dropdown back to "Presets..."
                    injectIntoPrompt();
                    saveRelations();
                }
            });
        }
        
        card.querySelector('.rt-source').addEventListener('blur', (e) => {
            relationsData[index].source = e.target.textContent.trim();
            injectIntoPrompt();
            saveRelations();
        });
        
        card.querySelector('.rt-target').addEventListener('blur', (e) => {
            relationsData[index].target = e.target.textContent.trim();
            injectIntoPrompt();
            saveRelations();
        });
        
        card.querySelector('.rt-delete-btn').addEventListener('click', () => {
            relationsData.splice(index, 1);
            renderCards();
            injectIntoPrompt();
            saveRelations();
        });
        
        container.appendChild(card);
    });
}

function addRelationship() {
    const context = getContext();
    
    // Auto-detect character name and user name
    let charName = "Character";
    let userName = "User";
    
    if (context) {
        if (context.name2) {
            charName = context.name2; // Current character name
        }
        if (context.name1) {
            userName = context.name1; // User's display name
        }
    }
    
    relationsData.push({
        source: charName,
        target: userName,
        cp: 0,
        tier: "Neutral",
        bond: "[P]",
        label: "Just met"
    });
    renderCards();
    injectIntoPrompt();
    saveRelations();
}

async function initUI() {
    try {
        const htmlResponse = await fetch(`${extensionFolderPath}/index.html`);
        if (!htmlResponse.ok) throw new Error("Failed to load HTML");
        const htmlContent = await htmlResponse.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        const extSettings = document.getElementById('extensions_settings');
        if (extSettings) {
            extSettings.appendChild(tempDiv);
        } else {
            console.error("[Relations Tracker] Could not find #extensions_settings");
            return;
        }
        
        loadConnectionProfiles();
        loadSettings();

        // Listen for settings changes
        $('#rt-auto-ai, #rt-debug').on('change', saveSettings);
        $('#rt-scan-depth').on('input change', saveSettings);
        $('#rt-prompt-lang, #rt-connection-profile').on('change', saveSettings);
        
        document.getElementById('rt-add-btn').addEventListener('click', addRelationship);
        document.getElementById('rt-refresh-btn').addEventListener('click', () => {
            scanChatForRelations();
        });
        
    } catch (error) {
        console.error("[Relations Tracker] Failed to initialize UI:", error);
    }
}

jQuery(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `${extensionFolderPath}/style.css`;
    document.head.appendChild(link);
    
    await initUI();
    
    setTimeout(() => {
        scanChatForRelations();
    }, 1000);
    
    if (eventSource) {
        eventSource.on(event_types.MESSAGE_RECEIVED, async () => {
            scanChatForRelations();
            await handleAutoAI();
        });
        eventSource.on(event_types.CHAT_CHANGED, () => {
            loadRelationsFromSettings();
            scanChatForRelations();
        });
    }
});
