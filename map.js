const MapManager = (() => {
    let leafletMap = null;
    let clusterGroup = null;

    function initMap() {
        if (leafletMap) return;
        leafletMap = L.map('mapContainer').setView([1.3521, 103.8198], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(leafletMap);
        clusterGroup = L.markerClusterGroup({
            chunkedLoading: true
        });
        leafletMap.addLayer(clusterGroup);
    }

    function openModal(title) {
        document.getElementById('mapModalTitle').textContent = title;
        document.getElementById('mapModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            if (leafletMap) leafletMap.invalidateSize();
        }, 150);
    }

    function closeModal() {
        document.getElementById('mapModal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    function clearMarkers() {
        if (clusterGroup) clusterGroup.clearLayers();
    }

    function carparkIcon(color) {
        return L.divIcon({
            className: '',
            html: `<div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        background:${color};border:2.5px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;transform:rotate(-45deg)
      "><span style="transform:rotate(45deg)">🅿️</span></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -36],
        });
    }

    function evIcon(status) {
        const color = status === 1 ? '#22c55e' : status === 0 ? '#ef4444' : '#94a3b8';
        return L.divIcon({
            className: '',
            html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${color};border:2.5px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;
      ">⚡</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -20],
        });
    }

    function showCarparks(carparks, userLat, userLng) {
        if (!leafletMap) initMap();
        clearMarkers();

        carparks.forEach(cp => {
            if (!cp.Location) return;
            const [lat, lng] = cp.Location.split(' ').map(Number);
            if (isNaN(lat) || isNaN(lng)) return;

            const avail = parseInt(cp.AvailableLots) || 0;
            const color = avail > 20 ? '#22c55e' : avail > 5 ? '#f59e0b' : '#ef4444';

            const marker = L.marker([lat, lng], {
                icon: carparkIcon(color)
            });
            const cpName = cp.Development || cp.CarParkID;
            const popupEl = document.createElement('div');
            popupEl.style.cssText = "font-family:'Nunito',sans-serif;min-width:180px";
            popupEl.innerHTML = `
        <strong style="font-family:'Jua',sans-serif;font-size:0.95rem">${cpName}</strong>
        <br><span style="font-size:0.8rem;color:#666">${cp.Area || cp.Agency}</span>
        <br><br>
        <span style="font-size:1.2rem;font-weight:700;color:${color}">${avail}</span>
        <span style="font-size:0.8rem;color:#666"> lots available (${cp.LotType})</span>
        <br><br>
        <button class="popup-nav-btn" style="width:100%;padding:6px;border-radius:6px;border:none;background:var(--brand,#ccffcc);cursor:pointer;font-weight:700;font-family:'Nunito',sans-serif">
          🧭 Navigate
        </button>
      `;
            popupEl.querySelector('.popup-nav-btn').addEventListener('click', () => {
                NavManager.open(cpName, lat, lng);
            });
            marker.bindPopup(popupEl);
            clusterGroup.addLayer(marker);
        });

        if (userLat && userLng) {
            L.circleMarker([userLat, userLng], {
                radius: 10,
                color: '#3b82f6',
                fillColor: '#93c5fd',
                fillOpacity: 0.8,
                weight: 2,
            }).addTo(leafletMap).bindPopup('📍 Your location');
            leafletMap.setView([userLat, userLng], 14);
        } else if (carparks.length) {
            leafletMap.fitBounds(clusterGroup.getBounds(), {
                padding: [30, 30]
            });
        }

        openModal('🚗 Carparks Map');
    }

    function showEV(stations) {
        if (!leafletMap) initMap();
        clearMarkers();

        stations.forEach(st => {
            const lat = parseFloat(st.latitude);
            const lng = parseFloat(st.longtitude);
            if (isNaN(lat) || isNaN(lng)) return;

            const statusVal = st.status;
            const marker = L.marker([lat, lng], {
                icon: evIcon(statusVal)
            });
            const stName = st.name;
            const statusLabel = statusVal === 1 ? '✅ Available' : statusVal === 0 ? '🔴 Occupied' : '⚫ Unavailable';

            const popupEl = document.createElement('div');
            popupEl.style.cssText = "font-family:'Nunito',sans-serif;min-width:180px";
            popupEl.innerHTML = `
        <strong style="font-family:'Jua',sans-serif;font-size:0.95rem">${stName}</strong>
        <br><span style="font-size:0.78rem;color:#666">${st.address}</span>
        <br><br>
        <span style="font-size:0.85rem">${statusLabel}</span>
        <br><br>
        <button class="popup-nav-btn" style="width:100%;padding:6px;border-radius:6px;border:none;background:var(--brand,#ccffcc);cursor:pointer;font-weight:700;font-family:'Nunito',sans-serif">
          🧭 Navigate
        </button>
      `;
            popupEl.querySelector('.popup-nav-btn').addEventListener('click', () => {
                NavManager.open(stName, lat, lng);
            });
            marker.bindPopup(popupEl);
            clusterGroup.addLayer(marker);
        });

        if (stations.length) {
            try {
                leafletMap.fitBounds(clusterGroup.getBounds(), {
                    padding: [40, 40]
                });
            } catch (e) {
                leafletMap.setView([1.3521, 103.8198], 12);
            }
        }

        openModal('⚡ EV Charging Map');
    }

    function focusPoint(lat, lng, label) {
        if (!leafletMap) initMap();
        openModal(label);
        setTimeout(() => {
            leafletMap.setView([lat, lng], 17);
            leafletMap.invalidateSize();
        }, 200);
    }

    function init() {
        document.getElementById('closeMapModal')?.addEventListener('click', closeModal);
        document.getElementById('mapModal')?.addEventListener('click', e => {
            if (e.target.id === 'mapModal') closeModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        showCarparks,
        showEV,
        focusPoint,
        initMap
    };
})();

/* ── Navigate Manager ── */
const NavManager = (() => {
    let _lat, _lng, _name;

    function open(name, lat, lng) {
        _name = name;
        _lat = lat;
        _lng = lng;
        document.getElementById('navModalName').textContent = name;
        document.getElementById('navGoogleMaps').href =
            `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        document.getElementById('navWaze').href =
            `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
        document.getElementById('navAppleMaps').href =
            `https://maps.apple.com/?daddr=${lat},${lng}`;
        document.getElementById('navModal').classList.remove('hidden');
    }

    function init() {
        document.getElementById('closeNavModal')?.addEventListener('click', () => {
            document.getElementById('navModal').classList.add('hidden');
        });
        document.getElementById('navModal')?.addEventListener('click', e => {
            if (e.target.id === 'navModal') document.getElementById('navModal').classList.add('hidden');
        });
        document.getElementById('navOpenMap')?.addEventListener('click', () => {
            document.getElementById('navModal').classList.add('hidden');
            if (_lat && _lng) MapManager.focusPoint(_lat, _lng, _name);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        open
    };
})();