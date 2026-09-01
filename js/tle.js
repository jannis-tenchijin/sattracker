// Live TLE fetching from CelesTrak, with a graceful fallback to the
// snapshot baked into js/config.js. See docs/CHALLENGES.md for why this is
// a local app rather than a published Artifact (CSP blocks the fetch).

const CELESTRAK_URL = (noradId) =>
    `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=TLE`;

// Populated once loadAllTle() resolves; read by the UI to show a
// "live" / "offline snapshot" indicator and a last-updated timestamp.
const tleStatus = { mode: 'loading', updatedAt: null, failedCount: 0 };

const TLE_FETCH_TIMEOUT_MS = 8000;
const TLE_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const tleCacheKey = (noradId) => `sattracker_tle_${noradId}`;

// TLEs don't meaningfully change within an hour, and re-fetching all 15 on
// every load hammers CelesTrak for no benefit (and was very likely part of
// what triggered the connection issues seen during heavy testing this
// session). localStorage can throw (private browsing, disabled storage,
// quota) -- never let a cache failure break the actual fetch.
function getCachedTle(noradId) {
    try {
        const raw = localStorage.getItem(tleCacheKey(noradId));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() - entry.fetchedAt > TLE_CACHE_MAX_AGE_MS) return null;
        return entry;
    } catch (err) {
        return null;
    }
}

function setCachedTle(noradId, tle) {
    try {
        localStorage.setItem(tleCacheKey(noradId), JSON.stringify({ tle, fetchedAt: Date.now() }));
    } catch (err) {
        // Quota exceeded or storage disabled -- fine, just means no cache.
    }
}

async function fetchLiveTle(noradId) {
    // Without an explicit timeout, a network hiccup (observed: CelesTrak
    // connections timing out at the OS/browser level, which can take much
    // longer than a person will wait) hangs the whole app on "Loading
    // TLE..." far past the point where falling back would be the better
    // call.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TLE_FETCH_TIMEOUT_MS);
    let res;
    try {
        res = await fetch(CELESTRAK_URL(noradId), { cache: 'no-store', signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
    const text = (await res.text()).trim();
    const lines = text.split('\n').map(l => l.trim());
    // Response is "NAME\nLINE1\nLINE2"; tolerate a missing name line.
    const l1 = lines.find(l => l.startsWith('1 '));
    const l2 = lines.find(l => l.startsWith('2 '));
    if (!l1 || !l2) throw new Error('Malformed TLE response');
    return [l1, l2];
}

const TLE_GLOBAL_DEADLINE_MS = 15000;

async function loadAllTle(satellites) {
    let liveCount = 0;

    // Each fetch already has its own per-request timeout (above), but the
    // browser's per-origin connection limit (Chrome: ~6) means a batch of
    // 15 requests can still queue well past that individually -- observed
    // live, waiting 30s+ for all 15 to resolve one at a time. This global
    // deadline caps the WHOLE load: anything not resolved by then just
    // uses its fallback snapshot rather than making someone wait longer.
    const deadline = Symbol('tle-deadline');
    const deadlinePromise = new Promise(resolve => setTimeout(() => resolve(deadline), TLE_GLOBAL_DEADLINE_MS));

    await Promise.all(satellites.map(async (sat) => {
        let tle = sat.fallbackTle;

        const cached = getCachedTle(sat.noradId);
        if (cached) {
            sat.satrec = satellite.twoline2satrec(cached.tle[0], cached.tle[1]);
            liveCount++;
            return;
        }

        try {
            const result = await Promise.race([fetchLiveTle(sat.noradId), deadlinePromise]);
            if (result === deadline) {
                console.warn(`[tle] global ${TLE_GLOBAL_DEADLINE_MS}ms deadline hit before ${sat.name} resolved, using fallback snapshot`);
            } else {
                tle = result;
                liveCount++;
                setCachedTle(sat.noradId, tle);
            }
        } catch (err) {
            console.warn(`[tle] live fetch failed for ${sat.name}, using fallback snapshot:`, err.message);
        }
        sat.satrec = satellite.twoline2satrec(tle[0], tle[1]);
    }));

    tleStatus.updatedAt = new Date();
    if (liveCount === satellites.length) {
        tleStatus.mode = 'live';
    } else if (liveCount === 0) {
        tleStatus.mode = 'offline';
    } else {
        tleStatus.mode = 'partial';
    }
    tleStatus.failedCount = satellites.length - liveCount;
    return tleStatus;
}
