// Exact shortest open Hamiltonian path (Held–Karp dynamic programming).
//
// dp[S][v] = length of the shortest path that starts at an allowed start,
// visits exactly the vertex set S, and ends at v.
//   dp[{s}][s] = 0 for each allowed start s
//   dp[S ∪ {w}][w] = min over v in S of dp[S][v] + D[v][w]
// Answer = min over v of dp[V][v]. O(n²·2ⁿ) time, O(n·2ⁿ) memory — used
// only as the yardstick the MST approximation is measured against, so it
// is capped at MAX_EXACT stops (2¹⁴·14² ≈ 3.2M relaxations, instant).

export const MAX_EXACT = 14;

export function heldKarpPath(D, { fixStart = false } = {}) {
  const n = D.length;
  if (n === 0) return { length: 0, order: [] };
  if (n === 1) return { length: 0, order: [0] };
  if (n > MAX_EXACT) return null;

  const FULL = 1 << n;
  const dp = new Float64Array(FULL * n).fill(Infinity);
  const prev = new Int8Array(FULL * n).fill(-1);
  const starts = fixStart ? [0] : [...Array(n).keys()];
  for (const s of starts) dp[(1 << s) * n + s] = 0;

  for (let mask = 1; mask < FULL; mask++) {
    for (let last = 0; last < n; last++) {
      if (!(mask & (1 << last))) continue;
      const cur = dp[mask * n + last];
      if (cur === Infinity) continue;
      for (let nxt = 0; nxt < n; nxt++) {
        if (mask & (1 << nxt)) continue;
        const m2 = mask | (1 << nxt);
        const v = cur + D[last][nxt];
        if (v < dp[m2 * n + nxt]) {
          dp[m2 * n + nxt] = v;
          prev[m2 * n + nxt] = last;
        }
      }
    }
  }

  let end = 0;
  for (let v = 1; v < n; v++) if (dp[(FULL - 1) * n + v] < dp[(FULL - 1) * n + end]) end = v;
  const length = dp[(FULL - 1) * n + end];

  // Walk the parent pointers back from the best end vertex.
  const order = [];
  let mask = FULL - 1;
  let v = end;
  while (v !== -1) {
    order.push(v);
    const p = prev[mask * n + v];
    mask &= ~(1 << v);
    v = p;
  }
  order.reverse();
  return { length, order };
}
