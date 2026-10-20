# CLAUDE.md

Technical notes for working on this repo. It is a **single-page** React +
Vite app (no router) that visualises the metric-TSP 2-approximation on the
Pujo Yatra pandal dataset. It was split out of the full Pujo Yatra app
(landing page, explore map, pandal guides, saved/shared routes), which lives
in its own repository: https://github.com/sagnik1552003/PujoYatra

## Stack

React 18 (hooks only), Vite 5, plain JS/JSX (no TypeScript), `maplibre-gl` 5.
No router, no state library. `npm run build` is the only automated check;
verify UI changes by driving the page in headless Chromium (Playwright) and
screenshotting both themes and a phone viewport.

## Data

`src/data/pandals.json` (464 records: `n` name, `a` address, `lat`, `lng`,
`ar` area, `m` marquee, `b` bonedi) is served by `api/pandals.js` (Vercel
function) and, in dev, by `vite-pandals-dev-plugin.js`. `lib/pandals.js`
fetches it once and exports a live `PANDALS` binding; `App.jsx` renders
nothing until it has loaded, so everything below can read `PANDALS`
synchronously.

## Algorithm files (pure, importable from Node)

- `lib/mstTsp.js` — `distanceMatrix`, `primMST` (records the frontier per
  step), `preorderWalk` (children nearest-first; returns preorder + full
  walk), `shortcutTrace`, `solveMstTsp(points, {fixStart})`. Open path; with
  `fixStart:false` every root is tried (O(n³)).
- `lib/heldKarp.js` — exact optimum, capped at `MAX_EXACT` = 14.
- `lib/tspFrames.js` — run → frames. Each frame is a full snapshot (edges by
  `kind`, node `state`s, text), so scrubbing backwards = drawing frame i.

## Page structure

- `MstLab.jsx` owns state: `stops` (pandal indices, persisted to
  localStorage `mst-stops`, try/catch), `fixStart`, overlay toggles, `run`
  (a snapshot `{result, locs, stops, fixStart}` while the player is open).
- `components/Player.jsx` owns playback only and reports frames via
  `onFrame`; the page draws them.
- `components/NumbersCard.jsx` — MST ≤ OPT ≤ route ≤ 2×MST bars.
- `components/StopsPanel.jsx` — cluster generator, search, list.

## Map

All content is GeoJSON sources + style layers (`lib/mapLayers.js`), never
DOM markers. Layer colours come from CSS tokens at paint time
(`lib/theme.js → mapPalette()`), so after a theme switch the page calls
`setStyle()`; `style.load` re-adds every layer and bumps `styleVersion`,
which re-pushes all data. Any new layer must be added in `addAllLayers` and
listed in `BASE_LAYERS` (hidden during playback) or `TSP_LAYERS`. Map event
handlers are registered once, so read live state through refs
(`playingRef`). Labels use the basemap's `Noto Sans Bold` glyphs.

## Design system (`styles.css`)

"Graph paper" theme: tokens on `:root`, dark overrides on
`:root[data-theme='dark']`. Fonts: Geist (UI), Geist Mono (numbers,
eyebrows), Instrument Serif (titles, headline number). Algorithm colours are
tokens: `--c-tree`, `--c-walk`, `--c-route`, `--c-optimal`, `--accent`.
Motion: custom `--ease-out`, press feedback `scale(0.97)`, hover effects
behind `(hover: hover) and (pointer: fine)`. Every new class needs coverage in
the mobile (≤ 820px), reduced-motion, reduced-transparency and
prefers-contrast blocks at the end of the file.

## External services (free, no keys)

OpenFreeMap tiles (`lib/theme.js`), OSRM demo router for the optional road
route (`lib/routeGeometry.js`; falls back to `source:'straight-line'` with
null distance — never invent a number).
