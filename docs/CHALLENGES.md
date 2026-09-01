# Challenges & Known Issues

Things that are broken, approximate, or worth being honest about. If you fix
one, move it to CHANGELOG.md instead of deleting it here.

## No basemap attribution shown

Leaflet's default attribution control was removed 2026-08-28 (per
request — it rendered as a white box that clashed with the dark theme).
Esri's World Dark Gray Base and OpenStreetMap's contributor data are
still the actual tile source (`js/map.js`), and Esri's/OSM's terms of use
generally expect attribution to remain visible in the UI. This is a
hackathon-internal tool, not a public deployment, so the risk is low, but
if this app is ever shown publicly or shipped further, re-add visible
attribution (it doesn't have to be Leaflet's default box/style — a
smaller or restyled credit line would satisfy the same requirement).

## Cloud-risk badge is a rough forecast, not a promise

`js/clouds.js` (added 2026-08-28) tags optical/multispectral/thermal
passes with a ☁️/☁️☁️ badge from an Open-Meteo hourly forecast. Several
layers of approximation stack up here, worth knowing before trusting it
for anything operational:
- **One point per region, not the actual swath.** The forecast is fetched
  for each region's bounding-box centroid (`REGION_CENTERS` in
  `js/config.js`), then averaged across whichever regions a pass touches.
  A satellite's real swath can be hundreds of km wide (GCOM-C: 1150km) —
  cloud cover genuinely varies across that footprint, so the badge is a
  regional proxy, not a per-scene forecast.
- **Arbitrary thresholds.** 35%/65% average cloud-cover are a reasonable
  convention picked for this app, not a standard from any weather or
  remote-sensing source. A pass at 34% gets no badge at all; one at 36%
  gets "chance" — the underlying forecast number doesn't actually change
  that sharply at the boundary.
- **Forecast skill degrades with lead time.** `computePasses()`'s
  `futureDays` window (currently 4) is well within Open-Meteo's forecast
  range, but a forecast 3-4 days out is meaningfully less reliable than
  one for the next few hours — the badge doesn't distinguish "high
  confidence, tomorrow morning" from "lower confidence, 4 days out".
- **Forecast-only, on purpose.** Past/live passes never get a badge —
  this deliberately avoids implying "this pass's data probably has clouds
  in it" as if it were a real post-hoc observation; only Sentinel-2's own
  scene-classification/cloud mask (not integrated here) could actually
  say that.
- **A cloud badge says nothing about acquisition or availability.** It's
  informational only — it does not feed into `pass.acquisitionStatus` or
  `pass.availabilityStatus` (see "Three status tiers" below), and
  shouldn't be read as a fourth status tier.

## Two satellites with the same swath can still look differently "wide" on the map

Not a bug — came up as a question 2026-08-28. `js/map.js` draws a
satellite's ground track two different ways depending on whether it's the
currently-active one:
- **Not active**: `updateMap()`'s ambient tail, a plain stroked polyline
  whose pixel `weight` approximates the real swath at the current zoom
  (`getWeightForSwath()`).
- **Active** (clicked): `drawFullOrbit()`'s highlight, an actual filled
  polygon at the real swath width (perpendicular offset math), which
  reads much more prominently as "a wide box" than a stroked line of the
  nominally-equal pixel weight.

So two satellites with identical `swath` values (e.g. Landsat 8 and 9,
both 185km) render identically when *neither* is selected — verified
live, both compute to the same 18.9px weight at a given zoom — but the
one you've clicked will look wider than the other because it's showing
the real highlight box, not because of any actual swath difference.

## Pass detection: real coastlines now, but still a point-proxy for swath

