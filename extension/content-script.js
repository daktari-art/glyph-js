// Glyph Language Runtime Tracer - Bridges JavaScript to Glyph Visualizations
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
            this.setupTracing();
        }
        
        setupTracing() {
            // Core JavaScript to Glyph mapping
            this.wrapAsyncOperations();
            this.wrapFunctionCalls();
            this.catchErrors();
            this.interceptEvents();
            
            // Expose to page for debugging
            window.glyphTracer = this;
        }
        
        wrapAsyncOperations() {
            // Wrap fetch - represents as 🔄 ASYNC_NODE
            const originalFetch = window.fetch;
            window.fetch = (...args) => {
                const callId = this.generateNodeId();
                const fetchNode = {
                    id: callId,
                    type: "🔄",
                    label: `fetch("${args[0]}")`,
                    timestamp: Date.now(),
                    properties: {
                        url: args[0],
                        method: args[1]?.method || 'GET',
                        args: this.sanitizeArgs(args)
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
                        this.sendToDevTools('CONNECTION_ADDED', {
                            from: callId, 
                            to: successNode.id, 
                            type: "→"
                        });
                        
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
                        this.sendToDevTools('CONNECTION_ADDED', {
                            from: callId, 
                            to: errorNode.id, 
                            type: "⚡"
                        });
                        
                        throw error;
                    });
            };
            
            // Wrap setTimeout/setInterval - represents as 🔄 ASYNC_NODE
            this.wrapTimer('setTimeout');
            this.wrapTimer('setInterval');
            
            // Wrap Promises - represents as 🔄 ASYNC_NODE
            this.wrapPromise();
        }
        
        wrapTimer(timerName) {
            const original = window[timerName];
            window[timerName] = (callback, delay, ...args) => {
                const callId = this.generateNodeId();
                const timerNode = {
                    id: callId,
                    type: "🔄",
                    label: `${timerName}(${delay}ms)`,
                    timestamp: Date.now(),
                    properties: {
                        delay: delay,
                        type: timerName
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
                    this.sendToDevTools('CONNECTION_ADDED', {
                        from: callId, 
                        to: resultNode.id, 
                        type: "→"
                    });
                    
                    return callback.apply(this, cbArgs);
                };
                
                return original.call(this, wrappedCallback, delay, ...args);
            };
        }
        
        wrapPromise() {
            const originalThen = Promise.prototype.then;
            Promise.prototype.then = function(onFulfilled, onRejected) {
                const promiseId = this.__glyphId || this.generateNodeId();
                this.__glyphId = promiseId;
                
                const wrappedFulfilled = onFulfilled ? (result) => {
                    const resultNode = {
                        id: this.generateNodeId(),
                        type: "⤶",
                        label: `Promise Resolved`,
                        timestamp: Date.now(),
                        properties: {
                            result: this.sanitizeData(result)
                        }
                    };
                    
                    this.addNode(resultNode);
                    this.addConnection(promiseId, resultNode.id, "→");
                    this.sendToDevTools('NODE_ADDED', resultNode);
                    this.sendToDevTools('CONNECTION_ADDED', {
                        from: promiseId, 
                        to: resultNode.id, 
                        type: "→"
                    });
                    
                    return onFulfilled(result);
                } : onFulfilled;
                
                const wrappedRejected = onRejected ? (error) => {
                    const errorNode = {
                        id: this.generateNodeId(),
                        type: "⚡",
                        label: `Promise Rejected`,
                        timestamp: Date.now(),
                        properties: {
                            error: error.message
                        }
                    };
                    
                    this.addNode(errorNode);
                    this.addConnection(promiseId, errorNode.id, "⚡");
                    this.sendToDevTools('NODE_ADDED', errorNode);
                    this.sendToDevTools('CONNECTION_ADDED', {
                        from: promiseId, 
                        to: errorNode.id, 
                        type: "⚡"
                    });
                    
                    return onRejected(error);
                } : onRejected;
                
                return originalThen.call(this, wrappedFulfilled, wrappedRejected);
            };
        }
        
        wrapFunctionCalls() {
            // This is a simplified version - in production you'd want more targeted wrapping
            const originalQuerySelector = Document.prototype.querySelector;
            Document.prototype.querySelector = function(selector) {
                const callId = this.generateNodeId();
                const domNode = {
                    id: callId,
                    type: "▷",
                    label: `querySelector("${selector}")`,
                    timestamp: Date.now(),
                    properties: {
                        selector: selector,
                        type: 'DOM_QUERY'
                    }
                };
                
                this.addNode(domNode);
                this.sendToDevTools('NODE_ADDED', domNode);
                
                const result = originalQuerySelector.call(this, selector);
                
                if (result) {
                    const resultNode = {
                        id: this.generateNodeId(),
                        type: "○",
                        label: `DOM Element`,
                        timestamp: Date.now(),
                        properties: {
                            tagName: result.tagName,
                            found: true
                        }
                    };
                    
                    this.addNode(resultNode);
                    this.addConnection(callId, resultNode.id, "→");
                    this.sendToDevTools('NODE_ADDED', resultNode);
                    this.sendToDevTools('CONNECTION_ADDED', {
                        from: callId, 
                        to: resultNode.id, 
                        type: "→"
                    });
                }
                
                return result;
            };
        }
        
        catchErrors() {
            window.addEventListener('error', (event) => {
                const errorNode = {
                    id: this.generateNodeId(),
                    type: "⚡",
                    label: `Global Error`,
                    timestamp: Date.now(),
                    properties: {
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    }
                };
                
                this.addNode(errorNode);
                this.sendToDevTools('NODE_ADDED', errorNode);
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                const errorNode = {
                    id: this.generateNodeId(),
                    type: "⚡",
                    label: `Unhandled Promise`,
                    timestamp: Date.now(),
                    properties: {
                        reason: event.reason?.message || event.reason
                    }
                };
                
                this.addNode(errorNode);
                this.sendToDevTools('NODE_ADDED', errorNode);
            });
        }
        
        interceptEvents() {
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                const callId = this.generateNodeId();
                const eventNode = {
                    id: callId,
                    type: "⤵",
                    label: `Event: ${type}`,
                    timestamp: Date.now(),
                    properties: {
                        eventType: type,
                        target: this.constructor.name
                    }
                };
                
                this.addNode(eventNode);
                this.sendToDevTools('NODE_ADDED', eventNode);
                
                const wrappedListener = (event) => {
                    const executionNode = {
                        id: this.generateNodeId(),
                        type: "▷",
                        label: `Handle ${type}`,
                        timestamp: Date.now()
                    };
                    
                    this.addNode(executionNode);
                    this.addConnection(callId, executionNode.id, "→");
                    this.sendToDevTools('NODE_ADDED', executionNode);
                    this.sendToDevTools('CONNECTION_ADDED', {
                        from: callId, 
                        to: executionNode.id, 
                        type: "→"
                    });
                    
                    return listener.call(this, event);
                };
                
                return originalAddEventListener.call(this, type, wrappedListener, options);
            };
        }
        
        // Utility methods
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
        
        sanitizeArgs(args) {
            // Basic sanitization for sensitive data
            return args.map(arg => {
                if (typeof arg === 'string' && arg.length > 100) {
                    return arg.substring(0, 100) + '...';
                }
                return arg;
            });
        }
        
        sanitizeData(data) {
            // Prevent logging sensitive information
            if (typeof data === 'object' && data !== null) {
                return { type: typeof data, sanitized: true };
            }
            return data;
        }
        
        sendToDevTools(eventType, data) {
            // Send to background script which relays to devtools
            window.postMessage({
                type: 'GLYPH_TRACER_DATA',
                payload: {
                    event: eventType,
                    data: data,
                    graph: this.executionGraph
                }
            }, '*');
        }
        
        // Export current execution as Glyph Language format
        exportAsGlyph() {
            return {
                version: "1.0",
                program: "javascript-trace",
                nodes: this.executionGraph.nodes,
                connections: this.executionGraph.connections,
                metadata: {
                    exportedAt: new Date().toISOString(),
                    nodeCount: this.executionGraph.nodes.length,
                    connectionCount: this.executionGraph.connections.length
                }
            };
        }
    }
    
    // Initialize the tracer
    const glyphTracer = new GlyphLanguageTracer();
    
    // Expose export function to window
    window.exportGlyphTrace = () => glyphTracer.exportAsGlyph();
    
    console.log('🔮 Glyph Language Tracer initialized - Visualizing JavaScript execution as data flow');
})();
