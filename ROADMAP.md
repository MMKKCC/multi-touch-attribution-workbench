# Roadmap — MTA Sandbox & Visualizer
 
## MVP: Completed
 
### Core Engine
- [x] DictionaryEncoder with Uint32Array buffers (Wasm-ready boundary)
- [x] AttributionEngine in Web Worker via Comlink
- [x] First-Touch, Last-Touch, Linear, Time-Decay heuristics
- [x] Markov chain (1st, 2nd, 3rd order) with removal effect
- [x] Fundamental matrix inversion (ml-matrix, pseudo-inverse fallback)
- [x] Shapley values (Monte Carlo, configurable iterations)
- [x] Bootstrap confidence intervals (2σ)
- [x] Velocity metrics (avg time-in-stage per channel)
- [x] Synthetic journey generator (seeded Markov simulator)
- [x] CSV upload and parsing

### Visualization
- [x] Canvas 2D particle animation (LOD ≤1,000)
- [x] D3 Sankey aggregate flow (LOD >1,000)
- [x] Model Comparison stacked bar chart with CI overlay
- [x] Velocity heatmap
- [x] Dice Roll single-journey step-through with RNG brackets

### Controls & UX
- [x] Transition matrix editor with row-sum validation
- [x] Budget optimizer with saturation curve
- [x] 4 preset lesson scenarios
- [x] URL state serialization (gzip + Base64Url)
- [x] Shapley progress indicator
- [x] Error boundary with retry

### Testing
- [x] 54 Jest tests (DictionaryEncoder, AttributionEngine, SyntheticGenerator)
- [x] Edge-case coverage (all-Won, single-channel, degenerate matrices)

---

## Alpha Improvements — Recommended Next

### P0 — Correctness / Polish
- [ ] CSV parser error reporting (show row number and reason for skipped rows)
- [ ] Validate transition matrix rows sum to 1.0 before calculation (show inline error, not silent NaN)
- [ ] Budget panel: disable "Optimize" until Markov result is available (currently only visually disabled)
- [ ] Confidence interval display: show raw lower/upper values in tooltip, not just CI bar

### P1 — UX / Learnability
- [ ] Add model description tooltips (hover "Mar" → "Markov Chain: uses removal effect to measure each channel's counterfactual contribution")
- [ ] Progress bar for total calculation sequence (not just Shapley)
- [ ] "Why is this channel ranked differently?" explanatory callout on Model Comparison
- [ ] Annotate Sankey edges with flow percentage on hover
- [ ] Mobile-responsive layout (currently desktop-only)

### P2 — Features
- [ ] Save/load scenarios to localStorage
- [ ] Export results as CSV (attribution matrix, budget reallocation)
- [ ] Position-based attribution model (configurable first/last/middle weights)
- [ ] Channel addition/removal from the UI (currently hardcoded 6 channels)

---

## Beta Ideas

- **Custom funnel stages** — Let users define their own stage names and order
- **Revenue-weighted attribution** — Input deal value per journey; weight credits by ARR not headcount
- **Scenario comparison** — Side-by-side view of two different configs
- **Attribution audit log** — Show which journeys drove each channel's score
- **Gradient ascent budget optimizer** — Replace grid search with SGD for larger channel sets
- **Animated Sankey** — Flowing SVG paths showing real-time data (d3-flow)
- **Dark/light mode toggle**
- **Explainability panel** — Plain-English summary of why the top model chose its rankings

---

## Production / V2 Ideas

- **Rust/Wasm engine** — The `IAttributionEngine` Comlink boundary is already designed for this swap. Shapley at 5,000 iterations would drop from ~5s to <500ms.
- **Backend persistence** — FastAPI or Supabase backend; save/share scenarios with named slugs
- **Live CRM integration** — Salesforce/HubSpot OAuth connector; pull real opportunity journey data
- **Multi-period attribution** — Time-series decomposition; account for seasonality and campaign windows
- **A/B holdout testing** — True incrementality testing via holdout groups, not model inference
- **Multi-tenant SaaS** — Org accounts, role-based access, dashboard sharing
- **API endpoints** — Expose attribution engine as REST/gRPC for embedding in data pipelines

---

## Technical Debt

| Item | Priority | Effort |
|---|---|---|
| Remove `pixi.js` from package.json (unused, adds 400KB to bundle) | High | Low |
| Split `AttributionEngine.ts` (900+ lines) into per-model modules | Medium | Medium |
| Add integration test: full generate → calculate → result pipeline | High | Medium |
| Migrate from Vite 4 to Vite 5/6 | Low | Low |
| Replace `any` types in `csvParser.ts` row parsing | Low | Low |
| Add `@returns` JSDoc to all engine public methods | Low | Low |

---

## Priority Order for Next Work

1. Remove pixi.js from bundle (quick win, 400KB reduction)
2. CSV error reporting (correctness issue, easy fix)
3. Integration test for full pipeline (prevents regressions)
4. Model description tooltips (highest learnability ROI)
5. Split AttributionEngine into modules (maintainability)
6. Export results as CSV (most-requested practical feature)
7. Rust/Wasm engine (largest performance gain, highest effort)
