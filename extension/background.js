// Glyph Language Extension - Background Service Worker
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
            
            // Inject content script if not already injected
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

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GLYPH_TRACE_DATA') {
        // Relay to devtools if tracing is active
        if (isTracing) {
            chrome.runtime.sendMessage(message);
        }
    }
    return true;
});

// Track tab changes to maintain tracing state
chrome.tabs.onActivated.addListener((activeInfo) => {
    if (isTracing) {
        activeTabId = activeInfo.tabId;
        // Re-inject content script on tab change if needed
    }
});

console.log('🔮 Glyph Language Background Service Worker initialized');
