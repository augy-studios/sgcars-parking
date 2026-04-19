(function () {
    const THEMES = {
        classic: '#ccffcc',
        notgreen1: '#ffcccc',
        notgreen2: '#ccccff',
        notgreen3: '#ffffcc',
        notgreen4: '#ffccff',
        notgreen5: '#ccffff',
        ultralight: '#ffffff'
    };

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        const metaTheme = document.getElementById('meta-theme-color');
        if (metaTheme) metaTheme.setAttribute('content', THEMES[theme] || '#ccffcc');
        localStorage.setItem('sg-cp-theme', theme);
        // update active swatch
        document.querySelectorAll('.theme-swatch').forEach(el => {
            el.classList.toggle('active', el.dataset.theme === theme);
        });
    }

    function init() {
        const saved = localStorage.getItem('sg-cp-theme') || 'classic';
        applyTheme(saved);

        // Theme modal open
        document.getElementById('btn-theme').addEventListener('click', () => {
            document.getElementById('theme-modal').removeAttribute('hidden');
        });

        // Close theme modal
        document.getElementById('btn-close-theme').addEventListener('click', () => {
            document.getElementById('theme-modal').setAttribute('hidden', '');
        });

        // Overlay click closes theme modal
        document.getElementById('theme-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('theme-modal')) {
                document.getElementById('theme-modal').setAttribute('hidden', '');
            }
        });

        // Swatch clicks
        document.getElementById('theme-grid').addEventListener('click', (e) => {
            const swatch = e.target.closest('.theme-swatch');
            if (!swatch) return;
            applyTheme(swatch.dataset.theme);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();