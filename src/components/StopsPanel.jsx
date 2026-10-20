import { useMemo, useState } from 'react';
import { PANDALS } from '../lib/pandals.js';

const MIN_N = 3;
const MAX_N = 20;

const Icon = ({ d, size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

// Choosing stops: search the dataset, drop in a random nearby cluster, or
// click dots on the map (handled by the parent). The list order is the
// "input order" the numbers card compares against; stop 1 is the start.
export function StopsPanel({ stops, onAdd, onRemove, onMakeStart, onClear, onCluster, onFocus }) {
  const [query, setQuery] = useState('');
  const [clusterN, setClusterN] = useState(8);
  const inRoute = useMemo(() => new Set(stops), [stops]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    for (let i = 0; i < PANDALS.length && out.length < 8; i++) {
      const p = PANDALS[i];
      if (p.n.toLowerCase().includes(q) || (p.a && p.a.toLowerCase().includes(q))) out.push(i);
    }
    return out;
  }, [query]);

  return (
    <section className="card stops">
      <div className="card-head">
        <span className="eyebrow">
          Stops <span className="count">{stops.length}</span>
        </span>
        {stops.length > 0 && (
          <button type="button" className="text-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      <div className="cluster">
        <button type="button" className="btn btn-soft" onClick={() => onCluster(clusterN)}>
          <Icon d={<><circle cx="12" cy="12" r="2.5" /><circle cx="5" cy="7" r="1.6" /><circle cx="18.5" cy="6" r="1.6" /><circle cx="17" cy="18" r="1.6" /><circle cx="6" cy="17.5" r="1.6" /></>} />
          Random cluster
        </button>
        <div className="stepper" aria-label="Cluster size">
          <button type="button" onClick={() => setClusterN((n) => Math.max(MIN_N, n - 1))} disabled={clusterN <= MIN_N} aria-label="Fewer stops">
            −
          </button>
          <output aria-live="polite">{clusterN}</output>
          <button type="button" onClick={() => setClusterN((n) => Math.min(MAX_N, n + 1))} disabled={clusterN >= MAX_N} aria-label="More stops">
            +
          </button>
        </div>
      </div>

      <div className="search">
        <Icon size={15} d={<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>} />
        <input
          type="search"
          placeholder="Add a pandal by name or area…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pandals"
        />
        {results.length > 0 && (
          <ul className="search-results" role="listbox">
            {results.map((i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={inRoute.has(i)}
                  onClick={() => {
                    onAdd(i);
                    setQuery('');
                  }}
                >
                  <span className="sr-name">{PANDALS[i].n}</span>
                  <span className="sr-area">{inRoute.has(i) ? 'already added' : PANDALS[i].ar}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {stops.length === 0 ? (
        <p className="empty">
          Pick a random cluster, search above, or click any dot on the map. Each stop becomes a vertex of a complete graph.
        </p>
      ) : (
        <ol className="stop-list">
          {stops.map((idx, i) => {
            const p = PANDALS[idx];
            return (
              <li key={idx} className={`stop${i === 0 ? ' is-start' : ''}`}>
                <span className="stop-num">{i + 1}</span>
                <button type="button" className="stop-main" onClick={() => onFocus(idx)} title="Show on map">
                  <span className="stop-name">{p.n}</span>
                  <span className="stop-area">{i === 0 ? 'Start · ' : ''}{p.ar}</span>
                </button>
                {i !== 0 && (
                  <button type="button" className="icon-btn" onClick={() => onMakeStart(idx)} aria-label={`Make ${p.n} the start`} title="Make start">
                    <Icon d={<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>} />
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => onRemove(idx)} aria-label={`Remove ${p.n}`} title="Remove">
                  <Icon d={<path d="M6 6l12 12M18 6L6 18" />} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
