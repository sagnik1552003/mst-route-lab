// Metric-TSP 2-approximation via the preorder walk of a minimum spanning
// tree — the textbook algorithm (CLRS §35.2.1, "APPROX-TSP-TOUR"), adapted
// to an open path because a pandal-hopping route doesn't loop back home.
//
//   1. Build the complete graph on the stops; edge weight = great-circle
//      (haversine) distance. That's a metric: symmetric, and it obeys the
//      triangle inequality — which is the one property step 4 relies on.
//   2. Grow an MST with Prim's algorithm from a root r.        O(n²)
//   3. Walk the tree depth-first from r. The "full walk" crosses every
//      tree edge twice (down, then back up), so its length = 2·w(MST).
//   4. Keep each vertex only the first time the walk reaches it (the
//      preorder). Jumping straight from one preorder vertex to the next
//      skips a stretch of the walk; by the triangle inequality that jump is
//      never longer than the stretch it replaces.
//
// Bound for the open path we return (P = preorder path, P* = optimal path):
//   w(P) ≤ w(full walk) = 2·w(MST)          (shortcutting never adds length)
//   w(MST) ≤ w(P*)                           (P* is itself a spanning tree)
//   ⇒ w(P) ≤ 2·w(P*)
// The same argument with the closing edge added gives the classic bound
// for the closed tour: w(cycle) ≤ 2·w(MST) ≤ 2·OPT_cycle.
//
// Everything here is pure (no map, no React, no network) so it can be
// unit-tested and benchmarked from Node — see scripts/tspBenchmark.mjs.
// The `trace` objects exist only to drive the step-by-step animation in
// components/route/TspAnimator.jsx; the algorithm itself doesn't need them.

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two {lat, lng} points. */
export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** n×n symmetric distance matrix (metres). O(n²). */
export function distanceMatrix(points) {
  const n = points.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      D[i][j] = D[j][i] = haversineMeters(points[i], points[j]);
    }
  }
  return D;
}

/**
 * Prim's algorithm, array version (best for a complete graph): O(n²) time,
 * O(n) extra space. `key[v]` = cheapest edge from v to the current tree,
 * `link[v]` = the tree vertex at the other end of that edge.
 *
 * Returns { parent, weight, steps } where parent[root] = -1 and `steps[k]`
 * records the k-th vertex added, its tree edge, and the frontier (every
 * outside vertex's current cheapest connection) *before* that choice —
 * exactly the "light edge crossing the cut" picture of Prim's.
 */
export function primMST(D, root = 0) {
  const n = D.length;
  const inTree = new Array(n).fill(false);
  const key = new Array(n).fill(Infinity);
  const link = new Array(n).fill(-1);
  const parent = new Array(n).fill(-1);
  const steps = [];
  let weight = 0;

  key[root] = 0;
  for (let k = 0; k < n; k++) {
    // Pick the outside vertex with the smallest key (the light edge).
    let u = -1;
    for (let v = 0; v < n; v++) {
      if (!inTree[v] && (u === -1 || key[v] < key[u])) u = v;
    }
    const frontier = [];
    if (k > 0) {
      for (let v = 0; v < n; v++) if (!inTree[v]) frontier.push({ from: link[v], to: v, weight: key[v] });
    }
    inTree[u] = true;
    parent[u] = link[u];
    if (k > 0) weight += key[u];
    steps.push({ vertex: u, parent: link[u], weight: k > 0 ? key[u] : 0, frontier, treeWeight: weight });

    // Relax: u is in the tree now, so every outside v may have a cheaper link.
    for (let v = 0; v < n; v++) {
      if (!inTree[v] && D[u][v] < key[v]) {
        key[v] = D[u][v];
        link[v] = u;
      }
    }
  }
  return { parent, weight, steps };
}

/**
 * Depth-first traversal of the tree from `root`. Children are visited
 * nearest-first (any order keeps the 2× guarantee; nearest-first just
 * tends to give a shorter result). Returns:
 *   preorder — vertices in first-visit order (this IS the tour)
 *   walk     — the full walk as a vertex sequence, backtracks included;
 *              it has 2(n−1) edges and length exactly 2·w(MST).
 */
