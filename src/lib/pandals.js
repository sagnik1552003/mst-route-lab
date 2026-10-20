// Client-side loader for the pandal dataset. The dataset itself
// (src/data/pandals.json) is no longer imported directly anywhere in
// src/ — that would bundle all 464 records verbatim into the static JS
// chunk, where anyone can read it straight out of the page source without
// the app even running. Instead the app fetches it once from /api/pandals
// (api/pandals.js, which reads that same file server-side) and every other
// module reads it from here.
//
// `PANDALS` starts empty and is reassigned in place once loadPandals()
// resolves. Because this is a named export (`export let`, not a default
// export of a value), every `import { PANDALS } from './lib/pandals.js'`
// is a *live* ES-module binding — importers see the populated array once
// it lands, without re-importing anything. That only actually matters if
// something reads PANDALS before the app renders anything real, which is
// exactly why App.jsx gates all rendering on loadPandals() resolving first:
// nothing in this codebase needs to treat PANDALS as capable of changing
// out from under an already-rendered view.
export let PANDALS = [];

let inflight = null;

// Idempotent: safe to call from more than one place (or twice in
// React.StrictMode's dev double-invoke) — later calls reuse the same
// in-flight request or the already-resolved data instead of re-fetching.
export function loadPandals() {
  if (PANDALS.length) return Promise.resolve(PANDALS);
  if (inflight) return inflight;
  inflight = fetch('/api/pandals')
    .then((res) => {
      if (!res.ok) throw new Error('bad response ' + res.status);
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error('unexpected pandals payload');
      PANDALS = data;
      return PANDALS;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
