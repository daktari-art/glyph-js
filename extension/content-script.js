// --- NEW, FULLY COMPLIANT content-script.js (with new symbols) ---
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
                if (!this.isTracing) return originalFetch.apply(this, args);
                
                const callId = this.generateNodeId();
                const sourceContext = this.captureSourceContext();
                
                // Use state manager if available
                if (window.glyphStateManager) {
                    window.glyphStateManager.mapSourceLocation(callId, sourceContext); 
                    window.glyphStateManager.captureVariableSnapshot(callId + '_start', {
                        arguments: args,
                        functionName: 'fetch'
                    });
                }
                
                const fetchNode = {
                    id: callId,
                    type: "🔶", // NEW: ASYNC_NODE Glyph
                    label: `fetch("${args[0]}")`,
                    timestamp: Date.now(),
                    properties: {
                        url: args[0],
                        method: args[1]?.method || 'GET',
                        source: sourceContext,
                        executionId: callId  
                    }
                };
                
                this.addNode(fetchNode);
                this.sendToDevTools('NODE_ADDED', fetchNode);
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        if (window.glyphStateManager) {
                            window.glyphStateManager.captureVariableSnapshot(callId + '_response', {
                                returnValue: response,
                                functionName: 'fetch'
                            });
                        }
                        
                        const successNode = {
                            id: this.generateNodeId(),
                            type: "🟢", // NEW: OUTPUT_NODE Glyph
                            label: `Response ${response.status}`,
                            timestamp: Date.now(),
                            properties: {
                                status: response.status,
                                ok: response.ok,
                                executionId: callId
                            }
                        };
                        
                        this.addNode(successNode);
                        this.addConnection(callId, successNode.id, "→"); // NEW: DATA_FLOW
                        this.sendToDevTools('NODE_ADDED', successNode);
                        this.sendToDevTools('CONNECTION_ADDED', { from: callId, to: successNode.id, type: "→" });
                        
                        return response;
                    })
                    .catch(error => {
                        if (window.glyphStateManager) {
                            window.glyphStateManager.captureVariableSnapshot(callId + '_error', {
                                error: error,
                                functionName: 'fetch'
                            });
                        }
                        
                        const errorNode = {
                            id: this.generateNodeId(),
                            type: "🟥", // NEW: ERROR_NODE Glyph
                            label: `Fetch Error: ${error.message}`,
                            timestamp: Date.now(),
                            properties: {
                                error: error.message,
                                executionId: callId
                            }
                        };
                        
                        this.addNode(errorNode);
                        this.addConnection(callId, errorNode.id, "⤵️"); // NEW: ERROR_FLOW
                        this.sendToDevTools('NODE_ADDED', errorNode);
                        this.sendToDevTools('CONNECTION_ADDED', { from: callId, to: errorNode.id, type: "⤵️" });

                        throw error;
                    });
            };
            
            this.wrapTimer('setTimeout');
            this.wrapTimer('setInterval');
        }
        
        wrapTimer(timerName) {
            const original = window[timerName];
            window[timerName] = (callback, delay, ...args) => {
                if (!this.isTracing) return original.apply(this, arguments);
                
                const callId = this.generateNodeId();
                const sourceContext = this.captureSourceContext();
                
                if (window.glyphStateManager) {
                    window.glyphStateManager.mapSourceLocation(callId, sourceContext);
                    window.glyphStateManager.captureVariableSnapshot(callId + '_setup', {
                        arguments: [delay, ...args],
                        functionName: timerName
                    });
                }
                
                const timerNode = {
                    id: callId,
                    type: "🔶", // NEW: ASYNC_NODE Glyph
                    label: `${timerName}(${delay}ms)`,
                    timestamp: Date.now(),
                    properties: {
                        delay: delay,
                        type: timerName,
                        source: sourceContext,
                        executionId: callId
                    }
                };
                
                this.addNode(timerNode);
                this.sendToDevTools('NODE_ADDED', timerNode);
                
                const wrappedCallback = (...cbArgs) => {
                    if (window.glyphStateManager) {
                        window.glyphStateManager.captureVariableSnapshot(callId + '_callback', {
                            arguments: cbArgs,
                            functionName: 'timerCallback'
                        });
                    }
                    
                    const resultNode = {
                        id: this.generateNodeId(),
                        type: "🟢", // NEW: OUTPUT_NODE Glyph
                        label: `Timer Executed`,
                        timestamp: Date.now(),
                        properties: {
                            executionId: callId
                        }
                    };
                    
                    this.addNode(resultNode);
                    this.addConnection(callId, resultNode.id, "→"); // NEW: DATA_FLOW
                    this.sendToDevTools('NODE_ADDED', resultNode);
                    this.sendToDevTools('CONNECTION_ADDED', { from: callId, to: resultNode.id, type: "→" });
                    
                    return callback.apply(this, cbArgs);
                };
                
                return original.call(this, wrappedCallback, delay, ...args);
            };
        }
        
        catchErrors() {
            // ... (Global error listeners using NEW: 🟥 Glyph)
            window.addEventListener('error', (event) => {
                if (!this.isTracing) return;
                
                const errorNode = {
                    id: this.generateNodeId(),
                    type: "🟥", // NEW: ERROR_NODE Glyph
                    label: `Global Error: ${event.message}`,
                    timestamp: Date.now(),
                    properties: {
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno
                    }
                };
                
                this.addNode(errorNode);
                this.sendToDevTools('NODE_ADDED', errorNode);
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                if (!this.isTracing) return;
                
                const errorNode = {
                    id: this.generateNodeId(),
                    type: "🟥", // NEW: ERROR_NODE Glyph
                    label: `Unhandled Promise: ${event.reason?.message || String(event.reason)}`,
                    timestamp: Date.now(),
                    properties: {
                        reason: event.reason?.message || String(event.reason)
                    }
                };
                
                this.addNode(errorNode);
                this.sendToDevTools('NODE_ADDED', errorNode);
            });
        }
        
        captureSourceContext() {
            // ... (Source context remains the same)
            try {
                const stack = new Error().stack;
                const stackLines = stack.split('\n');
                
                for (let i = 3; i < stackLines.length; i++) {
                    const sourceInfo = this.parseStackLine(stackLines[i]);
                    if (sourceInfo.fileName && !sourceInfo.fileName.includes('content-script.js')) {
                        return sourceInfo;
                    }
                }
            } catch (e) {
                // Fallback
            }
            
            return { fileName: 'unknown', lineNumber: 0, columnNumber: 0, functionName: 'anonymous' };
        }
        
        parseStackLine(stackLine) {
            // ... (Stack parsing remains the same)
            const match = stackLine.match(/at (.+?) \((.+):(\d+):(\d+)\)/);
            if (match) {
                return {
                    functionName: match[1],
                    fileName: match[2],
                    lineNumber: parseInt(match[3]),
                    columnNumber: parseInt(match[4])
                };
            }
            
            const anonMatch = stackLine.match(/at (.+):(\d+):(\d+)/);
            if (anonMatch) {
                return {
                    functionName: 'anonymous',
                    fileName: anonMatch[1],
                    lineNumber: parseInt(anonMatch[2]),
                    columnNumber: parseInt(anonMatch[3])
                };
            }
            
            return { fileName: 'unknown', lineNumber: 0, columnNumber: 0, functionName: 'anonymous' };
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
    
    // Listen for messages from DevTools panel (This is where the 'START_TRACING' command is received)
    window.addEventListener('message', (event) => {
        if (event.data.type === 'GLYPH_COMMAND') {
            if (event.data.command === 'START_TRACING') {
                glyphTracer.isTracing = true;
                console.log('🔮 Tracing started from DevTools');
            } else if (event.data.command === 'STOP_TRACING') {
                glyphTracer.isTracing = false;
                console.log('🔮 Tracing stopped from DevTools');
            }
        }
    });
    
})();
