// MST-PRIM (CLRS 3rd ed. §23.2), array version for a complete graph: O(n²).
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
      weight,
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
  return frames;
}
