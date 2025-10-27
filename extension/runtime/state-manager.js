class GlyphStateManager {
    constructor() {
        this.stateTimeline = [];
        this.variableSnapshots = new Map();
        this.sourceMappings = new Map();
        this.currentExecutionId = null;
    }

    // Capture variable state at execution points
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

    // Extract variables safely without exposing sensitive data
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

    // Source mapping for glyph nodes
    mapSourceLocation(nodeId, sourceInfo) {
        this.sourceMappings.set(nodeId, {
            file: sourceInfo.fileName,
            line: sourceInfo.lineNumber,
            column: sourceInfo.columnNumber,
            function: sourceInfo.functionName,
            stack: sourceInfo.stackTrace
        });
    }

    // Get source location for a glyph node
    getSourceForNode(nodeId) {
        return this.sourceMappings.get(nodeId) || null;
    }

    // Time-travel to previous state
    getStateAtTime(timestamp) {
        return this.stateTimeline.find(state => 
            Math.abs(state.timestamp - timestamp) < 100
        );
    }

    // Utility methods
    sanitizeData(data) {
        if (typeof data === 'object' && data !== null) {
            // Prevent circular references and large objects
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
        // This is a simplified version - in reality would need more context
        const locals = {};
        try {
            if (context.arguments) {
                locals.arguments = context.arguments;
            }
            // Could be enhanced with more sophisticated variable extraction
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
        // Skip the first line (this function) and get the caller
        if (stackLines.length > 2) {
            const callerLine = stackLines[2];
            return this.parseStackLine(callerLine);
        }
        return { fileName: 'unknown', lineNumber: 0, columnNumber: 0 };
    }

    parseStackLine(stackLine) {
        // Parse stack trace line to extract file, line, column
        const match = stackLine.match(/at (.+?) \((.+):(\d+):(\d+)\)/);
        if (match) {
            return {
                functionName: match[1],
                fileName: match[2],
                lineNumber: parseInt(match[3]),
                columnNumber: parseInt(match[4])
            };
        }
        return { fileName: 'unknown', lineNumber: 0, columnNumber: 0 };
    }
}

// Global instance
window.glyphStateManager = new GlyphStateManager();
