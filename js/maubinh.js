// ============================================================
// maubinh.js - Mậu Binh (Chinese Poker) Game Logic
// ============================================================

// Reuse poker hand eval from 5-card combos
const MB_HANDS = {
    ROYAL_FLUSH: 10, STRAIGHT_FLUSH: 9, FOUR_OF_A_KIND: 8,
    FULL_HOUSE: 7, FLUSH: 6, STRAIGHT: 5, THREE_OF_A_KIND: 4,
    TWO_PAIR: 3, PAIR: 2, HIGH_CARD: 1
};

const MB_RANK = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'j':11,'q':12,'k':13,'a':14 };

function mbRankVal(r) { return MB_RANK[r] || 0; }

function mbEval5(hand) {
    const ranks = hand.map(c => mbRankVal(c.rank)).sort((a,b) => b-a);
    const suits = hand.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = false, straightHigh = ranks[0];
    if (ranks[0]-ranks[1]===1 && ranks[1]-ranks[2]===1 && ranks[2]-ranks[3]===1 && ranks[3]-ranks[4]===1) isStraight = true;
    if (ranks[0]===14 && ranks[1]===5 && ranks[2]===4 && ranks[3]===3 && ranks[4]===2) { isStraight = true; straightHigh = 5; }
    const counts = {};
    ranks.forEach(r => counts[r]=(counts[r]||0)+1);
    const groups = Object.entries(counts).map(([r,c])=>({rank:parseInt(r),count:c})).sort((a,b)=>b.count-a.count||b.rank-a.rank);

    if (isFlush && isStraight && straightHigh===14) return {handRank:10,kickers:[14]};
    if (isFlush && isStraight) return {handRank:9,kickers:[straightHigh]};
    if (groups[0].count===4) return {handRank:8,kickers:[groups[0].rank]};
    if (groups[0].count===3 && groups[1].count===2) return {handRank:7,kickers:[groups[0].rank,groups[1].rank]};
    if (isFlush) return {handRank:6,kickers:ranks};
    if (isStraight) return {handRank:5,kickers:[straightHigh]};
    if (groups[0].count===3) return {handRank:4,kickers:[groups[0].rank]};
    if (groups[0].count===2 && groups[1].count===2) return {handRank:3,kickers:[groups[0].rank,groups[1].rank].sort((a,b)=>b-a)};
    if (groups[0].count===2) return {handRank:2,kickers:[groups[0].rank,...ranks.filter(r=>r!==groups[0].rank)]};
    return {handRank:1,kickers:ranks};
}

// 3-card evaluation (front chi)
function mbEval3(hand) {
    const ranks = hand.map(c => mbRankVal(c.rank)).sort((a,b) => b-a);
    if (ranks[0]===ranks[1]&&ranks[1]===ranks[2]) return {handRank:4,kickers:[ranks[0]]};
    if (ranks[0]===ranks[1]) return {handRank:2,kickers:[ranks[0],ranks[2]]};
    if (ranks[1]===ranks[2]) return {handRank:2,kickers:[ranks[1],ranks[0]]};
    return {handRank:1,kickers:ranks};
}

function mbCompare(a,b) {
    if (a.handRank!==b.handRank) return a.handRank-b.handRank;
    for (let i=0;i<Math.min(a.kickers.length,b.kickers.length);i++) {
        if (a.kickers[i]!==b.kickers[i]) return a.kickers[i]-b.kickers[i];
    }
    return 0;
}

function mbHandName(ev) {
    const n = {10:'Royal Flush',9:'Sảnh Đồng Chất',8:'Tứ Quý',7:'Cù Lũ',6:'Thùng',
        5:'Sảnh',4:'Xám Cô',3:'Hai Đôi',2:'Đôi',1:'Bài Lẻ'};
    return n[ev.handRank]||'Bài Lẻ';
}

// AI: Simple greedy arrangement
function aiArrange(cards) {
    // Sort all 13 cards by rank desc
    const sorted = [...cards].sort((a,b) => mbRankVal(b.rank)-mbRankVal(a.rank));
    // Try all reasonable arrangements — simplified greedy
    // Put strongest 5 as back, next 5 as middle, weakest 3 as front
    const back = sorted.slice(0, 5);
    const middle = sorted.slice(5, 10);
    const front = sorted.slice(10, 13);

    // Validate: back >= middle >= front
    const backEval = mbEval5(back);
    const midEval = mbEval5(middle);
    const frontEval = mbEval3(front);

    if (mbCompare(backEval, midEval) >= 0) {
        return { front, middle, back };
    }
    // Swap if invalid
    return { front, middle: back, back: middle };
}

