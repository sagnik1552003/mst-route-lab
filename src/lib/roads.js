// Walking distances and routes from OSRM on OpenStreetMap data, served by
// FOSSGIS at routing.openstreetmap.de (free, no key; meant for light use, so
// the matrix is one request per stop set and route shapes are fetched only
// for the edges on screen, several per request, and cached).
const BASE = 'https://routing.openstreetmap.de/routed-foot';
const MAX_WAYPOINTS = 50;

const ll = (p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;

async function osrm(service, pts, query, signal) {
  const res = await fetch(`${BASE}/${service}/v1/foot/${pts.map(ll).join(';')}?${query}`, { signal });
  const json = await res.json();
  if (json.code !== 'Ok') throw new Error(json.message || json.code);
  return json;
}

/**
 * Walking distance matrix for `points`. OSRM gives one number per direction,
 * which can differ by a few metres; the algorithms need one per pair, so each
 * pair takes the longer. OSRM measures the fastest route, which need not obey
 * the triangle inequality, so the matrix is then closed under shortest paths
 * (Floyd–Warshall): when going via another stop is shorter, that is the
 * distance, and `next` records the detour.
 */
export async function roadMatrix(points, signal) {
  const { distances } = await osrm('table', points, 'annotations=distance', signal);
  const n = points.length;
  const D = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : Math.max(distances[i][j] ?? Infinity, distances[j][i] ?? Infinity))),
  );
  const next = Array.from({ length: n }, () => Array.from({ length: n }, (_, j) => j));
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (D[i][k] + D[k][j] < D[i][j] - 1e-6) {
          D[i][j] = D[i][k] + D[k][j];
          next[i][j] = next[i][k];
        }
  if (D.some((row) => row.some((d) => !Number.isFinite(d)))) throw new Error('some stops are not connected by road');
  return { D, next };
}

// ---------- route shapes ----------
const shapes = new Map(); // "a>b" → [[lng, lat], …]
const failed = new Set();
const shapeKey = (a, b) => `${ll(a)}>${ll(b)}`;

// on foot there are no one-way streets: the way back is the same road
function shape(a, b) {
  const s = shapes.get(shapeKey(a, b));
  if (s) return s;
  const r = shapes.get(shapeKey(b, a));
  return r ? [...r].reverse() : null;
}
const isFailed = (a, b) => failed.has(shapeKey(a, b)) || failed.has(shapeKey(b, a));

let queue = []; // [{ a, b }]
let timer = 0;
let busy = false;
let notify = () => {};

// Strings the wanted pairs into one waypoint list, so a single route request
// returns many of them as legs (the legs joining two pairs are kept as well).
function nextBatch() {
  const seq = [];
  const rest = [...queue];
  while (rest.length && seq.length <= MAX_WAYPOINTS - 2) {
    const last = seq.length ? ll(seq[seq.length - 1]) : null;
    let k = rest.findIndex((q) => ll(q.a) === last);
    if (k < 0) {
      k = rest.findIndex((q) => ll(q.b) === last);
      if (k >= 0) rest[k] = { a: rest[k].b, b: rest[k].a };
    }
    if (k < 0) {
      k = 0;
      seq.push(rest[0].a);
    }
    seq.push(rest[k].b);
    rest.splice(k, 1);
  }
  return seq;
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const seq = nextBatch();
  try {
    const { routes } = await osrm('route', seq, 'overview=false&steps=true&geometries=geojson&continue_straight=false');
    routes[0].legs.forEach((leg, i) => {
      const a = seq[i], b = seq[i + 1];
      const line = leg.steps.flatMap((s) => s.geometry.coordinates);
      // start and end on the stops themselves, not where OSRM snapped them
      shapes.set(shapeKey(a, b), [[a.lng, a.lat], ...line, [b.lng, b.lat]]);
    });
  } catch {
    for (let i = 1; i < seq.length; i++) failed.add(shapeKey(seq[i - 1], seq[i]));
  }
  queue = queue.filter((q) => !shape(q.a, q.b) && !isFailed(q.a, q.b));
  busy = false;
  notify();
  pump();
}

/**
 * Route shapes for one stop set, given `next` from roadMatrix. `path(i, j)`
 * is the walking line from stop i to stop j (through any stops the distance
 * detours via), or null while it is loading or if it failed — the map then
 * draws a straight line. `load(edges, onLoad)` fetches what `edges` need.
 */
export function roadRoutes(locs, next) {
  const legs = (i, j) => {
    const out = [];
    while (i !== j) {
      const k = next[i][j];
      out.push([locs[i], locs[k]]);
      i = k;
    }
    return out;
  };
  return {
    path(i, j) {
      const line = [];
      for (const [a, b] of legs(i, j)) {
        const s = shape(a, b);
        if (!s) return null;
        line.push(...s);
      }
      return line;
    },
    load(edges, onLoad) {
      notify = onLoad;
      const seen = new Set();
      queue = [];
      for (const e of edges)
        for (const [a, b] of legs(e.from, e.to)) {
          if (seen.has(shapeKey(a, b)) || seen.has(shapeKey(b, a)) || isFailed(a, b) || shape(a, b)) continue;
          seen.add(shapeKey(a, b));
          queue.push({ a, b });
        }
      // wait for scrubbing / autoplay to settle before asking the server
      clearTimeout(timer);
      if (queue.length) timer = setTimeout(pump, 150);
    },
  };
}
