// mp-xidach.js - Multiplayer logic for Xì Dách (Blackjack)

window.MP_XiDach = {
    isMultiplayer: false,
    isHost: false,
    roomId: null,
    roomRef: null,
    playersOrder: [], // guest UIDs first, then host 
    guestUids: [],
    
    // Local tracking
    localHand: [],
    dealerHand: [],

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');
        
        if (!this.roomId || !Account.uid) return;

        console.log("Multiplayer XiDach mode active. Room:", this.roomId);
        this.isMultiplayer = true;
        this.roomRef = db.ref('rooms/' + this.roomId);
        
        const snapshot = await this.roomRef.once('value');
        const roomData = snapshot.val();
        
        if (!roomData) {
            alert("Phòng không tồn tại!");
            window.location.href = 'lobby.html';
            return;
        }

        this.isHost = (Account.uid === roomData.host);
        
        const ObjectPlayers = Object.values(roomData.players).sort((a, b) => a.joinedAt - b.joinedAt);
        this.guestUids = ObjectPlayers.map(p => p.uid).filter(uid => uid !== roomData.host);
        this.playersOrder = [...this.guestUids, roomData.host];

        this.setupUI();
        this.listenToState();
        this.overrideEngine();
    },

    setupUI() {
        if (this.isHost) {
            document.querySelector('.xd-label').innerHTML = '🎩 BẠN LÀ NHÀ CÁI <span id="dealer-score" class="score-badge">-</span>';
            const playerLabel = document.querySelectorAll('.xd-label')[1];
            if (playerLabel) playerLabel.innerHTML = 'Nhà Con <span id="player-score" class="score-badge">-</span>';
        } else {
            document.querySelector('.xd-label').innerHTML = '🎩 NHÀ CÁI (Chủ Phòng) <span id="dealer-score" class="score-badge">-</span>';
        }
    },

    overrideEngine() {
        // Prevent default deal
        xidachUI.btnDeal.onclick = () => {
            if (!this.isHost) {
                // Guests bet and wait
                this.guestSubmitBet();
            } else {
                // Host starts round
                this.hostDeal();
            }
        };

        // Override Hit
        xidachUI.btnHit.onclick = () => {
             this.submitAction('hit');
        };

        // Override Stand
        xidachUI.btnStand.onclick = () => {
             this.submitAction('stand');
        };

        // Override Double
        xidachUI.btnDouble.onclick = () => {
             this.submitAction('double');
        };
    },

    guestSubmitBet() {
        if (this.isHost) return;
        const bet = parseInt(xidachUI.betDisplay.textContent) || 0;
        if (bet < 10) {
            xidachUI.showMessage('Cược tối thiểu 10!');
            return;
        }
        if (bet > Account.chips) {
            xidachUI.showMessage('Không đủ chip!');
            return;
        }
        
        // Deduct local view temporarily
        xidachUI.btnDeal.style.display = 'none';
        xidachUI.btnClearBet.style.display = 'none';
        xidachUI.showMessage('⏳ Đã cược! Đang chờ Nhà Cái chia bài...');
        
        this.roomRef.child('state/bets/' + Account.uid).set(bet);
    },

    submitAction(action) {
        // Prevent spam
        xidachUI.hideControls();
        xidachUI.showMessage('Đang xử lý...');
        
        if (this.isHost) {
            // Host creates a fake queue message for themselves to process instantly
            this.hostProcessAction(Account.uid, action);
        } else {
            this.roomRef.child('actionQueue').push({
                uid: Account.uid,
                action: action,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    },


    // ==========================================
    // HOST LOGIC (AUTHORITATIVE)
    // ==========================================

    async hostDeal() {
        if (!this.isHost) return;
        
        // Get snapshot of bets to see who is actually playing
        const snap = await this.roomRef.child('state/bets').once('value');
        const bets = snap.val() || {};
        
        // Host implies playing
        const activeGuests = this.guestUids.filter(uid => bets[uid] > 0);
        this.activePlrs = [...activeGuests, Account.uid];

        if (this.activePlrs.length === 1) {
             xidachUI.showMessage('Chưa có nhà con nào đặt cược!');
             return;
        }

        const d = new Deck(); d.shuffle();
        XiDach.deck = d.cards;
        
        const hands = {};
        this.activePlrs.forEach(uid => {
             hands[uid] = [XiDach.drawCard().id, XiDach.drawCard().id];
        });

        // Current turn goes to first guest
        const firstTurnIdx = 0; 

        // Check host blackjack (if host has BJ, everyone loses/pushes immediately)
        const hostCards = hands[Account.uid].map(id => Card.fromId(id));
        const hostBJ = isBlackjack(hostCards);

        let phase = hostBJ ? 'result' : 'playing';
        let turnIdx = hostBJ ? -1 : firstTurnIdx;

        const stateData = {
             phase: phase,
             hands: hands,
             bets: bets,
             currentTurnIdx: turnIdx,
             activePlayers: this.activePlrs,
             actionsDone: {} // Store if players busted or stood
        };

        await this.roomRef.child('state').set(stateData);

        if (hostBJ) {
             await this.hostProcessResults(stateData);
        }
    },

    async hostProcessAction(uid, action) {
        if (!this.isHost) return;
        
        const snap = await this.roomRef.child('state').once('value');
        const state = snap.val();
        if (!state || state.phase !== 'playing') return;

        // Verify turn
        const expectedUid = state.activePlayers[state.currentTurnIdx];
        if (expectedUid !== uid) return;

        let hands = state.hands;
        let pHand = hands[uid].map(id => Card.fromId(id));
        
        if (action === 'hit' || action === 'double') {
             // Deduct double amount if double
             if (action === 'double' && state.bets[uid]) {
                  state.bets[uid] *= 2; 
             }
             
             pHand.push(XiDach.drawCard());
             hands[uid] = pHand.map(c => c.id);

             if (isBust(pHand) || pHand.length === 5 || getHandTotal(pHand) === 21 || action === 'double') {
                  // Force turn progression
                  state.actionsDone[uid] = isBust(pHand) ? 'bust' : (pHand.length === 5 ? '5card' : 'stand');
                  state.currentTurnIdx++;
             }
        } 
        else if (action === 'stand') {
            state.actionsDone[uid] = 'stand';
            state.currentTurnIdx++;
        }

        // Check if round should move to dealer
        if (state.currentTurnIdx >= state.activePlayers.length - 1) { // Host is last
             state.phase = 'dealer_turn';
             await this.roomRef.child('state').set(state);
             this.hostPlayDealerTurn(state);
             return;
        }

        // Just update state
        await this.roomRef.child('state').set(state);
    },

    async hostPlayDealerTurn(state) {
        if (!this.isHost) return;
        
        let hands = state.hands;
        let dHand = hands[Account.uid].map(id => Card.fromId(id));
        
        // Dealer logic: Deal until >= 16 (Vietnamese rule often 16, standard 17. Using standard Blackjack logic based on `xidach.js` which uses 17, but keeping 16 for true xidach. Wait xidach.js uses 17, let's stick to 17)
        let total = getHandTotal(dHand);
        
        // Wait 1 second between draws so players can watch
        while (total < 17 && dHand.length < 5) {
             await new Promise(r => setTimeout(r, 1000));
             dHand.push(XiDach.drawCard());
             hands[Account.uid] = dHand.map(c => c.id);
             await this.roomRef.child('state/hands').set(hands);
             total = getHandTotal(dHand);
        }

        state.hands = hands;
        await this.hostProcessResults(state);
    },

    async hostProcessResults(state) {
        if (!this.isHost) return;

        const hostCards = state.hands[Account.uid].map(id => Card.fromId(id));
        const hostBJ = isBlackjack(hostCards);
        const hostBust = isBust(hostCards);
        const host5Card = isFiveCard(hostCards);
        const hostTotal = getHandTotal(hostCards);

        const netChanges = {};

        state.activePlayers.forEach(uid => {
            if (uid === Account.uid) return;
            
            const bet = state.bets[uid] || 0;
            const pCards = state.hands[uid].map(id => Card.fromId(id));
            const pBJ = isBlackjack(pCards);
            const pBust = isBust(pCards);
            const p5Card = isFiveCard(pCards);
            const pTotal = getHandTotal(pCards);

            let resultStatus = ''; // win, lose, push, bj_win, 5card_win

            if (hostBJ) {
                if (pBJ) resultStatus = 'push';
                else resultStatus = 'lose';
            } 
            else if (pBust) {
                resultStatus = 'lose';
            } 
            else if (pBJ) {
                resultStatus = 'bj_win';
            } 
            else if (hostBust) {
                resultStatus = 'win';
                if (p5Card) resultStatus = '5card_win';
            } 
            else if (p5Card && !host5Card) {
                resultStatus = '5card_win';
            } 
            else if (host5Card && !p5Card) {
                resultStatus = 'lose';
            } 
            else {
                // Normal point comparison
                if (pTotal > hostTotal) resultStatus = 'win';
                else if (pTotal < hostTotal) resultStatus = 'lose';
                else resultStatus = 'push';
            }

            // Calc Chips. Note: Client already deducted bet visually or actually?
            // In MP logic, guests haven't actually run Account.deductChips() yet. They just set state/bets.
            // Let's return the literal chip delta to apply.
            let delta = 0;
            if (resultStatus === 'lose') delta = -bet;
            else if (resultStatus === 'push') delta = 0;
            else if (resultStatus === 'win') delta = bet;
            else if (resultStatus === 'bj_win') delta = bet * 1.5;
            else if (resultStatus === '5card_win') delta = bet * 2;

            netChanges[uid] = { delta, status: resultStatus };
        });

        await this.roomRef.child('state/phase').set('result');
        await this.roomRef.child('state/results').set(netChanges);
    },


    // ==========================================
    // CLIENT SYNC & RENDERING
    // ==========================================

    listenToState() {
        if (this.isHost) {
            this.roomRef.child('actionQueue').on('child_added', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.hostProcessAction(data.uid, data.action);
                    snapshot.ref.remove();
                }
            });
        }

        this.roomRef.child('state').on('value', snap => {
            const state = snap.val();
            if (!state) {
                this.resetBoard();
                return;
            }
            this.renderState(state);
        });
    },

    resetBoard() {
        xidachUI.hideControls();
        xidachUI.resultOverlay.style.display = 'none';
        xidachUI.dealerHandEl.innerHTML = '';
        xidachUI.playerHandEl.innerHTML = '';
        document.getElementById('dealer-score').textContent = '-';
        document.getElementById('player-score').textContent = '-';
        
        XiDach.bet = 0;
        xidachUI.updateBetDisplay();
        xidachUI.updateChipsDisplay();
        
        if (this.isHost) {
            xidachUI.btnDeal.style.display = 'inline-block';
            xidachUI.showMessage('Đợi nhà con đặt cược rồi nhấn Phát Bài.');
        } else {
            xidachUI.btnDeal.style.display = 'inline-block';
            xidachUI.btnClearBet.style.display = 'inline-block';
            xidachUI.showMessage('Chọn Chip cược và nhấn PHÁT BÀI để báo danh!');
        }
    },

    renderState(state) {
        xidachUI.btnDeal.style.display = 'none';
        xidachUI.btnClearBet.style.display = 'none';
        
        // Am I in this round?
        const amIPlaying = state.activePlayers && state.activePlayers.includes(Account.uid);
        
        // Hide hands first
        xidachUI.dealerHandEl.innerHTML = '';
        xidachUI.playerHandEl.innerHTML = '';
        
        // If I am a spectator (didn't bet), I can only watch the Host's hand
        const myHandIds = (amIPlaying) ? state.hands[Account.uid] : [];
        const myCards = myHandIds.map(id => Card.fromId(id));
        
        const hostHandIds = state.hands[roomData?.host || this.playersOrder[this.playersOrder.length-1]] || [];
        const hostCards = hostHandIds.map(id => Card.fromId(id));
        
        // Render My Cards (or blank if spectator)
        myCards.forEach(c => {
             const div = document.createElement('div');
             div.className = 'xd-card';
             div.innerHTML = `<img src="${c.imagePath}">`;
             xidachUI.playerHandEl.appendChild(div);
        });
        document.getElementById('player-score').textContent = myCards.length > 0 ? getHandTotal(myCards) : '-';

        // Render Host Cards
        // Hide host's second card if round isn't over and it's not dealer's turn
        hostCards.forEach((c, idx) => {
             const div = document.createElement('div');
             div.className = 'xd-card';
             if (idx > 0 && state.phase === 'playing' && !this.isHost) {
                  div.innerHTML = `<img src="52 playing card/back.png">`;
             } else {
                  div.innerHTML = `<img src="${c.imagePath}">`;
             }
             xidachUI.dealerHandEl.appendChild(div);
        });

        if (state.phase === 'playing' && !this.isHost) {
             document.getElementById('dealer-score').textContent = hostCards.length > 0 ? getCardValue(hostCards[0]) + ' + ?' : '-';
        } else {
             document.getElementById('dealer-score').textContent = hostCards.length > 0 ? getHandTotal(hostCards) : '-';
        }

        // Handle Turn UI
        xidachUI.hideControls();
        xidachUI.resultOverlay.style.display = 'none';
        
        if (state.phase === 'playing' || state.phase === 'dealer_turn') {
            const currentUid = state.activePlayers[state.currentTurnIdx];
            
            if (currentUid === Account.uid) {
                if (this.isHost) {
                    xidachUI.showMessage('Lượt NHÀ CÁI rút bài...');
                    // Host actually processes this automatically in hostPlayDealerTurn, so just show wait state visually
                } else {
                    xidachUI.showMessage('LƯỢT CỦA BẠN!');
                    xidachUI.btnHit.style.display = 'inline-block';
                    xidachUI.btnStand.style.display = 'inline-block';
                    if (myCards.length === 2 && state.bets[Account.uid] * 2 <= Account.chips) {
                        xidachUI.btnDouble.style.display = 'inline-block';
                    }
                }
            } else {
                xidachUI.showMessage(`Đang chờ ${currentUid === roomData?.host ? 'Nhà Cái' : 'Nhà Con'} đánh...`);
            }
        } 
        else if (state.phase === 'result') {
            if (this.isHost) {
                xidachUI.showMessage('KẾT QUẢ');
                xidachUI.resultOverlay.style.display = 'flex';
                let sumDelta = 0;
                Object.values(state.results || {}).forEach(r => sumDelta -= r.delta); // Host wins what guests lose
                
                if (sumDelta > 0) Account.addChips(sumDelta);
                else if (sumDelta < 0) Account.deductChips(-sumDelta);
                
                document.getElementById('result-msg').innerHTML = sumDelta >= 0 ? 
                    `<span style="color:var(--pk-success)">Nhà Cái Thắng Tổng: +${sumDelta.toLocaleString()}</span>` :
                    `<span style="color:var(--pk-danger)">Nhà Cái Thua Tổng: ${sumDelta.toLocaleString()}</span>`;
                    
                xidachUI.updateChipsDisplay();
                xidachUI.btnNewRound.style.display = 'inline-block';
                xidachUI.btnNewRound.onclick = () => this.roomRef.child('state').remove();

            } else {
                const myRes = state.results ? state.results[Account.uid] : null;
                if (!myRes) {
                     xidachUI.showMessage('Ván chơi đã kết thúc.');
                     return;
                }
                
                if (myRes.delta > 0) Account.addChips(myRes.delta);
                else if (myRes.delta < 0) Account.deductChips(-myRes.delta);
                
                xidachUI.updateChipsDisplay();
                
                xidachUI.resultOverlay.style.display = 'flex';
                
                let text = "HÒA";
                let color = "white";
                if (myRes.status.includes('win')) { text = `THẮNG (+${myRes.delta.toLocaleString()})`; color = "var(--pk-success)"; }
                else if (myRes.status === 'lose') { text = `THUA (${myRes.delta.toLocaleString()})`; color = "var(--pk-danger)"; }
                
                document.getElementById('result-msg').innerHTML = `<span style="color:${color}; font-size:32px; font-weight:800">${text}</span>`;
                xidachUI.btnNewRound.style.display = 'none';
                xidachUI.showMessage('Đang chờ Nhà Cái mở ván mới...');
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.MP_XiDach) {
            MP_XiDach.init();
        }
    }, 100);
});
