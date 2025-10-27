// glyph-js/extension/background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GLYPH_TRACE_UPDATE') {
        chrome.runtime.sendMessage(request);
    }
});

chrome.runtime.onConnect.addListener((port) => {
    console.log('🔮 Glyph: Background connected', port.name);
});
