// Day/night shading: standard solar-terminator algorithm (subsolar point
// via low-precision solar ecliptic position, then the closed-form
// hour-angle solution for the latitude where solar elevation = 0 at each
// longitude). Same approach used by well-known terminator plugins/tools
// (xplanet, Leaflet.Terminator); good to a few tenths of a degree, which
// is plenty for "is it roughly day or night here" shading.

map.createPane('terminatorPane');
map.getPane('terminatorPane').style.zIndex = 250; // below regions/orbits, above the basemap

const terminatorGroup = L.layerGroup().addTo(map);

function julianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
}

// Sun's ecliptic longitude (radians), low-precision (~0.01 deg) solar
// position formula.
function sunEclipticLongitude(jd) {
    const n = jd - 2451545.0;
    let L = (280.460 + 0.9856474 * n) % 360; if (L < 0) L += 360;
    let g = (357.528 + 0.9856003 * n) % 360; if (g < 0) g += 360;
    g = g * Math.PI / 180;
    return (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
}

function eclipticObliquity(jd) {
    const n = jd - 2451545.0;
    return (23.4393 - 3.563e-7 * n) * Math.PI / 180;
}

// Right ascension + declination (both radians) of the sun.
function sunEquatorialPosition(lambda, obliquity) {
    const alpha = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda));
    const delta = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
    return { alpha, delta };
}

// Greenwich Mean Sidereal Time, in degrees.
function gmstDegrees(jd) {
    const T = (jd - 2451545.0) / 36525;
    let theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
    theta = theta % 360;
    return theta < 0 ? theta + 360 : theta;
}

// Terminator as a lat/lng curve sampled across all longitudes, plus which
// pole is fully in darkness right now (needed to close the night-side
// polygon around the correct pole).
function computeTerminator(date) {
    const jd = julianDate(date);
    const lambda = sunEclipticLongitude(jd);
    const obliquity = eclipticObliquity(jd);
    const { alpha, delta } = sunEquatorialPosition(lambda, obliquity);
    const gst = gmstDegrees(jd);
    const alphaDeg = alpha * 180 / Math.PI;
    const deltaRad = delta;

    const points = [];
    for (let lngDeg = -180; lngDeg <= 180; lngDeg += 2) {
        const haRad = (gst + lngDeg - alphaDeg) * Math.PI / 180;
        let latDeg = Math.atan(-Math.cos(haRad) / Math.tan(deltaRad)) * 180 / Math.PI;
        if (!isFinite(latDeg)) latDeg = 0; // near-zero declination (equinox) edge case
        points.push([latDeg, lngDeg]);
    }
    const nightPole = delta > 0 ? -90 : 90; // pole currently in permanent darkness
    return { points, nightPole };
}

function drawTerminator() {
    terminatorGroup.clearLayers();
    const { points, nightPole } = computeTerminator(new Date());

    [-360, 0, 360].forEach(offset => {
        const ring = [[nightPole, -180 + offset], ...points.map(p => [p[0], p[1] + offset]), [nightPole, 180 + offset]];
        L.polygon(ring, {
            pane: 'terminatorPane', stroke: false, fill: true,
            fillColor: '#00030a', fillOpacity: 0.38, interactive: false
        }).addTo(terminatorGroup);
    });
}
