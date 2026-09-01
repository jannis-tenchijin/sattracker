// Single source of truth for tracked satellites, Japan regions, and the
// Himawari-9 geostationary asset. See CLAUDE.md conventions before editing.

// Sensor-type labels for the filter dropdown/badges. Individual satellite
// colors (below) are assigned per mission/operator family instead of by
// these types -- see the note above SATELLITES.
const SENSOR_FAMILY = {
    SAR_L: { label: 'SAR (L-band)' },
    SAR_C: { label: 'SAR (C-band)' },
    OPTICAL: { label: 'Optical' },
    MULTISPECTRAL: { label: 'Multispectral' },
    THERMAL: { label: 'Thermal Infrared' }
};

// Sun-synchronous optical/multispectral sensors need consistent sun angle,
// so standard archives conventionally only image on the descending node
// (local morning) -- an ascending-node pass over most of Earth happens at
// local night for these orbits. SAR (works in the dark) and dedicated
// thermal sensors (day/night diurnal cycle is itself the point, e.g. for
// LST) are routinely tasked on both nodes. This is a real convention, not
// a guarantee any specific pass was actually tasked -- see
// docs/CHALLENGES.md "Recorded-pass is a convention, not a guarantee".
// A satellite is governed by this convention if ANY of its type tags are
// in this set (e.g. Landsat's OPTICAL+THERMAL pair both follow OPTICAL's
// descending-only convention, since they ride the same spacecraft/orbit).
const DESCENDING_NODE_ONLY_TYPES = new Set(['OPTICAL', 'MULTISPECTRAL']);

// Typical acquisition-to-availability latency, in hours, for each
// satellite's standard (non-premium, non-NRT-subscription) public data
// product -- see docs/RESEARCH.md for sources and confidence per program.
// `null` means no public figure was found; the UI must show that plainly
// instead of inventing a number. These are order-of-magnitude planning
// estimates, not guarantees for any specific pass -- see
// docs/CHALLENGES.md "Data latency is a rough estimate, not a promise".
const DATA_LATENCY_HOURS = {
    alos2: 144, alos4: 144,       // ~6 days, PASCO commercial order turnaround
    landsat8: 6, landsat9: 6,     // EarthExplorer L1 standard product
    sentinel1a: 24, sentinel1c: 24, sentinel1d: 24, // standard archive (NRT areas are faster)
    sentinel2a: 9, sentinel2b: 9, sentinel2c: 9,    // ESA target 3-6h, up to ~12h
    gcomc: 84,                    // ~3-4 days standard L2/L3 (NRT stream is ~1 day)
    hotsat1: null, hotsat2: null, // no public figure found
    skybee1: null, skybee2: null  // no public figure found
};

