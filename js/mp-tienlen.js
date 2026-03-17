// mp-tienlen.js - Multiplayer logic for Tien Len Miền Nam

let roomRef = null;
let roomData = null;
let myPlayerIndex = -1;
let playersOrder = []; // Array of player UIDs in sitting order

const MP_TienLen = {
    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (!roomId || !Account.uid) return; // Solo mode

        console.log("Multiplayer mode active. Room:", roomId);
        game.isMultiplayer = true;
        roomRef = db.ref('rooms/' + roomId);
        
        // Load room data
        const snapshot = await roomRef.once('value');
        roomData = snapshot.val();
        
        if (!roomData) {
            alert("Phòng không tồn tại!");
            window.location.href = 'lobby.html';
            return;
        }

        this.setupSittingOrder();
        this.listenToState();
        
        if (Account.uid === roomData.host) {
            // Wait for other players to be ready and listener to attach
            setTimeout(() => this.initGame(), 500);
        }
    },

    setupSittingOrder() {
        const players = Object.values(roomData.players).sort((a, b) => a.joinedAt - b.joinedAt);
        playersOrder = players.map(p => p.uid);
        myPlayerIndex = playersOrder.indexOf(Account.uid);
        
        const seatIds = ['south-area', 'west-area', 'north-area', 'east-area'];
        const labelIds = ['player-name', 'west-name', 'north-name', 'east-name'];

        // Hide all non-player seats first
        for (let seat = 1; seat < 4; seat++) {
            const relativePos = seat;
            const seatEl = document.getElementById(seatIds[relativePos]);
            if (seatEl) seatEl.style.display = 'none';
        }

        // Show and label each real player
        playersOrder.forEach((uid, idx) => {
            const relativePos = (idx - myPlayerIndex + 4) % 4;
            const seatEl = document.getElementById(seatIds[relativePos]);
            const labelEl = document.getElementById(labelIds[relativePos]);
            if (seatEl) seatEl.style.display = '';
            if (labelEl) {
                labelEl.textContent = uid === Account.uid ? 'Bạn' : roomData.players[uid].name;
            }
        });

        game.playerNames = playersOrder.map(uid => roomData.players[uid].name);
    },

    listenToState() {
        roomRef.child('state').on('value', (snapshot) => {
            const state = snapshot.val();
            if (!state) return;
            this.handleStateUpdate(state);
        });
    },

    getMyPlayerIndex() {
        return myPlayerIndex;
    },

    async initGame() {
        // Initial game state setup (Host only)
        const d = new Deck();
        const handsRaw = d.deal(playersOrder.length);
        
        const hands = {};
        playersOrder.forEach((uid, i) => {
            hands[uid] = handsRaw[i].map(c => c.id);
        });

        const initialState = {
            currentTurn: 0,
            lastMove: null,
            lastPlayer: -1,
            passCount: 0,
            isNewRound: true,
            hands: hands,
            history: [],
            status: 'playing',
            winner: null
        };

        await roomRef.child('state').set(initialState);
    },

    handleStateUpdate(state) {
        // Update core game engine state
        game.currentPlayer = state.currentTurn;
        game.passCount = state.passCount;
        game.isNewRound = state.isNewRound;
        game.lastPlayedBy = state.lastPlayer;
        
        // Reconstruct Card objects for the local game engine
        if (state.lastMove) {
            game.lastPlayedCards = state.lastMove.map(id => Card.fromId(id));
        } else {
            game.lastPlayedCards = null;
        }

        // Update all hands (multiplayer needs to map correct hand to correct engine index)
        playersOrder.forEach((uid, idx) => {
            const cardIds = state.hands[uid] || [];
            game.hands[idx] = cardIds.map(id => Card.fromId(id));
        });

        // Check winner
        if (state.winner) {
            const winnerIdx = playersOrder.indexOf(state.winner);
            game.winner = winnerIdx;
            game.gameOver = true;
            ui.showGameOver(winnerIdx);
            return;
        }

        // Update UI
        ui.render();
        ui.updateCardCounts();
        
        // If it was just my turn being updated by a background sync, might need to re-render buttons
        ui.updateButtons();
    },

    async playCards(cards) {
        const cardIds = cards.map(c => c.id);
        let nextTurn = (game.currentPlayer + 1) % playersOrder.length;
        
        // Skip players with no cards
        let safety = 0;
        while ((roomData.state?.hands?.[playersOrder[nextTurn]]?.length || 0) === 0 && safety < 4) {
            nextTurn = (nextTurn + 1) % playersOrder.length;
            safety++;
        }

        const stateUpdate = {
            currentTurn: nextTurn,
            lastMove: cardIds,
            lastPlayer: myPlayerIndex,
            passCount: 0,
            isNewRound: false
        };

        // Update my hand
        const remainingCardIds = game.hands[myPlayerIndex]
            .filter(c => !cardIds.includes(c.id))
            .map(c => c.id);
        
        // Use transaction or separate updates
        await roomRef.child('state').update(stateUpdate);
        await roomRef.child('state/hands/' + Account.uid).set(remainingCardIds);

        // Check win
        if (remainingCardIds.length === 0) {
            await roomRef.child('state/winner').set(Account.uid);
            await roomRef.child('state/status').set('ended');
        }
    },

    async passTurn() {
        const newPassCount = game.passCount + 1;
        let nextTurn = (game.currentPlayer + 1) % playersOrder.length;
        let isNewRound = false;

        // Skip players with no cards
        let safety = 0;
        const hands = (await roomRef.child('state/hands').once('value')).val();
        while ((hands[playersOrder[nextTurn]]?.length || 0) === 0 && safety < 4) {
            nextTurn = (nextTurn + 1) % playersOrder.length;
            safety++;
        }

        if (newPassCount >= playersOrder.length - 1) {
            isNewRound = true;
            nextTurn = game.lastPlayedBy; // Last player who played starts again
        }

        const stateUpdate = {
            currentTurn: nextTurn,
            passCount: isNewRound ? 0 : newPassCount,
            isNewRound: isNewRound
        };
        
        if (isNewRound) {
            stateUpdate.lastMove = null;
        }

        await roomRef.child('state').update(stateUpdate);
    }
};

window.MP_TienLen = MP_TienLen;
window.addEventListener('load', () => MP_TienLen.init());
