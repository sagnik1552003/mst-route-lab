// Route geometry is deliberately isolated behind this one function so the
// rest of the app never needs to know which routing backend is behind it.
//
// This calls OSRM's public demo router (no API key, no cost — not Google
// Directions or another paid service) for a real road-network shortest
// path, with real distance/duration. If that request fails for any reason
// (the free demo instance is rate-limited and not meant for production
// traffic, so this does happen), we fall back to a plain straight-line
// connector and report `source: 'straight-line'` with distance/duration
// left `null` — callers must never invent a number for the fallback case.
//
// Swapping to OpenRouteService, a self-hosted OSRM, or our own backend
// later means changing only the body of the `try` block below; the shape
// returned (`geometry` / `distanceMeters` / `durationSeconds` / `source`)
// is what every caller already reads.
//
// points: [{ lat, lng }, ...] in the order they should be visited.
const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';

function straightLineFallback(valid, error) {
  return {
    geometry: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: valid.map((p) => [p.lng, p.lat]) },
    },
    distanceMeters: null,
    durationSeconds: null,
    source: 'straight-line',
    error: error || null,
  };
}

export async function getRouteGeometry(points) {
  const valid = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (valid.length < 2) {
    return { geometry: null, distanceMeters: null, durationSeconds: null, source: 'none' };
  }

  try {
    const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
    const res = await fetch(`${OSRM_ENDPOINT}/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
    const data = await res.json();
    const route = data.routes && data.routes[0];
    if (!route || !route.geometry) throw new Error('OSRM returned no route');

    return {
      geometry: { type: 'Feature', properties: {}, geometry: route.geometry },
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      source: 'osrm',
    };
  } catch (err) {
    return straightLineFallback(valid, err.message);
  }
}
