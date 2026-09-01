// DOM rendering: legend, the fused pass timeline, region/type filters,
// clock, language toggle, roadmap popup, and the live/offline data badge.

let latestPasses = { recentPasses: [], upcomingPasses: [] };
let selectedRegion = ''; // '' = all regions
let selectedType = '';   // '' = all sensor types
let likelyAcquisitionOnly = true; // default: hide passes acquisition is unlikely/none for -- see js/passes.js acquisitionStatus
let freeDataOnly = false; // default off: show all operators regardless of open-data policy
let selectedSatelliteFilter = null; // set by clicking a satellite (legend, marker, or card)

// Called from js/map.js when a satellite becomes the active/focused one.
function onSatelliteFilterSelected(id) {
    if (id === 'himawari9') return; // no discrete passes to filter to
    selectedSatelliteFilter = id;
    renderPassLists(true);
    tickNextDataCountdown();
}

// Called from js/map.js's clearActiveSatellite() and by the "Clear" button.
function onSatelliteFilterCleared() {
    // Only scroll back to "now" when a legend/marker filter was actually
    // active -- clearing one swaps in a much longer unfiltered list, so
    // preserving the filtered list's old (small) scrollTop pixel value
    // landed near the top of the now-taller list, looking like a jump to
    // the top. A card-driven clear never set a filter in the first place
    // (the list didn't change), so it keeps scrollToNow=false and stays
    // put, per the earlier "don't move the list on card click" request.
    const hadFilter = selectedSatelliteFilter !== null;
    selectedSatelliteFilter = null;
    renderPassLists(hadFilter);
    tickNextDataCountdown();
}

function clearSatelliteFilter() {
    clearActiveSatellite();
}

function refreshPasses(scrollToNow = false) {
    latestPasses = computePasses(SATELLITES, new Date());
    renderPassLists(scrollToNow);
}

function regionLabel(name) { return t().regions[name] || name; }

function renderDataBadge() {
    const el = document.getElementById('data-badge');
    const dot = document.getElementById('data-badge-dot');
    if (tleStatus.mode === 'loading') {
        el.textContent = t().dataLoading;
        dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse';
        return;
    }
    const stamp = tleStatus.updatedAt ? tleStatus.updatedAt.toLocaleTimeString(t().dateFormat, { hour: '2-digit', minute: '2-digit' }) : '';
    const labels = { live: t().dataLive, partial: t().dataPartial, offline: t().dataOffline };
    const dotColors = { live: 'bg-emerald-400', partial: 'bg-amber-400', offline: 'bg-red-400' };
    el.textContent = `${labels[tleStatus.mode]} · ${t().updated} ${stamp}`;
    dot.className = `w-1.5 h-1.5 rounded-full ${dotColors[tleStatus.mode]}`;
}

function buildLegend() {
    const container = document.getElementById('legend-container');
    container.innerHTML = '';
    SATELLITES.forEach(sat => {
        const dimmed = (selectedType && !sat.types.includes(selectedType)) || (!!activeSatId && activeSatId !== sat.id);
        const endedSuffix = sat.missionEnded ? ` <span class="text-slate-600">(${t().endedSuffix})</span>` : '';
        container.innerHTML += `
            <div class="flex items-center gap-1.5 cursor-pointer hover:bg-white/10 p-1 px-2 rounded-md transition-colors shrink-0 ${dimmed ? 'opacity-30' : ''} ${sat.missionEnded ? 'opacity-50' : ''}" onclick="toggleSatelliteFocus('${sat.id}')">
                <div class="w-2 h-2 rounded-full shrink-0" style="background: ${sat.color}"></div>
                <span class="leading-none text-[10px] md:text-[11px] whitespace-nowrap text-slate-300">${sat.name}${endedSuffix}</span>
            </div>`;
    });
}

function buildRegionSelector() {
    const select = document.getElementById('region-select');
    select.innerHTML = `<option value="">${t().regionAll}</option>` +
        Object.keys(REGIONS).map(r => `<option value="${r}">${regionLabel(r)}</option>`).join('');
    select.value = selectedRegion;
}

