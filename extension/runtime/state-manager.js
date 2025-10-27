// NEW FILE - Foundation for Glyph's immutable data
class GlyphStateManager {
    constructor() {
        this.stateTimeline = [];
        this.dataNodes = new Map(); // ○ nodes with immutable values
    }
    
    createDataNode(value, type) {
        // Same data structure used by debugger AND language
        const node = {
            id: this.generateId(),
            type: '○',
            value: Object.freeze(value), // Immutable like Glyph
            dataType: this.inferType(value),
            dependencies: [] // For data flow analysis
        };
        return node;
    }
}
