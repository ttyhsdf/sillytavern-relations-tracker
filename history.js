// History Log: Tracks all relation changes over time

const MAX_HISTORY = 20; // Max entries per relationship pair

export function createHistoryEntry(oldRel, newRel, messageIndex) {
    const changes = [];
    
    if (oldRel.cp !== newRel.cp) {
        const diff = newRel.cp - oldRel.cp;
        changes.push(`CP: ${oldRel.cp} → ${newRel.cp} (${diff > 0 ? '+' : ''}${diff})`);
    }
    if (oldRel.tier !== newRel.tier) {
        changes.push(`Tier: ${oldRel.tier} → ${newRel.tier}`);
    }
    if (oldRel.bond !== newRel.bond) {
        changes.push(`Bond: ${oldRel.bond} → ${newRel.bond}`);
    }
    if (oldRel.label !== newRel.label) {
        changes.push(`"${newRel.label}"`);
    }
    
    if (changes.length === 0) return null;
    
    return {
        timestamp: Date.now(),
        msgIndex: messageIndex || '?',
        changes: changes.join('  ·  '),
        cpBefore: oldRel.cp,
        cpAfter: newRel.cp
    };
}

export function addHistoryEntry(historyMap, pairKey, entry) {
    if (!entry) return;
    if (!historyMap[pairKey]) historyMap[pairKey] = [];
    historyMap[pairKey].unshift(entry); // newest first
    if (historyMap[pairKey].length > MAX_HISTORY) {
        historyMap[pairKey] = historyMap[pairKey].slice(0, MAX_HISTORY);
    }
}

export function getPairKey(source, target) {
    return `${source}→${target}`;
}

export function formatTimestamp(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function renderHistoryHTML(entries) {
    if (!entries || entries.length === 0) {
        return '<div class="rt-history-empty">No changes recorded yet.</div>';
    }
    
    return entries.map(e => {
        const time = formatTimestamp(e.timestamp);
        const cpDiff = e.cpAfter - e.cpBefore;
        const cpClass = cpDiff > 0 ? 'rt-hist-positive' : cpDiff < 0 ? 'rt-hist-negative' : 'rt-hist-neutral';
        
        return `<div class="rt-history-entry ${cpClass}">
            <span class="rt-hist-time">${time}</span>
            <span class="rt-hist-msg">#${e.msgIndex}</span>
            <span class="rt-hist-changes">${e.changes}</span>
        </div>`;
    }).join('');
}
