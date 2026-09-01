// Cloud-cover risk badge for optical/multispectral/thermal passes -- see
// docs/IDEAS.md "Cloud-cover risk badge" (now built) and docs/CHALLENGES.md
// for the honesty caveats. Forecast-only, from Open-Meteo (free, keyless,
// no fetch restrictions since this is a local app) -- never shown for SAR
// (radar sees through cloud) and never shown for a pass that's already
// happened, since a forecast can't retroactively describe the past.

const SAR_ONLY_TYPES = new Set(['SAR_L', 'SAR_C']);
const CLOUD_FORECAST_DAYS = 7; // comfortably covers computePasses()'s futureDays window
const CLOUD_CACHE_KEY = 'sattracker_cloud_forecast';
const CLOUD_CACHE_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3h -- forecasts don't need per-minute freshness
const CLOUD_FETCH_TIMEOUT_MS = 8000;

// Risk tiers: average forecast cloud-cover % across the pass's intersecting
// regions, at the forecast hour nearest pass.time. Thresholds are a
// reasonable, made-up convention (not a scientific cutoff) -- see
// docs/CHALLENGES.md "Cloud-risk badge is a rough forecast, not a promise".
const CLOUD_RISK_CHANCE_THRESHOLD = 35;
const CLOUD_RISK_LIKELY_THRESHOLD = 65;

let cloudForecast = {}; // regionName -> { times: [ms,...], values: [pct,...] }
let cloudForecastStatus = 'loading'; // 'loading' | 'ready' | 'unavailable'

function getCachedCloudForecast() {
    try {
        const raw = localStorage.getItem(CLOUD_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.cachedAt > CLOUD_CACHE_MAX_AGE_MS) return null;
        return parsed.data;
    } catch (err) {
        return null;
    }
}

function setCachedCloudForecast(data) {
    try {
        localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data }));
    } catch (err) { /* localStorage full/unavailable -- just re-fetches next load */ }
}

async function loadCloudForecast() {
    const cached = getCachedCloudForecast();
    if (cached) {
        cloudForecast = cached;
        cloudForecastStatus = 'ready';
        return;
    }

    const regionNames = Object.keys(REGION_CENTERS);
    const lats = regionNames.map(r => REGION_CENTERS[r].lat).join(',');
    const lngs = regionNames.map(r => REGION_CENTERS[r].lng).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&hourly=cloud_cover&forecast_days=${CLOUD_FORECAST_DAYS}&timezone=UTC`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLOUD_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        // Multi-location calls return an array (one entry per lat/lng, same
        // order as the request); guard the single-location shape too.
        const results = Array.isArray(body) ? body : [body];
        const data = {};
        regionNames.forEach((name, i) => {
            const hourly = results[i] && results[i].hourly;
            if (!hourly) return;
            data[name] = {
                times: hourly.time.map(iso => new Date(iso + 'Z').getTime()),
                values: hourly.cloud_cover
            };
        });
        cloudForecast = data;
        cloudForecastStatus = 'ready';
        setCachedCloudForecast(data);
    } catch (err) {
        console.warn('[clouds] forecast fetch failed, cloud-risk badge disabled:', err.message);
        cloudForecastStatus = 'unavailable';
    } finally {
        clearTimeout(timeout);
    }
}

function nearestCloudValue(series, targetMs) {
    let bestIdx = -1, bestDiff = Infinity;
    for (let i = 0; i < series.times.length; i++) {
        const diff = Math.abs(series.times[i] - targetMs);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    // More than ~90 min from the nearest hourly sample means targetMs fell
    // outside the fetched forecast window -- don't extrapolate.
    if (bestIdx === -1 || bestDiff > 90 * 60000) return null;
    return series.values[bestIdx];
}

// Returns null (no badge), 'chance', or 'likely' for a pass object from
// js/passes.js. null covers: SAR passes, already-happened passes, forecast
// not loaded/failed, or pass.time simply outside the forecast horizon.
function getCloudRiskForPass(pass) {
    if (cloudForecastStatus !== 'ready') return null;
    if (pass.types.some(ty => SAR_ONLY_TYPES.has(ty))) return null;
    if (pass.category === 'past') return null;

    const samples = [];
    pass.regions.forEach(name => {
        const series = cloudForecast[name];
        if (!series) return;
        const pct = nearestCloudValue(series, pass.time.getTime());
        if (pct != null) samples.push(pct);
    });
    if (samples.length === 0) return null;

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (avg >= CLOUD_RISK_LIKELY_THRESHOLD) return 'likely';
    if (avg >= CLOUD_RISK_CHANCE_THRESHOLD) return 'chance';
    return null;
}
