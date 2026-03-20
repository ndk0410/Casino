// ============================================================
// poker.js - Texas Hold'em Poker Game Logic
// ============================================================

const POKER_HANDS = {
    ROYAL_FLUSH: 10,
    STRAIGHT_FLUSH: 9,
    FOUR_OF_A_KIND: 8,
    FULL_HOUSE: 7,
    FLUSH: 6,
    STRAIGHT: 5,
    THREE_OF_A_KIND: 4,
    TWO_PAIR: 3,
    PAIR: 2,
    HIGH_CARD: 1
};

const POKER_RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'j': 11, 'q': 12, 'k': 13, 'a': 14 };

function pokerRankVal(rank) { return POKER_RANK_VALUES[rank] || 0; }

// Evaluate best 5-card hand from 7 cards
function evaluatePokerHand(cards) {
    if (cards.length < 5) return { handRank: 0, kickers: [0] };

    // Generate all 5-card combos from 7
    const combos = [];
    for (let i = 0; i < cards.length; i++)
        for (let j = i + 1; j < cards.length; j++)
            for (let k = j + 1; k < cards.length; k++)
                for (let l = k + 1; l < cards.length; l++)
                    for (let m = l + 1; m < cards.length; m++)
                        combos.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);

    let best = null;
    for (const combo of combos) {
        const ev = evaluate5(combo);
        if (!best || comparePokerHands(ev, best) > 0) best = ev;
    }
    return best;
}

function evaluate5(hand) {
    const ranks = hand.map(c => pokerRankVal(c.rank)).sort((a, b) => b - a);
    const suits = hand.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    // Check straight
    let isStraight = false;
    let straightHigh = ranks[0];
    if (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1 &&
        ranks[2] - ranks[3] === 1 && ranks[3] - ranks[4] === 1) {
        isStraight = true;
    }
    // A-2-3-4-5 (wheel)
    if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
        isStraight = true;
        straightHigh = 5;
    }

    // Count ranks
    const counts = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const groups = Object.entries(counts).map(([r, c]) => ({ rank: parseInt(r), count: c }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

    if (isFlush && isStraight && straightHigh === 14) {
        return { handRank: POKER_HANDS.ROYAL_FLUSH, kickers: [14] };
    }
    if (isFlush && isStraight) {
        return { handRank: POKER_HANDS.STRAIGHT_FLUSH, kickers: [straightHigh] };
    }
    if (groups[0].count === 4) {
        return { handRank: POKER_HANDS.FOUR_OF_A_KIND, kickers: [groups[0].rank, groups[1].rank] };
    }
    if (groups[0].count === 3 && groups[1].count === 2) {
        return { handRank: POKER_HANDS.FULL_HOUSE, kickers: [groups[0].rank, groups[1].rank] };
    }
    if (isFlush) {
        return { handRank: POKER_HANDS.FLUSH, kickers: ranks };
    }
    if (isStraight) {
        return { handRank: POKER_HANDS.STRAIGHT, kickers: [straightHigh] };
    }
    if (groups[0].count === 3) {
        return { handRank: POKER_HANDS.THREE_OF_A_KIND, kickers: [groups[0].rank, ...ranks.filter(r => r !== groups[0].rank)] };
    }
    if (groups[0].count === 2 && groups[1].count === 2) {
        const pairs = [groups[0].rank, groups[1].rank].sort((a, b) => b - a);
        const kicker = ranks.find(r => r !== pairs[0] && r !== pairs[1]);
        return { handRank: POKER_HANDS.TWO_PAIR, kickers: [...pairs, kicker] };
    }
    if (groups[0].count === 2) {
        return { handRank: POKER_HANDS.PAIR, kickers: [groups[0].rank, ...ranks.filter(r => r !== groups[0].rank)] };
    }
    return { handRank: POKER_HANDS.HIGH_CARD, kickers: ranks };
}

function comparePokerHands(a, b) {
    if (a.handRank !== b.handRank) return a.handRank - b.handRank;
    for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
        if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
    }
    return 0;
}

