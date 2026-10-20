// Distances. Great-circle (haversine) distance is a metric — symmetric and
// obeying the triangle inequality — which is what the 2-approximation's
// shortcutting argument needs.
const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceMatrix(points) {
  const n = points.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i][j] = D[j][i] = haversine(points[i], points[j]);
  return D;
}

/** Length of a vertex sequence, edge by edge (pass the start twice for a cycle). */
export function walkLength(seq, D) {
  let t = 0;
  for (let i = 1; i < seq.length; i++) t += D[seq[i - 1]][seq[i]];
  return t;
}

export function km(m) {
  if (!Number.isFinite(m)) return '∞';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}
