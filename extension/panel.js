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

    // --- Compliance Helper Functions ---
    getNodeStyle(type) {
        const styles = {
            '🟦': { color: '#2196F3', label: 'DATA_NODE', glyph: '🟦' },
            '🟩': { color: '#4CAF50', label: 'TEXT_NODE', glyph: '🟩' },
            '🟨': { color: '#FFC107', label: 'LIST_NODE', glyph: '🟨' },
            '🟥': { color: '#F44336', label: 'ERROR_NODE', glyph: '🟥' },
            '🟪': { color: '#9C27B0', label: 'STATE_NODE', glyph: '🟪' },
            '🔷': { color: '#1E88E5', label: 'FUNCTION_NODE', glyph: '🔷' },
            '🔶': { color: '#FFEB3B', label: 'ASYNC_NODE', glyph: '🔶' },
            '🔄': { color: '#FF9800', label: 'LOOP_NODE', glyph: '🔄' },
            '❓': { color: '#00BCD4', label: 'CONDITION_NODE', glyph: '❓' },
            '📥': { color: '#00BCD4', label: 'INPUT_NODE', glyph: '📥' },
            '🟢': { color: '#4CAF50', label: 'OUTPUT_NODE', glyph: '🟢' },
            '🎯': { color: '#FFEB3B', label: 'EVENT_NODE', glyph: '🎯' },
            '○': { color: '#2196F3', label: 'DATA_NODE (Legacy)', glyph: '🟦' },
            '□': { color: '#4CAF50', label: 'TEXT_NODE (Legacy)', glyph: '🟩' },
            '▷': { color: '#1E88E5', label: 'FUNCTION_NODE (Legacy)', glyph: '🔷' },
            '⚡': { color: '#F44336', label: 'ERROR_NODE (Legacy)', glyph: '🟥' },
            '⤵': { color: '#00BCD4', label: 'INPUT_NODE (Legacy)', glyph: '📥' },
            '⤴': { color: '#4CAF50', label: 'OUTPUT_NODE (Legacy)', glyph: '🟢' },
            '⤶': { color: '#4CAF50', label: 'OUTPUT_NODE (Legacy)', glyph: '🟢' }
        };

        const style = styles[type] || { color: '#757575', label: 'Unknown', glyph: type };
        return {
            backgroundColor: style.color,
            borderColor: style.color,
            label: style.label,
            glyph: style.glyph
        };
    }

    getConnectionStyle(type) {
        const styles = {
            '→': { stroke: '#4CAF50', dash: 'none' },        // DATA_FLOW (Green/Success)
            '⤵️': { stroke: '#F44336', dash: '5,5' },       // ERROR_FLOW (Red/Error)
            '⤴️': { stroke: '#2196F3', dash: '3,3' },       // RETURN_FLOW (Blue/Data)
            '⚡': { stroke: '#F44336', dash: '5,5' }        // Legacy Error Flow
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
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA') {
                this.handleTracerData(event.data.payload);
            }
        });
    }

    // --- CENTRALIZED COMMAND SENDER (The original fix for "tracer not found") ---
    sendMessageToInspectedWindow(command) {
        // Correct way to execute code (send postMessage) in the inspected page's context
        const code = `window.postMessage({ type: 'GLYPH_COMMAND', command: '${command}' }, '*');`;
        
        chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
            if (isException) {
                console.error(`Error sending command ${command}:`, isException);
                this.status.textContent = `❌ ERROR: Communication failed. Try refreshing the page.`;
            } else if (command === 'START_TRACING') {
                this.status.textContent = '🟢 Tracing Active...';
            }
        });
    }
    
    setupEventListeners() {
        
        // --- FIX: Null checks added for safety ---
        const startBtn = document.getElementById('startTracing');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startTracing();
            });
        }
        
        const stopBtn = document.getElementById('stopTracing');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopTracing();
            });
        }
        
        const clearBtn = document.getElementById('clearGraph');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearGraph();
            });
        }
        
        const exportBtn = document.getElementById('exportGlyph');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportAsGlyph();
            });
        }
        
        const closeInspectorBtn = document.getElementById('closeInspector');
        if (closeInspectorBtn) {
            closeInspectorBtn.addEventListener('click', () => {
                document.getElementById('glyphInspector').style.display = 'none';
            });
        }

        if (this.executionGraph) {
            this.executionGraph.addEventListener('click', (e) => {
                const target = e.target.closest('.node');
                if (target && this.nodes.has(target.id)) {
                    this.inspectNode(this.nodes.get(target.id).data);
                }
            });
        }
    }
    
    // --- TRACING START/STOP (Uses the corrected sendMessageToInspectedWindow) ---
    startTracing() {
        if (this.isTracing) return;
        this.isTracing = true;
        this.sendMessageToInspectedWindow('START_TRACING');
        this.updateTracingUI();
    }
    
    stopTracing() {
        if (!this.isTracing) return;
        this.isTracing = false;
        this.sendMessageToInspectedWindow('STOP_TRACING');
        this.status.textContent = '🟡 Tracing Paused.';
        this.updateTracingUI();
    }
    
    updateTracingUI() {
        const startBtn = document.getElementById('startTracing');
        const stopBtn = document.getElementById('stopTracing');
        
        if (startBtn && stopBtn) {
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

        node.style.left = `${Math.random() * 500 + 50}px`;
        node.style.top = `${Math.random() * 300 + 50}px`;
        
        this.makeDraggable(node);
        
        node.addEventListener('click', (e) => {
            this.inspectNode(nodeData);
            e.stopPropagation();
        });
        
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
        
        const markerColor = lineStyle.stroke; 
        line.setAttribute('marker-end', `url(#arrowhead-${markerColor.replace('#', '')})`);
        
        const updateLine = () => {
            const fromRect = fromNode.getBoundingClientRect();
            const toRect = toNode.getBoundingClientRect();
            const graphRect = this.executionGraph.getBoundingClientRect();

            const x1 = fromRect.left + fromNode.offsetWidth / 2 - graphRect.left;
            const y1 = fromRect.top + fromNode.offsetHeight / 2 - graphRect.top;
            const x2 = toRect.left + toNode.offsetWidth / 2 - graphRect.left;
            const y2 = toRect.top + toNode.offsetHeight / 2 - graphRect.top;
            
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
        let defs = this.glyphCanvas.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS(svgNS, "defs");
            this.glyphCanvas.appendChild(defs);
        }

        const connectionColors = ['#4CAF50', '#F44336', '#2196F3']; // DATA_FLOW, ERROR_FLOW, RETURN_FLOW
        
        connectionColors.forEach(color => {
            const markerId = `arrowhead-${color.replace('#', '')}`;
            if (defs.querySelector(`#${markerId}`)) return; 

            const marker = document.createElementNS(svgNS, "marker");
            marker.setAttribute('id', markerId);
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'strokeWidth');
            
            const polygon = document.createElementNS(svgNS, "polygon");
            polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
            polygon.setAttribute('fill', color);
            
            marker.appendChild(polygon);
            defs.appendChild(marker);
        });
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

        if (nodeData.properties?.executionId) {
            const executionId = nodeData.properties.executionId;
            
            chrome.devtools.inspectedWindow.eval(`
                (function() {
                    if (window.glyphStateManager) {
                        const sourceInfo = window.glyphStateManager.getSourceForNode('${executionId}');
                        const snapshot = window.glyphStateManager.variableSnapshots.get('${executionId}_start');
                        
                        window.postMessage({
                            type: 'GLYPH_TRACER_DATA',
                            payload: {
                                event: 'SNAPSHOT_RETURN',
                                nodeId: '${nodeData.id}',
                                data: { source: sourceInfo, snapshot: snapshot }
                            }
                        }, '*');
                    } else {
                        window.postMessage({
                            type: 'GLYPH_TRACER_DATA',
                            payload: {
                                event: 'SNAPSHOT_RETURN',
                                nodeId: '${nodeData.id}',
                                data: { error: 'State manager not available for inspection' }
                            }
                        }, '*');
                    }
                })();
                'Snapshot request sent...'; 
            `);
        }
        
        const existingHandler = window._glyphSnapshotHandler;
        if (existingHandler) {
            window.removeEventListener('message', existingHandler);
        }

        const snapshotHandler = (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA' && event.data.payload.event === 'SNAPSHOT_RETURN' && event.data.payload.nodeId === nodeData.id) {
                const stateData = event.data.payload.data;
                this.updateInspectorWithStateData(content, stateData, nodeData);
                window.removeEventListener('message', snapshotHandler); 
            }
        };

        window.addEventListener('message', snapshotHandler);
        window._glyphSnapshotHandler = snapshotHandler; 

        content.innerHTML = html;
        inspector.style.display = 'block';
    }
    
    updateInspectorWithStateData(content, stateData, nodeData) {
        let additionalHTML = '';

        if (stateData.error) {
            additionalHTML += `
                <div class="inspector-section">
                    <strong>State Info</strong><br>
                    ${stateData.error}
                </div>
            `;
        }

        if (stateData.source && stateData.source.file !== 'unknown') {
            additionalHTML += `
                <div class="inspector-section">
                    <strong>Enhanced Source Info</strong><br>
                    File: ${stateData.source.file}<br>
                    Line: ${stateData.source.line}<br>
                    Function: ${stateData.source.function}<br>
                </div>
            `;
        }

        if (stateData.snapshot && stateData.snapshot.variables) {
            additionalHTML += `
                <div class="inspector-section">
                    <strong>Variable Snapshot (Input)</strong>
                    <pre>${JSON.stringify(stateData.snapshot.variables, null, 2)}</pre>
                </div>
            `;
        }

        const existingContent = content.innerHTML;
        content.innerHTML = additionalHTML + existingContent;
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
        if (this.emptyState) {
             this.emptyState.style.display = 'none';
        }
    }
    
    showEmptyState() {
        if (this.emptyState) {
            this.emptyState.style.display = 'block';
        }
    }
}

// Initialize when panel loads
document.addEventListener('DOMContentLoaded', () => {
    new GlyphDevToolsPanel();
});