function getPokerHandName(ev) {
    const names = {
        10: '👑 Royal Flush!',
        9: '🔥 Straight Flush!',
        11: '💎 Tứ Quý!', // wait 8 was 4 of a kind? Let me use consistent numbers
        8: '💎 Tứ Quý!',
        7: '🏠 Full House!',
        6: '🎨 Flush!',
        5: '📐 Sảnh!',
        4: '🔱 Xám cô!',
        3: '✌️ Hai Đôi',
        2: '👆 Đôi',
        1: '🃏 Bài Lẻ'
    };
    return names[ev.handRank] || 'Bài Lẻ';
}

// ---- Poker Game State ----
const Poker = {
    deck: [],
    players: [], // [{name, hand, chips, bet, folded, isAI}]
    community: [],
    pot: 0,
    phase: 'idle', // idle | preflop | flop | turn | river | showdown
    currentBet: 0,
    currentPlayerIdx: 0,
    dealerIdx: 0,
    smallBlind: 25,
    bigBlind: 50,

    init() {
        this.players = [
            { name: 'Bạn', hand: [], chips: 0, bet: 0, folded: false, isAI: false, totalBet: 0 },
            { name: 'Bot 1', hand: [], chips: 1000, bet: 0, folded: false, isAI: true, totalBet: 0 },
            { name: 'Bot 2', hand: [], chips: 1000, bet: 0, folded: false, isAI: true, totalBet: 0 },
            { name: 'Bot 3', hand: [], chips: 1000, bet: 0, folded: false, isAI: true, totalBet: 0 }
        ];
        this.players[0].chips = Account.chips;
    },

    startHand() {
        this.deck = [];
        const d = new Deck(); d.shuffle();
        this.deck = d.cards;
        this.community = [];
        this.pot = 0;
        this.currentBet = 0;

        this.players.forEach(p => {
            p.hand = [this.deck.pop(), this.deck.pop()];
            p.bet = 0;
            p.totalBet = 0;
            p.folded = false;
        });

        // Reset AI chips if bust
        this.players.forEach((p, i) => {
            if (i > 0 && p.chips < this.bigBlind) p.chips = 1000;
        });
        this.players[0].chips = Account.chips;

        // Post blinds
        const sbIdx = (this.dealerIdx + 1) % 4;
        const bbIdx = (this.dealerIdx + 2) % 4;
        this.postBet(sbIdx, this.smallBlind);
        this.postBet(bbIdx, this.bigBlind);
        this.currentBet = this.bigBlind;

        this.phase = 'preflop';
        audioManager.shuffle();
        this.currentPlayerIdx = (bbIdx + 1) % 4;
    },

    postBet(idx, amount) {
        const p = this.players[idx];
        
        // Enforce 250k limit per hand for player 0
        if (idx === 0) {
            const availableInLimit = 250000 - p.totalBet;
            amount = Math.min(amount, availableInLimit);
        }

        const actual = Math.min(amount, p.chips);
        p.chips -= actual;
        p.bet += actual;
        p.totalBet += actual;
        this.pot += actual;
        return actual;
    },

    nextActivePlayer(from) {
        let idx = (from + 1) % 4;
        let count = 0;
        while (count < 4) {
            if (!this.players[idx].folded) return idx;
            idx = (idx + 1) % 4;
            count++;
        }
        return -1;
    },

    activePlayers() {
        return this.players.filter(p => !p.folded);
    },

    isRoundComplete() {
        const active = this.players.filter(p => !p.folded);
        if (active.length <= 1) return true;
        // All active players have matched current bet or are all-in
        return active.every(p => p.bet === this.currentBet || p.chips === 0);
    },

    advancePhase() {
        // Reset bets for new round
        this.players.forEach(p => p.bet = 0);
        this.currentBet = 0;

        if (this.phase === 'preflop') {
            this.community.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
            this.phase = 'flop';
        } else if (this.phase === 'flop') {
            this.community.push(this.deck.pop());
            this.phase = 'turn';
        } else if (this.phase === 'turn') {
            this.community.push(this.deck.pop());
            this.phase = 'river';
        } else if (this.phase === 'river') {
            this.phase = 'showdown';
            return;
        }

        // Start from first active after dealer
        this.currentPlayerIdx = this.nextActivePlayer(this.dealerIdx);
    },

    playerAction(action, raiseAmount) {
        const p = this.players[this.currentPlayerIdx];
        if (p.folded) return;

        if (action === 'fold') {
            p.folded = true;
        } else if (action === 'call') {
            const toCall = this.currentBet - p.bet;
            this.postBet(this.currentPlayerIdx, toCall);
        } else if (action === 'raise') {
            const toCall = this.currentBet - p.bet;
            this.postBet(this.currentPlayerIdx, toCall + raiseAmount);
            this.currentBet = p.bet;
        } else if (action === 'check') {
            audioManager.pass();
        }
    },

    aiDecision(idx) {
        const p = this.players[idx];
        const toCall = this.currentBet - p.bet;
        const handStrength = this.getAIHandStrength(idx);

        if (handStrength > 0.8) {
            // Strong — raise
            const raise = Math.min(this.bigBlind * 2, p.chips - toCall);
            if (raise > 0) return { action: 'raise', amount: raise };
            return { action: 'call' };
        } else if (handStrength > 0.4) {
            // Medium — call
            if (toCall <= p.chips * 0.3) return { action: 'call' };
            if (toCall === 0) return { action: 'check' };
            return { action: 'fold' };
        } else {
            // Weak
            if (toCall === 0) return { action: 'check' };
            if (toCall <= this.bigBlind && Math.random() > 0.5) return { action: 'call' };
            return { action: 'fold' };
        }
    },

    getAIHandStrength(idx) {
        const p = this.players[idx];
        const allCards = [...p.hand, ...this.community];
        if (allCards.length < 5) {
            // Pre-flop: evaluate hole cards
            const r1 = pokerRankVal(p.hand[0].rank);
            const r2 = pokerRankVal(p.hand[1].rank);
            const paired = r1 === r2;
            const suited = p.hand[0].suit === p.hand[1].suit;
            const highCard = Math.max(r1, r2);

            if (paired && highCard >= 10) return 0.9;
            if (paired) return 0.7;
            if (highCard >= 12 && suited) return 0.65;
            if (highCard >= 12) return 0.5;
            if (suited && Math.abs(r1 - r2) <= 2) return 0.45;
            return 0.2 + highCard / 50;
        }

        const ev = evaluatePokerHand(allCards);
        return Math.min(1, ev.handRank / 10 + 0.1);
    },

    determineWinners() {
        const active = this.players.map((p, i) => ({ ...p, idx: i })).filter(p => !p.folded);
        if (active.length === 1) return [active[0]];

        const evals = active.map(p => ({
            ...p,
            eval: evaluatePokerHand([...p.hand, ...this.community])
        }));

        evals.sort((a, b) => comparePokerHands(b.eval, a.eval));
        const bestEval = evals[0].eval;

        return evals.filter(p => comparePokerHands(p.eval, bestEval) === 0);
    }
};

