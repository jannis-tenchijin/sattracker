// Leaflet setup: base map, panes (z-order for swath/tail overlays), live
// satellite markers, orbit/swath drawing on click, and the faint Japan
// region boundary overlay.

const map = L.map('map', {
    center: [38, 138],
    zoom: 4,
    minZoom: 2,
    worldCopyJump: false,
    zoomControl: false,
    attributionControl: false // removes Leaflet's default white attribution box -- see docs/CHALLENGES.md
});
L.control.zoom({ position: 'topright' }).addTo(map);

// CARTO's anonymous dark basemap now requires an API key (confirmed
// 2026-08-28 -- tiles come back watermarked "API KEY REQUIRED"). Esri's
// World Dark Gray Base is free, keyless, and CORS-open. Note the tile URL
// is {z}/{y}/{x} (ArcGIS REST convention), not Leaflet's usual {z}/{x}/{y}.
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    maxZoom: 16
}).addTo(map);

map.createPane('regionPane');
map.getPane('regionPane').style.zIndex = 350;

map.createPane('highlightPane');
map.getPane('highlightPane').style.zIndex = 400;
map.getPane('highlightPane').style.opacity = 0.9;

map.createPane('pastSwathPane');
map.getPane('pastSwathPane').style.zIndex = 401;
map.getPane('pastSwathPane').style.opacity = 0.6;

map.createPane('futureSwathPane');
map.getPane('futureSwathPane').style.zIndex = 402;
map.getPane('futureSwathPane').style.opacity = 0.4;

map.createPane('tailPane');
map.getPane('tailPane').style.zIndex = 403;
map.getPane('tailPane').style.opacity = 0.6;

const activeOrbitGroup = L.layerGroup().addTo(map);
const regionGroup = L.layerGroup().addTo(map);
let markers = {};
let liveTails = {};
let activeSatId = null;
let activeCardId = null;
let previousMapView = null;

// Real coastline shapes (js/region-shapes.js), not bounding rectangles --
// each region is an array of island rings, drawn as one multi-ring
// polygon. REGIONS (the rectangles) still exist for the region
// selector's flyToBounds, where an approximate box is all that's needed.
function drawRegions(activeRegionKey) {
    regionGroup.clearLayers();
    Object.entries(REGION_SHAPES).forEach(([name, rings]) => {
        const isActive = activeRegionKey && activeRegionKey === name;
        [-360, 0, 360].forEach(offset => {
            const shifted = rings.map(ring => ring.map(([lat, lng]) => [lat, lng + offset]));
            L.polygon(shifted, {
                pane: 'regionPane',
                color: isActive ? '#10b981' : '#475569',
                weight: isActive ? 2 : 1,
                fill: isActive,
                fillColor: '#10b981',
                fillOpacity: isActive ? 0.08 : 0,
                opacity: isActive ? 0.9 : 0.35,
                interactive: false
            }).addTo(regionGroup);
        });
    });
}

