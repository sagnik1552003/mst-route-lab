// Empirical check of the MST-preorder 2-approximation (src/lib/mstTsp.js)
// on the real pandal dataset, for the algorithms-course report.
//
//   node scripts/tspBenchmark.mjs            # default: 200 trials per n
//   node scripts/tspBenchmark.mjs 500        # more trials
//
// 1. Quality — for n = 4..12 stops, draws realistic "one evening's
//    pandal-hopping" sets (a random pandal plus its n−1 nearest
//    neighbours) and compares, on the same straight-line metric:
//      MST-preorder open path (fixed start, and best over all roots)
//      vs the exact optimum (Held–Karp DP, O(n²·2ⁿ)).
//    Reports mean / worst approximation ratio and how often it's optimal.
// 2. Running time — MST-preorder on n = 25..464 pandals, fixed root
//    (O(n²)) and all roots (O(n³)), to show the growth rates.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { distanceMatrix, mstPreorderFromRoot, solveMstTsp } from '../src/lib/mstTsp.js';

const here = dirname(fileURLToPath(import.meta.url));
const PANDALS = JSON.parse(readFileSync(join(here, '../src/data/pandals.json'), 'utf8'))
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
const TRIALS = Number(process.argv[2]) || 200;

// Small seeded PRNG (mulberry32) so the numbers in the report are reproducible.
let seed = 20261020;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Exact shortest open Hamiltonian path starting at vertex 0 (Held–Karp). */
function heldKarpPath(D, { fixStart }) {
  const n = D.length;
  const FULL = 1 << n;
  const dp = new Float64Array(FULL * n).fill(Infinity);
  const starts = fixStart ? [0] : [...Array(n).keys()];
  for (const s of starts) dp[(1 << s) * n + s] = 0;
  for (let mask = 1; mask < FULL; mask++) {
    for (let last = 0; last < n; last++) {
      const cur = dp[mask * n + last];
      if (cur === Infinity || !(mask & (1 << last))) continue;
      for (let nxt = 0; nxt < n; nxt++) {
        if (mask & (1 << nxt)) continue;
        const m2 = mask | (1 << nxt);
        const v = cur + D[last][nxt];
        if (v < dp[m2 * n + nxt]) dp[m2 * n + nxt] = v;
      }
    }
  }
  let best = Infinity;
  for (let last = 0; last < n; last++) best = Math.min(best, dp[(FULL - 1) * n + last]);
  return best;
}

function nearestCluster(n) {
  const c = PANDALS[Math.floor(rand() * PANDALS.length)];
  const d2 = (p) => (p.lat - c.lat) ** 2 + ((p.lng - c.lng) * Math.cos((c.lat * Math.PI) / 180)) ** 2;
  return [...PANDALS].sort((a, b) => d2(a) - d2(b)).slice(0, n);
}

const fmt = (x) => x.toFixed(3);
console.log(`\nQuality vs exact optimum (Held–Karp), ${TRIALS} clustered trials per n, straight-line metric`);
console.log('n  | fixed start: mean  worst  optimal% | best root: mean  worst  optimal% | MST/OPT mean');
console.log('---|-----------------------------------|---------------------------------|-------------');
const summary = [];
for (let n = 4; n <= 12; n++) {
  let sF = 0, wF = 0, oF = 0, sA = 0, wA = 0, oA = 0, sM = 0;
  for (let t = 0; t < TRIALS; t++) {
    const pts = nearestCluster(n);
    // shuffle so "the start" is an arbitrary stop, as it would be for a user
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    const D = distanceMatrix(pts);
    const optF = heldKarpPath(D, { fixStart: true });
    const optA = heldKarpPath(D, { fixStart: false });
    const fixed = mstPreorderFromRoot(pts, 0, D);
    const any = solveMstTsp(pts, { fixStart: false });
    const rF = fixed.pathLength / optF, rA = any.pathLength / optA;
    if (rF > 2 + 1e-9 || rA > 2 + 1e-9) throw new Error('2-approximation bound violated?!');
    sF += rF; wF = Math.max(wF, rF); if (rF < 1 + 1e-9) oF++;
    sA += rA; wA = Math.max(wA, rA); if (rA < 1 + 1e-9) oA++;
    sM += any.mstWeight / optA;
  }
  const row = { n, fixedMean: sF / TRIALS, fixedWorst: wF, fixedOptimal: oF / TRIALS, anyMean: sA / TRIALS, anyWorst: wA, anyOptimal: oA / TRIALS, mstOverOpt: sM / TRIALS };
  summary.push(row);
  console.log(
    `${String(n).padStart(2)} |        ${fmt(row.fixedMean)}  ${fmt(row.fixedWorst)}   ${(100 * row.fixedOptimal).toFixed(0).padStart(3)}%   |      ${fmt(row.anyMean)}  ${fmt(row.anyWorst)}   ${(100 * row.anyOptimal).toFixed(0).padStart(3)}%   |  ${fmt(row.mstOverOpt)}`
  );
}

console.log('\nRunning time (median of 7 runs, ms)');
console.log('n   | fixed root O(n²) | all roots O(n³)');
console.log('----|------------------|----------------');
const timing = [];
const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const n of [25, 50, 100, 200, 300, 464]) {
  const pts = PANDALS.slice(0, n);
  const D = distanceMatrix(pts);
  const tf = [], ta = [];
  for (let k = 0; k < 7; k++) {
    let t0 = performance.now(); mstPreorderFromRoot(pts, 0, D); tf.push(performance.now() - t0);
    if (n <= 300 || k < 3) { t0 = performance.now(); solveMstTsp(pts); ta.push(performance.now() - t0); }
  }
  timing.push({ n, fixedMs: median(tf), allRootsMs: median(ta) });
  console.log(`${String(n).padStart(3)} | ${median(tf).toFixed(2).padStart(16)} | ${median(ta).toFixed(1).padStart(14)}`);
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ summary, timing }));