function buildTypeSelector() {
    const select = document.getElementById('type-select');
    select.innerHTML = `<option value="">${t().typeAll}</option>` +
        Object.keys(SENSOR_FAMILY).map(key => `<option value="${key}">${t().satTypes[key] || SENSOR_FAMILY[key].label}</option>`).join('');
    select.value = selectedType;
}

function onRegionChange(value) {
    selectedRegion = value;
    document.getElementById('region-select').value = value;
    drawRegions(selectedRegion || null);
    if (selectedRegion) {
        const b = REGIONS[selectedRegion];
        try {
            map.flyToBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]], { duration: 0.8, padding: [40, 40] });
        } catch (err) {
            console.warn('[map] flyToBounds failed, falling back to fitBounds:', err.message);
            map.fitBounds([[b.minLat, b.minLng], [b.maxLat, b.maxLng]], { padding: [40, 40] });
        }
    }
    renderPassLists(true);
    tickNextDataCountdown();
}

function onTypeChange(value) {
    selectedType = value;
    document.getElementById('type-select').value = value;
    buildLegend();
    updateMap();
    renderPassLists(true);
    tickNextDataCountdown();
}

function toggleLikelyAcquisitionOnly() {
    likelyAcquisitionOnly = !likelyAcquisitionOnly;
    renderFilterToggleButtons();
    renderPassLists(true);
}

function toggleFreeDataOnly() {
    freeDataOnly = !freeDataOnly;
    renderFilterToggleButtons();
    renderPassLists(true);
}

function renderFilterToggleButtons() {
    const s = t();
    const acqBtn = document.getElementById('acquisition-filter-btn');
    acqBtn.textContent = likelyAcquisitionOnly ? s.likelyAcquisitionsLabel : s.allOverpassesLabel;
    acqBtn.classList.toggle('filter-toggle-active', likelyAcquisitionOnly);

    const dataBtn = document.getElementById('free-data-filter-btn');
    dataBtn.textContent = freeDataOnly ? s.freeDataOnlyLabel : s.allDataLabel;
    dataBtn.classList.toggle('filter-toggle-active', freeDataOnly);
}

function passMatchesFilters(pass) {
    if (selectedSatelliteFilter && pass.id !== selectedSatelliteFilter) return false;
    if (selectedRegion && !pass.regions.has(selectedRegion)) return false;
    if (selectedType && !pass.types.includes(selectedType)) return false;
    if (likelyAcquisitionOnly && pass.acquisitionStatus !== 'likely') return false;
    if (freeDataOnly) {
        const sat = SATELLITES.find(s => s.id === pass.id);
        if (sat && !sat.freeData) return false;
    }
    return true;
}

