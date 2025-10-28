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
            
            // Check if state manager is available
            if (window.glyphStateManager) {
                console.log('🔮 State manager available - enhanced tracing enabled');
            } else {
                console.warn('🔮 State manager not available - basic tracing only');
            }
            
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
                    type: "🔄",
                    label: `fetch("${args[0]}")`,
                    timestamp: Date.now(),
                    properties: {
                        url: args[0],
                        method: args[1]?.method || 'GET',
                        source: sourceContext,
                        executionId: callId  // For state manager lookup
                    }
                };
                
                this.addNode(fetchNode);
                this.sendToDevTools('NODE_ADDED', fetchNode);
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        // Use state manager if available
                        if (window.glyphStateManager) {
                            window.glyphStateManager.captureVariableSnapshot(callId + '_response', {
                                returnValue: response,
                                functionName: 'fetch'
                            });
                        }
                        
                        const successNode = {
                            id: this.generateNodeId(),
                            type: "⤶",
                            label: `Response ${response.status}`,
                            timestamp: Date.now(),
                            properties: {
                                status: response.status,
                                ok: response.ok,
                                executionId: callId
                            }
                        };
                        
                        this.addNode(successNode);
                        this.addConnection(callId, successNode.id, "→");
                        this.sendToDevTools('NODE_ADDED', successNode);
                        
                        return response;
                    })
                    .catch(error => {
                        // Use state manager if available
                        if (window.glyphStateManager) {
                            window.glyphStateManager.captureVariableSnapshot(callId + '_error', {
                                error: error,
                                functionName: 'fetch'
                            });
                        }
                        
                        const errorNode = {
                            id: this.generateNodeId(),
                            type: "⚡",
                            label: `Fetch Error: ${error.message}`,
                            timestamp: Date.now(),
                            properties: {
                                error: error.message,
                                executionId: callId
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
                
                // Use state manager if available
                if (window.glyphStateManager) {
                    window.glyphStateManager.mapSourceLocation(callId, sourceContext);
                    window.glyphStateManager.captureVariableSnapshot(callId + '_setup', {
                        arguments: [delay, ...args],
                        functionName: timerName
                    });
                }
                
                const timerNode = {
                    id: callId,
                    type: "🔄",
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
                    // Use state manager if available
                    if (window.glyphStateManager) {
                        window.glyphStateManager.captureVariableSnapshot(callId + '_callback', {
                            arguments: cbArgs,
                            functionName: 'timerCallback'
                        });
                    }
                    
                    const resultNode = {
                        id: this.generateNodeId(),
                        type: "⤶",
                        label: `Timer Executed`,
                        timestamp: Date.now(),
                        properties: {
                            executionId: callId
                        }
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
        
        // --- New Tracing Methods for Generic Functions ---

        /**
         * Determines the correct Glyph symbol for a given data type.
         * @param {any} data - The data value.
         * @returns {string} The appropriate Glyph symbol.
         */
        getGlyphForData(data) {
            const type = typeof data;
            if (Array.isArray(data)) return "△"; // LIST_NODE
            if (type === 'boolean') return "◇"; // BOOL_NODE
            if (type === 'string') return "□";  // TEXT_NODE
            return "○"; // DATA_NODE (default for numbers/objects)
        }

        /**
         * Marks the beginning of a traced function call.
         * Creates the input data nodes and the function node.
         * @param {string} functionName - The name of the function being called.
         * @param {Array<any>} args - The arguments passed to the function.
         * @returns {{functionNodeId: string, inputNodeIds: Array<string>}} IDs for the function and input nodes.
         */
        traceFunctionStart(functionName, args) {
            if (!this.isTracing || !window.glyphStateManager) {
                return { functionNodeId: null, inputNodeIds: [] };
            }

            // 1. Capture the state and source location before execution
            const sourceContext = this.captureSourceContext();
            
            // Use a unique execution ID for the state manager
            const executionId = window.glyphStateManager.captureVariableSnapshot(this.generateNodeId(), { 
                arguments: args, 
                functionName: functionName,
                thisValue: this 
            });
            
            // 2. Create the FUNCTION_NODE (▷)
            const functionNodeId = this.generateNodeId();
            const functionNode = {
                id: functionNodeId,
                type: "▷", // FUNCTION_NODE
                label: functionName,
                timestamp: Date.now(),
                properties: {
                    source: sourceContext,
                    executionId: executionId,  // For state manager lookup
                    type: 'function_call'
                }
            };
            this.addNode(functionNode);
            window.glyphStateManager.mapSourceLocation(functionNodeId, sourceContext);

            const inputNodeIds = [];

            // 3. Create DATA_NODE for each argument (Input Data Flow)
            args.forEach((arg, index) => {
                const inputNodeId = this.generateNodeId();
                const nodeGlyph = this.getGlyphForData(arg);
                
                const label = (typeof arg !== 'object' || arg === null) 
                    ? String(arg).substring(0, 15) : (Array.isArray(arg) ? 'List' : 'Data');

                const inputNode = {
                    id: inputNodeId,
                    type: nodeGlyph, 
                    label: `Input ${index} (${label})`,
                    timestamp: Date.now(),
                    properties: { 
                        value: window.glyphStateManager.sanitizeData(arg),
                        executionId: executionId,
                        port: `input_${index}`
                    }
                };
                this.addNode(inputNode);
                this.sendToDevTools('NODE_ADDED', inputNode);
                
                // Connect Input Node to Function Node (→)
                this.addConnection(inputNodeId, functionNodeId, "→");
                this.sendToDevTools('CONNECTION_ADDED', { from: inputNodeId, to: functionNodeId, type: "→" });
                inputNodeIds.push(inputNodeId);
            });

            this.sendToDevTools('NODE_ADDED', functionNode);
            
            return { functionNodeId, inputNodeIds };
        }

        /**
         * Marks the successful end of a traced function call.
         * Creates the output data node and connects it to the function node.
         * @param {string} functionNodeId - The ID of the function node created in traceFunctionStart.
         * @param {any} result - The return value of the function.
         */
        traceFunctionEnd(functionNodeId, result) {
            if (!this.isTracing || !window.glyphStateManager || !functionNodeId) {
                return;
            }
            
            // 1. Capture the final state (return value)
            window.glyphStateManager.captureVariableSnapshot(functionNodeId + '_end', { 
                returnValue: result 
            });

            // 2. Create the DATA_NODE for the result (Output Data Flow)
            const resultNodeId = this.generateNodeId();
            const resultGlyph = this.getGlyphForData(result);
            
            const resultNode = {
                id: resultNodeId,
                type: resultGlyph,
                label: "Result",
                timestamp: Date.now(),
                properties: { 
                    value: window.glyphStateManager.sanitizeData(result), 
                    type: typeof result,
                    port: 'return'
                }
            };
            this.addNode(resultNode);
            this.sendToDevTools('NODE_ADDED', resultNode);
            
            // 3. Connect Function Node to Result Node (→)
            this.addConnection(functionNodeId, resultNodeId, "→");
            this.sendToDevTools('CONNECTION_ADDED', { from: functionNodeId, to: resultNodeId, type: "→" });
        }

        /**
         * Marks a function error (similar to catchErrors, but attached to a specific function node).
         * Creates an error node and connects it with the error flow (⚡).
         * @param {string} functionNodeId - The ID of the function node.
         * @param {Error} error - The error object thrown.
         */
        traceFunctionError(functionNodeId, error) {
            if (!this.isTracing || !functionNodeId) return;

            // 1. Capture the error state
            window.glyphStateManager.captureVariableSnapshot(functionNodeId + '_error', { 
                error: error
            });

            // 2. Create the ERROR_NODE (⚡)
            const errorNodeId = this.generateNodeId();
            const errorNode = {
                id: errorNodeId,
                type: "⚡", // ERROR_NODE
                label: `Function Error: ${error.message}`,
                timestamp: Date.now(),
                properties: {
                    error: error.message,
                    stack: error.stack,
                    port: 'error'
                }
            };
            this.addNode(errorNode);
            this.sendToDevTools('NODE_ADDED', errorNode);

            // 3. Connect Function Node to Error Node using ERROR_FLOW (⚡)
            this.addConnection(functionNodeId, errorNodeId, "⚡");
            this.sendToDevTools('CONNECTION_ADDED', { from: functionNodeId, to: errorNodeId, type: "⚡" });
        }
        
        // --- End of New Tracing Methods ---
        
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
