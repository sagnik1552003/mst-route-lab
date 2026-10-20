import { km } from '../lib/geo.js';

// Prim: the key / π / in-Q arrays after the current operation.
export function PrimTable({ frame }) {
  if (frame.preorder) return <PreorderTable p={frame.preorder} />;
  const t = frame.table;
  return (
    <table className="grid">
      <thead>
        <tr><th>v</th><th>key[v]</th><th>π[v]</th><th>in Q</th></tr>
      </thead>
      <tbody>
        {t.key.map((k, v) => (
          <tr key={v} className={v === t.focus ? 'focus' : t.updated.has(v) ? 'mark' : t.inQ[v] ? '' : 'dim'}>
            <td>{v + 1}</td>
            <td>{km(k)}</td>
            <td>{t.pi[v] === -1 ? 'NIL' : t.pi[v] + 1}</td>
            <td>{t.inQ[v] ? 'yes' : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Preorder phase: the visit order so far, with each stop's tree parent.
function PreorderTable({ p }) {
  return (
    <table className="grid">
      <thead>
        <tr><th>#</th><th>stop</th><th>π[v]</th></tr>
      </thead>
      <tbody>
        {p.order.map((v, i) => (
          <tr key={v} className={i === p.order.length - 1 ? 'focus' : ''}>
            <td>{i + 1}</td>
            <td>{v + 1}</td>
            <td>{p.pi[v] === -1 ? 'root' : p.pi[v] + 1}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Held–Karp: row k = best C(S, v) over all sets of size k, per end stop v.
export function HeldKarpTable({ frame }) {
  const { rows, n } = frame.table;
  if (!rows.length) return null;
  const ends = Array.from({ length: n - 1 }, (_, i) => i + 1);
  return (
    <div className="scroll">
      <table className="grid hk">
        <thead>
          <tr>
            <th>|S|</th>
            {ends.map((v) => <th key={v}>{v + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td>{r.k}</td>
              {ends.map((v) => (
                <td key={v} className={v === r.min ? 'best' : ''}>
                  {Number.isFinite(r.values[v]) ? (r.values[v] / 1000).toFixed(2) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">km. Columns are end stops v; the last row adds the edge back to stop 1. The highlighted cell is each row's minimum.</p>
    </div>
  );
}