**Updated 2026-08-28** — pass detection used to test the ground track
against each region's lat/lng *bounding rectangle*, padded by swath width.
It now tests against real region coastline polygons instead
(`REGION_SHAPES`, `js/region-shapes.js` — derived from
`piuccio/open-data-jp-prefectures-geojson`, MIT-licensed; see
docs/RESEARCH.md for the source and docs/CHANGELOG.md for the
processing pipeline: dissolve prefectures into regions, drop islets under
~8km², simplify with Douglas-Peucker). A satellite whose nadir track
passes just offshore no longer counts as "over" a region the way the old
padded rectangle did — verified against 11 known city/ocean points with
zero mismatches, and total detected passes dropped from ~309 to ~171 in
the current 9-day window, consistent with removing that false-positive
margin.

What's still an approximation:
- We only have the ground-track **center point**, not a true footprint, so
  swath width is approximated with up to 4 cardinal offset points
  (N/S/E/W of center by half the swath) rather than a real perpendicular
  corridor or footprint polygon. Cheap, but not geometrically exact —
  see `getIntersectingRegions()` in `js/passes.js`.
- Ignores actual sensor pointing/off-nadir capability (e.g. ALOS-2 and the
  Sentinel-1 SAR birds can steer their beam well outside the strict
  sub-satellite swath).
- Doesn't model minimum elevation angle, so "coverage" isn't the same as
  "usable, low-incidence-angle data."
- `getIntersectingRegions()` takes ~380ms for a full 9-day/all-satellites
  recompute (measured live) — happens in the background every 60s
  (`refreshPasses` in `js/main.js`), not per-frame, so not currently a
  visible problem, but worth knowing if more satellites or a finer time
  step get added later.

Good enough for a shell that answers "is anything roughly overhead soon
over actual Japanese land," not good enough to promise "this pixel will be
imaged." See [IDEAS.md](IDEAS.md#more-accurate-pass-detection) for the
real-footprint/WRS-2 path.

## Satellite fleet drift

Hardcoding TLEs (as the prototype did) goes stale in weeks, but the *fleet
list itself* also drifts over years — satellites get decommissioned and
successors launch. Confirmed via CelesTrak on 2026-08-28:

- Sentinel-1B: payload failure Dec 2021, object still orbits and still has a
  valid TLE, but it's not tasked for data collection. Excluded from the
  tracked list; if it ever needs to reappear (e.g. for a "graveyard/retired"
  view) the NORAD ID is 41456.
- Sentinel-1C (NORAD 62261, launched 2024) and Sentinel-1D (NORAD 66315,
  launched 2025) are now operational and are tracked instead.
- ALOS-4 (NORAD 60182) launched 2024 and is tracked alongside ALOS-2.
- Sentinel-2C (NORAD 60989, launched 2024) is tracked alongside 2A/2B.

There's no automated way to detect "a satellite was launched/retired" —
this list needs a manual periodic review. Flagged as a roadmap item.

## Artifact hosting doesn't work for this tool

Originally considered publishing this as a Claude Artifact so it's a
shareable link. Ruled out: Artifacts run under a strict CSP that blocks
`fetch`/`XHR` to any host except Google Fonts, so a published Artifact could
never call CelesTrak — it would ship with a frozen TLE snapshot and no way
to refresh it short of republishing. Since live data is the whole point,
this is a local app instead (see [README.md](../README.md) for how to run
it). Revisit if/when Artifacts get a data-fetch capability that can reach
arbitrary public APIs.

## Tailwind via CDN

`js`/`index.html` still pull Tailwind from `cdn.tailwindcss.com`, same as
the prototype. Fine for a fast-moving shell, but the CDN build is not
meant for anything beyond prototyping (no purge, ships the whole framework,
warns about this in the console). Worth moving to a compiled Tailwind build
if this grows past the shell stage.

## Free vs. commercial data is a per-operator policy call, not always black-and-white

`sat.freeData` (`js/config.js`) is a simple boolean, but the real picture
has nuance it doesn't capture:
- Landsat and Copernicus (Sentinel) are unambiguously free and open —
  high confidence.
- GCOM-C is marked free based on JAXA's general open-data posture for its
  Earth-observation missions (similar to how ALOS/GCOM data is
  distributed via G-Portal for registered users); not independently
  re-verified against GCOM-C's specific data policy page.
