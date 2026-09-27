# Project Summary — MTA Sandbox & Visualizer
 
## Executive Summary

MTA Sandbox is a fully client-side, browser-based multi-touch attribution workbench. It generates synthetic B2B SaaS customer journeys, runs six attribution models in a dedicated Web Worker, and renders interactive visualizations — all without a backend or vendor dependency. The codebase demonstrates production-grade architecture patterns: typed worker boundaries, off-thread computation, LOD-switched rendering, and test-covered mathematical algorithms.

---

## Problem Statement

Multi-touch attribution is one of the most debated problems in B2B marketing analytics. The core issue:

- **Last-touch and first-touch models are ubiquitous but provably wrong** — they assign 100% credit to one touchpoint and ignore the rest of the journey
- **Probabilistic models (Markov, Shapley) are far more accurate** but require engineering effort to implement and explain
- **Most teams can't experiment** with these models without access to a data warehouse, ML platform, or expensive vendor tool

The result: marketing budgets are routinely misallocated based on misleading attribution data.

---

## Solution Description

An interactive sandbox where:

1. Users configure a Markov-based journey simulator or upload real CSV data
2. Six attribution models run simultaneously in a Web Worker (no UI freeze)
3. Results are visualized as an animated particle flow, Sankey diagram, stacked bar comparison, and velocity heatmap
4. A budget optimizer shows how reallocation based on probabilistic models changes expected ROI
5. A "Dice Roll" step-through shows exactly how each random decision was made in a journey

---

## Target User

| Role | Use Case |
|---|---|
| Marketing analyst | Compare attribution models; understand why last-touch misleads |
| Marketing engineer | Prototype attribution logic; validate implementations |
| RevOps / demand-gen | Stress-test channel assumptions before budget planning |
| Data scientist | Explore Markov removal effect and Shapley value allocation |
| Interviewer / portfolio reviewer | Assess depth of statistical and systems engineering |

---

## Main Workflow

```
Configure channels & transition probabilities
    ↓
Generate synthetic journeys OR upload CSV
    ↓
Attribution Engine (Web Worker) computes:
  · Heuristics (First/Last/Linear/Time-Decay)
  · Markov chain (1st/2nd/3rd order, removal effect)
  · Shapley values (Monte Carlo)
  · Bootstrap confidence intervals
  · Velocity metrics
    ↓
Results displayed:
  · Flow (particle animation or Sankey)
  · Model Comparison (bar chart, CI bands)
  · Velocity heatmap
  · Budget optimizer
    ↓
Share via URL (gzip-compressed config state)
```

---

## Architecture Overview

### Threading Model

Strict main-thread / worker-thread separation:
- **Main thread**: React rendering, Zustand state, user input
- **Worker thread**: All math (Markov, Shapley, bootstrap, velocity)
- **Bridge**: Comlink v4 RPC — proxy function calls and transfer TypedArrays

### Wasm-Ready Boundary

The `DictionaryEncoder` converts all strings (channel names, stage names, journey IDs) to integers before the worker boundary. Data crosses as `Uint32Array` buffers only — no JS objects. This makes a future Rust/Wasm engine swap a drop-in replacement.

### State Management

Three Zustand stores with clean separation:
- `useConfigStore` — user inputs (sliders, matrix, budget)
- `useDataStore` — journey data and encoded buffers
- `useResultStore` — computation outputs (matrices, CI, velocity)

### Visualization LOD Switching

`<Visualizer>` monitors dataset size and mounts the appropriate renderer:
- ≤1,000 journeys → Canvas 2D particle animation (one dot per journey)
- >1,000 journeys → D3 Sankey SVG (aggregate flow, edge width ∝ volume)

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| TypedArray-only worker boundary | Enables V2 Wasm swap without UI changes |
| Sparse Map for higher-order Markov | State space explodes exponentially; dense arrays would OOM |
| Canvas 2D over PixiJS | PixiJS v7 WebGL fails on some GPU drivers; Canvas 2D is universally supported |
| Comlink over raw postMessage | Type-safe RPC; handles structured clone and transferables automatically |
| Zustand over Redux | ~10% of the boilerplate; sufficient for 3-store architecture |
| jest.config.cjs over jest.config.ts | Avoids ts-node requirement when project has `"type": "module"` |
| babel-jest for ml-matrix | ml-matrix ships ESM only; babel-jest transforms it for Jest's CJS mode |
| pako + Base64Url for URL state | Full config serializes to <500 chars after gzip; stays under 2048-char URL limit |

---

## Architectural Advantages

- **Mathematical rigor**: Markov fundamental matrix with pseudo-inverse fallback; Monte Carlo Shapley; bootstrap resampling with 2σ confidence intervals
- **Architecturally forward-looking**: Worker boundary designed for Wasm upgrade without refactoring
- **Well-tested core logic**: 54 Jest tests covering all attribution models, edge cases, and data encoding
- **Educational depth**: 4 curated preset lessons teaching attribution pitfalls
- **Zero infrastructure**: Runs entirely in browser; no server, no database, no API keys
- **Shareable state**: Full config round-trips through gzip URL encoding

---

## Known Limitations

- Shapley at 5,000 iterations takes 3–8 seconds in TypeScript (Wasm would be ~10× faster)
- Grid-search budget optimizer is O(n²) in channels; practical up to ~20 channels
- No persistence — scenarios are lost on page close (URL sharing is the workaround)
- CSV parser is tolerant but does not handle malformed data gracefully (silent row skips)
- No revenue-weighted attribution (deal size not modeled)

---


