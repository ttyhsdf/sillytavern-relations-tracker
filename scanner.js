// Smart Scanner: Compresses chat messages for efficient AI analysis
// Filters out system messages (RT_EVENT, SillyTavern UI noise, etc.)

const SYSTEM_MSG_PATTERNS = [
    /^\[RT_EVENT\]/,
    /^<!--RELATIONS_ARCHIVE:/,
    /^\[System\]/i,
];

function isSystemMessage(msg) {
    if (!msg) return true;
    if (msg.is_system) return true;
    if (msg.is_user === false && msg.name === 'System') return true;
    // Filter out extension injections
    for (const pattern of SYSTEM_MSG_PATTERNS) {
        if (pattern.test((msg.mes || '').trim())) return true;
    }
    return false;
}

export function smartScan(chatMessages, depth) {
    const messages = chatMessages
        .filter(m => !isSystemMessage(m))
        .slice(-depth);

    return messages.map(m => {
        const name = m.is_user ? 'User' : (m.name || 'Character');
        let text = m.mes || '';

        // Strip HTML tags
        text = text.replace(/<[^>]+>/g, '');

        // Strip markdown bold/italic but keep content
        text = text.replace(/\*\*(.+?)\*\*/g, '$1');
        text = text.replace(/\*(.+?)\*/gs, '$1');
        text = text.replace(/_(.+?)_/g, '$1');

        // Strip RELATIONS_ARCHIVE tags
        text = text.replace(/<!--RELATIONS_ARCHIVE:.*?-->/s, '');

        // Collapse whitespace
        text = text.replace(/\s+/g, ' ').trim();

        // Truncate long messages — keep first 400 chars
        if (text.length > 400) {
            text = text.substring(0, 400) + '...';
        }

        return `${name}: ${text}`;
    }).filter(line => line.length > 10).join('\n\n');
}

export function fullScan(chatMessages, depth) {
    return chatMessages
        .filter(m => !isSystemMessage(m))
        .slice(-depth)
        .map(m => {
            const name = m.is_user ? 'User' : (m.name || 'Character');
            let text = (m.mes || '').replace(/<!--RELATIONS_ARCHIVE:.*?-->/s, '').trim();
            return `${name}: ${text}`;
        })
        .filter(line => line.length > 5)
        .join('\n\n');
}
