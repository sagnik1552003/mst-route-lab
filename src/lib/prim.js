// MST-PRIM (CLRS 3rd ed. §23.2), array version for a complete graph: O(n²),
// followed by a preorder walk of the tree (CLRS §35.2.1, APPROX-TSP-TOUR).
//
//   for each u: key[u] = ∞, π[u] = NIL;  key[r] = 0;  Q = V
//   while Q ≠ ∅:
//     u = EXTRACT-MIN(Q)
//     for each v in Q:  if w(u,v) < key[v]:  π[v] = u;  key[v] = w(u,v)
//
// primMST() is the plain algorithm; primFrames() replays it one operation
// at a time, with a snapshot of key / π / Q after each, for the Prim tab.
import { km } from './geo.js';

export function primMST(D, root = 0) {
  const n = D.length;
  const key = new Array(n).fill(Infinity);
  const pi = new Array(n).fill(-1);
  const inQ = new Array(n).fill(true);
  key[root] = 0;
  let weight = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (inQ[v] && (u === -1 || key[v] < key[u])) u = v;
    inQ[u] = false;
    weight += key[u];
    for (let v = 0; v < n; v++) if (inQ[v] && D[u][v] < key[v]) { key[v] = D[u][v]; pi[v] = u; }
  }
  return { parent: pi, weight };
}

export function primFrames(D, names, root = 0) {
  const n = D.length;
  const key = new Array(n).fill(Infinity);
  const pi = new Array(n).fill(-1);
  const inQ = new Array(n).fill(true);
  key[root] = 0;
  const tree = [];
  let weight = 0;
  const frames = [];
  const label = (v) => `${v + 1}. ${names[v]}`;

  const snap = (extra) => {
    const candidates = [];
    for (let v = 0; v < n; v++) if (inQ[v] && pi[v] !== -1) candidates.push({ from: pi[v], to: v, kind: 'candidate' });
    return {
      edges: [...tree.map((e) => ({ ...e, kind: 'tree' })), ...candidates, ...(extra.edges || [])],
      nodes: Array.from({ length: n }, (_, v) => (extra.focus === v ? 'current' : extra.updated?.has(v) ? 'marked' : inQ[v] ? 'pending' : 'done')),
      table: { key: [...key], pi: [...pi], inQ: [...inQ], focus: extra.focus ?? -1, updated: extra.updated || new Set() },
      stats: { 'MST weight': weight },
      phase: '1 · MST-PRIM',
    };
  };

  frames.push({
    title: 'Initialise',
    text: `key[v] = ∞ and π[v] = NIL for every stop; key = 0 for the root, ${label(root)}. Every stop starts in the queue Q.`,
    ...snap({}),
  });

  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let v = 0; v < n; v++) if (inQ[v] && (u === -1 || key[v] < key[u])) u = v;
    inQ[u] = false;
    weight += key[u];
    if (pi[u] !== -1) tree.push({ from: pi[u], to: u });
    frames.push({
      title: `EXTRACT-MIN → ${u + 1}`,
      text:
        pi[u] === -1
          ? `${label(u)} has the smallest key (0), so it leaves Q first. It is the root of the tree.`
          : `${label(u)} has the smallest key in Q (${km(key[u])}). It joins the tree through edge (${pi[u] + 1}, ${u + 1}) — the light edge across the cut.`,
      ...snap({ focus: u, edges: pi[u] === -1 ? [] : [{ from: pi[u], to: u, kind: 'new' }] }),
    });

    const updated = new Set();
    for (let v = 0; v < n; v++) {
      if (inQ[v] && D[u][v] < key[v]) {
        key[v] = D[u][v];
        pi[v] = u;
        updated.add(v);
      }
    }
    if (updated.size) {
      frames.push({
        title: `Relax edges out of ${u + 1}`,
        text: `For every v still in Q, if w(${u + 1}, v) < key[v], set key[v] = w(${u + 1}, v) and π[v] = ${u + 1}. Updated: ${[...updated].map((v) => v + 1).join(', ')}.`,
        ...snap({ focus: u, updated }),
      });
    }
  }

  frames.push({
    title: 'Minimum spanning tree',
    text: `Q is empty. The ${n - 1} edges (π[v], v) form an MST of weight ${km(weight)}. Running time O(n²) with an array; O(E log V) = O(n² log n) with a binary heap, which is worse on a complete graph.`,
    ...snap({}),
  });

  frames.push(...preorderFrames(D, pi, tree, weight, root));
  return frames;
}