- ALOS-2/4 are marked NOT free based on the PASCO commercial-distributor
  research (docs/RESEARCH.md) — JAXA does run some open-data programs for
  specific ALOS-2 datasets/purposes, so this is "not free by the default
  commercial channel," not "no free access exists at all."
- SatVu and Constellr are commercial imagery companies — not free, high
  confidence.

Treat the "Free data only" filter as a reasonable default sort, not a
guarantee of what a specific dataset costs.

## Data latency is a rough estimate, not a promise

`DATA_LATENCY_HOURS` in `js/config.js` is a single flat number per
satellite, applied uniformly to every pass. Real latency varies by product
tier (standard vs. NRT/premium), ground station load, processing backlog,
and — for ALOS-2/4 — is actually an order-fulfillment estimate from
PASCO's commercial pricing page, not a mission-spec latency figure. SatVu
and Constellr publish no latency figure at all; the app shows that
explicitly ("no public latency figure") rather than guessing. Treat
"Data available ~..." as a planning estimate for when to start checking,
not a guarantee.

## Mission-ended satellites stay tracked but stop being an acquisition candidate

Confirmed via ESA 2026-08-28: Sentinel-1A's mission ended 2026-06-30 (12
years, past its 7-year design life), succeeded by Sentinel-1C/1D. It's
still being deorbited (still has a valid TLE, still shows a real ground
track), so removing it outright would misrepresent what's actually in
orbit. Instead, `js/config.js` satellite entries can carry a `missionEnded`
date; `js/passes.js` forces `pass.acquisitionStatus = 'none'`
unconditionally for those (regardless of ascending/descending node), and
the UI shows a distinct "Mission ended — no acquisition" note instead of
the generic ascending-node one, plus dims it in the legend. This is a
manual flag, not detected automatically — same periodic-review problem as
"Satellite fleet drift" above. Check on any tracked satellite before
assuming it's still operational.

## TLE loading is capped at 15s total, not just per-request

Found live: a network hiccup made every CelesTrak connection hang until
`net::ERR_CONNECTION_TIMED_OUT`, and `js/tle.js`'s `fetchLiveTle()` had no
explicit timeout, so `loadAllTle()` just sat on "Loading TLE…" indefinitely.
Added an 8s `AbortController` timeout per satellite — but that alone
wasn't enough: Chrome caps concurrent connections to one origin at ~6, so
with 15 requests to `celestrak.org`, the other 9 queue and only start once
an earlier one finishes. With the network genuinely stalled, this meant
waiting 8s *per batch of 6* — 30s+ total — even though each individual
request "only" waited 8s. Added a second, global 15s deadline
(`TLE_GLOBAL_DEADLINE_MS`, `loadAllTle()`) via `Promise.race`: whichever
satellites haven't resolved by 15s total just use their bundled fallback
snapshot immediately, regardless of how many are still queued behind the
connection limit. The per-request 8s timeout still exists underneath and
matters when only a few requests are slow; the 15s figure is the one that
actually bounds worst-case load time now.

## Three status tiers, none of them confirmed

The app tracks three genuinely different questions per pass, and is
careful not to let language for one imply certainty about another:

1. **Overpass opportunity** — implicit. A pass object existing at all
   means the geometry says the satellite crossed a region. This is the
   most solid of the three (it's just orbital mechanics + the region
   shapes), but see "Pass detection" above for its own caveats.
2. **`pass.acquisitionStatus`** (`'likely' | 'unlikely' | 'none'`,
   `js/passes.js`) — a heuristic from the descending-node convention (see
   below). Deliberately never "confirmed": there's no real tasking-log
   integration. `'none'` is the one exception — a mission-ended
   satellite genuinely did not acquire anything, that's a fact, not a
   heuristic.
