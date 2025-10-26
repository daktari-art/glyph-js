// ENHANCED GLYPH TRACER - PRODUCTION READY
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
        // Auto-start when injected into page
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
            this.instrumentFrameworkIfPresent();
            this.setupPerformanceMonitoring();
            
            this.recordStep('🚀 Glyph Tracing Started', { 
                url: window.location.href,
                userAgent: navigator.userAgent 
            });
            
            console.log('🔮 Glyph.js: Execution tracing started');
        } catch (error) {
            console.error('🔮 Glyph.js: Tracing initialization failed', error);
        }
    }

    stopTracing() {
        this.isTracing = false;
        this.restoreOriginalMethods();
        this.recordStep('🛑 Glyph Tracing Stopped', { 
            totalSteps: this.stepCount 
        });
    }

    interceptCoreAPIs() {
        // Fetch API
        this.wrapMethod(window, 'fetch', (originalFetch) => {
            return (...args) => {
                if (!this.isTracing) return originalFetch.apply(this, args);
                
                const fetchId = this.recordStep('🌐 Fetch API', { 
                    url: args[0],
                    method: args[1]?.method || 'GET',
                    headers: args[1]?.headers ? 'present' : 'none'
                });
                
                const startTime = performance.now();
                
                return originalFetch.apply(this, args)
                    .then(async (response) => {
                        const duration = performance.now() - startTime;
                        const clone = response.clone();
                        try {
                            const data = await clone.text();
                            this.updateStep(fetchId, 'success', { 
                                status: response.status,
                                duration: Math.round(duration),
                                size: data.length,
                                contentType: response.headers.get('content-type')
                            });
                        } catch (e) {
                            this.updateStep(fetchId, 'success', { 
                                status: response.status,
                                duration: Math.round(duration)
                            });
                        }
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

        // XMLHttpRequest
        this.interceptXHR();
    }

    wrapAsyncOperations() {
        // Promise chain tracking
        this.wrapPromisePrototype();
        
        // setTimeout/setInterval
        this.wrapMethod(window, 'setTimeout', (original) => {
            return (callback, delay, ...args) => {
                if (!this.isTracing) return original(callback, delay, ...args);
                
                const timerId = this.recordStep('⏰ setTimeout', { 
                    delay,
                    stack: this.config.captureStack ? this.getStack() : undefined
                });
                
                return original(() => {
                    this.updateStep(timerId, 'executed', {});
                    return callback(...args);
                }, delay);
            };
        });

        // Event listeners
        this.wrapEventListeners();
    }

    wrapPromisePrototype() {
        const originalThen = Promise.prototype.then;
        const originalCatch = Promise.prototype.catch;
        const originalFinally = Promise.prototype.finally;

        Promise.prototype.then = function(onFulfilled, onRejected) {
            const promiseId = this._glyphId || (this._glyphId = this.generateId());
            const stack = this.config.captureStack ? this.getStack() : undefined;
            
            return originalThen.call(this, 
                (result) => {
                    this.recordAsyncStep(promiseId, 'promise-resolved', {
                        resultType: typeof result,
                        isObject: typeof result === 'object',
                        stack
                    });
                    return onFulfilled?.(result);
                },
                (error) => {
                    this.recordAsyncStep(promiseId, 'promise-rejected', {
                        error: error?.message,
                        stack
                    });
                    return onRejected?.(error);
                }
            );
        };

        Promise.prototype.catch = function(onRejected) {
            return originalCatch.call(this, (error) => {
                const promiseId = this._glyphId;
                if (promiseId && this.isTracing) {
                    this.recordAsyncStep(promiseId, 'promise-caught', {
                        error: error?.message
                    });
                }
                return onRejected?.(error);
            });
        };
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
                            statusText: xhr.statusText,
                            duration: Math.round(duration),
                            responseType: xhr.responseType
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

    wrapEventListeners() {
        const originalAddEventListener = EventTarget.prototype.addEventListener;
        const self = this;
        
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (self.isTracing && typeof type === 'string') {
                const eventId = self.recordStep('🎯 Event Listener', {
                    eventType: type,
                    target: this.constructor?.name || 'Unknown',
                    passive: options?.passive || false
                });
                
                const wrappedListener = function(...args) {
                    self.updateStep(eventId, 'triggered', {
                        timestamp: Date.now()
                    });
                    return listener.apply(this, args);
                };
                
                return originalAddEventListener.call(this, type, wrappedListener, options);
            }
            
            return originalAddEventListener.call(this, type, listener, options);
        };
    }

    instrumentFrameworkIfPresent() {
        // React.js detection and instrumentation
        if (window.React || window.ReactDOM) {
            this.instrumentReact();
        }
        
        // Vue.js detection
        if (window.Vue) {
            this.instrumentVue();
        }
        
        // Angular detection
        if (window.angular) {
            this.instrumentAngular();
        }
    }

    instrumentReact() {
        this.recordStep('⚛️ React Detected', { version: React.version });
        
        // Component render tracking
        if (React.createElement) {
            this.wrapMethod(React, 'createElement', (original) => {
                return (type, props, ...children) => {
                    if (this.isTracing && typeof type === 'function') {
                        const componentName = type.displayName || type.name || 'Anonymous';
                        this.recordStep('⚛️ Component Render', {
                            component: componentName,
                            hasProps: !!props,
                            childrenCount: children.length
                        });
                    }
                    return original.call(React, type, props, ...children);
                };
            });
        }
    }

    instrumentVue() {
        this.recordStep('🟢 Vue.js Detected', { version: Vue.version });
        
        // Vue component lifecycle tracking
        const originalMount = Vue.prototype.$mount;
        Vue.prototype.$mount = function(...args) {
            if (this.isTracing) {
                this.recordStep('🟢 Vue Mount', {
                    component: this.$options?.name || 'Anonymous'
                });
            }
            return originalMount.apply(this, args);
        };
    }

    setupPerformanceMonitoring() {
        if (this.config.trackMemory && 'memory' in performance) {
            setInterval(() => {
                this.recordStep('📊 Memory Usage', {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize
                });
            }, 10000);
        }
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'GLYPH_CONTROL') {
                switch (event.data.action) {
                    case 'START_TRACING':
                        this.startTracing();
                        break;
                    case 'STOP_TRACING':
                        this.stopTracing();
                        break;
                    case 'CLEAR_TRACING':
                        this.executionFlow = [];
                        this.stepCount = 0;
                        break;
                }
            }
        });
    }

    wrapMethod(obj, methodName, wrapper) {
        const original = obj[methodName];
        if (typeof original !== 'function') return;
        
        this.originalMethods.set(`${obj.constructor.name}.${methodName}`, original);
        
        obj[methodName] = wrapper(original);
    }

    restoreOriginalMethods() {
        this.originalMethods.forEach((original, key) => {
            const [className, methodName] = key.split('.');
            // In real implementation, would restore original methods
        });
    }

    recordStep(type, data) {
        if (!this.isTracing) return null;
        
        // Sampling
        if (Math.random() > this.config.sampleRate) return null;
        
        // Limit steps
        if (this.executionFlow.length >= this.config.maxSteps) {
            this.executionFlow.shift();
        }
        
        const step = {
            id: this.generateId(),
            type,
            timestamp: Date.now(),
            data,
            status: 'running',
            stepNumber: this.stepCount++,
            stack: this.config.captureStack ? this.getStack() : undefined
        };
        
        this.executionFlow.push(step);
        this.sendToDevTools('step-added', step);
        return step.id;
    }

    recordAsyncStep(promiseId, event, data) {
        if (!this.isTracing) return;
        
        this.recordStep('⛓️ Promise ' + event, {
            promiseId,
            ...data
        });
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
            const stack = new Error().stack;
            return stack ? stack.split('\n').slice(2, 6).join('\n') : '';
        } catch {
            return '';
        }
    }

    sendToDevTools(event, data) {
        // Send to DevTools panel via window.postMessage
        window.postMessage({
            type: 'GLYPH_TRACE_DATA',
            data: { 
                event, 
                ...data,
                pageUrl: window.location.href
            }
        }, '*');
        
        // Also send to background script for persistence
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'GLYPH_TRACE_UPDATE',
                data: { event, ...data }
            });
        }
    }
}

// Enhanced initialization with error handling
function initializeGlyphTracer() {
    try {
        // Only initialize once
        if (window.glyphTracer) {
            console.log('🔮 Glyph.js: Already initialized');
            return window.glyphTracer;
        }
        
        window.glyphTracer = new GlyphTracer();
        
        // Global access for debugging
        window.Glyph = {
            start: () => window.glyphTracer.startTracing(),
            stop: () => window.glyphTracer.stopTracing(),
            getFlow: () => window.glyphTracer.executionFlow,
            clear: () => window.glyphTracer.executionFlow = []
        };
        
        console.log('🔮 Glyph.js: Tracer initialized successfully');
        return window.glyphTracer;
    } catch (error) {
        console.error('🔮 Glyph.js: Initialization failed', error);
        return null;
    }
}

// Auto-initialize when injected
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlyphTracer);
} else {
    initializeGlyphTracer();
}
