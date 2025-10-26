// Glyph.js Content Script - Function Interception
console.log('🔮 Glyph.js content script loaded!');

// Store intercepted function calls
const functionCalls = [];

// Basic function interceptor
function interceptFunction(originalFunction, functionName) {
    return function(...args) {
        const callId = Date.now() + Math.random();
        
        // Capture call data
        const callData = {
            id: callId,
            name: functionName,
            args: JSON.parse(JSON.stringify(args)), // Simple deep copy
            timestamp: Date.now(),
            status: 'started'
        };
        
        functionCalls.push(callData);
        
        // Send to Glyph devtools
        window.postMessage({
            type: 'GLYPH_FUNCTION_CALL',
            data: callData
        }, '*');
        
        try {
            // Call original function
            const result = originalFunction.apply(this, args);
            
            // Capture successful result
            callData.status = 'completed';
            callData.result = result;
            
            // Send completion
            window.postMessage({
                type: 'GLYPH_FUNCTION_RESULT', 
                data: callData
            }, '*');
            
            return result;
            
        } catch (error) {
            // Capture error
            callData.status = 'errored';
            callData.error = error.message;
            
            window.postMessage({
                type: 'GLYPH_FUNCTION_ERROR',
                data: callData
            }, '*');
            
            throw error;
        }
    };
}

// Intercept console.log as a test
const originalLog = console.log;
console.log = interceptFunction(originalLog, 'console.log');

// Listen for messages from devtools
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'GLYPH_GET_CALLS') {
        // Send all captured calls to devtools
        window.postMessage({
            type: 'GLYPH_ALL_CALLS',
            data: functionCalls
        }, '*');
    }
});

console.log('Glyph.js is now monitoring function calls!');
