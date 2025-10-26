// glyph-js/extension/devtools.js - ENHANCED VERSION
class GlyphDevTools {
    constructor() {
        this.isConnected = false;
        this.traceData = [];
        this.panelWindow = null;
        this.messageQueue = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.createDevToolsPanel();
        this.setupMessageHandlers();
        this.setupConnectionMonitor();
    }

    createDevToolsPanel() {
        chrome.devtools.panels.create(
            "Glyph", 
            "/icons/icon-48.png", 
            "/devtools.html", 
            (panel) => {
                console.log('🔮 Glyph.js: DevTools panel created');
                
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
        console.log('🔮 Glyph.js: DevTools panel shown');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Inject content script if not already present
        this.injectContentScript();
        
        // Start tracing on the inspected page
        this.startTracing();
        
        // Process any queued messages
        this.processMessageQueue();
        
        // Send initial state to panel
        this.sendToPanel('panel-connected', {
            timestamp: Date.now(),
            url: chrome.devtools.inspectedWindow.tabId ? 
                 `tab-${chrome.devtools.inspectedWindow.tabId}` : 'unknown'
        });
    }

    onPanelHidden() {
        console.log('🔮 Glyph.js: DevTools panel hidden');
        this.isConnected = false;
        this.stopTracing();
    }

    injectContentScript() {
        // Check if content script is already injected
        chrome.devtools.inspectedWindow.eval(
            `!!window.glyphTracer`,
            (result, isException) => {
                if (isException || !result) {
                    // Inject content script
                    chrome.devtools.inspectedWindow.eval(
                        `console.log('🔮 Glyph.js: Content script should be auto-injected via manifest')`,
                        (result, isException) => {
                            if (isException) {
                                console.warn('🔮 Glyph.js: Content script injection may have failed');
                            }
                        }
                    );
                }
            }
        );
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
                    console.error('🔮 Glyph.js: Failed to start tracing - glyphTracer not found');
                    this.sendToPanel('tracing-error', {
                        error: 'Glyph tracer not available on page',
                        suggestion: 'Refresh the page and try again'
                    });
                } else {
                    console.log('🔮 Glyph.js: Tracing started on inspected page');
                    this.sendToPanel('tracing-started', {
                        timestamp: Date.now(),
                        url: chrome.devtools.inspectedWindow.tabId ? 
                             `tab-${chrome.devtools.inspectedWindow.tabId}` : 'unknown'
                    });
                }
            }
        );
    }

    stopTracing() {
        chrome.devtools.inspectedWindow.eval(
            `if (window.glyphTracer) { 
                window.glyphTracer.stopTracing();
                true;
            } else {
                false;
            }`,
            (result, isException) => {
                if (!isException && result) {
                    console.log('🔮 Glyph.js: Tracing stopped');
                    this.sendToPanel('tracing-stopped', {
                        timestamp: Date.now()
                    });
                }
            }
        );
    }

    setupMessageHandlers() {
        // Handle messages from content script via background
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'GLYPH_TRACE_UPDATE') {
                this.handleTraceUpdate(request.data);
            }
            if (request.type === 'GLYPH_CONTENT_SCRIPT_READY') {
                this.handleContentScriptReady();
            }
        });

        // Handle direct window messages (fallback)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'GLYPH_TRACE_DATA') {
                this.handleTraceData(event.data.data);
            }
        });

        // Handle panel messages
        chrome.runtime.onConnect.addListener((port) => {
            if (port.name === 'glyph-panel') {
                port.onMessage.addListener((msg) => {
                    this.handlePanelMessage(msg, port);
                });
                
                port.onDisconnect.addListener(() => {
                    console.log('🔮 Glyph.js: Panel port disconnected');
                });
            }
        });
    }

    handleTraceUpdate(data) {
        // Store trace data
        this.traceData.push({
            ...data,
            receivedAt: Date.now(),
            id: `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });

        // Limit stored data to prevent memory issues
        if (this.traceData.length > 1000) {
            this.traceData = this.traceData.slice(-500);
        }

        // Send to panel if connected
        if (this.isConnected && this.panelWindow) {
            this.sendToPanel('trace-update', data);
        } else {
            // Queue for later delivery
            this.messageQueue.push(data);
        }
    }

    handleTraceData(data) {
        // Process trace data from window.postMessage
        this.handleTraceUpdate(data);
    }

    handleContentScriptReady() {
        console.log('🔮 Glyph.js: Content script ready');
        this.sendToPanel('content-script-ready', {
            timestamp: Date.now()
        });
    }

    handlePanelMessage(message, port) {
        console.log('🔮 Glyph.js: Received panel message:', message);

        switch (message.action) {
            case 'START_TRACING':
                this.startTracing();
                break;
                
            case 'STOP_TRACING':
                this.stopTracing();
                break;
                
            case 'CLEAR_TRACES':
                this.traceData = [];
                this.sendToPanel('traces-cleared', {
                    timestamp: Date.now()
                });
                break;
                
            case 'TIME_TRAVEL':
                this.handleTimeTravel(message.data);
                break;
                
            case 'EXPORT_TRACES':
                this.exportTraces();
                break;
                
            case 'INSPECT_ELEMENT':
                this.inspectElement(message.data);
                break;
                
            case 'GET_INITIAL_STATE':
                this.sendInitialState();
                break;
                
            default:
                console.warn('🔮 Glyph.js: Unknown panel message:', message);
        }
    }

    handleTimeTravel(timeTravelData) {
        // Send time-travel command to content script
        chrome.devtools.inspectedWindow.eval(
            `if (window.glyphTracer && window.glyphTracer.timeTravel) {
                window.glyphTracer.timeTravel(${JSON.stringify(timeTravelData)});
            }`,
            (result, isException) => {
                if (isException) {
                    console.error('🔮 Glyph.js: Time travel failed', isException);
                    this.sendToPanel('time-travel-error', {
                        error: isException.value
                    });
                }
            }
        );
    }

    inspectElement(selector) {
        chrome.devtools.inspectedWindow.eval(
            `(function() {
                const element = document.querySelector('${selector}');
                if (element) {
                    return element.toString();
                }
                return null;
            })()`,
            (result, isException) => {
                if (!isException && result) {
                    // Element found, can be used for highlighting
                    this.sendToPanel('element-found', {
                        selector,
                        elementInfo: result
                    });
                }
            }
        );
    }

    exportTraces() {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            url: chrome.devtools.inspectedWindow.tabId ? 
                 `tab-${chrome.devtools.inspectedWindow.tabId}` : 'unknown',
            traces: this.traceData,
            summary: {
                totalTraces: this.traceData.length,
                errorCount: this.traceData.filter(t => t.status === 'error').length,
                warningCount: this.traceData.filter(t => t.status === 'warning').length,
                duration: this.traceData.length > 0 ? 
                    this.traceData[this.traceData.length - 1].timestamp - this.traceData[0].timestamp : 0
            }
        };

        // Create downloadable file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        this.sendToPanel('export-ready', {
            blobUrl: URL.createObjectURL(dataBlob),
            filename: `glyph-trace-${Date.now()}.json`
        });
    }

    sendInitialState() {
        this.sendToPanel('initial-state', {
            traceData: this.traceData,
            isTracing: true, // We assume tracing is active when panel opens
            pageInfo: {
                url: chrome.devtools.inspectedWindow.tabId ? 
                     `tab-${chrome.devtools.inspectedWindow.tabId}` : 'unknown',
                framework: this.detectFramework()
            },
            stats: {
                totalSteps: this.traceData.length,
                errors: this.traceData.filter(t => t.status === 'error').length,
                warnings: this.traceData.filter(t => t.status === 'warning').length
            }
        });
    }

    detectFramework() {
        // This would be enhanced with actual framework detection
        return 'unknown';
    }

    sendToPanel(type, data) {
        if (!this.panelWindow) {
            console.warn('🔮 Glyph.js: No panel window available for message:', type);
            return;
        }

        try {
            const message = {
                type: `GLYPH_${type.toUpperCase()}`,
                data: {
                    ...data,
                    timestamp: Date.now(),
                    messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
                }
            };

            // Use postMessage to communicate with panel
            this.panelWindow.postMessage(message, '*');
            
        } catch (error) {
            console.error('🔮 Glyph.js: Failed to send message to panel:', error);
            this.scheduleReconnect();
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendToPanel('trace-update', message);
        }
    }

    setupConnectionMonitor() {
        // Monitor connection health
        setInterval(() => {
            if (this.isConnected && this.panelWindow) {
                // Send heartbeat to verify connection
                this.sendToPanel('heartbeat', {
                    timestamp: Date.now(),
                    queueSize: this.messageQueue.length
                });
            }
        }, 30000); // Every 30 seconds
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔮 Glyph.js: Scheduling reconnect attempt ${this.reconnectAttempts}`);
            
            setTimeout(() => {
                if (this.panelWindow) {
                    this.sendInitialState(); // Try to re-sync
                }
            }, 1000 * this.reconnectAttempts);
        }
    }

    // Utility method for evaluating scripts in inspected window
    evalInPage(script, callback) {
        chrome.devtools.inspectedWindow.eval(script, (result, isException) => {
            if (isException) {
                console.error('🔮 Glyph.js: Eval error:', isException);
                callback(null, isException);
            } else {
                callback(result, null);
            }
        });
    }
}

// Enhanced error handling for initialization
function initializeGlyphDevTools() {
    try {
        // Only initialize once
        if (window.glyphDevTools) {
            console.log('🔮 Glyph.js: DevTools already initialized');
            return window.glyphDevTools;
        }

        window.glyphDevTools = new GlyphDevTools();
        
        // Global access for debugging
        window.GlyphDev = {
            getInstance: () => window.glyphDevTools,
            getTraceData: () => window.glyphDevTools.traceData,
            forceReconnect: () => window.glyphDevTools.scheduleReconnect()
        };

        console.log('🔮 Glyph.js: DevTools initialized successfully');
        return window.glyphDevTools;

    } catch (error) {
        console.error('🔮 Glyph.js: DevTools initialization failed', error);
        return null;
    }
}

// Auto-initialize when devtools loads
if (chrome.devtools) {
    initializeGlyphDevTools();
} else {
    console.warn('🔮 Glyph.js: Not in DevTools context');
}
