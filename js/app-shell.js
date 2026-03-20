// ============================================================
// app-shell.js - Shared page motion, transitions and micro FX
// ============================================================

(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function ready() {
        document.body.classList.add('app-ready');

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready, { once: true });
    } else {
        ready();
    }
})();
