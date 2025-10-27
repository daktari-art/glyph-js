// glyph-js/extension/devtools.js
class GlyphDevTools {
    constructor() {
        this.isConnected = false;
        this.traceData = [];
        this.panelWindow = null;
        this.reconnectAttempts = 0;
        
        this.init();
    }

    init() {
        this.createDevToolsPanel();
        this.setupMessageHandlers();
    }

    createDevToolsPanel() {
        chrome.devtools.panels.create(
            "Glyph", 
            "", 
            "devtools.html", 
            (panel) => {
                panel.onShown.addListener((panelWindow) => {
                    this.panelWindow = panelWindow;
                    this.onPanelShown();
                });

                panel.onHidden.addListener(() => {
                    this.onPanelHidden();
                });
            }
        );
    }

    onPanelShown() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        this.startTracing();
        this.sendInitialState();
        
        console.log('🔮 Glyph.js: DevTools panel connected');
    }

    onPanelHidden() {
        this.isConnected = false;
        this.stopTracing();
    }

    startTracing() {
        chrome.devtools.inspectedWindow.eval(
            `if (window.glyphTracer) { 
                window.glyphTracer.startTracing();
                true;
            } else {
                false;
            }`,
            (result, isException) => {
                if (isException || !result) {
                    this.sendToPanel('tracing-error', {
                        error: 'Glyph tracer not available'
                    });
                } else {
                    this.sendToPanel('tracing-started', {
                        timestamp: Date.now()
                    });
                }
            }
        );
    }

    stopTracing() {
        chrome.devtools.inspectedWindow.eval(
            `if (window.glyphTracer) { 
                window.glyphTracer.stopTracing();
            }`,
            () => {}
        );
    }

    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'GLYPH_TRACE_UPDATE') {
                this.handleTraceUpdate(request.data);
            }
        });

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'GLYPH_TRACE_DATA') {
                this.handleTraceData(event.data.data);
            }
        });
    }

    handleTraceUpdate(data) {
        this.traceData.push({
            ...data,
            receivedAt: Date.now(),
            id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });

        if (this.traceData.length > 200) {
            this.traceData = this.traceData.slice(-100);
        }

        if (this.isConnected && this.panelWindow) {
            this.sendToPanel('trace-update', data);
        }
    }

    handleTraceData(data) {
        this.handleTraceUpdate(data);
    }

    sendToPanel(type, data) {
        if (!this.panelWindow) return;

        try {
            const message = {
                type: `GLYPH_${type.toUpperCase()}`,
                data: {
                    ...data,
                    timestamp: Date.now()
                }
            };

            this.panelWindow.postMessage(message, '*');
            
        } catch (error) {
            console.error('🔮 Glyph.js: Failed to send message to panel:', error);
        }
    }

    sendInitialState() {
        this.sendToPanel('initial-state', {
            traceData: this.traceData,
            isTracing: true,
            pageInfo: {
                url: chrome.devtools.inspectedWindow.tabId ? 
                     `tab-${chrome.devtools.inspectedWindow.tabId}` : 'unknown'
            },
            stats: {
                totalSteps: this.traceData.length,
                errors: this.traceData.filter(t => t.status === 'error').length,
                warnings: this.traceData.filter(t => t.status === 'warning').length
            }
        });
    }
}

function initializeGlyphDevTools() {
    try {
        if (window.glyphDevTools) return window.glyphDevTools;

        window.glyphDevTools = new GlyphDevTools();
        
        window.GlyphDev = {
            getInstance: () => window.glyphDevTools,
            getTraceData: () => window.glyphDevTools.traceData
        };

        return window.glyphDevTools;
    } catch (error) {
        console.error('🔮 Glyph.js: DevTools initialization failed', error);
        return null;
    }
}

if (chrome.devtools) {
    initializeGlyphDevTools();
}
