// Pass detection: for each tracked satellite, walk its ground track minute
// by minute and group consecutive minutes that fall inside any Japan
// region into a single "pass". Approximate -- see docs/CHALLENGES.md.
//
// Returns English region keys (not translated) so the result doesn't need
// to be recomputed when the UI language toggles; the UI translates at
// render time.

// Real coastline polygons (js/region-shapes.js), not the old bounding
// rectangles -- so a satellite whose nadir track passes just off the
// coast no longer counts as "over" a region unless its swath actually
// reaches land. Since we only have the ground-track *center* point here
// (not a true footprint), approximate swath width as up to 4 cardinal
// test points (N/S/E/W of center by half the swath) in addition to the
// center itself -- cheap proxy for "does this swath corridor touch land"
// without needing per-sample heading/perpendicular math. A satellite with
// a narrow swath (<20km) skips this -- centerpoint-only is already
// accurate enough at that width. See docs/CHALLENGES.md.
function getIntersectingRegions(lat, lng, swathKm) {
    const halfDeg = (swathKm / 2) / 111;
    // Cheap pre-check against the raw (unbuffered) Japan envelope, padded
    // by the swath's own half-width plus a little slack, so the far more
    // expensive per-region polygon test only runs for samples anywhere
    // near Japan -- the vast majority of a satellite's orbit isn't.
    const slack = halfDeg + 1;
    if (lat < JAPAN_ENVELOPE.minLat - slack || lat > JAPAN_ENVELOPE.maxLat + slack ||
        lng < JAPAN_ENVELOPE.minLng - slack || lng > JAPAN_ENVELOPE.maxLng + slack) {
        return [];
    }

    const testPoints = [[lat, lng]];
    if (swathKm > 20) {
        const cosLat = Math.max(0.1, Math.abs(Math.cos(lat * Math.PI / 180)));
        const dLng = halfDeg / cosLat;
        testPoints.push([lat + halfDeg, lng], [lat - halfDeg, lng], [lat, lng + dLng], [lat, lng - dLng]);
    }

    let hits = [];
    for (const [regName, rings] of Object.entries(REGION_SHAPES)) {
        if (testPoints.some(([plat, plng]) => pointInRegionShape(plat, plng, rings))) {
            hits.push(regName);
        }
    }
    return hits;
}

function computePasses(satellites, now, pastDays = 5, futureDays = 4) {
    // Anchor the 60s sampling grid to whole-minute boundaries, not to the
    // exact instant this happens to be called. computePasses() re-runs
    // every 60s (see js/main.js); without this, each call's grid is phase
    // -shifted by a few seconds relative to the last, which can shift a
    // detected pass's startTime by up to a minute -- and since pass DOM
    // element ids are derived from that timestamp (js/ui.js), the
    // currently-selected pass's card id silently stops matching anything,
    // and its highlighted swath box reverts to the generic default view.
    // `now` itself (unrounded) is still used below for isLive/isSoon.
    const gridNow = Math.floor(now.getTime() / 60000) * 60000;
    const pastLimit = new Date(gridNow - (pastDays * 86400000));
    const futureLimit = new Date(gridNow + (futureDays * 86400000));

    let recentPasses = [];
    let upcomingPasses = [];

    satellites.forEach(sat => {
        if (!sat.satrec) return;
        let currentPass = null;

        for (let tMs = pastLimit.getTime(); tMs <= futureLimit.getTime(); tMs += 60000) {
            const time = new Date(tMs);
            const pos = getSatPosition(sat.satrec, time);
            if (!pos) continue;

            const regions = getIntersectingRegions(pos.lat, pos.lng, sat.swath);

            if (regions.length > 0) {
                if (!currentPass) {
                    currentPass = {
                        id: sat.id, name: sat.name, color: sat.color, types: sat.types, cycle: sat.cycle,
                        missionEnded: sat.missionEnded || null,
                        time, startTime: tMs, endTime: tMs, regions: new Set(regions)
                    };
                } else {
                    currentPass.endTime = tMs;
                    regions.forEach(r => currentPass.regions.add(r));
                }
            } else if (currentPass) {
                finalizePass(currentPass, now, sat.satrec);
                (currentPass.time <= now ? recentPasses : upcomingPasses).push(currentPass);
                currentPass = null;
            }
        }

        if (currentPass) {
            finalizePass(currentPass, now, sat.satrec);
            upcomingPasses.push(currentPass);
        }
    });

    recentPasses.sort((a, b) => b.time - a.time);
    upcomingPasses.sort((a, b) => a.time - b.time);

    return { recentPasses, upcomingPasses };
}

function finalizePass(pass, now, satrec) {
    const timeUntil = pass.time.getTime() - now.getTime();
    pass.isLive = (pass.time.getTime() <= now.getTime()) && (pass.endTime >= now.getTime());
    pass.isSoon = timeUntil > 0 && timeUntil <= (15 * 60000);
    pass.category = pass.isLive ? 'live' : (pass.time.getTime() > now.getTime() ? 'upcoming' : 'past');

    pass.node = getOrbitalNode(satrec, pass.time); // 'ascending' | 'descending' | null

    // Three distinct, deliberately separate questions -- see
    // docs/CHALLENGES.md "Three status tiers, none of them confirmed".
    // Tier 1, overpass opportunity: implicit -- this pass object existing
    // at all IS that (computePasses only creates one when the ground
    // track geometrically crosses a region).
    //
    // Tier 2, acquisitionStatus: 'likely' | 'unlikely' | 'none'. A
    // heuristic from the descending-node convention (js/config.js
    // DESCENDING_NODE_ONLY_TYPES) -- never "confirmed", we have no real
    // tasking data. 'none' only for a mission-ended satellite, where "no
    // acquisition" is actually a fact, not a heuristic.
    const governedByDescendingOnly = pass.types.some(ty => DESCENDING_NODE_ONLY_TYPES.has(ty));
    pass.acquisitionStatus = pass.missionEnded
        ? 'none'
        : (governedByDescendingOnly && pass.node !== 'descending' ? 'unlikely' : 'likely');

    // Tier 3, availabilityStatus: 'expected' | 'unknown' | 'none'. Only
    // meaningful when acquisition is at least 'likely' -- "expected", not
    // "confirmed": it's endTime + a published latency figure, not a
    // real per-scene confirmation (docs/RESEARCH.md/CHALLENGES.md).
    pass.dataLatencyHours = DATA_LATENCY_HOURS[pass.id] ?? null;
    pass.availabilityStatus = pass.acquisitionStatus !== 'likely'
        ? 'none'
        : (pass.dataLatencyHours != null ? 'expected' : 'unknown');
    pass.dataAvailableAt = pass.availabilityStatus === 'expected'
        ? pass.endTime + pass.dataLatencyHours * 3600000
        : null;
}
