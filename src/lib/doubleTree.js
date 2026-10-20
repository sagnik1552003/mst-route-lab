// Metric-TSP 2-approximation via an Eulerian tour (the "double-tree"
// algorithm; CLRS APPROX-TSP-TOUR is the same idea phrased as a preorder walk).
//
//   1. T = MST of the complete graph                         (Prim, O(n²))
//   2. Double every edge of T. Every vertex now has even degree, so the
//      multigraph 2T has an Eulerian circuit.
//   3. Find an Eulerian circuit W of 2T (Hierholzer).          w(W) = 2·w(T)
//   4. Shortcut W: keep each vertex's first visit and return to the start.
//      The result H is a Hamiltonian cycle, and by the triangle inequality
//      each jump is no longer than the part of W it skips.
//
//   w(H) ≤ w(W) = 2·w(T) ≤ 2·OPT     (deleting one edge of an optimal tour
//                                      leaves a spanning tree, so w(T) ≤ OPT)
import { primMST } from './prim.js';
import { walkLength, km } from './geo.js';

/** Hierholzer's algorithm on the doubled tree, starting and ending at root. */
export function eulerCircuit(parent, D, root) {
  const n = parent.length;
  const edges = []; // each tree edge twice
  for (let v = 0; v < n; v++) if (parent[v] !== -1) edges.push([v, parent[v]], [v, parent[v]]);
  const adj = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], id) => { adj[a].push(id); adj[b].push(id); });
  // pop() takes from the end: sort far → near so the nearest edge is tried first
  adj.forEach((list, v) => list.sort((x, y) => D[v][other(edges[y], v)] - D[v][other(edges[x], v)]));
  const used = new Array(edges.length).fill(false);
  const stack = [root];
  const circuit = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    while (adj[v].length && used[adj[v][adj[v].length - 1]]) adj[v].pop();
    if (adj[v].length) {
      const id = adj[v].pop();
      used[id] = true;
      stack.push(other(edges[id], v));
    } else {
      circuit.push(stack.pop());
    }
  }
  return circuit.reverse();
}
const other = ([a, b], v) => (a === v ? b : a);

export function doubleTree(D, root = 0) {
  const { parent, weight } = primMST(D, root);
  const euler = eulerCircuit(parent, D, root);
  const seen = new Set();
  const tour = [];
  for (const v of euler) if (!seen.has(v)) { seen.add(v); tour.push(v); }
  tour.push(root);
  return { parent, mstWeight: weight, euler, eulerLength: walkLength(euler, D), tour, tourLength: walkLength(tour, D) };
}

