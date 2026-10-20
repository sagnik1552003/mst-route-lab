import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PANDALS } from './lib/pandals.js';
import { MAP_STYLES, getInitialTheme, saveTheme } from './lib/theme.js';
import { solveMstTsp, distanceMatrix, pathLength } from './lib/mstTsp.js';
import { heldKarpPath, MAX_EXACT } from './lib/heldKarp.js';
import { formatKm } from './lib/tspFrames.js';
import { getRouteGeometry } from './lib/routeGeometry.js';
import {
  SRC, L, BASE_LAYERS, TSP_LAYERS, addAllLayers, setVisible, setData,
  pandalsGeoJSON, stopsGeoJSON, pathGeoJSON, orderGeoJSON, frameGeoJSON,
} from './lib/mapLayers.js';
import { StopsPanel } from './components/StopsPanel.jsx';
import { NumbersCard } from './components/NumbersCard.jsx';
import { Player } from './components/Player.jsx';

const STOPS_KEY = 'mst-stops';
// First visit: a ten-pandal South Kolkata evening, so the page opens on
// something to run rather than an empty map.
const SEED = ['Suruchi Sangha', 'Ekdalia Evergreen Club', 'Singhi Park Sarbojanin', 'Ballygunge Cultural Association', 'Hindustan Park Purbachal Club', 'Maddox Square', 'Deshapriya Park', 'Tridhara Sammilani', 'Jodhpur Park', 'Mudiali Club'];

function loadStops() {
  try {
    const saved = JSON.parse(localStorage.getItem(STOPS_KEY));
    if (Array.isArray(saved)) {
      const valid = saved.filter((i) => Number.isInteger(i) && PANDALS[i]);
      return [...new Set(valid)];
    }
  } catch {
    /* corrupt or unavailable storage — fall through to the seed */
  }
  return SEED.map((name) => PANDALS.findIndex((p) => p.n === name)).filter((i) => i >= 0);
}

