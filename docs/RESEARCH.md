# Research findings

Raw findings from research agents, kept here so they survive between
sessions. Not all of this has been acted on yet — see `WishList.md` /
`IDEAS.md` for what's still open.

## Japan region boundary data (for wishlist: accurate region shapes)

- **Source:** `piuccio/open-data-jp-prefectures-geojson`
  `https://raw.githubusercontent.com/piuccio/open-data-jp-prefectures-geojson/master/output/prefectures.geojson`
- **License:** MIT (confirmed via repo LICENSE, Copyright 2019 Fabio Crisci) — safe to embed.
- Format: GeoJSON, one feature per prefecture, Visvalingam-simplified.
- **Size: ~71.7 MB as-is — too big to ship raw.** Plan: merge prefectures
  into the 9 regions below first, *then* simplify the merged (larger,
  fewer) polygons with something like mapshaper — merging before
  simplifying gives a much smaller result than simplifying all 47 first.
- Rejected alternatives: `dataofjapan/land` (license requires attribution
  + mandatory notification to copyright holder for commercial use — not
  clean); `geolonia/japanese-boundaries` (municipality-level, no merged
  prefecture file, no clear license).

Standard prefecture → region grouping to use for the merge:

| Region | Prefectures |
|---|---|
| Hokkaido | Hokkaido |
| Tohoku | Aomori, Iwate, Miyagi, Akita, Yamagata, Fukushima |
| Kanto | Ibaraki, Tochigi, Gunma, Saitama, Chiba, Tokyo, Kanagawa |
| Chubu | Niigata, Toyama, Ishikawa, Fukui, Yamanashi, Nagano, Gifu, Shizuoka, Aichi |
| Kansai | Mie, Shiga, Kyoto, Osaka, Hyogo, Nara, Wakayama |
| Chugoku | Tottori, Shimane, Okayama, Hiroshima, Yamaguchi |
| Shikoku | Tokushima, Kagawa, Ehime, Kochi |
| Kyushu | Fukuoka, Saga, Nagasaki, Kumamoto, Oita, Miyazaki, Kagoshima |
| Okinawa | Okinawa |

## Satellite launch dates

| Satellite | Launch date | Confidence |
|---|---|---|
| Landsat 8 | 2013-02-11 | High |
| Landsat 9 | 2021-09-27 | High |
| Sentinel-1A | 2014-04-03 | High |
| Sentinel-1C | 2024-12-05 | High |
| Sentinel-1D | 2025-11-04 | High, but recent — spot-check |
| Sentinel-2A | 2015-06-23 | High |
| Sentinel-2B | 2017-03-07 | High |
| Sentinel-2C | 2024-09-05 | High |
| ALOS-2 | 2014-05-24 | High |
| ALOS-4 | 2024-07-01 | High (JAXA press release) |
| GCOM-C "Shikisai" | 2017-12-23 | High |
| SatVu HOTSAT-1 | 2023-06-13 (month certain, exact day medium-confidence) | Medium |
| SatVu HOTSAT-2 | 2026-03-30 | Medium-low — HOTSAT-1 failed after ~6mo, HOTSAT-2 slipped repeatedly; verify before treating as fact |
| Constellr SkyBee-1 | 2025-01-14 | Medium-high |
| Constellr SkyBee-2 | 2025-06-23 | Medium-high |

## Data latency: acquisition → publicly available (for wishlist: acquisition vs. availability)

| Program | Standard latency | Faster tier | Confidence |
|---|---|---|---|
| Sentinel-1 (SAR) | within 24h (often a few hours) | NRT: ~1h (subscribed areas), ~3h (priority) | High — official ESA docs |
| Sentinel-2 (optical) | 6–12h (ESA target 3–6h) | — | High |
| Landsat 8/9 | ~4–6h to EarthExplorer (L1); L2 +24h after L1; SR sometimes 4–11 days | RT tier: guaranteed within 12h | High |
| GCOM-C "Shikisai" | ~3–4 days (L2/L3 standard) | NRT stream (e.g. via Earth Engine): ~1 day | Medium-high |
| ALOS-2/4 | 5–7 business days (commercial order via PASCO); raw downlink-to-ground reportedly ~1–2.5h | Express delivery available on request | Medium — order turnaround, not a clean mission-spec number |
| SatVu (HOTSAT-1/2) | No public figure found. Markets "low-latency" / fast (450 Mbps) downlink but no stated acquisition→delivery number. | — | Low — do not hardcode a guess |
| Constellr (SkyBee-1/2) | No public figure found. Publishes 1.5-day *revisit*, not processing latency. | — | Low — do not hardcode a guess |

## Scene/path-row grid data (for wishlist: exact captured area, inspired by landsat.usgs.gov/landsat_acq)

- **WRS-2 (Landsat), official:** USGS shapefiles —
  `https://www.usgs.gov/media/files/landsat-wrs-2-descending-path-row-shapefile`
  and the `-ascending-` equivalent. Public domain (US govt), Shapefile/WGS84.
  Community GeoJSON conversion (unofficial, but source data is public
  domain): a gist by brunosan, `wrs2_descending.geojson`.
- **Sentinel-2 MGRS tiling grid:** `ubukawa/sentinel-2-grid` GeoJSON
  (~57.7 MB) — **no LICENSE file in the repo, treat as unlicensed until
  confirmed with the author.** Official source is an ESA KML on the
  Sentinel Online data-products page (would need conversion). Zenodo
  record 10998972 is another candidate — check its stated license.
- **Actual acquired-scene footprints (not just the grid), by provider:**
  - Copernicus Data Space Ecosystem OData catalogue
    (`https://catalogue.dataspace.copernicus.eu/odata/v1/Products`) and
    STAC API (`https://stac.dataspace.copernicus.eu/v1/search`) — **confirmed
    working fully anonymously for search/metadata**, no auth token needed
    (a token is only required to actually download files). Covers
    Sentinel-1/2 real scene footprints.
  - USGS M2M API (Landsat) — requires a free USGS/EROS account **plus** an
    explicit "machine access" request that can take days to approve; not
    anonymous. The Landsat Bulk Metadata Service (flat CSV files, full
    inventory) is a public, no-auth alternative for metadata only.
  - No public API found for ALOS-2/4 or GCOM-C real scene footprints
    without authenticated JAXA/G-Portal access.
