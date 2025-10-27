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
            this.injectFrameworkTracers(); // ← ENHANCED: Proper injection
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

    // === NEW: PROPER FRAMEWORK INJECTION ===
    injectFrameworkTracers() {
        this.injectReactTracer();
        this.injectVueTracer();
        this.injectAngularTracer();
    }

    injectReactTracer() {
        const reactTracerCode = `
            (function() {
                if (typeof window !== 'undefined' && window.React) {
                    console.log('🔮 Glyph: Injecting React tracer...');
                    
                    // Store original methods
                    const originalUseState = React.useState;
                    const originalUseEffect = React.useEffect;
                    const originalUseMemo = React.useMemo;
                    const originalCreateElement = React.createElement;
                    
                    // Wrap useState
                    React.useState = function(initialState) {
                        const [state, setState] = originalUseState.call(this, initialState);
                        
                        const wrappedSetState = (newState) => {
                            // Send state change to Glyph
                            window.postMessage({
                                type: 'GLYPH_REACT_STATE_UPDATE',
                                data: {
                                    hook: 'useState',
                                    previous: state,
                                    next: newState,
                                    stack: new Error().stack,
                                    timestamp: Date.now()
                                }
                            }, '*');
                            return setState(newState);
                        };
                        
                        return [state, wrappedSetState];
                    };
                    
                    // Wrap useEffect
                    React.useEffect = function(effect, deps) {
                        const componentName = this?.type?.displayName || this?.type?.name || 'Unknown';
                        const effectId = Math.random().toString(36).substr(2, 9);
                        
                        window.postMessage({
                            type: 'GLYPH_REACT_EFFECT_CREATED',
                            data: {
                                component: componentName,
                                effectId,
                                dependencies: deps,
                                hasDeps: !!deps,
                                timestamp: Date.now()
                            }
                        }, '*');
                        
                        return originalUseEffect.call(this, effect, deps);
                    };
                    
                    // Wrap createElement to track component renders
                    React.createElement = function(type, props, ...children) {
                        if (typeof type === 'function') {
                            const componentName = type.displayName || type.name || 'Anonymous';
                            window.postMessage({
                                type: 'GLYPH_REACT_COMPONENT_RENDER',
                                data: {
                                    component: componentName,
                                    propsCount: props ? Object.keys(props).length : 0,
                                    childrenCount: children.length,
                                    timestamp: Date.now()
                                }
                            }, '*');
                        }
                        return originalCreateElement.call(this, type, props, ...children);
                    };
                    
                    console.log('🔮 Glyph: React tracer injected successfully');
                }
            })();
        `;
        this.injectScript(reactTracerCode);
    }

    injectVueTracer() {
        const vueTracerCode = `
            (function() {
                if (typeof window !== 'undefined' && window.Vue) {
                    console.log('🔮 Glyph: Injecting Vue tracer...');
                    
                    const Vue = window.Vue;
                    
                    // Vue 2.x
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
                    
                    // Vue 3.x
                    if (Vue.createApp) {
                        const originalCreateApp = Vue.createApp;
                        Vue.createApp = function(rootComponent, rootProps) {
                            const app = originalCreateApp.call(this, rootComponent, rootProps);
                            const originalMount = app.mount;
                            
                            app.mount = function(container) {
                                window.postMessage({
                                    type: 'GLYPH_VUE_APP_MOUNT',
                                    data: {
                                        component: rootComponent.name || 'Anonymous',
                                        container: typeof container === 'string' ? container : 'Element',
                                        timestamp: Date.now()
                                    }
                                }, '*');
                                
                                return originalMount.call(this, container);
                            };
                            
                            return app;
                        };
                    }
                    
                    console.log('🔮 Glyph: Vue tracer injected successfully');
                }
            })();
        `;
        this.injectScript(vueTracerCode);
    }

    injectAngularTracer() {
        const angularTracerCode = `
            (function() {
                if (typeof window !== 'undefined' && window.angular) {
                    console.log('🔮 Glyph: Injecting Angular tracer...');
                    
                    const angular = window.angular;
                    const originalModule = angular.module;
                    
                    angular.module = function(name, requires, configFn) {
                        const moduleInstance = originalModule.apply(this, arguments);
                        
                        // Track module creation
                        window.postMessage({
                            type: 'GLYPH_ANGULAR_MODULE',
                            data: {
                                module: name,
                                requires: requires || [],
                                timestamp: Date.now()
                            }
                        }, '*');
                        
                        return moduleInstance;
                    };
                    
                    console.log('🔮 Glyph: Angular tracer injected successfully');
                }
            })();
        `;
        this.injectScript(angularTracerCode);
    }

    injectScript(code) {
        try {
            const script = document.createElement('script');
            script.textContent = code;
            document.documentElement.appendChild(script);
            script.remove();
        } catch (error) {
            console.error('🔮 Glyph: Script injection failed', error);
        }
    }
    // === END NEW FRAMEWORK INJECTION ===

    // KEEP ALL EXISTING METHODS (unchanged)
    stopTracing() {
        this.isTracing = false;
        this.restoreOriginalMethods();
        this.recordStep('🛑 Glyph Tracing Stopped', { 
            totalSteps: this.stepCount 
        });
    }

    interceptCoreAPIs() {
        // Fetch API - KEEP EXISTING
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

        // XMLHttpRequest - KEEP EXISTING
        this.interceptXHR();
    }

    // KEEP ALL OTHER EXISTING METHODS EXACTLY AS THEY ARE...
    wrapAsyncOperations() { /* unchanged */ }
    wrapPromisePrototype() { /* unchanged */ }
    interceptXHR() { /* unchanged */ }
    wrapEventListeners() { /* unchanged */ }
    
    // REPLACE the old framework detection with new injection
    instrumentFrameworkIfPresent() {
        // Now handled by injectFrameworkTracers()
        this.recordStep('🔍 Framework Detection', {
            react: !!window.React,
            vue: !!window.Vue, 
            angular: !!window.angular
        });
    }

    // KEEP all other methods exactly as they were...
    instrumentReact() { /* now handled by injection */ }
    instrumentVue() { /* now handled by injection */ }
    
    setupPerformanceMonitoring() { /* unchanged */ }
    setupMessageListener() { /* unchanged */ }
    wrapMethod() { /* unchanged */ }
    restoreOriginalMethods() { /* unchanged */ }
    recordStep() { /* unchanged */ }
    recordAsyncStep() { /* unchanged */ }
    updateStep() { /* unchanged */ }
    generateId() { /* unchanged */ }
    getStack() { /* unchanged */ }
    sendToDevTools() { /* unchanged */ }
}

// KEEP initialization exactly as is
function initializeGlyphTracer() {
    try {
        if (window.glyphTracer) {
            console.log('🔮 Glyph.js: Already initialized');
            return window.glyphTracer;
        }
        
        window.glyphTracer = new GlyphTracer();
        
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
