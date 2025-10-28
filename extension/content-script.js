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
            console.log('🔮 Setting up Glyph tracing...');
            
            // Wrap async operations
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
                
                const fetchNode = {
                    id: callId,
                    type: "🔄",
                    label: `fetch("${args[0]}")`,
                    timestamp: Date.now(),
                    properties: {
                        url: args[0],
                        method: args[1]?.method || 'GET',
                        source: sourceContext
                    }
                };
                
                this.addNode(fetchNode);
                this.sendToDevTools('NODE_ADDED', fetchNode);
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        const successNode = {
                            id: this.generateNodeId(),
                            type: "⤶",
                            label: `Response ${response.status}`,
                            timestamp: Date.now(),
                            properties: {
                                status: response.status,
                                ok: response.ok
                            }
                        };
                        
                        this.addNode(successNode);
                        this.addConnection(callId, successNode.id, "→");
                        this.sendToDevTools('NODE_ADDED', successNode);
                        
                        return response;
                    })
                    .catch(error => {
                        const errorNode = {
                            id: this.generateNodeId(),
                            type: "⚡",
                            label: `Fetch Error`,
                            timestamp: Date.now(),
                            properties: {
                                error: error.message
                            }
                        };
                        
                        this.addNode(errorNode);
                        this.addConnection(callId, errorNode.id, "⚡");
                        this.sendToDevTools('NODE_ADDED', errorNode);
                        
                        throw error;
                    });
            };
            
            // Wrap setTimeout
            this.wrapTimer('setTimeout');
            this.wrapTimer('setInterval');
        }
        
        wrapTimer(timerName) {
            const original = window[timerName];
            window[timerName] = (callback, delay, ...args) => {
                if (!this.isTracing) return original.apply(this, arguments);
                
                const callId = this.generateNodeId();
                const sourceContext = this.captureSourceContext();
                
                const timerNode = {
                    id: callId,
                    type: "🔄",
                    label: `${timerName}(${delay}ms)`,
                    timestamp: Date.now(),
                    properties: {
                        delay: delay,
                        type: timerName,
                        source: sourceContext
                    }
                };
                
                this.addNode(timerNode);
                this.sendToDevTools('NODE_ADDED', timerNode);
                
                const wrappedCallback = (...cbArgs) => {
                    const resultNode = {
                        id: this.generateNodeId(),
                        type: "⤶",
                        label: `Timer Executed`,
                        timestamp: Date.now()
                    };
                    
                    this.addNode(resultNode);
                    this.addConnection(callId, resultNode.id, "→");
                    this.sendToDevTools('NODE_ADDED', resultNode);
                    
                    return callback.apply(this, cbArgs);
                };
                
                return original.call(this, wrappedCallback, delay, ...args);
            };
        }
        
        catchErrors() {
            window.addEventListener('error', (event) => {
                if (!this.isTracing) return;
                
                const errorNode = {
                    id: this.generateNodeId(),
                    type: "⚡",
                    label: `Error: ${event.message}`,
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
                    type: "⚡",
                    label: `Unhandled Promise`,
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
                // Fallback if stack parsing fails
            }
            
            return { fileName: 'unknown', lineNumber: 0, columnNumber: 0, functionName: 'anonymous' };
        }
        
        parseStackLine(stackLine) {
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
    
    // Listen for messages from DevTools panel
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
