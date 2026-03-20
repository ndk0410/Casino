// ============================================================
// slots.js - Slot Machine Game Logic
// ============================================================

// Symbol Definitions
// The payout order is: Eggplant < Heart < Cherry < Cash < O/W (Jackpot)
const SYMBOLS = [
    { id: 'eggplant', img: '../assets/slots/SlotsEggplant.png', name: 'Cà Tím', type: 'normal' },
    { id: 'heart', img: '../assets/slots/SlotsHeart.png', name: 'Trái Tim', type: 'normal' },
    { id: 'cherry', img: '../assets/slots/SlotsCherry.png', name: 'Cherry', type: 'normal' },
    { id: 'cash', img: '../assets/slots/SlotsCash.png', name: 'Tiền', type: 'normal' },
    { id: 'o', img: '../assets/slots/SlotsO.png', name: 'Chữ O', type: 'special' },
    { id: 'w', img: '../assets/slots/SlotsW.png', name: 'Chữ W', type: 'special' }
];

// Configuration for reel strips to make them look infinite when spinning
const SYMBOLS_PER_REEL = 30; 
const VISIBLE_SYMBOLS = 3;
const SYMBOL_SIZE = 100; // Expected height per symbol in px

const slotsGame = {
    bet: 50,
    minBet: 50,
    maxBetAmount: 500,
    isSpinning: false,

    // Sync with global account
    sync() {
        this.updateDisplay();
    },
    
    // The final result symbols for the middle line
    resultIds: [],
    
    // DOM Elements
    init() {
        this.elements = {
            strips: [
                document.getElementById('strip-0'),
                document.getElementById('strip-1'),
                document.getElementById('strip-2')
            ],
            reels: [
                document.getElementById('reel-0'),
                document.getElementById('reel-1'),
                document.getElementById('reel-2')
            ],
            btnSpin: document.getElementById('btn-spin'),
            chips: document.getElementById('chips-display'),
            bet: document.getElementById('bet-display'),
            message: document.getElementById('message-banner'),
            winOverlay: document.getElementById('win-overlay'),
            winText: document.getElementById('win-text'),
            winAmountTxt: document.getElementById('win-amount-val'),
            wrapper: document.querySelector('.slots-container')
        };

        this.updateDisplay();
        this.setupReels();
        this.setInitialView();
        
        // Listen for account changes
        window.addEventListener('accountUpdated', () => this.sync());
        
        // Key events
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.spin();
            if (e.key === ' ' && !this.isSpinning) {
                e.preventDefault();
                this.spin();
            }
        });
    },

    changeBet(amount) {
        if (this.isSpinning) return;
        this.bet += amount;
        if (this.bet < this.minBet) this.bet = this.minBet;
        if (this.bet > this.maxBetAmount) this.bet = this.maxBetAmount;
        if (this.bet > Account.chips) this.bet = Account.chips;
        if (this.bet < this.minBet) this.bet = this.minBet;
        this.updateDisplay();
        this.playSound('click');
    },

    setMaxBet() {
        if (this.isSpinning) return;
        this.bet = Math.min(this.maxBetAmount, Math.max(this.minBet, Account.chips));
        this.updateDisplay();
        this.playSound('click');
    },

    updateDisplay() {
        if (this.elements.chips) this.elements.chips.textContent = Account.chips.toLocaleString();
        if (this.elements.bet) this.elements.bet.textContent = this.bet.toLocaleString();
    },

    showMessage(text, type = 'normal') {
        if (!this.elements.message) return;
        this.elements.message.textContent = text;
        this.elements.message.style.color = type === 'win' ? 'var(--gold)' : 
                                            type === 'error' ? 'var(--danger)' : 'var(--accent)';
    },

    // Generates a random strip of symbols
    generateStrip() {
        const strip = [];
        for (let i = 0; i < SYMBOLS_PER_REEL; i++) {
            const rand = Math.random();
            let sym;
            if (rand < 0.3) sym = SYMBOLS[0]; // Eggplant 30%
            else if (rand < 0.55) sym = SYMBOLS[1]; // Heart 25%
            else if (rand < 0.75) sym = SYMBOLS[2]; // Cherry 20%
            else if (rand < 0.85) sym = SYMBOLS[3]; // Cash 10%
            else if (rand < 0.92) sym = SYMBOLS[4]; // O 7%
            else sym = SYMBOLS[5]; // W 8%
            strip.push(sym);
        }
        return strip;
    },

    renderStripHTML(strip) {
        return strip.map(s => `<div class="symbol"><img src="${s.img}" alt="${s.id}"></div>`).join('');
    },

    setInitialView() {
        for (let i = 0; i < 3; i++) {
            const initialStrip = [SYMBOLS[0], SYMBOLS[2], SYMBOLS[4], SYMBOLS[1]];
            if (this.elements.strips[i]) {
                this.elements.strips[i].innerHTML = this.renderStripHTML(initialStrip);
                this.elements.strips[i].style.transform = `translateY(0px)`;
            }
        }
    },

    setupReels() {
    },

    async spin() {
        if (this.isSpinning) return;
        if (Account.chips < this.bet) {
            this.showMessage("Vui lòng nạp thêm tiền!", "error");
            this.playSound('error');
            return;
        }

        const success = await Account.deductChips(this.bet);
        if (!success) {
            this.showMessage("Không đủ chip để quay!", "error");
            this.playSound('error');
            return;
        }
        this.updateDisplay();
        this.isSpinning = true;
        this.elements.btnSpin.disabled = true;
        this.elements.wrapper.classList.remove('play-win');
        this.showMessage("Đang quay...", "normal");
        
        this.playSound('shuffle');

        const stripsData = [this.generateStrip(), this.generateStrip(), this.generateStrip()];
        
        this.resultIds = [
            stripsData[0][SYMBOLS_PER_REEL - 2].id,
            stripsData[1][SYMBOLS_PER_REEL - 2].id,
            stripsData[2][SYMBOLS_PER_REEL - 2].id
        ];

        const spinDurationBase = 2500;
        const reelOrder = [0, 2, 1]; // Left, Right, Center
        const delayBetweenStops = 600;

        for (let idx = 0; idx < 3; idx++) {
            const i = idx;
            const stripEl = this.elements.strips[i];
            const reelEl = this.elements.reels[i];
            
            stripEl.innerHTML = this.renderStripHTML(stripsData[i]);
            stripEl.style.transition = 'none';
            stripEl.style.transform = `translateY(0px)`;
            
            reelEl.classList.add('spinning');
            void stripEl.offsetWidth;

            const finalY = -1 * (SYMBOLS_PER_REEL - 3) * SYMBOL_SIZE;
            const stopOrderIndex = reelOrder.indexOf(i);
            const duration = spinDurationBase + (stopOrderIndex * delayBetweenStops);

            setTimeout(() => {
                stripEl.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.85, 0.35, 1.05)`;
                stripEl.style.transform = `translateY(${finalY}px)`;
            }, 50);

            setTimeout(() => {
                reelEl.classList.remove('spinning');
                this.playSound('cardPlay');
                
                if (stopOrderIndex === 2) {
                    setTimeout(() => this.checkResult(), 300);
                }
            }, duration + 50);
        }
    },

    async checkResult() {
        this.isSpinning = false;
        this.elements.btnSpin.disabled = false;

        const [r1, r2, r3] = this.resultIds;
        let winMultiplier = 0;
        let winType = '';

        if (r1 === 'o' && r2 === 'w' && r3 === 'o') {
            winMultiplier = 50;
            winType = 'JACKPOT';
        }
        else if (r1 === r2 && r2 === r3) {
            if (r1 === 'eggplant') winMultiplier = 2;
            else if (r1 === 'heart') winMultiplier = 5;
            else if (r1 === 'cherry') winMultiplier = 10;
            else if (r1 === 'cash') winMultiplier = 20;
            else if (r1 === 'o' || r1 === 'w') winMultiplier = 3; 
        }

        if (winMultiplier > 0) {
            const winAmount = this.bet * winMultiplier;
            await Account.addChips(winAmount);
            this.updateDisplay();
            
            this.elements.wrapper.classList.add('play-win');

            if (winType === 'JACKPOT' || winMultiplier >= 10) {
                this.showBigWin(winAmount, winType === 'JACKPOT');
                this.showMessage(`NỔ HŨ! +${winAmount.toLocaleString()}`, 'win');
                this.playSound('win');
            } else {
                this.showMessage(`Thắng! +${winAmount.toLocaleString()}`, 'win');
                this.playSound('cardSlam');
            }

        } else {
            this.showMessage("Chúc bạn may mắn lần sau!", "normal");
        }
    },

    showBigWin(amount, isJackpot) {
        this.elements.winText.textContent = isJackpot ? '🎰 JACKPOT 🎰' : '🌟 BIG WIN 🌟';
        this.elements.winAmountTxt.textContent = `+${amount.toLocaleString()}`;
        this.elements.winOverlay.classList.add('show');
        
        setTimeout(() => {
            this.elements.winOverlay.classList.remove('show');
        }, 3000);
    },
    
    playSound(type) {
        if (window.audioManager) {
            switch(type) {
                case 'click': audioManager.cardSelect(); break;
                case 'shuffle': audioManager.shuffle(); break;
                case 'cardPlay': audioManager.cardPlay(); break;
                case 'cardSlam': audioManager.cardSlam(); break;
                case 'win': audioManager.win(); break;
                case 'error': audioManager.error ? audioManager.error() : audioManager.lose(); break;
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    slotsGame.init();
});
