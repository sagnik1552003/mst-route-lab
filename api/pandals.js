// Serves the app's own pandal dataset over HTTP instead of it being bundled
// directly into the client JS. src/data/pandals.json remains the single
// source of truth (see CLAUDE.md) — this endpoint just reads that same file
// server-side and hands it back as JSON, so the browser has to make an
// explicit request for it rather than getting it for free by downloading
// the page's script.
//
// To be clear about what this does and doesn't do: it does NOT meaningfully
// stop scraping — anyone (or any script) can call this endpoint directly and
// get the exact same 464 records a real page load would. It only stops the
// data from sitting in plain sight inside the static JS bundle; see the
// conversation that introduced this file for the fuller tradeoff discussion.
//
// GET-only, no query parameters accepted — there's nothing to validate,
// forward, or leak here, unlike api/overpass.js's proxy. A generous
// Cache-Control lets Vercel's edge (and browsers) reuse a response instead
// of re-reading the file on every request, since this only changes on a
// redeploy.
import { createRequire } from 'node:module';

// require() (via createRequire) rather than a native ESM JSON import —
// Node's ESM JSON-import syntax needs an import-assertion keyword whose
// exact spelling changed between Node versions (`assert` vs `with`), so
// pinning to one breaks on the other. require() has handled JSON natively,
// unassisted, since forever, and Vercel's build-time dependency tracer
// (@vercel/nft) follows it reliably.
const require = createRequire(import.meta.url);
const PANDALS = require('../src/data/pandals.json');

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(PANDALS);
}
