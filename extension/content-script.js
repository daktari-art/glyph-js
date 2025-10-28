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
        this.wrapAsyncOperations();
        this.wrapFunctionCalls();
        this.catchErrors();
        this.interceptEvents();
        
        window.glyphTracer = this;
        console.log('🔮 Glyph Language Tracer initialized - Source mapping enabled');
    }
    
    wrapAsyncOperations() {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const callId = this.generateNodeId();
            const sourceContext = this.captureSourceContext();
            
            glyphStateManager.mapSourceLocation(callId, sourceContext);
            
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
                        label: `Fetch Error: ${error.message}`,
                        timestamp: Date.now(),
                        properties: {
                            error: error.message,
                            source: sourceContext
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
        
        this.wrapTimer('setTimeout');
        this.wrapTimer('setInterval');
        this.wrapPromise();
    }
    
    wrapTimer(timerName) {
        const original = window[timerName];
        window[timerName] = (callback, delay, ...args) => {
            const callId = this.generateNodeId();
            const sourceContext = this.captureSourceContext();
            
            glyphStateManager.mapSourceLocation(callId, sourceContext);
            
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
                const executionId = glyphStateManager.captureVariableSnapshot(callId + '_exec', {
                    arguments: cbArgs,
                    functionName: 'timerCallback'
                });
                
                const resultNode = {
                    id: this.generateNodeId(),
                    type: "⤶",
                    label: `Timer Executed`,
                    timestamp: Date.now(),
                    properties: {
                        executionId: executionId
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
            const sourceContext = this.captureSourceContext();
            
            glyphStateManager.mapSourceLocation(promiseId, sourceContext);
            
            const wrappedFulfilled = onFulfilled ? (result) => {
                const executionId = glyphStateManager.captureVariableSnapshot(promiseId + '_fulfill', {
                    returnValue: result,
                    functionName: 'thenHandler'
                });
                
                const resultNode = {
                    id: this.generateNodeId(),
                    type: "⤶",
                    label: `Promise Resolved`,
                    timestamp: Date.now(),
                    properties: {
                        result: this.sanitizeData(result),
                        executionId: executionId,
                        source: sourceContext
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
                const executionId = glyphStateManager.captureVariableSnapshot(promiseId + '_reject', {
                    error: error,
                    functionName: 'catchHandler'
                });
                
                const errorNode = {
                    id: this.generateNodeId(),
                    type: "⚡",
                    label: `Promise Rejected: ${error.message}`,
                    timestamp: Date.now(),
                    properties: {
                        error: error.message,
                        executionId: executionId,
                        source: sourceContext
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
        const originalQuerySelector = Document.prototype.querySelector;
        Document.prototype.querySelector = this.wrapFunctionWithSource(
            originalQuerySelector, 
            'querySelector'
        );

        const originalAddEventListener = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = this.wrapFunctionWithSource(
            originalAddEventListener,
            'addEventListener'
        );
    }
    
    wrapFunctionWithSource(original, functionName) {
        const tracer = this;
        
        return function(...args) {
            if (!tracer.isTracing) return original.apply(this, args);
            
            const callId = tracer.generateNodeId();
            const sourceContext = tracer.captureSourceContext();
            
            const executionId = glyphStateManager.captureVariableSnapshot(callId, {
                arguments: args,
                thisValue: this,
                functionName: functionName
            });
            
            glyphStateManager.mapSourceLocation(callId, sourceContext);
            
            const functionNode = {
                id: callId,
                type: "▷",
                label: `${functionName}(${tracer.safeStringifyArgs(args)})`,
                timestamp: Date.now(),
                properties: {
                    name: functionName,
                    source: sourceContext,
                    executionId: executionId
                }
            };
            
            tracer.addNode(functionNode);
            tracer.sendToDevTools('NODE_ADDED', functionNode);
            
            try {
                const result = original.apply(this, args);
                
                glyphStateManager.captureVariableSnapshot(callId + '_return', {
                    returnValue: result,
                    functionName: functionName
                });
                
                const resultNode = {
                    id: tracer.generateNodeId(),
                    type: "⤶",
                    label: `Return: ${tracer.safeStringify(result)}`,
                    timestamp: Date.now(),
                    properties: {
                        value: tracer.sanitizeData(result),
                        executionId: executionId
                    }
                };
                
                tracer.addNode(resultNode);
                tracer.addConnection(callId, resultNode.id, "→");
                tracer.sendToDevTools('NODE_ADDED', resultNode);
                tracer.sendToDevTools('CONNECTION_ADDED', {
                    from: callId, 
                    to: resultNode.id, 
                    type: "→"
                });
                
                return result;
            } catch (error) {
                const errorNode = {
                    id: tracer.generateNodeId(),
                    type: "⚡",
                    label: `Error: ${error.message}`,
                    timestamp: Date.now(),
                    properties: {
                        error: error.message,
                        stack: error.stack,
                        executionId: executionId,
                        source: sourceContext
                    }
                };
                
                tracer.addNode(errorNode);
                tracer.addConnection(callId, errorNode.id, "⚡");
                tracer.sendToDevTools('NODE_ADDED', errorNode);
                tracer.sendToDevTools('CONNECTION_ADDED', {
                    from: callId, 
                    to: errorNode.id, 
                    type: "⚡"
                });
                
                throw error;
            }
        };
    }
    
    catchErrors() {
        window.addEventListener('error', (event) => {
            const errorNode = {
                id: this.generateNodeId(),
                type: "⚡",
                label: `Global Error: ${event.message}`,
                timestamp: Date.now(),
                properties: {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack
                }
            };
            
            this.addNode(errorNode);
            this.sendToDevTools('NODE_ADDED', errorNode);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            const errorNode = {
                id: this.generateNodeId(),
                type: "⚡",
                label: `Unhandled Promise: ${event.reason?.message || event.reason}`,
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
        EventTarget.prototype.addEventListener = this.wrapFunctionWithSource(
            originalAddEventListener,
            'addEventListener'
        );
    }
    
    captureSourceContext() {
        const stack = new Error().stack;
        const stackLines = stack.split('\n');
        
        for (let i = 3; i < stackLines.length; i++) {
            const sourceInfo = this.parseStackLine(stackLines[i]);
            if (sourceInfo.fileName && !sourceInfo.fileName.includes('content-script.js')) {
                return sourceInfo;
            }
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
    
    safeStringifyArgs(args) {
        return args.map(arg => this.safeStringify(arg)).join(', ');
    }
    
    safeStringify(value) {
        try {
            if (value === undefined) return 'undefined';
            if (value === null) return 'null';
            if (typeof value === 'string') return `"${value.substring(0, 30)}"`;
            if (typeof value === 'object') {
                const str = JSON.stringify(value);
                return str.length > 30 ? str.substring(0, 30) + '...' : str;
            }
            return String(value);
        } catch {
            return typeof value;
        }
    }
    
    sanitizeData(data) {
        if (typeof data === 'object' && data !== null) {
            try {
                return JSON.parse(JSON.stringify(data, (key, value) => {
                    if (value && typeof value === 'object') {
                        return { type: value.constructor.name, sanitized: true };
                    }
                    return value;
                }));
            } catch {
                return { type: typeof data, sanitized: true };
            }
        }
        return data;
    }
    
    sendToDevTools(eventType, data) {
        window.postMessage({
            type: 'GLYPH_TRACER_DATA',
            payload: {
                event: eventType,
                data: data,
                graph: this.executionGraph
            }
        }, '*');
    }
    
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

const glyphTracer = new GlyphLanguageTracer();
window.exportGlyphTrace = () => glyphTracer.exportAsGlyph();
