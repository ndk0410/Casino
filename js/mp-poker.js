// mp-poker.js - Multiplayer logic for Poker Texas Hold'em

window.MP_Poker = {
    isMultiplayer: false,
    isHost: false,
    roomId: null,
    roomRef: null,
    playersOrder: [], // uids
    myIndex: -1,

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');
        
        if (!this.roomId || !Account.uid) return; // Solo mode

        console.log("Multiplayer Poker mode active. Room:", this.roomId);
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
        
        // Setup Players Mapping
        const players = Object.values(roomData.players).sort((a, b) => a.joinedAt - b.joinedAt);
        this.playersOrder = players.map(p => p.uid);
        this.myIndex = this.playersOrder.indexOf(Account.uid);
        
        // Overwrite standard offline players array
        Poker.players = [];
        this.playersOrder.forEach((uid, i) => {
            Poker.players.push({
                uid: uid,
                name: roomData.players[uid].name,
                hand: [],
                chips: 1000, // Default for guests
                bet: 0,
                folded: false,
                isAI: false,
                totalBet: 0
            });
        });
        // Connect local account chips to my slot
        Poker.players[this.myIndex].chips = Account.chips;

        this.setupUI();
        this.listenToState();
        
        // Prevent generic start execution
        PokerUI.startGame = () => {
            if (this.isHost) {
                this.hostStartHand();
            }
        };
        
        // Override Human Action so it sends to Firebase instead of continuing locally
        PokerUI.humanAction = (action) => {
            const raiseAmt = parseInt(PokerUI.raiseInput?.value) || Poker.bigBlind;
            this.sendAction(action, raiseAmt);
        };

        // Suppress runTurn since Firebase controls progression
        PokerUI.runTurn = () => { /* Do nothing offline-wise */ };
        
        // Suppress endHand locally, it is strictly triggered by Phase='showdown' in Firebase state
        PokerUI.endHand = () => { /* Do nothing, handled by applyState */ };
    },

    setupUI() {
        if (!this.isHost) {
            PokerUI.startBtn.style.display = 'none';
            PokerUI.setMessage('⏳ Đang chờ Chủ Phòng bắt đầu...');
        } else {
            PokerUI.startBtn.textContent = '🎮 BẮT ĐẦU VÁN';
        }
    },

    // ==========================================
    // HOST-SIDE EXECUTION (AUTHORITATIVE)
    // ==========================================

    async hostStartHand() {
        if (!this.isHost) return;

        // Offline logic calculates everything first
        Poker.startHand();
        
        // Create full state packet for Firebase
        const stateData = this.buildStateData();
        stateData.timestamp = firebase.database.ServerValue.TIMESTAMP;
        
        await this.roomRef.child('state').set(stateData);
        PokerUI.startBtn.style.display = 'none';
    },

    buildStateData() {
        const hands = {};
        this.playersOrder.forEach((uid, i) => {
            hands[uid] = Poker.players[i].hand.map(c => c.id);
        });

        // Pack necessary state for clients to render accurately
        return {
            phase: Poker.phase,
            pot: Poker.pot,
            currentBet: Poker.currentBet,
            currentPlayerIdx: Poker.currentPlayerIdx,
            dealerIdx: Poker.dealerIdx,
            community: Poker.community.map(c => c.id),
            hands: hands,
            playerStates: Poker.players.map(p => ({
                chips: p.chips,
                bet: p.bet,
                totalBet: p.totalBet,
                folded: p.folded
            }))
        };
    },

    // Process an action entirely on the Host side, then broadcast
    async hostProcessAction(uid, actionDetails) {
        if (!this.isHost) return;
        
        const { action, amount } = actionDetails;
        const pIdx = Poker.currentPlayerIdx;
        const pUid = this.playersOrder[pIdx];

        // Security check, ensure it was the right player's turn
        if (pUid !== uid) return;

        Poker.playerAction(action, amount);

        // Deduct chips dynamically on Host side logic
        if (uid === Account.uid && action !== 'fold' && action !== 'check') {
            // Because Account.chips is synced locally, deduct from db if needed? 
            // Better to let local ui update it.
        }

        // Advance Game Logic
        // Check if hand is over
        if (Poker.activePlayers().length <= 1) {
            Poker.phase = 'showdown';
            PokerUI.endHand();
            await this.roomRef.child('state').set(this.buildStateData());
            return;
        }

        // Check if round is complete
        if (Poker.isRoundComplete() && Poker.currentPlayerIdx === Poker.nextActivePlayer(Poker.dealerIdx)) {
            if (Poker.phase === 'river') {
                Poker.phase = 'showdown';
                PokerUI.endHand();
                await this.roomRef.child('state').set(this.buildStateData());
                return;
            } else {
                Poker.advancePhase();
                if (Poker.phase === 'showdown') {
                    await this.hostProcessEndHand();
                    return;
                }
            }
        } else {
            // Next turn normally
            Poker.currentPlayerIdx = Poker.nextActivePlayer(Poker.currentPlayerIdx);
        }

        // Push new state
        await this.roomRef.child('state').set(this.buildStateData());
    },
    
    // Custom endHand processor for Host
    async hostProcessEndHand() {
        // Standard logic for determining winner
        const winners = Poker.determineWinners();
        const share = Math.floor(Poker.pot / winners.length);

        winners.forEach(w => {
            Poker.players[w.idx].chips += share;
        });

        // Push final state
        await this.roomRef.child('state').set(this.buildStateData());
        
        // Wait 5 seconds, then allow new hand (reset button handled by applyState)
    },


    // ==========================================
    // CLIENT SIDE COMMUNICATION
    // ==========================================

    async sendAction(action, amount) {
        PokerUI.hideActions();
        PokerUI.setMessage('Đang gửi hành động...');
        
        if (this.isHost) {
            // Process locally without network delay
            this.hostProcessAction(Account.uid, { action, amount });
        } else {
            // Push action to an action queue that the Host listens to
            await this.roomRef.child('actionQueue').push({
                uid: Account.uid,
                action: action,
                amount: amount,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    },

    listenToState() {
        // Only Host listens to actionQueue
        if (this.isHost) {
            this.roomRef.child('actionQueue').on('child_added', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.hostProcessAction(data.uid, data);
                    snapshot.ref.remove(); // clear after processing
                }
            });
        }

        // Everyone listens to state
        this.roomRef.child('state').on('value', (snapshot) => {
            const state = snapshot.val();
            if (!state) return;
            this.applyState(state);
        });
    },

    applyState(state) {
        Poker.phase = state.phase;
        Poker.pot = state.pot;
        Poker.currentBet = state.currentBet;
        Poker.currentPlayerIdx = state.currentPlayerIdx;
        Poker.dealerIdx = state.dealerIdx;
        
        Poker.community = (state.community || []).map(id => Card.fromId(id));
        
        Poker.players.forEach((p, i) => {
            const uid = this.playersOrder[i];
            const pState = state.playerStates[i];
            
            p.chips = pState.chips;
            p.bet = pState.bet;
            p.totalBet = pState.totalBet;
            p.folded = pState.folded;
            
            const cardIds = state.hands[uid] || [];
            p.hand = cardIds.map(id => Card.fromId(id));
        });

        // Only update local chips if it changed (and not host, host deals with local chips differently)
        if (!this.isHost) {
            Account.chips = Poker.players[this.myIndex].chips;
            // Note: Ideally call Account.saveData() but doing it every turn causes heavy writes
        }

        PokerUI.render();

        if (state.phase === 'showdown') {
            const winners = Poker.determineWinners();
            const share = Math.floor(Poker.pot / winners.length);
            const winnerNames = winners.map(w => {
                const ev = evaluatePokerHand([...Poker.players[w.idx].hand, ...Poker.community]);
                return `${Poker.players[w.idx].name} (${getPokerHandName(ev)})`;
            }).join(', ');

            PokerUI.setMessage(`🏆 ${winnerNames} thắng ${share.toLocaleString()} chip!`);
            
            PokerUI.startBtn.style.display = this.isHost ? 'inline-block' : 'none';
            PokerUI.startBtn.textContent = '🔄 VÁN MỚI';
            if (!this.isHost) PokerUI.setMessage(`🏆 ${winnerNames} thắng! Đang chờ Chủ Phòng chia ván mới...`);
            return;
        }

        // Show actions if it's my turn
        if (state.currentPlayerIdx === this.myIndex && !Poker.players[this.myIndex].folded) {
            PokerUI.setMessage('Lượt của bạn!');
            PokerUI.showActions();
        } else {
            PokerUI.hideActions();
            const currName = Poker.players[state.currentPlayerIdx].name;
            PokerUI.setMessage(`Đang chờ ${currName} đánh...`);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.MP_Poker) {
            MP_Poker.init();
        }
    }, 100);
});
