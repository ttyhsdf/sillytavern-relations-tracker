export const DECAY_RATES = {
    '[F]': { threshold: null, amount: 0 },
    '[PL]': { threshold: null, amount: 0 },
    '[P]': { threshold: 20, amount: 1 },
    '[R]': { threshold: 15, amount: 1 },
    '[H]': { threshold: 25, amount: 1 },
    '[C]': { threshold: 10, amount: 2 }
};

export function getDecayRate(bond) {
    return DECAY_RATES[bond] || { threshold: null, amount: 0 };
}

export function shouldDecay(bond) {
    const rate = getDecayRate(bond);
    return rate.threshold !== null;
}

export function calculateDecay(relation, currentMsgCount) {
    let newCp = relation.cp;
    
    // No decay if lastInteractionMsg is undefined
    if (typeof relation.lastInteractionMsg !== 'number') return newCp;

    const rate = getDecayRate(relation.bond);
    if (rate.threshold === null) return newCp;

    const msgsSinceInteraction = currentMsgCount - relation.lastInteractionMsg;
    
    if (msgsSinceInteraction >= rate.threshold) {
        // Calculate how many times decay should apply
        const decayInstances = Math.floor(msgsSinceInteraction / rate.threshold);
        const totalDecayAmount = decayInstances * rate.amount;

        if (relation.cp > 0) {
            newCp = Math.max(0, relation.cp - totalDecayAmount);
        } else if (relation.cp < 0) {
            newCp = Math.min(0, relation.cp + totalDecayAmount);
        }
    }
    
    return newCp;
}

export function checkInteraction(chatMessages, source, target, startFromMsg = 0) {
    let lastInteraction = startFromMsg;
    const sourceLower = source.toLowerCase();
    const targetLower = target.toLowerCase();

    for (let i = startFromMsg; i < chatMessages.length; i++) {
        const msg = chatMessages[i];
        if (!msg || !msg.mes) continue;
        
        const textLower = msg.mes.toLowerCase();
        const nameLower = (msg.name || '').toLowerCase();
        
        const sourceMentioned = textLower.includes(sourceLower) || nameLower === sourceLower;
        const targetMentioned = textLower.includes(targetLower) || nameLower === targetLower;

        if (sourceMentioned && targetMentioned) {
            lastInteraction = i;
        }
    }
    
    return lastInteraction;
}
