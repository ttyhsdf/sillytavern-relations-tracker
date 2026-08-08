/**
 * @file rules.js
 * @description Bond type rules, constraints, and transition logic for the Relations Tracker extension.
 */

/** All recognized bond types with display metadata. */
export const ALL_BONDS = [
    { code: '[R]',  name: 'Romantic',       emoji: '💋' },
    { code: '[P]',  name: 'Platonic',       emoji: '🤝' },
    { code: '[PL]', name: 'Platonic Love',  emoji: '💛' },
    { code: '[F]',  name: 'Family',         emoji: '🏠' },
    { code: '[H]',  name: 'Hostile',        emoji: '⚔' },
    { code: '[C]',  name: 'Complicated',    emoji: '🌀' },
];

/**
 * Rules governing each bond type.
 *
 * - cpCap:                 Maximum CP value (null = uncapped).
 * - blockedTransitions:    Bond types this can NEVER transition to.
 * - allowedTransitions:    Bond types this CAN transition to (when conditions are met).
 * - transitionConditions:  Map of target bond → condition function `(cp) => boolean`.
 *                          `true` means the transition is always conditionally valid.
 */
export const BOND_RULES = {
    '[F]': {
        cpCap: 70,
        blockedTransitions: ['[R]'],
        allowedTransitions: ['[H]', '[C]'],
        transitionConditions: {
            '[H]': (cp) => cp < -30,
            '[C]': () => true,
        },
    },

    '[P]': {
        cpCap: null,
        blockedTransitions: [],
        allowedTransitions: ['[R]', '[PL]', '[H]', '[C]'],
        transitionConditions: {
            '[R]':  (cp) => cp > 60,
            '[PL]': (cp) => cp > 50,
            '[H]':  (cp) => cp < -30,
            '[C]':  () => true,
        },
    },

    '[PL]': {
        cpCap: null,
        blockedTransitions: ['[R]'],
        allowedTransitions: ['[P]', '[C]'],
        transitionConditions: {
            '[C]': () => true,
            '[P]': (cp) => cp < 30,
        },
    },

    '[R]': {
        cpCap: null,
        blockedTransitions: [],
        allowedTransitions: ['[P]', '[H]', '[C]'],
        transitionConditions: {
            '[P]': (cp) => cp < 30,
            '[H]': (cp) => cp < -20,
            '[C]': () => true,
        },
    },

    '[H]': {
        cpCap: null,
        blockedTransitions: [],
        allowedTransitions: ['[P]', '[R]', '[C]'],
        transitionConditions: {
            '[P]': (cp) => cp > 0,
            '[R]': (cp) => cp > 20,
            '[C]': () => true,
        },
    },

    '[C]': {
        cpCap: null,
        blockedTransitions: [],
        allowedTransitions: ['[R]', '[P]', '[PL]', '[F]', '[H]'],
        transitionConditions: {
            '[R]':  () => true,
            '[P]':  () => true,
            '[PL]': () => true,
            '[F]':  () => true,
            '[H]':  () => true,
        },
    },
};

/**
 * Retrieves the rule object for a given bond type.
 * @param {string} bond - Bond type code, e.g. '[R]'.
 * @returns {object|undefined} The rule entry, or undefined if the bond is unknown.
 */
export function getRule(bond) {
    return BOND_RULES[bond];
}

/**
 * Checks whether a transition between two bond types is allowed and
 * whether the current CP satisfies the transition condition.
 * @param {string} fromBond - Current bond type code.
 * @param {string} toBond   - Target bond type code.
 * @param {number} cp       - Current connection points value.
 * @returns {boolean} True if the transition is permitted and conditions are met.
 */
export function isTransitionAllowed(fromBond, toBond, cp) {
    const rule = BOND_RULES[fromBond];
    if (!rule) return false;

    // Explicitly blocked transitions are never allowed
    if (rule.blockedTransitions.includes(toBond)) return false;

    // Must be in the allowed list
    if (!rule.allowedTransitions.includes(toBond)) return false;

    // Evaluate the CP-based condition (default to false if missing)
    const condition = rule.transitionConditions[toBond];
    if (!condition) return false;

    return typeof condition === 'function' ? condition(cp) : !!condition;
}

/**
 * Clamps a CP value to the bond type's maximum cap.
 * If the bond has no cap (cpCap is null), the value is returned as-is.
 * @param {string} bond - Bond type code.
 * @param {number} cp   - Raw connection points value.
 * @returns {number} The clamped CP value.
 */
export function clampCP(bond, cp) {
    const rule = BOND_RULES[bond];
    if (!rule || rule.cpCap === null) return cp;
    return Math.min(cp, rule.cpCap);
}
