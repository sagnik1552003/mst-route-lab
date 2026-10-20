// Held–Karp dynamic programming: the exact optimal TSP tour.
//
// Fix stop 1 (vertex 0) as the start. For every set S ⊆ V that contains 0
// and every v ∈ S, v ≠ 0:
//   C(S, v) = length of the shortest path that starts at 0, visits exactly
//             the stops in S, and ends at v
//   C({0, v}, v) = w(0, v)
//   C(S, v)      = min over u ∈ S \ {0, v} of  C(S \ {v}, u) + w(u, v)
// OPT = min over v of C(V, v) + w(v, 0)
//
// 2ⁿ⁻¹ sets × n end points × n choices: O(n²·2ⁿ) time, O(n·2ⁿ) space —
// exponential, but exact. Capped at MAX_EXACT stops.
import { km } from './geo.js';

export const MAX_EXACT = 13;

function solve(D) {
  const n = D.length;
  const FULL = 1 << n;
  const C = new Float64Array(FULL * n).fill(Infinity);
  const P = new Int8Array(FULL * n).fill(-1);
  for (let v = 1; v < n; v++) C[((1 << v) | 1) * n + v] = D[0][v];
  // ascending masks: S \ {v} < S, so every subproblem is ready when needed
  for (let S = 1; S < FULL; S += 2) {
    for (let v = 1; v < n; v++) {
      if (!(S & (1 << v))) continue;
      const S0 = S & ~(1 << v);
      if (S0 === 1) continue; // base case, already set
      let best = Infinity, arg = -1;
      for (let u = 1; u < n; u++) {
        if (!(S0 & (1 << u))) continue;
        const c = C[S0 * n + u] + D[u][v];
        if (c < best) { best = c; arg = u; }
      }
      C[S * n + v] = best;
      P[S * n + v] = arg;
    }
  }
  return { C, P, n, FULL };
}

function pathTo(P, n, S, v) {
  const path = [];
  while (v !== -1 && v !== 0) {
    path.push(v);
    const u = P[S * n + v];
    S &= ~(1 << v);
    v = u;
  }
  path.push(0);
  return path.reverse();
}

const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

export function heldKarp(D) {
  const n = D.length;
  if (n < 2) return { length: 0, tour: [0] };
  if (n > MAX_EXACT) return null;
  if (n === 2) return { length: 2 * D[0][1], tour: [0, 1, 0] };
  const { C, P, FULL } = solve(D);
  let best = Infinity, end = -1;
  for (let v = 1; v < n; v++) {
    const c = C[(FULL - 1) * n + v] + D[v][0];
    if (c < best) { best = c; end = v; }
  }
  return { length: best, tour: [...pathTo(P, n, FULL - 1, end), 0] };
}

/**
 * One frame per subset size k = 2..n. Row k of the table holds, for every end
 * stop v, the best C(S, v) over all |S| = k — the shortest path from stop 1
 * through k stops ending at v — and the map draws the best of that row.
 */
export function heldKarpFrames(D, names) {
  const n = D.length;
  if (n > MAX_EXACT || n < 3) return null;
  const { C, P, FULL } = solve(D);
  const rows = [];
  const frames = [];
  const nodes = (fn) => Array.from({ length: n }, (_, v) => fn(v));
  let subproblems = 0;

  frames.push({
    title: 'Fix the start',
    text: `A tour visits every stop, so it can start anywhere: fix stop 1 (${names[0]}). C(S, v) is the shortest path from 1 through exactly the set S, ending at v.`,
    edges: [],
    nodes: nodes((v) => (v === 0 ? 'root' : 'pending')),
    table: { rows: [], n },
    stats: { 'Subproblems': 0 },
  });

  for (let k = 2; k <= n; k++) {
    const best = new Array(n).fill(Infinity);
    const bestS = new Array(n).fill(-1);
    for (let S = 1; S < FULL; S += 2) {
      if (popcount(S) !== k) continue;
      for (let v = 1; v < n; v++) {
        if (!(S & (1 << v))) continue;
        subproblems++;
        const c = C[S * n + v];
        if (c < best[v]) { best[v] = c; bestS[v] = S; }
      }
    }
    let end = 1;
    for (let v = 2; v < n; v++) if (best[v] < best[end]) end = v;
    rows.push({ k, values: best, min: end });
    const path = pathTo(P, n, bestS[end], end);
    const onPath = new Set(path);
    const sets = (() => { let c = 1; for (let i = 0; i < k - 1; i++) c = (c * (n - 1 - i)) / (i + 1); return Math.round(c); })();
    frames.push({
      title: `Sets of size ${k}`,
      text:
        k === 2
          ? `Base case: C({1, v}, v) = w(1, v) for each v — a single edge from the start.`
          : `C(S, v) = min over u of C(S∖{v}, u) + w(u, v), reusing row ${k - 1}. ${sets} sets of size ${k} contain stop 1. Shortest path so far through ${k} stops: ${path.map((v) => v + 1).join(' → ')} (${km(best[end])}).`,
      edges: path.slice(1).map((v, i) => ({ from: path[i], to: v, kind: 'partial' })),
      nodes: nodes((v) => (v === 0 ? 'root' : v === end ? 'current' : onPath.has(v) ? 'done' : 'pending')),
      table: { rows: [...rows], n },
      stats: { 'Subproblems': subproblems },
    });
  }

  const close = new Array(n).fill(Infinity);
  let endV = 1;
  for (let v = 1; v < n; v++) {
    close[v] = C[(FULL - 1) * n + v] + D[v][0];
    if (close[v] < close[endV]) endV = v;
  }
  const tour = [...pathTo(P, n, FULL - 1, endV), 0];
  rows.push({ k: '→1', values: close, min: endV });
  frames.push({
    title: 'Close the tour',
    text: `OPT = min over v of C(V, v) + w(v, 1). The best end is stop ${endV + 1}: tour ${tour.map((v) => v + 1).join(' → ')}, length ${km(close[endV])}. This is the true optimum — nothing shorter exists.`,
    edges: tour.slice(1).map((v, i) => ({ from: tour[i], to: v, kind: 'opt' })),
    nodes: nodes((v) => (v === 0 ? 'root' : 'done')),
    table: { rows: [...rows], n },
    stats: { 'Subproblems': subproblems, 'Optimal tour': close[endV] },
  });
  return frames;
}
