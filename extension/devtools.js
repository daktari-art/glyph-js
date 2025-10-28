// Create the Glyph Language panel in Chrome DevTools
chrome.devtools.panels.create(
    "Glyph Language", 
    "/icons/icon16.png", 
    "panel.html",
    function(panel) {
        console.log('🔮 Glyph Language panel created successfully!');
        
        panel.onShown.addListener(function(panelWindow) {
            console.log('🔮 Glyph Language panel shown');
        });
        
        panel.onHidden.addListener(function() {
            console.log('🔮 Glyph Language panel hidden');
        });
    }
);
