const BOND_COLORS = {
    '[R]': '#ff6b81',
    '[P]': '#7bed9f',
    '[PL]': '#ffd32a',
    '[F]': '#70a1ff',
    '[H]': '#ff4757',
    '[C]': '#a29bfe'
};

export class RelationGraph {
    constructor(canvas, relations) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.relations = relations;
        this.nodes = [];
        this.edges = [];
        this.width = canvas.width;
        this.height = canvas.height;
        this.animationFrame = null;
        
        this.dragNode = null;
        this.hoverEdge = null;
        this.tooltipParams = null; // {x, y, text, visible}
        
        this.initData();
        this.bindEvents();
    }
    
    initData() {
        const nodeMap = new Map();
        
        const addNode = (name) => {
            if (!nodeMap.has(name)) {
                // Arrange in a circle initially
                const count = nodeMap.size;
                const total = 10; // estimate
                const angle = (count / total) * Math.PI * 2;
                const r = Math.min(this.width, this.height) / 3;
                nodeMap.set(name, {
                    id: name,
                    x: this.width/2 + Math.cos(angle) * r,
                    y: this.height/2 + Math.sin(angle) * r,
                    vx: 0, vy: 0,
                    radius: 25
                });
            }
        };
        
        // Calculate node degree for sizing
        const degreeMap = new Map();
        
        this.relations.forEach(r => {
            addNode(r.source);
            addNode(r.target);
            
            degreeMap.set(r.source, (degreeMap.get(r.source) || 0) + 1);
            degreeMap.set(r.target, (degreeMap.get(r.target) || 0) + 1);
            
            this.edges.push({
                source: nodeMap.get(r.source),
                target: nodeMap.get(r.target),
                cp: r.cp,
                bond: r.bond,
                tier: r.tier,
                label: r.label,
                color: BOND_COLORS[r.bond] || '#ffa502',
                isCurve: false,
                curveDirection: 1 // 1 or -1 to bow out in different directions
            });
        });
        
        // Flag bidirectional edges for curved rendering
        for (let i = 0; i < this.edges.length; i++) {
            for (let j = i + 1; j < this.edges.length; j++) {
                if (this.edges[i].source === this.edges[j].target && this.edges[i].target === this.edges[j].source) {
                    this.edges[i].isCurve = true;
                    this.edges[i].curveDirection = 1;
                    this.edges[j].isCurve = true;
                    this.edges[j].curveDirection = -1; // Opposite curve
                }
            }
        }
        
        this.nodes = Array.from(nodeMap.values());
        
        // Adjust node sizes based on degree
        this.nodes.forEach(node => {
            const deg = degreeMap.get(node.id) || 1;
            node.radius = Math.min(45, 15 + (deg * 4)); 
        });
    }
    
    bindEvents() {
        this.onMouseDown = this.handleMouseDown.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onMouseUp = this.handleMouseUp.bind(this);
        
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('mouseleave', this.onMouseUp);

        this.onTouchStart = this.handleTouchStart.bind(this);
        this.onTouchMove = this.handleTouchMove.bind(this);
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onMouseUp);
    }
    
    handleTouchStart(e) {
        if (e.touches.length > 0) {
            e.clientX = e.touches[0].clientX;
            e.clientY = e.touches[0].clientY;
            this.handleMouseDown(e);
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length > 0) {
            if (e.cancelable) e.preventDefault();
            e.clientX = e.touches[0].clientX;
            e.clientY = e.touches[0].clientY;
            this.handleMouseMove(e);
        }
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx*dx + dy*dy < node.radius*node.radius) {
                this.dragNode = node;
                this.dragNode.vx = 0;
                this.dragNode.vy = 0;
                return;
            }
        }
        
        // If not clicked on a node, check if clicked on an edge
        if (this.hoverEdge) {
            this.showTooltip(this.hoverEdge, e.clientX, e.clientY);
        } else {
            this.hideTooltip();
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.dragNode) {
            this.dragNode.x = x;
            this.dragNode.y = y;
            return;
        }
        
        // Find hovered edge
        this.hoverEdge = null;
        let minDist = 10;
        
        for (const edge of this.edges) {
            const dist = this.distanceToLineSegment(x, y, edge.source.x, edge.source.y, edge.target.x, edge.target.y);
            if (dist < minDist) {
                minDist = dist;
                this.hoverEdge = edge;
            }
        }
        
        this.canvas.style.cursor = this.hoverEdge ? 'pointer' : 'default';
        this.hoverNode = null;
        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx*dx + dy*dy < node.radius*node.radius) {
                this.canvas.style.cursor = 'grab';
                this.hoverNode = node;
                break;
            }
        }
    }
    
    handleMouseUp(e) {
        this.dragNode = null;
    }
    
    distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1)**2 + (y2 - y1)**2;
        if (l2 === 0) return Math.sqrt((px - x1)**2 + (py - y1)**2);
        let t = ((px - x1)*(x2 - x1) + (py - y1)*(y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((px - (x1 + t*(x2 - x1)))**2 + (py - (y1 + t*(y2 - y1)))**2);
    }
    
    showTooltip(edge, clientX, clientY) {
        const tooltip = document.getElementById('rt-graph-tooltip');
        if (!tooltip) return;
        
        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${edge.source.id} → ${edge.target.id}</div>
            <div style="color: ${edge.color}">Bond: ${edge.bond}</div>
            <div>CP: ${edge.cp} | ${edge.tier}</div>
            <div style="font-style: italic; margin-top: 4px; font-size: 0.9em; color: #ccc;">"${edge.label}"</div>
        `;
        
        tooltip.style.left = (clientX + 15) + 'px';
        tooltip.style.top = (clientY + 15) + 'px';
        tooltip.style.display = 'block';
        
        if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
        this.tooltipTimeout = setTimeout(() => this.hideTooltip(), 4000);
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('rt-graph-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
    
    updatePhysics() {
        const defaultK = 0.05; // Spring constant
        const rep = 3000; // Increased Repulsion constant
        const damp = 0.85; // Damping
        const len = 150; // Ideal spring length
        
        // Repulsion
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const n1 = this.nodes[i];
                const n2 = this.nodes[j];
                const dx = n1.x - n2.x;
                const dy = n1.y - n2.y;
                const d2 = dx*dx + dy*dy;
                if (d2 > 0 && d2 < 120000) { // Limit repulsion radius
                    const d = Math.sqrt(d2);
                    const f = rep / d2;
                    const fx = (dx/d) * f;
                    const fy = (dy/d) * f;
                    n1.vx += fx; n1.vy += fy;
                    n2.vx -= fx; n2.vy -= fy;
                }
            }
        }
        
        // Attraction (Springs)
        for (const edge of this.edges) {
            let k = defaultK;
            if (edge.bond === '[H]') k = -0.01; // Repel hostile
            else if (['[R]', '[P]', '[PL]', '[F]'].includes(edge.bond)) k = 0.08; // Strong attract
            
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d > 0) {
                const f = k * (d - len);
                const fx = (dx/d) * f;
                const fy = (dy/d) * f;
                edge.source.vx += fx; edge.source.vy += fy;
                edge.target.vx -= fx; edge.target.vy -= fy;
            }
        }
        
        // Center gravity
        const cx = this.width / 2;
        const cy = this.height / 2;
        const cg = 0.01;
        for (const node of this.nodes) {
            node.vx += (cx - node.x) * cg;
            node.vy += (cy - node.y) * cg;
        }
        
        // Apply velocity
        for (const node of this.nodes) {
            if (node !== this.dragNode) {
                node.vx *= damp;
                node.vy *= damp;
                node.x += node.vx;
                node.y += node.vy;
                
                // Bounds
                node.x = Math.max(node.radius, Math.min(this.width - node.radius, node.x));
                node.y = Math.max(node.radius, Math.min(this.height - node.radius, node.y));
            }
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Determine faded nodes if hovering
        const activeNodes = new Set();
        if (this.hoverNode) {
            activeNodes.add(this.hoverNode);
            for (const edge of this.edges) {
                if (edge.source === this.hoverNode) activeNodes.add(edge.target);
                if (edge.target === this.hoverNode) activeNodes.add(edge.source);
            }
        }
        
        // Draw edges
        for (const edge of this.edges) {
            const isFaded = this.hoverNode && edge.source !== this.hoverNode && edge.target !== this.hoverNode;
            this.ctx.globalAlpha = isFaded ? 0.1 : 1.0;
            
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist === 0) continue;
            
            const mx = edge.source.x + dx/2;
            const my = edge.source.y + dy/2;
            
            let cx = mx, cy = my;
            if (edge.isCurve) {
                const nx = -dy / dist;
                const ny = dx / dist;
                const offset = 40 * edge.curveDirection;
                cx += nx * offset;
                cy += ny * offset;
            }
            
            // Calculate intersection with target node boundary
            const angle = Math.atan2(edge.target.y - cy, edge.target.x - cx);
            const targetX = edge.target.x - Math.cos(angle) * (edge.target.radius + 4);
            const targetY = edge.target.y - Math.sin(angle) * (edge.target.radius + 4);

            this.ctx.beginPath();
            this.ctx.moveTo(edge.source.x, edge.source.y);
            
            if (edge.isCurve) {
                this.ctx.quadraticCurveTo(cx, cy, targetX, targetY);
            } else {
                this.ctx.lineTo(targetX, targetY);
            }
            
            const cpThickness = Math.max(1, Math.min(6, Math.abs(edge.cp) / 15));
            this.ctx.strokeStyle = edge === this.hoverEdge ? '#fff' : edge.color;
            this.ctx.lineWidth = cpThickness;
            this.ctx.stroke();
            
            // Draw Arrow Head
            this.ctx.beginPath();
            this.ctx.moveTo(targetX, targetY);
            this.ctx.lineTo(targetX - 10 * Math.cos(angle - Math.PI / 6), targetY - 10 * Math.sin(angle - Math.PI / 6));
            this.ctx.lineTo(targetX - 10 * Math.cos(angle + Math.PI / 6), targetY - 10 * Math.sin(angle + Math.PI / 6));
            this.ctx.closePath();
            this.ctx.fillStyle = this.ctx.strokeStyle;
            this.ctx.fill();
            
            // Draw CP label at midpoint
            if (edge.cp !== 0 && !isFaded) {
                // If curved, finding actual bezier midpoint is better
                let labelX = mx, labelY = my;
                if (edge.isCurve) {
                    labelX = 0.25 * edge.source.x + 0.5 * cx + 0.25 * edge.target.x;
                    labelY = 0.25 * edge.source.y + 0.5 * cy + 0.25 * edge.target.y;
                }
                
                this.ctx.fillStyle = edge.color;
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(edge.cp, labelX, labelY - 8);
            }
        }
        
        // Draw nodes
        for (const node of this.nodes) {
            const isFaded = this.hoverNode && !activeNodes.has(node);
            this.ctx.globalAlpha = isFaded ? 0.2 : 1.0;
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = this.hoverNode === node ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            this.ctx.globalAlpha = isFaded ? 0.3 : 1.0;
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            let displayName = node.id;
            if (displayName.length > 10) displayName = displayName.substring(0, 9) + '…';
            this.ctx.fillText(displayName, node.x, node.y);
        }
        
        this.ctx.globalAlpha = 1.0; // reset
    }
    
    renderLoop() {
        this.updatePhysics();
        this.draw();
        this.animationFrame = requestAnimationFrame(() => this.renderLoop());
    }
    
    init() {
        this.resize();
        this.renderLoop();
    }
    
    resize() {
        // Adjust canvas internal resolution to its styled dimensions
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width || 600;
        this.height = Math.max(400, rect.height || 400);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    
    destroy() {
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseUp);
        this.hideTooltip();
    }
}
