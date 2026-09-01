# Ideas & Roadmap

Not committed to any of these — a holding pen so ideas survive between
sessions instead of living only in chat. Carried over from the original
prototype's in-app "Roadmap" popup plus new ones from the redesign.

## Location input

- Generalize past the 9 fixed Japan regions: click-anywhere-on-map or
  type a lat/lng and get passes for that exact point (deferred for the v0.1
  shell — see [CHALLENGES.md](CHALLENGES.md)).
- Saved locations / favorites (e.g. specific pipe network sites), so a user
  doesn't re-enter the same coordinates every session.

## More accurate pass detection

- Replace the bounding-box sampling with the swath polygon already computed
  for the map overlay, intersected properly against region/point geometry.
- Model minimum usable elevation/incidence angle instead of pure footprint
  overlap.
- Distinguish "satellite passed overhead" from "usable data was actually
  collected" (tasking isn't guaranteed for many of these sensors).

## Data availability, not just pass time

- Surface *when data actually lands*, not just when the satellite flew
  over — these are different by hours to days depending on provider
  (downlink schedule, processing, distribution). This was item #3 on the
  original roadmap and is probably the single highest-value feature for
  Tenchijin's actual workflow, since "the satellite passed" isn't the
  question anyone is really asking.
- Per-provider latency estimates (JAXA vs. Copernicus/ESA vs. USGS) as a
  configurable lag applied on top of the pass time.

## History & context

- Historical satellite position slider (scrub backward in time), from the
  original roadmap.
- "Today's passes" summary/digest view, from the original roadmap.
- Export upcoming passes for a location as .ics so they show up in a
  calendar.

## Map/UX polish carried over from the prototype

- Fix the highlight box for a selected future pass — it's recomputed
  against the live-moving map center on every redraw instead of being
  pinned once, carried over unchanged from the prototype's
  `drawFullOrbit()`/`getWrappedSegments()` approach in `js/map.js`.
- Right-click / context menu on a satellite marker to extend how much of
  its orbit is currently drawn (currently fixed to ±90 min unless a specific
  pass card is active).

## Filters

- Extend the sensor-type filter to cover Himawari/geostationary too (it's
  currently always shown, outside the `SATELLITES`/`selectedType` filtering
  in `js/map.js` and `js/ui.js`).
- Put the region + type filter selections in the URL (query params), so a
  specific view is shareable/bookmarkable instead of resetting on reload.

## Data layers

- Overlay the actual water-pipe network / historical leak markers on the
  same map, so "what satellite is coming" and "where do we have open leak
  investigations" are the same view.
- **Cloud-cover risk badge — done 2026-08-28**, see `docs/CHANGELOG.md`
  "cloud-cover risk badge on pass cards" and
  `docs/CHALLENGES.md` "Cloud-risk badge is a rough forecast, not a
  promise". Built with Open-Meteo (free, keyless), skipped for SAR.
  Possible follow-up not yet built: per-satellite swath-shaped sampling
  instead of one region-centroid point, and a numeric %-cover figure in
  the tooltip instead of just the two-tier badge.

## Notifications

- Push/email/Slack alert N minutes before a pass over a saved location.
- Webhook so this can feed other internal Tenchijin tooling instead of only
  being a dashboard someone has to remember to check.
