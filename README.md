# Glyph.js - Visual Debugging for JavaScript

> See your JavaScript code execute in real-time

Glyph.js brings visual data flow and time-travel debugging to JavaScript development. Stop debugging blind - see exactly how your code executes.

## 🎯 What Problem We Solve

JavaScript developers spend hours debugging invisible async flows and state changes. Glyph.js makes the invisible visible.

## 🚀 Quick Start

```bash
# Coming soon:
npm install @glyph-js/debugger

🎨 Vision

docs/vision.png
From blind debugging to visual execution

📖 Documentation

· Vision & Strategy
· Roadmap
· Technical Architecture

## ✍️Why Glphy?

// BEFORE: Debugging blind
const user = await fetchUser(); // Which step failed?
const profile = await fetchProfile(user.id);

// AFTER: Visual execution flow
[🔄 fetchUser] → [👤 user] → [🔄 fetchProfile] → [📊 profile]

## 🤝Contributing


### **File: `docs/STRATEGY.md`**
```markdown
# Glyph.js Strategy

## 🎯 Mission
Make JavaScript development visible through visual data flow debugging.

## 🔥 The Pain
JavaScript developers debug:
- Async/await chains blindly
- State changes without visibility  
- Data flow without visualization
- Race conditions without insight

## 💡 The Solution
A suite of developer tools that:
1. **Visualize** function execution and data flow
2. **Time-travel** through state changes
3. **Track** async operations visually
4. **Debug** with execution maps, not console logs

## 🚀 Phased Approach

### Phase 1: Chrome Extension (Months 1-3)
- Visual function call graphs
- Basic data flow display
- Simple time-travel

### Phase 2: Node.js Debugger (Months 4-6)  
- Backend execution visualization
- API call tracking
- Database query flow

### Phase 3: Framework Integrations (Months 7-9)
- React state visualization
- Vue.js devtools integration
- Next.js debugging

### Phase 4: Full Language (Year 2+)
- Glyph visual programming language
- Compiles to JavaScript
- Gradual adoption path
