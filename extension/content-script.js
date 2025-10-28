// Glyph Language Tracer - Content Script
(function() {
    'use strict';
    
    console.log('🔮 Glyph Language Tracer loading...');
    
    class GlyphLanguageTracer {
        constructor() {
            this.executionGraph = {
                nodes: [],
                connections: [],
                metadata: {
                    language: "glyph-js-trace",
                    version: "1.0",
                    timestamp: Date.now()
                }
            };
            
            this.nodeIdCounter = 0;
            this.isTracing = false;
            this.setupTracing();
        }
        
        setupTracing() {
            // Check if state manager is available (via manifest.json injection)
            if (window.GlyphStateManager) {
                // Instantiate the global state manager if not already done
                window.glyphStateManager = window.glyphStateManager || new window.GlyphStateManager();
                console.log('🔮 State manager available - enhanced tracing enabled');
            } else {
                console.warn('🔮 State manager not available - basic tracing only');
            }
            
            this.wrapAsyncOperations();
            this.catchErrors();
            
            // Expose to window for DevTools panel
            window.glyphTracer = this;
            
            console.log('🔮 Glyph Language Tracer ready');
        }
        
        wrapAsyncOperations() {
            // Wrap fetch
            const originalFetch = window.fetch;
            window.fetch = (...args) => {
                if (!this.isTracing) return originalFetch.apply(window, args);

                const fetchId = this.generateNodeId();
                const startTimestamp = Date.now();
                
                // Create snapshot of arguments before call
                const snapshotId = window.glyphStateManager ? 
                    window.glyphStateManager.captureVariableSnapshot(fetchId + '_start', { arguments: args, thisValue: this }) : null;

                const node = {
                    id: fetchId,
                    type: '🔶', // Async Node
                    label: `Fetch: ${args[0].substring(0, 20)}`,
                    timestamp: startTimestamp,
                    properties: { 
                        method: (args[1] && args[1].method) || 'GET', 
                        url: args[0],
                        snapshotId: snapshotId
                    }
                };
                this.addNode(node);
                this.sendToDevTools('NODE_ADDED', node);

                // Call original fetch
                return originalFetch.apply(window, args)
                    .then(response => {
                        if (!this.isTracing) return response;
                        
                        const responseId = this.generateNodeId();
                        const responseNode = {
                            id: responseId,
                            type: response.ok ? '🟢' : '🟥', // Output or Error Node
                            label: `Response ${response.status}`,
                            timestamp: Date.now(),
                            properties: {
                                status: response.status,
                                statusText: response.statusText,
                                ok: response.ok
                            }
                        };
                        this.addNode(responseNode);
                        this.sendToDevTools('NODE_ADDED', responseNode);
                        
                        this.addConnection(fetchId, responseId, response.ok ? "→" : "⚡");
                        this.sendToDevTools('CONNECTION_ADDED', { from: fetchId, to: responseId, type: response.ok ? "→" : "⚡" });
                        
                        return response;
                    })
                    .catch(error => {
                        if (!this.isTracing) throw error;
                        
                        const errorId = this.generateNodeId();
                        const errorNode = {
                            id: errorId,
                            type: '🟥', // Error Node
                            label: `Fetch Error: ${error.message}`,
                            timestamp: Date.now(),
                            properties: {
                                message: error.message,
                                stack: error.stack
                            }
                        };
                        this.addNode(errorNode);
                        this.sendToDevTools('NODE_ADDED', errorNode);
                        
                        this.addConnection(fetchId, errorId, "⚡");
                        this.sendToDevTools('CONNECTION_ADDED', { from: fetchId, to: errorId, type: "⚡" });
                        
                        throw error;
                    });
            };

            // Wrap setTimeout
            const originalSetTimeout = window.setTimeout;
            window.setTimeout = (callback, delay, ...args) => {
                if (!this.isTracing) return originalSetTimeout(callback, delay, ...args);
                
                const timerId = this.generateNodeId();
                const node = {
                    id: timerId,
                    type: '🎯', // Event Node
                    label: `Timer Set: ${delay}ms`,
                    timestamp: Date.now(),
                    properties: { delay: delay }
                };
                this.addNode(node);
                this.sendToDevTools('NODE_ADDED', node);

                const wrappedCallback = () => {
                    const callbackId = this.generateNodeId();
                    const callbackNode = {
                        id: callbackId,
                        type: '🔷', // Function Node
                        label: 'Timer Callback Executed',
                        timestamp: Date.now(),
                        properties: { sourceTimer: timerId }
                    };
                    this.addNode(callbackNode);
                    this.sendToDevTools('NODE_ADDED', callbackNode);
                    
                    this.addConnection(timerId, callbackId, "→");
                    this.sendToDevTools('CONNECTION_ADDED', { from: timerId, to: callbackId, type: "→" });
                    
                    try {
                        callback.apply(this, args);
                    } catch (error) {
                        this.handleRuntimeError(error, callbackId);
                    }
                };

                return originalSetTimeout(wrappedCallback, delay, ...args);
            };
            
            // Note: window.setInterval would be wrapped similarly
        }
        
        catchErrors() {
            window.addEventListener('error', (event) => {
                if (!this.isTracing) return;
                this.handleRuntimeError(event.error || new Error(event.message), null, event.lineno, event.colno, event.filename);
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                if (!this.isTracing) return;
                this.handleRuntimeError(event.reason || new Error("Unhandled Promise Rejection"), null, 0, 0, 'promise');
            });
        }
        
        handleRuntimeError(error, connectedNodeId = null, lineno = 0, colno = 0, filename = 'runtime') {
            const errorId = this.generateNodeId();
            const errorNode = {
                id: errorId,
                type: '🟥', // Error Node
                label: `Runtime Error: ${error.message.substring(0, 30)}`,
                timestamp: Date.now(),
                properties: {
                    message: error.message,
                    stack: error.stack,
                    source: { filename, lineno, colno }
                }
            };
            this.addNode(errorNode);
            this.sendToDevTools('NODE_ADDED', errorNode);
            
            if (connectedNodeId) {
                this.addConnection(connectedNodeId, errorId, "⚡");
                this.sendToDevTools('CONNECTION_ADDED', { from: connectedNodeId, to: errorId, type: "⚡" });
            }
        }
        
        generateNodeId() {
            return `node_${this.nodeIdCounter++}_${Date.now()}`;
        }
        
        addNode(node) {
            this.executionGraph.nodes.push(node);
        }
        
        addConnection(fromId, toId, connectionType = "→") {
            this.executionGraph.connections.push({
                from: fromId,
                to: toId,
                type: connectionType
            });
        }
        
        sendToDevTools(eventType, data) {
            // Send to DevTools panel via window.postMessage
            window.postMessage({
                type: 'GLYPH_TRACER_DATA',
                payload: {
                    event: eventType,
                    data: data,
                    graph: this.executionGraph
                }
            }, '*');
        }
    }
    
    // Initialize the tracer
    const glyphTracer = new GlyphLanguageTracer();
    
    // Listen for messages from DevTools panel
    window.addEventListener('message', (event) => {
        if (event.data.type === 'GLYPH_COMMAND') {
            if (event.data.command === 'START_TRACING') {
                glyphTracer.isTracing = true;
                console.log('🔮 Tracing started from DevTools');
            } else if (event.data.command === 'STOP_TRACING') {
                glyphTracer.isTracing = false;
                console.log('🔮 Tracing stopped from DevTools');
            } else if (event.data.command === 'RUN_DIAGNOSIS') {
                // --- NEW: Command Handler for Automated Diagnosis ---
                if (window.glyphAnalyzer) {
                    console.log('🧠 Running Automated Diagnosis...');
                    const results = window.glyphAnalyzer.analyzeTimeline(); 

                    // Send results back to the DevTools panel
                    glyphTracer.sendToDevTools('DIAGNOSIS_RESULT', results);
                } else {
                    console.error('🧠 Diagnosis utility (glyphAnalyzer) not loaded. Cannot run diagnosis.');
                    // Send an error message back to the panel
                    glyphTracer.sendToDevTools('DIAGNOSIS_RESULT', [{ 
                        type: 'Initialization Error', 
                        solution: 'The automated analysis utility is missing. Please ensure the utility is properly loaded via manifest.json and check the console for details.', 
                        timestamp: Date.now() 
                    }]);
                }
            }
        }
    });
    
})();
