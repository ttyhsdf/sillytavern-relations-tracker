import { extension_settings, getContext } from "../../../extensions.js";
import { eventSource, event_types, generateRaw, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "sillytavern-relations-tracker";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let relationsData = [];
let isGenerating = false;

// Default Settings
const defaultSettings = {
    autoAiMode: false,
    scanDepth: 5,
    promptLang: 'EN',
    connectionProfile: '',
    debug: false
};

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const settings = Object.assign({}, defaultSettings, extension_settings[extensionName]);
    
    $('#rt-auto-ai').prop('checked', settings.autoAiMode);
    $('#rt-scan-depth').val(settings.scanDepth);
    $('#rt-prompt-lang').val(settings.promptLang);
    $('#rt-connection-profile').val(settings.connectionProfile);
    $('#rt-debug').prop('checked', settings.debug);
}

function saveSettings() {
    extension_settings[extensionName] = {
        autoAiMode: $('#rt-auto-ai').prop('checked'),
        scanDepth: parseInt($('#rt-scan-depth').val(), 10) || 5,
        promptLang: $('#rt-prompt-lang').val(),
        connectionProfile: $('#rt-connection-profile').val(),
        debug: $('#rt-debug').prop('checked')
    };
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
            return;
        }
    }
}

function injectIntoPrompt() {
    const tag = buildRelationsTag();
    if (!tag) return;
    
    const context = getContext();
    if (typeof context.extensionPrompt !== 'undefined') {
        context.extensionPrompt["relationsTracker"] = tag;
    }
}

async function handleAutoAI() {
    const settings = extension_settings[extensionName];
    if (!settings?.autoAiMode) return;
    if (isGenerating) return;
    
    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) return;
    if (relationsData.length === 0) return; // Only update existing relations
    
    const depth = settings.scanDepth;
    const recentMessages = context.chat.slice(-depth).map(m => `${m.is_user ? 'User' : m.name}: ${m.mes}`).join('\n\n');
    
    let promptInstruction = "";
    if (settings.promptLang === 'RU') {
        promptInstruction = `Текущие отношения (в формате JSON):
${JSON.stringify(relationsData, null, 2)}

Основываясь на последних событиях в чате, реши, должны ли измениться очки отношений (cp), уровень (tier) или тип связи (bond).
Условия изменения CP: +1 до +5 за позитивные взаимодействия, -1 до -5 за конфликты. Если ничего не произошло, CP не меняется.
Верни ТОЛЬКО валидный JSON массив с обновленными отношениями в таком же формате. Без лишнего текста.`;
    } else if (settings.promptLang === 'UK') {
        promptInstruction = `Поточні відносини (у форматі JSON):
${JSON.stringify(relationsData, null, 2)}

Грунтуючись на останніх подіях у чаті, виріши, чи повинні змінитися бали відносин (cp), рівень (tier) або тип зв'язку (bond).
Умови зміни CP: +1 до +5 за позитивні взаємодії, -1 до -5 за конфлікти. Якщо нічого не відбулося, CP не змінюється.
Поверни ТІЛЬКИ валідний JSON масив з оновленими відносинами у такому ж форматі. Без зайвого тексту.`;
    } else {
        // EN fallback
        promptInstruction = `Current relations state (JSON array):
${JSON.stringify(relationsData, null, 2)}

Based on the recent chat events, decide if Charm Points (cp), tier, or bond should change.
CP changes: +1 to +5 for positive interactions, -1 to -5 for conflicts. If nothing significant happened, do not change CP.
Return ONLY a valid JSON array of the updated relations in the exact same format. Do not output any markdown formatting or extra text.`;
    }

    const systemPrompt = `You are a background relation tracking AI. Read the recent chat history and update the relationship state.
${promptInstruction}`;

    try {
        isGenerating = true;
        debugLog("Sending Auto AI request. Depth:", depth);
        
        // Wait briefly so ST finishes its main operations
        await new Promise(r => setTimeout(r, 2000));

        let result = "";
        
        if (settings.connectionProfile && context.ConnectionManagerRequestService) {
            // Using Connection Profile
            debugLog("Using Connection Profile:", settings.connectionProfile);
            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: recentMessages }
            ];
            
            const generator = await context.ConnectionManagerRequestService.sendRequest(
                settings.connectionProfile,
                messages,
                undefined,
                { stream: false }
            );
            
            if (generator) {
                // If it's an async generator, consume it
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
            // Fallback to Main API (generateRaw)
            debugLog("Using Main API via generateRaw");
            result = await generateRaw({
                prompt: recentMessages,
                systemPrompt: systemPrompt,
                quietToLoud: true
            });
        }

        debugLog("AI Raw Response:", result);
        
        // Extract JSON using regex if AI wrapped it in markdown
        const jsonMatch = result.match(/\[\s*\{.*?\}\s*\]/s);
        let jsonStr = jsonMatch ? jsonMatch[0] : result;
        
        const newRelations = JSON.parse(jsonStr);
        
        if (Array.isArray(newRelations)) {
            // Check for actual changes to trigger a toast
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
            
            if (changed && typeof toastr !== "undefined") {
                toastr.success(`AI updated relations: ${changeSummary.join(', ')}`, "Relations Tracker");
            }
        }
    } catch (err) {
        console.error("[Relations Tracker] Auto AI parsing failed:", err);
    } finally {
        isGenerating = false;
    }
}

function renderCards() {
    const container = document.getElementById('rt-cards-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (relationsData.length === 0) {
        container.innerHTML = '<div class="rt-empty-state">No relationship data found. Click "Add Relationship" to start.</div>';
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
        
        card.querySelector('.rt-cp-slider').addEventListener('input', (e) => {
            const val = e.target.value;
            card.querySelector('.rt-cp-value').textContent = val;
            relationsData[index].cp = parseInt(val, 10);
            injectIntoPrompt();
        });
        
        card.querySelector('.rt-bond-type').addEventListener('change', (e) => {
            relationsData[index].bond = e.target.value;
            injectIntoPrompt();
        });
        
        card.querySelector('.rt-tier').addEventListener('input', (e) => {
            relationsData[index].tier = e.target.value;
            injectIntoPrompt();
        });
        
        card.querySelector('.rt-label').addEventListener('input', (e) => {
            relationsData[index].label = e.target.value;
            injectIntoPrompt();
        });
        
        card.querySelector('.rt-source').addEventListener('blur', (e) => {
            relationsData[index].source = e.target.textContent.trim();
            injectIntoPrompt();
        });
        
        card.querySelector('.rt-target').addEventListener('blur', (e) => {
            relationsData[index].target = e.target.textContent.trim();
            injectIntoPrompt();
        });
        
        card.querySelector('.rt-delete-btn').addEventListener('click', () => {
            relationsData.splice(index, 1);
            renderCards();
            injectIntoPrompt();
        });
        
        container.appendChild(card);
    });
}

function addRelationship() {
    relationsData.push({
        source: "Char",
        target: "User",
        cp: 0,
        tier: "Neutral",
        bond: "[P]",
        label: "Just met"
    });
    renderCards();
    injectIntoPrompt();
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
            renderCards();
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
            // Give main ST logic a chance to write its own tags if needed
            scanChatForRelations();
            await handleAutoAI();
        });
        eventSource.on(event_types.CHAT_CHANGED, () => scanChatForRelations());
    }
});
