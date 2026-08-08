// Auto-Tier Sync: Maps CP ranges to Tier values automatically

export const TIER_THRESHOLDS = [
    { min: -100, max: -70, tier: 'Frozen' },
    { min: -69,  max: -40, tier: 'Cold' },
    { min: -39,  max: -10, tier: 'Distant' },
    { min: -9,   max: 9,   tier: 'Neutral' },
    { min: 10,   max: 39,  tier: 'Warm' },
    { min: 40,   max: 69,  tier: 'Close' },
    { min: 70,   max: 100, tier: 'Devoted' }
];

export function getTierFromCP(cp) {
    for (const t of TIER_THRESHOLDS) {
        if (cp >= t.min && cp <= t.max) return t.tier;
    }
    return 'Neutral';
}

export function getCPRangeForTier(tier) {
    const t = TIER_THRESHOLDS.find(x => x.tier === tier);
    return t ? { min: t.min, max: t.max } : { min: -9, max: 9 };
}
