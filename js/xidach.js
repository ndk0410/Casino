// ============================================================
// xidach.js - Xì Dách (Blackjack) Game Logic
// ============================================================

// Card values for Xì Dách
function getCardValue(card) {
    if (['j', 'q', 'k'].includes(card.rank)) return 10;
    if (card.rank === 'a') return 11; // Will handle soft ace below
    return parseInt(card.rank);
}

function getHandTotal(hand) {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
        const val = getCardValue(card);
        total += val;
        if (card.rank === 'a') aces++;
    }
    // Convert Aces from 11 to 1 if bust
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function isBust(hand) { return getHandTotal(hand) > 21; }
function isBlackjack(hand) {
    return hand.length === 2 &&
        getHandTotal(hand) === 21;
}
function isFiveCard(hand) {
    return hand.length === 5 && !isBust(hand);
}

// ---- Game State ----
const XiDach = {
    deck: [],
    playerHand: [],
    dealerHand: [],
    bet: 0,
    phase: 'bet', // 'bet' | 'playing' | 'dealer' | 'result'
    message: '',
    result: '',       // 'win' | 'lose' | 'push' | 'blackjack' | 'fivecard'
    resultBonus: 1,   // multiplier

    buildDeck() {
        const deck = new Deck();
        deck.shuffle();
        this.deck = deck.cards;
    },

    drawCard() {
        if (this.deck.length === 0) this.buildDeck();
        return this.deck.pop();
    },

    deal() {
        this.buildDeck();
        this.playerHand = [this.drawCard(), this.drawCard()];
        this.dealerHand = [this.drawCard(), this.drawCard()];
        this.phase = 'playing';
        this.result = '';
        this.message = '';

        // Check immediate blackjack
        const playerBJ = isBlackjack(this.playerHand);
        const dealerBJ = isBlackjack(this.dealerHand);

        if (playerBJ || dealerBJ) {
            this.phase = 'result';
            if (playerBJ && dealerBJ) {
                this.result = 'push';
                this.message = '🤝 Cả hai cùng xì dách! Hòa!';
                this.resultBonus = 1;
            } else if (playerBJ) {
                this.result = 'blackjack';
                this.message = '🎉 XÌ DÁCH! Bạn thắng 1.5x!';
                this.resultBonus = 1.5;
                this.resolveResult();
            } else {
                this.result = 'lose';
                this.message = '💀 Dealer xì dách! Bạn thua!';
                this.resultBonus = 1;
                this.resolveResult();
            }
            xidachUI.render();
            return;
        }

        xidachUI.render();
    },

    hit() {
        if (this.phase !== 'playing') return;
        this.playerHand.push(this.drawCard());

        if (isFiveCard(this.playerHand)) {
            this.message = '🌟 NGŨ LINH! Bạn thắng 2x!';
            this.result = 'ngulinh';
            this.resultBonus = 2;
            this.phase = 'result';
            this.resolveResult();
            xidachUI.render();
            return;
        }

        if (isBust(this.playerHand)) {
            this.message = '💥 Quá 21! Bạn thua!';
            this.result = 'lose';
            this.resultBonus = 1;
            this.phase = 'result';
            this.resolveResult();
            xidachUI.render();
            return;
        }

        if (getHandTotal(this.playerHand) === 21) {
            // Auto-stand at 21
            this.stand();
            return;
        }

        xidachUI.render();
    },

    stand() {
        if (this.phase !== 'playing') return;
        this.phase = 'dealer';
        xidachUI.render();

        // Dealer draws with delay
        this.dealerPlay();
    },

    async doubleDown() {
        if (this.phase !== 'playing' || this.playerHand.length !== 2) return;
        if (Account.chips < this.bet) {
            xidachUI.showMessage('Không đủ chip để nhân đôi!');
            return;
        }
        await Account.deductChips(this.bet);
        this.bet *= 2;
        this.playerHand.push(this.drawCard());
        xidachUI.render();

        if (isBust(this.playerHand)) {
            this.message = '💥 Quá 21! Bạn thua!';
            this.result = 'lose';
            this.resultBonus = 1;
            this.phase = 'result';
            this.resolveResult();
            xidachUI.render();
        } else {
            this.stand();
        }
    },

    dealerPlay() {
        // Dealer hits until >= 17
        const dealerStep = () => {
            const total = getHandTotal(this.dealerHand);
            if (total < 17) {
                this.dealerHand.push(this.drawCard());
                xidachUI.render();
                setTimeout(dealerStep, 700);
            } else {
                this.resolveStand();
            }
        };
        setTimeout(dealerStep, 700);
    },

    resolveStand() {
        const playerTotal = getHandTotal(this.playerHand);
        const dealerTotal = getHandTotal(this.dealerHand);
        this.phase = 'result';

        if (isBust(this.dealerHand)) {
            this.result = 'win';
            this.message = `🎉 Dealer bốc (${dealerTotal})! Bạn thắng!`;
            this.resultBonus = 1;
        } else if (playerTotal > dealerTotal) {
            this.result = 'win';
            this.message = `🎉 ${playerTotal} > ${dealerTotal}! Bạn thắng!`;
            this.resultBonus = 1;
        } else if (playerTotal < dealerTotal) {
            this.result = 'lose';
            this.message = `😞 ${playerTotal} < ${dealerTotal}! Bạn thua!`;
            this.resultBonus = 1;
        } else {
            this.result = 'push';
            this.message = `🤝 Hòa ${playerTotal}!`;
            this.resultBonus = 1;
        }

        this.resolveResult();
        xidachUI.render();
    },

    async resolveResult() {
        if (this.result === 'win' || this.result === 'blackjack' || this.result === 'ngulinh') {
            await Account.addChips(Math.floor(this.bet * (1 + this.resultBonus)));
        } else if (this.result === 'push') {
            await Account.addChips(this.bet); // Return bet
        }
        // lose: bet already deducted
        xidachUI.updateChipDisplay();
    },

    async placeBet(amount) {
        if (this.phase !== 'bet') return;
        if (Account.chips < amount) {
            xidachUI.showMessage('Không đủ chip!');
            return;
        }
        this.bet += amount;
        await Account.deductChips(amount);
        xidachUI.updateBetDisplay();
        xidachUI.updateChipDisplay();
    },

    async clearBet() {
        if (this.phase !== 'bet') return;
        await Account.addChips(this.bet);
        this.bet = 0;
        xidachUI.updateBetDisplay();
        xidachUI.updateChipDisplay();
    },

    newRound() {
        this.bet = 0;
        this.phase = 'bet';
        this.playerHand = [];
        this.dealerHand = [];
        this.result = '';
        this.message = '';
        xidachUI.render();
    }
};

