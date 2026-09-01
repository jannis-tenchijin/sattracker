# Changelog

All notable changes to SatTracker are logged here, most recent first.

## 2026-08-28 — trimmed the roadmap popup to 6 items

Per request, removed 7 of the 13 items added in the previous roadmap
pass: .ics export, the water-pipe/leak overlay, saved locations, the
Himawari sensor-type filter extension, shareable URL filter state, pass
alerts, and the right-click orbit-extend idea. `js/i18n.js`'s
`roadmapItems` (EN/JP) now lists just: the historical position slider,
free lat/lng input, today's-passes digest, real per-latitude swath
width, the Landsat-style path/row scene grid, and the QGIS polygon
export. The removed ideas still exist in `docs/IDEAS.md` — this only
trims what surfaces in the in-app popup. Verified live: popup shows
exactly 6 bullets, no longer needs to scroll.

## 2026-08-28 — removed the Leaflet attribution box

Per request: `attributionControl: false` added to the `L.map(...)` options
in `js/map.js`, removing the default white "Leaflet | Esri, HERE, Garmin,
© OpenStreetMap contributors" box from the map's bottom-right corner.
Verified live: `.leaflet-control-attribution` no longer exists in the DOM.
See `docs/CHALLENGES.md` "No basemap attribution shown" for the ToS
caveat this introduces.

## 2026-08-28 — cloud-risk tooltip now has a fixed 0.5s reveal delay

The cloud-risk badge (see the earlier "cloud-cover risk badge" entry)
used a native `title` attribute for its explanatory tooltip -- but a
`title` tooltip's reveal delay is controlled by the OS/browser, not
something CSS/JS can set to a specific value. Replaced it with a small
custom tooltip: new `.cloud-badge`/`.cloud-tooltip` classes in
`css/styles.css`, rendered in `js/ui.js`'s `renderPassCard()` as a child
span instead of a `title`. Uses the standard CSS delayed-tooltip trick —
the base rule fades out over 0.15s with no delay, the `:hover` rule
applies `transition-delay: 0.5s` to both `opacity` and `visibility` — so
the tooltip only appears 0.5s into the hover and disappears immediately
on mouse-out. Verified the parsed stylesheet rule directly (`transition:
opacity 0.15s 0.5s, visibility linear 0.5s` under `:hover`) since the
browser-automation tool's synthetic pointer didn't reliably land on the
small emoji span to exercise real `:hover` state end-to-end.

## 2026-08-28 — roadmap popup lists every open idea

`js/i18n.js`'s `roadmapItems` (EN/JP) previously held 4 stale placeholder
entries from the original prototype, one of which ("Data availability
date, distinct from pass time") had already shipped. Per request, cleared
all entries except "Historical satellite position slider" and replaced
the rest with every still-open item pulled from `docs/IDEAS.md` and the
open lines in `../WishList.md` — 13 items total: the slider, free lat/lng
input, today's-passes digest, .ics export, real per-latitude swath width,
the Landsat-style path/row scene grid, QGIS polygon export, the
water-pipe/leak overlay, saved locations, the Himawari sensor-type
filter extension, shareable URL filter state, pass alerts, and the
right-click orbit-extend idea. Added a comment above `roadmapItems`
pointing back to `docs/IDEAS.md`/`WishList.md` so it's edited alongside
those files instead of drifting again.

Also added `max-h-80 overflow-y-auto` to `#roadmap-list` in `index.html`
— 13 items no longer fit in the popup's original unbounded height.
Verified live in both languages: all 13 items render, the list scrolls
(`scrollHeight` 441 vs `clientHeight` 320), and the JP toggle renders the
matching translated set.

## 2026-08-28 — clearing a legend/marker satellite filter returns to the "now" line

Bug: clicking a satellite in the legend/on the map to filter the pass list,
then un-clicking it, appeared to "shoot the list to the top" instead of
landing back where it started. Root cause in `js/ui.js`
`onSatelliteFilterCleared()`: it always called `renderPassLists(false)`,
which preserves the *pixel* `scrollTop` from before the re-render. That
value was captured while the list was still short (filtered to one
satellite); reapplying the same small pixel offset to the much taller
unfiltered list landed near its physical top, not at the equivalent
position.

Fix: `onSatelliteFilterCleared()` now checks whether a filter was actually
active before clearing it (`selectedSatelliteFilter !== null`) and passes
that as `scrollToNow` — mirroring `onSatelliteFilterSelected()`, which
already scrolls to "now" when filtering *in*. A card-driven clear (from
`toggleSatelliteFocus`/`clearActiveSatellite` in `js/map.js`) never sets
`selectedSatelliteFilter` in the first place, so it still gets
`scrollToNow=false` and the list stays exactly where it was — preserving
the earlier "don't move the list on a card click" behavior. Verified live:
selecting a satellite via the legend, then clicking it again to clear,
lands the "Now" divider within ~20px of the list's top; a card-based
select→clear round-trip leaves `scrollTop` completely unchanged.

## 2026-08-28 — cloud-cover risk badge on pass cards

Implements the item deferred in `docs/IDEAS.md` "Cloud-cover risk badge".
New `js/clouds.js`: fetches hourly cloud-cover forecast from Open-Meteo
(free, keyless, one batched multi-location call for all 9 region
centroids — new `REGION_CENTERS` in `js/config.js`, computed from
`REGIONS`' bounding-box centers), cached 3h in localStorage (same
try/catch localStorage pattern as `js/tle.js`), with an 8s fetch timeout.
Refetched hourly in `js/main.js`'s boot loop (not awaited — this is a
supplementary badge, not load-bearing like the TLE fetch — and the pass
list is re-rendered once it resolves).

