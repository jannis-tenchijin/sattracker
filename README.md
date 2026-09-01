# Tenchijin SatTracker

Quick answer to "which satellite is going to pass over this part of Japan,
when, and what kind of data will that give us?" — built to make satellite
data availability legible at a glance instead of having to remember each
mission's revisit cycle.

## Run it

```bash
cd sattracker
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

TLEs (orbital elements) are fetched live from CelesTrak on load, so an
internet connection is required for current data. If the fetch fails, the
app falls back to a snapshot bundled from 2026-08-28 and says so in the UI.

## What it does

- Tracks 15 satellites, each with one or more sensor-type tags: ALOS-2/4
  (SAR, L-band), Sentinel-1A/C/D (SAR, C-band — 1A's mission ended
  2026-06-30, still shown but marked as no longer acquiring), Landsat 8/9
  (optical + thermal), Sentinel-2A/B/C and GCOM-C "Shikisai" (multispectral,
  GCOM-C also thermal), SatVu HOTSAT-1/2 and Constellr SkyBee-1/2 (dedicated
  thermal infrared), and Himawari-9 (geostationary). Colors are grouped by
  operator/mission family, not sensor type, so e.g. SatVu and Constellr
  (both thermal) are still visually distinct as different companies.
- Live satellite positions (1s), orbit ground tracks, and a direction
  arrow on a dark map of Japan, with real region coastline shapes (not
  bounding boxes) and a day/night terminator overlay.
- One fused, scrollable pass timeline — past above, future below,
  auto-scrolled so "now" starts at the top — filterable by Japan region,
  sensor type, "likely acquisitions only" vs. all overpasses, and
  "free data only" vs. all operators. Clicking a satellite (legend or map
  marker) filters the list to it and dims every other satellite; clicking
  a pass card just highlights it and flies the map there without touching
  the list. Every pass shows three separate, honestly-labeled tiers:
  overpass (implicit), likely/unlikely/no acquisition, and
  expected/unknown data availability — see CHALLENGES.md before treating
  any of these as confirmed.
- A "Next data in" countdown (clickable, jumps to that pass) for the
  soonest upcoming data arrival under the current filters.
- An (i) info popup per pass card: launch date, operator, sensor suite,
  swath, revisit cycle, NORAD ID, mission status, typical data latency.
- TLEs cached for 1 hour (localStorage) to avoid hammering CelesTrak;
  fetching is capped at a 15s total deadline regardless of network
  conditions, per-satellite with an 8s timeout underneath that.
- EN / JP toggle.

## Project docs

- [docs/CHANGELOG.md](docs/CHANGELOG.md) — what's actually been built, in
  order. This is the most complete record of this project's history —
  read it first if picking this back up after a while.
- [docs/IDEAS.md](docs/IDEAS.md) — unbuilt ideas and roadmap.
- [docs/CHALLENGES.md](docs/CHALLENGES.md) — known limitations and why.
- [docs/RESEARCH.md](docs/RESEARCH.md) — raw findings from research
  agents (data sources, licenses, launch dates, latency figures) that
  informed the above.
- [../WishList.md](../WishList.md) — the user's own running list of asks,
  annotated inline with `[done ...]` / `[queued ...]` tags pointing back
  into CHANGELOG.md.

The original Gemini-generated prototype this was rebuilt from is kept at
the repo root as `../tenchijin_sattracker.html` for reference.