// ---- UI ----
const xidachUI = {
    init() {
        this.dealerHandEl = document.getElementById('dealer-hand');
        this.playerHandEl = document.getElementById('player-hand-xd');
        this.dealerScoreEl = document.getElementById('dealer-score');
        this.playerScoreEl = document.getElementById('player-score');
        this.chipsEl = document.getElementById('chips-display');
        this.betEl = document.getElementById('bet-display');
        this.messageEl = document.getElementById('xd-message');
        this.btnDeal = document.getElementById('btn-deal');
        this.btnHit = document.getElementById('btn-hit');
        this.btnStand = document.getElementById('btn-stand');
        this.btnDouble = document.getElementById('btn-double');
        this.btnNewRound = document.getElementById('btn-new-round');
        this.btnClearBet = document.getElementById('btn-clear-bet');
        this.resultOverlay = document.getElementById('result-overlay');
        this.resultMsg = document.getElementById('result-msg');
        this.bindEvents();
    },

    bindEvents() {
        this.btnDeal.addEventListener('click', () => {
            if (XiDach.bet === 0) { this.showMessage('Hãy đặt cược trước!'); return; }
            XiDach.deal();
            audioManager.shuffle();
        });
        this.btnHit.addEventListener('click', () => { XiDach.hit(); audioManager.cardPlay(); });
        this.btnStand.addEventListener('click', () => { XiDach.stand(); audioManager.pass(); });
        this.btnDouble.addEventListener('click', () => { XiDach.doubleDown(); audioManager.cardSlam(); });
        this.btnNewRound.addEventListener('click', () => { XiDach.newRound(); this.hideResult(); });
        this.btnClearBet.addEventListener('click', () => XiDach.clearBet());

        // Chip buttons
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount);
                XiDach.placeBet(amount);
                audioManager.cardSelect();
            });
        });
    },

    render() {
        this.renderHand(this.dealerHandEl, XiDach.dealerHand, XiDach.phase === 'playing');
        this.renderHand(this.playerHandEl, XiDach.playerHand, false);
        this.updateScores();
        this.updateControls();
        this.updateChipDisplay();
        this.updateBetDisplay();

        if (XiDach.phase === 'result' && XiDach.message) {
            this.showResult(XiDach.message, XiDach.result);
        }

        if (XiDach.message && XiDach.phase !== 'result') {
            this.showMessage(XiDach.message);
        }
    },

    renderHand(container, hand, hideSecond) {
        container.innerHTML = '';
        hand.forEach((card, i) => {
            const el = document.createElement('div');
            el.className = 'xd-card';
            el.style.animationDelay = `${i * 0.1}s`;

            const img = document.createElement('img');
            if (hideSecond && i === 1) {
                img.src = '../assets/cards/back.png';
                img.alt = '?';
            } else {
                img.src = card.imagePath;
                img.alt = card.displayName;
            }
            img.draggable = false;
            el.appendChild(img);
            container.appendChild(el);
        });
    },

    updateScores() {
        const playerTotal = getHandTotal(XiDach.playerHand);
        const dealerTotal = getHandTotal(XiDach.dealerHand);

        this.playerScoreEl.textContent = XiDach.playerHand.length > 0 ? playerTotal : '-';
        this.dealerScoreEl.textContent = XiDach.dealerHand.length > 0
            ? (XiDach.phase === 'playing'
                ? getCardValue(XiDach.dealerHand[0])
                : dealerTotal)
            : '-';

        // Color coding
        this.playerScoreEl.className = 'score-badge ' + (
            playerTotal > 21 ? 'bust' :
            playerTotal === 21 ? 'blackjack' :
            playerTotal >= 18 ? 'good' : ''
        );
    },

    updateControls() {
        const isBetting = XiDach.phase === 'bet';
        const isPlaying = XiDach.phase === 'playing';
        const isResult = XiDach.phase === 'result';

        this.btnDeal.style.display = isBetting ? 'block' : 'none';
        this.btnClearBet.style.display = isBetting ? 'block' : 'none';
        document.querySelector('.chip-btns').style.display = isBetting ? 'flex' : 'none';

        this.btnHit.style.display = isPlaying ? 'block' : 'none';
        this.btnStand.style.display = isPlaying ? 'block' : 'none';
        this.btnDouble.style.display = (isPlaying && XiDach.playerHand.length === 2) ? 'block' : 'none';

        this.btnNewRound.style.display = isResult ? 'block' : 'none';
    },

    updateChipDisplay() {
        this.chipsEl.textContent = Account.chips.toLocaleString();
    },

    updateBetDisplay() {
        this.betEl.textContent = XiDach.bet.toLocaleString();
    },

    showMessage(text) {
        this.messageEl.textContent = text;
        this.messageEl.classList.add('show');
        setTimeout(() => this.messageEl.classList.remove('show'), 2500);
    },

    showResult(text, type) {
        this.resultOverlay.classList.add('show');
        const cls = (type === 'win' || type === 'blackjack' || type === 'ngulinh') ? 'result-win' : 
                     type === 'push' ? 'result-push' : 'result-lose';
        this.resultMsg.className = cls;
        this.resultMsg.textContent = text;
        if (type === 'win' || type === 'blackjack' || type === 'ngulinh') {
            audioManager.win();
        } else if (type === 'lose') {
            audioManager.lose();
        }
    },

    hideResult() {
        this.resultOverlay.classList.remove('show');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    xidachUI.init();
    xidachUI.updateChipDisplay();
    xidachUI.updateBetDisplay();
    xidachUI.updateControls();

    // Listen for global account updates
    window.addEventListener('accountUpdated', () => {
        xidachUI.updateChipDisplay();
    });
});
