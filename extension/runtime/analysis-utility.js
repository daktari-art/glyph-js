// Glyph Analysis Utility - Runtime Analysis Engine
(function() {
    'use strict';
    
    class GlyphAnalysisUtility {
        constructor(stateManager) {
            this.stateManager = stateManager || null;
            this.errorPatterns = this.initializeErrorPatterns();
            console.log('🧠 Glyph Analysis Utility initialized');
        }
        
        initializeErrorPatterns() {
            return [
                // Pattern 1: Unresolved API Dependency
                {
                    name: "Unresolved API Dependency",
                    severity: "HIGH",
                    conditions: (timeline) => {
                        const failedFetch = timeline.find(n => 
                            n.label && n.label.includes('Fetch Error')
                        );
                        if (!failedFetch) return null;
                        
                        let endpoint = 'unknown';
                        if (this.stateManager) {
                            const preFetchSnapshot = this.stateManager.variableSnapshots.get(
                                failedFetch.id + '_start'
                            );
                            endpoint = preFetchSnapshot?.variables?.arguments?.[0] || 'unknown';
                        }
                        
                        return {
                            errorNode: failedFetch,
                            endpoint: endpoint,
                            timestamp: failedFetch.timestamp
                        };
                    },
                    solution: (diagnosis) => 
                        `The network request to "${diagnosis.endpoint}" failed. Check: 1) Server availability, 2) CORS policy, 3) Network connectivity.`
                },
                
                // Pattern 2: Null Access Pattern
                {
                    name: "Potential Null Access",
                    severity: "MEDIUM", 
                    conditions: (timeline) => {
                        const errorNodes = timeline.filter(n => 
                            n.type === '🟥' && 
                            n.properties?.message?.includes('undefined') ||
                            n.properties?.message?.includes('null')
                        );
                        
                        if (errorNodes.length === 0) return null;
                        
                        return {
                            errorNodes: errorNodes,
                            count: errorNodes.length,
                            timestamp: errorNodes[0].timestamp
                        };
                    },
                    solution: (diagnosis) =>
                        `Found ${diagnosis.count} potential null/undefined access errors. Use optional chaining: variable?.property`
                },
                
                // Pattern 3: Async Race Condition
                {
                    name: "Potential Race Condition",
                    severity: "MEDIUM",
                    conditions: (timeline) => {
                        const asyncNodes = timeline.filter(n => 
                            n.type === '🔶' && n.label.includes('Fetch')
                        );
                        const quickSuccessions = [];
                        
                        for (let i = 1; i < asyncNodes.length; i++) {
                            const timeDiff = asyncNodes[i].timestamp - asyncNodes[i-1].timestamp;
                            if (timeDiff < 100) { // Less than 100ms between async calls
                                quickSuccessions.push({
                                    first: asyncNodes[i-1],
                                    second: asyncNodes[i],
                                    timeDiff: timeDiff
                                });
                            }
                        }
                        
                        if (quickSuccessions.length === 0) return null;
                        
                        return {
                            quickSuccessions: quickSuccessions,
                            count: quickSuccessions.length,
                            timestamp: quickSuccessions[0].first.timestamp
                        };
                    },
                    solution: (diagnosis) =>
                        `Found ${diagnosis.count} potential race conditions. Consider using Promise.all() or proper sequencing.`
                }
            ];
        }
        
        analyzeTimeline() {
            try {
                if (!this.stateManager) {
                    return [{
                        type: "Initialization Error",
                        severity: "HIGH",
                        solution: "State manager not available. Ensure state-manager.js is loaded before analysis-utility.js",
                        timestamp: Date.now()
                    }];
                }
                
                const timeline = this.stateManager.stateTimeline || [];
                const finalDiagnosis = [];
                
                for (const pattern of this.errorPatterns) {
                    try {
                        const match = pattern.conditions(timeline);
                        if (match) {
                            finalDiagnosis.push({
                                type: pattern.name,
                                severity: pattern.severity,
                                solution: pattern.solution(match),
                                timestamp: match.timestamp || Date.now(),
                                data: match
                            });
                        }
                    } catch (patternError) {
                        console.warn(`🧠 Pattern ${pattern.name} failed:`, patternError);
                    }
                }
                
                // If no specific patterns matched, provide general analysis
                if (finalDiagnosis.length === 0 && timeline.length > 0) {
                    finalDiagnosis.push({
                        type: "Code Analysis",
                        severity: "LOW", 
                        solution: "No critical issues detected. Code execution appears normal.",
                        timestamp: Date.now()
                    });
                }
                
                console.log(`🧠 Analysis complete: ${finalDiagnosis.length} issues found`);
                return finalDiagnosis;
                
            } catch (error) {
                console.error('🧠 Analysis failed:', error);
                return [{
                    type: "Analysis Error",
                    severity: "HIGH",
                    solution: `Analysis engine error: ${error.message}. Check console for details.`,
                    timestamp: Date.now()
                }];
            }
        }
        
        // Utility method for state comparison
        compareSnapshots(snapshotA, snapshotB) {
            if (!snapshotA || !snapshotB) return { changed: false, differences: [] };
            
            const differences = [];
            // Basic implementation - extend this for deep comparison
            if (snapshotA.timestamp !== snapshotB.timestamp) {
                differences.push('Timestamp changed');
            }
            
            return {
                changed: differences.length > 0,
                differences: differences
            };
        }
    }
    
    // Initialize when state manager is available
    function initializeAnalyzer() {
        if (window.glyphStateManager) {
            window.glyphAnalyzer = new GlyphAnalysisUtility(window.glyphStateManager);
        } else {
            // Fallback: initialize without state manager
            console.warn('🧠 State manager not available - initializing analyzer in limited mode');
            window.glyphAnalyzer = new GlyphAnalysisUtility(null);
        }
    }
    
    // Try to initialize immediately, or wait for state manager
    if (window.glyphStateManager) {
        initializeAnalyzer();
    } else {
        // Wait a bit for state manager to load
        setTimeout(initializeAnalyzer, 100);
    }
    
})();
