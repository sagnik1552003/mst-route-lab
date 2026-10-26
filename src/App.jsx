import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// maplibre-gl 6 is ESM with named exports only (no default export). Its
// worker is a separate file that it looks for next to itself, which breaks
// once Vite bundles the library, so point it at the file explicitly.
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import PANDALS from './data/pandals.json';
import { distanceMatrix } from './lib/geo.js';
import { primFrames } from './lib/prim.js';
import { doubleTreeFrames } from './lib/doubleTree.js';
import { heldKarp, heldKarpFrames, MAX_EXACT } from './lib/heldKarp.js';
import { roadMatrix, roadRoutes } from './lib/roads.js';
import { MAP_STYLE, addLayers, setPandals, setFrame } from './lib/map.js';
import { Player } from './components/Player.jsx';
import { Stops } from './components/Stops.jsx';
import { PrimTable, HeldKarpTable } from './components/Tables.jsx';

maplibregl.setWorkerUrl(workerUrl);

const TABS = [
  { id: 'hk', label: 'Held–Karp' },
  { id: 'approx', label: '2-Approximation' },
  { id: 'prim', label: 'MST-Prim' },
];
const MODES = [
  { id: 'line', label: 'Straight' },
  { id: 'walk', label: 'Walking' },
];
const MAX_STOPS = 20;
const KEY = 'mst-stops';
const MODE_KEY = 'mst-distance';
const SEED = ['Suruchi Sangha', 'Ekdalia Evergreen Club', 'Singhi Park Sarbojanin', 'Ballygunge Cultural Association', 'Maddox Square', 'Deshapriya Park', 'Tridhara Sammilani', 'Jodhpur Park'];

function initialStops() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(s)) return [...new Set(s.filter((i) => Number.isInteger(i) && PANDALS[i]))].slice(0, MAX_STOPS);
  } catch {
    /* unavailable storage */
  }
  return SEED.map((n) => PANDALS.findIndex((p) => p.n === n)).filter((i) => i >= 0);
}

