// Bootstrap: fetch live TLEs, then wire up the map, lists, and timers.

async function boot() {
    updateLanguageUI();
    buildLegend();
    buildRegionSelector();
    buildTypeSelector();
    drawRegions(null);
    drawTerminator();
    tickClock();
    document.getElementById('pass-list').addEventListener('scroll', onPassListScroll);

    await loadAllTle(SATELLITES);
    renderDataBadge();

    refreshPasses(true); // scroll so "now" is at the top on first load
    updateMap();
    tickNextDataCountdown();

    // Not awaited -- cloud risk is a supplementary badge, not load-bearing
    // like the TLE fetch, so it shouldn't hold up first paint. Re-render the
    // list once it resolves so badges appear without needing an interaction.
    loadCloudForecast().then(() => renderPassLists(false));

    setInterval(tickClock, 1000);
    setInterval(updateLivePositions, 1000);
    setInterval(tickNextDataCountdown, 1000);
    setInterval(updateMap, 5000);
    setInterval(drawTerminator, 60000); // moves slowly; no need for a faster tick
    setInterval(() => refreshPasses(false), 60000);
    setInterval(() => loadCloudForecast().then(() => renderPassLists(false)), 60 * 60000);
}

boot();
