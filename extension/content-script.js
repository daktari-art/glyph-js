// glyph-js/extension/content-script.js
class GlyphTracer {
    constructor() {
        this.executionFlow = [];
        this.isTracing = false;
        this.stepCount = 0;
        this.originalMethods = new Map();
        this.config = {
            maxSteps: 1000,
            sampleRate: 1.0,
            captureStack: true,
            trackMemory: false
        };
        
        this.init();
    }

    init() {
        this.startTracing();
        this.setupMessageListener();
    }

    startTracing() {
        if (this.isTracing) return;
        
        try {
            this.isTracing = true;
            this.executionFlow = [];
            this.stepCount = 0;
            
            this.interceptCoreAPIs();
            this.wrapAsyncOperations();
            this.injectFrameworkTracers();
            this.setupPerformanceMonitoring();
            
            this.recordStep('🚀 Glyph Tracing Started', { 
                url: window.location.href,
                userAgent: navigator.userAgent.substring(0, 100)
            });
            
            console.log('🔮 Glyph.js: Execution tracing started');
        } catch (error) {
            console.error('🔮 Glyph.js: Tracing initialization failed', error);
        }
    }

    injectFrameworkTracers() {
        this.injectScript(this.getReactTracerCode());
        this.injectScript(this.getVueTracerCode());
        this.injectScript(this.getAngularTracerCode());
    }

    getReactTracerCode() {
        return `
            (function() {
                if (typeof window !== 'undefined' && window.React) {
                    console.log('🔮 Glyph: React detected, injecting tracer...');
                    
                    const originalCreateElement = React.createElement;
                    let renderCount = 0;
                    
                    React.createElement = function(type, props, ...children) {
                        if (typeof type === 'function') {
                            const componentName = type.displayName || type.name || 'Anonymous';
                            renderCount++;
                            
                            window.postMessage({
                                type: 'GLYPH_REACT_COMPONENT_RENDER',
                                data: {
                                    component: componentName,
                                    propsCount: props ? Object.keys(props).length : 0,
                                    childrenCount: children.length,
                                    renderCount: renderCount,
                                    timestamp: Date.now(),
                                    stack: new Error().stack.split('\\n').slice(1, 4).join('\\n')
                                }
                            }, '*');
                        }
                        return originalCreateElement.call(this, type, props, ...children);
                    };
                    
                    console.log('🔮 Glyph: React tracer injected successfully');
                }
            })();
        `;
    }

    getVueTracerCode() {
        return `
            (function() {
                if (typeof window !== 'undefined' && window.Vue) {
                    console.log('🔮 Glyph: Vue detected, injecting tracer...');
                    
                    const Vue = window.Vue;
                    
                    if (Vue.prototype && Vue.prototype.$mount) {
                        const originalMount = Vue.prototype.$mount;
                        Vue.prototype.$mount = function(...args) {
                            const componentName = this.$options.name || 'Anonymous';
                            
                            window.postMessage({
                                type: 'GLYPH_VUE_MOUNT',
                                data: {
                                    component: componentName,
                                    timestamp: Date.now()
                                }
                            }, '*');
                            
                            return originalMount.apply(this, args);
                        };
                    }
                    
                    console.log('🔮 Glyph: Vue tracer injected successfully');
                }
            })();
        `;
    }

    getAngularTracerCode() {
        return `
            (function() {
                if (typeof window !== 'undefined' && window.angular) {
                    console.log('🔮 Glyph: Angular detected, injecting tracer...');
                    
                    window.postMessage({
                        type: 'GLYPH_ANGULAR_DETECTED',
                        data: {
                            version: window.angular.version?.full,
                            timestamp: Date.now()
                        }
                    }, '*');
                }
            })();
        `;
    }

    injectScript(code) {
        try {
            const script = document.createElement('script');
            script.textContent = code;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        } catch (error) {
            console.error('🔮 Glyph: Script injection failed', error);
        }
    }

