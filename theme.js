(function () {
    const STORAGE_KEY = 'sgpnc_theme';
    const THEME_COLORS = {
        classic: '#ccffcc',
        ng1: '#ffcccc',
        ng2: '#ccccff',
        ng3: '#ffffcc',
        ng4: '#ffccff',
        ng5: '#ccffff',
        white: '#ffffff',
    };

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        const meta = document.getElementById('metaThemeColor');
        if (meta) meta.setAttribute('content', THEME_COLORS[theme] || '#ccffcc');
        localStorage.setItem(STORAGE_KEY, theme);

        document.querySelectorAll('.theme-swatch').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    function init() {
        const saved = localStorage.getItem(STORAGE_KEY) || 'classic';
        applyTheme(saved);

        const themeBtn = document.getElementById('themeBtn');
        const themeModal = document.getElementById('themeModal');
        const closeThemeModal = document.getElementById('closeThemeModal');

        themeBtn?.addEventListener('click', () => {
            themeModal?.classList.remove('hidden');
        });
        closeThemeModal?.addEventListener('click', () => {
            themeModal?.classList.add('hidden');
        });
        themeModal?.addEventListener('click', e => {
            if (e.target === themeModal) themeModal.classList.add('hidden');
        });

        document.querySelectorAll('.theme-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                applyTheme(btn.dataset.theme);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();