/* ============================================================
   orientation.js - Landscape Mode Enforcement Logic
   ============================================================ */

(function() {
    function initOrientationOverlay() {
        if (document.getElementById('orientation-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'orientation-overlay';
        overlay.innerHTML = `
            <div class="rotate-icon"></div>
            <div class="orientation-title">Vui lòng xoay ngang</div>
            <div class="orientation-msg">Vui lòng xoay ngang màn hình để có trải nghiệm chơi game tốt nhất.</div>
        `;
        document.body.appendChild(overlay);
    }

    // Initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOrientationOverlay);
    } else {
        initOrientationOverlay();
    }
})();