// ---- Game State ----
const MauBinh = {
    deck: [],
    players: [], // [{name, hand, arrangement:{front,middle,back}, isAI, score}]
    phase: 'idle', // idle | arranging | result
    bet: 100,

    init() {
        this.players = [
            { name: 'Bạn', hand: [], arrangement: null, isAI: false, score: 0 },
            { name: 'Bot 1', hand: [], arrangement: null, isAI: true, score: 0 },
            { name: 'Bot 2', hand: [], arrangement: null, isAI: true, score: 0 },
            { name: 'Bot 3', hand: [], arrangement: null, isAI: true, score: 0 }
        ];
    },

    deal() {
        const d = new Deck(); d.shuffle();
        this.deck = d.cards;
        this.players.forEach(p => {
            p.hand = [];
            for (let i = 0; i < 13; i++) p.hand.push(this.deck.pop());
            p.arrangement = null;
            p.score = 0;
        });
        // AI auto-arrange
        this.players.forEach(p => {
            if (p.isAI) p.arrangement = aiArrange(p.hand);
        });
        this.phase = 'arranging';
    },

    validateArrangement(arr) {
        if (!arr.front || !arr.middle || !arr.back) return false;
        if (arr.front.length !== 3 || arr.middle.length !== 5 || arr.back.length !== 5) return false;
        const backEval = mbEval5(arr.back);
        const midEval = mbEval5(arr.middle);
        const frontEval = mbEval3(arr.front);
        // Back must be >= middle
        if (mbCompare(backEval, midEval) < 0) return false;
        return true;
    },

    calculateScores() {
        this.phase = 'result';
        // Compare player 0 vs each AI
        const p = this.players[0];
        if (!p.arrangement) return;

        const pFront = mbEval3(p.arrangement.front);
        const pMid = mbEval5(p.arrangement.middle);
        const pBack = mbEval5(p.arrangement.back);

        let totalScore = 0;

        for (let i = 1; i < this.players.length; i++) {
            const ai = this.players[i];
            const aiFront = mbEval3(ai.arrangement.front);
            const aiMid = mbEval5(ai.arrangement.middle);
            const aiBack = mbEval5(ai.arrangement.back);

            let wins = 0;
            if (mbCompare(pFront, aiFront) > 0) wins++;
            else if (mbCompare(pFront, aiFront) < 0) wins--;
            if (mbCompare(pMid, aiMid) > 0) wins++;
            else if (mbCompare(pMid, aiMid) < 0) wins--;
            if (mbCompare(pBack, aiBack) > 0) wins++;
            else if (mbCompare(pBack, aiBack) < 0) wins--;

            // Sweep bonus
            if (wins === 3) wins = 6;
            if (wins === -3) wins = -6;

            ai.score = -wins;
            totalScore += wins;
        }
        p.score = totalScore;
        return totalScore;
    }
};

