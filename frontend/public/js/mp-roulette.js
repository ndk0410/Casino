// mp-roulette.js - Multiplayer logic for Roulette

window.MP_Roulette = {
    isMultiplayer: false,
    isHost: false,
    roomId: null,
    roomRef: null,
    lastSpinId: null,

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');
        
        if (!this.roomId || !Account.uid) return; // Solo mode

        console.log("Multiplayer Roulette mode active. Room:", this.roomId);
        this.isMultiplayer = true;
        this.roomRef = db.ref('rooms/' + this.roomId);
        
        // Load room data
        const snapshot = await this.roomRef.once('value');
        const roomData = snapshot.val();
        
        if (!roomData) {
            alert("Phòng không tồn tại!");
            window.location.href = 'lobby.html';
            return;
        }

        this.isHost = (Account.uid === roomData.host);
        
        // Setup UI for Host vs Guest
        this.setupUI();
        
        // Listen to Spin State
        this.listenToState();
    },

    setupUI() {
        const spinBtn = document.getElementById('btn-spin');
        
        // Add a waiting banner for guests
        const messageEl = document.getElementById('rl-message');
        
        if (this.isHost) {
            spinBtn.style.display = 'inline-block';
            messageEl.textContent = '👑 Bạn là Chủ Phòng. Hãy bấm QUAY khi mọi người đặt cược xong!';
        } else {
            spinBtn.style.display = 'none';
            messageEl.textContent = '⏳ Đang chờ Chủ Phòng quay... Hãy đặt cược!';
        }
    },

    async broadcastSpin(number, index) {
        if (!this.isHost) return;
        
        // Generate a unique spin ID so clients know it's a new spin
        const spinId = Date.now().toString();
        
        await this.roomRef.child('state/spin').set({
            id: spinId,
            number: number,
            index: index,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    },

    listenToState() {
        this.roomRef.child('state/spin').on('value', (snapshot) => {
            const spinData = snapshot.val();
            if (!spinData || !spinData.id) return;
            
            // Prevent duplicate spins
            if (this.lastSpinId === spinData.id) return;
            
            // Optional: prevent triggering on load if spin is too old (e.g. > 30s)
            const now = Date.now();
            // Note: spinData.timestamp might be a little un-sync initially with local time,
            // but spinId uniqueness handles the duplicates primarily.
            if (spinData.timestamp && now - spinData.timestamp > 30000) return;
            
            this.lastSpinId = spinData.id;

            // Execute spin
            RouletteUI.executeSpin(spinData.number, spinData.index);
        });
    }
};

// Hook into DOM loaded to init multiplayer overrides
document.addEventListener('DOMContentLoaded', () => {
    // Small timeout to ensure roulette.js has loaded and init'd Account
    setTimeout(() => {
        if (window.MP_Roulette) {
            MP_Roulette.init();
        }
    }, 100);
});
