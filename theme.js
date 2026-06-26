/* ============================================================
   BORNE FARMS — Theme Controller
   - Applies saved/system theme before paint (no flash).
   - Swaps the hero image between day (light) and night (dark).
   - The appearance control (pill light/dark toggle + accent
     colors) is shown ONLY to mobile-app users, for ease of use.
     Landing & desktop simply follow the saved/system theme.
   ============================================================ */
(function () {
    var STORE_THEME = 'borne-theme';
    var STORE_ACCENT = 'borne-accent';
    var ACCENTS = [
        { key: 'midnight', name: 'Midnight', p: '#5079d8', s: '#37b6c2' },
        { key: 'sunset',   name: 'Sunset',   p: '#ef7d2e', s: '#f3b53c' },
        { key: 'slate',    name: 'Slate',    p: '#4d80e0', s: '#7d8aa6' },
        { key: 'emerald',  name: 'Emerald',  p: '#1aa86d', s: '#84c54f' },
        { key: 'violet',   name: 'Violet',   p: '#7c5ce0', s: '#d06bb0' },
        { key: 'heritage', name: 'Heritage', p: '#a0724a', s: '#5fa052' }
    ];
    var SVG = {
        sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
        moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>'
    };

    var root = document.documentElement;
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    var storedTheme = localStorage.getItem(STORE_THEME);
    var theme = storedTheme || (systemDark && systemDark.matches ? 'dark' : (systemDark ? 'light' : 'dark'));
    var accent = localStorage.getItem(STORE_ACCENT) || 'midnight';

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);

    function setMeta() {
        var m = document.querySelector('meta[name="theme-color"]');
        if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
        m.content = theme === 'light' ? '#f4f7fc' : '#060c1d';
    }
    function swapHeroImages() {
        var imgs = document.querySelectorAll('img[data-img-light][data-img-dark]');
        for (var i = 0; i < imgs.length; i++) {
            var want = imgs[i].getAttribute(theme === 'light' ? 'data-img-light' : 'data-img-dark');
            if (want && imgs[i].getAttribute('src') !== want) imgs[i].setAttribute('src', want);
        }
    }
    setMeta(); 
    if (document.readyState !== 'loading') swapHeroImages();

    function applyTheme(t) {
        theme = t; root.setAttribute('data-theme', t);
        localStorage.setItem(STORE_THEME, t);
        setMeta(); swapHeroImages(); syncUI();
    }
    function applyAccent(a) {
        accent = a; root.setAttribute('data-accent', a);
        localStorage.setItem(STORE_ACCENT, a); syncUI();
    }
    window.BorneTheme = { setTheme: applyTheme, setAccent: applyAccent };

    // follow system changes only while the user hasn't picked manually
    if (systemDark && systemDark.addEventListener) {
        systemDark.addEventListener('change', function (e) {
            if (!localStorage.getItem(STORE_THEME)) applyTheme(e.matches ? 'dark' : 'light');
        });
    }

    var dock;
    function syncUI() {
        if (!dock) return;
        dock.classList.toggle('is-dark', theme === 'dark');
        var dots = dock.querySelectorAll('.accent-dot');
        for (var i = 0; i < dots.length; i++) {
            dots[i].classList.toggle('active', dots[i].dataset.accent === accent);
        }
    }

    function isMobileApp() {
        var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                         window.navigator.standalone === true;
        var small = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        return standalone || small;
    }

    function buildControl() {
        // The light/dark pill toggle is available everywhere.
        // The accent COLOUR dots are only for mobile-app users
        // (installed PWA / small screens) to keep the web view clean.
        var isApp = !!document.querySelector('.sidebar');
        var showAccents = isApp && isMobileApp();

        dock = document.createElement('div');
        dock.className = 'theme-dock';

        var accentsHtml = '';
        if (showAccents) {
            var dots = ACCENTS.map(function (a) {
                return '<button class="accent-dot" data-accent="' + a.key + '" title="' + a.name +
                    '" style="background:linear-gradient(135deg,' + a.p + ' 0 50%,' + a.s + ' 50% 100%)"></button>';
            }).join('');
            accentsHtml = '<div class="theme-accents">' + dots + '</div>';
        }

        dock.innerHTML = accentsHtml +
            '<button class="theme-pill" role="switch" aria-label="Toggle dark mode">' +
                '<span class="tp-ico tp-sun">' + SVG.sun + '</span>' +
                '<span class="tp-ico tp-moon">' + SVG.moon + '</span>' +
                '<span class="tp-knob"></span>' +
            '</button>';

        document.body.appendChild(dock);

        dock.querySelector('.theme-pill').addEventListener('click', function () {
            applyTheme(theme === 'dark' ? 'light' : 'dark');
        });
        dock.querySelectorAll('.accent-dot').forEach(function (d) {
            d.addEventListener('click', function () { applyAccent(d.dataset.accent); });
        });

        syncUI();
    }

    function init() { swapHeroImages(); buildControl(); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})();
