class GlyphDevToolsPanel {
    constructor() {
        this.nodes = new Map();
        this.connections = [];
        this.isTracing = false;
        this.currentTimePosition = 0;
        this.executionHistory = [];

        this.initializeUI();
        this.setupMessageHandling();
        this.setupEventListeners();
        this.addArrowMarker(); // Critical: Add SVG arrow markers for connections

        console.log('🔮 Glyph Language DevTools Panel initialized');
    }

    // --- COMPLIANCE HELPER FUNCTIONS ---
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

    // --- CRITICAL FIX: Message Passing Security Fix ---
    sendMessageToInspectedWindow(command) {
        // FIXED: Properly escape the command to prevent injection
        const escapedCommand = command.replace(/'/g, "\\'");
        const code = `window.postMessage({ type: 'GLYPH_COMMAND', command: '${escapedCommand}' }, '*');`;

        chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
            if (isException) {
                console.error(`Error sending command ${command}:`, isException);
                this.status.textContent = `❌ ERROR: Communication failed. Try refreshing the page.`;
            } else if (command === 'START_TRACING') {
                this.status.textContent = '🟢 Tracing Active...';
            }
        });
    }

    initializeUI() {
        this.executionGraph = document.getElementById('executionGraph');
        this.glyphCanvas = document.getElementById('glyphCanvas');
        this.emptyState = document.getElementById('emptyState');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        this.diagnosisOutput = document.getElementById('diagnosisOutput'); 
        this.timeSlider = document.getElementById('timeSlider');

        this.updateStats();
    }

    // --- CRITICAL: Add SVG Arrow Markers for Connections ---
    addArrowMarker() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#4CAF50');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.glyphCanvas.appendChild(defs);
    }

    setupMessageHandling() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA') {
                this.handleTracerData(event.data.payload);
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

        // Time Travel Controls
        document.getElementById('prevStep')?.addEventListener('click', () => {
            this.timeTravelStep(-1);
        });

        document.getElementById('nextStep')?.addEventListener('click', () => {
            this.timeTravelStep(1);
        });

        this.timeSlider?.addEventListener('input', (e) => {
            this.timeTravelTo(parseInt(e.target.value));
        });

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

        // Diagnosis Button Listener
        const diagnoseBtn = document.getElementById('runDiagnosis');
        if (diagnoseBtn) {
            diagnoseBtn.addEventListener('click', () => {
                this.runDiagnosis();
            });
        }
    }

    // --- MISSING IMPLEMENTATION: Graph Layout Engine ---
    autoLayoutNodes() {
        const nodesArray = Array.from(this.nodes.values());
        if (nodesArray.length === 0) return;

        const container = this.executionGraph.getBoundingClientRect();
        const centerX = container.width / 2;
        const centerY = container.height / 2;
        const radius = Math.min(container.width, container.height) * 0.35;
        
        // Circular layout for better visualization
        nodesArray.forEach((node, index) => {
            const angle = (index / nodesArray.length) * 2 * Math.PI;
            const x = centerX + radius * Math.cos(angle) - 40;
            const y = centerY + radius * Math.sin(angle) - 20;
            
            node.position = { x, y };
            node.element.style.left = `${x}px`;
            node.element.style.top = `${y}px`;
        });

        this.redrawAllConnections();
    }

    // --- MISSING IMPLEMENTATION: Connection Visualization ---
    redrawAllConnections() {
        const svg = this.glyphCanvas;
        // Clear existing connections but keep arrow markers
        const existingLines = svg.querySelectorAll('line');
        existingLines.forEach(line => line.remove());
        
        this.connections.forEach(conn => {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);
            
            if (fromNode && toNode && fromNode.position && toNode.position) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const style = this.getConnectionStyle(conn.type);
                
                // Calculate connection points (center of nodes)
                const fromX = fromNode.position.x + 40;
                const fromY = fromNode.position.y + 20;
                const toX = toNode.position.x + 40;
                const toY = toNode.position.y + 20;
                
                line.setAttribute('x1', fromX);
                line.setAttribute('y1', fromY);
                line.setAttribute('x2', toX);
                line.setAttribute('y2', toY);
                line.setAttribute('stroke', style.stroke);
                line.setAttribute('stroke-width', '2');
                line.setAttribute('stroke-dasharray', style.dash);
                line.setAttribute('marker-end', 'url(#arrowhead)');
                line.setAttribute('class', 'connection-line');
                
                svg.appendChild(line);
            }
        });
    }

    // --- MISSING IMPLEMENTATION: Drag and Drop ---
    makeDraggable(nodeElement) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        nodeElement.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // set the element's new position
            const node = window.glyphPanel.nodes.get(nodeElement.id);
            if (node) {
                node.position.x = (nodeElement.offsetLeft - pos1);
                node.position.y = (nodeElement.offsetTop - pos2);
                nodeElement.style.top = node.position.y + "px";
                nodeElement.style.left = node.position.x + "px";
                
                // Redraw connections when node moves
                window.glyphPanel.redrawAllConnections();
            }
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // --- TIME TRAVEL FUNCTIONALITY (Inspired by error-time-travel.html) ---
    timeTravelStep(direction) {
        const steps = Array.from(this.nodes.values()).map(n => n.data.timestamp).sort((a, b) => a - b);
        if (steps.length === 0) return;

        this.currentTimePosition = Math.max(0, Math.min(steps.length - 1, this.currentTimePosition + direction));
        this.timeTravelToPosition(this.currentTimePosition);
    }

    timeTravelTo(position) {
        const steps = Array.from(this.nodes.values()).map(n => n.data.timestamp).sort((a, b) => a - b);
        if (steps.length === 0) return;

        this.currentTimePosition = Math.max(0, Math.min(steps.length - 1, Math.round(position * (steps.length - 1) / 100)));
        this.timeTravelToPosition(this.currentTimePosition);
    }

    timeTravelToPosition(position) {
        const steps = Array.from(this.nodes.values()).map(n => ({...n, timestamp: n.data.timestamp})).sort((a, b) => a.timestamp - b.timestamp);
        
        // Update UI to show current time position
        this.nodes.forEach((node, id) => {
            const nodeIndex = steps.findIndex(s => s.data.id === id);
            if (nodeIndex <= position) {
                node.element.style.opacity = '1';
                node.element.style.boxShadow = nodeIndex === position ? '0 0 10px 3px #FFEB3B' : '0 2px 5px rgba(0, 0, 0, 0.5)';
            } else {
                node.element.style.opacity = '0.3';
                node.element.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
            }
        });

        this.status.textContent = `⏰ Time Travel: Step ${position + 1} of ${steps.length}`;
        if (this.timeSlider) {
            this.timeSlider.value = (position / Math.max(1, steps.length - 1)) * 100;
        }
    }

    // --- DIAGNOSIS FUNCTIONALITY ---
    runDiagnosis() {
        this.status.textContent = '🧠 Running Automated Diagnosis...';
        this.diagnosisOutput.innerHTML = '<p style="color: #FFC107; padding: 5px; font-size: 12px;">Waiting for analysis results...</p>';
        this.sendMessageToInspectedWindow('RUN_DIAGNOSIS');
    }

    // --- TRACING CONTROL ---
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
        const diagnoseBtn = document.getElementById('runDiagnosis');

        if (startBtn && stopBtn && diagnoseBtn) {
            if (this.isTracing) {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                diagnoseBtn.disabled = false;
            } else {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                diagnoseBtn.disabled = (this.nodes.size === 0);
            }
        }
    }

    // In panel.js - Update the handleTracerData method:
