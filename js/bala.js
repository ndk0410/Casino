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
        // Player loses ante + play + pair plus on fold
        this.phase = 'result';
        this.result = 'fold';
        this.message = `😔 Bạn bỏ bài. Mất toàn bộ cược.`;
        return 0; // Return nothing
    },

    play() {
        this.phase = 'result';
        const playerEval = evaluateThreeCardHand(this.playerHand);
        const dealerEval = evaluateThreeCardHand(this.dealerHand);
        const dealerQualifies = dealerEval.handRank >= BA_LA_HANDS.PAIR ||
            (dealerEval.kickers[0] >= 12); // Q-high or better

        let totalCredit = 0; // The total chips to return to the account

        // 1. Pair Plus (Paid regardless of Dealer hand)
        if (this.pairPlusBet > 0) {
            const ppPayout = getPairPlusPayout(playerEval);
            if (ppPayout >= 0) {
                // Win: Return Bet + Profit
                totalCredit += this.pairPlusBet + (this.pairPlusBet * ppPayout);
            }
        }

        // 2. Ante & Play
        if (!dealerQualifies) {
            // Dealer doesn't qualify: Ante pays 1:1, Play pushes (returns)
            totalCredit += (this.anteBet * 2) + this.anteBet; // (Ante + Ante Win) + Play
            this.result = 'dealer-no-qualify';
            this.message = `🤷 Máy không đủ bài (cần Q trở lên). Thắng Ante + Trả lại Play!`;
        } else {
            const cmp = compareHands(playerEval, dealerEval);
            if (cmp > 0) {
                // Player wins: Ante & Play pay 1:1
                const anteBonus = getAnteBonus(playerEval);
                totalCredit += (this.anteBet * 2) + (this.anteBet * 2); // (Ante+Win) + (Play+Win)
                if (anteBonus > 0) {
                    totalCredit += this.anteBet * anteBonus; // Add bonus
                }
                this.result = 'win';
                const handName = getHandName(playerEval);
                this.message = `🎉 Bạn thắng! ${handName}!`;
            } else if (cmp < 0) {
                // Dealer wins
                this.result = 'lose';
                this.message = `😞 Máy thắng! Bạn mất cược.`;
            } else {
                // Push: Return both original bets
                totalCredit += this.anteBet + this.anteBet;
                this.result = 'push';
                this.message = '🤝 Hòa! Trả lại cược.';
            }
        }

        return totalCredit;
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
        this.anteMaxBtn = document.getElementById('bl-ante-max');
        this.ppMaxBtn = document.getElementById('bl-pp-max');
        this.playerLabel = document.getElementById('bl-player-name');
        this.dealerLabel = document.getElementById('bl-dealer-name');
        this.chipsDisplay = document.getElementById('bl-chips');

        if (this.anteMaxBtn) {
            this.anteMaxBtn.addEventListener('click', () => {
                const max = Math.min(Account.chips, 250000);
                this.anteInput.value = max;
            });
        }
        if (this.ppMaxBtn) {
            this.ppMaxBtn.addEventListener('click', () => {
                const currentAnte = parseInt(this.anteInput.value) || 0;
                const maxPP = Math.min(Account.chips - currentAnte, 250000 - currentAnte);
                this.ppInput.value = Math.max(0, maxPP);
            });
        }

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
        this.messageEl.innerHTML = '<img src="../assets/economy/Economy_Cowoncy.png" style="width:14px;vertical-align:middle;"> Đặt cược để bắt đầu!';
        this.playerArea.innerHTML = '';
        this.dealerArea.innerHTML = '';
        this.playerLabel.textContent = 'BẠN';
        this.dealerLabel.textContent = 'MÁY';
    },

    async doDeal() {
        let ante = parseInt(this.anteInput.value) || 50;
        let pp = parseInt(this.ppInput.value) || 0;

        // Enforce 250k limit
        if (ante + pp > 250000) {
            this.messageEl.textContent = '⚠️ Tổng cược tối đa mỗi ván là 250,000!';
            // Scaling down proportionally if over limit
            const ratio = 250000 / (ante + pp);
            ante = Math.floor(ante * ratio);
            pp = Math.floor(pp * ratio);
            this.anteInput.value = ante;
            this.ppInput.value = pp;
        }

        if (ante < 10) {
            this.messageEl.textContent = '⚠️ Ante tối thiểu 10 chip!';
            return;
        }
        if (ante + pp > Account.chips) {
            this.messageEl.textContent = '⚠️ Không đủ chip!';
            return;
        }

        try {
            await Account.deductChips(ante + pp);
            BaLa.deal(ante, pp);
            
            this.betPanel.style.display = 'none';
            this.actionPanel.style.display = 'flex';
            this.resultPanel.style.display = 'none';
            this.messageEl.textContent = '🃏 Đang chơi...';
            audioManager.shuffle();
            this.renderHands(false); // hide dealer
            this.updateChips();
        } catch (e) {
            console.error(e);
            this.messageEl.textContent = '❌ Lỗi hệ thống. Vui lòng thử lại!';
            this.betPanel.style.display = 'flex';
        }
    },

    async doPlay() {
        if (BaLa.anteBet > Account.chips) {
            this.messageEl.textContent = '⚠️ Không đủ chip để Đánh (Play)!';
            return;
        }
        await Account.deductChips(BaLa.anteBet);
        const credit = BaLa.play();
        if (credit > 0) {
            await Account.addChips(credit);
            if (BaLa.result === 'win' || BaLa.result === 'dealer-no-qualify') {
                audioManager.win();
            } else {
                audioManager.pass(); // Push
            }
        } else {
            audioManager.lose();
        }
        
        this.actionPanel.style.display = 'none';
        this.resultPanel.style.display = 'flex';
        this.renderHands(true); // reveal dealer
        this.messageEl.textContent = BaLa.message;
        if (credit > 0) {
            this.messageEl.textContent += ` Nhận lại: ${credit.toLocaleString()} chip.`;
        }
        this.updateChips();

        // Show hand names
        const pEval = evaluateThreeCardHand(BaLa.playerHand);
        const dEval = evaluateThreeCardHand(BaLa.dealerHand);
        this.playerLabel.textContent = `BẠN - ${getHandName(pEval)}`;
        this.dealerLabel.textContent = `MÁY - ${getHandName(dEval)}`;
    },

    async doFold() {
        audioManager.lose();
        const credit = BaLa.fold();
        if (credit > 0) {
            await Account.addChips(credit);
        }
        this.actionPanel.style.display = 'none';
        this.resultPanel.style.display = 'flex';
        this.renderHands(true);
        this.messageEl.textContent = BaLa.message;
        if (credit > 0) {
            this.messageEl.textContent += ` Nhận lại: ${credit.toLocaleString()} chip.`;
        }
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
    Account.loadData && Account.loadData();
    BaLaUI.init();
});