const dark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export default function App() {
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === location.hash.slice(1)) ? location.hash.slice(1) : 'hk'));
  const [stops, setStops] = useState(initialStops);
  const [mode, setMode] = useState(() => {
    try { return MODES.some((m) => m.id === localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : 'line'; } catch { return 'line'; }
  });
  const [road, setRoad] = useState(null); // walking distances: { locs, D, next } or { locs, error }
  const [styleVersion, setStyleVersion] = useState(0);
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(stops)); } catch { /* ignore */ }
  }, [stops]);
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);
  useEffect(() => { history.replaceState(null, '', `#${tab}`); }, [tab]);

  const locs = useMemo(() => stops.map((i) => ({ name: PANDALS[i].n, lat: PANDALS[i].lat, lng: PANDALS[i].lng })), [stops]);
  const names = useMemo(() => locs.map((l) => l.name), [locs]);

  // walking distances: one request per stop set, after clicks have settled
  useEffect(() => {
    if (mode === 'line' || locs.length < 3 || (road?.locs === locs && road.D)) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      roadMatrix(locs, ctrl.signal).then(
        (r) => setRoad({ locs, ...r }),
        (e) => ctrl.signal.aborted || setRoad({ locs, error: e.message }),
      );
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [mode, locs, road]);
  const roadNow = mode !== 'line' && road?.locs === locs ? road : null;
  const roadLoading = mode !== 'line' && locs.length >= 3 && !roadNow;
  const roadFailed = !!roadNow?.error;

  // straight lines unless walking distances are in (or failed to arrive)
  const D = useMemo(
    () => (roadNow?.D ? roadNow.D : roadLoading ? null : distanceMatrix(locs)),
    [roadNow, roadLoading, locs],
  );
  const routes = useMemo(() => (roadNow?.D ? roadRoutes(locs, roadNow.next) : null), [roadNow, locs]);

  const frames = useMemo(() => {
    if (locs.length < 3 || !D) return null;
    if (tab === 'prim') return primFrames(D, names);
    if (tab === 'approx') return doubleTreeFrames(D, names);
    return heldKarpFrames(D, names);
  }, [tab, D, names, locs.length]);

  // the exact optimum, to put the approximation's result in context
  const opt = useMemo(() => (tab === 'approx' && D && locs.length >= 3 && locs.length <= MAX_EXACT ? heldKarp(D) : null), [tab, D, locs.length]);

  // ---------- map ----------
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLE[dark() ? 'dark' : 'light'],
      center: [88.36, 22.54],
      zoom: 12,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('style.load', () => {
      addLayers(map);
      setStyleVersion((v) => v + 1);
    });
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: 'tip' });
    map.on('mousemove', 'pandals', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features[0];
      tip.setLngLat(f.geometry.coordinates).setText(f.properties.name).addTo(map);
    });
    map.on('mouseleave', 'pandals', () => {
      map.getCanvas().style.cursor = '';
      tip.remove();
    });
    map.on('click', 'pandals', (e) => {
      const idx = e.features[0].properties.idx;
      setStops((s) => (s.includes(idx) ? s.filter((x) => x !== idx) : s.length < MAX_STOPS ? [...s, idx] : s));
    });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => map.setStyle(MAP_STYLE[mq.matches ? 'dark' : 'light']);
    mq.addEventListener('change', onScheme);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapEl.current);
    return () => {
      mq.removeEventListener('change', onScheme);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const fit = useCallback((pts) => {
    const map = mapRef.current;
    if (!map || !pts.length) return;
    const b = new maplibregl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 500 });
  }, []);

  // fit once the map is up, and whenever a whole new set of stops arrives
  const fitted = useRef(false);
  useEffect(() => {
    if (styleVersion && !fitted.current && locs.length) {
      fitted.current = true;
      fit(locs);
    }
  }, [styleVersion, locs, fit]);

  const inRoute = useMemo(() => new Set(stops), [stops]);
  useEffect(() => {
    if (styleVersion) setPandals(mapRef.current, PANDALS, inRoute);
  }, [styleVersion, inRoute]);

  // on foot, edges are drawn straight until their walking route has
  // loaded, then the frame is redrawn
  const drawRef = useRef(null);
  const draw = useCallback((frame) => {
    frameRef.current = frame;
    if (!mapRef.current) return;
    setFrame(mapRef.current, locs, frame, routes?.path);
    if (routes && frame) routes.load(frame.edges, () => drawRef.current(frameRef.current));
  }, [locs, routes]);
  drawRef.current = draw;
  useEffect(() => {
    if (styleVersion) draw(frames ? frameRef.current : null);
  }, [styleVersion, frames, draw]);

  const cluster = (n) => {
    const c = PANDALS[Math.floor(Math.random() * PANDALS.length)];
    const k = Math.cos((c.lat * Math.PI) / 180);
    const near = PANDALS.map((p, i) => [i, (p.lat - c.lat) ** 2 + ((p.lng - c.lng) * k) ** 2])
      .sort((a, b) => a[1] - b[1])
      .slice(0, n)
      .map(([i]) => i);
    setStops(near);
    fit(near.map((i) => PANDALS[i]));
  };

  // a searched pandal may be off-screen: add it, then frame every stop
  const addFromSearch = (i) => {
    if (stops.includes(i) || stops.length >= MAX_STOPS) return;
    const next = [...stops, i];
    setStops(next);
    fit(next.map((j) => PANDALS[j]));
  };

  const tooMany = tab === 'hk' && locs.length > MAX_EXACT;

  return (
    <div className="app">
      <header>
        <h1>MST Route Lab</h1>
        <nav role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <aside>
          <Stops pandals={PANDALS} stops={stops} setStops={setStops} max={MAX_STOPS} onCluster={cluster} onAdd={addFromSearch} />

          <section className="dist">
            <div className="row">
              <h3>Distances</h3>
              <span className="spacer" />
              <div className="seg" role="radiogroup" aria-label="Distances">
                {MODES.map((m) => (
                  <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="hint">
              {mode === 'line'
                ? 'Straight-line (great-circle) distances.'
                : roadFailed
                  ? `Couldn't get walking distances (${roadNow.error}), so these are straight lines.`
                  : 'Shortest walking routes on OpenStreetMap roads (OSRM).'}
            </p>
          </section>

          {locs.length < 3 ? (
            <p className="hint">Add at least 3 stops.</p>
          ) : tooMany ? (
            <p className="hint">Held–Karp is exponential: this tab is limited to {MAX_EXACT} stops. Remove {locs.length - MAX_EXACT} to run it.</p>
          ) : roadLoading ? (
            <p className="hint">Fetching walking distances…</p>
          ) : (
            frames && (
              <Player key={tab} frames={frames} onFrame={draw}>
                {(f) =>
                  tab === 'prim' ? (
                    <PrimTable frame={f} />
                  ) : tab === 'hk' ? (
                    <HeldKarpTable frame={f} />
                  ) : f.result && opt ? (
                    <p className="note">
                      Exact optimum (Held–Karp): {(opt.length / 1000).toFixed(2)} km — this cycle is {(f.result.tourLength / opt.length).toFixed(3)}× the optimum, within the 2× guarantee.
                    </p>
                  ) : null
                }
              </Player>
            )
          )}
        </aside>
        <div className="map" ref={mapEl} />
      </main>
    </div>
  );
}