handleTracerData(payload) {
    switch (payload.event) {
        case 'EXTENSION_READY':
            this.status.textContent = `✅ Glyph Ready | State: ${payload.data.stateManager} | Analyzer: ${payload.data.analyzer}`;
            break;
        case 'EXTENSION_WARNING':
            this.status.textContent = `⚠️ ${payload.data.message}`;
            break;
        case 'TRACING_SETUP':
            this.status.textContent = `🔮 Tracing Setup Complete`;
            break;
        case 'TRACER_READY':
            this.status.textContent = `🔮 Tracer Ready - Click "Start Tracing"`;
            break;
        case 'TRACING_STARTED':
            this.status.textContent = '🟢 Tracing Active - Executing operations...';
            break;
        case 'TRACING_STOPPED':
            this.status.textContent = '🟡 Tracing Paused';
            break;
        case 'NODE_ADDED':
            this.addNodeToGraph(payload.data);
            break;
        case 'CONNECTION_ADDED':
            this.addConnectionToGraph(payload.data);
            break;
        case 'DIAGNOSIS_STARTED':
            this.status.textContent = '🧠 Running Diagnosis...';
            break;
        case 'DIAGNOSIS_RESULT':
            this.displaySolutions(payload.data);
            this.status.textContent = `✅ Diagnosis: ${payload.data.length} issues found`;
            break;
        case 'DIAGNOSIS_ERROR':
            this.status.textContent = `❌ Diagnosis Failed: ${payload.data.error}`;
            break;
        case 'DEPENDENCY_ERROR':
            this.status.textContent = `⚠️ ${payload.data.component} Error: ${payload.data.error}`;
            break;
        case 'SNAPSHOT_ERROR':
            // Just log internally, don't show to user
            console.warn('Snapshot error:', payload.data.error);
            break;
    }

    this.updateStats();
    this.hideEmptyState();
    this.autoLayoutNodes();
}

    displaySolutions(diagnosisResults) {
        const output = this.diagnosisOutput;
        if (!output) return;

        output.innerHTML = '';

        if (diagnosisResults.length === 0) {
            output.innerHTML = '<p style="color: #4CAF50; padding: 5px; font-size: 12px;">✅ Automated analysis found no critical issues.</p>';
            return;
        }

        diagnosisResults.forEach((result, index) => {
            const diagElement = document.createElement('div');
            diagElement.className = 'diagnosis-item';
            diagElement.style.borderBottom = '1px dashed #404040';
            diagElement.style.padding = '5px';
            diagElement.style.marginBottom = '5px';

            diagElement.innerHTML = `
                <h4 style="color: #FFC107; margin-bottom: 5px; font-size: 14px;">[ISSUE ${index + 1}] ${result.type}</h4>
                <p style="margin-left: 10px; font-size: 0.9em;"><strong>Solution:</strong> ${result.solution}</p>
                <p style="font-size: 0.7em; margin-left: 10px; color: #9E9E9E;">Time: ${new Date(result.timestamp).toLocaleTimeString()}</p>
            `;
            output.appendChild(diagElement);
        });
    }

    // --- GRAPH MANIPULATION METHODS ---
    addNodeToGraph(nodeData) {
        if (this.nodes.has(nodeData.id)) return;

        const nodeElement = this.createNodeElement(nodeData);
        const nodeObj = { 
            element: nodeElement, 
            data: nodeData, 
            position: { x: Math.random() * 400, y: Math.random() * 300 } 
        };
        
        this.nodes.set(nodeData.id, nodeObj);
        this.executionGraph.appendChild(nodeElement);

        // Store in execution history for time travel
        this.executionHistory.push({
            type: 'NODE_ADDED',
            data: nodeData,
            timestamp: Date.now()
        });
    }

    createNodeElement(nodeData) {
        const style = this.getNodeStyle(nodeData.type);
        const node = document.createElement('div');
        node.id = nodeData.id;
        node.className = 'node';
        node.style.borderColor = style.borderColor;
        node.style.backgroundColor = style.backgroundColor + '60';
        node.style.left = `${Math.random() * 400}px`;
        node.style.top = `${Math.random() * 300}px`;

        node.innerHTML = `
            <div>${style.glyph} ${nodeData.label.substring(0, 30)}...</div>
            <div style="font-size: 10px; color: #d0d0d0; margin-top: 2px;">${new Date(nodeData.timestamp).toLocaleTimeString()}</div>
        `;

        this.makeDraggable(node);
        return node;
    }

    addConnectionToGraph(connData) {
        this.connections.push(connData);
        this.redrawAllConnections();

        // Store in execution history
        this.executionHistory.push({
            type: 'CONNECTION_ADDED',
            data: connData,
            timestamp: Date.now()
        });
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
        this.currentTimePosition = 0;
        this.executionHistory = [];
        
        if (this.diagnosisOutput) {
            this.diagnosisOutput.innerHTML = '<p style="font-size: 12px; color: #9e9e9e;">Click "🧠 Diagnose" to run the tracer analysis.</p>';
        }
    }

    inspectNode(nodeData) {
        const inspector = document.getElementById('glyphInspector');
        const content = document.getElementById('inspectorContent');
        inspector.style.display = 'flex';
        
        let propertiesHtml = '';
        for (const key in nodeData.properties) {
            propertiesHtml += `
                <h4>${key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                <pre>${JSON.stringify(nodeData.properties[key], null, 2)}</pre>
            `;
        }
        
        content.innerHTML = `
            <h3>${this.getNodeStyle(nodeData.type).glyph} ${nodeData.label}</h3>
            <p style="color: #9E9E9E; font-size: 12px;">ID: ${nodeData.id}</p>
            <p style="color: #9E9E9E; font-size: 12px;">Time: ${new Date(nodeData.timestamp).toLocaleString()}</p>
            ${propertiesHtml}
        `;
    }

    exportAsGlyph() {
        const nodes = Array.from(this.nodes.values()).map(n => ({
            id: n.data.id,
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

// Initialize when panel loads and expose globally for drag functionality
document.addEventListener('DOMContentLoaded', () => {
    window.glyphPanel = new GlyphDevToolsPanel();
});
