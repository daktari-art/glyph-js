# Glyph Visual Syntax Specification v1.0

## Core Glyph Set (Standardized)

### DATA FLOW GLYPHS
```

🟦 DATA_NODE    - [●] Raw data, variables, constants
🟩TEXT_NODE    - [📝] String data
🟨LIST_NODE    - [📦] Arrays, collections
🟥 ERROR_NODE   - [💥] Error states, exceptions
🟪STATE_NODE   - [🏠] Application state

```

### EXECUTION GLYPHS
```

🔷 FUNCTION_NODE - [⚙️] Pure transformations
🔶ASYNC_NODE    - [⏳] Async operations, promises
🔷LOOP_NODE     - [🔄] Iterations, repetitions
🔶CONDITION_NODE - [❓] Branching, decisions

```

### SYSTEM GLYPHS
```

🔵 INPUT_NODE    - [📥] User input, API calls
🟢OUTPUT_NODE   - [📤] Rendering, side effects
🟡EVENT_NODE    - [🎯] User events, triggers

```

## Connection Types
```

→  DATA_FLOW     - Primary data transfer
⤴️RETURN_FLOW   - Function returns
⤵️ERROR_FLOW    - Error propagation
🔄ASYNC_FLOW    - Async operation chains

```

## Color Coding Standards
- 🟦 Blue: Data & State
- 🟢 Green: Success & Output
- 🟥 Red: Errors & Warnings  
- 🟡 Yellow: Async & Events
- 🟣 Purple: System & Meta
```