function drawFullOrbit(id, cardElement = null) {
    activeOrbitGroup.clearLayers();
    const centerLng = map.getCenter().lng;

    if (id === 'himawari9') {
        const hOffset = getOptimalOffset(HIMAWARI.lng, centerLng);
        const shiftedHLng = HIMAWARI.lng + hOffset;
        [-360, 0, 360].forEach(offset => {
            L.circle([HIMAWARI.lat, shiftedHLng + offset], {
                radius: 9000000, color: HIMAWARI.color, weight: 1, fillOpacity: 0.08, interactive: false
            }).addTo(activeOrbitGroup);
        });
        return;
    }

    const sat = SATELLITES.find(s => s.id === id);
    if (!sat || !sat.satrec) return;

    const now = new Date();
    let startM = -90;
    let endM = 90;

    const passStart = cardElement && cardElement.dataset.passStart ? parseInt(cardElement.dataset.passStart) : null;
    const passEnd = cardElement && cardElement.dataset.passEnd ? parseInt(cardElement.dataset.passEnd) : null;

    if (cardElement && passStart && passEnd) {
        // Anchored directly to the pass's own fixed start/end, in BOTH
        // directions, regardless of past/live/future -- not derived from
        // "minutes until/since now". An earlier version of this fix still
        // pinned the near side to `now` for past/live passes (endM = 0),
        // which meant a live pass's window kept extending to match the
        // satellite's live position as time passed, and a past pass's
        // window grew without bound the longer it stayed selected -- the
        // box visibly crept across the map, tracking the live marker,
        // instead of staying put. Anchoring both ends to the fixed
        // passStart/passEnd makes the window -- and the polygon drawn
        // from it -- exactly [passStart-10min, passEnd+10min], forever,
        // however long the pass has been selected. See the note in
        // computePasses() (js/passes.js) for the other half of this fix.
        startM = (passStart - now.getTime()) / 60000 - 10;
        endM = (passEnd - now.getTime()) / 60000 + 10;
    }

    const allPastCoords = [];
    const allFutureCoords = [];
    const allHighlightCoords = [];
    const step = (endM - startM) > 1000 ? 1 : 0.2;

    for (let m = startM; m <= endM; m += step) {
        const tMs = now.getTime() + m * 60000;
        const pos = getSatPosition(sat.satrec, new Date(tMs));
        if (pos) {
            if (m <= 0) allPastCoords.push([pos.lat, pos.lng]);
            if (m >= 0) allFutureCoords.push([pos.lat, pos.lng]);
            if (passStart && passEnd && tMs >= (passStart - 60000) && tMs <= (passEnd + 60000) &&
                pos.lat >= JAPAN_ENVELOPE.minLat && pos.lat <= JAPAN_ENVELOPE.maxLat &&
                pos.lng >= JAPAN_ENVELOPE.minLng && pos.lng <= JAPAN_ENVELOPE.maxLng) {
                allHighlightCoords.push([pos.lat, pos.lng]);
            }
        }
    }

    const pastSegments = getWrappedSegments(allPastCoords, centerLng);
    const futureSegments = getWrappedSegments(allFutureCoords, centerLng);
    const highlightSegments = getWrappedSegments(allHighlightCoords, centerLng);

    [-360, 0, 360].forEach(offset => {
        highlightSegments.forEach(seg => {
            if (seg.length > 1) {
                let leftPts = [];
                let rightPts = [];
                const swathHalfKm = sat.swath / 2;

                for (let i = 0; i < seg.length; i++) {
                    const p1 = seg[Math.max(0, i - 1)];
                    const p2 = seg[Math.min(seg.length - 1, i + 1)];
                    const theta = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
                    const perp = theta + Math.PI / 2;
                    const cosLat = Math.max(0.1, Math.abs(Math.cos(seg[i][0] * Math.PI / 180)));
                    const dy = (swathHalfKm / 111.32) * Math.sin(perp);
                    const dx = (swathHalfKm / (111.32 * cosLat)) * Math.cos(perp);
                    leftPts.push([seg[i][0] + dy, seg[i][1] + dx + offset]);
                    rightPts.unshift([seg[i][0] - dy, seg[i][1] - dx + offset]);
                }

                L.polygon(leftPts.concat(rightPts), {
                    color: sat.color, weight: 2, fill: false,
                    pane: 'highlightPane', opacity: 1, interactive: false
                }).addTo(activeOrbitGroup);
            }
        });

        pastSegments.forEach(seg => {
            if (seg.length > 1) {
                const shiftedSeg = seg.map(p => [p[0], p[1] + offset]);
                L.polyline(shiftedSeg, {
                    color: sat.color, weight: getWeightForSwath(map, sat.swath),
                    pane: 'pastSwathPane', opacity: 0.6, lineCap: 'butt', lineJoin: 'round', interactive: false
                }).addTo(activeOrbitGroup);
                L.polyline(shiftedSeg, { color: 'white', weight: 1.5, interactive: false, opacity: 0.4 }).addTo(activeOrbitGroup);
            }
        });

        futureSegments.forEach(seg => {
            if (seg.length > 1) {
                const shiftedSeg = seg.map(p => [p[0], p[1] + offset]);
                L.polyline(shiftedSeg, {
                    color: sat.color, weight: getWeightForSwath(map, sat.swath),
                    pane: 'futureSwathPane', opacity: 0.4, lineCap: 'butt', lineJoin: 'round', interactive: false
                }).addTo(activeOrbitGroup);
                L.polyline(shiftedSeg, { color: 'white', weight: 1.5, interactive: false, opacity: 0.9 }).addTo(activeOrbitGroup);
            }
        });
    });

    if (passStart && passEnd && allHighlightCoords.length > 2) {
        drawPassTimeLabel(sat, passStart, centerLng, allHighlightCoords);
    }
}