// TLE fallback snapshot, fetched from CelesTrak 2026-08-28. Used only if
// the live fetch in js/tle.js fails (offline demo, CelesTrak outage).
// Refresh periodically -- see docs/CHALLENGES.md "Satellite fleet drift".
//
// `color` is assigned per mission/operator family, not per sensor type --
// satellites from the same program (e.g. ALOS-2/4, both JAXA) get very
// close shades of one hue; different programs get visually distinct hues,
// even when they share a sensor type tag. This matters most for THERMAL,
// which SatVu (HOTSAT) and Constellr (SkyBee) both carry -- they used to
// share one orange family and were hard to tell apart as different
// companies; SatVu keeps orange, Constellr is now gold/yellow.
//
// `freeData` is the operator's open-data policy for standard products --
// see docs/CHALLENGES.md "Free vs. commercial data is a per-operator
// policy call, not always black-and-white" before trusting it blindly.
const SATELLITES = [
    {
        id: 'alos2', name: 'ALOS-2', noradId: 39766,
        types: ['SAR_L'], swath: 50, cycle: '14 days', color: '#9f1239', freeData: false,
        launchDate: '2014-05-24', operator: 'JAXA', sensorSuite: 'PALSAR-2 (L-band SAR)', resolution: '~3–10 m (mode-dependent)',
        fallbackTle: [
            "1 39766U 14029A   26239.89762966  .00000788  00000+0  11235-3 0  9999",
            "2 39766  97.9232 336.0349 0001598  95.0661 265.0733 14.79467865662189"
        ]
    },
    {
        id: 'alos4', name: 'ALOS-4', noradId: 60182,
        types: ['SAR_L'], swath: 200, cycle: '14 days', color: '#881337', freeData: false,
        launchDate: '2024-07-01', operator: 'JAXA', sensorSuite: 'PALSAR-3 (L-band SAR) + AIS receiver', resolution: '~1–6 m (mode-dependent)',
        fallbackTle: [
            "1 60182U 24123A   26239.91697365  .00001308  00000+0  18201-3 0  9993",
            "2 60182  97.9221 336.0611 0001509  96.8230 263.3154 14.79474330116488"
        ]
    },
    {
        id: 'landsat8', name: 'Landsat 8', noradId: 39084,
        types: ['OPTICAL', 'THERMAL'], swath: 185, cycle: '16d (8d w/ L9)', color: '#34d399', freeData: true,
        launchDate: '2013-02-11', operator: 'NASA/USGS', sensorSuite: 'OLI (optical) + TIRS (thermal infrared)', resolution: '30 m (15 m pan, 100 m thermal)',
        fallbackTle: [
            "1 39084U 13008A   26239.92215027  .00000282  00000+0  72606-4 0  9992",
            "2 39084  98.2248 309.1845 0001255  94.1602 265.9740 14.57106896708346"
        ]
    },
    {
        id: 'landsat9', name: 'Landsat 9', noradId: 49260,
        types: ['OPTICAL', 'THERMAL'], swath: 185, cycle: '16d (8d w/ L8)', color: '#10b981', freeData: true,
        launchDate: '2021-09-27', operator: 'NASA/USGS', sensorSuite: 'OLI-2 (optical) + TIRS-2 (thermal infrared)', resolution: '30 m (15 m pan, 100 m thermal)',
        fallbackTle: [
            "1 49260U 21088A   26239.61319110  .00000293  00000+0  75035-4 0  9991",
            "2 49260  98.2229 308.9058 0001354 104.9962 255.1386 14.57102158261409"
        ]
    },
    {
        id: 'sentinel1a', name: 'Sentinel-1A', noradId: 39634,
        types: ['SAR_C'], swath: 250, cycle: '12 days', color: '#60a5fa', freeData: true,
        launchDate: '2014-04-03', operator: 'ESA/Copernicus', sensorSuite: 'C-SAR (C-band SAR)', resolution: '~5×20 m (IW mode)',
        // Confirmed via ESA 2026-08-28: operations ended 2026-06-30 after 12
        // years (design life was 7). Still orbiting -- ESA is lowering its
        // orbit for eventual re-entry -- so it still has a valid TLE and a
        // real ground track, but it is no longer acquiring anything.
        // Succeeded by Sentinel-1C/1D. See docs/CHALLENGES.md
        // "Mission-ended satellites stay tracked but stop being 'recorded'".
        missionEnded: '2026-06-30',
        fallbackTle: [
            "1 39634U 14016A   26239.74424811  .00000117  00000+0  34030-4 0  9992",
            "2 39634  98.1586 246.1643 0001441  83.7564 276.3800 14.59799642660456"
        ]
    },
    {
        id: 'sentinel1c', name: 'Sentinel-1C', noradId: 62261,
        types: ['SAR_C'], swath: 250, cycle: '12 days', color: '#3b82f6', freeData: true,
        launchDate: '2024-12-05', operator: 'ESA/Copernicus', sensorSuite: 'C-SAR (C-band SAR)', resolution: '~5×20 m (IW mode)',
        fallbackTle: [
            "1 62261U 24235A   26239.99547892 -.00000171  00000+0 -26651-4 0  9992",
            "2 62261  98.1826 246.2873 0001329  87.9508 272.1844 14.59197261 91886"
        ]
    },
    {
        id: 'sentinel1d', name: 'Sentinel-1D', noradId: 66315,
        types: ['SAR_C'], swath: 250, cycle: '12 days', color: '#2563eb', freeData: true,
        launchDate: '2025-11-04', operator: 'ESA/Copernicus', sensorSuite: 'C-SAR (C-band SAR)', resolution: '~5×20 m (IW mode)',
        fallbackTle: [
            "1 66315U 25251A   26239.96134394 -.00000026  00000+0  41099-5 0  9993",
            "2 66315  98.1832 246.3079 0001402  89.4473 270.6887 14.59197506 43199"
        ]
    },
    {
        id: 'sentinel2a', name: 'Sentinel-2A', noradId: 40697,
        types: ['MULTISPECTRAL'], swath: 290, cycle: '10 days', color: '#a78bfa', freeData: true,
        launchDate: '2015-06-23', operator: 'ESA/Copernicus', sensorSuite: 'MSI (multispectral imager, 13 bands)', resolution: '10 m (VNIR), 20 m (red-edge/SWIR), 60 m (atmospheric)',
        fallbackTle: [
            "1 40697U 15028A   26239.96293221 -.00000007  00000+0  13927-4 0  9991",
            "2 40697  98.5649 313.7781 0001326  88.9197 271.2138 14.30816759583995"
        ]
    },
    {
        id: 'sentinel2b', name: 'Sentinel-2B', noradId: 42063,
        types: ['MULTISPECTRAL'], swath: 290, cycle: '10 days', color: '#8b5cf6', freeData: true,
        launchDate: '2017-03-07', operator: 'ESA/Copernicus', sensorSuite: 'MSI (multispectral imager, 13 bands)', resolution: '10 m (VNIR), 20 m (red-edge/SWIR), 60 m (atmospheric)',
        fallbackTle: [
            "1 42063U 17013A   26239.95572807  .00000015  00000+0  22328-4 0  9998",
            "2 42063  98.5657 313.6997 0001273  91.0430 269.0899 14.30815969494900"
        ]
    },
    {
        id: 'sentinel2c', name: 'Sentinel-2C', noradId: 60989,
        types: ['MULTISPECTRAL'], swath: 290, cycle: '10 days', color: '#7c3aed', freeData: true,
        launchDate: '2024-09-05', operator: 'ESA/Copernicus', sensorSuite: 'MSI (multispectral imager, 13 bands)', resolution: '10 m (VNIR), 20 m (red-edge/SWIR), 60 m (atmospheric)',
        fallbackTle: [
            "1 60989U 24157A   26239.64105257  .00000091  00000+0  51486-4 0  9990",
            "2 60989  98.5647 313.3948 0001440  98.9120 261.2226 14.30816623103203"
        ]
    },
    {
        id: 'hotsat1', name: 'HOTSAT-1', noradId: 56954,
        types: ['THERMAL'], swath: 4, cycle: '~5 days (tasked)', color: '#fb923c', freeData: false,
        launchDate: '2023-06-13', operator: 'SatVu', sensorSuite: 'High-res thermal infrared imager (~3.5m)', resolution: '~3.5 m',
        fallbackTle: [
            "1 56954U 23084Y   26239.96105708  .00004091  00000+0  17476-3 0  9995",
            "2 56954  97.6322  15.4555 0002593  76.4135 283.7391 15.23454987178029"
        ]
    },
    {
        id: 'hotsat2', name: 'HOTSAT-2', noradId: 68465,
        types: ['THERMAL'], swath: 4, cycle: '~5 days (tasked)', color: '#f97316', freeData: false,
        launchDate: '2026-03-30', operator: 'SatVu', sensorSuite: 'High-res thermal infrared imager (~3.5m)', resolution: '~3.5 m',
        fallbackTle: [
            "1 68465U 26067BB  26239.84092907  .00003105  00000+0  15646-3 0  9994",
            "2 68465  97.4592 197.1264 0003648 152.8649 207.2776 15.17906458 22802"
        ]
    },
    {
        id: 'skybee1', name: 'SkyBee-1', noradId: 62671,
        types: ['THERMAL'], swath: 35, cycle: '~3 days (tasked)', color: '#eab308', freeData: false,
        launchDate: '2025-01-14', operator: 'Constellr', sensorSuite: 'Thermal infrared imager (~30m, LST-focused)', resolution: '~30 m',
        fallbackTle: [
            "1 62671U 25009BQ  26239.91834040  .00002445  00000+0  11230-3 0  9993",
            "2 62671  97.3951 317.2309 0006961  85.1349 275.0681 15.21306159147245"
        ]
    },
    {
        id: 'skybee2', name: 'SkyBee-2', noradId: 64544,
        types: ['THERMAL'], swath: 35, cycle: '~3 days (tasked)', color: '#ca8a04', freeData: false,
        launchDate: '2025-06-23', operator: 'Constellr', sensorSuite: 'Thermal infrared imager (~30m, LST-focused)', resolution: '~30 m',
        fallbackTle: [
            "1 64544U 25135S   26239.87916622  .00002759  00000+0  12975-3 0  9991",
            "2 64544  97.4794 354.0828 0000345 198.9895 161.1328 15.20420941 65726"
        ]
    },
    {
        id: 'gcomc', name: 'GCOM-C (Shikisai)', noradId: 43065,
        types: ['MULTISPECTRAL', 'THERMAL'], swath: 1150, cycle: '~2-3 days', color: '#ec4899', freeData: true,
        launchDate: '2017-12-23', operator: 'JAXA', sensorSuite: 'SGLI: VNR (multispectral) + IRS (thermal infrared)', resolution: '250 m – 1 km',
        fallbackTle: [
            "1 43065U 17082A   26239.65335485  .00000109  00000+0  62577-4 0  9997",
            "2 43065  98.6229 312.3364 0001279  96.6415 263.4912 14.27286833452134"
        ]
    }
];

