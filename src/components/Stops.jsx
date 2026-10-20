import { useMemo, useState } from 'react';

export function Stops({ pandals, stops, setStops, max, onCluster, onAdd }) {
  const [q, setQ] = useState('');
  const [size, setSize] = useState(7);
  const [drag, setDrag] = useState(null); // index being dragged
  // stop 1 is the start of every tour and the root of the tree, so order matters
  const move = (from, to) => {
    if (to < 0 || to >= stops.length || from === to) return;
    const next = [...stops];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setStops(next);
  };
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out = [];
    for (let i = 0; i < pandals.length && out.length < 6; i++) {
      if (!stops.includes(i) && (pandals[i].n.toLowerCase().includes(s) || pandals[i].a?.toLowerCase().includes(s))) out.push(i);
    }
    return out;
  }, [q, stops, pandals]);

  return (
    <section className="stops">
      <div className="row">
        <h3>Stops <span>{stops.length}</span></h3>
        <span className="spacer" />
        <button onClick={() => onCluster(size)}>Random</button>
        <input
          className="size"
          type="number"
          min={3}
          max={max}
          value={size}
          onChange={(e) => setSize(Math.max(3, Math.min(max, Number(e.target.value) || 3)))}
          aria-label="Random cluster size"
        />
        {stops.length > 0 && <button onClick={() => setStops([])}>Clear</button>}
      </div>

      <div className="search">
        <input type="search" placeholder={stops.length >= max ? `Limit of ${max} stops reached` : "Add a pandal by name or area…"} disabled={stops.length >= max} value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <ul>
            {results.map((i) => (
              <li key={i}>
                <button onClick={() => { onAdd(i); setQ(''); }}>
                  {pandals[i].n} <small>{pandals[i].ar}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {stops.length === 0 ? (
        <p className="hint">Click dots on the map, search, or pick a random cluster.</p>
      ) : (
        <ol>
          {stops.map((idx, i) => (
            <li
              key={idx}
              draggable
              className={drag === i ? 'dragging' : ''}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag(i); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); }}
              onDragEnd={() => setDrag(null)}
            >
              <span className="n">{i + 1}</span>
              <span className="name" title="Drag to reorder">{pandals[idx].n}</span>
              <button className="x" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${pandals[idx].n} up`}>↑</button>
              <button className="x" onClick={() => move(i, i + 1)} disabled={i === stops.length - 1} aria-label={`Move ${pandals[idx].n} down`}>↓</button>
              <button className="x" onClick={() => setStops(stops.filter((s) => s !== idx))} aria-label={`Remove ${pandals[idx].n}`}>×</button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
