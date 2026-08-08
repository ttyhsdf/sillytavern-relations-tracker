// Auto-Tier Sync: Maps CP ranges to Contextual Tier values automatically

export const TIER_THRESHOLDS = [
    { min: -100, max: -70, default: 'Frozen' },
    { min: -69,  max: -40, default: 'Cold' },
    { min: -39,  max: -10, default: 'Distant' },
    { min: -9,   max: 9,   default: 'Neutral' },
    { min: 10,   max: 39,  default: 'Warm' },
    { min: 40,   max: 69,  default: 'Close' },
    { min: 70,   max: 100, default: 'Devoted' }
];

export const VALID_TIERS = ['Frozen', 'Cold', 'Distant', 'Neutral', 'Warm', 'Close', 'Devoted'];

export const CONTEXTUAL_TIERS = {
    '[R]': ['💔 Heartbroken', '😢 Bitter', '😕 Awkward', '😐 Neutral', '😊 Interested', '😍 Infatuated', '💕 Deeply in love'],
    '[P]': ['🧊 Frozen', '❄ Cold', '🌫 Distant', '⚖ Neutral', '☀ Warm', '🔥 Close', '💎 Soulmates'],
    '[PL]': ['🧊 Severed', '❄ Broken', '🌫 Drifting', '⚖ Neutral', '☀ Caring', '🔥 Inseparable', '💎 Bound souls'],
    '[F]': ['💔 Disowned', '😤 Resentful', '😶 Estranged', '⚖ Neutral', '🤗 Caring', '❤ Loving', '🏡 Unbreakable'],
    '[H]': ['🩸 Blood feud', '⚔ Sworn enemies', '😠 Hostile', '😐 Wary', '🤔 Grudging respect', '🤝 Frenemies', '✨ Redeemed'],
    '[C]': ['🌪 Chaotic', '⛈ Stormy', '🌧 Tense', '⚖ Uncertain', '🌤 Hopeful', '⛅ Mixed signals', '🔥 Intensely complicated']
};

export function getTierFromCP(cp, bond = '[P]') {
    let index = 3; // Default Neutral
    for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
        const t = TIER_THRESHOLDS[i];
        if (cp >= t.min && cp <= t.max) {
            index = i;
            break;
        }
    }
    
    // Return contextual label based on bond type
    if (CONTEXTUAL_TIERS[bond] && CONTEXTUAL_TIERS[bond][index]) {
        return CONTEXTUAL_TIERS[bond][index];
    }
    
    return TIER_THRESHOLDS[index].default;
}

export function getCPRangeForTierIndex(index) {
    if (index >= 0 && index < TIER_THRESHOLDS.length) {
        return { min: TIER_THRESHOLDS[index].min, max: TIER_THRESHOLDS[index].max };
    }
    return { min: -9, max: 9 };
}
