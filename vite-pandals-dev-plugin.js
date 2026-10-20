// Dev-only middleware serving GET /api/pandals under plain `npm run dev`,
// mirroring api/pandals.js so local dev doesn't require `vercel dev` — same
// pattern as vite-overpass-dev-plugin.js. Vite's own config/plugin loader
// (esbuild-based) natively understands a JSON import, so this can just
// import the dataset directly rather than needing api/pandals.js's
// require()-via-createRequire workaround (that one exists only to dodge
// Node's ESM JSON-import-assertion version differences).
import PANDALS from './src/data/pandals.json';

function serve(req, res, next) {
  if (!req.url || !req.url.startsWith('/api/pandals')) {
    next();
    return;
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(PANDALS));
}

export function pandalsDevPlugin() {
  return {
    name: 'pandals-dev-proxy',
    configureServer(server) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve);
    },
  };
}
