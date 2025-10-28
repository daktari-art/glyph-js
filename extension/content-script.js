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
            this.stateManagerReady = false;
            this.analyzerReady = false;
            
            this.initializeTracing();
        }
        
        initializeTracing() {
            // Wait for dependencies to load
            this.waitForDependencies().then(() => {
                this.setupTracing();
            }).catch(error => {
                console.warn('🔮 Some dependencies not available - starting basic tracing:', error);
                this.setupTracing();
            });
        }
        
        waitForDependencies() {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 50; // 5 seconds max wait
                
                const checkDependencies = () => {
                    attempts++;
                    
                    // Check state manager
                    if (window.GlyphStateManager && !window.glyphStateManager) {
                        try {
                            window.glyphStateManager = new window.GlyphStateManager();
                            this.stateManagerReady = true;
                            console.log('🔮 State manager initialized');
                        } catch (error) {
                            console.error('🔮 Failed to initialize state manager:', error);
                        }
                    } else if (window.glyphStateManager) {
                        this.stateManagerReady = true;
                    }
                    
                    // Check analyzer
                    if (window.glyphAnalyzer) {
                        this.analyzerReady = true;
                        console.log('🔮 Analyzer available');
                    }
                    
                    // Resolve if we have at least state manager or after max attempts
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
            console.log(`🔮 Tracing setup - State Manager: ${this.stateManagerReady}, Analyzer: ${this.analyzerReady}`);
            
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
                
                // SAFE snapshot capture
                let snapshotId = null;
                if (this.stateManagerReady && window.glyphStateManager) {
                    try {
                        snapshotId = window.glyphStateManager.captureVariableSnapshot(
                            fetchId + '_start', 
                            { arguments: args, thisValue: this }
                        );
                    } catch (error) {
                        console.warn('🔮 Failed to capture snapshot:', error);
                    }
                }

                const node = {
                    id: fetchId,
                    type: '🔶', // Async Node
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
                window.postMessage({
                    type: 'GLYPH_TRACER_DATA',
                    payload: {
                        event: eventType,
                        data: data,
                        graph: this.executionGraph
                    }
                }, '*');
            } catch (error) {
                console.warn('🔮 Failed to send to DevTools:', error);
            }
        }
        
        // SAFE diagnosis runner
        runDiagnosis() {
            if (!this.analyzerReady || !window.glyphAnalyzer) {
                console.error('🔮 Analyzer not available for diagnosis');
                return {
                    error: 'Analyzer not loaded',
                    suggestions: ['Check if analysis-utility.js loaded correctly']
                };
            }
            
            try {
                return window.glyphAnalyzer.analyzeTimeline();
            } catch (error) {
                console.error('🔮 Diagnosis failed:', error);
                return {
                    error: error.message,
                    suggestions: ['Diagnosis engine encountered an error']
                };
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
                console.log('🔮 Tracing started from DevTools');
            } else if (event.data.command === 'STOP_TRACING') {
                glyphTracer.isTracing = false;
                console.log('🔮 Tracing stopped from DevTools');
            } else if (event.data.command === 'RUN_DIAGNOSIS') {
                console.log('🧠 Running Automated Diagnosis...');
                const results = glyphTracer.runDiagnosis();
                
                // Send results back to DevTools
                glyphTracer.sendToDevTools('DIAGNOSIS_RESULT', results);
            }
        }
    });
    
})();
