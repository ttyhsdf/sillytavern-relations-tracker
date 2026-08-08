/**
 * @file rules.js
 * @description Bond type rules, constraints, and transition logic for the Relations Tracker extension.
 */

/** All recognized bond types with display metadata. */
export let ALL_BONDS = [
    { code: '[R]',  name: 'Romantic',       emoji: '💋', color: '#ff6b81' },
    { code: '[P]',  name: 'Platonic',       emoji: '🤝', color: '#7bed9f' },
    { code: '[PL]', name: 'Platonic Love',  emoji: '💛', color: '#ffd32a' },
    { code: '[F]',  name: 'Family',         emoji: '🏠', color: '#70a1ff' },
    { code: '[H]',  name: 'Hostile',        emoji: '⚔', color: '#ff4757' },
    { code: '[C]',  name: 'Complicated',    emoji: '🌀', color: '#a29bfe' },
];

export let VALID_BONDS = ALL_BONDS.map(b => b.code);

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

export function updateCustomBonds(customBondsArray) {
    // Reset to base
    ALL_BONDS = [
        { code: '[R]',  name: 'Romantic',       emoji: '💋', color: '#ff6b81' },
        { code: '[P]',  name: 'Platonic',       emoji: '🤝', color: '#7bed9f' },
        { code: '[PL]', name: 'Platonic Love',  emoji: '💛', color: '#ffd32a' },
        { code: '[F]',  name: 'Family',         emoji: '🏠', color: '#70a1ff' },
        { code: '[H]',  name: 'Hostile',        emoji: '⚔', color: '#ff4757' },
        { code: '[C]',  name: 'Complicated',    emoji: '🌀', color: '#a29bfe' },
    ];
    
    if (Array.isArray(customBondsArray)) {
        for (const cb of customBondsArray) {
            ALL_BONDS.push({
                code: cb.code,
                name: cb.name,
                emoji: cb.emoji || '✨',
                color: cb.color || '#ffffff',
                behavior: cb.behavior || '',
                isCustom: true
            });
            
            // Add loose rule for custom bonds (can transition anywhere)
            BOND_RULES[cb.code] = {
                cpCap: null,
                blockedTransitions: [],
                allowedTransitions: ['[R]', '[P]', '[PL]', '[F]', '[H]', '[C]'], // Plus other customs implicitly handled below
                transitionConditions: {
                    '[R]': () => true, '[P]': () => true, '[PL]': () => true, 
                    '[F]': () => true, '[H]': () => true, '[C]': () => true
                }
            };
        }
    }
    
    // Add custom bonds to allowed transitions of base bonds so they can transition back and forth
    const customCodes = (customBondsArray || []).map(cb => cb.code);
    for (const ruleKey in BOND_RULES) {
        if (!BOND_RULES[ruleKey].isCustomRuleUpdated) {
             const rule = BOND_RULES[ruleKey];
             for (const code of customCodes) {
                 if (!rule.allowedTransitions.includes(code)) {
                     rule.allowedTransitions.push(code);
                     rule.transitionConditions[code] = () => true;
                 }
             }
             rule.isCustomRuleUpdated = true;
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
    
    // Custom to Custom is always allowed
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