`getCloudRiskForPass(pass)` returns `null` / `'chance'` / `'likely'`:
averages the forecast cloud-cover % across all regions a pass touches, at
the forecast hour nearest `pass.time`, against two made-up-but-reasonable
thresholds (35%/65%). Returns `null` (no badge) for: any pass whose
`types` include `SAR_L`/`SAR_C` (radar sees through cloud — this is a
forecast-only, optical/thermal/multispectral-only feature per the user's
request), any `category: 'past'` pass (forecast can't describe the past),
and any pass whose time falls outside the fetched forecast window.

UI: a single ☁️ (chance) or double ☁️☁️ (very likely covered) emoji badge
in the pass card header, next to the ascending/descending node arrow,
using the same native `title` tooltip pattern as that arrow to explain
the meaning on hover — new `cloudRiskChance`/`cloudRiskLikely` i18n keys
(EN/JP). Verified live: real Open-Meteo fetch succeeded in-browser,
`cloudForecastStatus` reached `'ready'`, and both badge tiers rendered
with correct tooltip text on real upcoming passes (screenshot-verified);
SAR passes and past passes confirmed to get no badge.

See `docs/CHALLENGES.md` "Cloud-risk badge is a rough forecast, not a
promise" for the honesty caveats (arbitrary thresholds, region-centroid
proxy, no historical/actual cloud data).

## 2026-08-28 — resolution added to the info popup

New `resolution` field on every `SATELLITES` entry (`js/config.js`) and a
new row in the (i) info popup (`js/ui.js`/`js/i18n.js`), between sensor
suite and swath width. Figures are mode-dependent approximations for the
SAR birds (ALOS-2/4) and best-known nominal figures for the rest — not
independently re-verified against each program's current spec sheet, same
caveat as the other approximate figures already in this app.

## 2026-08-28 — ALOS-2/4 recolored to a darker wine red

Per direct feedback. `js/config.js`: ALOS-2 `#fb7185` → `#9f1239`,
ALOS-4 `#f43f5e` → `#881337` — both darker, wine/burgundy tones, still a
tight pair (same family, JAXA SAR_L).

## 2026-08-28 — GCOM-C recolored (was too close to Landsat's green)

GCOM-C's teal (`#2dd4bf`) read as too similar to Landsat 8/9's emerald
green per direct feedback. Changed to pink/magenta (`#ec4899`,
`js/config.js`) — distinct from both Landsat's green and ALOS's rose-red.

## 2026-08-28 — on-map pass time label no longer rounds

Per direct feedback: the on-map label was rounding the pass start to the
nearest 5 minutes, which could disagree with the pass-list card's own
(exact) timestamp for the same pass. `drawPassTimeLabel()` (`js/map.js`)
now formats the exact `passStart` with the same `toLocaleString` options
`renderPassCard()` (`js/ui.js`) uses, so the two are always identical.
Verified: both read "23 Aug, 17:09" for the same pass.

## 2026-08-28 — per-info-request satellite info popup

Added a small (i) button to each pass card (`js/ui.js` `renderPassCard`),
opening a popup with launch date, operator, sensor suite, swath, revisit
cycle, NORAD ID, mission status (if ended), and typical data latency
(`showSatelliteInfo()`/`closeSatelliteInfo()`, new `#sat-info-overlay` in
`index.html`). All of `launchDate`/`operator`/`sensorSuite` are new fields
on every `SATELLITES` entry in `js/config.js`. The button calls
`event.stopPropagation()` so it doesn't also trigger the card's own
focus-select — verified live: clicking it opened the popup with correct
data and left `activeSatId` untouched.

## 2026-08-28 — satellite colors grouped by operator, not sensor type; free-data filter; checkboxes → toggle buttons

