const EVManager = (() => {
    let currentData = [];
    let currentPostal = null;
    let refreshTimer = null;
    let lastFetch = null;

    // ── Status helpers ───────────────────────────────────
    function stationStatus(st) {
        // st.status: 1=available, 0=occupied, 100=not available
        return st.status;
    }

    function statusBadge(s) {
        if (s === 1) return `<span class="ev-status-badge available">✅ Available</span>`;
        if (s === 0) return `<span class="ev-status-badge occupied">🔴 Occupied</span>`;
        return `<span class="ev-status-badge unavailable">⚫ Unavailable</span>`;
    }

    function pointDotClass(s) {
        if (s === 1) return 'green';
        if (s === 0) return 'red';
        return 'grey';
    }

    // ── Fetch ────────────────────────────────────────────
    async function fetchData(postal) {
        const res = await fetch(`/api/ev?postal=${encodeURIComponent(postal)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return (json.value || []).filter(st => st.status !== 100); // hide unavailable stations
    }

    // ── Render ────────────────────────────────────────────
    function render(data) {
        const container = document.getElementById('evCards');
        const prompt = document.getElementById('evPrompt');

        if (!data.length) {
            container.innerHTML = '';
            prompt.textContent = 'No available EV charging stations found for this postal code.';
            prompt.classList.remove('hidden');
            return;
        }
        prompt.classList.add('hidden');

        container.innerHTML = data.map((st, idx) => {
            const s = stationStatus(st);
            const points = st.chargingPoints || [];
            const lat = parseFloat(st.latitude);
            const lng = parseFloat(st.longtitude);
            const hasCoords = !isNaN(lat) && !isNaN(lng);

            // Aggregate stats
            const totalPoints = points.reduce((sum, cp) => sum + (cp.evIds?.length || 1), 0);
            const plugTypes = [...new Set(points.flatMap(cp =>
                (cp.plugTypes || []).map(p => p.plugType).filter(Boolean)
            ))].join(', ') || 'N/A';
            const speeds = [...new Set(points.flatMap(cp =>
                (cp.plugTypes || []).map(p => p.chargingSpeed).filter(Boolean)
            ))].map(s => `${s} kW`).join(', ') || 'N/A';
            const prices = [...new Set(points.flatMap(cp =>
                (cp.plugTypes || []).map(p => p.price !== undefined ? `$${p.price} ${p.priceType || ''}`.trim() : null).filter(Boolean)
            ))].join(', ') || 'N/A';

            // Individual charger rows for expandable section
            const chargerRows = points.map(cp => {
                const pointStatuses = (cp.evIds || []).map(ev => {
                    const evStatus = ev.status;
                    return `<span class="ev-point-dot ${pointDotClass(evStatus)}" title="${evStatus === 1 ? 'Available' : evStatus === 0 ? 'Occupied' : 'Unavailable'}"></span>`;
                }).join('');

                const plugInfo = (cp.plugTypes || []).map(p =>
                    `${p.plugType || '?'} · ${p.chargingSpeed ? p.chargingSpeed + ' kW' : '?'} · ${p.price !== undefined ? '$' + p.price + ' ' + (p.priceType || '') : '?'}`
                ).join('<br>');

                const hours = cp.operationHours || 'Hours not available';

                return `
          <div class="ev-charger-item">
            <div class="ev-charger-left">
              <div class="ev-charger-name">${cp.name || cp.id || 'Charger'} <span style="font-size:0.7rem;color:#888">${cp.position || ''}</span></div>
              <div class="ev-charger-meta">${plugInfo}<br>${hours}</div>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:60px">${pointStatuses}</div>
          </div>
        `;
            }).join('');

            return `
        <article class="ev-card" data-idx="${idx}">
          <div class="ev-card-header">
            <div class="ev-card-name">${st.name}</div>
            ${statusBadge(s)}
          </div>
          <div class="ev-card-body">
            <div class="ev-addr">📍 ${st.address}</div>
            <div class="ev-stats">
              <div class="ev-stat">🔌 <strong>${totalPoints}</strong> point${totalPoints !== 1 ? 's' : ''}</div>
              <div class="ev-stat">⚡ <strong>${speeds}</strong></div>
              <div class="ev-stat">🔧 <strong>${plugTypes}</strong></div>
              <div class="ev-stat">💰 <strong>${prices}</strong></div>
            </div>
          </div>
          ${points.length ? `
            <button class="ev-chargers-toggle" data-idx="${idx}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
              See ${points.length} charger${points.length !== 1 ? 's' : ''}
            </button>
            <div class="ev-charger-list" id="evChargerList-${idx}">
              ${chargerRows}
            </div>
          ` : ''}
          <div class="ev-card-actions">
            ${hasCoords ? `
              <button class="card-btn navigate-btn" data-lat="${lat}" data-lng="${lng}" data-name="${st.name.replace(/"/g, '&quot;')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                Navigate
              </button>
              <button class="card-btn map-btn" data-lat="${lat}" data-lng="${lng}" data-name="${st.name.replace(/"/g, '&quot;')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                Map
              </button>
            ` : ''}
          </div>
        </article>
      `;
        }).join('');

        // Events
        container.querySelectorAll('.ev-chargers-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const list = document.getElementById(`evChargerList-${btn.dataset.idx}`);
                if (!list) return;
                const open = list.classList.toggle('open');
                btn.querySelector('svg').style.transform = open ? 'rotate(180deg)' : '';
            });
        });

        container.querySelectorAll('.navigate-btn').forEach(btn => {
            btn.addEventListener('click', () => NavManager.open(btn.dataset.name, parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng)));
        });
        container.querySelectorAll('.map-btn').forEach(btn => {
            btn.addEventListener('click', () => MapManager.focusPoint(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lng), `⚡ ${btn.dataset.name}`));
        });
    }

    // ── Load ─────────────────────────────────────────────
    async function load(postal, silent = false) {
        currentPostal = postal;
        const loadEl = document.getElementById('evLoading');
        const errEl = document.getElementById('evError');
        const prompt = document.getElementById('evPrompt');

        if (!silent) {
            loadEl.classList.remove('hidden');
            errEl.classList.add('hidden');
            prompt.classList.add('hidden');
            document.getElementById('evCards').innerHTML = '';
        }

        try {
            currentData = await fetchData(postal);
            lastFetch = Date.now();
            loadEl.classList.add('hidden');
            errEl.classList.add('hidden');
            render(currentData);
        } catch (err) {
            loadEl.classList.add('hidden');
            if (!silent) {
                errEl.textContent = `Failed to load EV data: ${err.message}`;
                errEl.classList.remove('hidden');
            }
        }
    }

    function showMapAll() {
        MapManager.showEV(currentData);
    }

    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            if (currentPostal) load(currentPostal, true);
        }, 300_000); // 5 min
    }

    function getLastFetch() {
        return lastFetch;
    }

    // ── Reverse geocode postal code from lat/lng ──────────
    async function resolvePostalFromCoords(lat, lng) {
        // Use Nominatim reverse geocode
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        const json = await res.json();
        const postal = json?.address?.postcode;
        if (!postal) throw new Error('Could not determine postal code from your location.');
        return postal.replace(/\D/g, '').slice(0, 6);
    }

    // ── Init ─────────────────────────────────────────────
    function init() {
        document.getElementById('evSearch')?.addEventListener('click', () => {
            const postal = document.getElementById('evPostal').value.trim();
            if (!/^\d{6}$/.test(postal)) {
                const err = document.getElementById('evError');
                err.textContent = 'Please enter a valid 6-digit Singapore postal code.';
                err.classList.remove('hidden');
                return;
            }
            load(postal);
            startAutoRefresh();
        });

        document.getElementById('evPostal')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('evSearch').click();
        });

        document.getElementById('evLocate')?.addEventListener('click', async () => {
            const btn = document.getElementById('evLocate');
            btn.disabled = true;
            btn.textContent = 'Locating…';
            try {
                const pos = await new Promise((res, rej) =>
                    navigator.geolocation.getCurrentPosition(res, rej, {
                        enableHighAccuracy: true,
                        timeout: 10000
                    })
                );
                const postal = await resolvePostalFromCoords(pos.coords.latitude, pos.coords.longitude);
                document.getElementById('evPostal').value = postal;
                load(postal);
                startAutoRefresh();
            } catch (err) {
                const errEl = document.getElementById('evError');
                errEl.textContent = `Location error: ${err.message}`;
                errEl.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> My Location`;
            }
        });

        document.getElementById('evMapBtn')?.addEventListener('click', () => {
            if (currentData.length) showMapAll();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        load,
        startAutoRefresh,
        getLastFetch
    };
})();