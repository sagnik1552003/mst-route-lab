// Double-tree 2-approximation vs the exact optimum (Held–Karp) on real
// pandal clusters, plus running times.   node scripts/tspBenchmark.mjs [trials]
import { readFileSync } from 'node:fs';
import { distanceMatrix } from '../src/lib/geo.js';
import { doubleTree } from '../src/lib/doubleTree.js';
import { heldKarp, MAX_EXACT } from '../src/lib/heldKarp.js';

const PANDALS = JSON.parse(readFileSync(new URL('../src/data/pandals.json', import.meta.url), 'utf8'));
const TRIALS = Number(process.argv[2]) || 200;

let seed = 20261020; // mulberry32, so results are reproducible
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const cluster = (n) => {
  const c = PANDALS[Math.floor(rand() * PANDALS.length)];
  const k = Math.cos((c.lat * Math.PI) / 180);
  return [...PANDALS].sort((a, b) => (a.lat - c.lat) ** 2 + ((a.lng - c.lng) * k) ** 2 - ((b.lat - c.lat) ** 2 + ((b.lng - c.lng) * k) ** 2)).slice(0, n);
};

console.log(`\nDouble-tree tour ÷ optimal tour, ${TRIALS} clustered trials per n`);
console.log(' n | mean   worst  optimal% | MST/OPT');
for (let n = 4; n <= MAX_EXACT; n++) {
  let sum = 0, worst = 0, hits = 0, mst = 0;
  for (let t = 0; t < TRIALS; t++) {
    const D = distanceMatrix(cluster(n));
    const opt = heldKarp(D).length;
    const dt = doubleTree(D);
    const r = dt.tourLength / opt;
    if (r > 2 + 1e-9) throw new Error('2-approximation bound violated');
    sum += r; worst = Math.max(worst, r); if (r < 1 + 1e-9) hits++; mst += dt.mstWeight / opt;
  }
  console.log(`${String(n).padStart(2)} | ${(sum / TRIALS).toFixed(3)}  ${worst.toFixed(3)}  ${String(Math.round((100 * hits) / TRIALS)).padStart(4)}%    | ${(mst / TRIALS).toFixed(3)}`);
}

console.log('\nRunning time, ms (median of 5)');
console.log('   n | Prim + double tree | Held–Karp');
const time = (f) => { const xs = []; for (let k = 0; k < 5; k++) { const t0 = performance.now(); f(); xs.push(performance.now() - t0); } return xs.sort((a, b) => a - b)[2]; };
for (const n of [8, 10, 12, 13, 50, 200, 464]) {
  const D = distanceMatrix(PANDALS.slice(0, n));
  const a = time(() => doubleTree(D));
  const b = n <= MAX_EXACT ? time(() => heldKarp(D)).toFixed(2) : '—';
  console.log(`${String(n).padStart(4)} | ${a.toFixed(2).padStart(18)} | ${String(b).padStart(9)}`);
}
