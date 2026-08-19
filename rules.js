/**
 * @file rules.js
 * @description Bond type rules, constraints, and transition logic for the Relations Tracker extension.
 */

/** Base recognized bond types with display metadata. */
const BASE_BONDS = [
    { code: '[R]',  name: 'Romantic',       emoji: '💋', color: '#ff6b81' },
    { code: '[P]',  name: 'Platonic',       emoji: '🤝', color: '#7bed9f' },
    { code: '[PL]', name: 'Platonic Love',  emoji: '💛', color: '#ffd32a' },
    { code: '[F]',  name: 'Family',         emoji: '🏠', color: '#70a1ff' },
    { code: '[H]',  name: 'Hostile',        emoji: '⚔', color: '#ff4757' },
    { code: '[C]',  name: 'Complicated',    emoji: '🌀', color: '#a29bfe' },
];

/** Base transition rules, keyed by bond code. */
const BASE_RULES = {
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

function cloneRules(rules) {
    const out = {};
    for (const key of Object.keys(rules)) {
        const r = rules[key];
        out[key] = {
            cpCap: r.cpCap,
            blockedTransitions: [...r.blockedTransitions],
            allowedTransitions: [...r.allowedTransitions],
            transitionConditions: { ...r.transitionConditions },
        };
    }
    return out;
}

/** All recognized bond types with display metadata (base + custom). */
export let ALL_BONDS = BASE_BONDS.map(b => ({ ...b }));

export let VALID_BONDS = ALL_BONDS.map(b => b.code);

export const BOND_RULES = cloneRules(BASE_RULES);

export function updateCustomBonds(customBondsArray) {
    // Fully reset bonds and rules, then rebuild from base + customs.
    ALL_BONDS = BASE_BONDS.map(b => ({ ...b }));

    for (const key of Object.keys(BOND_RULES)) {
        delete BOND_RULES[key];
    }
    Object.assign(BOND_RULES, cloneRules(BASE_RULES));

    const customs = Array.isArray(customBondsArray) ? customBondsArray : [];

    for (const cb of customs) {
        const code = String(cb.code || '').trim().toUpperCase();
        ALL_BONDS.push({
            code: code,
            name: cb.name,
            emoji: cb.emoji || '✨',
            color: cb.color || '#ffffff',
            behavior: cb.behavior || '',
            isCustom: true
        });

        // Add loose rule for custom bonds (can transition anywhere)
        BOND_RULES[code] = {
            cpCap: null,
            blockedTransitions: [],
            allowedTransitions: ['[R]', '[P]', '[PL]', '[F]', '[H]', '[C]'],
            transitionConditions: {
                '[R]': () => true, '[P]': () => true, '[PL]': () => true,
                '[F]': () => true, '[H]': () => true, '[C]': () => true
            }
        };
    }

    // Make transitions symmetric: every rule may transition to/from every custom bond.
    const customCodes = customs.map(cb => String(cb.code || '').trim().toUpperCase());
    for (const ruleKey of Object.keys(BOND_RULES)) {
        const rule = BOND_RULES[ruleKey];
        for (const code of customCodes) {
            if (!rule.allowedTransitions.includes(code)) {
                rule.allowedTransitions.push(code);
                rule.transitionConditions[code] = () => true;
            }
        }
    }

    VALID_BONDS = ALL_BONDS.map(b => b.code);
}

export function getRule(bond) {
    return BOND_RULES[bond];
}

export function isTransitionAllowed(fromBond, toBond, cp) {
    const rule = BOND_RULES[fromBond];
    if (!rule) return true; // Custom bonds without explicit block

    if (rule.blockedTransitions.includes(toBond)) return false;

    if (!rule.allowedTransitions.includes(toBond)) return false;

    const condition = rule.transitionConditions[toBond];
    if (!condition) return true;

    return typeof condition === 'function' ? condition(cp) : !!condition;
}

export function clampCP(bond, cp) {
    const rule = BOND_RULES[bond];
    if (!rule || rule.cpCap === null || rule.cpCap === undefined) return cp;
    return Math.min(cp, rule.cpCap);
}