// ---- Mau Binh UI ----
const MauBinhUI = {
    selected: [],
    front: [],
    middle: [],
    back: [],

    init() {
        MauBinh.init();
        this.chipsEl = document.getElementById('mb-chips');
        this.messageEl = document.getElementById('mb-message');
        this.handEl = document.getElementById('mb-hand');
        this.frontEl = document.getElementById('mb-front');
        this.middleEl = document.getElementById('mb-middle');
        this.backEl = document.getElementById('mb-back');
        this.betPanel = document.getElementById('mb-bet-panel');
        this.arrangePanel = document.getElementById('mb-arrange-panel');
        this.resultPanel = document.getElementById('mb-result-panel');
        this.resultDetail = document.getElementById('mb-result-detail');
        this.betInput = document.getElementById('mb-bet-input');
        this.maxBtn = document.getElementById('mb-max-btn');

        if (this.maxBtn) {
            this.maxBtn.addEventListener('click', () => {
                const maxPossible = Math.min(Account.chips, 250000);
                this.betInput.value = maxPossible;
            });
        }

        this.updateChips();
    },

    updateChips() {
        this.chipsEl.textContent = Account.chips.toLocaleString();
    },

    async startGame() {
        let bet = parseInt(this.betInput.value, 10);
        if (Number.isNaN(bet) || bet < 100) {
            this.messageEl.textContent = '⚠️ Cược tối thiểu là 100 chip!';
            return;
        }
        
        // Enforce 250k limit
        if (bet > 250000) {
            bet = 250000;
            this.betInput.value = 250000;
            this.messageEl.textContent = '⚠️ Cược tối đa mỗi ván là 250,000!';
        }

        if (bet > Account.chips) {
            this.messageEl.textContent = '⚠️ Không đủ chip!';
            return;
        }

        try {
            MauBinh.bet = bet;
            const success = await Account.deductChips(bet);
            if (!success) {
                this.messageEl.textContent = '⚠️ Không đủ chip!';
                return;
            }
            
            this.betPanel.style.display = 'none';
            this.messageEl.textContent = '🎴 Đang chia bài...';
            
            this.updateChips();
            audioManager.shuffle();
            MauBinh.deal();

            this.front = [];
            this.middle = [];
            this.back = [];
            this.selected = [];

            this.arrangePanel.style.display = 'flex';
            this.resultPanel.style.display = 'none';

            this.messageEl.textContent = '🃏 Xếp bài: Chọn bài từ tay → đặt vào chi (Front 3, Middle 5, Back 5)';
            this.renderHand();
            this.renderChis();
        } catch (e) {
            console.error("Mau Binh start failed:", e);
            this.messageEl.textContent = '❌ Lỗi hệ thống. Vui lòng thử lại!';
            this.betPanel.style.display = 'block';
        }
    },

    renderHand() {
        this.handEl.innerHTML = '';
        const usedIds = [...this.front, ...this.middle, ...this.back].map(c => c.id);
        const remaining = MauBinh.players[0].hand.filter(c => !usedIds.includes(c.id));

        remaining.sort((a,b) => mbRankVal(a.rank) - mbRankVal(b.rank));

        remaining.forEach(card => {
            const el = document.createElement('div');
            el.className = 'mb-card';
            if (this.selected.some(c => c.id === card.id)) el.classList.add('mb-selected');
            el.innerHTML = `<img src="${card.imagePath}" alt="${card.displayName}" draggable="false">`;
            el.addEventListener('click', () => this.toggleSelect(card));
            this.handEl.appendChild(el);
        });
    },

    renderChis() {
        [
            { el: this.frontEl, cards: this.front, max: 3, label: 'Chi Trước (3 lá)' },
            { el: this.middleEl, cards: this.middle, max: 5, label: 'Chi Giữa (5 lá)' },
            { el: this.backEl, cards: this.back, max: 5, label: 'Chi Sau (5 lá)' }
        ].forEach(({el, cards, max, label}) => {
            el.innerHTML = `<div class="mb-chi-label">${label}</div><div class="mb-chi-cards">`;
            const cardsDiv = document.createElement('div');
            cardsDiv.className = 'mb-chi-cards';
            for (let i = 0; i < max; i++) {
                const slot = document.createElement('div');
                slot.className = 'mb-card-slot';
                if (cards[i]) {
                    slot.innerHTML = `<img src="${cards[i].imagePath}" alt="card" draggable="false">`;
                    slot.addEventListener('click', () => this.removeFromChi(cards[i], cards === this.front ? 'front' : cards === this.middle ? 'middle' : 'back'));
                } else {
                    slot.innerHTML = '<span class="mb-empty-slot">?</span>';
                }
                cardsDiv.appendChild(slot);
            }
            el.innerHTML = '';
            const labelEl = document.createElement('div');
            labelEl.className = 'mb-chi-label';
            labelEl.textContent = label;
            el.appendChild(labelEl);
            el.appendChild(cardsDiv);
        });
    },

    toggleSelect(card) {
        const idx = this.selected.findIndex(c => c.id === card.id);
        if (idx >= 0) {
            this.selected.splice(idx, 1);
            audioManager.cardDeselect();
        } else {
            this.selected.push(card);
            audioManager.cardSelect();
        }
        this.renderHand();
    },

    addToChi(chi) {
        if (this.selected.length === 0) {
            this.messageEl.textContent = '⚠️ Chọn bài từ tay trước!';
            return;
        }
        const target = chi === 'front' ? this.front : chi === 'middle' ? this.middle : this.back;
        const max = chi === 'front' ? 3 : 5;

        for (const card of this.selected) {
            if (target.length < max) {
                target.push(card);
            }
        }
        this.selected = [];
        audioManager.cardPlay();
        this.renderHand();
        this.renderChis();
    },

    removeFromChi(card, chi) {
        const target = chi === 'front' ? this.front : chi === 'middle' ? this.middle : this.back;
        const idx = target.findIndex(c => c.id === card.id);
        if (idx >= 0) target.splice(idx, 1);
        audioManager.cardDeselect();
        this.renderHand();
        this.renderChis();
    },

    autoArrange() {
        const arr = aiArrange(MauBinh.players[0].hand);
        this.front = arr.front;
        this.middle = arr.middle;
        this.back = arr.back;
        this.selected = [];
        this.renderHand();
        this.renderChis();
        this.messageEl.textContent = '🤖 Đã tự động xếp bài! Nhấn XÁC NHẬN để so bài.';
    },

    async confirm() {
        if (this.front.length !== 3 || this.middle.length !== 5 || this.back.length !== 5) {
            this.messageEl.textContent = '⚠️ Chưa xếp đủ bài! Front=3, Middle=5, Back=5';
            return;
        }

        const arr = { front: this.front, middle: this.middle, back: this.back };
        if (!MauBinh.validateArrangement(arr)) {
            this.messageEl.textContent = '⚠️ Sai luật! Back phải ≥ Middle ≥ Front';
            return;
        }

        MauBinh.players[0].arrangement = arr;
        const totalScore = MauBinh.calculateScores();
        const chipWin = totalScore * MauBinh.bet;
        const settlement = chipWin + MauBinh.bet;

        // The opening bet was already deducted in startGame().
        // Apply only the delta needed to reach the final net result.
        if (settlement > 0) {
            await Account.addChips(settlement);
        } else if (settlement < 0) {
            const success = await Account.deductChips(-settlement);
            if (!success) {
                this.messageEl.textContent = '⚠️ Không đủ chip để tất toán ván Mậu Binh!';
                return;
            }
        }

        this.arrangePanel.style.display = 'none';
        this.resultPanel.style.display = 'flex';

        if (chipWin > 0) {
            this.messageEl.textContent = `🎉 Thắng! +${chipWin.toLocaleString()} chip (${totalScore > 0 ? '+' : ''}${totalScore} chi)`;
            audioManager.win();
        } else if (chipWin < 0) {
            this.messageEl.textContent = `😞 Thua! ${Math.abs(chipWin).toLocaleString()} chip (${totalScore} chi)`;
            audioManager.lose();
        } else {
            this.messageEl.textContent = '🤝 Hòa!';
            audioManager.pass();
        }

        // Show results
        this.resultDetail.innerHTML = '';
        MauBinh.players.forEach((p, i) => {
            const arr = p.arrangement;
            const div = document.createElement('div');
            div.className = 'mb-result-player';
            const frontName = mbHandName(mbEval3(arr.front));
            const midName = mbHandName(mbEval5(arr.middle));
            const backName = mbHandName(mbEval5(arr.back));
            div.innerHTML = `
                <strong>${p.name}</strong> (${p.score > 0 ? '+' : ''}${p.score} chi)
                <div class="mb-result-chis">
                    <span>Front: ${frontName}</span>
                    <span>Mid: ${midName}</span>
                    <span>Back: ${backName}</span>
                </div>
            `;
            this.resultDetail.appendChild(div);
        });

        this.updateChips();
    },

    newRound() {
        this.betPanel.style.display = 'flex';
        this.arrangePanel.style.display = 'none';
        this.resultPanel.style.display = 'none';
        this.handEl.innerHTML = '';
        this.frontEl.innerHTML = '';
        this.middleEl.innerHTML = '';
        this.backEl.innerHTML = '';
        this.messageEl.innerHTML = '<img src="../assets/economy/Economy_Cowoncy.png" style="width:14px;vertical-align:middle;"> Đặt cược và bắt đầu!';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Account.init && Account.init();
    MauBinhUI.init();
});
