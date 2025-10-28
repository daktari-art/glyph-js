// Background service worker for Glyph Language extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('🔮 Glyph Language DevTools extension installed');
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "glyph-devtools") {
        console.log('🔮 Glyph DevTools connected');
        
        port.onMessage.addListener((message) => {
            switch (message.type) {
                case 'START_TRACING':
                    startTracing(port);
                    break;
                case 'STOP_TRACING':
                    stopTracing(port);
                    break;
            }
        });
    }
});

let isTracing = false;

function startTracing(port) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            isTracing = true;
            port.postMessage({ 
                type: 'TRACING_STATE_CHANGED', 
                isTracing: true 
            });
            console.log('🔮 Tracing started');
        }
    });
}

function stopTracing(port) {
    isTracing = false;
    port.postMessage({ 
        type: 'TRACING_STATE_CHANGED', 
        isTracing: false 
    });
    console.log('🔮 Tracing stopped');
}