3. **`pass.availabilityStatus`** (`'expected' | 'unknown' | 'none'`) —
   `endTime + a published latency figure`, shown as "Expected data
   ~<time>", not "Data available" — see "Data latency is a rough
   estimate" below.

The "Likely acquisitions only" checkbox filters on tier 2 alone; it says
nothing about tier 3. A pass can be a likely acquisition with unknown
availability (SatVu/Constellr — no public latency figure) or an unlikely
acquisition that still gets shown if the checkbox is off. Don't collapse
these into one boolean again — that's exactly the "recorded" naming this
replaced, which read as more confirmed than it was.

## Acquisition-likely is a convention, not a guarantee

`pass.acquisitionStatus` (in `js/passes.js`, driven by
`DESCENDING_NODE_ONLY_TYPES` in `js/config.js`) encodes a real,
well-established remote-sensing convention: sun-synchronous
optical/multispectral sensors (Landsat, Sentinel-2, GCOM-C) are standardly
tasked only on the descending node, because that's the local-morning,
sun-lit equator crossing for these orbits — an ascending pass over most of
Earth happens at local night for them. SAR (doesn't need sunlight) and
dedicated thermal sensors (day/night diurnal contrast is often the point,
e.g. for LST) are routinely tasked on both nodes, so they're never marked
`'unlikely'` by this heuristic.

This is a *convention*, not a per-pass tasking guarantee — actual archives
have gaps and exceptions (e.g. occasional ascending-node campaigns), and
this app has no way to know whether a specific real pass was actually
tasked. Treat the "Acquisition unlikely" note and the "Likely acquisitions
only" filter as a well-informed heuristic, not ground truth.

## Approximate specs for newly added satellites

Swath and revisit-cycle numbers for SatVu HOTSAT-1/2, Constellr SkyBee-1/2,
and GCOM-C in `js/config.js` are best-effort figures from public mission
descriptions, not verified against a primary spec sheet the way the
original 10 satellites' numbers effectively were (they matched the
original prototype's values, which came from JAXA/ESA/USGS docs). In
particular:

- HOTSAT-1/2 and SkyBee-1/2 are agile, pointable, tasked satellites — "swath"
  and "cycle" mean something a little different for them than for
  Sentinel/Landsat's fixed push-broom repeat cycles. The `cycle` field says
  "(tasked)" for exactly this reason, but the pass-detection math still
  treats them like a fixed nadir swath, which is an even rougher
  approximation for these than for the SAR/optical fleet (see "Pass
  detection is a bounding-box approximation" above).
- Worth a pass to confirm actual swath/resolution/cadence against each
  operator's current spec sheet before this is used for anything more than
  a rough at-a-glance view.

## List scroll position is restored approximately, not anchored

`renderPassLists()` re-renders the whole `#pass-list` innerHTML on every
60s refresh and just restores the previous numeric `scrollTop`, rather
than anchoring to a specific pass card. If a pass enters or leaves the
past/future window right at the point someone is scrolled to (rare, since
the window is 5 days back / 4 days forward), the list can shift slightly
under them. A more robust fix would re-find the same pass by id and scroll
to its new offset instead of reusing a raw pixel value.

## CARTO's free dark basemap now requires an API key

The original prototype's basemap URL
(`https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png`) still
returns `HTTP 200`, but every tile is now watermarked "API KEY REQUIRED"
(confirmed 2026-08-28) — CARTO tightened anonymous usage of their hosted
basemaps at some point after the prototype was made. Switched to Esri's
`World_Dark_Gray_Base` (`server.arcgisonline.com`, no key, open CORS,
confirmed clean). Its tile URL uses ArcGIS's `{z}/{y}/{x}` path order,
not Leaflet's usual `{z}/{x}/{y}` — easy to get backwards if this ever
changes providers again.

## No offline map tiles

The basemap is CARTO's hosted dark tile server. No tiles are cached, so the
map is blank without internet — separate from the TLE fetch failing
gracefully (see CHANGELOG "offline fallback").
