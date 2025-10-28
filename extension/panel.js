// --- NEW, FULLY COMPLIANT AND CORRECTED panel.js ---

class GlyphDevToolsPanel {
    constructor() {
        this.nodes = new Map();
        this.connections = [];
        this.isTracing = false;
        
        this.initializeUI();
        this.setupMessageHandling();
        this.setupEventListeners();
        
        console.log('🔮 Glyph Language DevTools Panel initialized');
    }

    // --- NEW: Compliance Helper Functions (Maps Glyphs to Visuals) ---
    getNodeStyle(type) {
        const styles = {
            '🟦': { color: '#2196F3', label: 'DATA_NODE' },      // Blue: Data
            '🟩': { color: '#4CAF50', label: 'TEXT_NODE' },      // Green: String Data
            '🟨': { color: '#FFC107', label: 'LIST_NODE' },      // Yellow: List
            '🟥': { color: '#F44336', label: 'ERROR_NODE' },     // Red: Errors
            '🟪': { color: '#9C27B0', label: 'STATE_NODE' },     // Purple: State

            '🔷': { color: '#1E88E5', label: 'FUNCTION_NODE' },  // Blue: Pure Function
            '🔶': { color: '#FFEB3B', label: 'ASYNC_NODE' },     // Yellow: Async
            '🔄': { color: '#FF9800', label: 'LOOP_NODE' },      // Orange: Loop
            '❓': { color: '#00BCD4', label: 'CONDITION_NODE' }, // Cyan: Condition

            '📥': { color: '#00BCD4', label: 'INPUT_NODE' },     // Cyan: System Input
            '🟢': { color: '#4CAF50', label: 'OUTPUT_NODE' },    // Green: Success/Output
            '🎯': { color: '#FFEB3B', label: 'EVENT_NODE' },     // Yellow: Event Trigger
        };

        const style = styles[type] || { color: '#757575', label: 'Unknown' };
        return {
            backgroundColor: style.color,
            borderColor: style.color,
            label: style.label,
            glyph: type // Use the glyph itself
        };
    }

    getConnectionStyle(type) {
        const styles = {
            '→': { stroke: '#4CAF50', dash: 'none' },        // DATA_FLOW (Green/Success)
            '⤵️': { stroke: '#F44336', dash: '5,5' },       // ERROR_FLOW (Red/Error)
            '⤴️': { stroke: '#2196F3', dash: '3,3' },       // RETURN_FLOW (Blue/Data)
            '🔄': { stroke: '#FFC107', dash: '8,4' }         // ASYNC_FLOW (Yellow/Async)
        };
        return styles[type] || { stroke: '#757575', dash: 'none' };
    }
    // --- END OF NEW HELPERS ---

    initializeUI() {
        this.executionGraph = document.getElementById('executionGraph');
        this.glyphCanvas = document.getElementById('glyphCanvas');
        this.emptyState = document.getElementById('emptyState');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        
        this.updateStats();
        this.addArrowMarker();
    }

