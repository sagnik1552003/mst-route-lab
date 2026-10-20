import { useEffect, useMemo, useState } from 'react';
import { buildFrames, formatKm, PHASES } from '../lib/tspFrames.js';

// Step-by-step player for one MST-preorder run. Owns only playback state;
// drawing is the parent's job — every frame change is reported through
// onFrame(frame), and every frame is a full snapshot (lib/tspFrames.js),
// so scrubbing backwards is as cheap as stepping forwards.

const SPEEDS = [
  { label: '0.5×', ms: 1800 },
  { label: '1×', ms: 1000 },
  { label: '2×', ms: 500 },
  { label: '4×', ms: 250 },
];

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export function Player({ result, locs, onFrame, onApply, onClose }) {
  const names = useMemo(() => locs.map((l) => l.name), [locs]);
  const frames = useMemo(() => buildFrames(result, names), [result, names]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(1);
  const last = frames.length - 1;
  const frame = frames[Math.min(index, last)];

  useEffect(() => {
    onFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), SPEEDS[speedIdx].ms);
    return () => clearTimeout(t);
  }, [playing, index, last, speedIdx]);

  const step = (d) => {
    setPlaying(false);
    setIndex((i) => Math.max(0, Math.min(last, i + d)));
  };
  const togglePlay = () => {
    if (index >= last) {
      setIndex(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  };

  // ← → step, space plays/pauses, Esc closes. Ignored while typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input[type="text"], input[type="search"], textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, last]);

  const phaseIdx = PHASES.findIndex((p) => p.key === frame.phase);
  const jump = (key) => {
    const i = frames.findIndex((f) => f.phase === key);
    if (i >= 0) {
      setPlaying(false);
      setIndex(i);
    }
  };

  const running =
    frame.phase === 'prim'
      ? { label: 'Tree weight', value: frame.treeWeight }
      : frame.phase === 'walk'
      ? { label: 'Walked', value: frame.walked }
      : { label: 'Route so far', value: frame.tourLen };

  return (
    <section className="card player" aria-label="MST approximation, step by step">
      <div className="card-head">
        <span className="eyebrow">Step by step · {locs.length} stops</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close and go back to stops">
          <Icon d={<path d="M6 6l12 12M18 6L6 18" />} />
        </button>
      </div>

      <ol className="phases">
        {PHASES.map((p, i) => (
          <li key={p.key}>
            <button
              type="button"
              className={`phase${i === phaseIdx ? ' is-active' : ''}${i < phaseIdx ? ' is-done' : ''}`}
              onClick={() => jump(p.key)}
              aria-current={i === phaseIdx ? 'step' : undefined}
            >
              <span className="phase-num">{i + 1}</span>
              <span className="phase-label">{p.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="player-copy" key={index}>
        <h2 className="player-title">{frame.title}</h2>
        <p className="player-text" aria-live="polite">{frame.text}</p>
      </div>

      <div className="scrub">
        <div className="scrub-fill" style={{ transform: `scaleX(${last ? index / last : 1})` }} aria-hidden="true" />
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          aria-label={`Step ${index + 1} of ${frames.length}`}
        />
      </div>

      <div className="transport">
        <button type="button" className="t-btn" onClick={() => step(-Infinity)} disabled={index === 0} aria-label="First step">
          <Icon d={<><path d="M6 5v14" /><path d="M18 6l-8 6 8 6z" /></>} />
        </button>
        <button type="button" className="t-btn" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous step">
          <Icon d={<path d="M15 6l-6 6 6 6" />} />
        </button>
        <button type="button" className="t-btn t-play" onClick={togglePlay} aria-label={playing ? 'Pause' : index >= last ? 'Replay' : 'Play'}>
          {playing ? (
            <Icon d={<><path d="M9 6v12" /><path d="M15 6v12" /></>} />
          ) : index >= last ? (
            <Icon d={<><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /></>} />
          ) : (
            <Icon d={<path d="M8 5l11 7-11 7z" />} />
          )}
        </button>
        <button type="button" className="t-btn" onClick={() => step(1)} disabled={index >= last} aria-label="Next step">
          <Icon d={<path d="M9 6l6 6-6 6" />} />
        </button>
        <button type="button" className="t-btn" onClick={() => step(Infinity)} disabled={index >= last} aria-label="Last step">
          <Icon d={<><path d="M18 5v14" /><path d="M6 6l8 6-8 6z" /></>} />
        </button>
        <span className="step-count">
          {index + 1}<span>/{frames.length}</span>
        </span>
        <div className="speed" role="radiogroup" aria-label="Playback speed">
          {SPEEDS.map((s, i) => (
            <button key={s.label} type="button" role="radio" aria-checked={i === speedIdx} className={i === speedIdx ? 'is-on' : ''} onClick={() => setSpeedIdx(i)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="kv">
        <div>
          <dt>MST weight</dt>
          <dd>{formatKm(result.mstWeight)}</dd>
        </div>
        <div>
          <dt>2 × MST bound</dt>
          <dd>{formatKm(2 * result.mstWeight)}</dd>
        </div>
        <div className="kv-live">
          <dt>{running.label}</dt>
          <dd>{formatKm(running.value)}</dd>
        </div>
      </dl>

      <Legend phase={frame.phase} />

      {frame.order.length > 0 && (
        <ol className="preorder" aria-label="Preorder so far">
          {frame.order.map((v) => (
            <li key={v} className={frame.nodes[v] === 'current' ? 'is-current' : ''}>
              {names[v]}
            </li>
          ))}
        </ol>
      )}

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Back to stops
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(result.order)}>
          Use this order
        </button>
      </div>
    </section>
  );
}

function Legend({ phase }) {
  const items =
    phase === 'prim'
      ? [['line tree', 'MST edge'], ['line accent', 'Light edge'], ['line dashed', 'Cheapest link (frontier)']]
      : phase === 'walk'
      ? [['line walk', 'Walk down'], ['line walk-dashed', 'Climb back up'], ['line tree faded', 'Tree']]
      : [['line route', 'Route'], ['line accent-dashed', 'Stretch replaced'], ['dot skipped', 'Revisit skipped']];
  return (
    <ul className="legend" aria-hidden="true">
      {items.map(([cls, label]) => (
        <li key={label}>
          <i className={`lg ${cls}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
