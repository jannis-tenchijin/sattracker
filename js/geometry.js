// Map math: satellite propagation and the antimeridian-wrapping helpers
// needed to draw ground tracks cleanly on a Leaflet map that pans/zooms
// across the 180°/-180° seam.

function getSatPosition(satrec, date) {
    const posAndVel = satellite.propagate(satrec, date);
    if (!posAndVel.position) return null;
    const gmst = satellite.gstime(date);
    const posGd = satellite.eciToGeodetic(posAndVel.position, gmst);
    return { lat: satellite.degreesLat(posGd.latitude), lng: satellite.degreesLong(posGd.longitude), height: posGd.height };
}

// Ascending = moving north (latitude increasing), descending = moving
// south. Determined from the sign of the latitude derivative, sampled a
// few seconds apart around the given time.
function getOrbitalNode(satrec, date) {
    const dtMs = 5000;
    const before = getSatPosition(satrec, new Date(date.getTime() - dtMs));
    const after = getSatPosition(satrec, new Date(date.getTime() + dtMs));
    if (!before || !after) return null;
    return after.lat > before.lat ? 'ascending' : 'descending';
}

// Compass bearing of travel (0=N, 90=E, ...), from positions a few seconds
// before/after the given time. Used to draw a small direction arrow.
function getHeading(satrec, date) {
    const dtMs = 5000;
    const p1 = getSatPosition(satrec, new Date(date.getTime() - dtMs));
    const p2 = getSatPosition(satrec, new Date(date.getTime() + dtMs));
    if (!p1 || !p2) return null;
    const lat1 = p1.lat * Math.PI / 180, lat2 = p2.lat * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

function getNormalizedLng(lng) {
    return ((lng + 180) % 360 + 360) % 360 - 180;
}

// Optimal multi-world offset so a fixed point (e.g. Himawari's longitude)
// never vanishes off the edge of the current view.
function getOptimalOffset(targetLng, centerLng) {
    let lng = getNormalizedLng(targetLng);
    let diff = lng - centerLng;
    let offset = 0;
    while (diff < -180) { diff += 360; offset += 360; }
    while (diff > 180) { diff -= 360; offset -= 360; }
    return offset;
}

// Splits a track into segments wherever it would otherwise jump across the
// antimeridian, so each segment can be drawn as a clean polyline.
function getWrappedSegments(coords, centerLng) {
    if (!coords || coords.length === 0) return [];
    let segments = [];
    let currentSegment = [];

    for (let i = 0; i < coords.length; i++) {
        let lat = coords[i][0];
        let rawLng = coords[i][1];

        let diff = rawLng - centerLng;
        diff = ((diff + 180) % 360 + 360) % 360 - 180;
        let shiftedLng = centerLng + diff;

        if (currentSegment.length > 0) {
            let prevLng = currentSegment[currentSegment.length - 1][1];
            if (Math.abs(shiftedLng - prevLng) > 180) {
                segments.push(currentSegment);
                currentSegment = [];
            }
        }
        currentSegment.push([lat, shiftedLng]);
    }
    if (currentSegment.length > 0) segments.push(currentSegment);
    return segments;
}

// Standard ray-casting point-in-polygon test on a single ring (no holes --
// REGION_SHAPES doesn't have any, see js/region-shapes.js).
function pointInRing(lat, lng, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [lat1, lng1] = ring[i];
        const [lat2, lng2] = ring[j];
        const intersects = ((lng1 > lng) !== (lng2 > lng)) &&
            (lat < (lat2 - lat1) * (lng - lng1) / (lng2 - lng1) + lat1);
        if (intersects) inside = !inside;
    }
    return inside;
}

// True if (lat,lng) falls inside any of a region's islands (its polygons
// are disjoint, so a simple OR across them is correct -- no even-odd
// logic needed between separate landmasses).
function pointInRegionShape(lat, lng, regionRings) {
    for (const ring of regionRings) {
        if (pointInRing(lat, lng, ring)) return true;
    }
    return false;
}

// Converts a real swath width in km to a pixel stroke weight at the
// current zoom, so the drawn swath stays to-scale regardless of zoom.
function getWeightForSwath(map, swathKm) {
    const earthCircumference = 40075016;
    const mapWidthPixels = 256 * Math.pow(2, map.getZoom());
    const metersPerPixelEquator = earthCircumference / mapWidthPixels;
    return Math.max(2, (swathKm * 1000) / metersPerPixelEquator);
}
