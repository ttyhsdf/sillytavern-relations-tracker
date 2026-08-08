/**
 * @module tiers
 * @description Context-dependent tier names that change based on bond type.
 * Provides universal CP-range → tier mapping and per-bond-type display labels.
 */

/** Internal tier value names used for persistence. */
export const TIER_VALUES = [
    'Frozen',   // 0  (-100 .. -70)
    'Cold',     // 1  ( -69 .. -40)
    'Distant',  // 2  ( -39 .. -10)
    'Neutral',  // 3  (  -9 ..  +9)
    'Warm',     // 4  ( +10 .. +39)
    'Close',    // 5  ( +40 .. +69)
    'Devoted',  // 6  ( +70 .. +100)
];

/** Display labels (with emoji) for each tier, keyed by bond type. */
export const TIER_LABELS = {
    '[R]': ['💔 Heartbroken', '😢 Bitter',     '😕 Awkward',   '😐 Neutral',   '😊 Interested',      '😍 Infatuated',  '💕 Deeply in love'],
    '[P]': ['🧊 Frozen',      '❄ Cold',        '🌫 Distant',   '⚖ Neutral',    '☀ Warm',             '🔥 Close',       '💎 Soulmates'],
    '[PL]': ['💔 Broken bond', '😢 Hurt',       '🌫 Distant',   '⚖ Neutral',    '☀ Warm',             '💛 Deep bond',   '✨ Inseparable'],
    '[F]': ['💔 Disowned',    '😤 Resentful',   '😶 Estranged',  '⚖ Neutral',    '🤗 Caring',          '❤ Loving',       '🏡 Unbreakable'],
    '[H]': ['🩸 Blood feud',  '⚔ Sworn enemies','😠 Hostile',    '😐 Wary',      '🤔 Grudging respect', '🤝 Frenemies',   '🕊 Former enemies'],
    '[C]': ['😰 Tormented',   '😓 Conflicted',  '😕 Uneasy',    '🌀 Undefined', '🤔 Curious',         '😶\u200D🌫 Drawn to', '❓ Obsessed'],
};

/**
 * Maps a CP value (-100 … +100) to a tier index (0–6).
 * @param {number} cp - Connection points value, clamped to [-100, 100].
 * @returns {number} Tier index between 0 and 6.
 */
export function getTierIndex(cp) {
    if (cp <= -70) return 0;
    if (cp <= -40) return 1;
    if (cp <= -10) return 2;
    if (cp <=   9) return 3;
    if (cp <=  39) return 4;
    if (cp <=  69) return 5;
    return 6;
}

/**
 * Returns the internal tier value string for a given CP.
 * @param {number} cp - Connection points value.
 * @returns {string} One of the TIER_VALUES entries (e.g. 'Warm').
 */
export function getTierFromCP(cp) {
    return TIER_VALUES[getTierIndex(cp)];
}

/**
 * Returns the display label (with emoji) for a given CP and bond type.
 * Falls back to the '[P]' (platonic) labels if the bond type is unknown.
 * @param {number} cp   - Connection points value.
 * @param {string} bond - Bond type key, e.g. '[R]', '[P]', '[F]'.
 * @returns {string} The emoji-prefixed tier label.
 */
export function getTierLabel(cp, bond) {
    const labels = TIER_LABELS[bond] || TIER_LABELS['[P]'];
    return labels[getTierIndex(cp)];
}

/**
 * Returns the full array of 7 tier labels for a bond type.
 * Falls back to '[P]' labels if the bond type is unknown.
 * @param {string} bond - Bond type key.
 * @returns {string[]} Array of 7 display labels.
 */
export function getTierLabelsForBond(bond) {
    return TIER_LABELS[bond] || TIER_LABELS['[P]'];
}
