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
        
        port.onDisconnect.addListener(() => {
            console.log('🔮 Glyph DevTools disconnected');
        });
    }
});

let isTracing = false;
let activeTabId = null;

function startTracing(port) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            activeTabId = tabs[0].id;
            isTracing = true;
            
            chrome.scripting.executeScript({
                target: { tabId: activeTabId },
                files: ['content-script.js']
            }).then(() => {
                console.log('🔮 Glyph tracer injected');
                port.postMessage({ 
                    type: 'TRACING_STATE_CHANGED', 
                    isTracing: true 
                });
            }).catch(err => {
                console.error('Failed to inject glyph tracer:', err);
            });
        }
    });
}

function stopTracing(port) {
    isTracing = false;
    port.postMessage({ 
        type: 'TRACING_STATE_CHANGED', 
        isTracing: false 
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GLYPH_TRACE_DATA') {
        if (isTracing) {
            chrome.runtime.sendMessage(message);
        }
    }
    return true;
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    if (isTracing) {
        activeTabId = activeInfo.tabId;
    }
});

console.log('🔮 Glyph Language Background Service Worker initialized');