function renderPassCard(pass) {
    const now = new Date();
    const timeStr = pass.time.toLocaleString(t().dateFormat, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const regionStr = Array.from(pass.regions).map(regionLabel).join(', ');
    const typeStr = pass.types.map(ty => t().satTypes[ty] || ty).join(' + ');

    let badge = '';
    if (pass.isLive) {
        badge = `<span class="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold animate-pulse tracking-wide uppercase">${t().live}</span>`;
    } else if (pass.isSoon) {
        const mins = Math.ceil((pass.time.getTime() - now.getTime()) / 60000);
        badge = `<span class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold animate-pulse tracking-wide uppercase">${t().inMins(mins)}</span>`;
    } else if (pass.category === 'upcoming') {
        badge = `<span class="text-[9px] text-slate-500 font-semibold tracking-wide uppercase">${t().predicted}</span>`;
    }

    const opacityClass = pass.category === 'upcoming' ? 'bg-slate-900/60 opacity-70 hover:opacity-100 border-slate-800' : 'bg-slate-800/40 border-slate-700/50';
    const uniqueId = `card-${pass.id}-${pass.time.getTime()}`;

    const nodeArrow = pass.node === 'ascending' ? '▲' : (pass.node === 'descending' ? '▼' : '');
    const nodeLabel = pass.node ? t().node[pass.node] : '';
    const nodeBadge = pass.node
        ? `<span class="text-[10px] text-slate-500 font-mono" title="${nodeLabel}">${nodeArrow}</span>`
        : '';

    // Forecast-only, omitted for SAR and for already-happened passes -- see
    // js/clouds.js. Single cloud = chance, double cloud = very likely
    // covered; hovering explains the meaning via a custom tooltip (see
    // .cloud-badge/.cloud-tooltip in css/styles.css) that appears 0.5s
    // into the hover -- a native `title` tooltip's delay isn't
    // configurable, so this replaces that pattern for this badge only.
    const cloudRisk = getCloudRiskForPass(pass);
    const cloudBadge = cloudRisk === 'likely'
        ? `<span class="cloud-badge text-[10px] leading-none">☁️☁️<span class="cloud-tooltip">${t().cloudRiskLikely}</span></span>`
        : (cloudRisk === 'chance' ? `<span class="cloud-badge text-[10px] leading-none">☁️<span class="cloud-tooltip">${t().cloudRiskChance}</span></span>` : '');
    // Tier 2 (acquisition) note -- only for the non-default cases; a
    // 'likely' acquisition gets no note here (its status shows via the
    // tier-3 availability line below instead).
    const acquisitionNote = pass.acquisitionStatus === 'none'
        ? `<div class="text-[9px] text-slate-500 mt-1">${t().missionEnded(pass.missionEnded)}</div>`
        : (pass.acquisitionStatus === 'unlikely' ? `<div class="text-[9px] text-amber-500/70 mt-1">${t().acquisitionUnlikely}</div>` : '');

    // Tier 3 (availability) note -- "expected"/"unknown", never
    // "confirmed": see docs/CHALLENGES.md "Three status tiers".
    const availabilityNote = pass.availabilityStatus === 'expected'
        ? `<div class="text-[9px] text-sky-400/80 mt-1">${t().dataExpected(new Date(pass.dataAvailableAt).toLocaleString(t().dateFormat, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</div>`
        : (pass.availabilityStatus === 'unknown' ? `<div class="text-[9px] text-slate-600 mt-1">${t().dataAvailabilityUnknown}</div>` : '');

    return `
        <div id="${uniqueId}" data-sat-id="${pass.id}" data-pass-time="${pass.time.getTime()}" data-pass-start="${pass.startTime}" data-pass-end="${pass.endTime}" data-pass-category="${pass.category}" class="rounded-lg ${opacityClass} border p-3 card-hover transition-all cursor-pointer shrink-0 ${pass.acquisitionStatus !== 'likely' ? 'opacity-60' : ''}" onclick="focusSatellite('${pass.id}', '${uniqueId}')">
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold flex items-center gap-2 text-xs" style="color: ${pass.color}">
                    <div class="w-2 h-2 rounded-full shadow" style="background: ${pass.color}"></div> ${pass.name}
                    ${nodeBadge}
                    ${cloudBadge}
                    <button onclick="event.stopPropagation(); showSatelliteInfo('${pass.id}')"
                        class="w-3.5 h-3.5 rounded-full border border-slate-500 text-slate-500 hover:text-white hover:border-white transition-colors flex items-center justify-center text-[9px] leading-none font-mono not-italic" style="font-style: normal;">i</button>
                </span>
                ${badge}
            </div>
            <div class="text-xs text-slate-300 mb-1">${regionStr}</div>
            <div class="text-[10px] text-slate-500 flex justify-between items-center">
                <span class="font-mono text-slate-400">${timeStr}</span>
                <span>${typeStr} • ${pass.cycle}</span>
            </div>
            ${acquisitionNote}
            ${availabilityNote}
        </div>`;
}

function nowDividerHtml() {
    return `
        <div data-now-divider="1" class="flex items-center gap-3 mt-5 mb-1 px-1">
            <div class="flex-1 h-px bg-emerald-500/30"></div>
            <span class="text-[9px] font-bold text-emerald-400 uppercase tracking-widest whitespace-nowrap">${t().nowDivider}</span>
            <div class="flex-1 h-px bg-emerald-500/30"></div>
        </div>`;
}

// Fuses recent + upcoming into one chronological timeline (oldest at top,
// farthest future at bottom), with a "Now" divider at the point in time
// that separates them, and re-centers/re-labels around it.
function renderPassLists(scrollToNow = false) {
    const list = document.getElementById('pass-list');
    const priorScrollTop = list.scrollTop;

    const merged = [...latestPasses.recentPasses, ...latestPasses.upcomingPasses]
        .filter(passMatchesFilters)
        .sort((a, b) => a.time - b.time);

    if (merged.length === 0) {
        list.innerHTML = `<div class="text-[11px] text-slate-600 text-center py-6">—</div>`;
        updateListHeaderLabel();
        return;
    }

    const splitIndex = merged.findIndex(p => p.category === 'upcoming');
    let html = '';
    merged.forEach((pass, i) => {
        if (i === (splitIndex === -1 ? merged.length : splitIndex)) html += nowDividerHtml();
        html += `<div class="${i === 0 ? '' : 'mt-2'}">${renderPassCard(pass)}</div>`;
    });
    if (splitIndex === -1) html += nowDividerHtml(); // everything is in the past/live

    list.innerHTML = html;
    reapplyActiveCardHighlight();

    if (scrollToNow) {
        scrollListToNow(list);
    } else {
        list.scrollTop = priorScrollTop;
    }
    updateListHeaderLabel();
}

function scrollListToNow(list) {
    const target = list.querySelector('[data-pass-category="live"]') || list.querySelector('[data-pass-category="upcoming"]');
    if (target) {
        list.scrollTop += (target.getBoundingClientRect().top - list.getBoundingClientRect().top);
    } else {
        list.scrollTop = list.scrollHeight;
    }
}

let listLabelScrollQueued = false;
function updateListHeaderLabel() {
    const list = document.getElementById('pass-list');
    const header = document.getElementById('pass-list-lbl');
    const clearBtn = document.getElementById('satellite-filter-clear');

    if (selectedSatelliteFilter) {
        const sat = SATELLITES.find(s => s.id === selectedSatelliteFilter);
        header.textContent = t().satFilterActive(sat ? sat.name : selectedSatelliteFilter);
        clearBtn.textContent = t().clearFilter;
        clearBtn.classList.remove('hidden');
        return;
    }
    // No list filter, but a card (or the "next data" banner) may still
    // have focused the map on a satellite -- offer Clear as the way back
    // to the previous view, without touching the list itself.
    clearBtn.textContent = t().clearFilter;
    clearBtn.classList.toggle('hidden', !activeSatId);

    const cards = list.querySelectorAll('[data-pass-category]');
    const listTop = list.getBoundingClientRect().top;

    let topCategory = 'upcoming';
    for (const c of cards) {
        if (c.getBoundingClientRect().bottom > listTop + 2) { topCategory = c.dataset.passCategory; break; }
    }
    const labels = { past: t().listRecent, live: t().listLive, upcoming: t().listUpcoming };
    header.textContent = labels[topCategory] || t().listUpcoming;
}

function onPassListScroll() {
    if (listLabelScrollQueued) return;
    listLabelScrollQueued = true;
    requestAnimationFrame(() => { listLabelScrollQueued = false; updateListHeaderLabel(); });
}

function showSatelliteInfo(satId) {
    const sat = satId === 'himawari9' ? HIMAWARI : SATELLITES.find(s => s.id === satId);
    if (!sat) return;
    const s = t();

    document.getElementById('sat-info-name').textContent = sat.name;
    document.getElementById('sat-info-types').textContent = sat.types
        ? sat.types.map(ty => s.satTypes[ty] || ty).join(' + ')
        : s.geostationary;

    const rows = [];
    if (sat.launchDate) rows.push([s.infoLaunchDate, sat.launchDate]);
    if (sat.operator) rows.push([s.infoOperator, sat.operator]);
    if (sat.sensorSuite) rows.push([s.infoSensorSuite, sat.sensorSuite]);
    if (sat.resolution) rows.push([s.infoResolution, sat.resolution]);
    if (sat.swath) rows.push([s.infoSwath, `${sat.swath} km`]);
    if (sat.cycle) rows.push([s.infoCycle, sat.cycle]);
    if (sat.noradId) rows.push([s.infoNoradId, sat.noradId]);
    if (sat.missionEnded) rows.push([s.infoMissionStatus, s.missionEnded(sat.missionEnded)]);
    const latencyHours = DATA_LATENCY_HOURS[satId];
    rows.push([s.infoDataLatency, latencyHours != null ? `~${latencyHours}h` : s.infoLatencyUnknown]);

    document.getElementById('sat-info-fields').innerHTML = rows.map(([label, value]) => `
        <div class="flex justify-between gap-3">
            <dt class="text-slate-500 shrink-0">${label}</dt>
            <dd class="text-slate-200 text-right">${value}</dd>
        </div>`).join('');

    document.getElementById('sat-info-overlay').classList.remove('hidden');
}

function closeSatelliteInfo() {
    document.getElementById('sat-info-overlay').classList.add('hidden');
}

function toggleFutureFeatures() {
    document.getElementById('future-features-popup').classList.toggle('hidden');
}

function renderRoadmap() {
    document.getElementById('roadmap-list').innerHTML =
        t().roadmapItems.map(item => `<li>${item}</li>`).join('');
}

function updateLanguageUI() {
    const s = t();
    document.getElementById('app-title').innerText = s.title;
    document.getElementById('app-subtitle').innerText = s.subtitle;
    document.getElementById('realtime-lbl').innerText = s.realtime;
    document.getElementById('geo-lbl').innerText = s.geostationary;
    document.getElementById('live-lbl').innerText = s.live;
    document.getElementById('full-disk-lbl').innerText = s.fullDisk;
    document.getElementById('geo-cycle-lbl').innerText = s.cycle10m;
    document.getElementById('roadmap-lbl').innerText = s.roadmap;
    document.getElementById('roadmap-title').innerText = s.futureRoadmap;
    document.getElementById('tracking-lbl').innerText = s.tracking;
    document.getElementById('next-data-lbl').innerText = s.nextDataIn;
    document.getElementById('lang-btn-text').innerText = currentLang === 'EN' ? 'JP' : 'EN';
    renderFilterToggleButtons();
    renderRoadmap();
    renderDataBadge();
    updateListHeaderLabel();
}

function toggleLang() {
    currentLang = currentLang === 'EN' ? 'JP' : 'EN';
    updateLanguageUI();
    buildLegend();
    buildRegionSelector();
    buildTypeSelector();
    renderPassLists();
}

// The soonest pass (within current region/type/satellite filters) whose
// data hasn't landed yet -- distinct from the soonest *pass*, since a
// pass happening sooner but with a longer processing latency can arrive
// later than one that passed a bit later but processes faster.
function nextDataCandidate() {
    const now = Date.now();
    const all = [...latestPasses.recentPasses, ...latestPasses.upcomingPasses];
    const candidates = all.filter(p => {
        if (!p.dataAvailableAt || p.dataAvailableAt <= now) return false;
        if (selectedSatelliteFilter && p.id !== selectedSatelliteFilter) return false;
        if (selectedRegion && !p.regions.has(selectedRegion)) return false;
        if (selectedType && !p.types.includes(selectedType)) return false;
        return true;
    });
    candidates.sort((a, b) => a.dataAvailableAt - b.dataAvailableAt);
    return candidates[0] || null;
}

function formatCountdown(ms) {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

let currentNextDataCandidate = null;

function tickNextDataCountdown() {
    const strip = document.getElementById('next-data-strip');
    const countdownEl = document.getElementById('next-data-countdown');
    const candidate = nextDataCandidate();
    currentNextDataCandidate = candidate;

    if (!candidate) {
        strip.classList.add('hidden');
        return;
    }
    strip.classList.remove('hidden');
    const remaining = candidate.dataAvailableAt - Date.now();
    const regionStr = Array.from(candidate.regions).map(regionLabel).join(', ');
    countdownEl.textContent = `${formatCountdown(remaining)} · ${candidate.name} (${regionStr})`;
}

// Clicking the countdown strip does exactly what clicking its underlying
// pass card would do -- same card id formula as renderPassCard().
function focusNextDataCandidate() {
    if (!currentNextDataCandidate) return;
    const pass = currentNextDataCandidate;
    focusSatellite(pass.id, `card-${pass.id}-${pass.time.getTime()}`);
}

function tickClock() {
    document.getElementById('live-clock').innerText =
        new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' JST';
}