/** Preorder of the MST: depth-first from the root, nearest child first. */
export function preorder(D, parent, root = 0) {
  const n = parent.length;
  const children = Array.from({ length: n }, () => []);
  parent.forEach((p, v) => p !== -1 && children[p].push(v));
  children.forEach((c, u) => c.sort((a, b) => D[u][a] - D[u][b]));
  const order = [];
  const visit = (u) => {
    order.push(u);
    children[u].forEach(visit);
  };
  visit(root);
  return order;
}

// Phase 2: walk the finished tree in preorder. Listing each vertex the first
// time the depth-first walk reaches it, then returning to the root, gives a
// tour of length ≤ 2·w(MST) ≤ 2·OPT — the same tour the 2-Approximation tab
// builds through the Euler circuit.
function preorderFrames(D, pi, tree, weight, root) {
  const n = pi.length;
  const order = preorder(D, pi, root);
  const treeEdges = tree.map((e) => ({ ...e, kind: 'faded' }));
  const frames = [];
  const tourEdges = [];
  let len = 0;
  const table = (k) => ({ order: order.slice(0, k), pi: [...pi] });

  frames.push({
    phase: '2 · Preorder walk',
    title: `Preorder walk from ${root + 1}`,
    text: 'Walk the tree depth-first from the root, nearest child first, and list each stop the first time the walk reaches it. Consecutive stops in that list are joined directly.',
    edges: tree.map((e) => ({ ...e, kind: 'tree' })),
    nodes: Array.from({ length: n }, (_, v) => (v === root ? 'current' : 'pending')),
    preorder: table(1),
    stats: { 'MST weight': weight },
  });

  for (let k = 1; k < n; k++) {
    const a = order[k - 1];
    const v = order[k];
    len += D[a][v];
    tourEdges.push({ from: a, to: v, kind: 'tour' });
    const down = pi[v] === a;
    frames.push({
      phase: '2 · Preorder walk',
      title: `Visit ${v + 1}`,
      text: down
        ? `Go down the tree edge (${a + 1}, ${v + 1}). ${v + 1} is #${k + 1} in the preorder.`
        : `${a + 1} has no unvisited children, so the walk backs up to ${pi[v] + 1} and goes down to ${v + 1}. The tour skips the stops it already listed and jumps straight from ${a + 1} to ${v + 1} — by the triangle inequality, never longer.`,
      edges: [...treeEdges, ...tourEdges],
      nodes: Array.from({ length: n }, (_, u) => (u === v ? 'current' : order.indexOf(u) < k ? 'done' : 'pending')),
      preorder: table(k + 1),
      stats: { 'MST weight': weight, 'Tour so far': len },
    });
  }

  const last = order[n - 1];
  len += D[last][root];
  tourEdges.push({ from: last, to: root, kind: 'tour' });
  frames.push({
    phase: '2 · Preorder walk',
    title: 'Preorder tour',
    text: `Return from ${last + 1} to ${root + 1} to close the tour: ${[...order, root].map((v) => v + 1).join(' → ')}. Length ${km(len)} ≤ 2 × MST = ${km(2 * weight)} ≤ 2 × optimal.`,
    edges: [...treeEdges, ...tourEdges],
    nodes: Array.from({ length: n }, (_, v) => (v === root ? 'root' : 'done')),
    preorder: table(n),
    stats: { 'MST weight': weight, '2 × MST': 2 * weight, 'Tour': len },
  });
  return frames;
}
