export let isInfoblockVisible = false;
let infoblockWrapper = null;
let infoblockBtn = null;
let infoblockPanel = null;
let infoblockClose = null;
let infoblockContent = null;

/**
 * Initializes the infoblock by fetching the HTML template and injecting it into the body.
 */
export async function initInfoblock(basePath) {
    if (document.getElementById('rt-infoblock')) return; // Already initialized

    try {
        const response = await fetch(`${basePath}/infoblock.html`);
        const htmlText = await response.text();
        
        // Inject into body so it's not destroyed by chat rerenders
        document.body.insertAdjacentHTML('beforeend', htmlText);
        
        infoblockWrapper = document.getElementById('rt-infoblock');
        infoblockBtn = document.getElementById('rt-infoblock-btn');
        infoblockPanel = document.getElementById('rt-infoblock-panel');
        infoblockClose = document.getElementById('rt-infoblock-close');
        infoblockContent = document.getElementById('rt-infoblock-content');

        // Event Listeners
        infoblockBtn.addEventListener('click', () => {
            isInfoblockVisible = !isInfoblockVisible;
            infoblockPanel.style.display = isInfoblockVisible ? 'flex' : 'none';
        });

        infoblockClose.addEventListener('click', () => {
            isInfoblockVisible = false;
            infoblockPanel.style.display = 'none';
        });

    } catch (err) {
        console.error('[Relations Tracker] Failed to load infoblock template:', err);
    }
}

/**
 * Escapes HTML characters to prevent XSS.
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Updates the contents of the infoblock panel.
 */
export function updateInfoblock(relationsData, getBondColor, getSettings) {
    if (!infoblockContent) return;

    if (!relationsData || relationsData.length === 0) {
        infoblockContent.innerHTML = '<div style="color:var(--grey50); text-align:center; padding:10px;">No active relationships.</div>';
        return;
    }

    const settings = getSettings();
    let html = '';

    relationsData.forEach(rel => {
        const bondColor = getBondColor(rel.bond);
        
        let advStatsHtml = '';
        if (settings.enableAdvStats) {
            advStatsHtml = `
                <div class="rt-ib-adv">
                    <div class="rt-ib-adv-row"><span style="color:#70a1ff;">Tr</span> <span>${rel.trust || 0}</span></div>
                    <div class="rt-ib-adv-row"><span style="color:#ff6b81;">Lu</span> <span>${rel.lust || 0}</span></div>
                </div>
            `;
        }

        let statusHtml = '';
        if (rel.status) {
            statusHtml = `<span class="rt-ib-badge" style="color:${bondColor}; border:1px solid ${bondColor};">${escapeHtml(rel.status)}</span>`;
        }

        html += `
            <div class="rt-ib-item" style="border-left-color: ${bondColor}">
                <div class="rt-ib-names">
                    <span>${escapeHtml(rel.source)} &harr; ${escapeHtml(rel.target)}</span>
                    ${statusHtml}
                </div>
                <div class="rt-ib-stats">
                    <div class="rt-ib-main">
                        <span class="rt-ib-tier">${escapeHtml(rel.tier || '')}</span>
                        <span class="rt-ib-cp" style="color: ${bondColor}">${rel.cp} CP</span>
                    </div>
                    ${advStatsHtml}
                </div>
                ${rel.label ? `<div class="rt-ib-label">${escapeHtml(rel.label)}</div>` : ''}
            </div>
        `;
    });

    infoblockContent.innerHTML = html;
}