- **Colors regrouped by mission/operator, not sensor type.** THERMAL was
  shared by two different companies (SatVu's HOTSAT and Constellr's
  SkyBee), both landing in one orange family — hard to tell apart as
  different operators at a glance. Every satellite's `color` in
  `js/config.js` is now an explicit hex chosen per operator family (tight,
  close shades within a family — e.g. HOTSAT-1/2 are both orange;
  SkyBee-1/2 are now gold/yellow, clearly separate from SatVu's orange).
  `SENSOR_FAMILY` no longer drives color, only the type-filter labels.
- **New "Free data only" toggle**, next to the acquisition-likelihood one.
  Backed by a new `freeData: true/false` field per satellite (Landsat/
  Sentinel/GCOM-C are open-data policies; ALOS-2/4 and the commercial
  SatVu/Constellr birds are not) — flagged in CHALLENGES.md as a
  judgment call for the ALOS/GCOM-C boundary cases, not a certainty.
- **Checkboxes → two-state toggle buttons.** "Recorded only" was already
  renamed to "Likely acquisitions only" earlier; per direct feedback, both
  filters are now buttons whose *label* changes ("All overpasses" ↔
  "Likely acquisitions", "All data" ↔ "Free data only") rather than a
  checkbox — sized via `flex-1` so the button box never resizes between
  states (verified: 167px in both states for both buttons), only the
  text and an active-state accent color change.

## 2026-08-28 — TLE caching (1h) + a hard 15s load deadline

Two related fixes to `js/tle.js`, prompted by network trouble hit while
testing (see the entries below this one):

- **1-hour localStorage cache** per satellite (`getCachedTle`/
  `setCachedTle`). TLEs don't meaningfully change within an hour, and
  re-fetching all 15 on every page load was hammering CelesTrak for no
  real benefit — plausibly part of what triggered the connection issues
  hit during this session's heavy testing. A cache hit skips the network
  entirely. Wrapped in try/catch: private browsing or disabled storage
  just means no cache, never a broken fetch.
- **Global 15s deadline** on the whole `loadAllTle()` batch (not just the
  existing 8s per-request timeout) — Chrome's per-origin connection limit
  (~6 concurrent) meant 15 queued requests could take 30s+ to all resolve
  even with a fast per-request timeout each. Past 15s total, whatever
  hasn't resolved yet just uses its bundled fallback snapshot.

## 2026-08-28 — Clear button available after any focus, gentler zoom

Two quick follow-ups to the selection-behavior overhaul above:
- The card-click zoom-in was too aggressive (`safeFlyTo(..., 6, ...)` for
  a specific pass, `5` for the marker fallback) — eased to `5` and `4.5`.
- The "Clear" button previously only appeared when the legend/marker path
  had filtered the pass list. Since clicking a pass card (or the "next
  data" banner) also moves the map camera, there needs to be a way back
  regardless of whether the list got filtered. `updateListHeaderLabel()`
  (`js/ui.js`) now shows Clear whenever `activeSatId` is set, not only
  when `selectedSatelliteFilter` is; `toggleSatelliteFocus`/
  `clearActiveSatellite` (`js/map.js`) call it directly on the card-origin
  path so it updates immediately.
- Also found and fixed while re-testing this: `js/tle.js` had no fetch
  timeout, so a network hiccup (observed live —
  `net::ERR_CONNECTION_TIMED_OUT` on every CelesTrak connection) hung the
  whole app on "Loading TLE…" far past a reasonable wait. Added an 8s
  `AbortController` timeout per satellite — see
  [CHALLENGES.md](CHALLENGES.md#tle-fetch-has-an-8s-timeout-but-a-truly-dead-network-still-means-a-wait)
  for the caveat (still queues behind the browser's per-origin connection
  limit if the network is broadly down).

## 2026-08-28 — three explicit status tiers, none of them "confirmed"

Direct feedback: "the current 'Recorded only' is a sensible heuristic for
optical sensors but should not imply a confirmed acquisition." Replaced
the single `pass.recorded` boolean with three separated, named questions
(`js/passes.js`) — see
[CHALLENGES.md](CHALLENGES.md#three-status-tiers-none-of-them-confirmed):

1. Overpass opportunity — implicit (a pass object existing at all).
2. `pass.acquisitionStatus`: `'likely' | 'unlikely' | 'none'`.
3. `pass.availabilityStatus`: `'expected' | 'unknown' | 'none'`.

Renamed everywhere the language could read as more certain than it is:
"Recorded only" → **"Likely acquisitions only"**; "Not typically recorded"
→ **"Acquisition unlikely"**; "Data available ~" → **"Expected data ~"**;
`onRecordedOnlyChange` → `onLikelyAcquisitionOnlyChange`; the
`recorded-only-*` DOM ids → `likely-acquisition-*`. "Mission ended — no
data acquired" → "no acquisition" (this one **is** a confirmed fact, not a
heuristic — the satellite is dead — so it's the one case that keeps
definite language on purpose).

Verified in-browser: all four note variants (acquisition-unlikely,
mission-ended/none, expected-data, availability-unknown) render correctly
across the 171 currently-detected passes with the filter off.

## 2026-08-28 — real region shapes, replacing bounding-box rectangles

Wishlist #10. Sourced `piuccio/open-data-jp-prefectures-geojson` (MIT,
confirmed via its LICENSE file directly, not just the README) — 47
prefecture polygons, 71.7MB raw. Processing pipeline (Python + shapely, in
an isolated venv since this machine has no system geo tooling):

1. Dissolved (`unary_union`) prefectures into the 9 regions per the
   standard Japanese grouping (mapping recorded in docs/RESEARCH.md).
2. Dropped tiny islets under ~8km² (e.g. Kyushu alone had 8,052 separate
   polygons — 7,991 of them under that threshold; real inhabited islands
   like Amami Ōshima and Tsushima are hundreds of km², nowhere close to
   being caught by this).
3. Simplified the remainder (Douglas-Peucker, 0.02° tolerance) and rounded
   to 4 decimal places (~11m — far finer than anything else in this app's
   geometry).

Result: 71.7MB → 52KB (`js/region-shapes.js`), 2,848 total points across
all 9 regions, keeping every significant island. Validated against 11
known points (major cities in each region + two open-ocean points) with
Shapely directly — 11/11 correct — before ever loading it into the app.

- `js/geometry.js`: added `pointInRing`/`pointInRegionShape` (standard
  ray-casting point-in-polygon).
- `js/passes.js`: `getIntersectingRegions()` now tests real coastlines
  instead of padded rectangles — see the rewritten section in
  [CHALLENGES.md](CHALLENGES.md#pass-detection-real-coastlines-now-but-still-a-point-proxy-for-swath)
  for what's still approximate (swath width, still no true footprint).
- `js/map.js`: `drawRegions()` now draws the real multi-island shapes
  instead of rectangles, matching the wishlist's "not just simple squares"
  ask directly.
- `REGIONS` (the old rectangles) kept only for the region selector's
  `flyToBounds` camera framing, where an approximate box is fine.

Verified live: `computePasses()` for all satellites over the full 9-day
window runs in ~380ms (real, measured — not blocking per-frame, since it
only runs on the 60s background refresh) and total detected passes
dropped from ~309 to ~171, consistent with the padded-rectangle
false-positive margin going away.

## 2026-08-28 — selection behavior overhaul: card vs. legend/marker now differ on purpose

Previously every way of selecting a satellite (legend, map marker, pass
card) went through one code path: fly the camera there, and (after the
click-to-filter feature) filter the pass list to it. User feedback made
clear these should behave differently depending on *how* you selected:

- **Clicking a pass card** now only highlights it — no camera fly-to
  change (map focus/orbit-draw behavior is unchanged, that stays), no
  pass-list filtering, and no `scrollIntoView` (which was quietly
  recentering the list even when the clicked card was already visible).
  Deselecting (click again) likewise leaves the list untouched.
- **Clicking the legend or a map marker/dot** now does the opposite:
  leaves the map camera exactly where it is (no fly-to), filters the pass
  list to that satellite (unchanged from before), and dims every *other*
  tracked satellite — marker, direction arrow, and trailing tail all fade
  to a muted grey at low opacity (0.18 for markers, 0.12 for tails) so the
  focused one reads clearly. Reverts on deselect or picking a different
  satellite.
- `js/map.js`: `toggleSatelliteFocus` now branches on whether a
  `cardElementId` was passed (this already reliably distinguishes the two
  origins — the legend and marker `onclick`s never pass one). New shared
  `DIM_COLOR` constant; `buildSatIconHtml`/`placeMarker` take a `dimmed`
  flag; the tail-drawing loop in `updateMap()` dims too (every tail it
  draws is already, by construction, a non-active satellite's).
- `js/ui.js`: `onSatelliteFilterCleared()` now no-ops (no re-render) if
  the filter was never actually set — otherwise a card-driven deselect
  still triggered a pass-list rebuild for nothing.
- Legend dimming (`buildLegend()`) now also triggers on `activeSatId`,
  not just the sensor-type filter.

New: the **"Next data in" strip is now clickable** — does exactly what
clicking its underlying pass card does (`focusNextDataCandidate()` in
`js/ui.js`, reconstructing the same card-id formula `renderPassCard()`
uses).

Also fixed per direct feedback: the highlight box was including track
points well outside Japan for wide-swath satellites, because the
padded-bounding-box used for *pass grouping* (padding scales with swath —
GCOM-C's 1150km swath pads ~5° past each region) was also being used to
bound the *drawn* highlight. Added `JAPAN_ENVELOPE` (`js/config.js`, the
raw un-padded union of all 9 regions) and require highlight points to fall
inside it (`js/map.js`). Verified: a GCOM-C pass's box now spans lat
22.6–43.8° (matches Japan's real extent) instead of extending further
into open ocean/neighboring countries.

Verified in-browser: card select/deselect leaves `list.scrollTop`
byte-identical; legend select doesn't move `map.getCenter()`/`getZoom()`
at all, dims exactly 14/15 legend entries and drops marker opacity to
0.18; clicking the countdown strip correctly focused its candidate pass.

## 2026-08-28 — day/night terminator shading

New `js/terminator.js`: standard solar-terminator algorithm (low-precision
solar ecliptic position → sun's right ascension/declination → the
closed-form hour-angle solution for the latitude where solar elevation is
zero at each longitude), shaded as a semi-transparent dark polygon on the
night side, in its own pane below the region/orbit overlays. Redraws every
60s (`drawTerminator()`, `js/main.js`) — the terminator moves slowly, no
need for a faster tick, unlike satellite positions.

Verified with two independent point checks rather than just eyeballing the
map: at the moment tested (2026-08-28 15:29 JST), Japan (35.7°N, 140°E)
correctly resolved as day and São Paulo (-23°, -60°, ~3:29am local)
correctly resolved as night.

## 2026-08-28 — data acquisition vs. availability + "next data" countdown

- **`DATA_LATENCY_HOURS`** (`js/config.js`): typical acquisition-to
  -availability latency per satellite, sourced from official docs where
  they exist (ESA/USGS have solid public figures; JAXA/ALOS's is an order
  -fulfillment estimate, not a clean mission spec) — see
  [docs/RESEARCH.md](RESEARCH.md). SatVu and Constellr have **no public
  figure**; explicitly `null` rather than a guessed number.
- `js/passes.js` computes `pass.dataAvailableAt` (`pass.endTime +
  latencyHours`) for recorded passes with a known latency; `null`
  otherwise. Pass cards now show either "Data available ~<time>" or "Data
  availability: no public latency figure" — never a fabricated number.
- New **"Next data in" countdown strip** in the header
  (`js/ui.js`: `nextDataCandidate()`, `tickNextDataCountdown()`, ticking
  every 1s), showing the soonest upcoming data arrival — not the soonest
  *pass* — across whatever region/type/satellite filter is currently
  active. A pass happening sooner with a long latency can arrive later
  than one that passes a bit later but processes fast; the countdown
  reflects that. Hides itself when nothing in view has a known-latency
  pass still pending.
- Verified in-browser: countdown showed "58m · Landsat 9 (...)"; a
  SkyBee/HOTSAT card correctly showed the "no public latency figure" note
  instead of a number; Sentinel-1A (mission-ended) cards correctly show
  no availability line at all, only the mission-ended note.

## 2026-08-28 — highlight box: second, complete fix (first fix was incomplete)

The earlier "highlight box no longer drifts" fix (below) only fixed *one*
of two problems. It anchored the box's window to `passStart`/`passEnd`
correctly for a purely future pass, but for a "past"-type card (which,
per `js/ui.js`, is also what a currently-*live*/ongoing pass uses)
`endM` was still pinned to `0` — i.e. "right now" — rather than
`passEnd`. Reported symptom (verbatim): "it is updated with the satellite
position and then snaps back when it moves too far away." That's exactly
what `endM=0` does: for a live pass, the window's far edge kept extending
to match the satellite's real-time position as time passed; for a pass
selected well after it ended, the window still stretched from
`passStart` all the way to "now" (potentially spanning many subsequent
orbits), and once that span wrapped around relative to the map's antimeridian
handling, it would visibly jump.

Fix: dropped the past/future branch entirely.  `startM`/`endM` are now
*always* `(passStart - now)/60000 - 10` and `(passEnd - now)/60000 + 10`
— exactly `[passStart-10min, passEnd+10min]` in absolute time, forever,
regardless of category or how long ago the pass was selected. Also removed
the now-fully-unused `data-pass-type` card attribute (`data-pass-category`
already carries the same information more precisely).

Verified: selected a past pass, captured its 42-point highlight polygon,
waited 10+ seconds (spanning two 5s redraw ticks), re-captured — byte-for
-byte identical.

Also fixed while addressing user feedback on the same feature:
- The on-map time label's background box was collapsing around the text
  (a `display:block` div inside Leaflet's zero-sized `divIcon` container
  inherits ~0 width instead of sizing to content) — now `inline-block`.
- The label sat directly on the ground-track line for near-vertical
  passes since it was only offset "up". Now offset perpendicular to the
  track's local heading, past the edge of the swath box itself, using the
  same perpendicular-vector math as the swath box's own edges.
- Legend box was scrolling at 2 rows; bumped `max-h` from 76px to 85px so
  up to 3 rows show without a scrollbar (only a 4th row triggers one).
- "Recorded only" now defaults to checked.

## 2026-08-28 — multi-tag sensor types

`sat.type` (single string) → `sat.types` (array) in `js/config.js`, so one
satellite can carry more than one sensor-family tag. Landsat 8/9 now carry
`['OPTICAL', 'THERMAL']` (their TIRS instrument is genuinely a separate
thermal sensor riding alongside the optical one) and GCOM-C carries
`['MULTISPECTRAL', 'THERMAL']` (SGLI has both a multispectral imager and
an infrared scanner). Selecting "Thermal Infrared" in the type filter now
surfaces Landsat and GCOM-C alongside SatVu/Constellr, instead of only
satellites whose *primary* label happened to be thermal. Updated
everywhere a single type was compared: `passMatchesFilters` and legend
dimming (`js/ui.js`) now use `.includes()`, `js/map.js`'s marker filtering
does the same, and `DESCENDING_NODE_ONLY_TYPES` checks (`js/passes.js`) use
`.some()` across a satellite's tags — since Landsat's OPTICAL tag governs
the whole pass (both instruments ride the same orbit), not just the
optical instrument specifically. Pass cards now show all tags joined
("Optical + Thermal Infrared"). Renamed `SENSOR_FAMILY.OPTICAL`'s label
from "Optical/Thermal" to plain "Optical" now that Thermal is its own
explicit tag rather than implied. Verified: filtering to Thermal Infrared
returns `hotsat1, hotsat2, skybee1, skybee2, gcomc, landsat8, landsat9`.

## 2026-08-28 — "Recorded only" defaults to on

Changed `recordedOnly` (`js/ui.js`) default from `false` to `true`, and
added `checked` to the checkbox in `index.html`, so the pass list starts
already filtered to passes that actually produce data.

## 2026-08-28 — highlight box no longer drifts; on-map pass time label

Two root causes fixed together (both needed for the highlight box to
actually stay put):

1. **Unstable pass IDs.** `computePasses()` (`js/passes.js`) samples on a
   60-second grid starting from `now`, and re-runs every 60s
   (`js/main.js`). Each call's grid was phase-shifted by a few seconds
   relative to the last, which could shift a detected pass's `startTime`
   by up to a minute — and since the pass card's DOM id is derived from
   that timestamp (`js/ui.js`), the currently-selected pass's card id
   would silently stop matching anything after a refresh. Fixed by
   flooring the grid's start to a whole-minute boundary
   (`Math.floor(now/60000)*60000`) so the same real pass always produces
   the same `startTime` across calls. Verified: two `computePasses()`
   calls 65 seconds apart (deliberately crossing a minute boundary) now
   produce 309/309 identical `(id, startTime)` pairs — previously these
   would drift.
2. **Highlight window anchored to the wrong reference.** `drawFullOrbit()`
   (`js/map.js`) derived its sampling window from *minutes until the pass
   starts, as of right now* (`passMins = (passTime - now) / 60000`), not
   from the pass's actual fixed start/end. That window shrinks as `now`
   approaches the pass and was only padded by a fixed 10 minutes — fine
   for this app's actual pass durations (max ~8 min, checked live) but
   conceptually wrong and fragile for anything longer (e.g. a future
   wide-swath sensor). Now anchored directly to `passStart`/`passEnd`.

Combined effect: when a pass card's id survived a refresh purely by luck
before, the box could still silently revert to a generic ±90-minute view
without the fix in (1); both were needed.

Also added the **on-map time label** from the wishlist: a single badge
(not a range), rounded to the nearest 5 minutes, on the active highlight
box only — there's only ever one highlighted pass at a time, so no risk of
duplicate/near-duplicate timestamps cluttering the map (`drawPassTimeLabel`
in `js/map.js`).

## 2026-08-28 — Sentinel-1A mission-ended handling + click-to-filter satellite

- **Sentinel-1A's mission ended 2026-06-30** (confirmed via ESA — see
  [CHALLENGES.md](CHALLENGES.md#mission-ended-satellites-stay-tracked-but-stop-being-recorded)).
  Added a general `missionEnded` field (`js/config.js`) rather than a
  one-off hack, since this will happen to other satellites over time.
  `js/passes.js` now forces `recorded = false` for any pass from a
  mission-ended satellite, the card shows a distinct "Mission ended
  2026-06-30 — no data acquired" note, and the legend entry is dimmed with
  an "(ended)" suffix. It's still tracked and drawn (still really in orbit,
  still has a real ground track while ESA deorbits it) — just clearly
  marked as producing no new data.
- **Click-to-filter**: clicking a satellite (legend dot, map marker, or a
  pass card) now filters the pass timeline down to just that satellite,
  in addition to the existing map-focus behavior. The panel header
  switches to "Showing: <name>" and a **Clear** button appears next to it
  (`js/ui.js`: `selectedSatelliteFilter`, `onSatelliteFilterSelected/Cleared`,
  wired from `js/map.js`'s `toggleSatelliteFocus`/new `clearActiveSatellite()`
  helper). Clearing restores the full list and the map's previous view.
- Bugfix found while building this: rebuilding the pass list (for any
  reason — a filter change, or the periodic 60s refresh) replaced the DOM
  entirely, silently dropping the "active card" highlight border since
  that styling lived only on the old DOM node. Added
  `reapplyActiveCardHighlight()`, called after every render.
- Verified in-browser: filtering to Sentinel-1A showed exactly its 20
  passes, all correctly marked mission-ended; Clear restored the full
  309-card, 15-satellite list; clicking a different satellite's pass card
  correctly re-filtered and kept the right card highlighted after the
  rebuild.

## 2026-08-28 — direction-of-travel arrow on satellite markers

Added `getHeading()` (`js/geometry.js`) — compass bearing from positions a
few seconds before/after a given time. `js/map.js`'s marker icon
(`buildSatIconHtml`) now draws a small triangle rotated to that heading
next to the dot; it's rebuilt every 1s tick alongside the position update
(`setIcon`, cheap for one small divIcon) so it stays current as a
satellite's ground-track heading changes over its orbit. Himawari
(geostationary, no ground track) intentionally gets no arrow. Verified via
the marker's live DOM (`rotate(347.26deg)` for Sentinel-2A, matching its
~98.5° inclination orbit) and a zoomed-in screenshot.

## 2026-08-28 — ascending/descending node + recorded-pass distinction

- Added `getOrbitalNode()` (`js/geometry.js`) — samples latitude a few
  seconds before/after a given time to determine ascending (moving north)
  vs. descending (moving south).
- Every pass now carries `pass.node` and `pass.recorded`
  (`js/passes.js`). `recorded` encodes a real remote-sensing convention:
  sun-synchronous optical/multispectral sensors (Landsat, Sentinel-2,
  GCOM-C) are standardly tasked only on the descending node; SAR and
  dedicated thermal sensors are tasked on both. See
  [CHALLENGES.md](CHALLENGES.md#recorded-pass-is-a-convention-not-a-guarantee)
  — this is a heuristic, not a per-pass guarantee.
- Pass cards show a small ▲/▼ node indicator, and non-recorded passes get
  a dimmed "not typically recorded" note instead of being hidden outright.
- New "Recorded only" checkbox under the region/type filters
  (`onRecordedOnlyChange` in `js/ui.js`) hides non-recorded passes
  entirely when checked.
- Verified in-browser: filtering multispectral passes down to
  ascending/descending showed the expected split (52 ascending, all
  flagged; 39 descending, none flagged), and the "recorded only" filter
  correctly reduced the list to just the 39 descending passes.

## 2026-08-28 — 1Hz satellite marker updates

Split `updateMap()` into a fast tick and a slow tick. `updateLivePositions()`
(new, in `js/map.js`) does one cheap SGP4 propagate per satellite and moves
existing markers — no Leaflet layer creation/destruction — and now runs
every 1s (`setInterval` in `js/main.js`), so satellite dots move smoothly
instead of jumping every 5 seconds. The expensive part (rebuilding the
25-minute trailing tail polylines and the active orbit highlight, which
does real Leaflet layer churn) stays on the old 5s cadence via `updateMap()`,
which now calls `updateLivePositions()` internally plus the tail rebuild.
The live clock was already ticking every 1s from the start (`main.js`), so
that half of this wishlist item was already done.

Verified via a live position diff over 2.5s (marker moved ~13km, consistent
with orbital ground speed) and a 4-second in-page error listener (zero
errors) — not just a visual check.

## 2026-08-28 — bugfix: deselecting a satellite didn't restore the map view

Root cause (found by instrumenting `map.flyTo()` directly in the running
app, not just from reading the code): Leaflet's `flyTo()` can throw a
synchronous `Invalid LatLng (NaN, NaN)` error if it's invoked again before
a previous `flyTo` animation has fully settled. `toggleSatelliteFocus()` in
`js/map.js` called `map.flyTo(previousMapView...)` and only *then*
`previousMapView = null` on the next line — when `flyTo` threw, that reset
line never ran, silently leaving `previousMapView` populated and the map
stuck whenever a later deselect raced a prior animation.

Fix: added `safeFlyTo()` (try/calls `flyTo`, falls back to an instant
`setView` on failure) and reordered the deselect branch to null out
`previousMapView` *before* calling it, not after — so a failed animation
can no longer skip the state reset. Applied the same try/catch fallback to
the region selector's `flyToBounds` call for consistency. Verified via a
`flyTo` call-spy and a clean click-select-then-click-deselect repro in
`js/map.js` / `js/ui.js`.

## 2026-08-28 — v0.2: fused timeline, sensor filter, 5 new satellites

- **Fused the Recent/Upcoming split into one scrollable timeline.** The
  sidebar used to be two separate panels (a collapsible "Upcoming" one and
  an always-open "Recent & Live" one). It's now a single chronological list
  (`#pass-list` in `index.html`, rendering logic in `renderPassLists()` in
  `js/ui.js`) — oldest pass at the top, farthest-future at the bottom, with
  a "Now" divider marking the boundary.
- On load (and whenever the region/type filter changes), the list
  auto-scrolls so the current live pass (or, if nothing's live, the next
  upcoming one) sits at the top — see `scrollListToNow()`. A periodic
  60s refresh (`setInterval(() => refreshPasses(false), ...)`) does *not*
  reset scroll position, so it won't yank the list out from under someone
  reading it — only an explicit filter change re-centers.
- The panel header text now tracks scroll position instead of being static:
  "Recent Passes" / "Live Now" / "Upcoming Passes" depending on what's
  scrolled to the top (`updateListHeaderLabel()`, driven by a
  `requestAnimationFrame`-throttled scroll listener).
- **New sensor-type filter**, next to the region selector. Filters the pass
  list, dims non-matching entries in the legend, and hides non-matching
  satellites' markers/tails on the map (`selectedType` in `js/ui.js`,
  enforced in `js/map.js`'s `updateMap()`).
- **Added 5 satellites**, all confirmed operational on CelesTrak
  2026-08-28: SatVu HOTSAT-1 & HOTSAT-2 and Constellr SkyBee-1 & SkyBee-2
  (a new `THERMAL` sensor family — dedicated high-resolution thermal
  infrared, distinct from Landsat's coarser combined optical+thermal), and
  JAXA's GCOM-C ("Shikisai", multispectral+thermal imager, added to the
  existing `MULTISPECTRAL` family). SatVu and Constellr are both
  thermal-infrared/LST specialists, directly relevant to the pipe-leak/LST
  work this tool is for.
- Swath and revisit-cycle figures for these 5 are best-effort estimates
  from public mission descriptions, not verified against a primary spec —
  flagged in [CHALLENGES.md](CHALLENGES.md#approximate-specs-for-newly-added-satellites).
- Verified in-browser: fused list renders and scrolls correctly in both
  directions, header label updates on scroll, sensor-type filter cross-cuts
  legend/map/list correctly, all 15 satellites' TLEs fetch live. No console
  errors.

## 2026-08-28 — v0.1 shell

- New project scaffolded at `sattracker/` (separate from the original Gemini
  prototype `tenchijin_sattracker.html`, which is kept at the repo root as a
  reference and is otherwise untouched).
- Rebuilt as a local, non-Artifact web app so it can fetch **live TLE data**
  from CelesTrak on load (confirmed CelesTrak sends
  `Access-Control-Allow-Origin: *`, so a plain client-side `fetch()` works
  with no proxy).
- Replaced the prototype's hand-typed, already-stale TLEs with a real
  snapshot pulled from CelesTrak on 2026-08-28, used only as an offline
  fallback if the live fetch fails.
- Updated the tracked satellite fleet to what's actually operational today
  (see [CHALLENGES.md](CHALLENGES.md#satellite-fleet-drift)): added ALOS-4,
  Sentinel-1C, Sentinel-1D; dropped Sentinel-1B (non-operational payload
  since Dec 2021, still orbiting but not tasked).
- Recolored the satellite legend so hue = sensor family (SAR L-band, SAR
  C-band, optical/thermal, multispectral) and shade = individual satellite,
  instead of ad hoc per-satellite colors — makes "what kind of data is this"
  readable at a glance.
- Split the monolithic single-file prototype into `index.html` +
  `css/styles.css` + `js/*.js` modules for maintainability.
- Kept from the prototype: dark map, per-satellite orbit/swath drawing on
  click, EN/JP toggle, recent + upcoming pass lists, Himawari-9 pinned card.
- Scope for this shell: Japan regions only (9 fixed regions), no free
  lat/lng picker yet — see [IDEAS.md](IDEAS.md#location-input).
- New: a region selector drives the whole sidebar now — pick a region and
  the recent/upcoming pass lists filter to it, the map flies to its bounds,
  and a faint outline of all 9 regions is drawn on the map so "where even
  is Kanto" isn't a lookup. This is the actual answer to "which satellite
  passes over a given location," instead of the prototype's mixed
  everything-at-once list.
- Found and fixed while testing: CARTO's anonymous dark basemap
  (`basemaps.cartocdn.com`, what the prototype used) now returns tiles
  watermarked "API KEY REQUIRED" — switched to Esri's keyless
  `World_Dark_Gray_Base`. Details in
  [CHALLENGES.md](CHALLENGES.md#cartos-free-dark-basemap-now-requires-an-api-key).
- Verified end-to-end in-browser: live TLE fetch + freshness badge, region
  filter/highlight/fly-to, satellite click → orbit + swath draw, EN/JP
  toggle (including that the selected region stays selected across a
  language switch), upcoming/recent panel toggle. No console errors.

## Housekeeping

- Progress, ideas, and known issues are tracked in this `docs/` folder
  instead of chat history — see [IDEAS.md](IDEAS.md) and
  [CHALLENGES.md](CHALLENGES.md).
