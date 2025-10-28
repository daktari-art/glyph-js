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
            // Legacy symbols for compatibility
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
    // --- END OF HELPERS ---

    initializeUI() {
        this.executionGraph = document.getElementById('executionGraph');
        this.glyphCanvas = document.getElementById('glyphCanvas');
        this.emptyState = document.getElementById('emptyState');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        // NEW: Add reference to the diagnosis output area
        this.diagnosisOutput = document.getElementById('diagnosisOutput'); 

        this.updateStats();
        // Assuming addArrowMarker exists, or will be added later
    }

    setupMessageHandling() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GLYPH_TRACER_DATA') {
                this.handleTracerData(event.data.payload);
            }
        });
    }

    // --- CENTRALIZED COMMAND SENDER ---
    sendMessageToInspectedWindow(command) {
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

        // NEW: Diagnosis Button Listener
        const diagnoseBtn = document.getElementById('runDiagnosis');
        if (diagnoseBtn) {
            diagnoseBtn.addEventListener('click', () => {
                this.runDiagnosis();
            });
        }
    }

    // NEW: Diagnosis Method
    runDiagnosis() {
        this.status.textContent = '🧠 Running Automated Diagnosis...';
        this.diagnosisOutput.innerHTML = '<p style="color: #FFC107; padding: 5px; font-size: 12px;">Waiting for analysis results...</p>';
        // Send the command that the content script and Analyzer Utility will listen for.
        this.sendMessageToInspectedWindow('RUN_DIAGNOSIS');
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

    handleTracerData(payload) {
        switch (payload.event) {
            case 'NODE_ADDED':
                this.addNodeToGraph(payload.data);
                break;
            case 'CONNECTION_ADDED':
                this.addConnectionToGraph(payload.data);
                break;
            // NEW: Handle the diagnosis result sent from the content script
            case 'DIAGNOSIS_RESULT':
                this.displaySolutions(payload.data);
                this.status.textContent = `✅ Diagnosis complete. ${payload.data.length} potential issues found.`;
                break;
        }

        this.updateStats();
        this.hideEmptyState();
        // Assuming autoLayoutNodes exists, or will be added later
    }

    // NEW: Display Solutions Method
    displaySolutions(diagnosisResults) {
        const output = this.diagnosisOutput;
        if (!output) return;

        output.innerHTML = ''; // Clear previous results

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

            // Assuming result structure: { type, solution, timestamp }
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
        this.nodes.set(nodeData.id, { element: nodeElement, data: nodeData, position: { x: 0, y: 0 } });
        this.executionGraph.appendChild(nodeElement);

        // Placeholder for layout function
        // this.autoLayoutNodes(); 
    }

    createNodeElement(nodeData) {
        const style = this.getNodeStyle(nodeData.type);
        const node = document.createElement('div');
        node.id = nodeData.id;
        node.className = 'node';
        node.style.borderColor = style.borderColor;
        node.style.backgroundColor = style.backgroundColor + '60'; // Semi-transparent background

        node.innerHTML = `
            <div>${style.glyph} ${nodeData.label.substring(0, 30)}...</div>
            <div style="font-size: 10px; color: #d0d0d0; margin-top: 2px;">${new Date(nodeData.timestamp).toLocaleTimeString()}</div>
        `;

        // Assuming makeDraggable is defined elsewhere or will be added
        // this.makeDraggable(node); 
        return node;
    }

    addConnectionToGraph(connData) {
        this.connections.push(connData);
        // Assuming redrawAllConnections is defined elsewhere or will be added
        // this.redrawAllConnections(); 
    }

    clearGraph() {
        this.nodes.forEach(node => node.element.remove());
        this.nodes.clear();
        this.connections = [];
        // Assuming redrawAllConnections exists...
        this.showEmptyState();
        this.updateStats();
        document.getElementById('glyphInspector').style.display = 'none';
        this.status.textContent = 'Graph Cleared.';
        
        // Clear diagnosis output on clear
        if (this.diagnosisOutput) {
            this.diagnosisOutput.innerHTML = '<p style="font-size: 12px; color: #9e9e9e;">Click "🧠 Diagnose" to run the tracer analysis.</p>';
        }
    }

    inspectNode(nodeData) {
        const inspector = document.getElementById('glyphInspector');
        const content = document.getElementById('inspectorContent');
        inspector.style.display = 'flex';
        
        // Format properties for display
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
