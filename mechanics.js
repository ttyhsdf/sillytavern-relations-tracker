import { getDecayRate } from "./decay.js";

/**
 * @file mechanics.js
 * @description Advanced relationship game mechanics (Decay, Trust/Lust normalization).
 */

/**
 * Apply relationship decay to pairs that haven't interacted recently.
 * @param {Array} relationsData - The array of all relationships
 * @param {number} currentMsgIndex - The index of the latest chat message
 * @param {Object} settings - Extension settings
 */
export function applyRelationshipDecay(relationsData, currentMsgIndex, settings) {
    if (!settings.enableDecay) return;

    for (const rel of relationsData) {
        if (typeof rel.lastInteractionMsg !== 'number') continue;
        if (rel.locked) continue; // Don't decay locked relationships

        const rate = getDecayRate(rel.bond);
        if (rate.threshold === null) continue; // Family / Platonic Love never decay

        // Initialize lastDecayMsg if it doesn't exist
        if (rel.lastDecayMsg === undefined) {
            rel.lastDecayMsg = rel.lastInteractionMsg;
        }

        // If the interaction is more recent than the last decay, reset decay timer
        if (rel.lastInteractionMsg > rel.lastDecayMsg) {
            rel.lastDecayMsg = rel.lastInteractionMsg;
        }

        const msgsSinceDecay = currentMsgIndex - rel.lastDecayMsg;

        if (msgsSinceDecay >= rate.threshold) {
            const decayTicks = Math.floor(msgsSinceDecay / rate.threshold);
            const totalAmount = rate.amount * decayTicks;

            // Move CP towards 0
            if (rel.cp > 0) {
                rel.cp = Math.max(0, rel.cp - totalAmount);
            } else if (rel.cp < 0) {
                rel.cp = Math.min(0, rel.cp + totalAmount);
            }

            // Also decay Trust and Lust if they exist
            if (rel.trust !== undefined && rel.trust > 0) {
                rel.trust = Math.max(0, rel.trust - totalAmount);
            }
            if (rel.lust !== undefined && rel.lust > 0) {
                rel.lust = Math.max(0, rel.lust - totalAmount);
            }

            rel.lastDecayMsg += decayTicks * rate.threshold;
        }
    }
}

/**
 * Normalize relationship stats to ensure they stay within bounds.
 * @param {Object} rel - The relationship object returned by AI
 */
export function normalizeStats(rel) {
    // Clamp CP; default to 0 if missing/non-numeric
    if (typeof rel.cp === 'number') {
        rel.cp = Math.max(-100, Math.min(100, rel.cp));
    } else {
        rel.cp = 0;
    }

    // Clamp Trust — leave undefined if missing so callers can preserve old values
    if (typeof rel.trust === 'number') {
        rel.trust = Math.max(-100, Math.min(100, rel.trust));
    }

    // Clamp Lust — leave undefined if missing so callers can preserve old values
    if (typeof rel.lust === 'number') {
        rel.lust = Math.max(-100, Math.min(100, rel.lust));
    }

    // Status formatting
    if (rel.status && typeof rel.status === 'string') {
        rel.status = rel.status.trim().substring(0, 15); // Max 15 chars
        if (rel.status.toLowerCase() === "none" || rel.status.toLowerCase() === "null") {
            rel.status = "";
        }
    } else {
        rel.status = "";
    }
}
