import { useEffect, useState } from 'react';
import { km } from '../lib/geo.js';

// Generic step player. Frames are full snapshots, so every control is just
// "show frame i". The parent draws the map from onFrame; `children(frame)`
// renders the tab-specific panel (a table) under the explanation.
// It opens on the last frame — the solution — and the steps are there to
// replay how it was reached.
export function Player({ frames, onFrame, children }) {
  const [i, setI] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);
  const last = frames.length - 1;
  const frame = frames[Math.min(i, last)];

  useEffect(() => {
    setI(frames.length - 1);
    setPlaying(false);
  }, [frames]);

  useEffect(() => onFrame(frame), [frame, onFrame]);

  useEffect(() => {
    if (!playing) return;
    if (i >= last) return setPlaying(false);
    const t = setTimeout(() => setI((x) => x + 1), 900);
    return () => clearTimeout(t);
  }, [playing, i, last]);

  // at the solution, "play" replays the steps from the beginning
  const toggle = () => (i >= last ? (setI(0), setPlaying(true)) : setPlaying((p) => !p));

  const go = (d) => {
    setPlaying(false);
    setI((x) => Math.max(0, Math.min(last, x + d)));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' && !e.target.closest('button')) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="player">
      <div className="controls">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous step">←</button>
        <button
          className="play"
          onClick={toggle}
          aria-label={playing ? 'Pause' : i >= last ? 'Show the steps' : 'Play'}
        >
          {playing ? 'Pause' : i >= last ? 'Show steps' : 'Play'}
        </button>
        <button onClick={() => go(1)} disabled={i >= last} aria-label="Next step">→</button>
        <input
          type="range"
          min={0}
          max={last}
          value={i}
          onChange={(e) => {
            setPlaying(false);
            setI(Number(e.target.value));
          }}
          aria-label="Step"
        />
        {i < last ? (
          <button className="link" onClick={() => { setPlaying(false); setI(last); }}>Result</button>
        ) : (
          <span className="count">{frames.length} steps</span>
        )}
      </div>

      {frame.phase && <p className="phase">{frame.phase}</p>}
      <h2>{frame.title}</h2>
      <p className="text">{frame.text}</p>

      {frame.stats && (
        <dl className="stats">
          {Object.entries(frame.stats).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{k === 'Subproblems' ? v.toLocaleString('en-IN') : km(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {children && children(frame)}
    </div>
  );
}
