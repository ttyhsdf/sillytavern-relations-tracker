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

    const decayInterval = 15; // Messages required for decay
    const decayAmount = 3;    // CP to lose per interval

    for (const rel of relationsData) {
        if (!rel.lastInteractionMsg) continue;
        if (rel.locked) continue; // Don't decay locked relationships

        // Initialize lastDecayMsg if it doesn't exist
        if (rel.lastDecayMsg === undefined) {
            rel.lastDecayMsg = rel.lastInteractionMsg;
        }

        // If the interaction is more recent than the last decay, reset decay timer
        if (rel.lastInteractionMsg > rel.lastDecayMsg) {
            rel.lastDecayMsg = rel.lastInteractionMsg;
        }

        const msgsSinceDecay = currentMsgIndex - rel.lastDecayMsg;

        if (msgsSinceDecay >= decayInterval) {
            const decayTicks = Math.floor(msgsSinceDecay / decayInterval);
            
            // Move CP towards 0
            if (rel.cp > 0) {
                rel.cp = Math.max(0, rel.cp - (decayAmount * decayTicks));
            } else if (rel.cp < 0) {
                rel.cp = Math.min(0, rel.cp + (decayAmount * decayTicks));
            }

            // Also decay Trust and Lust if they exist
            if (rel.trust !== undefined && rel.trust > 0) {
                rel.trust = Math.max(0, rel.trust - (decayAmount * decayTicks));
            }
            if (rel.lust !== undefined && rel.lust > 0) {
                rel.lust = Math.max(0, rel.lust - (decayAmount * decayTicks));
            }

            rel.lastDecayMsg += decayTicks * decayInterval;
        }
    }
}

/**
 * Normalize relationship stats to ensure they stay within bounds.
 * @param {Object} rel - The relationship object returned by AI
 */
export function normalizeStats(rel) {
    // Clamp CP
    if (typeof rel.cp === 'number') {
        rel.cp = Math.max(-100, Math.min(100, rel.cp));
    }

    // Clamp Trust
    if (typeof rel.trust === 'number') {
        rel.trust = Math.max(-100, Math.min(100, rel.trust));
    } else {
        rel.trust = 0; // Default if missing
    }

    // Clamp Lust
    if (typeof rel.lust === 'number') {
        rel.lust = Math.max(-100, Math.min(100, rel.lust));
    } else {
        rel.lust = 0; // Default if missing
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
