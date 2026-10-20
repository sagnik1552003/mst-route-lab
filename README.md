# Pujo Yatra — MST Route Lab

A single-page visualiser for the **metric TSP 2-approximation** (Prim's MST +
preorder walk), run on 464 Durga Puja pandals in Kolkata. Pick stops, then
watch the algorithm build the minimum spanning tree, walk it depth-first and
shortcut the revisits into a route that is provably at most 2× the optimum.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run bench      # MST route vs exact optimum (Held–Karp) on real pandal clusters
```

## What's on the page

- **Stops** — random nearby cluster (3–20 stops), search by name/area, or click any dot on the map. Stop 1 is the start.
- **Run** — *Watch it step by step* opens the player (Prim's → full walk → shortcut → result) with play/pause, step, scrub, speed, and ← → / Space / Esc. *Apply MST order* reorders instantly. *Fix the start* roots the tree at stop 1; otherwise every root is tried and the shortest route kept.
- **The bound** — MST weight ≤ optimal ≤ MST route ≤ 2 × MST, drawn on one scale. The exact optimum (Held–Karp, O(n²·2ⁿ)) is computed live for up to 14 stops.
- **Map overlays** — MST route, exact optimal route, and the real road route (OSRM) for comparison.

## Code

| File | Role |
| --- | --- |
| `src/lib/mstTsp.js` | The algorithm: haversine matrix, Prim's (O(n²) array version), DFS preorder + full walk, shortcut trace |
| `src/lib/heldKarp.js` | Exact shortest open path, the yardstick |
| `src/lib/tspFrames.js` | One run → a list of self-contained animation frames |
| `src/lib/mapLayers.js` | All MapLibre sources/layers (GeoJSON, no DOM markers) |
| `src/MstLab.jsx` | The page: state, map, wiring |
| `src/components/` | `StopsPanel`, `Player`, `NumbersCard` |
| `scripts/tspBenchmark.mjs` | Approximation ratio + running-time experiments |

Distances are straight-line (great-circle), which satisfy the triangle
inequality the 2× proof depends on. Road distances may not, so the road
route is shown for reference only.
