// Map sources and layers. Everything is GeoJSON + style layers (no DOM
// markers). Colours come from the CSS tokens on :root, read when the layers
// are added — so after a light/dark switch the page re-adds them.
export const MAP_STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const EMPTY = { type: 'FeatureCollection', features: [] };
const DASHED = ['candidate', 'stretch', 'partial'];

function tokens() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return { ink: v('--ink'), muted: v('--muted'), bg: v('--bg'), accent: v('--accent'), good: v('--good'), dot: v('--dot') };
}

export function addLayers(map) {
  const c = tokens();
  ['pandals', 'edges', 'nodes'].forEach((id) => map.getSource(id) || map.addSource(id, { type: 'geojson', data: EMPTY }));

  map.addLayer({
    id: 'pandals',
    type: 'circle',
    source: 'pandals',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4.5],
      'circle-color': c.dot,
      'circle-opacity': ['case', ['get', 'inRoute'], 0, 0.6],
    },
  });

  const color = ['match', ['get', 'kind'], 'new', c.accent, 'walk', c.accent, 'stretch', c.accent, 'tour', c.accent, 'opt', c.good, 'partial', c.good, 'candidate', c.muted, 'faded', c.muted, c.ink];
  const width = ['match', ['get', 'kind'], 'candidate', 1.3, 'faded', 2, 'dbl', 1.8, 'walk', 2.4, 'stretch', 2.4, 3];
  const opacity = ['match', ['get', 'kind'], 'faded', 0.3, 'candidate', 0.8, 1];
  // a positive offset is relative to the line's direction, so A→B and B→A
  // land on opposite sides — the two copies of a doubled edge, and the two
  // passes of the Euler tour over each tree edge
  const offset = ['match', ['get', 'kind'], 'dbl', 2.5, 'walk', 3, 0];
  for (const dashed of [false, true]) {
    map.addLayer({
      id: dashed ? 'edges-dashed' : 'edges',
      type: 'line',
      source: 'edges',
      filter: dashed ? ['in', ['get', 'kind'], ['literal', DASHED]] : ['!', ['in', ['get', 'kind'], ['literal', DASHED]]],
      layout: { 'line-join': 'round', 'line-cap': dashed ? 'butt' : 'round' },
      paint: { 'line-color': color, 'line-width': width, 'line-opacity': opacity, 'line-offset': offset, ...(dashed ? { 'line-dasharray': [2, 1.6] } : {}) },
    });
  }

  const filled = ['in', ['get', 'state'], ['literal', ['done', 'root', 'current']]];
  map.addLayer({
    id: 'nodes',
    type: 'circle',
    source: 'nodes',
    paint: {
      'circle-radius': ['match', ['get', 'state'], 'current', 11, 'pending', 9, 10],
      'circle-color': ['match', ['get', 'state'], 'done', c.ink, 'root', c.ink, 'current', c.accent, c.bg],
      'circle-stroke-width': ['match', ['get', 'state'], 'root', 3, 'skipped', 2.5, 'marked', 2.5, 1.5],
      'circle-stroke-color': ['match', ['get', 'state'], 'root', c.accent, 'skipped', c.accent, 'marked', c.accent, 'pending', c.muted, c.bg],
    },
  });
  map.addLayer({
    id: 'labels',
    type: 'symbol',
    source: 'nodes',
    layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 10.5, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': ['case', filled, c.bg, c.ink] },
  });
}

const pt = (p, properties) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } });

export function setPandals(map, pandals, inRoute) {
  map.getSource('pandals')?.setData({ type: 'FeatureCollection', features: pandals.map((p, i) => pt(p, { idx: i, name: p.n, inRoute: inRoute.has(i) })) });
}

/**
 * Draws one frame: edges by kind, stops by state, labelled with their stop
 * number. `path(from, to)`, if given, returns an edge's road line; edges
 * without one are drawn straight.
 */
export function setFrame(map, locs, frame, path) {
  const nodes = locs.map((l, v) => pt(l, { state: frame ? frame.nodes[v] : 'pending', label: String(v + 1) }));
  const edges = frame
    ? frame.edges.map((e) => ({
        type: 'Feature',
        properties: { kind: e.kind },
        geometry: {
          type: 'LineString',
          coordinates: path?.(e.from, e.to) ?? [[locs[e.from].lng, locs[e.from].lat], [locs[e.to].lng, locs[e.to].lat]],
        },
      }))
    : [];
  map.getSource('edges')?.setData({ type: 'FeatureCollection', features: edges });
  map.getSource('nodes')?.setData({ type: 'FeatureCollection', features: nodes });
}
