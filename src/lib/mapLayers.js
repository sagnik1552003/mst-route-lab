// Every source/layer the map draws, in one place. All map content is
// GeoJSON + style layers (no DOM markers), so 464 pandals stay cheap and a
// theme switch is just: setStyle → addAllLayers → push the same data back.
import { mapPalette } from './theme.js';

export const SRC = {
  pandals: 'pandals',
  path: 'path',
  preview: 'preview',
  road: 'road',
  optimal: 'optimal',
  stops: 'stops',
  tspEdges: 'tsp-edges',
  tspNodes: 'tsp-nodes',
};

export const L = {
  pandals: 'pandals-dot',
  optimal: 'optimal-line',
  roadCasing: 'road-casing',
  road: 'road-line',
  path: 'path-line',
  preview: 'preview-line',
  tspSolid: 'tsp-edges-solid',
  tspDashed: 'tsp-edges-dashed',
  stops: 'stops-circle',
  stopsLabel: 'stops-label',
  tspNodes: 'tsp-nodes-circle',
  tspLabels: 'tsp-nodes-label',
};

const EMPTY = { type: 'FeatureCollection', features: [] };
const FONT = ['Noto Sans Bold'];
const DASHED = ['candidate', 'back', 'stretch'];

// Layers that make up the normal "your stops" view; hidden while the
// step-by-step player owns the map.
export const BASE_LAYERS = [L.optimal, L.roadCasing, L.road, L.path, L.preview, L.stops, L.stopsLabel];
export const TSP_LAYERS = [L.tspSolid, L.tspDashed, L.tspNodes, L.tspLabels];

export function addAllLayers(map) {
  const c = mapPalette();
  Object.values(SRC).forEach((id) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY });
  });

  map.addLayer({
    id: L.pandals,
    type: 'circle',
    source: SRC.pandals,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.2, 13, 4, 16, 6.5],
      'circle-color': c.dot,
      'circle-opacity': ['case', ['get', 'inRoute'], 0, 0.75],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 13, 1],
      'circle-stroke-color': c.paper,
      'circle-stroke-opacity': ['case', ['get', 'inRoute'], 0, 0.9],
    },
  });

  map.addLayer({
    id: L.optimal,
    type: 'line',
    source: SRC.optimal,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': c.optimal, 'line-width': 3, 'line-opacity': 0.85, 'line-dasharray': [1, 1.6], 'line-offset': -3 },
  });
  map.addLayer({
    id: L.roadCasing,
    type: 'line',
    source: SRC.road,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': c.paper, 'line-width': 7, 'line-opacity': 0.9 },
  });
  map.addLayer({
    id: L.road,
    type: 'line',
    source: SRC.road,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': c.ink, 'line-width': 3, 'line-opacity': 0.75 },
  });
  map.addLayer({
    id: L.path,
    type: 'line',
    source: SRC.path,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    // the stops in their listed order — the "before" picture
    paint: { 'line-color': c.inkDim, 'line-width': 1.6, 'line-opacity': 0.55, 'line-dasharray': [2, 2] },
  });
  map.addLayer({
    id: L.preview,
    type: 'line',
    source: SRC.preview,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': c.route, 'line-width': 3.5, 'line-opacity': 0.95 },
  });

  const edgeColor = [
    'match', ['get', 'kind'],
    'tree', c.tree, 'tree-faded', c.tree,
    'new', c.accent,
    'candidate', c.inkDim,
    'walk', c.walk, 'back', c.walk,
    'stretch', c.accent,
    'tour', c.route,
    c.ink,
  ];
  const edgeWidth = ['match', ['get', 'kind'], 'tour', 4.5, 'new', 5, 'tree', 4, 'tree-faded', 3, 'stretch', 3, 'candidate', 1.4, 2.6];
  const edgeOpacity = ['match', ['get', 'kind'], 'tree-faded', 0.22, 'candidate', 0.65, 1];
  // The walk crosses each tree edge twice in opposite directions; an offset
  // puts the down-step and the up-step on opposite sides of the edge.
  const edgeOffset = ['match', ['get', 'kind'], 'walk', 3.5, 'back', 3.5, 0];
  map.addLayer({
    id: L.tspSolid,
    type: 'line',
    source: SRC.tspEdges,
    filter: ['!', ['in', ['get', 'kind'], ['literal', DASHED]]],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': edgeColor, 'line-width': edgeWidth, 'line-opacity': edgeOpacity, 'line-offset': edgeOffset },
  });
  map.addLayer({
    id: L.tspDashed,
    type: 'line',
    source: SRC.tspEdges,
    filter: ['in', ['get', 'kind'], ['literal', DASHED]],
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: {
      'line-color': edgeColor,
      'line-width': edgeWidth,
      'line-opacity': edgeOpacity,
      'line-offset': edgeOffset,
      'line-dasharray': [2, 1.5],
    },
  });

  map.addLayer({
    id: L.stops,
    type: 'circle',
    source: SRC.stops,
    paint: {
      'circle-radius': 11,
      'circle-color': ['case', ['get', 'start'], c.ink, c.paper],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': ['case', ['get', 'start'], c.paper, c.ink],
    },
  });
  map.addLayer({
    id: L.stopsLabel,
    type: 'symbol',
    source: SRC.stops,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT,
      'text-size': 11,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': ['case', ['get', 'start'], c.paper, c.ink] },
  });

  map.addLayer({
    id: L.tspNodes,
    type: 'circle',
    source: SRC.tspNodes,
    paint: {
      'circle-radius': ['match', ['get', 'state'], 'current', 12, 'pending', 6.5, 'skipped', 10, 10],
      'circle-color': [
        'match', ['get', 'state'],
        'pending', c.paper,
        'tree', c.tree,
        'root', c.ink,
        'current', c.accent,
        'visited', c.route,
        'skipped', c.paper,
        c.paper,
      ],
      'circle-stroke-width': ['match', ['get', 'state'], 'skipped', 3, 2],
      'circle-stroke-color': ['match', ['get', 'state'], 'skipped', c.accent, 'pending', c.inkDim, c.paper],
    },
  });
  map.addLayer({
    id: L.tspLabels,
    type: 'symbol',
    source: SRC.tspNodes,
    filter: ['has', 'label'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT,
      'text-size': 11,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': ['match', ['get', 'state'], 'skipped', c.accent, c.paper] },
  });
}