export function preorderWalk(parent, D, root) {
  const n = parent.length;
  const children = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v++) if (parent[v] !== -1) children[parent[v]].push(v);
  for (let v = 0; v < n; v++) children[v].sort((a, b) => D[v][a] - D[v][b]);

  const preorder = [];
  const walk = [];
  const visit = (u) => {
    preorder.push(u);
    walk.push(u);
    for (const c of children[u]) {
      visit(c);
      walk.push(u); // climb back up the edge (c, u)
    }
  };
  visit(root);
  return { preorder, walk, children };
}

/** Length of visiting `order` as an open path (optionally closed into a cycle). */
export function pathLength(order, D, { closed = false } = {}) {
  let total = 0;
  for (let i = 1; i < order.length; i++) total += D[order[i - 1]][order[i]];
  if (closed && order.length > 1) total += D[order[order.length - 1]][order[0]];
  return total;
}

/**
 * The shortcutting step, made explicit for the animation: for each
 * consecutive pair (a, b) in the preorder, which already-visited vertices
 * the full walk passed through between a and b — the stretch the direct
 * edge a→b replaces — and how long that stretch was.
 */
export function shortcutTrace(preorder, walk, D) {
  const firstIdx = new Map();
  walk.forEach((v, i) => {
    if (!firstIdx.has(v)) firstIdx.set(v, i);
  });
  const legs = [];
  for (let i = 1; i < preorder.length; i++) {
    const a = preorder[i - 1];
    const b = preorder[i];
    // Either b is a's first child (stretch = just a→b, nothing skipped), or
    // a is a leaf and the walk climbs back up through already-visited
    // ancestors to b's parent before stepping down to b. The stretch runs
    // from the last time the walk stood on a up to b's first visit.
    const end = firstIdx.get(b);
    let start = end - 1;
    while (start > 0 && walk[start] !== a) start--;
    const stretch = walk.slice(start, end + 1);
    let stretchLen = 0;
    for (let k = 1; k < stretch.length; k++) stretchLen += D[stretch[k - 1]][stretch[k]];
    legs.push({
      from: a,
      to: b,
      direct: D[a][b],
      skipped: stretch.slice(1, -1), // revisits the shortcut jumps over
      stretchLength: stretchLen,
    });
  }
  return legs;
}

/** Run the whole algorithm from one fixed root. */
export function mstPreorderFromRoot(points, root = 0, D = distanceMatrix(points)) {
  const mst = primMST(D, root);
  const { preorder, walk } = preorderWalk(mst.parent, D, root);
  const pathLen = pathLength(preorder, D);
  return {
    root,
    order: preorder,
    walk,
    parent: mst.parent,
    primSteps: mst.steps,
    mstWeight: mst.weight,
    walkLength: pathLength(walk, D), // = 2·mstWeight
    pathLength: pathLen,
    cycleLength: pathLength(preorder, D, { closed: true }),
    legs: shortcutTrace(preorder, walk, D),
  };
}

/**
 * Public entry point used by the Route Planner.
 *
 * `points`: [{lat, lng}, ...] in the current visiting order.
 * `fixStart`: keep points[0] first (root the tree there). Otherwise every
 * stop is tried as the root and the shortest preorder path wins — n runs
 * of an O(n²) algorithm, O(n³) total, and every candidate individually
 * satisfies the 2× bound, so the best of them does too.
 *
 * Returns null for fewer than 2 valid points (nothing to order).
 */
export function solveMstTsp(points, { fixStart = false } = {}) {
  const valid = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length < 2 || valid.length !== points.length) return null;
  const D = distanceMatrix(points);
  const roots = fixStart ? [0] : points.map((_, i) => i);
  let best = null;
  const tried = [];
  for (const r of roots) {
    const res = mstPreorderFromRoot(points, r, D);
    tried.push({ root: r, pathLength: res.pathLength });
    if (!best || res.pathLength < best.pathLength - 1e-9) best = res;
  }
  return { ...best, rootsTried: tried, distance: D, n: points.length };
}
