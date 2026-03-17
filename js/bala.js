// ============================================================
// bala.js - Ba Lá (Three Card Poker) Game Logic
// ============================================================

// Hand rankings for 3-card poker (highest to lowest)
const BA_LA_HANDS = {
    STRAIGHT_FLUSH: 6,
    THREE_OF_A_KIND: 5,
    STRAIGHT: 4,
    FLUSH: 3,
    PAIR: 2,
    HIGH_CARD: 1
};

const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'j': 11, 'q': 12, 'k': 13, 'a': 14 };

function getRankValue(rank) {
    return RANK_VALUES[rank] || 0;
}

function evaluateThreeCardHand(hand) {
    const ranks = hand.map(c => getRankValue(c.rank)).sort((a, b) => b - a);
    const suits = hand.map(c => c.suit);
    const isFlush = suits[0] === suits[1] && suits[1] === suits[2];
    const isStraight = (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) ||
        (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2); // A-2-3 low straight
    const isThreeOfAKind = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2];

    let handRank, kickers;

    if (isFlush && isStraight) {
        handRank = BA_LA_HANDS.STRAIGHT_FLUSH;
        kickers = ranks[0] === 14 && ranks[1] === 3 ? [3] : [ranks[0]]; // A-2-3 = low
    } else if (isThreeOfAKind) {
        handRank = BA_LA_HANDS.THREE_OF_A_KIND;
        kickers = [ranks[0]];
    } else if (isStraight) {
        handRank = BA_LA_HANDS.STRAIGHT;
        kickers = ranks[0] === 14 && ranks[1] === 3 ? [3] : [ranks[0]];
    } else if (isFlush) {
        handRank = BA_LA_HANDS.FLUSH;
        kickers = ranks;
    } else if (isPair) {
        handRank = BA_LA_HANDS.PAIR;
        const pairRank = ranks[0] === ranks[1] ? ranks[0] : ranks[1];
        const kicker = ranks.find(r => r !== pairRank);
        kickers = [pairRank, kicker];
    } else {
        handRank = BA_LA_HANDS.HIGH_CARD;
        kickers = ranks;
    }

    return { handRank, kickers };
}

function compareHands(a, b) {
    if (a.handRank !== b.handRank) return a.handRank - b.handRank;
    for (let i = 0; i < a.kickers.length; i++) {
        if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
    }
    return 0;
}

function getHandName(hand) {
    switch (hand.handRank) {
        case BA_LA_HANDS.STRAIGHT_FLUSH: return '🔥 Sảnh Đồng Chất';
        case BA_LA_HANDS.THREE_OF_A_KIND: return '💎 Ba Con';
        case BA_LA_HANDS.STRAIGHT: return '📐 Sảnh';
        case BA_LA_HANDS.FLUSH: return '🎨 Đồng Chất';
        case BA_LA_HANDS.PAIR: return '✌️ Đôi';
        case BA_LA_HANDS.HIGH_CARD: return '🃏 Bài Lẻ';
    }
}

// Ante bonus payouts (when player wins with strong hand)
function getAnteBonus(hand) {
    switch (hand.handRank) {
        case BA_LA_HANDS.STRAIGHT_FLUSH: return 5;
        case BA_LA_HANDS.THREE_OF_A_KIND: return 4;
        case BA_LA_HANDS.STRAIGHT: return 1;
        default: return 0;
    }
}

// Pair Plus payouts (independent side bet)
function getPairPlusPayout(hand) {
    switch (hand.handRank) {
        case BA_LA_HANDS.STRAIGHT_FLUSH: return 40;
        case BA_LA_HANDS.THREE_OF_A_KIND: return 30;
        case BA_LA_HANDS.STRAIGHT: return 6;
        case BA_LA_HANDS.FLUSH: return 3;
        case BA_LA_HANDS.PAIR: return 1;
        default: return -1; // lose pair plus bet
    }
}

