const MapManager = (() => {
    let map = null;
    let markerCluster = null;
    let userMarker = null;
    let allMarkers = []; // { marker, carpark }
    let onCarparkSelect = null;

    const GREEN_ICON = createIcon('#22c55e');
    const AMBER_ICON = createIcon('#f59e0b');
    const RED_ICON = createIcon('#ef4444');
    const GREY_ICON = createIcon('#94a3b8');
    const USER_ICON = createUserIcon();

    function createIcon(color) {
        return L.divIcon({
            className: '',
            html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.27 21.73 0 14 0z"
              fill="${color}" stroke="white" stroke-width="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
        <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
      </svg>`,
            iconSize: [28, 36],
            iconAnchor: [14, 36],
            popupAnchor: [0, -38]
        });
    }

    function createUserIcon() {
        return L.divIcon({
            className: '',
            html: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="white" stroke-width="3" filter="drop-shadow(0 2px 6px rgba(59,130,246,0.6))"/>
        <circle cx="12" cy="12" r="4" fill="white"/>
      </svg>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14]
        });
    }

    function getIcon(availableLots) {
        if (availableLots > 50) return GREEN_ICON;
        if (availableLots >= 10) return AMBER_ICON;
        if (availableLots > 0) return RED_ICON;
        return GREY_ICON;
    }

    function init() {
        if (map) return;

        map = L.map('leaflet-map', {
            center: [1.3521, 103.8198],
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map);

        markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    className: '',
                    html: `<div style="
            background: var(--btn-primary-bg, #1a4a1a);
            color: var(--btn-primary-text, #ccffcc);
            width: 38px; height: 38px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-family: 'Jua', sans-serif;
            font-size: 13px;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          ">${count}</div>`,
                    iconSize: [38, 38],
                    iconAnchor: [19, 19]
                });
            }
        });

        map.addLayer(markerCluster);
    }

    function setCarparks(carparks, userLat, userLng) {
        if (!map) return;

        markerCluster.clearLayers();
        allMarkers = [];

        carparks.forEach(cp => {
            const lat = parseFloat(cp.Location?.split(' ')[0]);
            const lng = parseFloat(cp.Location?.split(' ')[1]);
            if (isNaN(lat) || isNaN(lng)) return;

            const lots = parseInt(cp.AvailableLots) || 0;
            const icon = getIcon(lots);

            const marker = L.marker([lat, lng], {
                icon
            });

            const typeEmoji = cp.LotType === 'Y' ? '🏍️' : cp.LotType === 'H' ? '🚛' : '🚗';
            const availColor = lots > 50 ? '#16a34a' : lots >= 10 ? '#b45309' : '#dc2626';

            marker.bindPopup(`
        <div class="map-popup-name">${cp.Development || cp.CarParkID}</div>
        <div class="map-popup-sub">${cp.Agency} ${cp.Area ? '· ' + cp.Area : ''}</div>
        <div class="map-popup-avail" style="color:${availColor}">${typeEmoji} ${lots} lots available</div>
      `);

            marker.on('click', () => {
                if (onCarparkSelect) onCarparkSelect(cp);
            });

            markerCluster.addLayer(marker);
            allMarkers.push({
                marker,
                carpark: cp
            });
        });

        // User marker
        if (userLat && userLng) {
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([userLat, userLng], {
                    icon: USER_ICON
                })
                .addTo(map)
                .bindPopup('<strong>You are here</strong>');
        }
    }

    function panToUser(lat, lng) {
        if (!map) return;
        map.setView([lat, lng], 15, {
            animate: true
        });
    }

    function panToCarpark(lat, lng) {
        if (!map) return;
        map.setView([lat, lng], 17, {
            animate: true
        });
    }

    function invalidateSize() {
        if (map) setTimeout(() => map.invalidateSize(), 100);
    }

    function setOnSelect(fn) {
        onCarparkSelect = fn;
    }

    return {
        init,
        setCarparks,
        panToUser,
        panToCarpark,
        invalidateSize,
        setOnSelect
    };
})();