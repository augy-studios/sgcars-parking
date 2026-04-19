// ===== THEME MANAGER =====
const THEMES = {
    'classic': {
        brand: '#ccffcc',
        label: 'Classic'
    },
    'not-green-1': {
        brand: '#ffcccc',
        label: 'Not Green 1'
    },
    'not-green-2': {
        brand: '#ccccff',
        label: 'Not Green 2'
    },
    'not-green-3': {
        brand: '#ffffcc',
        label: 'Not Green 3'
    },
    'not-green-4': {
        brand: '#ffccff',
        label: 'Not Green 4'
    },
    'not-green-5': {
        brand: '#ccffff',
        label: 'Not Green 5'
    },
    'really-light': {
        brand: '#ffffff',
        label: 'Really really light green'
    },
};

const ThemeManager = (() => {
    let current = localStorage.getItem('pnc-theme') || 'classic';

    function apply(theme) {
        document.body.setAttribute('data-theme', theme);
        const meta = document.getElementById('theme-color-meta');
        if (meta) meta.setAttribute('content', THEMES[theme]?.brand || '#ccffcc');
        document.querySelectorAll('.theme-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.theme === theme);
        });
        current = theme;
        localStorage.setItem('pnc-theme', theme);
    }

    function init() {
        apply(current);

        const themeBtn = document.getElementById('theme-btn');
        const modal = document.getElementById('theme-modal');
        const backdrop = document.getElementById('theme-modal-backdrop');
        const closeBtn = document.getElementById('close-theme-modal');

        function openModal() {
            modal.classList.add('show');
            backdrop.classList.add('show');
        }

        function closeModal() {
            modal.classList.remove('show');
            backdrop.classList.remove('show');
        }

        themeBtn?.addEventListener('click', openModal);
        closeBtn?.addEventListener('click', closeModal);
        backdrop?.addEventListener('click', closeModal);

        document.querySelectorAll('.theme-swatch').forEach(s => {
            s.addEventListener('click', () => {
                apply(s.dataset.theme);
            });
        });
    }

    return {
        init,
        apply,
        get current() {
            return current;
        }
    };
})();