// ---- Game State ----
const BaLa = {
    deck: [],
    playerHand: [],
    dealerHand: [],
    anteBet: 0,
    pairPlusBet: 0,
    phase: 'bet', // 'bet' | 'dealt' | 'result'
    message: '',
    result: '',

    buildDeck() {
        const deck = new Deck();
        deck.shuffle();
        this.deck = deck.cards;
    },

    drawCard() {
        if (this.deck.length === 0) this.buildDeck();
        return this.deck.pop();
    },

    deal(ante, pairPlus) {
        this.anteBet = ante;
        this.pairPlusBet = pairPlus || 0;
        this.buildDeck();
        this.playerHand = [this.drawCard(), this.drawCard(), this.drawCard()];
        this.dealerHand = [this.drawCard(), this.drawCard(), this.drawCard()];
        this.phase = 'dealt';
        this.result = '';
        this.message = 'Xem bài và chọn: ĐÁNH (Play) hoặc BỎ (Fold)';
    },

    fold() {
        // Player loses ante + pair plus
        this.phase = 'result';
        this.result = 'fold';
        let loss = this.anteBet;

        // Pair Plus is independent — still pay out if winning hand
        let pairPlusResult = 0;
        if (this.pairPlusBet > 0) {
            const playerEval = evaluateThreeCardHand(this.playerHand);
            const ppPayout = getPairPlusPayout(playerEval);
            if (ppPayout > 0) {
                pairPlusResult = this.pairPlusBet * ppPayout;
            } else {
                pairPlusResult = -this.pairPlusBet;
            }
        }

        const netLoss = -loss + pairPlusResult;
        this.message = `😔 Bạn bỏ bài. Mất ${loss.toLocaleString()} ante.`;
        if (pairPlusResult > 0) {
            this.message += ` Nhưng Pair Plus thắng +${pairPlusResult.toLocaleString()}!`;
        }
        return netLoss;
    },

    play() {
        this.phase = 'result';
        const playerEval = evaluateThreeCardHand(this.playerHand);
        const dealerEval = evaluateThreeCardHand(this.dealerHand);
        const dealerQualifies = dealerEval.handRank >= BA_LA_HANDS.PAIR ||
            (dealerEval.kickers[0] >= 12); // Q-high or better

        let totalWin = 0;

        // Pair Plus (independent)
        let pairPlusResult = 0;
        if (this.pairPlusBet > 0) {
            const ppPayout = getPairPlusPayout(playerEval);
            if (ppPayout > 0) {
                pairPlusResult = this.pairPlusBet * ppPayout;
            } else {
                pairPlusResult = -this.pairPlusBet;
            }
            totalWin += pairPlusResult;
        }

        if (!dealerQualifies) {
            // Dealer doesn't qualify — ante pays 1:1, play bet push
            totalWin += this.anteBet;
            this.result = 'dealer-no-qualify';
            this.message = `🤷 Dealer không đủ điều kiện (cần Q trở lên). Ante thắng +${this.anteBet.toLocaleString()}!`;
        } else {
            const cmp = compareHands(playerEval, dealerEval);
            if (cmp > 0) {
                // Player wins
                const anteBonus = getAnteBonus(playerEval);
                totalWin += this.anteBet + this.anteBet; // ante + play both pay 1:1
                if (anteBonus > 0) {
                    totalWin += this.anteBet * anteBonus;
                }
                this.result = 'win';
                const handName = getHandName(playerEval);
                this.message = `🎉 Bạn thắng! ${handName}! +${totalWin.toLocaleString()} chip`;
            } else if (cmp < 0) {
                // Dealer wins
                totalWin -= this.anteBet + this.anteBet; // lose ante + play
                this.result = 'lose';
                this.message = `😞 Dealer thắng! Mất ${(this.anteBet * 2).toLocaleString()} chip.`;
            } else {
                // Push
                this.result = 'push';
                this.message = '🤝 Hòa! Trả lại cược.';
            }
        }

        if (pairPlusResult > 0) {
            this.message += ` (Pair Plus: +${pairPlusResult.toLocaleString()})`;
        } else if (pairPlusResult < 0 && this.pairPlusBet > 0) {
            this.message += ` (Pair Plus: -${this.pairPlusBet.toLocaleString()})`;
        }

        return totalWin;
    }
};