    setupMessageHandling() {
        // Listen for messages from content script via window.postMessage
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA') {
                this.handleTracerData(event.data.payload);
            }
        });
    }

    // --- CRITICAL FIX: CENTRALIZED COMMAND SENDER ---
    sendMessageToInspectedWindow(command) {
        // Correctly executes the window.postMessage call in the context of the inspected page
        const code = `
            if (window.glyphTracer) {
                window.postMessage({ type: 'GLYPH_COMMAND', command: '${command}' }, '*');
                'Command sent: ${command}';
            } else {
                'Error: Glyph tracer not found';
            }
        `;
        chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
            if (isException || result.startsWith('Error:')) {
                console.error(`Error sending command ${command}:`, isException || result);
                this.status.textContent = `❌ Error: Glyph tracer not found. (Command: ${command})`;
            } else {
                console.log(`Command successful: ${command}`);
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
        
        document.getElementById('closeInspector').addEventListener('click', () => {
            document.getElementById('glyphInspector').style.display = 'none';
        });

        this.executionGraph.addEventListener('click', (e) => {
            const target = e.target.closest('.node');
            if (target && this.nodes.has(target.id)) {
                this.inspectNode(this.nodes.get(target.id).data);
            }
        });
    }
    
    // --- CORRECTED TRACING START/STOP ---
    startTracing() {
        if (this.isTracing) return;
        this.isTracing = true;
        this.sendMessageToInspectedWindow('START_TRACING'); // Sends the correct command
        this.status.textContent = '🟢 Tracing Active...';
        this.updateTracingUI();
    }
    
    stopTracing() {
        if (!this.isTracing) return;
        this.isTracing = false;
        this.sendMessageToInspectedWindow('STOP_TRACING'); // Sends the correct command
        this.status.textContent = '🟡 Tracing Paused.';
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
        this.autoLayoutNodes();
    }
    
    addNodeToGraph(nodeData) {
        if (this.nodes.has(nodeData.id)) return;

        const nodeElement = this.createNodeElement(nodeData);
        this.nodes.set(nodeData.id, { element: nodeElement, data: nodeData, position: { x: 0, y: 0 } }); 
        this.executionGraph.appendChild(nodeElement);
        
        this.autoLayoutNodes();
    }

    createNodeElement(nodeData) {
        const node = document.createElement('div');
        const style = this.getNodeStyle(nodeData.type);
        
        node.className = 'node glyph-node'; 
        node.id = nodeData.id;
        
        // Applying compliant styles inline
        node.style.backgroundColor = style.backgroundColor;
        node.style.borderColor = style.borderColor;
        
        node.innerHTML = `
            <div class="glyph-icon">${style.glyph}</div>
            <div class="node-label">${nodeData.label}</div>
        `;
        
        if (nodeData.properties?.source) {
            const source = nodeData.properties.source;
            node.title = `${source.fileName}:${source.lineNumber}`;
        }

        node.style.left = `20px`;
        node.style.top = `20px`;
        
        this.makeDraggable(node);
        
        return node;
    }

    makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const self = this;

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
            
            const newLeft = element.offsetLeft - pos1;
            const newTop = element.offsetTop - pos2;
            
            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";

            const nodeWrapper = self.nodes.get(element.id);
            if(nodeWrapper) {
                nodeWrapper.position.x = newLeft;
                nodeWrapper.position.y = newTop;
            }

            self.redrawAllConnections();
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
        const fromNodeWrapper = this.nodes.get(connectionData.from);
        const toNodeWrapper = this.nodes.get(connectionData.to);
        
        if (!fromNodeWrapper || !toNodeWrapper) return;
        
        const fromNode = fromNodeWrapper.element;
        const toNode = toNodeWrapper.element;

        const svgNS = "http://www.w3.org/2000/svg";
        const line = document.createElementNS(svgNS, "line");
        const lineStyle = this.getConnectionStyle(connectionData.type);
        
        line.classList.add('connection');
        
        line.setAttribute('stroke', lineStyle.stroke);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', lineStyle.dash);
        line.setAttribute('marker-end', 'url(#arrowhead)');
        
        const updateLine = () => {
            const nodeWidth = 140; 
            const nodeHeight = 60; 
            
            // Calculate center points
            const x1 = fromNode.offsetLeft + nodeWidth / 2;
            const y1 = fromNode.offsetTop + nodeHeight / 2;
            const x2 = toNode.offsetLeft + nodeWidth / 2;
            const y2 = toNode.offsetTop + nodeHeight / 2;
            
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
        };
        
        updateLine();
        this.glyphCanvas.appendChild(line);
    }
    
    autoLayoutNodes() {
        const nodesArray = Array.from(this.nodes.values());
        const timeSorted = nodesArray.sort((a, b) => a.data.timestamp - b.data.timestamp);
        
        const gridSize = Math.ceil(Math.sqrt(nodesArray.length));
        const nodeWidth = 140;
        const nodeHeight = 80;
        const padding = 20;
        
        timeSorted.forEach((nodeWrapper, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            
            const newLeft = col * (nodeWidth + padding) + padding;
            const newTop = row * (nodeHeight + padding) + padding;

            nodeWrapper.element.style.left = `${newLeft}px`;
            nodeWrapper.element.style.top = `${newTop}px`;
            
            nodeWrapper.position.x = newLeft;
            nodeWrapper.position.y = newTop;
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
        
        if (this.glyphCanvas.querySelector('defs')) return; 
        
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
        polygon.setAttribute('fill', '#4CAF50'); // Data Flow green
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.glyphCanvas.appendChild(defs);
    }
    
    inspectNode(nodeData) {
        // ... (Simplified inspector logic to focus on core function)
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

        if (nodeData.properties?.executionId) {
            const executionId = nodeData.properties.executionId;
            
            // Request snapshot from the content script
            chrome.devtools.inspectedWindow.eval(`
                (function() {
                    if (window.glyphStateManager) {
                        const snapshot = window.glyphStateManager.variableSnapshots.get('${executionId}_start');
                        
                        window.postMessage({
                            type: 'GLYPH_TRACER_DATA',
                            payload: {
                                event: 'SNAPSHOT_RETURN',
                                nodeId: '${nodeData.id}',
                                data: { snapshot: snapshot }
                            }
                        }, '*');
                    }
                })();
                'Snapshot request sent...';
            `);
        }

        content.innerHTML = html;
        inspector.style.display = 'block';

        const snapshotHandler = (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA' && event.data.payload.event === 'SNAPSHOT_RETURN' && event.data.payload.nodeId === nodeData.id) {
                const stateData = event.data.payload.data;
                this.updateInspectorWithStateData(content, stateData, nodeData);
                window.removeEventListener('message', snapshotHandler);
            }
        };

        window.addEventListener('message', snapshotHandler);
    }
    
    updateInspectorWithStateData(content, stateData, nodeData) {
        let additionalHTML = '';

        if (stateData.snapshot && stateData.snapshot.variables) {
            additionalHTML += `
                <div class="inspector-section">
                    <strong>Variable Snapshot (Input)</strong>
                    <pre>${JSON.stringify(stateData.snapshot.variables, null, 2)}</pre>
                </div>
            `;
        }

        content.innerHTML = additionalHTML + content.innerHTML;
    }
    
    clearGraph() {
        this.nodes.forEach(node => node.element.remove());
        this.nodes.clear();
        this.connections = [];
        this.redrawAllConnections();
        this.showEmptyState();
        this.updateStats();
        document.getElementById('glyphInspector').style.display = 'none';
        this.status.textContent = 'Graph Cleared.';
    }

    exportAsGlyph() {
        // ... (Export logic remains the same)
        const nodes = Array.from(this.nodes.values()).map(n => ({
            id: n.id,
            type: n.data.type,
            label: n.data.label,
            position: n.position,
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

// Initialize when panel loads
document.addEventListener('DOMContentLoaded', () => {
    new GlyphDevToolsPanel();
});