const HIMAWARI = { id: 'himawari9', name: 'Himawari-9', color: '#facc15', lat: 0, lng: 140.7, type: 'GEO' };

// Rough bounding boxes, not administrative boundaries -- see
// docs/CHALLENGES.md "Pass detection is a bounding-box approximation".
const REGIONS = {
    'Hokkaido': { minLat: 41.0, maxLat: 45.8, minLng: 139.0, maxLng: 146.5 },
    'Tohoku': { minLat: 36.5, maxLat: 41.6, minLng: 139.0, maxLng: 142.5 },
    'Kanto': { minLat: 34.5, maxLat: 37.0, minLng: 138.5, maxLng: 141.5 },
    'Chubu': { minLat: 34.0, maxLat: 38.5, minLng: 135.0, maxLng: 139.5 },
    'Kansai': { minLat: 33.0, maxLat: 36.0, minLng: 134.0, maxLng: 136.5 },
    'Chugoku': { minLat: 33.5, maxLat: 35.8, minLng: 130.5, maxLng: 134.5 },
    'Shikoku': { minLat: 32.5, maxLat: 34.5, minLng: 131.5, maxLng: 135.0 },
    'Kyushu': { minLat: 30.5, maxLat: 34.2, minLng: 128.5, maxLng: 132.5 },
    'Okinawa': { minLat: 23.5, maxLat: 27.5, minLng: 122.5, maxLng: 128.5 }
};

// Centroid of each region's bounding box -- coarse, but good enough as one
// representative point per region for a cloud-cover forecast lookup
// (js/clouds.js). Same bounding-box caveat as REGIONS itself.
const REGION_CENTERS = Object.fromEntries(
    Object.entries(REGIONS).map(([name, b]) => [name, { lat: (b.minLat + b.maxLat) / 2, lng: (b.minLng + b.maxLng) / 2 }])
);

const HISTORY_MINS = 25;

// Raw envelope of all 9 regions, WITHOUT the per-satellite swath padding
// used for pass grouping in js/passes.js. Used to trim the highlight-box
// polygon in js/map.js to just the portion actually over Japan -- the
// padded region bounds used for pass detection can extend a wide-swath
// satellite's detected pass (and therefore its drawn box) well out over
// open ocean or neighboring countries, especially for GCOM-C's 1150km
// swath.
const JAPAN_ENVELOPE = (() => {
    const bounds = Object.values(REGIONS);
    return {
        minLat: Math.min(...bounds.map(b => b.minLat)),
        maxLat: Math.max(...bounds.map(b => b.maxLat)),
        minLng: Math.min(...bounds.map(b => b.minLng)),
        maxLng: Math.max(...bounds.map(b => b.maxLng))
    };
})();
