# SatTracker

Local (non-Artifact) web app: which satellites pass over which Japan region,
when, and what kind of data they'd produce. Built for Tenchijin's need to
know when new satellite data will actually be available for a location.

## Stack

- Plain HTML/CSS/JS, no build step. Tailwind via CDN, Leaflet for the map,
  `satellite.js` for SGP4 propagation.
- No backend. TLEs are fetched client-side, directly from CelesTrak
  (`celestrak.org`, sends `Access-Control-Allow-Origin: *`), cached 1h in
  localStorage, capped at a 15s total load deadline.
- Entry point: `index.html`. Modules in `js/`, one concern per file:
  `config.js` (satellite/region data), `region-shapes.js` (generated —
  see below, don't hand-edit), `i18n.js` (EN/JP strings), `geometry.js`
  (map math + point-in-polygon), `tle.js` (fetch/cache/parse),
  `passes.js` (pass detection + the 3-tier status model), `map.js`
  (Leaflet/orbit/marker drawing), `terminator.js` (day/night shading),
  `ui.js` (DOM rendering, filters), `main.js` (bootstrap).

## Run it

```bash
cd sattracker
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Must be served over `http://`/`https://`
(not opened as a bare `file://` path) for the CelesTrak fetch to reliably
work across browsers.

Also live at https://jannis-tenchijin.github.io/sattracker/ (GitHub
Pages, deployed from this repo's `main` branch root — no build step,
just whatever's committed).

## Conventions

- Keep the satellite list in `js/config.js` as the single source of truth:
  id, display name, NORAD catalog number, `types` (array — a satellite can
  carry more than one, e.g. Landsat is `['OPTICAL','THERMAL']`), swath km,
  nominal revisit cycle, `color`, `launchDate`, `operator`, `sensorSuite`,
  `freeData` (open-data policy), optionally `missionEnded` (date string).
  Adding a satellite = one entry there, plus a `DATA_LATENCY_HOURS` entry
  (or explicit `null` if no public figure exists — never guess a number).
  TLE fetch and legend/UI pick a new entry up automatically.
- **Satellite `color` is grouped by operator/mission family, not sensor
  type** (deliberately reversed from an earlier hue-by-sensor-type scheme
  — see docs/CHANGELOG.md 2026-08-28 "satellite colors grouped by
  operator"). Satellites from the same program get tight, near-identical
  shades (e.g. ALOS-2/4 both wine-red); different programs get visually
  distinct hues even when they share a sensor type tag — this is what
  keeps SatVu (orange) and Constellr (gold), both THERMAL, readable as
  different companies. Don't revert to sensor-type-driven color without
  discussing it first.
- A satellite whose mission ends (like Sentinel-1A, 2026-06-30) stays in
  `SATELLITES` with a `missionEnded` date rather than being removed — it's
  still really in orbit. Don't delete a tracked satellite just because its
  mission ended; do check CelesTrak before assuming any tracked satellite
  is still operational, and note mission-status changes in
  `docs/CHANGELOG.md`.
- `js/passes.js` computes three separate, deliberately-not-conflated
  status tiers per pass — overpass opportunity (implicit), `pass.
  acquisitionStatus` (`'likely'|'unlikely'|'none'`), and `pass.
  availabilityStatus` (`'expected'|'unknown'|'none'`). Never collapse
  these back into one boolean, and never use language that implies
  "confirmed" for tiers 2/3 — see docs/CHALLENGES.md "Three status tiers".
- `REGION_SHAPES` (`js/region-shapes.js`) is a **generated** file — real
  Japan region coastlines, not hand-written. Regenerating it needs Python
  + shapely (not in this repo; install in a throwaway venv) — see
  docs/CHANGELOG.md 2026-08-28 "real region shapes" for the exact
  pipeline (source dataset, license, dissolve/filter/simplify steps) if
  it ever needs redoing (new region, different simplification tolerance,
  etc). The old `REGIONS` rectangles in `config.js` still exist, but only
  for the region selector's `flyToBounds` camera framing — pass detection
  no longer uses them.
- Every satellite the app tracks must currently be operational (or
  explicitly `missionEnded`). Before adding or removing one, check
  CelesTrak (`https://celestrak.org/NORAD/elements/gp.php?NAME=<name>&
  FORMAT=TLE`) and note the change in `docs/CHANGELOG.md`.

## Progress tracking

Don't rely on chat history for project memory. This folder is its own
git repo (`sattracker/` — not the larger local working directory it sits
inside, which also holds `WishList.md` and the original prototype),
pushed to https://github.com/jannis-tenchijin/sattracker and deployed via
GitHub Pages. Log real changes in `docs/CHANGELOG.md` (the primary,
most-complete record — read it first when picking this back up), park
unbuilt ideas in `docs/IDEAS.md`, record known-broken/approximate behavior
in `docs/CHALLENGES.md`, and keep research-agent findings in
`docs/RESEARCH.md`. Read all four before making non-trivial changes. The
user's own running ask list is `../WishList.md`, annotated inline with
`[done ...]` tags pointing back into CHANGELOG.md.
