class GlyphDevTools {
    constructor() {
        this.nodes = new Map();
        this.connections = [];
        this.isTracing = false;
        this.port = null;
        
        this.initializeUI();
        this.setupMessageHandling();
        this.setupEventListeners();
    }
    
    initializeUI() {
        this.executionGraph = document.getElementById('executionGraph');
        this.glyphCanvas = document.getElementById('glyphCanvas');
        this.emptyState = document.getElementById('emptyState');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        
        this.updateStats();
    }
    
    setupMessageHandling() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA') {
                this.handleTracerData(event.data.payload);
            }
        });
        
        this.port = chrome.runtime.connect({ name: "glyph-devtools" });
        
        this.port.onMessage.addListener((message) => {
            if (message.type === 'TRACING_STATE_CHANGED') {
                this.isTracing = message.isTracing;
                this.updateTracingUI();
            }
        });
    }
    
    setupEventListeners() {
        document.getElementById('startTracing').addEventListener('click', () => {
            this.startTracing();
        });
        
        document.getElementById('stopTracing').addEventListener('click', () => {
            this.stopTracing();
        });
        
        document.getElementById('clearGraph').addEventListener('click', () => {
            this.clearGraph();
        });
        
        document.getElementById('exportGlyph').addEventListener('click', () => {
            this.exportAsGlyph();
        });
        
        document.querySelectorAll('.glyph-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.addCustomNode(e.target.dataset.type);
            });
        });

        document.getElementById('closeInspector').addEventListener('click', () => {
            document.getElementById('glyphInspector').style.display = 'none';
        });
    }
    
    startTracing() {
        this.port.postMessage({ type: 'START_TRACING' });
        this.status.textContent = 'Tracing JavaScript execution...';
        this.isTracing = true;
        this.updateTracingUI();
    }
    
    stopTracing() {
        this.port.postMessage({ type: 'STOP_TRACING' });
        this.status.textContent = 'Tracing stopped';
        this.isTracing = false;
        this.updateTracingUI();
    }
    
    updateTracingUI() {
        const startBtn = document.getElementById('startTracing');
        const stopBtn = document.getElementById('stopTracing');
        
        if (this.isTracing) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            startBtn.style.opacity = '0.5';
            stopBtn.style.opacity = '1';
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            startBtn.style.opacity = '1';
            stopBtn.style.opacity = '0.5';
        }
    }
    
    handleTracerData(payload) {
        if (!this.isTracing) return;
        
        switch (payload.event) {
            case 'NODE_ADDED':
                this.addNodeToGraph(payload.data);
                break;
            case 'CONNECTION_ADDED':
                this.addConnectionToGraph(payload.data);
                break;
        }
        
        this.updateStats();
        this.hideEmptyState();
    }
    
    addNodeToGraph(nodeData) {
        const nodeElement = this.createNodeElement(nodeData);
        this.nodes.set(nodeData.id, { element: nodeElement, data: nodeData });
        this.executionGraph.appendChild(nodeElement);
        
        this.autoLayoutNodes();
    }
    
    createNodeElement(nodeData) {
        const node = document.createElement('div');
        node.className = `node node-${this.getNodeTypeClass(nodeData.type)}`;
        node.id = nodeData.id;
        node.innerHTML = `
            <div class="glyph-icon">${nodeData.type}</div>
            <div class="node-label">${nodeData.label}</div>
        `;
        
        if (nodeData.properties?.source) {
            const source = nodeData.properties.source;
            node.title = `${source.fileName}:${source.lineNumber}:${source.columnNumber}`;
        }

        node.style.left = `${Math.random() * 500 + 50}px`;
        node.style.top = `${Math.random() * 300 + 50}px`;
        
        this.makeDraggable(node);
        
        node.addEventListener('click', (e) => {
            this.inspectNode(nodeData);
            e.stopPropagation();
        });

        return node;
    }
    
    getNodeTypeClass(glyphType) {
        const typeMap = {
            '○': 'data',
            '□': 'data', 
            '△': 'data',
            '◇': 'data',
            '▷': 'function',
            '⟳': 'function',
            '◯': 'function',
            '⤶': 'output',
            '⚡': 'error',
            '🔄': 'async',
            '⤵': 'input',
            '⤴': 'output'
        };
        
        return typeMap[glyphType] || 'function';
    }
    
    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        element.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
    
    addConnectionToGraph(connectionData) {
        this.connections.push(connectionData);
        this.drawConnection(connectionData);
    }
    
    drawConnection(connectionData) {
        const fromNode = this.nodes.get(connectionData.from)?.element;
        const toNode = this.nodes.get(connectionData.to)?.element;
        
        if (!fromNode || !toNode) return;
        
        const svgNS = "http://www.w3.org/2000/svg";
        const line = document.createElementNS(svgNS, "line");
        
        line.classList.add('connection');
        if (connectionData.type === '⚡') {
            line.classList.add('connection-error');
        }
        
        line.setAttribute('marker-end', 'url(#arrowhead)');
        
        const updateLine = () => {
            const fromRect = fromNode.getBoundingClientRect();
            const toRect = toNode.getBoundingClientRect();
            const graphRect = this.executionGraph.getBoundingClientRect();
            
            const x1 = fromRect.left + fromRect.width / 2 - graphRect.left;
            const y1 = fromRect.top + fromRect.height / 2 - graphRect.top;
            const x2 = toRect.left + toRect.width / 2 - graphRect.left;
            const y2 = toRect.top + toRect.height / 2 - graphRect.top;
            
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
        };
        
        updateLine();
        this.glyphCanvas.appendChild(line);
        
        const observer = new MutationObserver(updateLine);
        observer.observe(fromNode, { attributes: true, attributeFilter: ['style'] });
        observer.observe(toNode, { attributes: true, attributeFilter: ['style'] });
    }
    
    autoLayoutNodes() {
        const nodesArray = Array.from(this.nodes.values());
        const timeSorted = nodesArray.sort((a, b) => a.data.timestamp - b.data.timestamp);
        
        const gridSize = Math.ceil(Math.sqrt(nodesArray.length));
        const nodeWidth = 140;
        const nodeHeight = 80;
        const padding = 20;
        
        timeSorted.forEach((node, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            
            node.element.style.left = `${col * (nodeWidth + padding) + padding}px`;
            node.element.style.top = `${row * (nodeHeight + padding) + padding}px`;
        });
        
        this.redrawAllConnections();
    }
    
    redrawAllConnections() {
        while (this.glyphCanvas.firstChild) {
            this.glyphCanvas.removeChild(this.glyphCanvas.firstChild);
        }
        
        this.addArrowMarker();
        
        this.connections.forEach(conn => this.drawConnection(conn));
    }
    
    addArrowMarker() {
        const svgNS = "http://www.w3.org/2000/svg";
        const defs = document.createElementNS(svgNS, "defs");
        const marker = document.createElementNS(svgNS, "marker");
        
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS(svgNS, "polygon");
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#64b5f6');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.glyphCanvas.appendChild(defs);
    }
    
    addCustomNode(glyphType) {
        const nodeId = `custom_${Date.now()}`;
        const nodeData = {
            id: nodeId,
            type: glyphType,
            label: `Custom ${this.getGlyphName(glyphType)}`,
            timestamp: Date.now(),
            properties: { custom: true }
        };
        
        this.addNodeToGraph(nodeData);
    }
    
    getGlyphName(glyphType) {
        const names = {
            '○': 'Data Node',
            '□': 'Text Node',
            '△': 'List Node', 
            '◇': 'Bool Node',
            '▷': 'Function Node',
            '⟳': 'Loop Node',
            '◯': 'Condition Node',
            '⤶': 'Output Node',
            '⚡': 'Error Node',
            '🔄': 'Async Node',
            '⤵': 'Input Node',
            '⤴': 'Return Node'
        };
        
        return names[glyphType] || 'Node';
    }
    
    inspectNode(nodeData) {
        const inspector = document.getElementById('glyphInspector');
        const content = document.getElementById('inspectorContent');
        
        let html = `
            <div class="inspector-section">
                <strong>Node Information</strong><br>
                Type: ${nodeData.type}<br>
                Label: ${nodeData.label}<br>
                Time: ${new Date(nodeData.timestamp).toLocaleTimeString()}<br>
                ID: ${nodeData.id}
            </div>
        `;

        if (nodeData.properties?.source) {
            const source = nodeData.properties.source;
            html += `
                <div class="inspector-section">
                    <strong>Source Location</strong><br>
                    File: ${source.fileName}<br>
                    Line: ${source.lineNumber}<br>
                    Column: ${source.columnNumber}<br>
                    Function: ${source.functionName}
                </div>
            `;
        }

        if (nodeData.properties?.executionId) {
            html += `
                <div class="inspector-section">
                    <strong>Execution Context</strong><br>
                    Execution ID: ${nodeData.properties.executionId}
                </div>
            `;
        }

        if (nodeData.properties) {
            const props = { ...nodeData.properties };
            delete props.source;
            delete props.executionId;
            
            if (Object.keys(props).length > 0) {
                html += `
                    <div class="inspector-section">
                        <strong>Properties</strong>
                        <pre>${JSON.stringify(props, null, 2)}</pre>
                    </div>
                `;
            }
        }

        content.innerHTML = html;
        inspector.style.display = 'block';
    }
    
    clearGraph() {
        this.nodes.forEach(node => node.element.remove());
        this.nodes.clear();
        this.connections = [];
        this.redrawAllConnections();
        this.showEmptyState();
        this.updateStats();
    }
    
    exportAsGlyph() {
        const nodes = Array.from(this.nodes.values()).map(n => ({
            id: n.data.id,
            type: n.data.type,
            label: n.data.label,
            position: {
                x: parseInt(n.element.style.left) || 0,
                y: parseInt(n.element.style.top) || 0
            },
            properties: n.data.properties || {}
        }));
        
        const glyphProgram = {
            version: "1.0",
            program: "exported-trace",
            nodes: nodes,
            connections: this.connections,
            metadata: {
                exportedAt: new Date().toISOString(),
                source: "glyph-js-devtools",
                totalNodes: nodes.length,
                totalConnections: this.connections.length
            }
        };
        
        const dataStr = JSON.stringify(glyphProgram, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `glyph-trace-${Date.now()}.glyph`;
        link.click();
        
        this.status.textContent = `Exported ${nodes.length} nodes as .glyph file`;
    }
    
    updateStats() {
        this.stats.textContent = `Nodes: ${this.nodes.size} | Connections: ${this.connections.length}`;
    }
    
    hideEmptyState() {
        this.emptyState.style.display = 'none';
    }
    
    showEmptyState() {
        this.emptyState.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GlyphDevTools();
});