export function doubleTreeFrames(D, names, root = 0) {
  const n = D.length;
  const r = doubleTree(D, root);
  const treeEdges = [];
  for (let v = 0; v < n; v++) if (r.parent[v] !== -1) treeEdges.push({ from: r.parent[v], to: v });
  const nodes = (fn) => Array.from({ length: n }, (_, v) => fn(v));
  const frames = [];
  const phase = (p) => (f) => frames.push({ phase: p, ...f });

  phase('1 · MST')({
    title: 'Minimum spanning tree',
    text: `Prim's algorithm connects all ${n} stops with ${n - 1} edges of total weight ${km(r.mstWeight)}. Any tour minus one edge is a spanning tree, so this is a lower bound on the optimal tour.`,
    edges: treeEdges.map((e) => ({ ...e, kind: 'tree' })),
    nodes: nodes((v) => (v === root ? 'root' : 'done')),
    stats: { 'MST': r.mstWeight },
  });

  const degree = new Array(n).fill(0);
  treeEdges.forEach(({ from, to }) => { degree[from] += 2; degree[to] += 2; });
  phase('2 · Double edges')({
    title: 'Double every edge',
    text: `Each tree edge becomes two parallel edges. Every degree is now even (${[...new Set(degree)].sort((a, b) => a - b).join(', ')}), and the multigraph is connected, so it has an Eulerian circuit of weight 2 × ${km(r.mstWeight)} = ${km(2 * r.mstWeight)}.`,
    edges: treeEdges.flatMap((e) => [{ ...e, kind: 'dbl' }, { from: e.to, to: e.from, kind: 'dbl' }]),
    nodes: nodes((v) => (v === root ? 'root' : 'done')),
    stats: { 'MST': r.mstWeight, '2 × MST': 2 * r.mstWeight },
  });

  const walked = [];
  let len = 0;
  const firstSeen = new Set([r.euler[0]]);
  for (let i = 1; i < r.euler.length; i++) {
    const a = r.euler[i - 1];
    const b = r.euler[i];
    walked.push({ from: a, to: b, kind: 'walk' });
    len += D[a][b];
    const fresh = !firstSeen.has(b);
    firstSeen.add(b);
    phase('3 · Euler tour')({
      title: `Euler tour: ${a + 1} → ${b + 1}`,
      text: fresh
        ? `Hierholzer's algorithm follows an unused edge to ${b + 1}. First visit.`
        : `Every edge is used exactly once. ${b + 1} has been visited before — the tour passes through it again.`,
      edges: [...treeEdges.flatMap((e) => [{ ...e, kind: 'faded' }]), ...walked],
      nodes: nodes((v) => (v === b ? 'current' : firstSeen.has(v) ? 'done' : 'pending')),
      stats: { '2 × MST': 2 * r.mstWeight, 'Walked': len },
    });
  }

  // shortcutting: for each consecutive pair of the Hamiltonian cycle, the
  // stretch of the Euler tour it replaces
  const firstIdx = new Map();
  r.euler.forEach((v, i) => { if (!firstIdx.has(v)) firstIdx.set(v, i); });
  const tourEdges = [];
  let tlen = 0;
  for (let i = 1; i < r.tour.length; i++) {
    const a = r.tour[i - 1];
    const b = r.tour[i];
    const end = i === r.tour.length - 1 ? r.euler.length - 1 : firstIdx.get(b);
    let start = end - 1;
    while (start > 0 && r.euler[start] !== a) start--;
    const stretch = r.euler.slice(start, end + 1);
    const skipped = new Set(stretch.slice(1, -1));
    const stretchLen = walkLength(stretch, D);
    tlen += D[a][b];
    tourEdges.push({ from: a, to: b, kind: 'tour' });
    const closing = i === r.tour.length - 1;
    phase('4 · Shortcut')({
      title: closing ? `Close the cycle: ${a + 1} → ${b + 1}` : skipped.size ? `Shortcut ${a + 1} → ${b + 1}` : `Keep ${a + 1} → ${b + 1}`,
      text: skipped.size
        ? `The Euler tour went ${stretch.map((v) => v + 1).join(' → ')} (${km(stretchLen)}), but ${[...skipped].map((v) => v + 1).join(', ')} ${skipped.size === 1 ? 'was' : 'were'} already visited. Jump straight there: ${km(D[a][b])}. Triangle inequality ⇒ never longer.`
        : `${b + 1} is next in the Euler tour and not yet visited, so this edge (${km(D[a][b])}) is kept.`,
      edges: [
        ...treeEdges.map((e) => ({ ...e, kind: 'faded' })),
        ...(skipped.size ? stretch.slice(1).map((v, k) => ({ from: stretch[k], to: v, kind: 'stretch' })) : []),
        ...tourEdges,
      ],
      nodes: nodes((v) => (v === b ? 'current' : skipped.has(v) ? 'skipped' : r.tour.slice(0, i).includes(v) ? 'done' : 'pending')),
      stats: { '2 × MST': 2 * r.mstWeight, 'Cycle so far': tlen },
    });
  }

  phase('Result')({
    title: 'Hamiltonian cycle',
    text: `Visit order ${r.tour.map((v) => v + 1).join(' → ')}. Length ${km(r.tourLength)} ≤ Euler tour ${km(r.eulerLength)} = 2 × MST ≤ 2 × optimal tour.`,
    edges: tourEdges,
    nodes: nodes((v) => (v === root ? 'root' : 'done')),
    stats: { 'MST': r.mstWeight, '2 × MST': 2 * r.mstWeight, 'Cycle': r.tourLength },
    result: r,
  });
  return frames;
}
