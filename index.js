import { extension_settings, getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "sillytavern-relations-tracker";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let relationsData = [];

// Parse RELATIONS_ARCHIVE tag
// Format: <!--RELATIONS_ARCHIVE:Name->Target=CP,TIER,BOND,LABEL / Name2->Target2=...-->
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
    
    const parts = relationsData.map(r => {
        return `${r.source}→${r.target}=${r.cp},${r.tier},${r.bond},${r.label}`;
    });
    
    return `<!--RELATIONS_ARCHIVE:${parts.join(' / ')}-->`;
}

function scanChatForRelations() {
    const context = getContext();
    if (!context || !context.chat || context.chat.length === 0) return;
    
    // Scan backwards to find the most recent tag
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
    
    // Inject via extension prompt so the AI sees it as system instruction/memory
    const context = getContext();
    if (typeof context.extensionPrompt !== 'undefined') {
        context.extensionPrompt["relationsTracker"] = tag;
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
        
        // Event listeners for this card
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
        
        // Inject into extensions settings panel
        const extSettings = document.getElementById('extensions_settings');
        if (extSettings) {
            extSettings.appendChild(tempDiv);
        } else {
            console.error("[Relations Tracker] Could not find #extensions_settings");
            return;
        }
        
        // Let SillyTavern's native global event listener handle the .inline-drawer-toggle
        
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
    // Add CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `${extensionFolderPath}/style.css`;
    document.head.appendChild(link);
    
    await initUI();
    
    // Initial scan
    setTimeout(() => {
        scanChatForRelations();
    }, 1000);
    
    // Listen for new messages
    if (eventSource) {
        eventSource.on(event_types.MESSAGE_RECEIVED, () => scanChatForRelations());
        eventSource.on(event_types.CHAT_CHANGED, () => scanChatForRelations());
    }
});
