// ===== CARPARKS MODULE =====
const CarparkManager = (() => {
    let allData = [];
    let filtered = [];
    let lotTypeFilter = 'all';
    let agencyFilter = 'all';
    let searchQuery = '';
    let lastUpdated = null;
    let refreshTimer = null;

    function availClass(lots) {
        if (lots === null || lots === undefined) return 'grey';
        if (lots > 50) return 'green';
        if (lots > 10) return 'amber';
        if (lots > 0) return 'red';
        return 'red';
    }

    function badgeClass(lots) {
        if (lots === null || lots === undefined) return 'badge-grey';
        if (lots > 50) return 'badge-green';
        if (lots > 10) return 'badge-amber';
        return 'badge-red';
    }

    function groupByCarpark(raw) {
        const map = {};
        for (const item of raw) {
            const id = item.CarParkID;
            if (!map[id]) {
                map[id] = {
                    CarParkID: item.CarParkID,
                    Area: item.Area,
                    Development: item.Development,
                    Location: item.Location,
                    Agency: item.Agency,
                    lots: [],
                };
            }
            map[id].lots.push({
                type: item.LotType,
                available: item.AvailableLots
            });
        }
        return Object.values(map);
    }

    function getCoords(cp) {
        if (!cp.Location) return null;
        const parts = cp.Location.trim().split(/\s+/);
        if (parts.length < 2) return null;
        return {
            lat: parseFloat(parts[0]),
            lng: parseFloat(parts[1])
        };
    }

    async function fetchData() {
        try {
            const resp = await fetch('/api/carparks');
            if (!resp.ok) throw new Error('API error');
            const json = await resp.json();
            allData = groupByCarpark(json.value || []);
            lastUpdated = new Date();
            updateLastUpdatedBadge();
            applyFilters();
            renderMap();
        } catch (e) {
            console.error('Carpark fetch failed', e);
            setListHTML(`<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load carpark data. Please try again.</p></div>`);
        }
    }

    function applyFilters() {
        let data = [...allData];

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter(cp =>
                (cp.Development || '').toLowerCase().includes(q) ||
                (cp.Area || '').toLowerCase().includes(q) ||
                (cp.CarParkID || '').toLowerCase().includes(q)
            );
        }

        // Lot type
        if (lotTypeFilter !== 'all') {
            data = data.filter(cp => cp.lots.some(l => l.type === lotTypeFilter));
        }

        // Agency
        if (agencyFilter !== 'all') {
            data = data.filter(cp => cp.Agency === agencyFilter);
        }

        // Show LTA coverage note
        const note = document.getElementById('lta-coverage-note');
        if (note) note.style.display = (agencyFilter === 'all' || agencyFilter === 'LTA') ? 'block' : 'none';

        // Sort by distance if we have user location
        const uLat = MapManager.userLat;
        const uLng = MapManager.userLng;
        if (uLat && uLng) {
            data = data.map(cp => {
                const coords = getCoords(cp);
                const dist = coords ? MapManager.getDistance(uLat, uLng, coords.lat, coords.lng) : Infinity;
                return {
                    ...cp,
                    _dist: dist
                };
            }).sort((a, b) => a._dist - b._dist);
        }

        filtered = data;
        renderList();
    }

    function renderList() {
        const el = document.getElementById('carpark-list');
        const count = document.getElementById('carpark-count');
        if (!el) return;

        if (!filtered.length) {
            count.textContent = '0 results';
            setListHTML(`<div class="empty-state"><div class="empty-icon">🅿️</div><p>No carparks found matching your filters.</p></div>`);
            return;
        }

        count.textContent = `${filtered.length} carpark${filtered.length !== 1 ? 's' : ''} found`;

        // Render only first 80 for perf
        const toRender = filtered.slice(0, 80);
        el.innerHTML = toRender.map(cp => cardHTML(cp)).join('');

        // Attach click handlers
        el.querySelectorAll('.card').forEach((card, i) => {
            card.addEventListener('click', () => openSheet(toRender[i]));
        });
    }

    function totalLots(cp, type = null) {
        return cp.lots.filter(l => !type || l.type === type).reduce((s, l) => s + (l.available || 0), 0);
    }

    function cardHTML(cp) {
        const lots = cp.lots;
        const displayLot = lotTypeFilter !== 'all' ? lots.find(l => l.type === lotTypeFilter) : null;
        const displayAvail = displayLot ? displayLot.available : totalLots(cp);
        const ac = availClass(displayAvail);
        const bc = badgeClass(displayAvail);
        const distStr = cp._dist && cp._dist !== Infinity ? MapManager.formatDistance(cp._dist) : '';

        const lotPills = lots.map(l => {
            const icons = {
                C: '🚗',
                Y: '🏍️',
                H: '🚛'
            };
            const c = availClass(l.available);
            const colors = {
                green: '#dcfce7;color:#15803d',
                amber: '#fef3c7;color:#b45309',
                red: '#fee2e2;color:#b91c1c',
                grey: '#f1f5f9;color:#64748b'
            };
            return `<span class="lot-pill" style="background:${colors[c]}">${icons[l.type] || l.type} ${l.available ?? '–'}</span>`;
        }).join('');

        return `
      <div class="card glass avail-${ac}" data-id="${cp.CarParkID}">
        <div class="card-header">
          <span class="card-title">${cp.Development || cp.CarParkID}</span>
          <span class="card-badge ${bc}">${displayAvail ?? '–'} lots</span>
        </div>
        <div class="card-sub">${[cp.Area, cp.Agency].filter(Boolean).join(' · ')}</div>
        <div class="card-meta">
          <div class="lots-bar">${lotPills}</div>
          ${distStr ? `<span class="card-distance">📍 ${distStr}</span>` : ''}
        </div>
      </div>`;
    }

    function renderMap() {
        MapManager.clearCarparks();
        for (const cp of allData.slice(0, 500)) {
            const coords = getCoords(cp);
            if (!coords) continue;
            const avail = totalLots(cp);
            const ac = availClass(avail);
            const popup = `
        <div class="popup-title">${cp.Development || cp.CarParkID}</div>
        <div class="popup-detail">${cp.Agency} · ${avail} lots available</div>
        <button class="popup-btn" onclick="CarparkManager.openSheetById('${cp.CarParkID}')">View Details</button>`;
            MapManager.addCarparkMarker(cp, ac, popup);
        }
    }

    function openSheetById(id) {
        const cp = allData.find(c => c.CarParkID === id);
        if (cp) openSheet(cp);
    }

    function openSheet(cp) {
        const coords = getCoords(cp);
        const lots = cp.lots;

        const lotRows = lots.map(l => {
            const icons = {
                C: '🚗 Cars',
                Y: '🏍️ Motorcycles',
                H: '🚛 Heavy Vehicles'
            };
            const ac = availClass(l.available);
            const badge = `<span class="card-badge badge-${ac === 'green' ? 'green' : ac === 'amber' ? 'amber' : 'red'}">${l.available ?? '–'}</span>`;
            return `<div class="detail-card">
        <div class="detail-card-label">${icons[l.type] || l.type}</div>
        <div class="detail-card-value" style="display:flex;align-items:center;gap:6px">${l.available ?? '–'} ${badge}</div>
      </div>`;
        }).join('');

        const html = `
      <div class="sheet-title">${cp.Development || cp.CarParkID}</div>
      <div class="sheet-subtitle">ID: ${cp.CarParkID} &middot; ${cp.Agency}${cp.Area ? ' · ' + cp.Area : ''}</div>

      <div class="sheet-section">
        <div class="sheet-section-title">Available Lots</div>
        <div class="detail-grid">${lotRows}</div>
      </div>

      <div class="sheet-section">
        <div class="sheet-section-title">Details</div>
        <div class="detail-grid">
          <div class="detail-card">
            <div class="detail-card-label">Agency</div>
            <div class="detail-card-value">${cp.Agency}</div>
          </div>
          <div class="detail-card">
            <div class="detail-card-label">Carpark ID</div>
            <div class="detail-card-value">${cp.CarParkID}</div>
          </div>
        </div>
      </div>

      <div class="sheet-actions">
        ${coords ? `<button class="sheet-btn btn-primary" onclick="MapManager.showNavModal(${coords.lat}, ${coords.lng}, '${(cp.Development || cp.CarParkID).replace(/'/g, "\\'")}')">🧭 Navigate</button>` : ''}
        ${coords ? `<button class="sheet-btn btn-secondary" onclick="MapManager.openMapModal(${coords.lat}, ${coords.lng}, '${(cp.Development || cp.CarParkID).replace(/'/g, "\\'")}')">🗺️ Map View</button>` : ''}
      </div>`;

        BottomSheet.open(html);
    }

    function setListHTML(html) {
        const el = document.getElementById('carpark-list');
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
            if (activeTab === 'carparks') fetchData();
            updateLastUpdatedBadge();
        }, 60000);

        // Badge tick
        setInterval(updateLastUpdatedBadge, 5000);

        // Refresh on tab visibility
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) fetchData();
        });
    }

    function initFilters() {
        // Search
        document.getElementById('carpark-search')?.addEventListener('input', e => {
            searchQuery = e.target.value.trim();
            applyFilters();
        });

        // Lot type chips
        document.querySelectorAll('#lot-type-filter .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#lot-type-filter .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                lotTypeFilter = chip.dataset.filter;
                applyFilters();
            });
        });

        // Agency chips
        document.querySelectorAll('#agency-filter .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#agency-filter .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                agencyFilter = chip.dataset.filter;
                applyFilters();
            });
        });
    }

    function onLocationUpdate() {
        applyFilters();
        renderMap();
    }

    function init() {
        initFilters();
        fetchData();
        startAutoRefresh();
    }

    return {
        init,
        fetchData,
        openSheetById,
        applyFilters,
        onLocationUpdate
    };
})();