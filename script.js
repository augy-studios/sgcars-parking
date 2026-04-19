// ===== BOTTOM SHEET =====
const BottomSheet = (() => {
    function open(html) {
        const sheet = document.getElementById('bottom-sheet');
        const backdrop = document.getElementById('sheet-backdrop');
        const content = document.getElementById('sheet-content');
        content.innerHTML = html;
        sheet.classList.add('show');
        backdrop.classList.add('show');
    }

    function close() {
        document.getElementById('bottom-sheet')?.classList.remove('show');
        document.getElementById('sheet-backdrop')?.classList.remove('show');
    }

    function init() {
        document.getElementById('sheet-backdrop')?.addEventListener('click', close);
    }
    return {
        open,
        close,
        init
    };
})();

// ===== TAB MANAGER =====
const TabManager = (() => {
    function init() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
                document.getElementById(`panel-${tab}`)?.classList.remove('hidden');

                BottomSheet.close();
            });
        });
    }
    return {
        init
    };
})();

// ===== LOCATION MANAGER =====
const LocationManager = (() => {
    let watchId = null;

    function updateBanner(text, accuracy = null) {
        const el = document.getElementById('location-text');
        const acc = document.getElementById('location-accuracy');
        if (el) el.textContent = text;
        if (acc) acc.textContent = accuracy ? `±${Math.round(accuracy)}m` : '';
    }

    function init() {
        if (!navigator.geolocation) {
            updateBanner('Location not supported by this browser');
            return;
        }

        updateBanner('Requesting location access…');

        navigator.geolocation.getCurrentPosition(
            pos => onPosition(pos),
            err => {
                console.warn('Geolocation error', err);
                updateBanner('Location access denied – showing all carparks');
                CarparkManager.applyFilters();
            }, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );

        // Watch for updates
        watchId = navigator.geolocation.watchPosition(
            pos => onPosition(pos),
            err => console.warn('Watch error', err), {
                enableHighAccuracy: true,
                maximumAge: 60000,
                timeout: 20000
            }
        );
    }

    function onPosition(pos) {
        const {
            latitude,
            longitude,
            accuracy
        } = pos.coords;
        MapManager.setUserLocation(latitude, longitude);
        updateBanner(`📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, accuracy);
        CarparkManager.onLocationUpdate();
    }

    return {
        init
    };
})();

// ===== REFRESH BUTTON =====
function initRefreshBtn() {
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        const btn = document.getElementById('refresh-btn');
        btn.style.animation = 'spin 0.6s linear infinite';
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab === 'carparks') {
            CarparkManager.fetchData().finally(() => {
                btn.style.animation = '';
            });
        } else {
            const postal = document.getElementById('ev-postal-input')?.value.trim().replace(/\D/g, '');
            if (postal) EVManager.searchByPostal(postal).finally(() => {
                btn.style.animation = '';
            });
            else btn.style.animation = '';
        }
    });
}

// ===== PWA / SERVICE WORKER =====
function initPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.warn);
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        const banner = document.getElementById('install-banner');
        if (banner && !localStorage.getItem('pnc-install-dismissed')) {
            banner.style.display = 'flex';
        }
    });

    document.getElementById('install-btn')?.addEventListener('click', () => {
        deferredPrompt?.prompt();
        document.getElementById('install-banner').style.display = 'none';
    });

    document.getElementById('dismiss-install')?.addEventListener('click', () => {
        document.getElementById('install-banner').style.display = 'none';
        localStorage.setItem('pnc-install-dismissed', '1');
    });
}

// ===== TOGGLE VIEW (map / list) =====
function initToggleView() {
    let mapVisible = true;
    document.getElementById('toggle-view-btn')?.addEventListener('click', () => {
        const wrapper = document.getElementById('map-wrapper');
        mapVisible = !mapVisible;
        wrapper.style.display = mapVisible ? '' : 'none';
        if (mapVisible) MapManager.map?.invalidateSize();
    });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    BottomSheet.init();
    TabManager.init();
    MapManager.initMap();
    MapManager.initNavModal();
    MapManager.initMapModal();
    LocationManager.init();
    CarparkManager.init();
    EVManager.init();
    initRefreshBtn();
    initToggleView();
    initPWA();
});