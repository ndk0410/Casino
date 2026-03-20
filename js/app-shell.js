// ============================================================
// app-shell.js - Shared page motion, transitions and micro FX
// ============================================================

(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function normalizeLocalLinks() {
        if (window.location.protocol !== 'file:') {
            return;
        }

        document.querySelectorAll('a[href]').forEach((anchor) => {
            const rawHref = anchor.getAttribute('href');
            if (!rawHref || rawHref.startsWith('http') || rawHref.startsWith('#') || rawHref.startsWith('mailto:')) {
                return;
            }

            if (rawHref === '../' || rawHref === './' || rawHref === '/') {
                anchor.setAttribute('href', '../index.html');
                return;
            }

            if (!rawHref.endsWith('.html') && !rawHref.includes('?') && !rawHref.includes('.')) {
                anchor.setAttribute('href', `${rawHref}.html`);
                return;
            }

            if (rawHref.includes('?')) {
                const [path, query] = rawHref.split('?');
                if (path && !path.endsWith('.html') && !path.includes('.')) {
                    anchor.setAttribute('href', `${path}.html?${query}`);
                }
            }
        });
    }

    function ready() {
        document.body.classList.add('app-ready');
        normalizeLocalLinks();

        if (prefersReducedMotion) {
            return;
        }

        const shellTargets = document.querySelectorAll(
            '.premium-bet-panel, .premium-bet-card, .slots-container, .xd-table, .game-container, .rl-game, .mb-game, .bl-table, .pk-table, .games-grid, .login-box, .user-panel'
        );
        shellTargets.forEach((el, index) => {
            el.setAttribute('data-shell-card', '');
            el.style.setProperty('--shell-delay', `${Math.min(index * 60, 360)}ms`);
        });

        const interactive = document.querySelectorAll('button, .premium-chip, .game-card, a');
        interactive.forEach((el) => {
            el.addEventListener('mouseenter', () => {
                if (!prefersReducedMotion && window.audioManager && el.matches('button, .premium-chip')) {
                    audioManager.cardSelect();
                }
            }, { passive: true });

            el.addEventListener('click', () => {
                if (!prefersReducedMotion) {
                    document.body.classList.add('app-page-leaving');
                    setTimeout(() => document.body.classList.remove('app-page-leaving'), 220);
                }
            }, { passive: true });
        });

        const gameCards = document.querySelectorAll('.game-card');
        gameCards.forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const px = (event.clientX - rect.left) / rect.width;
                const py = (event.clientY - rect.top) / rect.height;
                const rotateY = (px - 0.5) * 8;
                const rotateX = (0.5 - py) * 10;
                card.style.transform = `translateY(-12px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
            });

            card.addEventListener('pointerleave', () => {
                card.style.transform = '';
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready, { once: true });
    } else {
        ready();
    }
})();