// ---- Poker UI ----
const PokerUI = {
    init() {
        Poker.init();
        this.chipsEl = document.getElementById('pk-chips');
        this.messageEl = document.getElementById('pk-message');
        this.communityEl = document.getElementById('pk-community');
        this.potEl = document.getElementById('pk-pot');
        this.actionsEl = document.getElementById('pk-actions');
        this.startBtn = document.getElementById('pk-start-btn');
        this.raiseInput = document.getElementById('pk-raise-input');
        this.maxBtn = document.getElementById('pk-max-btn');

        if (this.maxBtn) {
            this.maxBtn.addEventListener('click', () => {
                const p = Poker.players[0];
                const currentCall = Poker.currentBet - p.bet;
                const remainingInLimit = 250000 - p.totalBet - currentCall;
                const maxPossible = Math.min(p.chips - currentCall, Math.max(0, remainingInLimit));
                this.raiseInput.value = maxPossible;
            });
        }

        this.updateChips();lots
        this.slots = [
            document.getElementById('pk-slot-0'),
            document.getElementById('pk-slot-1'),
            document.getElementById('pk-slot-2'),
            document.getElementById('pk-slot-3')
        ];

        this.updateChips();
        this.setMessage('Nhấn BẮT ĐẦU để chơi!');
    },

    updateChips() {
        if (this.chipsEl) {
            this.chipsEl.textContent = Account.chips.toLocaleString();
        }
    },

    setMessage(msg) {
        this.messageEl.textContent = msg;
    },

    async startGame() {
        if (Account.chips < Poker.bigBlind) {
            this.setMessage('⚠️ Không đủ chip! Cần ít nhất ' + Poker.bigBlind);
            return;
        }
        
        const oldChips = Account.chips;
        Poker.startHand();
        const deducted = oldChips - Poker.players[0].chips;
        if (deducted > 0) {
            const success = await Account.deductChips(deducted);
            if (!success) {
                Poker.init();
                this.updateChips();
                this.setMessage('⚠️ Không thể giữ blind cho ván mới!');
                return;
            }
            // Re-sync local chips to avoid drift
            Poker.players[0].chips = Account.chips;
        }
        
        this.startBtn.style.display = 'none';
        this.render();
        this.runTurn();
    },

    render() {
        // Community cards
        this.communityEl.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const el = document.createElement('div');
            el.className = 'pk-card';
            if (i < Poker.community.length) {
                el.innerHTML = `<img src="${Poker.community[i].imagePath}" alt="card">`;
            } else {
                el.innerHTML = `<div class="pk-card-placeholder">?</div>`;
            }
            this.communityEl.appendChild(el);
        }

        // Pot
        this.potEl.innerHTML = `<img src="../assets/economy/Economy_Cowoncy.png" style="width:16px;vertical-align:middle;"> Pot: ${Poker.pot.toLocaleString()}`;

        // Player slots
        Poker.players.forEach((p, i) => {
            const slot = this.slots[i];
            const nameEl = slot.querySelector('.pk-name');
            const chipsEl = slot.querySelector('.pk-player-chips');
            const cardsEl = slot.querySelector('.pk-player-cards');
            const betEl = slot.querySelector('.pk-player-bet');

            nameEl.textContent = p.name;
            chipsEl.textContent = `${p.chips.toLocaleString()}`;
            betEl.textContent = p.bet > 0 ? `Cược: ${p.bet}` : '';

            slot.classList.toggle('folded', p.folded);
            slot.classList.toggle('active-turn', i === Poker.currentPlayerIdx && !p.folded);

            cardsEl.innerHTML = '';
            p.hand.forEach(card => {
                const el = document.createElement('div');
                el.className = 'pk-mini-card';
                if (i === 0 || Poker.phase === 'showdown') {
                    el.innerHTML = `<img src="${card.imagePath}" alt="card">`;
                } else if (!p.folded) {
                    el.innerHTML = `<img src="../assets/cards/back.png" alt="card">`;
                }
                cardsEl.appendChild(el);
            });
        });

        this.updateChips();
    },

    showActions() {
        const p = Poker.players[0];
        const toCall = Poker.currentBet - p.bet;

        this.actionsEl.style.display = 'flex';
        const callBtn = document.getElementById('pk-call-btn');
        const checkBtn = document.getElementById('pk-check-btn');

        if (toCall > 0) {
            callBtn.style.display = 'inline-block';
            callBtn.textContent = `📞 Call (${toCall})`;
            checkBtn.style.display = 'none';
        } else {
            callBtn.style.display = 'none';
            checkBtn.style.display = 'inline-block';
        }
    },

    hideActions() {
        this.actionsEl.style.display = 'none';
    },

    async runTurn() {
        // Check if only one player left
        if (Poker.activePlayers().length <= 1) {
            await this.endHand();
            return;
        }

        // Check if round is complete
        if (Poker.isRoundComplete() && Poker.currentPlayerIdx === Poker.nextActivePlayer(Poker.dealerIdx)) {
            if (Poker.phase === 'river') {
                Poker.phase = 'showdown';
                await this.endHand();
                return;
            }
            Poker.advancePhase();
            if (Poker.phase === 'showdown') {
                await this.endHand();
                return;
            }
            this.render();
        }

        const p = Poker.players[Poker.currentPlayerIdx];
        if (p.folded || p.chips === 0) {
            Poker.currentPlayerIdx = Poker.nextActivePlayer(Poker.currentPlayerIdx);
            this.render();
            await this.delay(200);
            this.runTurn();
            return;
        }

        if (p.isAI) {
            this.setMessage(`${p.name} đang suy nghĩ...`);
            this.render();
            await this.delay(800 + Math.random() * 700);

            const decision = Poker.aiDecision(Poker.currentPlayerIdx);
            Poker.playerAction(decision.action, decision.amount || 0);

            if (decision.action === 'fold') {
                this.setMessage(`${p.name} bỏ bài`);
            } else if (decision.action === 'raise') {
                this.setMessage(`${p.name} raise +${decision.amount}`);
            } else if (decision.action === 'call') {
                this.setMessage(`${p.name} call`);
                audioManager.cardPlay();
            } else {
                this.setMessage(`${p.name} check`);
                audioManager.pass();
            }

            Poker.currentPlayerIdx = Poker.nextActivePlayer(Poker.currentPlayerIdx);
            this.render();
            await this.delay(400);
            this.runTurn();
        } else {
            // Player turn
            this.setMessage('Lượt của bạn!');
            this.render();
            this.showActions();
        }
    },

    async humanAction(action) {
        const oldChips = Poker.players[0].chips;
        const raiseAmt = parseInt(this.raiseInput?.value) || Poker.bigBlind;
        const snapshot = {
            pot: Poker.pot,
            currentBet: Poker.currentBet,
            folded: Poker.players[0].folded,
            bet: Poker.players[0].bet,
            totalBet: Poker.players[0].totalBet,
            chips: Poker.players[0].chips,
        };
        if (action === 'fold') {
            audioManager.pass();
        } else if (action === 'check') {
            audioManager.pass();
        } else {
            audioManager.cardPlay();
        }
        Poker.playerAction(action, raiseAmt);

        if (action === 'fold') Poker.players[0].folded = true;

        const deducted = oldChips - Poker.players[0].chips;
        if (deducted > 0) {
            const success = await Account.deductChips(deducted);
            if (!success) {
                Poker.pot = snapshot.pot;
                Poker.currentBet = snapshot.currentBet;
                Poker.players[0].folded = snapshot.folded;
                Poker.players[0].bet = snapshot.bet;
                Poker.players[0].totalBet = snapshot.totalBet;
                Poker.players[0].chips = snapshot.chips;
                this.setMessage('⚠️ Không thể giữ thêm cược cho hành động này!');
                this.render();
                this.showActions();
                return;
            }
            // Sync again
            Poker.players[0].chips = Account.chips;
        }

        this.hideActions();
        Poker.currentPlayerIdx = Poker.nextActivePlayer(Poker.currentPlayerIdx);
        this.render();
        setTimeout(() => this.runTurn(), 300);
    },

    async endHand() {
        Poker.phase = 'showdown';
        this.render();

        const winners = Poker.determineWinners();
        const share = Math.floor(Poker.pot / winners.length);

        winners.forEach(w => {
            Poker.players[w.idx].chips += share;
        });

        const isPlayerWinner = winners.some(w => w.idx === 0);
        if (isPlayerWinner) {
            await Account.addChips(share);
            audioManager.win();
            // Final sync for the hand
            Poker.players[0].chips = Account.chips;
        } else {
            audioManager.lose();
        }

        const winnerNames = winners.map(w => {
            const ev = evaluatePokerHand([...Poker.players[w.idx].hand, ...Poker.community]);
            return `${Poker.players[w.idx].name} (${getPokerHandName(ev)})`;
        }).join(', ');

        this.setMessage(`🏆 ${winnerNames} thắng ${share.toLocaleString()} chip!`);
        this.updateChips();

        // Show new hand button
        this.startBtn.style.display = 'inline-block';
        this.startBtn.textContent = '🔄 VÁN MỚI';
        Poker.dealerIdx = (Poker.dealerIdx + 1) % 4;
    },

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Account.init && Account.init();
    PokerUI.init();
});
