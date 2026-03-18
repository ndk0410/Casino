// ============================================================
// roulette.js - Roulette Game Logic
// ============================================================

const ROULETTE_NUMBERS = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36,
    11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9,
    22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMBERS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

function isRed(n) { return RED_NUMBERS.includes(n); }
function isBlack(n) { return BLACK_NUMBERS.includes(n); }

const Roulette = {
    bets: [], // [{type, value, amount}]
    result: null,
    spinning: false,
    history: [],

    addBet(type, value, amount) {
        const existing = this.bets.find(b => b.type === type && b.value === value);
        if (existing) {
            existing.amount += amount;
        } else {
            this.bets.push({ type, value, amount });
        }
    },

    clearBets() {
        this.bets = [];
    },

    totalBets() {
        return this.bets.reduce((sum, b) => sum + b.amount, 0);
    },

    spin() {
        const idx = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
        this.result = ROULETTE_NUMBERS[idx];
        this.history.unshift(this.result);
        if (this.history.length > 20) this.history.pop();
        return { number: this.result, index: idx };
    },

    calculateWinnings() {
        const n = this.result;
        let totalWin = 0;

        this.bets.forEach(bet => {
            let payout = 0;
            switch (bet.type) {
                case 'straight':
                    if (bet.value === n) payout = bet.amount * 35;
                    break;
                case 'red':
                    if (isRed(n)) payout = bet.amount;
                    break;
                case 'black':
                    if (isBlack(n)) payout = bet.amount;
                    break;
                case 'odd':
                    if (n > 0 && n % 2 === 1) payout = bet.amount;
                    break;
                case 'even':
                    if (n > 0 && n % 2 === 0) payout = bet.amount;
                    break;
                case '1-18':
                    if (n >= 1 && n <= 18) payout = bet.amount;
                    break;
                case '19-36':
                    if (n >= 19 && n <= 36) payout = bet.amount;
                    break;
                case 'dozen1':
                    if (n >= 1 && n <= 12) payout = bet.amount * 2;
                    break;
                case 'dozen2':
                    if (n >= 13 && n <= 24) payout = bet.amount * 2;
                    break;
                case 'dozen3':
                    if (n >= 25 && n <= 36) payout = bet.amount * 2;
                    break;
                case 'col1':
                    if (n > 0 && n % 3 === 1) payout = bet.amount * 2;
                    break;
                case 'col2':
                    if (n > 0 && n % 3 === 2) payout = bet.amount * 2;
                    break;
                case 'col3':
                    if (n > 0 && n % 3 === 0) payout = bet.amount * 2;
                    break;
            }
            totalWin += (payout > 0) ? (payout + bet.amount) : 0; // Return original bet on win
        });

        return totalWin;
    }
};

