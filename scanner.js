// Smart Scanner: Compresses chat messages for efficient AI analysis

export function smartScan(chatMessages, depth) {
    const messages = chatMessages.slice(-depth);
    
    return messages.map(m => {
        const name = m.is_user ? 'User' : m.name;
        let text = m.mes || '';
        
        // Strip HTML tags
        text = text.replace(/<[^>]+>/g, '');
        
        // Strip markdown formatting but keep content
        text = text.replace(/\*\*(.+?)\*\*/g, '$1');
        text = text.replace(/\*(.+?)\*/g, '$1');
        text = text.replace(/_(.+?)_/g, '$1');
        
        // Collapse multiple whitespace/newlines
        text = text.replace(/\s+/g, ' ').trim();
        
        // Truncate long messages: keep first 300 chars (dialogue + key actions)
        if (text.length > 300) {
            text = text.substring(0, 300) + '...';
        }
        
        return `${name}: ${text}`;
    }).join('\n\n');
}

export function fullScan(chatMessages, depth) {
    return chatMessages.slice(-depth).map(m => {
        const name = m.is_user ? 'User' : m.name;
        return `${name}: ${m.mes || ''}`;
    }).join('\n\n');
}
