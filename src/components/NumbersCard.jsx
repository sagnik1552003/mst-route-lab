import { formatKm } from '../lib/tspFrames.js';
import { MAX_EXACT } from '../lib/heldKarp.js';

// The proof, as a picture: every bar on one scale, with the 2 × MST line
// the approximation can never cross. MST ≤ optimal ≤ MST route ≤ 2 × MST.
export function NumbersCard({ n, mst, exact, inputLength, road, showRoad }) {
  if (!mst) {
    return (
      <section className="card numbers is-empty">
        <div className="card-head">
          <span className="eyebrow">The bound</span>
        </div>
        <p className="muted">Add at least two stops to see the numbers.</p>
      </section>
    );
  }

  const bound = 2 * mst.mstWeight;
  const rows = [
    { key: 'mst', label: 'MST weight', hint: 'lower bound', value: mst.mstWeight },
    exact ? { key: 'opt', label: 'Optimal route', hint: 'Held–Karp, exact', value: exact.length } : null,
    { key: 'route', label: 'MST route', hint: 'preorder walk', value: mst.pathLength },
    { key: 'input', label: 'Your order', hint: 'as listed', value: inputLength },
  ].filter(Boolean);
  const max = Math.max(bound, ...rows.map((r) => r.value)) * 1.06;
  const pct = (v) => `${(v / max) * 100}%`;
  const ratio = exact && exact.length > 0 ? mst.pathLength / exact.length : null;
  const saved = inputLength > 0 ? 1 - mst.pathLength / inputLength : 0;

  return (
    <section className="card numbers">
      <div className="card-head">
        <span className="eyebrow">The bound</span>
        <span className="bound-key">
          <i aria-hidden="true" /> 2 × MST = {formatKm(bound)}
        </span>
      </div>

      <div className="headline">
        {ratio !== null ? (
          <>
            <span className="headline-num">{ratio.toFixed(3)}×</span>
            <span className="headline-label">
              MST route vs the true optimum{ratio < 1.0005 ? ' — it found the optimum' : ''}
            </span>
          </>
        ) : (
          <>
            <span className="headline-num">≤ 2×</span>
            <span className="headline-label">
              {n} stops is too many for the exact check (limit {MAX_EXACT}); the guarantee still holds
            </span>
          </>
        )}
      </div>

      <div className="bars" style={{ '--bound': pct(bound) }}>
        {rows.map((r) => (
          <div key={r.key} className={`bar-row bar-${r.key}`}>
            <div className="bar-meta">
              <span className="bar-label">{r.label}</span>
              <span className="bar-hint">{r.hint}</span>
              <span className="bar-val">{formatKm(r.value)}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: pct(r.value) }} />
            </div>
          </div>
        ))}
      </div>

      <p className="numbers-foot">
        {saved > 0.001
          ? `The MST route is ${(saved * 100).toFixed(0)}% shorter than your current order.`
          : saved < -0.001
          ? `Your current order is already ${(-saved * 100).toFixed(0)}% shorter than the MST route.`
          : 'Your current order is the MST route.'}
        {showRoad && road && road.status === 'ok' && road.distanceMeters != null &&
          ` Driven by road (OSRM), the MST route is ${formatKm(road.distanceMeters)}.`}
        {showRoad && road && road.status === 'ok' && road.distanceMeters == null && ' Road routing is unavailable right now.'}
      </p>
    </section>
  );
}
