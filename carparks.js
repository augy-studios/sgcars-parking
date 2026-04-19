const CarparkManager = (() => {
    let allData = [];
    let userLat = null;
    let userLng = null;
    let filterLot = 'all';
    let filterAgency = 'all';
    let searchQuery = '';
    let refreshTimer = null;
    let lastFetch = null;

    // ── Helpers ──────────────────────────────────────────
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180,
            φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatDist(m) {
        return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
    }

    function availColor(n) {
        if (n > 20) return '#22c55e';
        if (n > 5) return '#f59e0b';
        return '#ef4444';
    }

    function availClass(n) {
        if (n > 20) return 'green';
        if (n > 5) return 'amber';
        return 'red';
    }

    // ── Fetch ─────────────────────────────────────────────
    async function fetchData() {
        try {
            const res = await fetch('/api/carparks');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return json.value || [];
        } catch (err) {
            throw err;
        }
    }

    // ── Filter & Sort ─────────────────────────────────────
    function getFiltered() {
        let data = allData;

        if (filterLot !== 'all') data = data.filter(d => d.LotType === filterLot);
        if (filterAgency !== 'all') data = data.filter(d => d.Agency === filterAgency);

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(d =>
                (d.Development || '').toLowerCase().includes(q) ||
                (d.Area || '').toLowerCase().includes(q) ||
                (d.CarParkID || '').toLowerCase().includes(q)
            );
        }

        if (userLat && userLng) {
            data = data.map(d => {
                if (!d.Location) return {
                    ...d,
                    _dist: Infinity
                };
                const [lat, lng] = d.Location.split(' ').map(Number);
                return {
                    ...d,
                    _lat: lat,
                    _lng: lng,
                    _dist: haversine(userLat, userLng, lat, lng)
                };
            }).sort((a, b) => a._dist - b._dist);
        }

        return data;
    }

    // ── Render ────────────────────────────────────────────
    function render(data) {
        const container = document.getElementById('cpCards');
        const empty = document.getElementById('cpEmpty');
        const countEl = document.getElementById('cpCount');

        if (!data.length) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
            countEl.textContent = '';
            return;
        }

        empty.classList.add('hidden');
        countEl.textContent = `${data.length} carpark${data.length !== 1 ? 's' : ''}`;

        container.innerHTML = data.map(cp => {
            const avail = parseInt(cp.AvailableLots) || 0;
            const color = availColor(avail);
            const cls = availClass(avail);
            const dist = cp._dist !== undefined && cp._dist !== Infinity ?
                `<span class="cp-distance"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${formatDist(cp._dist)} away</span> · ` : '';
            const area = cp.Area ? `${cp.Area} · ` : '';
            const carSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M19 17H5a2 2 0 0 1-2-2V9l2-4h14l2 4v6a2 2 0 0 1-2 2z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
            const motoSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
            const truckSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 6v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
            const lot = cp.LotType === 'C' ? `${carSvg} Cars` : cp.LotType === 'Y' ? `${motoSvg} Motorcycles` : cp.LotType === 'H' ? `${truckSvg} Heavy` : cp.LotType;

            return `
        <article class="cp-card" style="--avail-color:${color}" data-id="${cp.CarParkID}"
          data-lat="${cp._lat || ''}" data-lng="${cp._lng || ''}" data-name="${(cp.Development || cp.CarParkID).replace(/"/g, '&quot;')}">
          <div class="cp-card-top">
            <div class="cp-card-name">${cp.Development || cp.CarParkID}</div>
            <span class="cp-agency-badge">${cp.Agency}</span>
          </div>
          <div class="cp-avail-row">
            <div class="avail-dot ${cls}"></div>
            <span class="avail-num">${avail}</span>
            <span class="avail-label">lots available</span>
          </div>
          <div class="cp-meta">${dist}${area}${lot}</div>
          <div class="cp-actions">
            ${cp._lat ? `
              <button class="card-btn navigate-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                Navigate
              </button>
              <button class="card-btn map-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                Map
              </button>
            ` : ''}
          </div>
        </article>
      `;
        }).join('');

        // Attach card events
        container.querySelectorAll('.cp-card').forEach(card => {
            const lat = parseFloat(card.dataset.lat);
            const lng = parseFloat(card.dataset.lng);
            const name = card.dataset.name;

            card.querySelector('.navigate-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                if (!isNaN(lat)) NavManager.open(name, lat, lng);
            });
            card.querySelector('.map-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                if (!isNaN(lat)) MapManager.focusPoint(lat, lng, `P ${name}`);
            });
        });
    }

    // ── Load & Refresh ────────────────────────────────────
    async function load(silent = false) {
        if (!silent) {
            document.getElementById('cpLoading').classList.remove('hidden');
            document.getElementById('cpCards').innerHTML = '';
            document.getElementById('cpEmpty').classList.add('hidden');
            document.getElementById('cpError').classList.add('hidden');
        }

        try {
            allData = await fetchData();
            lastFetch = Date.now();
            document.getElementById('cpLoading').classList.add('hidden');
            document.getElementById('cpError').classList.add('hidden');
            render(getFiltered());
        } catch (err) {
            document.getElementById('cpLoading').classList.add('hidden');
            if (!silent) {
                const errEl = document.getElementById('cpError');
                errEl.textContent = `Failed to load carpark data: ${err.message}`;
                errEl.classList.remove('hidden');
            }
        }
    }

    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => load(true), 60_000); // 1 min
    }

    function setUserLocation(lat, lng) {
        userLat = lat;
        userLng = lng;
        if (allData.length) render(getFiltered());
    }

    function showMapAll() {
        MapManager.showCarparks(getFiltered(), userLat, userLng);
    }

    function getLastFetch() {
        return lastFetch;
    }

    // ── Init ─────────────────────────────────────────────
    function init() {
        // Filters
        document.querySelectorAll('.chip[data-filter="lot"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chip[data-filter="lot"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterLot = btn.dataset.value;
                render(getFiltered());
            });
        });
        document.querySelectorAll('.chip[data-filter="agency"]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.chip[data-filter="agency"]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                filterAgency = btn.dataset.value;
                render(getFiltered());
            });
        });

        // Search
        let searchDebounce;
        document.getElementById('cpSearch')?.addEventListener('input', e => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                searchQuery = e.target.value.trim();
                render(getFiltered());
            }, 250);
        });

        // Map button
        document.getElementById('cpMapBtn')?.addEventListener('click', showMapAll);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        load,
        startAutoRefresh,
        setUserLocation,
        getLastFetch
    };
})();