const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function MstLab() {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [theme, setTheme] = useState(getInitialTheme);

  const [stops, setStops] = useState(loadStops);
  const [fixStart, setFixStart] = useState(false);
  const [showMst, setShowMst] = useState(true);
  const [showOptimal, setShowOptimal] = useState(false);
  const [showRoad, setShowRoad] = useState(false);
  const [road, setRoad] = useState(null);
  const [run, setRun] = useState(null); // { result, locs, stops } while the player is open
  const [toast, setToast] = useState(null);
  const frameRef = useRef(null);
  const playingRef = useRef(false);
  playingRef.current = !!run;

  useEffect(() => {
    try {
      localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
    } catch {
      /* ignore */
    }
  }, [stops]);

  const flash = useCallback((msg) => setToast({ msg, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- the maths, recomputed whenever the stops change ----------
  const locs = useMemo(() => stops.map((i) => ({ name: PANDALS[i].n, lat: PANDALS[i].lat, lng: PANDALS[i].lng })), [stops]);
  const D = useMemo(() => distanceMatrix(locs), [locs]);
  const mst = useMemo(() => (locs.length >= 2 ? solveMstTsp(locs, { fixStart }) : null), [locs, fixStart]);
  const exact = useMemo(() => (locs.length >= 2 && locs.length <= MAX_EXACT ? heldKarpPath(D, { fixStart }) : null), [D, locs.length, fixStart]);
  const inputLength = useMemo(() => pathLength(locs.map((_, i) => i), D), [locs, D]);
  // the same yardstick for the snapshot the player is explaining
  const runExact = useMemo(
    () => (run && run.locs.length <= MAX_EXACT ? heldKarpPath(run.result.distance, { fixStart: run.fixStart }) : null),
    [run]
  );

  // ---------- stop editing ----------
  const addStop = (i) => {
    if (stops.includes(i)) return;
    setStops((s) => [...s, i]);
  };
  const removeStop = (i) => setStops((s) => s.filter((x) => x !== i));
  const toggleStop = useCallback((i) => {
    setStops((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }, []);
  const makeStart = (i) => setStops((s) => [i, ...s.filter((x) => x !== i)]);
  const clearStops = () => setStops([]);
  const cluster = (n) => {
    const c = PANDALS[Math.floor(Math.random() * PANDALS.length)];
    const k = Math.cos((c.lat * Math.PI) / 180);
    const d2 = (p) => (p.lat - c.lat) ** 2 + ((p.lng - c.lng) * k) ** 2;
    const near = PANDALS.map((p, i) => [i, d2(p)]).sort((a, b) => a[1] - b[1]).slice(0, n).map(([i]) => i);
    // shuffle, so the listed order (and the start) is arbitrary
    for (let i = near.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [near[i], near[j]] = [near[j], near[i]];
    }
    setStops(near);
    fitTo(near.map((i) => PANDALS[i]));
  };

  // ---------- map ----------
  const fitTo = useCallback((points) => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    const b = new maplibregl.LngLatBounds();
    points.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: isMobile() ? 36 : 72, maxZoom: 15.5, duration: reducedMotion() ? 0 : 650 });
  }, []);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: MAP_STYLES[theme],
      center: [88.365, 22.54],
      zoom: 12.3,
      minZoom: 9.5,
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'dot-popup' });

    map.on('style.load', () => {
      addAllLayers(map);
      setStyleVersion((v) => v + 1);
    });
    map.once('load', () => {
      setMapReady(true);
      if (stops.length) {
        const b = new maplibregl.LngLatBounds();
        stops.forEach((i) => b.extend([PANDALS[i].lng, PANDALS[i].lat]));
        map.fitBounds(b, { padding: isMobile() ? 36 : 72, maxZoom: 15.5, duration: 0 });
      }
    });

    map.on('mousemove', L.pandals, (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      map.getCanvas().style.cursor = playingRef.current ? '' : 'pointer';
      const { name, area, inRoute } = f.properties;
      popupRef.current
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<strong></strong><span></span>`
        )
        .addTo(map);
      const el = popupRef.current.getElement();
      el.querySelector('strong').textContent = name;
      el.querySelector('span').textContent = playingRef.current ? area : `${area} · click to ${inRoute ? 'remove' : 'add'}`;
    });
    map.on('mouseleave', L.pandals, () => {
      map.getCanvas().style.cursor = '';
      popupRef.current.remove();
    });
    map.on('click', L.pandals, (e) => {
      if (playingRef.current) return;
      const f = e.features && e.features[0];
      if (f) toggleStop(f.properties.idx);
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapEl.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // theme → tokens on :root, then swap the basemap (layers re-added on style.load)
  const firstTheme = useRef(true);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c111d' : '#f4f2ec');
    saveTheme(theme);
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    mapRef.current?.setStyle(MAP_STYLES[theme]);
  }, [theme]);

  // base data
  const inRouteSet = useMemo(() => new Set(stops), [stops]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion) return;
    setData(map, SRC.pandals, pandalsGeoJSON(PANDALS, inRouteSet));
    setData(map, SRC.stops, stopsGeoJSON(locs));
    setData(map, SRC.path, pathGeoJSON(locs));
    setData(map, SRC.preview, showMst && mst ? orderGeoJSON(locs, mst.order) : null);
    setData(map, SRC.optimal, showOptimal && exact ? orderGeoJSON(locs, exact.order) : null);
    setData(map, SRC.road, showRoad && road?.source === 'osrm' ? { type: 'FeatureCollection', features: [road.geometry] } : null);
  }, [styleVersion, locs, inRouteSet, showMst, mst, showOptimal, exact, showRoad, road]);

  // road route for the current order (debounced, race-guarded)
  const roadReq = useRef(0);
  useEffect(() => {
    if (!showRoad || !mst) {
      setRoad(null);
      return;
    }
    const id = ++roadReq.current;
    setRoad({ status: 'loading' });
    const t = setTimeout(async () => {
      const r = await getRouteGeometry(mst.order.map((i) => locs[i]));
      if (id === roadReq.current) setRoad({ status: 'ok', ...r });
    }, 350);
    return () => clearTimeout(t);
  }, [showRoad, mst, locs]);

  // ---------- player ----------
  const openPlayer = () => {
    if (locs.length < 3) {
      flash('Add at least 3 stops to run the algorithm.');
      return;
    }
    const result = solveMstTsp(locs, { fixStart });
    setRun({ result, locs, stops, fixStart });
    popupRef.current?.remove();
    fitTo(locs);
  };
  const closePlayer = () => {
    setRun(null);
    frameRef.current = null;
  };
  const applyOrder = (order, source) => {
    const base = run ? run.stops : stops;
    setStops(order.map((i) => base[i]));
    closePlayer();
    flash(source || 'Stops reordered to the MST route.');
  };
  const applyNow = () => {
    if (!mst) return;
    const before = inputLength;
    applyOrder(mst.order, `Reordered: ${formatKm(before)} → ${formatKm(mst.pathLength)} (straight-line).`);
  };

  const drawFrame = useCallback(
    (frame) => {
      frameRef.current = frame;
      const map = mapRef.current;
      if (!map || !run) return;
      const g = frameGeoJSON(frame, run.locs);
      setData(map, SRC.tspEdges, g.edges);
      setData(map, SRC.tspNodes, g.nodes);
    },
    [run]
  );

  // show/hide layer groups + redraw the current frame after a style swap
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleVersion) return;
    setVisible(map, BASE_LAYERS, !run);
    setVisible(map, TSP_LAYERS, !!run);
    if (map.getLayer(L.pandals)) map.setPaintProperty(L.pandals, 'circle-opacity', run ? 0.18 : ['case', ['get', 'inRoute'], 0, 0.75]);
    if (!run) {
      setData(map, SRC.tspEdges, null);
      setData(map, SRC.tspNodes, null);
    } else if (frameRef.current) {
      drawFrame(frameRef.current);
    }
  }, [run, styleVersion, drawFrame]);

  const focusStop = (i) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [PANDALS[i].lng, PANDALS[i].lat], zoom: Math.max(map.getZoom(), 15), duration: reducedMotion() ? 0 : 600 });
  };

  return (
    <div className={`app${run ? ' is-playing' : ''}`}>
      <header className="topbar">
        <a className="brand" href="./" aria-label="Pujo Yatra MST Route Lab">
          <img src="/images/durga-face.png" alt="" width="28" height="28" />
          <span className="brand-text">
            <span className="brand-kicker">Pujo Yatra</span>
            <span className="brand-title">MST Route Lab</span>
          </span>
        </a>
        <p className="topbar-sub">Metric TSP 2-approximation · Prim's MST + preorder walk · {PANDALS.length} Kolkata pandals</p>
        <button
          type="button"
          className="theme-btn"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {theme === 'dark' ? (
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </>
            )}
          </svg>
        </button>
      </header>

      <main className="layout">
        <div className="map-col">
          <div className="map" ref={mapEl} />
          {!run && locs.length > 0 && (
            <div className="map-chips" role="group" aria-label="Map overlays">
              <button type="button" className={`chip${showMst ? ' is-on' : ''}`} onClick={() => setShowMst((v) => !v)} disabled={!mst}>
                <i className="chip-swatch mst" /> MST route
              </button>
              <button type="button" className={`chip${showOptimal ? ' is-on' : ''}`} onClick={() => setShowOptimal((v) => !v)} disabled={!exact} title={exact ? '' : `Exact optimum only computed up to ${MAX_EXACT} stops`}>
                <i className="chip-swatch optimal" /> Optimal route
              </button>
              <button type="button" className={`chip${showRoad ? ' is-on' : ''}`} onClick={() => setShowRoad((v) => !v)}>
                <i className="chip-swatch road" /> Road route
                {showRoad && road?.status === 'loading' && <span className="chip-spin" aria-label="loading" />}
              </button>
            </div>
          )}
          {toast && (
            <div className="toast" key={toast.id} role="status">
              {toast.msg}
            </div>
          )}
        </div>

        <aside className="side">
          {run ? (
            <Player result={run.result} locs={run.locs} onFrame={drawFrame} onApply={(o) => applyOrder(o)} onClose={closePlayer} />
          ) : (
            <>
              <StopsPanel
                stops={stops}
                onAdd={addStop}
                onRemove={removeStop}
                onMakeStart={makeStart}
                onClear={clearStops}
                onCluster={cluster}
                onFocus={focusStop}
              />

              <section className="card run">
                <div className="card-head">
                  <span className="eyebrow">Run</span>
                </div>
                <label className="switch-row">
                  <span>
                    <span className="switch-title">Fix the start</span>
                    <span className="switch-hint">{fixStart && locs[0] ? `Root the MST at ${locs[0].name}` : 'Try every stop as the root, keep the shortest'}</span>
                  </span>
                  <input type="checkbox" role="switch" checked={fixStart} onChange={(e) => setFixStart(e.target.checked)} />
                  <span className="switch" aria-hidden="true" />
                </label>
                <div className="run-actions">
                  <button type="button" className="btn btn-primary btn-lg" onClick={openPlayer} disabled={locs.length < 3}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                      <path d="M8 5l11 7-11 7z" />
                    </svg>
                    Watch it step by step
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={applyNow} disabled={locs.length < 3}>
                    Apply MST order
                  </button>
                </div>
              </section>
            </>
          )}

          <NumbersCard n={locs.length} mst={run ? run.result : mst} exact={run ? runExact : exact} inputLength={run ? pathLength(run.locs.map((_, i) => i), run.result.distance) : inputLength} road={road} showRoad={showRoad && !run} />

          <details className="card about">
            <summary>
              <span className="eyebrow">How it works</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <ol className="about-steps">
              <li><b>Complete graph.</b> Every pair of stops is joined by an edge weighted by great-circle distance — a metric, so the triangle inequality holds.</li>
              <li><b>Prim's MST</b> from the root, array version: O(n²) on a complete graph.</li>
              <li><b>Full walk.</b> DFS the tree, writing every visit including backtracks. It crosses each tree edge twice: length 2·MST.</li>
              <li><b>Shortcut.</b> Keep each stop's first visit only (the preorder). By the triangle inequality, jumping ahead never adds length.</li>
            </ol>
            <p className="about-proof">
              route ≤ walk = 2·MST ≤ 2·OPT, because the optimal route is itself a spanning tree, so MST ≤ OPT. The route is open (no return edge), which can only shorten it.
            </p>
            <p className="about-proof muted">
              Exact optimum: Held–Karp DP, O(n²·2ⁿ), shown up to {MAX_EXACT} stops. Distances are straight-line; road distances can break the triangle inequality, so the road route is drawn for reference only.
            </p>
          </details>
        </aside>
      </main>
    </div>
  );
}