// ---- UI ----
const BaLaUI = {
    init() {
        this.playerArea = document.getElementById('bl-player-hand');
        this.dealerArea = document.getElementById('bl-dealer-hand');
        this.messageEl = document.getElementById('bl-message');
        this.betPanel = document.getElementById('bl-bet-panel');
        this.actionPanel = document.getElementById('bl-action-panel');
        this.resultPanel = document.getElementById('bl-result-panel');
        this.anteInput = document.getElementById('bl-ante-input');
        this.ppInput = document.getElementById('bl-pp-input');
        this.chipsDisplay = document.getElementById('bl-chips');
        this.playerLabel = document.getElementById('bl-player-label');
        this.dealerLabel = document.getElementById('bl-dealer-label');

        this.updateChips();
        this.showBetPanel();
    },

    updateChips() {
        if (this.chipsDisplay) {
            this.chipsDisplay.textContent = Account.chips.toLocaleString();
        }
    },

    showBetPanel() {
        BaLa.phase = 'bet';
        this.betPanel.style.display = 'flex';
        this.actionPanel.style.display = 'none';
        this.resultPanel.style.display = 'none';
        this.messageEl.textContent = '💰 Đặt cược để bắt đầu!';
        this.playerArea.innerHTML = '';
        this.dealerArea.innerHTML = '';
        this.playerLabel.textContent = 'BẠN';
        this.dealerLabel.textContent = 'DEALER';
    },

    doDeal() {
        const ante = parseInt(this.anteInput.value) || 50;
        const pp = parseInt(this.ppInput.value) || 0;

        if (ante < 10) {
            this.messageEl.textContent = '⚠️ Ante tối thiểu 10 chip!';
            return;
        }
        if (ante + pp > Account.chips) {
            this.messageEl.textContent = '⚠️ Không đủ chip!';
            return;
        }

        BaLa.deal(ante, pp);
        this.betPanel.style.display = 'none';
        this.actionPanel.style.display = 'flex';
        this.renderHands(false); // dealer face down
        this.messageEl.textContent = BaLa.message;
    },

    doPlay() {
        if (BaLa.anteBet > Account.chips) {
            this.messageEl.textContent = '⚠️ Không đủ chip để Play (cần thêm ante)!';
            return;
        }
        const win = BaLa.play();
        if (win > 0) Account.addChips(win);
        else if (win < 0) Account.deductChips(-win);
        this.actionPanel.style.display = 'none';
        this.resultPanel.style.display = 'flex';
        this.renderHands(true); // reveal dealer
        this.messageEl.textContent = BaLa.message;
        this.updateChips();

        // Show hand names
        const pEval = evaluateThreeCardHand(BaLa.playerHand);
        const dEval = evaluateThreeCardHand(BaLa.dealerHand);
        this.playerLabel.textContent = `BẠN - ${getHandName(pEval)}`;
        this.dealerLabel.textContent = `DEALER - ${getHandName(dEval)}`;
    },

    doFold() {
        const win = BaLa.fold();
        if (win > 0) Account.addChips(win);
        else if (win < 0) Account.deductChips(-win);
        this.actionPanel.style.display = 'none';
        this.resultPanel.style.display = 'flex';
        this.renderHands(true);
        this.messageEl.textContent = BaLa.message;
        this.updateChips();
    },

    renderHands(revealDealer) {
        this.playerArea.innerHTML = '';
        this.dealerArea.innerHTML = '';

        BaLa.playerHand.forEach(card => {
            const el = document.createElement('div');
            el.className = 'bl-card';
            el.innerHTML = `<img src="${card.imagePath}" alt="${card.displayName}" draggable="false">`;
            this.playerArea.appendChild(el);
        });

        BaLa.dealerHand.forEach(card => {
            const el = document.createElement('div');
            el.className = 'bl-card';
            if (revealDealer) {
                el.innerHTML = `<img src="${card.imagePath}" alt="${card.displayName}" draggable="false">`;
            } else {
                el.innerHTML = `<img src="../assets/cards/back.png" alt="Card" draggable="false">`;
            }
            this.dealerArea.appendChild(el);
        });
    },

    newRound() {
        this.showBetPanel();
    }
};

// Init when page loads
document.addEventListener('DOMContentLoaded', () => {
    Account.loadData();
    BaLaUI.init();
});