// ---- UI ----
const RouletteUI = {
    chipSize: 10,

    init() {
        this.wheelEl = document.getElementById('rl-wheel');
        this.ballEl = document.getElementById('rl-ball');
        this.messageEl = document.getElementById('rl-message');
        this.chipsEl = document.getElementById('rl-chips');
        this.historyEl = document.getElementById('rl-history');
        this.totalBetEl = document.getElementById('rl-total-bet');
        this.chipBtns = document.querySelectorAll('.premium-chip');
        this.chipBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.chipBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.chipSize = parseInt(btn.dataset.value);
            });
        });

        this.buildBoard();
        this.updateChips();
    },

    updateChips() {
        if (this.chipsEl) {
            this.chipsEl.textContent = Account.chips.toLocaleString();
        }
        if (this.totalBetEl) {
            this.totalBetEl.textContent = Roulette.totalBets().toLocaleString();
        }
    },

    buildWheel() {
        if (!this.wheelEl) return;
        this.wheelEl.innerHTML = '';
        const numSlots = ROULETTE_NUMBERS.length;
        const sliceDeg = 360 / numSlots;

        let gradientStops = [];

        ROULETTE_NUMBERS.forEach((num, i) => {
            let color = '#2c3e50'; // black
            if (num === 0) color = '#27ae60'; // green
            else if (isRed(num)) color = '#c0392b'; // red

            const start = i * sliceDeg;
            const end = (i + 1) * sliceDeg;
            gradientStops.push(`${color} ${start}deg ${end}deg`);

            const numWrap = document.createElement('div');
            numWrap.className = 'rl-number-wrap';
            numWrap.style.transform = `rotate(${i * sliceDeg}deg)`;
            
            const numEl = document.createElement('div');
            numEl.className = 'rl-number';
            numEl.textContent = num;

            numWrap.appendChild(numEl);
            this.wheelEl.appendChild(numWrap);
        });

        const offset = - (sliceDeg / 2);
        this.wheelEl.style.background = `conic-gradient(from ${offset}deg, ${gradientStops.join(', ')})`;
    },

    buildBoard() {
        const board = document.getElementById('rl-board');
        if (!board) return;
        board.innerHTML = '';

        const zero = document.createElement('div');
        zero.className = 'rl-cell rl-zero';
        zero.textContent = '0';
        zero.addEventListener('click', () => this.placeBet('straight', 0));
        board.appendChild(zero);

        for (let row = 0; row < 12; row++) {
            for (let col = 2; col >= 0; col--) {
                const n = row * 3 + col + 1;
                const cell = document.createElement('div');
                cell.className = `rl-cell ${isRed(n) ? 'rl-red' : 'rl-black'}`;
                cell.textContent = n;
                cell.addEventListener('click', () => this.placeBet('straight', n));
                board.appendChild(cell);
            }
        }

        const bottomBets = [
            { label: '1st 12', type: 'dozen1' },
            { label: '2nd 12', type: 'dozen2' },
            { label: '3rd 12', type: 'dozen3' },
            { label: '1-18', type: '1-18' },
            { label: 'CHẴN', type: 'even' },
            { label: '🔴', type: 'red' },
            { label: '⚫', type: 'black' },
            { label: 'LẺ', type: 'odd' },
            { label: '19-36', type: '19-36' }
        ];

        const bottomRow = document.createElement('div');
        bottomRow.className = 'rl-bottom-bets';
        bottomBets.forEach(({label, type}) => {
            const btn = document.createElement('div');
            btn.className = 'rl-bet-cell';
            if (type === 'red') btn.classList.add('rl-red');
            if (type === 'black') btn.classList.add('rl-black');
            btn.textContent = label;
            btn.addEventListener('click', () => this.placeBet(type, null));
            bottomRow.appendChild(btn);
        });
        board.appendChild(bottomRow);
    },

    placeBet(type, value) {
        if (Roulette.spinning) return;
        
        const totalNow = Roulette.totalBets();
        if (totalNow + this.chipSize > 250000) {
            this.messageEl.textContent = '⚠️ Tổng cược tối đa mỗi ván là 250,000!';
            return;
        }

        if (this.chipSize > Account.chips - totalNow) {
            this.messageEl.textContent = '⚠️ Không đủ chip!';
            return;
        }
        Roulette.addBet(type, value, this.chipSize);
        audioManager.cardSelect();
        this.updateChips();
    },

    async spin() {
        if (Roulette.spinning) return;
        if (Roulette.bets.length === 0) {
            this.messageEl.textContent = '⚠️ Chưa đặt cược!';
            return;
        }

        const { number, index } = Roulette.spin();
        await this.executeSpin(number, index);
    },

    async executeSpin(number, index) {
        if (Roulette.spinning) return;
        
        const totalBet = Roulette.totalBets();
        if (totalBet > 0) {
            await Account.deductChips(totalBet);
        }

        audioManager.shuffle();
        Roulette.spinning = true;
        this.messageEl.textContent = '🎡 Quay...';

        const degreesPerSlot = 360 / ROULETTE_NUMBERS.length;
        const targetDeg = 360 * 5 - (index * degreesPerSlot); 

        this.wheelEl.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        this.wheelEl.style.transform = `rotate(${targetDeg}deg)`;

        await this.delay(4200);

        Roulette.result = number;
        const win = Roulette.calculateWinnings();
        if (win > 0) {
            await Account.addChips(win);
            audioManager.win();
        } else {
            audioManager.lose();
        }

        const color = number === 0 ? '🟢' : isRed(number) ? '🔴' : '⚫';
        if (win > 0) {
            this.messageEl.textContent = `${color} Số ${number}! Thắng +${win.toLocaleString()} chip! 🎉`;
        } else {
            this.messageEl.textContent = `${color} Số ${number}! Thua ${totalBet.toLocaleString()} chip 😞`;
        }

        this.renderHistory();
        this.updateChips();

        Roulette.clearBets();
        Roulette.spinning = false;

        setTimeout(() => {
            if (this.wheelEl) {
                this.wheelEl.style.transition = 'none';
                this.wheelEl.style.transform = 'rotate(0deg)';
            }
        }, 500);
    },

    clearBets() {
        if (Roulette.spinning) return;
        Roulette.clearBets();
        this.updateChips();
        this.messageEl.textContent = '🗑️ Đã xóa tất cả cược';
    },

    renderHistory() {
        if (!this.historyEl) return;
        this.historyEl.innerHTML = '';
        Roulette.history.forEach(n => {
            const el = document.createElement('span');
            el.className = `rl-history-num ${n === 0 ? 'rl-green' : isRed(n) ? 'rl-red' : 'rl-black'}`;
            el.textContent = n;
            this.historyEl.appendChild(el);
        });
    },

    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
};

document.addEventListener('DOMContentLoaded', () => {
    Account.loadData && Account.loadData();
    RouletteUI.init();
});