// Single time label on the active highlight box -- the pass's exact start
// time (matching the pass-list card, not rounded), and not a range. Only
// one satellite is ever highlighted at a time, so there's no risk of it
// turning into a wall of duplicate/near-duplicate timestamps.
//
// Positioned a fixed distance to one side of the track, perpendicular to
// its local heading at the midpoint (same math as the swath box edges) --
// not just "shifted up" -- so it sits clear of the swath box and the
// ground-track line itself instead of overlapping them.
function drawPassTimeLabel(sat, passStartMs, centerLng, coords) {
    const mid = Math.floor(coords.length / 2);
    const p1 = coords[Math.max(0, mid - 1)];
    const p2 = coords[Math.min(coords.length - 1, mid + 1)];
    const theta = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
    const perp = theta + Math.PI / 2;
    const marginKm = sat.swath / 2 + 25; // clear of the drawn swath box
    const cosLat = Math.max(0.1, Math.abs(Math.cos(coords[mid][0] * Math.PI / 180)));
    const dy = (marginKm / 111.32) * Math.sin(perp);
    const dx = (marginKm / (111.32 * cosLat)) * Math.cos(perp);
    const labelLat = coords[mid][0] + dy;
    const labelLng = coords[mid][1] + dx;

    // Exact pass start, formatted identically to the pass-list card's own
    // timestamp (js/ui.js renderPassCard) -- no rounding, so the two never
    // disagree about when the pass actually starts.
    const timeStr = new Date(passStartMs).toLocaleString(t().dateFormat, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const offset = getOptimalOffset(labelLng, centerLng);

    const icon = L.divIcon({
        className: 'pass-time-label',
        html: `<div style="display: inline-block; position: absolute; transform: translate(-50%, -50%); background: rgba(15,21,32,0.95); border: 1px solid ${sat.color}; color: #e2e8f0; font-size: 10px; line-height: 1.6; font-weight: 700; font-family: monospace; padding: 4px 7px; border-radius: 5px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${timeStr}</div>`,
        iconSize: [0, 0], iconAnchor: [0, 0]
    });
    L.marker([labelLat, labelLng + offset], { icon, interactive: false, zIndexOffset: 2000 }).addTo(activeOrbitGroup);
}

function removeSatDisplay(id) {
    if (markers[id]) {
        ['center', 'left', 'right'].forEach(k => {
            if (markers[id][k]) { map.removeLayer(markers[id][k]); markers[id][k] = null; }
        });
    }
    if (liveTails[id]) { map.removeLayer(liveTails[id]); delete liveTails[id]; }
}

// Fast tick (called every 1s): move markers to their current position only.
// Kept deliberately cheap -- one propagate per satellite, no Leaflet layer
// churn -- so it's safe to run every second without visible jank.
function updateLivePositions() {
    const centerLng = map.getCenter().lng;

    SATELLITES.forEach(sat => {
        if (!sat.satrec) return;
        if (selectedType && !sat.types.includes(selectedType)) {
            removeSatDisplay(sat.id);
            if (activeSatId === sat.id) {
                activeSatId = null;
                activeCardId = null;
                activeOrbitGroup.clearLayers();
            }
            return;
        }

        const pos = getSatPosition(sat.satrec, new Date());
        if (!pos) return;
        const heading = getHeading(sat.satrec, new Date());
        const dimmed = !!activeSatId && activeSatId !== sat.id;
        placeMarker(sat.id, pos.lat, pos.lng, centerLng, sat.color, 12, 1000, heading, dimmed);
    });

    const hOffset = getOptimalOffset(HIMAWARI.lng, centerLng);
    const himawariDimmed = !!activeSatId && activeSatId !== 'himawari9';
    // Geostationary -- no ground-track heading to point an arrow along.
    placeMarker('himawari9', HIMAWARI.lat, HIMAWARI.lng + hOffset, centerLng, HIMAWARI.color, 16, 900, null, himawariDimmed);
}

const DIM_COLOR = '#475569';

// Small triangle rotated to the compass heading, tip pointing outward from
// the dot -- transform-origin defaults to the wrapper's own center, which
// is also the dot's center, so rotating it swings the arrow like a clock
// hand without needing separate pivot math.
function buildSatIconHtml(color, size, heading, dimmed) {
    const displayColor = dimmed ? DIM_COLOR : color;
    const wrap = size + 14;
    const half = wrap / 2;
    const arrowHtml = (heading != null) ? `
        <div style="position:absolute; top:0; left:0; width:${wrap}px; height:${wrap}px; transform: rotate(${heading}deg);">
            <div style="position:absolute; left:${half - 4}px; top:0; width:0; height:0;
                        border-left:4px solid transparent; border-right:4px solid transparent;
                        border-bottom:6px solid ${displayColor};"></div>
        </div>` : '';
    return {
        html: `<div style="position:relative; width:${wrap}px; height:${wrap}px; opacity:${dimmed ? 0.18 : 1};">
            ${arrowHtml}
            <div style="position:absolute; left:${half - size / 2}px; top:${half - size / 2}px; background:${displayColor}; width:${size}px; height:${size}px; border-radius:50%; border:2px solid white; box-shadow:0 0 ${size < 16 ? 8 : 10}px ${displayColor};"></div>
        </div>`,
        wrap
    };
}

function placeMarker(id, lat, lng, centerLng, color, size, zIndexOffset, heading, dimmed = false) {
    let diff = lng - centerLng;
    diff = ((diff + 180) % 360 + 360) % 360 - 180;
    const shiftedLng = centerLng + diff;

    if (!markers[id]) markers[id] = { center: null, left: null, right: null };
    const { html, wrap } = buildSatIconHtml(color, size, heading, dimmed);
    const icon = L.divIcon({ className: 'custom-div-icon', html, iconSize: [wrap, wrap], iconAnchor: [wrap / 2, wrap / 2] });

    [-360, 0, 360].forEach(offset => {
        const key = offset === 0 ? 'center' : (offset === -360 ? 'left' : 'right');
        const finalLng = shiftedLng + offset;

        if (!markers[id][key]) {
            markers[id][key] = L.marker([lat, finalLng], { icon, zIndexOffset }).addTo(map);
            markers[id][key].on('click', () => toggleSatelliteFocus(id));
        } else {
            markers[id][key].setLatLng([lat, finalLng]);
            markers[id][key].setIcon(icon); // cheap: one small divIcon, keeps the arrow's heading current
        }
    });
}

// Slow tick (called every 5s): rebuild the trailing ground-track tails and
// the active orbit highlight. This does real Leaflet layer churn (destroys
// and recreates polylines), so it stays off the 1s cadence -- see
// docs/CHALLENGES.md "1Hz updates: markers vs. tails".
function updateMap() {
    updateLivePositions();
    const now = new Date();
    const centerLng = map.getCenter().lng;

    SATELLITES.forEach(sat => {
        if (!sat.satrec) return;
        if (selectedType && !sat.types.includes(selectedType)) return;

        const tailPath = [];
        for (let m = -HISTORY_MINS; m <= 0; m += 0.25) {
            const pos = getSatPosition(sat.satrec, new Date(now.getTime() + m * 60000));
            if (pos) tailPath.push([pos.lat, pos.lng]);
        }
        if (tailPath.length === 0) return;

        const tailSegments = getWrappedSegments(tailPath, centerLng);

        if (liveTails[sat.id]) map.removeLayer(liveTails[sat.id]);

        if (activeSatId !== sat.id) {
            // This branch only ever runs for satellites OTHER than the
            // active one (see the guard above) -- so whenever something
            // IS active, every tail drawn here is, by construction, one to
            // dim.
            const tailDimmed = !!activeSatId;
            liveTails[sat.id] = L.layerGroup();
            [-360, 0, 360].forEach(offset => {
                tailSegments.forEach(seg => {
                    if (seg.length > 1) {
                        const shiftedSeg = seg.map(p => [p[0], p[1] + offset]);
                        L.polyline(shiftedSeg, {
                            color: tailDimmed ? DIM_COLOR : sat.color, weight: getWeightForSwath(map, sat.swath),
                            pane: 'tailPane', opacity: tailDimmed ? 0.12 : 0.6, lineCap: 'butt', interactive: false
                        }).addTo(liveTails[sat.id]);
                    }
                });
            });
            liveTails[sat.id].addTo(map);
        }
    });

    if (activeSatId) {
        const card = activeCardId ? document.getElementById(activeCardId) : null;
        drawFullOrbit(activeSatId, card);
    }
}

// Leaflet's flyTo() can throw synchronously (a "Invalid LatLng (NaN, NaN)"
// internal error) if it's called again before a previous flyTo animation
// has settled. Falls back to an instant setView so a bad animation can
// never leave map state (or code that runs after the call) stuck.
function safeFlyTo(latlng, zoom, opts) {
    try {
        map.flyTo(latlng, zoom, opts);
    } catch (err) {
        console.warn('[map] flyTo failed, falling back to setView:', err.message);
        map.setView(latlng, zoom);
    }
}

// Deselects whatever satellite is currently focused, regardless of how it
// got selected (legend, marker, or pass card) -- shared by the toggle
// logic below and the pass-list's "Clear" button.
function clearActiveSatellite() {
    if (!activeSatId) return;
    activeSatId = null;
    activeCardId = null;
    activeOrbitGroup.clearLayers();
    if (previousMapView) {
        // Null the state out BEFORE calling flyTo, not after: if flyTo
        // throws (see safeFlyTo), a post-call reset would never run and
        // "unselect" would silently stop restoring the previous view.
        const target = previousMapView;
        previousMapView = null;
        safeFlyTo(target.center, target.zoom, { duration: 0.8 });
    }
    document.querySelectorAll('.card-active').forEach(c => {
        c.classList.remove('card-active', 'border-l-4');
        c.style.borderColor = '';
    });
    if (typeof onSatelliteFilterCleared === 'function') onSatelliteFilterCleared();
    if (typeof buildLegend === 'function') buildLegend();
    // Always refresh the Clear button's visibility, even when there was no
    // list filter to undo (a card- or next-data-banner-driven selection).
    if (typeof updateListHeaderLabel === 'function') updateListHeaderLabel();
    updateMap();
}

// Re-applies the "this card is the active one" border/highlight after the
// pass list's DOM gets rebuilt (filter change, periodic refresh) -- the
// styling lives on the DOM node directly, not in the render template, so
// a rebuild otherwise silently drops it even though activeCardId is still
// set correctly in memory.
function reapplyActiveCardHighlight() {
    if (!activeCardId) return;
    const card = document.getElementById(activeCardId);
    if (!card) return;
    const satColor = activeSatId === 'himawari9' ? HIMAWARI.color : SATELLITES.find(s => s.id === activeSatId)?.color;
    card.classList.add('card-active', 'border-l-4');
    card.style.borderColor = satColor || '';
}

function toggleSatelliteFocus(id, cardElementId = null) {
    const isClickingSameCard = cardElementId && document.getElementById(cardElementId)?.classList.contains('card-active');
    const isClickingSameMarker = !cardElementId && activeSatId === id && !activeCardId;

    if (activeSatId === id && (isClickingSameCard || isClickingSameMarker)) {
        clearActiveSatellite();
        return;
    } else {
        if (!previousMapView) previousMapView = { center: map.getCenter(), zoom: map.getZoom() };
        activeSatId = id;
        activeCardId = cardElementId;

        document.querySelectorAll('.card-active').forEach(c => {
            c.classList.remove('card-active', 'border-l-4');
            c.style.borderColor = '';
        });

        let card = null;
        if (cardElementId) {
            card = document.getElementById(cardElementId);
            if (card) {
                const satColor = id === 'himawari9' ? HIMAWARI.color : SATELLITES.find(s => s.id === id).color;
                card.classList.add('card-active', 'border-l-4');
                card.style.borderColor = satColor;
                // No scrollIntoView here: clicking an entry should only
                // highlight it, never move the list.
            }
        }

        drawFullOrbit(id, card);

        if (cardElementId) {
            // Selected via a pass card (or the pinned Himawari card): fly
            // to that specific pass/marker position. Doesn't touch the
            // pass-list filter at all.
            let targetLatLng = null;
            if (card && card.dataset.passTime && id !== 'himawari9') {
                const passTimeMs = parseInt(card.dataset.passTime);
                const sat = SATELLITES.find(s => s.id === id);
                if (sat && sat.satrec && !isNaN(passTimeMs)) {
                    const passPos = getSatPosition(sat.satrec, new Date(passTimeMs));
                    if (passPos) {
                        const centerLng = map.getCenter().lng;
                        const passOffset = getOptimalOffset(passPos.lng, centerLng);
                        targetLatLng = [passPos.lat, passPos.lng + passOffset];
                    }
                }
            }
            if (targetLatLng) {
                safeFlyTo(targetLatLng, 5, { duration: 1 });
            } else {
                const marker = markers[id]?.center;
                if (marker) safeFlyTo(marker.getLatLng(), 4.5, { duration: 1 });
            }
        } else {
            // Selected via the legend or a map marker: leave the camera
            // exactly where it is -- updateLivePositions()/updateMap()
            // dim every other satellite based on activeSatId instead --
            // and filter the pass list to this satellite.
            if (typeof onSatelliteFilterSelected === 'function') onSatelliteFilterSelected(id);
        }
        if (typeof buildLegend === 'function') buildLegend();
        // Card-origin selects don't go through onSatelliteFilterSelected
        // (that would filter the list), but Clear should still appear so
        // there's a way back to the previous map view.
        if (typeof updateListHeaderLabel === 'function') updateListHeaderLabel();
    }
    updateMap();
}

function focusSatellite(id, cardElementId = null) { toggleSatelliteFocus(id, cardElementId); }

map.on('zoomend', () => updateMap());
map.on('moveend', () => updateMap());
