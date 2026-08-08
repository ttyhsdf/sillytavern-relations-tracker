// Relationship Rules & Constraints

export const BOND_TYPES = {
    '[R]': 'Romantic',
    '[PL]': 'Platonic Love',
    '[P]': 'Platonic',
    '[F]': 'Family',
    '[H]': 'Hostile',
    '[C]': 'Complicated'
};

export const VALID_BONDS = Object.keys(BOND_TYPES);

export function enforceRules(rel, oldRel = null) {
    // 1. Hard caps
    if (rel.bond === '[F]') {
        // Family cannot exceed 70 CP (Close/Warm, but not Devoted romantically)
        rel.cp = Math.min(rel.cp, 70);
    }

    // 2. Transition rules (if we have an old state)
    if (oldRel && oldRel.bond !== rel.bond) {
        
        // Family can never directly become Romantic
        if (oldRel.bond === '[F]' && rel.bond === '[R]') {
            rel.bond = '[F]'; // block transition
        }
        
        // Platonic Love cannot directly become Romantic (needs Complicated or Platonic step)
        if (oldRel.bond === '[PL]' && rel.bond === '[R]') {
            rel.bond = '[C]'; // Force into complicated instead
        }
        
        // Natural transition logic validation based on CP
        if (oldRel.bond === '[P]' && rel.bond === '[R]') {
            if (rel.cp < 40) {
                rel.bond = '[C]'; // Not high enough CP for pure romance yet
            }
        }
        
        if (oldRel.bond === '[H]' && rel.bond === '[R]') {
            if (rel.cp < 20) {
                rel.bond = '[C]'; // Enemies to lovers needs some positive CP first
            }
        }
    }

    // Fallback clamps
    rel.cp = Math.max(-100, Math.min(100, parseInt(rel.cp) || 0));
    
    return rel;
}
