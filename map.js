// ===== MAP MANAGER =====
const MapManager = (() => {
    let map = null;
    let modalMap = null;
    let userMarker = null;
    let carparkLayer = null;
    let evLayer = null;
    let userLat = null;
    let userLng = null;

    // Pending nav target
    let navTarget = null;

    function createPinIcon(type, colorClass = '') {
        const colors = {
            carpark: {
                green: '#22c55e',
                amber: '#f59e0b',
                red: '#ef4444',
                grey: '#94a3b8'
            },
            ev: '#3b82f6',
            user: '#8b5cf6',
        };

        if (type === 'user') {
            return L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;border-radius:50%;background:#8b5cf6;border:3px solid #fff;box-shadow:0 2px 8px rgba(139,92,246,0.5)"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            });
        }

        const bg = type === 'ev' ?
            colors.ev :
            ({
                green: colors.carpark.green,
                amber: colors.carpark.amber,
                red: colors.carpark.red,
                grey: colors.carpark.grey
            } [colorClass] || colors.carpark.green);

        const emoji = type === 'ev' ? '⚡' : '🅿';

        return L.divIcon({
            className: '',
            html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${bg};border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center">
               <span style="transform:rotate(45deg);font-size:13px;line-height:1">${emoji}</span>
             </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -32],
        });
    }

    function initMap() {
        map = L.map('map', {
            center: [1.3521, 103.8198],
            zoom: 13,
            zoomControl: false,
            attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);

        L.control.attribution({
            position: 'bottomright',
            prefix: '© OpenStreetMap'
        }).addTo(map);

        carparkLayer = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: cluster => L.divIcon({
                html: `<div style="width:36px;height:36px;border-radius:50%;background:rgba(34,197,94,0.85);border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,0.2)">${cluster.getChildCount()}</div>`,
                className: '',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            }),
        });
        evLayer = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            iconCreateFunction: cluster => L.divIcon({
                html: `<div style="width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,0.85);border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,0.2)">${cluster.getChildCount()}</div>`,
                className: '',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
            }),
        });

        map.addLayer(carparkLayer);
        map.addLayer(evLayer);

        // Center button
        document.getElementById('center-map-btn')?.addEventListener('click', () => {
            if (userLat && userLng) {
                map.flyTo([userLat, userLng], 15, {
                    duration: 0.8
                });
            }
        });

        return map;
    }

    function setUserLocation(lat, lng) {
        userLat = lat;
        userLng = lng;
        if (!map) return;
        if (userMarker) userMarker.remove();
        userMarker = L.marker([lat, lng], {
                icon: createPinIcon('user'),
                zIndexOffset: 1000
            })
            .bindPopup('<div class="popup-title">📍 You are here</div>')
            .addTo(map);
        map.flyTo([lat, lng], 14, {
            duration: 1
        });
    }

    function addCarparkMarker(cp, colorClass, popupHtml) {
        if (!cp.Location) return;
        const [lat, lng] = cp.Location.split(' ').map(Number);
        if (!lat || !lng) return;
        const marker = L.marker([lat, lng], {
            icon: createPinIcon('carpark', colorClass)
        });
        marker.bindPopup(popupHtml);
        carparkLayer.addLayer(marker);
        return marker;
    }

    function addEVMarker(station, popupHtml) {
        if (!station.latitude || !station.longtitude) return;
        const marker = L.marker(
            [parseFloat(station.latitude), parseFloat(station.longtitude)], {
                icon: createPinIcon('ev')
            }
        );
        marker.bindPopup(popupHtml);
        evLayer.addLayer(marker);
        return marker;
    }

    function clearCarparks() {
        carparkLayer?.clearLayers();
    }

    function clearEV() {
        evLayer?.clearLayers();
    }

    // Navigation modal
    function showNavModal(lat, lng, label) {
        navTarget = {
            lat,
            lng,
            label
        };
        document.getElementById('nav-modal-desc').textContent = `Navigate to: ${label}`;
        document.getElementById('nav-modal-backdrop').classList.add('show');
        document.getElementById('nav-modal').classList.add('show');
    }

    function initNavModal() {
        const backdrop = document.getElementById('nav-modal-backdrop');
        const modal = document.getElementById('nav-modal');
        const closeBtn = document.getElementById('close-nav-modal');

        function closeModal() {
            backdrop.classList.remove('show');
            modal.classList.remove('show');
        }
        backdrop?.addEventListener('click', closeModal);
        closeBtn?.addEventListener('click', closeModal);

        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!navTarget) return;
                const {
                    lat,
                    lng,
                    label
                } = navTarget;
                const enc = encodeURIComponent(label);
                const urls = {
                    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
                    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
                    apple: `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
                    osm: `https://www.openstreetmap.org/directions?from=&to=${lat},${lng}#map=16/${lat}/${lng}`,
                };
                window.open(urls[btn.dataset.nav], '_blank');
                closeModal();
            });
        });
    }

    // Map modal (full screen map)
    function openMapModal(lat, lng, title) {
        const backdrop = document.getElementById('map-modal-backdrop');
        const modal = document.getElementById('map-modal');
        document.getElementById('map-modal-title').textContent = title || 'Map';
        backdrop.classList.add('show');
        modal.classList.add('show');

        if (!modalMap) {
            modalMap = L.map('map-modal-map', {
                center: [lat, lng],
                zoom: 16,
                zoomControl: true,
                attributionControl: false,
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(modalMap);
            L.control.attribution({
                prefix: '© OpenStreetMap'
            }).addTo(modalMap);
        } else {
            modalMap.flyTo([lat, lng], 16, {
                duration: 0.6
            });
        }

        L.marker([lat, lng], {
            icon: createPinIcon('carpark', 'green')
        }).addTo(modalMap);
        if (userLat && userLng) {
            L.marker([userLat, userLng], {
                icon: createPinIcon('user')
            }).addTo(modalMap);
        }

        setTimeout(() => modalMap.invalidateSize(), 100);
    }

    function initMapModal() {
        const backdrop = document.getElementById('map-modal-backdrop');
        const modal = document.getElementById('map-modal');
        const closeBtn = document.getElementById('close-map-modal');

        function closeModal() {
            backdrop.classList.remove('show');
            modal.classList.remove('show');
        }
        backdrop?.addEventListener('click', closeModal);
        closeBtn?.addEventListener('click', closeModal);
    }

    function getDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatDistance(m) {
        return m < 1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)}km`;
    }

    return {
        initMap,
        setUserLocation,
        addCarparkMarker,
        addEVMarker,
        clearCarparks,
        clearEV,
        showNavModal,
        initNavModal,
        openMapModal,
        initMapModal,
        getDistance,
        formatDistance,
        get map() {
            return map;
        },
        get userLat() {
            return userLat;
        },
        get userLng() {
            return userLng;
        },
    };
})();