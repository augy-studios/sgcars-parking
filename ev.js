// ===== EV CHARGING MODULE =====
const EVManager = (() => {
    let allStations = [];
    let showAvailable = true;
    let showOccupied = true;
    let refreshTimer = null;
    let lastPostalCode = null;
    let lastUpdated = null;

    const STATUS_LABELS = {
        0: 'Occupied',
        1: 'Available',
        100: 'Not Available'
    };
    const STATUS_COLORS = {
        0: 'badge-red',
        1: 'badge-green',
        100: 'badge-grey'
    };
    const STATUS_DOT = {
        0: 'occupied',
        1: 'available',
        100: 'na'
    };
    const STATUS_EMOJI = {
        0: '🔴',
        1: '✅',
        100: '⚫'
    };

    function stationStatus(station) {
        const cp = station.chargingPoints || [];
        if (!cp.length) return 100;
        if (cp.some(p => p.status === 1)) return 1;
        if (cp.every(p => p.status === 0)) return 0;
        return 100;
    }

    async function reverseGeocode(lat, lng) {
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, {
                headers: {
                    'Accept-Language': 'en'
                }
            });
            const data = await resp.json();
            const postcode = data?.address?.postcode;
            return postcode ? postcode.replace(/\D/g, '') : null;
        } catch {
            return null;
        }
    }

    async function searchByPostal(code) {
        if (!code || code.length < 6) {
            setListHTML(`<div class="empty-state"><div class="empty-icon">⚡</div><p>Please enter a 6-digit Singapore postal code.</p></div>`);
            return;
        }
        lastPostalCode = code;
        setListHTML(`<div class="loading-state"><div class="spinner"></div><p>Searching EV chargers near ${code}…</p></div>`);
        document.getElementById('ev-count').textContent = 'Searching…';
        try {
            const resp = await fetch(`/api/ev?postalCode=${encodeURIComponent(code)}`);
            if (!resp.ok) throw new Error('API error');
            const json = await resp.json();
            allStations = json.value || [];
            lastUpdated = new Date();
            updateLastUpdatedBadge();
            renderEV();
            renderMapEV();
        } catch (e) {
            console.error('EV fetch failed', e);
            setListHTML(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to fetch EV data. Please try again.</p></div>`);
            document.getElementById('ev-count').textContent = 'Error';
        }
    }

    function renderEV() {
        const el = document.getElementById('ev-list');
        const count = document.getElementById('ev-count');
        if (!el) return;

        let stations = allStations.filter(s => {
            const st = stationStatus(s);
            if (st === 100) return false; // always hide unavailable
            if (st === 1 && !showAvailable) return false;
            if (st === 0 && !showOccupied) return false;
            return true;
        });

        if (!stations.length) {
            count.textContent = '0 results';
            setListHTML(`<div class="empty-state"><div class="empty-icon">⚡</div><p>No available EV chargers found at this location.</p></div>`);
            return;
        }

        // Sort: available first
        stations.sort((a, b) => stationStatus(b) - stationStatus(a));

        count.textContent = `${stations.length} station${stations.length !== 1 ? 's' : ''} found`;
        el.innerHTML = stations.map(s => stationCardHTML(s)).join('');
        el.querySelectorAll('.card').forEach((card, i) => {
            card.addEventListener('click', () => openSheet(stations[i]));
        });
    }

    function stationCardHTML(s) {
        const st = stationStatus(s);
        const cp = s.chargingPoints || [];
        const avail = cp.filter(p => p.status === 1).length;
        const total = cp.length;
        const dotClass = STATUS_DOT[st];
        const badgeCls = STATUS_COLORS[st];

        const plugSummary = [...new Set(
            (cp.flatMap(p => (p.plugTypes || []).map(pt => pt.plugType)))
        )].filter(Boolean).join(', ');

        const maxSpeed = Math.max(...cp.flatMap(p => (p.plugTypes || []).map(pt => pt.chargingSpeed || 0)));
        const operators = [...new Set(cp.map(p => p.operator).filter(Boolean))].join(', ');

        return `
      <div class="card glass avail-${st === 1 ? 'green' : st === 0 ? 'red' : 'grey'}" data-station-id="${s.locationId}">
        <div class="card-header">
          <span class="card-title">${s.name || s.address || 'EV Station'}</span>
          <span class="card-badge ${badgeCls}">${STATUS_EMOJI[st]} ${STATUS_LABELS[st]}</span>
        </div>
        <div class="card-sub">${s.address || ''}</div>
        <div class="card-meta">
          <div class="ev-charger-row">
            <span class="ev-dot ${dotClass}"></span>
            <span>${avail}/${total} pts available</span>
            ${maxSpeed > 0 ? `<span class="meta-tag">⚡ ${maxSpeed}kW</span>` : ''}
            ${plugSummary ? `<span class="meta-tag">${plugSummary}</span>` : ''}
            ${operators ? `<span class="meta-tag">${operators}</span>` : ''}
          </div>
        </div>
      </div>`;
    }

    function renderMapEV() {
        MapManager.clearEV();
        for (const s of allStations) {
            if (!s.latitude || !s.longtitude) continue;
            const st = stationStatus(s);
            if (st === 100) continue;
            const avail = (s.chargingPoints || []).filter(p => p.status === 1).length;
            const total = (s.chargingPoints || []).length;
            const popup = `
        <div class="popup-title">⚡ ${s.name || s.address || 'EV Station'}</div>
        <div class="popup-detail">${avail}/${total} charging points available</div>
        <button class="popup-btn" onclick="EVManager.openSheetByLocation('${s.locationId}')">View Details</button>`;
            MapManager.addEVMarker(s, popup);
        }

        // Fly to first station
        const first = allStations.find(s => s.latitude && s.longtitude);
        if (first && MapManager.map) {
            MapManager.map.flyTo([parseFloat(first.latitude), parseFloat(first.longtitude)], 15, {
                duration: 0.8
            });
        }
    }

    function openSheetByLocation(locationId) {
        const s = allStations.find(st => st.locationId === locationId);
        if (s) openSheet(s);
    }

    function openSheet(s) {
        const st = stationStatus(s);
        const cp = s.chargingPoints || [];
        const lat = parseFloat(s.latitude);
        const lng = parseFloat(s.longtitude);

        const chargerItems = cp.map((c, i) => {
            const cSt = c.status;
            const label = cSt === 1 ? 'Available' : cSt === 0 ? 'Occupied' : 'N/A';
            const bc = cSt === 1 ? 'badge-green' : cSt === 0 ? 'badge-red' : 'badge-grey';
            const pts = (c.plugTypes || []).map(pt =>
                `<div class="charger-item-detail">${[pt.plugType, pt.powerRating, pt.chargingSpeed ? pt.chargingSpeed + 'kW' : '', pt.price ? '$' + pt.price + (pt.priceType === 'kWh' ? '/kWh' : '/h') : ''].filter(Boolean).join(' · ')}</div>`
            ).join('');
            const hours = c.operationHours || 'Hours not available';
            return `
        <div class="charger-item">
          <div class="charger-item-header">
            <span class="charger-item-name">${c.name || `Charger ${i + 1}`}</span>
            <span class="card-badge ${bc}">${label}</span>
          </div>
          <div class="charger-item-detail">📍 ${c.position || '–'} &middot; ${c.operator || '–'}</div>
          <div class="charger-item-detail">🕐 ${hours}</div>
          ${pts}
        </div>`;
        }).join('');

        const html = `
      <div class="sheet-title">${s.name || s.address || 'EV Station'}</div>
      <div class="sheet-subtitle">${s.address || ''}</div>

      <div class="sheet-section">
        <div class="sheet-section-title">Overall Status</div>
        <div class="detail-grid">
          <div class="detail-card">
            <div class="detail-card-label">Status</div>
            <div class="detail-card-value">${STATUS_EMOJI[st]} ${STATUS_LABELS[st]}</div>
          </div>
          <div class="detail-card">
            <div class="detail-card-label">Charging Points</div>
            <div class="detail-card-value">${cp.filter(p => p.status === 1).length} / ${cp.length}</div>
          </div>
        </div>
      </div>

      ${cp.length ? `
      <div class="sheet-section">
        <div class="sheet-section-title">Chargers</div>
        <div class="charger-list">${chargerItems}</div>
      </div>` : ''}

      <div class="sheet-actions">
        ${lat && lng ? `<button class="sheet-btn btn-primary" onclick="MapManager.showNavModal(${lat}, ${lng}, '${(s.name || s.address || 'EV Station').replace(/'/g, "\\'")}')">🧭 Navigate</button>` : ''}
        ${lat && lng ? `<button class="sheet-btn btn-secondary" onclick="MapManager.openMapModal(${lat}, ${lng}, '${(s.name || s.address || 'EV Station').replace(/'/g, "\\'")}')">🗺️ Map View</button>` : ''}
      </div>`;

        BottomSheet.open(html);
    }

    function setListHTML(html) {
        const el = document.getElementById('ev-list');
        if (el) el.innerHTML = html;
    }

    function updateLastUpdatedBadge() {
        const el = document.getElementById('last-updated-badge');
        if (!el || !lastUpdated) return;
        const secs = Math.round((Date.now() - lastUpdated) / 1000);
        el.textContent = secs < 5 ? 'Just updated' : `Updated ${secs}s ago`;
    }

    function startAutoRefresh() {
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
            if (activeTab === 'ev' && lastPostalCode) searchByPostal(lastPostalCode);
            updateLastUpdatedBadge();
        }, 300000); // 5 min
    }

    function initFilters() {
        // EV status filter chips
        document.querySelectorAll('[data-ev-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                const f = chip.dataset.evFilter;
                if (f === 'available') showAvailable = chip.classList.contains('active');
                if (f === 'occupied') showOccupied = chip.classList.contains('active');
                renderEV();
            });
        });

        // Postal code input
        document.getElementById('ev-postal-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const val = e.target.value.trim().replace(/\D/g, '');
                searchByPostal(val);
            }
        });

        // Search button
        document.getElementById('ev-search-btn')?.addEventListener('click', () => {
            const val = document.getElementById('ev-postal-input')?.value.trim().replace(/\D/g, '');
            searchByPostal(val);
        });

        // Locate button
        document.getElementById('ev-locate-btn')?.addEventListener('click', async () => {
            const uLat = MapManager.userLat;
            const uLng = MapManager.userLng;
            if (!uLat || !uLng) {
                alert('Location not available. Please allow location access and try again.');
                return;
            }
            const btn = document.getElementById('ev-locate-btn');
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div>';
            const postal = await reverseGeocode(uLat, uLng);
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 6-8 13-8 13S4 16 4 10a8 8 0 0 1 8-8z"/></svg>`;
            if (postal) {
                document.getElementById('ev-postal-input').value = postal;
                searchByPostal(postal);
            } else {
                alert('Could not determine your postal code. Please enter it manually.');
            }
        });
    }

    function init() {
        initFilters();
        startAutoRefresh();
    }

    return {
        init,
        openSheetByLocation,
        searchByPostal
    };
})();