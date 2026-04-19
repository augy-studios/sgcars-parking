/* js/app.js – App shell: tabs, geolocation, refresh, update bar, SW */
(function () {
    // ── Tab switching ────────────────────────────────────
    function initTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const panels = document.querySelectorAll('.tab-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                panels.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                const panel = document.getElementById(`tab-${tab.dataset.tab}`);
                if (panel) panel.classList.add('active');
            });
        });
    }

    // ── Update bar ───────────────────────────────────────
    function updateBar() {
        const el = document.getElementById('updateText');
        const cpFetch = CarparkManager.getLastFetch?.();
        const evFetch = EVManager.getLastFetch?.();
        const latest = Math.max(cpFetch || 0, evFetch || 0);

        if (!latest) {
            el.textContent = 'Locating you…';
            return;
        }
        const sec = Math.floor((Date.now() - latest) / 1000);
        if (sec < 10) el.textContent = 'Updated just now';
        else if (sec < 60) el.textContent = `Updated ${sec}s ago`;
        else el.textContent = `Updated ${Math.floor(sec / 60)}m ago`;
    }

    // ── Geolocation ──────────────────────────────────────
    function initGeolocation() {
        const el = document.getElementById('updateText');

        if (!navigator.geolocation) {
            el.textContent = 'Location not available — showing all carparks';
            CarparkManager.load();
            return;
        }

        // Show loading state immediately, start fetch in parallel
        CarparkManager.load();

        navigator.geolocation.getCurrentPosition(
            pos => {
                const {
                    latitude: lat,
                    longitude: lng
                } = pos.coords;
                CarparkManager.setUserLocation(lat, lng);
                el.textContent = `📍 Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            },
            err => {
                console.warn('Geolocation error:', err.message);
                el.textContent = 'Location access denied — showing all carparks';
            }, {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 30000
            }
        );
    }

    // ── Refresh button ───────────────────────────────────
    function initRefresh() {
        const btn = document.getElementById('refreshBtn');
        btn?.addEventListener('click', () => {
            btn.classList.add('spinning');
            const activeTab = document.querySelector('.tab-btn.active')?.dataset?.tab;
            const done = () => btn.classList.remove('spinning');

            if (activeTab === 'carparks') {
                CarparkManager.load().finally(done);
            } else if (activeTab === 'ev') {
                const postal = document.getElementById('evPostal')?.value?.trim();
                if (postal) EVManager.load(postal).finally(done);
                else done();
            } else {
                done();
            }
        });
    }

    // ── Page visibility – refresh on return ─────────────
    function initVisibilityRefresh() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const cpFetch = CarparkManager.getLastFetch?.();
                const age = cpFetch ? Date.now() - cpFetch : Infinity;
                if (age > 60_000) CarparkManager.load(true);

                const evFetch = EVManager.getLastFetch?.();
                const evAge = evFetch ? Date.now() - evFetch : Infinity;
                if (evAge > 300_000) {
                    const postal = document.getElementById('evPostal')?.value?.trim();
                    if (postal) EVManager.load(postal, true);
                }
            }
        });
    }

    // ── Service Worker ───────────────────────────────────
    function initSW() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.warn);
        }
    }

    // ── Init ─────────────────────────────────────────────
    function init() {
        initTabs();
        initRefresh();
        initGeolocation();
        initVisibilityRefresh();
        initSW();
        CarparkManager.startAutoRefresh();
        EVManager.startAutoRefresh();
        setInterval(updateBar, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();