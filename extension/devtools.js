// Glyph.js DevTools Panel
console.log('🎨 Glyph.js devtools panel loaded!');

const functionList = document.getElementById('functionList');
let functionCalls = [];

// Listen for function calls from content script
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'GLYPH_FUNCTION_CALL':
            addFunctionCall(data);
            break;
        case 'GLYPH_FUNCTION_RESULT':
            updateFunctionCall(data.id, 'completed', data.result);
            break;
        case 'GLYPH_FUNCTION_ERROR':
            updateFunctionCall(data.id, 'errored', null, data.error);
            break;
    }
});

function addFunctionCall(callData) {
    functionCalls.push(callData);
    renderFunctionCalls();
}

function updateFunctionCall(id, status, result, error) {
    const call = functionCalls.find(c => c.id === id);
    if (call) {
        call.status = status;
        call.result = result;
        call.error = error;
        renderFunctionCalls();
    }
}

function renderFunctionCalls() {
    if (functionCalls.length === 0) {
        functionList.innerHTML = `
            <div class="empty-state">
                No function calls yet...<br>
                <small>Interact with the webpage to see function calls</small>
            </div>
        `;
        return;
    }

    functionList.innerHTML = functionCalls.map(call => `
        <div class="function-call">
            <div>
                <span class="function-name">${call.name}()</span>
                <span class="function-status status-${call.status}">
                    ${getStatusIcon(call.status)} ${call.status}
                </span>
            </div>
            <div class="function-args">
                Args: ${JSON.stringify(call.args).slice(0, 100)}...
                ${call.result ? `<br>Result: ${JSON.stringify(call.result).slice(0, 100)}...` : ''}
                ${call.error ? `<br>Error: ${call.error}` : ''}
            </div>
        </div>
    `).join('');
}

function getStatusIcon(status) {
    const icons = {
        'started': '🔄',
        'completed': '✅', 
        'errored': '❌'
    };
    return icons[status] || '⚪';
}

// Request existing function calls when panel opens
window.postMessage({ type: 'GLYPH_GET_CALLS' }, '*');

console.log('🔮 Glyph.js devtools ready! Open console and run some functions to test.');
