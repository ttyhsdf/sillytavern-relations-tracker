export const MILESTONE_ICONS = ['🏆', '💕', '⚔', '🤝', '💔', '🔥', '❄', '🌟', '😢', '🎉', '👑', '🗡', '🛡', '💀', '🌹'];

import { t } from "./i18n.js";

export function formatTime(timestamp) {
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function createMilestoneFromAI(aiMilestone, msgIndex) {
    let icon = aiMilestone.icon;
    if (!icon || !MILESTONE_ICONS.includes(icon)) {
        icon = '🏆';
    }
    
    return {
        timestamp: Date.now(),
        msgIndex: msgIndex,
        event: aiMilestone.event || "Significant event",
        icon: icon
    };
}

export function addMilestone(milestonesMap, pairKey, milestone) {
    if (!milestone) return;
    if (!milestonesMap[pairKey]) milestonesMap[pairKey] = [];
    milestonesMap[pairKey].unshift(milestone); // newest first
    if (milestonesMap[pairKey].length > 30) {
        milestonesMap[pairKey] = milestonesMap[pairKey].slice(0, 30);
    }
}

export function getMilestones(milestonesMap, pairKey) {
    return milestonesMap[pairKey] || [];
}

export function renderMilestonesHTML(milestones) {
    if (!milestones || milestones.length === 0) {
        return `<div class="rt-milestone-empty">${t('settings.noMilestones')}</div>`;
    }
    
    return milestones.map(m => {
        const time = formatTime(m.timestamp);
        return `<div class="rt-milestone-entry">
            <span class="rt-milestone-icon">${m.icon}</span>
            <span class="rt-milestone-meta">[#${m.msgIndex}] ${time}</span>
            <span class="rt-milestone-text">${m.event}</span>
        </div>`;
    }).join('');
}
