# MST Route Lab

Three TSP algorithms, step by step, on Kolkata's Durga Puja pandals. Pick
stops on the map, then switch tabs:

| Tab | Algorithm | Result |
| --- | --- | --- |
| **Held–Karp** | Dynamic programming over subsets, O(n²·2ⁿ) | The exact optimal tour (up to 13 stops) |
| **2-Approximation** | MST → double the edges → Eulerian tour (Hierholzer) → shortcut to a Hamiltonian cycle | A tour ≤ 2 × optimal, in O(n²) |
| **MST-Prim** | CLRS MST-PRIM with the key / π / Q table | A minimum spanning tree |

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run bench    # 2-approximation vs Held–Karp on real pandal clusters
```

Controls: ← / → step, Space plays. Distances are straight-line
(great-circle), which satisfy the triangle inequality the 2× bound needs.

## Code

- `src/lib/geo.js` — haversine distance matrix
- `src/lib/prim.js` — MST-PRIM + its step frames
- `src/lib/doubleTree.js` — Euler tour → Hamiltonian cycle + frames
- `src/lib/heldKarp.js` — exact DP + frames
- `src/lib/map.js` — MapLibre layers
- `src/App.jsx`, `src/components/` — tabs, stops, player, tables

Dependencies: `react`, `react-dom`, `maplibre-gl`; `vite` to build.
