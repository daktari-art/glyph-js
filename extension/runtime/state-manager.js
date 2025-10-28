class GlyphStateManager {
    constructor() {
        this.stateTimeline = [];
        this.variableSnapshots = new Map();
        this.sourceMappings = new Map();
        this.currentExecutionId = null;
    }

    captureVariableSnapshot(executionId, context) {
        const snapshot = {
            timestamp: Date.now(),
            executionId: executionId,
            variables: this.safeExtractVariables(context),
            callStack: this.getCallStack(),
            sourceLocation: this.getSourceLocation()
        };

        this.variableSnapshots.set(executionId, snapshot);
        this.stateTimeline.push(snapshot);
        
        return executionId;
    }

    safeExtractVariables(context) {
        try {
            return {
                arguments: this.sanitizeData(context.arguments),
                localVars: this.extractLocalVariables(context),
                returnValue: this.sanitizeData(context.returnValue),
                thisContext: this.sanitizeData(context.thisValue)
            };
        } catch (error) {
            return { error: 'Cannot extract variables' };
        }
    }

    mapSourceLocation(nodeId, sourceInfo) {
        this.sourceMappings.set(nodeId, {
            file: sourceInfo.fileName,
            line: sourceInfo.lineNumber,
            column: sourceInfo.columnNumber,
            function: sourceInfo.functionName,
            stack: sourceInfo.stackTrace
        });
    }

    getSourceForNode(nodeId) {
        return this.sourceMappings.get(nodeId) || null;
    }

    getStateAtTime(timestamp) {
        return this.stateTimeline.find(state => 
            Math.abs(state.timestamp - timestamp) < 100
        );
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

    extractLocalVariables(context) {
        const locals = {};
        try {
            if (context.arguments) {
                locals.arguments = context.arguments;
            }
        } catch (error) {
            locals.error = error.message;
        }
        return locals;
    }

    getCallStack() {
        try {
            const stack = new Error().stack;
            return stack.split('\n').slice(2).map(line => line.trim());
        } catch {
            return [];
        }
    }

    getSourceLocation() {
        const stack = new Error().stack;
        const stackLines = stack.split('\n');
        if (stackLines.length > 2) {
            const callerLine = stackLines[2];
            return this.parseStackLine(callerLine);
        }
        return { fileName: 'unknown', lineNumber: 0, columnNumber: 0 };
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
}

window.glyphStateManager = new GlyphStateManager();
