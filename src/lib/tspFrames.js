// Turns one solveMstTsp() result into a flat list of animation frames —
// every frame is a complete, self-contained description of what the map
// should show at that step (so stepping backwards is just "draw frame
// i-1", no undo logic). Pure data, no map code: TspAnimator.jsx is the
// only thing that knows how a frame becomes GeoJSON.
//
// Edge kinds (used as the `kind` property on each line feature):
//   candidate  Prim's frontier: each outside stop's cheapest link to the tree
//   new        the light edge Prim's is about to add
//   tree       an MST edge
//   walk       a full-walk step going down the tree
//   back       a full-walk step climbing back up (a revisit)
//   stretch    the part of the walk a shortcut is replacing
//   tour       an edge of the final preorder path
// Node states: pending | tree | root | current | visited | skipped

export const PHASES = [
  { key: 'prim', label: "Prim's MST" },
  { key: 'walk', label: 'Full walk' },
  { key: 'shortcut', label: 'Shortcut' },
  { key: 'done', label: 'Result' },
];

export function formatKm(meters) {
  if (!Number.isFinite(meters)) return '—';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

export function buildFrames(result, names) {
  const { root, primSteps, walk, legs, order, mstWeight } = result;
  const n = names.length;
  const frames = [];
  const nm = (i) => names[i];
  const nodes = (fn) => Array.from({ length: n }, (_, v) => fn(v));
  const rankOf = new Map(order.map((v, i) => [v, i + 1]));

  // ---------- phase 1: Prim's ----------
  const treeEdges = [];
  const inTree = new Set([root]);
  frames.push({
    phase: 'prim',
    title: `Start Prim's at ${nm(root)}`,
    text:
      'The tree starts as just the root. Every stop gets a complete-graph edge to every other stop, ' +
      'weighted by straight-line (great-circle) distance.',
    edges: [],
    nodes: nodes((v) => (v === root ? 'root' : 'pending')),
    order: [],
    treeWeight: 0,
  });
  for (let k = 1; k < primSteps.length; k++) {
    const s = primSteps[k];
    // Choosing: frontier dashed, light edge highlighted.
    frames.push({
      phase: 'prim',
      title: `Light edge: ${nm(s.parent)} — ${nm(s.vertex)}`,
      text:
        `Dashed lines are each remaining stop's cheapest link into the tree. The shortest of them ` +
        `(${formatKm(s.weight)}) crosses the cut, so by the cut property it belongs to some MST — add ${nm(s.vertex)}.`,
      edges: [
        ...treeEdges.map((e) => ({ ...e, kind: 'tree' })),
        ...s.frontier.filter((f) => f.to !== s.vertex).map((f) => ({ from: f.from, to: f.to, kind: 'candidate' })),
        { from: s.parent, to: s.vertex, kind: 'new' },
      ],
      nodes: nodes((v) => (v === root ? 'root' : v === s.vertex ? 'current' : inTree.has(v) ? 'tree' : 'pending')),
      order: [],
      treeWeight: s.treeWeight - s.weight,
    });
    treeEdges.push({ from: s.parent, to: s.vertex });
    inTree.add(s.vertex);
  }
  frames.push({
    phase: 'prim',
    title: 'Minimum spanning tree complete',
    text: `${n - 1} edges connect all ${n} stops with total weight ${formatKm(mstWeight)}. ` +
      'Any route that visits every stop is itself a spanning tree, so this is a lower bound on the best route.',
    edges: treeEdges.map((e) => ({ ...e, kind: 'tree' })),
    nodes: nodes((v) => (v === root ? 'root' : 'tree')),
    order: [],
    treeWeight: mstWeight,
  });

  // ---------- phase 2: the full walk (DFS, backtracks included) ----------
  const seen = new Set([walk[0]]);
  const walkEdges = [];
  const preorderSoFar = [walk[0]];
  let walked = 0;
  for (let j = 1; j < walk.length; j++) {
    const a = walk[j - 1];
    const b = walk[j];
    const isBack = seen.has(b);
    walked += result.distance[a][b];
    walkEdges.push({ from: a, to: b, kind: isBack ? 'back' : 'walk' });
    if (!isBack) {
      seen.add(b);
      preorderSoFar.push(b);
    }
    frames.push({
      phase: 'walk',
      title: isBack ? `Back up to ${nm(b)}` : `Down to ${nm(b)}`,
      text: isBack
        ? `${nm(a)}'s subtree is finished, so the depth-first walk climbs back to ${nm(b)} — a stop it has already seen.`
        : `Depth-first, nearest child first: ${nm(a)} → ${nm(b)}. First visit, so ${nm(b)} is #${preorderSoFar.length} in the preorder.`,
      edges: [...treeEdges.map((e) => ({ ...e, kind: 'tree-faded' })), ...walkEdges],
      nodes: nodes((v) => (v === b ? 'current' : seen.has(v) ? 'visited' : 'tree')),
      order: [...preorderSoFar],
      walked,
    });
  }
  frames.push({
    phase: 'walk',
    title: 'Full walk = 2 × MST',
    text: `The walk crossed every tree edge twice (down and back up): ${formatKm(walked)} = 2 × ${formatKm(mstWeight)}. ` +
      'It visits everything but repeats stops. The first-visit order is the preorder.',
    edges: [...treeEdges.map((e) => ({ ...e, kind: 'tree-faded' })), ...walkEdges],
    nodes: nodes(() => 'visited'),
    order: [...order],
    walked,
  });

  // ---------- phase 3: shortcutting ----------
  const tourEdges = [];
  let tourLen = 0;
  legs.forEach((leg, i) => {
    tourLen += leg.direct;
    tourEdges.push({ from: leg.from, to: leg.to, kind: 'tour' });
    const skipped = new Set(leg.skipped);
    const stretchEdges = [];
    if (leg.skipped.length) {
      const seq = [leg.from, ...leg.skipped, leg.to];
      for (let k = 1; k < seq.length; k++) stretchEdges.push({ from: seq[k - 1], to: seq[k], kind: 'stretch' });
    }
    frames.push({
      phase: 'shortcut',
      title: leg.skipped.length ? `Shortcut ${nm(leg.from)} → ${nm(leg.to)}` : `Keep ${nm(leg.from)} → ${nm(leg.to)}`,
      text: leg.skipped.length
        ? `The walk went ${[leg.from, ...leg.skipped, leg.to].map(nm).join(' → ')} (${formatKm(leg.stretchLength)}), ` +
          `but ${leg.skipped.map(nm).join(', ')} ${leg.skipped.length === 1 ? 'was' : 'were'} already visited. ` +
          `Jump straight there: ${formatKm(leg.direct)}. Triangle inequality ⇒ never longer.`
        : `${nm(leg.to)} comes right after ${nm(leg.from)} in the walk, so this edge (${formatKm(leg.direct)}) stays as is.`,
      edges: [...treeEdges.map((e) => ({ ...e, kind: 'tree-faded' })), ...stretchEdges, ...tourEdges],
      nodes: nodes((v) =>
        v === leg.to ? 'current' : skipped.has(v) ? 'skipped' : order.indexOf(v) <= i ? 'visited' : 'tree'
      ),
      order: order.slice(0, i + 2),
      tourLen,
    });
  });

  // ---------- result ----------
  frames.push({
    phase: 'done',
    title: 'Preorder route',
    text:
      `Route length ${formatKm(result.pathLength)} ≤ full walk ${formatKm(result.walkLength)} = 2 × MST. ` +
      `And MST ≤ the optimal route, so this route is at most twice the optimum. ` +
      `(Open path: the return edge to the start is simply never added, which can only shorten it.)`,
    edges: tourEdges.map((e) => ({ ...e, kind: 'tour' })),
    nodes: nodes((v) => (v === order[0] ? 'root' : 'visited')),
    order: [...order],
    tourLen: result.pathLength,
  });

  frames.forEach((f) => {
    f.ranks = f.order.length ? new Map(f.order.map((v, i) => [v, i + 1])) : null;
  });
  frames.rankOf = rankOf;
  return frames;
}
