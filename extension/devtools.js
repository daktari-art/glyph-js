// Create the Glyph Language panel in Chrome DevTools
chrome.devtools.panels.create(
    "Glyph Language", // Panel title
    "icons/icon16.png", // Icon (optional)
    "panel.html", // Panel content
    function(panel) {
        console.log('🔮 Glyph Language panel created in DevTools');
        
        // Panel shown
        panel.onShown.addListener(function(panelWindow) {
            console.log('🔮 Glyph Language panel shown');
        });
        
        // Panel hidden
        panel.onHidden.addListener(function() {
            console.log('🔮 Glyph Language panel hidden');
        });
    }
);