export function setVisible(map, ids, visible) {
  ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'));
}

export function setData(map, id, data) {
  const src = map.getSource(id);
  if (src) src.setData(data || EMPTY);
}

const pt = (lng, lat, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } });
const line = (coords, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: coords } });
const fc = (features) => ({ type: 'FeatureCollection', features });

export function pandalsGeoJSON(pandals, inRoute) {
  return fc(pandals.map((p, i) => pt(p.lng, p.lat, { idx: i, name: p.n, area: p.ar, inRoute: inRoute.has(i) })));
}

export function stopsGeoJSON(locs) {
  return fc(locs.map((l, i) => pt(l.lng, l.lat, { label: String(i + 1), start: i === 0 })));
}

export function pathGeoJSON(locs) {
  if (locs.length < 2) return fc([]);
  return fc([line(locs.map((l) => [l.lng, l.lat]))]);
}

export function orderGeoJSON(locs, order) {
  if (!order || order.length < 2) return fc([]);
  return fc([line(order.map((i) => [locs[i].lng, locs[i].lat]))]);
}

export function frameGeoJSON(frame, locs) {
  return {
    edges: fc(
      frame.edges.map((e) => line([[locs[e.from].lng, locs[e.from].lat], [locs[e.to].lng, locs[e.to].lat]], { kind: e.kind }))
    ),
    nodes: fc(
      locs.map((l, v) => {
        const rank = frame.ranks && frame.ranks.get(v);
        return pt(l.lng, l.lat, rank ? { state: frame.nodes[v], label: String(rank) } : { state: frame.nodes[v] });
      })
    ),
  };
}
