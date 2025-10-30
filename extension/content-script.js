// Glyph Language Tracer - Content Script
(function() {
    'use strict';
    
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
            this.stateManagerReady = false;
            this.analyzerReady = false;
            
            this.initializeTracing();
        }
        
        initializeTracing() {
            this.waitForDependencies().then(() => {
                this.setupTracing();
                this.sendToDevTools('EXTENSION_READY', { 
                    stateManager: this.stateManagerReady,
                    analyzer: this.analyzerReady 
                });
            }).catch(error => {
                this.sendToDevTools('EXTENSION_WARNING', { 
                    message: 'Some dependencies not available - starting basic tracing',
                    error: error.message 
                });
                this.setupTracing();
            });
        }
        
        waitForDependencies() {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 50;
                
                const checkDependencies = () => {
                    attempts++;
                    
                    if (window.GlyphStateManager && !window.glyphStateManager) {
                        try {
                            window.glyphStateManager = new window.GlyphStateManager();
                            this.stateManagerReady = true;
                        } catch (error) {
                            this.sendToDevTools('DEPENDENCY_ERROR', { 
                                component: 'StateManager',
                                error: error.message 
                            });
                        }
                    } else if (window.glyphStateManager) {
                        this.stateManagerReady = true;
                    }
                    
                    if (window.glyphAnalyzer) {
                        this.analyzerReady = true;
                    }
                    
                    if (this.stateManagerReady || attempts >= maxAttempts) {
                        resolve();
                    } else {
                        setTimeout(checkDependencies, 100);
                    }
                };
                
                checkDependencies();
            });
        }
        
        setupTracing() {
            this.sendToDevTools('TRACING_SETUP', { 
                stateManager: this.stateManagerReady, 
                analyzer: this.analyzerReady 
            });
            
            this.wrapAsyncOperations();
            this.catchErrors();
            
            window.glyphTracer = this;
            this.sendToDevTools('TRACER_READY', {});
        }
        
        wrapAsyncOperations() {
            // Wrap fetch
            const originalFetch = window.fetch;
            window.fetch = (...args) => {
                if (!this.isTracing) return originalFetch.apply(window, args);

                const fetchId = this.generateNodeId();
                const startTimestamp = Date.now();
                
                let snapshotId = null;
                if (this.stateManagerReady && window.glyphStateManager) {
                    try {
                        snapshotId = window.glyphStateManager.captureVariableSnapshot(
                            fetchId + '_start', 
                            { arguments: args, thisValue: this }
                        );
                    } catch (error) {
                        this.sendToDevTools('SNAPSHOT_ERROR', { error: error.message });
                    }
                }

                const node = {
                    id: fetchId,
                    type: '🔶',
                    label: `Fetch: ${this.safeString(args[0]).substring(0, 20)}`,
                    timestamp: startTimestamp,
                    properties: { 
                        method: (args[1] && args[1].method) || 'GET', 
                        url: this.safeString(args[0]),
                        snapshotId: snapshotId
                    }
                };
                this.addNode(node);
                this.sendToDevTools('NODE_ADDED', node);

                return originalFetch.apply(window, args)
                    .then(response => {
                        if (!this.isTracing) return response;
                        
                        const responseId = this.generateNodeId();
                        const responseNode = {
                            id: responseId,
                            type: response.ok ? '🟢' : '🟥',
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
                        this.sendToDevTools('CONNECTION_ADDED', { 
                            from: fetchId, 
                            to: responseId, 
                            type: response.ok ? "→" : "⚡" 
                        });
                        
                        return response;
                    })
                    .catch(error => {
                        if (!this.isTracing) throw error;
                        
                        const errorId = this.generateNodeId();
                        const errorNode = {
                            id: errorId,
                            type: '🟥',
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
                        this.sendToDevTools('CONNECTION_ADDED', { 
                            from: fetchId, 
                            to: errorId, 
                            type: "⚡" 
                        });
                        
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
                    type: '🎯',
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
                        type: '🔷',
                        label: 'Timer Callback Executed',
                        timestamp: Date.now(),
                        properties: { sourceTimer: timerId }
                    };
                    this.addNode(callbackNode);
                    this.sendToDevTools('NODE_ADDED', callbackNode);
                    
                    this.addConnection(timerId, callbackId, "→");
                    this.sendToDevTools('CONNECTION_ADDED', { 
                        from: timerId, 
                        to: callbackId, 
                        type: "→" 
                    });
                    
                    try {
                        return callback.apply(this, args);
                    } catch (error) {
                        this.handleRuntimeError(error, callbackId);
                        throw error;
                    }
                };

                return originalSetTimeout(wrappedCallback, delay, ...args);
            };
        }
        
        catchErrors() {
            window.addEventListener('error', (event) => {
                if (!this.isTracing) return;
                this.handleRuntimeError(
                    event.error || new Error(event.message), 
                    null, 
                    event.lineno, 
                    event.colno, 
                    event.filename
                );
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                if (!this.isTracing) return;
                this.handleRuntimeError(
                    event.reason || new Error("Unhandled Promise Rejection"), 
                    null, 
                    0, 
                    0, 
                    'promise'
                );
            });
        }
        
        handleRuntimeError(error, connectedNodeId = null, lineno = 0, colno = 0, filename = 'runtime') {
            const errorId = this.generateNodeId();
            const errorNode = {
                id: errorId,
                type: '🟥',
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
                this.sendToDevTools('CONNECTION_ADDED', { 
                    from: connectedNodeId, 
                    to: errorId, 
                    type: "⚡" 
                });
            }
        }
        
        safeString(value) {
            try {
                return String(value);
            } catch {
                return '[Unstringifiable]';
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
            try {
                // Send directly to DevTools panel, NOT to console
                window.postMessage({
                    type: 'GLYPH_TRACER_DATA',
                    payload: {
                        event: eventType,
                        data: data,
                        graph: this.executionGraph
                    }
                }, '*');
            } catch (error) {
                // Only log to console as last resort
                console.warn('🔮 Failed to send to DevTools:', error);
            }
        }
        
        runDiagnosis() {
            if (!this.analyzerReady || !window.glyphAnalyzer) {
                this.sendToDevTools('DIAGNOSIS_ERROR', { 
                    error: 'Analyzer not loaded',
                    suggestions: ['Check if analysis-utility.js loaded correctly']
                });
                return;
            }
            
            try {
                const results = window.glyphAnalyzer.analyzeTimeline();
                this.sendToDevTools('DIAGNOSIS_RESULT', results);
            } catch (error) {
                this.sendToDevTools('DIAGNOSIS_ERROR', { 
                    error: error.message,
                    suggestions: ['Diagnosis engine encountered an error']
                });
            }
        }
    }
    
    // Initialize the tracer
    const glyphTracer = new GlyphLanguageTracer();
    
    // Listen for messages from DevTools panel
    window.addEventListener('message', (event) => {
        if (event.data.type === 'GLYPH_COMMAND') {
            if (event.data.command === 'START_TRACING') {
                glyphTracer.isTracing = true;
                glyphTracer.sendToDevTools('TRACING_STARTED', {});
            } else if (event.data.command === 'STOP_TRACING') {
                glyphTracer.isTracing = false;
                glyphTracer.sendToDevTools('TRACING_STOPPED', {});
            } else if (event.data.command === 'RUN_DIAGNOSIS') {
                glyphTracer.sendToDevTools('DIAGNOSIS_STARTED', {});
                glyphTracer.runDiagnosis();
            }
        }
    });
    
})();