    interceptCoreAPIs() {
        this.wrapMethod(window, 'fetch', (originalFetch) => {
            return (...args) => {
                if (!this.isTracing) return originalFetch.apply(this, args);
                
                const fetchId = this.recordStep('🌐 Fetch API', { 
                    url: typeof args[0] === 'string' ? args[0] : 'Request',
                    method: args[1]?.method || 'GET'
                });
                
                const startTime = performance.now();
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        const duration = performance.now() - startTime;
                        this.updateStep(fetchId, 'success', { 
                            status: response.status,
                            duration: Math.round(duration),
                            url: response.url
                        });
                        return response;
                    })
                    .catch(error => {
                        const duration = performance.now() - startTime;
                        this.updateStep(fetchId, 'error', { 
                            error: error.message,
                            duration: Math.round(duration)
                        });
                        throw error;
                    });
            };
        });

        this.interceptXHR();
    }

    interceptXHR() {
        const originalXHR = window.XMLHttpRequest;
        const self = this;
        
        window.XMLHttpRequest = function() {
            const xhr = new originalXHR();
            const open = xhr.open;
            const send = xhr.send;
            
            let xhrId;
            
            xhr.open = function(method, url, async) {
                if (self.isTracing) {
                    xhrId = self.recordStep('🌐 XMLHttpRequest', {
                        method,
                        url,
                        async: async !== false
                    });
                }
                return open.apply(this, arguments);
            };
            
            xhr.send = function(data) {
                if (self.isTracing && xhrId) {
                    const startTime = performance.now();
                    
                    xhr.addEventListener('load', function() {
                        const duration = performance.now() - startTime;
                        self.updateStep(xhrId, 'success', {
                            status: xhr.status,
                            duration: Math.round(duration)
                        });
                    });
                    
                    xhr.addEventListener('error', function() {
                        const duration = performance.now() - startTime;
                        self.updateStep(xhrId, 'error', {
                            duration: Math.round(duration)
                        });
                    });
                }
                
                return send.apply(this, arguments);
            };
            
            return xhr;
        };
    }

    wrapAsyncOperations() {
        this.wrapMethod(window, 'setTimeout', (original) => {
            return (callback, delay, ...args) => {
                if (!this.isTracing) return original(callback, delay, ...args);
                
                const timerId = this.recordStep('⏰ setTimeout', { 
                    delay,
                    stack: this.getStack()
                });
                
                return original(() => {
                    this.updateStep(timerId, 'executed', {});
                    return callback(...args);
                }, delay);
            };
        });

        this.wrapMethod(window, 'setInterval', (original) => {
            return (callback, delay, ...args) => {
                if (!this.isTracing) return original(callback, delay, ...args);
                
                const intervalId = this.recordStep('🔄 setInterval', { 
                    delay 
                });
                
                return original(() => {
                    this.updateStep(intervalId, 'executed', {
                        executionCount: (this.executionFlow.find(s => s.id === intervalId)?.data?.executionCount || 0) + 1
                    });
                    return callback(...args);
                }, delay);
            };
        });
    }

    wrapMethod(obj, methodName, wrapper) {
        const original = obj[methodName];
        if (typeof original !== 'function') return;
        
        this.originalMethods.set(`${obj.constructor?.name}.${methodName}`, original);
        obj[methodName] = wrapper(original);
    }

    recordStep(type, data) {
        if (!this.isTracing) return null;
        
        if (this.executionFlow.length >= this.config.maxSteps) {
            this.executionFlow.shift();
        }
        
        const step = {
            id: this.generateId(),
            type,
            timestamp: Date.now(),
            data,
            status: 'running',
            stepNumber: this.stepCount++
        };
        
        this.executionFlow.push(step);
        this.sendToDevTools('step-added', step);
        return step.id;
    }

    updateStep(stepId, status, data) {
        if (!this.isTracing) return;
        
        const step = this.executionFlow.find(s => s.id === stepId);
        if (step) {
            step.status = status;
            step.data = { ...step.data, ...data };
            step.completedAt = Date.now();
            step.duration = step.completedAt - step.timestamp;
            this.sendToDevTools('step-updated', step);
        }
    }

    generateId() {
        return `glyph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    getStack() {
        try {
            return new Error().stack.split('\n').slice(2, 5).join('\n');
        } catch {
            return '';
        }
    }

    setupPerformanceMonitoring() {
        if (this.config.trackMemory && 'memory' in performance) {
            setInterval(() => {
                this.recordStep('📊 Memory Usage', {
                    usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
                });
            }, 15000);
        }
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data.type?.startsWith('GLYPH_')) {
                this.handleGlyphMessage(event.data);
            }
        });
    }

    handleGlyphMessage(message) {
        switch (message.type) {
            case 'GLYPH_REACT_COMPONENT_RENDER':
                this.recordStep('⚛️ React Render', message.data);
                break;
            case 'GLYPH_VUE_MOUNT':
                this.recordStep('🟢 Vue Mount', message.data);
                break;
            case 'GLYPH_ANGULAR_DETECTED':
                this.recordStep('🅰️ Angular Detected', message.data);
                break;
        }
    }

    sendToDevTools(event, data) {
        window.postMessage({
            type: 'GLYPH_TRACE_DATA',
            data: { 
                event, 
                ...data,
                pageUrl: window.location.href
            }
        }, '*');
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'GLYPH_TRACE_UPDATE',
                data: { event, ...data }
            });
        }
    }

    stopTracing() {
        this.isTracing = false;
        this.recordStep('🛑 Glyph Tracing Stopped', { 
            totalSteps: this.stepCount 
        });
    }
}

function initializeGlyphTracer() {
    try {
        if (window.glyphTracer) return window.glyphTracer;
        
        window.glyphTracer = new GlyphTracer();
        
        window.Glyph = {
            start: () => window.glyphTracer.startTracing(),
            stop: () => window.glyphTracer.stopTracing(),
            getFlow: () => window.glyphTracer.executionFlow,
            clear: () => window.glyphTracer.executionFlow = []
        };
        
        return window.glyphTracer;
    } catch (error) {
        console.error('🔮 Glyph.js: Initialization failed', error);
        return null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlyphTracer);
} else {
    initializeGlyphTracer();
}
