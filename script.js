(function () {
    'use strict';

    // ── STATE ──
    let allCarparks = [];
    let userLat = null,
        userLng = null;
    let lastFetch = null;
    let refreshTimer = null;
    let countdownTimer = null;
    let activeArea = 'all';
    let searchCenter = null; // { lat, lng } from geocode
    let mapOpen = false;
    let availFilter = null; // null | 'available' | 'limited' | 'full'
    let currentPage = 1;
    const PAGE_SIZE = 50;

    // Defer render to the next task so the browser can paint the interaction first (fixes INP)
    let renderPending = false;
    function scheduleRender() {
        if (renderPending) return;
        renderPending = true;
        setTimeout(() => { renderPending = false; renderAll(); }, 0);
    }

    // ── DOM ──
    const $id = (id) => document.getElementById(id);

    const permGate = $id('permission-gate');
    const loadState = $id('loading-state');
    const errorState = $id('error-state');
    const errorMsg = $id('error-msg');
    const cardsGrid = $id('cards-grid');
    const emptyState = $id('empty-state');
    const statsBar = $id('stats-bar');
    const lastUpdatedText = $id('last-updated-text');
    const refreshIndicator = $id('refresh-indicator');

    const searchInput = $id('search-input');
    const btnClear = $id('btn-clear-search');
    const btnLocate = $id('btn-locate');
    const btnRefresh = $id('btn-refresh');
    const btnMapToggle = $id('btn-map-toggle');
    const btnCloseMap = $id('btn-close-map');
    const mapModal = $id('map-modal');
    const filterLotType = $id('filter-lottype');
    const filterAgency = $id('filter-agency');
    const filterSort = $id('filter-sort');
    const detailOverlay = $id('detail-overlay');
    const detailContent = $id('detail-content');

    // ── UTILS ──
    function haversineKm(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.asin(Math.sqrt(a));
    }

    function lotTypeLabel(t) {
        const car = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M19 17H5a2 2 0 0 1-2-2V9l2-4h14l2 4v6a2 2 0 0 1-2 2z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
        const moto = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
        const truck = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 6v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
        return t === 'Y' ? `${moto} Motorcycles` : t === 'H' ? `${truck} Heavy Vehicles` : `${car} Cars`;
    }

    function availClass(n) {
        if (n > 50) return 'green';
        if (n >= 10) return 'amber';
        return 'red';
    }

    function fmtDistance(km) {
        return km < 1 ? `${Math.round(km * 1000)}m away` : `${km.toFixed(1)}km away`;
    }

    function parseCoordsFromLocation(loc) {
        if (!loc) return null;
        const parts = loc.trim().split(/\s+/);
        if (parts.length >= 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return {
                lat,
                lng
            };
        }
        return null;
    }

    function timeAgo(ts) {
        const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
        if (secs < 5) return 'just now';
        if (secs < 60) return `${secs}s ago`;
        return `${Math.floor(secs/60)}m ago`;
    }

    // ── LOCATION ──
    function requestLocation(showGate = true) {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by your browser.');
            return;
        }
        if (showGate) {
            permGate.removeAttribute('hidden');
            loadState.setAttribute('hidden', '');
        }
    }

    function doGetLocation() {
        permGate.setAttribute('hidden', '');
        loadState.removeAttribute('hidden');
        errorState.setAttribute('hidden', '');
        cardsGrid.innerHTML = '';
        emptyState.setAttribute('hidden', '');

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                searchCenter = null;
                fetchCarparks();
            },
            (err) => {
                loadState.setAttribute('hidden', '');
                showError('Could not get your location. ' + (err.message || 'Please allow location access and try again.'));
            }, {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 30000
            }
        );
    }

    // ── DATA FETCH ──
    async function fetchCarparks() {
        refreshIndicator.classList.add('loading');
        btnRefresh.querySelector('svg').classList.add('spin-active');
        lastUpdatedText.textContent = 'Fetching live data…';

        try {
            const res = await fetch('/api/carparks');
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();

            allCarparks = (data.value || []).filter(cp => {
                const coords = parseCoordsFromLocation(cp.Location);
                return coords !== null;
            });

            lastFetch = data.timestamp || new Date().toISOString();
            loadState.setAttribute('hidden', '');
            errorState.setAttribute('hidden', '');

            renderAll();
            scheduleRefresh();
        } catch (err) {
            loadState.setAttribute('hidden', '');
            showError('Failed to load carpark data: ' + err.message);
        } finally {
            refreshIndicator.classList.remove('loading');
            btnRefresh.querySelector('svg').classList.remove('spin-active');
            updateTimestamp();
        }
    }

    function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        if (countdownTimer) clearInterval(countdownTimer);

        refreshTimer = setTimeout(() => fetchCarparks(), 60000);

        countdownTimer = setInterval(() => updateTimestamp(), 5000);
    }

    function updateTimestamp() {
        if (!lastFetch) return;
        lastUpdatedText.textContent = `Updated ${timeAgo(lastFetch)} · Auto-refresh every 1 min`;
    }

    // ── VISIBILITY REFRESH ──
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && lastFetch) {
            const age = Date.now() - new Date(lastFetch).getTime();
            if (age > 55000) fetchCarparks();
        }
    });

    // ── RENDER ──
    function getFilteredSorted() {
        const lotTypeVal = filterLotType.value;
        const agencyVal = filterAgency.value;
        const sortVal = filterSort.value;
        const centerLat = searchCenter?.lat ?? userLat;
        const centerLng = searchCenter?.lng ?? userLng;

        let list = allCarparks.filter(cp => {
            if (activeArea !== 'all') {
                if (cp.Area !== activeArea) return false;
            }
            if (lotTypeVal !== 'all' && cp.LotType !== lotTypeVal) return false;
            if (agencyVal !== 'all' && cp.Agency !== agencyVal) return false;
            return true;
        });

        // Attach distance
        list = list.map(cp => {
            const coords = parseCoordsFromLocation(cp.Location);
            const dist = (centerLat && centerLng && coords) ?
                haversineKm(centerLat, centerLng, coords.lat, coords.lng) :
                Infinity;
            return {
                ...cp,
                _dist: dist,
                _coords: coords
            };
        });

        if (sortVal === 'nearest') {
            list.sort((a, b) => a._dist - b._dist);
        } else {
            list.sort((a, b) => (parseInt(b.AvailableLots) || 0) - (parseInt(a.AvailableLots) || 0));
        }

        return list;
    }

    function renderAll() {
        const baseList = getFilteredSorted();

        // Stats always reflect the full pre-availFilter list
        let totalAvail = 0, totalLimited = 0, totalFull = 0;
        baseList.forEach(cp => {
            const n = parseInt(cp.AvailableLots) || 0;
            if (n > 50) totalAvail++;
            else if (n >= 10) totalLimited++;
            else totalFull++;
        });
        $id('stat-total').textContent = `${baseList.length} carparks`;
        $id('stat-available').textContent = `${totalAvail} available`;
        $id('stat-limited').textContent = `${totalLimited} limited`;
        $id('stat-full').textContent = `${totalFull} full`;

        // Active state on filter pills
        $id('stat-available').classList.toggle('active', availFilter === 'available');
        $id('stat-limited').classList.toggle('active', availFilter === 'limited');
        $id('stat-full').classList.toggle('active', availFilter === 'full');

        // Apply availFilter
        let list = baseList;
        if (availFilter === 'available') list = baseList.filter(cp => (parseInt(cp.AvailableLots) || 0) > 50);
        else if (availFilter === 'limited') list = baseList.filter(cp => { const n = parseInt(cp.AvailableLots) || 0; return n >= 10 && n <= 50; });
        else if (availFilter === 'full') list = baseList.filter(cp => (parseInt(cp.AvailableLots) || 0) < 10);

        cardsGrid.innerHTML = '';

        if (list.length === 0) {
            emptyState.removeAttribute('hidden');
            renderPagination(0, 0);
            return;
        }
        emptyState.setAttribute('hidden', '');

        // Pagination
        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const pageList = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

        // Build cards
        const frag = document.createDocumentFragment();
        pageList.forEach(cp => {
            const card = buildCard(cp);
            frag.appendChild(card);
        });
        cardsGrid.appendChild(frag);

        renderPagination(currentPage, totalPages);

        // Update map if open
        if (mapOpen) {
            MapManager.setCarparks(list, userLat, userLng);
        }
    }

    function renderPagination(page, totalPages) {
        const bar = $id('pagination-bar');
        if (totalPages <= 1) {
            bar.setAttribute('hidden', '');
            return;
        }
        bar.removeAttribute('hidden');
        bar.innerHTML = '';

        const prev = document.createElement('button');
        prev.className = 'page-btn';
        prev.textContent = '←';
        prev.disabled = page <= 1;
        prev.addEventListener('click', () => { currentPage--; scheduleRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        bar.appendChild(prev);

        // Page number buttons (show up to 5 around current)
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, start + 4);
        for (let i = start; i <= end; i++) {
            const btn = document.createElement('button');
            btn.className = 'page-btn' + (i === page ? ' active' : '');
            btn.textContent = i;
            const p = i;
            btn.addEventListener('click', () => { currentPage = p; scheduleRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
            bar.appendChild(btn);
        }

        const next = document.createElement('button');
        next.className = 'page-btn';
        next.textContent = '→';
        next.disabled = page >= totalPages;
        next.addEventListener('click', () => { currentPage++; scheduleRender(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        bar.appendChild(next);
    }

    function buildCard(cp) {
        const lots = parseInt(cp.AvailableLots) || 0;
        const cls = availClass(lots);
        const isFull = lots === 0;
        const card = document.createElement('div');
        card.className = `cp-card${isFull ? ' full' : ''}`;

        const distText = cp._dist < Infinity ? fmtDistance(cp._dist) : '';
        const area = cp.Area ? `<span>${cp.Area}</span><span class="meta-dot"></span>` : '';
        const updatedAgo = lastFetch ? timeAgo(lastFetch) : '';

        // Availability bar — estimate capacity (not provided by API, use 999 as fallback)
        // We only show the lot count coloured since we don't have total capacity
        card.innerHTML = `
      <div class="card-header">
        <div class="card-title">${cp.Development || cp.CarParkID}</div>
        <span class="agency-badge">${cp.Agency}</span>
      </div>
      <div class="card-meta">
        ${area}
        <span>ID: ${cp.CarParkID}</span>
      </div>
      <div class="avail-section">
        <div class="avail-row">
          <span class="lot-type-badge">${lotTypeLabel(cp.LotType)}</span>
          <span class="avail-count ${cls}">${lots === 0 ? 'Full' : lots + ' lots'}</span>
        </div>
        <div class="avail-bar-wrap">
          <div class="avail-bar ${cls}" style="width:${Math.min(100, lots / 5)}%"></div>
        </div>
      </div>
      <div class="card-footer">
        <span>${distText ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${distText}` : ''}</span>
        <span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${updatedAgo}</span>
      </div>
    `;

        card.addEventListener('click', () => openDetail(cp));
        return card;
    }

    // ── DETAIL SHEET ──
    function openDetail(cp) {
        const lots = parseInt(cp.AvailableLots) || 0;
        const cls = availClass(lots);
        const coords = parseCoordsFromLocation(cp.Location);
        const dist = (userLat && userLng && coords) ?
            fmtDistance(haversineKm(userLat, userLng, coords.lat, coords.lng)) :
            '';

        detailContent.innerHTML = `
      <div class="detail-name">${cp.Development || cp.CarParkID}</div>
      <div class="detail-badges">
        <span class="detail-badge">${cp.Agency}</span>
        ${cp.Area ? `<span class="detail-badge">${cp.Area}</span>` : ''}
        <span class="detail-badge">${lotTypeLabel(cp.LotType)}</span>
        ${dist ? `<span class="detail-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${dist}</span>` : ''}
      </div>
      <div class="detail-avail-grid">
        <div class="detail-avail-card">
          <div class="detail-avail-label">Available Lots</div>
          <div class="detail-avail-num ${cls}">${lots}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${lots === 0 ? 'Carpark is full' : lots > 50 ? 'Plenty of space' : lots >= 10 ? 'Getting limited' : 'Almost full'}</div>
        </div>
        <div class="detail-avail-card">
          <div class="detail-avail-label">Carpark ID</div>
          <div style="font-family:var(--font-main);font-size:1.4rem">${cp.CarParkID}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Updated ${lastFetch ? timeAgo(lastFetch) : 'recently'}</div>
        </div>
      </div>
      ${coords ? `
      <div class="detail-nav-row">
        <button class="nav-btn primary" onclick="openGoogleMaps(${coords.lat}, ${coords.lng}, '${(cp.Development || cp.CarParkID).replace(/'/g, "\\'")}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Navigate
        </button>
        <button class="nav-btn secondary" onclick="openMapView(${coords.lat}, ${coords.lng})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          View on Map
        </button>
      </div>
      ` : ''}
    `;

        detailOverlay.removeAttribute('hidden');
    }

    window.openGoogleMaps = function (lat, lng, name) {
        const query = encodeURIComponent(name + ' Singapore');
        // Prefer maps app deep link, fallback to browser maps
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${query}&travelmode=driving`;
        window.open(url, '_blank');
    };

    window.openMapView = function (lat, lng) {
        detailOverlay.setAttribute('hidden', '');
        openMapModal();
        setTimeout(() => MapManager.panToCarpark(lat, lng), 300);
    };

    // Close sheet on overlay click
    detailOverlay.addEventListener('click', (e) => {
        if (e.target === detailOverlay) detailOverlay.setAttribute('hidden', '');
    });

    // ── MAP MODAL ──
    function openMapModal() {
        mapOpen = true;
        mapModal.removeAttribute('hidden');
        MapManager.init();
        MapManager.invalidateSize();
        MapManager.setOnSelect((cp) => {
            mapModal.setAttribute('hidden', '');
            mapOpen = false;
            openDetail(cp);
        });
        const list = getFilteredSorted();
        MapManager.setCarparks(list, userLat, userLng);
        if (userLat && userLng) {
            setTimeout(() => MapManager.panToUser(userLat, userLng), 200);
        }
    }

    btnMapToggle.addEventListener('click', openMapModal);

    btnCloseMap.addEventListener('click', () => {
        mapModal.setAttribute('hidden', '');
        mapOpen = false;
    });

    mapModal.addEventListener('click', (e) => {
        if (e.target === mapModal) {
            mapModal.setAttribute('hidden', '');
            mapOpen = false;
        }
    });

    // ── FILTERS ──
    [filterLotType, filterAgency, filterSort].forEach(el => {
        el.addEventListener('change', () => { currentPage = 1; scheduleRender(); });
    });

    // ── AVAILABILITY FILTER PILLS ──
    ['stat-available', 'stat-limited', 'stat-full'].forEach(id => {
        const key = id.replace('stat-', '');
        $id(id).addEventListener('click', () => {
            availFilter = availFilter === key ? null : key;
            currentPage = 1;
            scheduleRender();
        });
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeArea = chip.dataset.area;
            currentPage = 1;
            scheduleRender();
        });
    });

    // ── SEARCH ──
    let searchDebounce = null;
    let suggestionsEl = null;

    searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim();
        btnClear.classList.toggle('visible', val.length > 0);

        clearTimeout(searchDebounce);
        if (val.length < 2) {
            hideSuggestions();
            if (val.length === 0) {
                searchCenter = null;
                scheduleRender();
            }
            return;
        }

        searchDebounce = setTimeout(() => geocodeSearch(val), 400);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSuggestions();
            searchInput.blur();
        }
    });

    btnClear.addEventListener('click', () => {
        searchInput.value = '';
        btnClear.classList.remove('visible');
        hideSuggestions();
        searchCenter = null;
        scheduleRender();
    });

    async function geocodeSearch(query) {
        try {
            const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
            if (!res.ok) return;
            const results = await res.json();
            showSuggestions(results);
        } catch {}
    }

    function showSuggestions(results) {
        hideSuggestions();
        if (!results || results.length === 0) return;

        suggestionsEl = document.createElement('div');
        suggestionsEl.className = 'search-suggestions';

        results.slice(0, 5).forEach(r => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = r.display_name?.split(',').slice(0, 3).join(', ') || r.display_name;
            item.addEventListener('click', () => {
                searchInput.value = item.textContent;
                btnClear.classList.add('visible');
                searchCenter = {
                    lat: parseFloat(r.lat),
                    lng: parseFloat(r.lon)
                };
                hideSuggestions();
                filterSort.value = 'nearest';
                scheduleRender();
            });
            suggestionsEl.appendChild(item);
        });

        const wrap = searchInput.closest('.search-input-wrap');
        wrap.style.position = 'relative';
        wrap.appendChild(suggestionsEl);
    }

    function hideSuggestions() {
        if (suggestionsEl) {
            suggestionsEl.remove();
            suggestionsEl = null;
        }
    }

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target)) hideSuggestions();
    });

    // ── LOCATE BUTTON ──
    btnLocate.addEventListener('click', () => {
        if (!navigator.geolocation) return showError('Geolocation not supported.');
        btnLocate.disabled = true;
        btnLocate.textContent = '…';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                searchCenter = null;
                searchInput.value = '';
                btnClear.classList.remove('visible');
                filterSort.value = 'nearest';
                btnLocate.disabled = false;
                btnLocate.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/></svg> Near Me`;
                scheduleRender();
            },
            (err) => {
                btnLocate.disabled = false;
                btnLocate.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><circle cx="12" cy="12" r="10" stroke-opacity="0.3"/></svg> Near Me`;
                showError('Could not get location: ' + err.message);
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 15000
            }
        );
    });

    // ── REFRESH ──
    btnRefresh.addEventListener('click', () => {
        if (userLat || searchCenter) fetchCarparks();
        else doGetLocation();
    });

    // ── ERROR ──
    function showError(msg) {
        errorMsg.textContent = msg;
        errorState.removeAttribute('hidden');
        loadState.setAttribute('hidden', '');
    }

    $id('btn-retry').addEventListener('click', () => {
        errorState.setAttribute('hidden', '');
        doGetLocation();
    });

    // ── GRANT LOCATION BUTTON ──
    $id('btn-grant-location').addEventListener('click', doGetLocation);

    // ── INIT ──
    function init() {
        // Check if we already have permission
        if (navigator.permissions) {
            navigator.permissions.query({
                name: 'geolocation'
            }).then(result => {
                if (result.state === 'granted') {
                    doGetLocation();
                } else {
                    permGate.removeAttribute('hidden');
                    loadState.setAttribute('hidden', '');
                }
            }).catch(() => {
                permGate.removeAttribute('hidden');
            });
        } else {
            permGate.removeAttribute('hidden');
        }
    }

    // Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
    }

    init();
})();