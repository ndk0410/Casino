let socket = null;
let roomData = null;
let myPlayerIndex = -1;
let playersOrder = []; // Array of { id, name, isHost }

const Socket_TienLen = {
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('room');
        let isHostStr = urlParams.get('host');
        let isSolo = false;
        
        if (!roomId) { 
            roomId = 'SOLO-' + Math.random().toString(36).substr(2, 6);
            isHostStr = 'true';
            isSolo = true;
        }

        console.log("Socket mode active. Room:", roomId);
        game.isMultiplayer = true;

        if (typeof io === 'undefined') {
            console.error("Socket.io not loaded!");
            return;
        }

        socket = io('http://localhost:8080');

        socket.on('connect', () => {
            console.log("Connected to server:", socket.id);
            socket.emit('join_room', {
                roomId: roomId,
                playerName: Account.username || 'Khách',
                isHost: isHostStr === 'true',
                isSolo: isSolo
            });
        });

        socket.on('room_state_update', (state) => {
            roomData = state;
            this.setupSittingOrder();
            
            // Check if game is not started, show Start button for host
            if (state.gameState === 'LOBBY' && playersOrder[myPlayerIndex]?.isHost) {
                this.showStartButton();
            } else {
                this.hideStartButton();
            }
        });

        socket.on('game_state_update', (state) => {
            this.handleStateUpdate(state);
        });

        socket.on('private_hand', (cardsRaw) => {
            if (!cardsRaw) return;
            const myHand = cardsRaw.map(c => Card.fromId(c.id));
            if (myPlayerIndex !== -1) {
                game.hands[myPlayerIndex] = myHand;
                ui.renderPlayerHand();
                ui.updateCardCounts();
            }
        });

        socket.on('error_message', (msg) => {
            ui.showMessage(msg);
        });

        socket.on('play_action', (data) => {
            audioManager.cardPlay();
        });

        socket.on('pass_action', (data) => {
            audioManager.passTurn();
        });

        socket.on('game_over', (data) => {
            const winnerIdx = playersOrder.findIndex(p => p.id === data.winner);
            game.winner = winnerIdx;
            game.gameOver = true;
            ui.showGameOver(winnerIdx);
        });

        socket.on('chat_reaction', (data) => {
            const senderIdx = playersOrder.findIndex(p => p.id === data.sender);
            if(senderIdx !== -1) ui.showEmoji(senderIdx, data.emoji);
        });

        socket.on('elo_update', (changes) => {
            const myChange = changes[socket.id];
            if (myChange !== undefined) {
                const msg = myChange > 0 ? `🏆 ELO: +${myChange} 📈!` : `💔 ELO: ${myChange} 📉`;
                setTimeout(() => ui.showMessage(msg), 3000); // Show after game over screen settles
            }
        });

        socket.on('chip_update', (changes) => {
            const myChange = changes[socket.id];
            if (myChange !== undefined) {
                const msg = myChange > 0 ? `<img src="../assets/economy/Economy_Cowoncy.png" style="width:16px;vertical-align:middle;"> +${myChange} Chip` : `💸 ${myChange} Chip`;
                setTimeout(() => ui.showMessage(msg), 4500); 
                
                if (typeof Account !== 'undefined' && Account.uid) {
                    if (myChange > 0) {
                        Account.addChips(myChange);
                    } else {
                        Account.deductChips(Math.abs(myChange));
                    }
                }
            }
        });
    },

    setupSittingOrder() {
        if (!roomData || !roomData.players) return;
        
        playersOrder = roomData.players; // [{id, name, isHost}]
        myPlayerIndex = playersOrder.findIndex(p => p.id === socket.id);
        if (myPlayerIndex === -1 && playersOrder.length > 0) {
            myPlayerIndex = 0; 
        }
        
        game.myIndex = myPlayerIndex; // Sync to game engine

        const seatIds = ['south-area', 'west-area', 'north-area', 'east-area'];
        const labelIds = ['player-name', 'west-name', 'north-name', 'east-name'];

        // Hide all non-player seats first
        for (let seat = 1; seat < 4; seat++) {
            const seatEl = document.getElementById(seatIds[seat]);
            if (seatEl) seatEl.style.display = 'none';
        }

        playersOrder.forEach((player, idx) => {
            const relativePos = (idx - myPlayerIndex + 4) % 4;
            const seatEl = document.getElementById(seatIds[relativePos]);
            const labelEl = document.getElementById(labelIds[relativePos]);
            if (seatEl) seatEl.style.display = '';
            if (labelEl) {
                let badge = player.isHost ? '👑 ' : '🤖 ';
                if (relativePos === 0) {
                    badge = '🙋 ';
                    labelEl.innerHTML = `${badge}${player.name} <span class="card-count" id="player-count">0</span>`;
                } else {
                    labelEl.innerHTML = `${badge}${player.name} <span class="player-chips" id="score-${idx}"><img src="../assets/economy/Economy_Cowoncy.png" class="economy-icon" style="width:14px; vertical-align:middle;"> 1,000</span> <span class="card-count" id="${labelIds[relativePos].replace('name', 'count')}">0</span>`;
                }
            }
            
            // Reattach count spans to UI class
            if (relativePos === 0) ui.playerCount = document.getElementById(labelIds[relativePos].replace('name', 'count'));
            if (relativePos === 1) ui.westCount = document.getElementById(labelIds[relativePos].replace('name', 'count'));
            if (relativePos === 2) ui.northCount = document.getElementById(labelIds[relativePos].replace('name', 'count'));
            if (relativePos === 3) ui.eastCount = document.getElementById(labelIds[relativePos].replace('name', 'count'));
        });

        game.playerNames = playersOrder.map(p => p.name);
    },

    getMyPlayerIndex() {
        return myPlayerIndex;
    },

    showStartButton() {
        let btn = document.getElementById('btn-server-start');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btn-server-start';
            btn.className = 'btn btn-play';
            btn.style.position = 'absolute';
            btn.style.top = '10px';
            btn.style.left = '50%';
            btn.style.transform = 'translateX(-50%)';
            btn.style.zIndex = '1000';
            btn.innerHTML = '▶ Bắt Đầu Ván (Host)';
            btn.onclick = () => {
                socket.emit('game_action', { action: 'start_game' });
            };
            document.getElementById('center-area').appendChild(btn);
        }
        btn.style.display = 'block';
    },

    hideStartButton() {
        const btn = document.getElementById('btn-server-start');
        if (btn) btn.style.display = 'none';
    },

    handleStateUpdate(state) {
        if (!state) return;
        game.gameOver = false; // Ensure game is active when state arrives
        const currentIdx = playersOrder.findIndex(p => p.id === state.currentPlayerId);
        game.currentPlayer = currentIdx !== -1 ? currentIdx : 0;
        
        game.isNewRound = state.isNewRound;
        if (state.mustPlay3Spade !== undefined) {
            game.mustPlay3Spade = state.mustPlay3Spade;
        }
        
        const lastPlayIdx = playersOrder.findIndex(p => p.id === state.lastPlayedBy);
        game.lastPlayedBy = lastPlayIdx !== -1 ? lastPlayIdx : 0;

        // Sync played cards on table
        if (state.lastPlayedCards && state.lastPlayedCards.length > 0) {
            game.lastPlayedCards = state.lastPlayedCards.map(c => Card.fromId(c.id));
        } else {
            game.lastPlayedCards = null;
        }

        // Apply hand counts to UI (masking logic)
        // We set empty arrays of correct length so UI renders back covers
        playersOrder.forEach((p, idx) => {
            if (idx !== myPlayerIndex) {
                const count = state.handsCount[p.id] || 0;
                game.hands[idx] = Array.from({length: count}).fill(new Card('3', 's')); // Dummy cards for back rendering
            }
        });

        // Trigger UI updates
        ui.renderPlayArea();
        ui.renderAIHands();
        ui.updateTurnIndicator();
        ui.updateCardCounts();
        ui.updateButtons();
        ui.renderPlayerHand(); // Crucial to re-bind click/drag listeners when turns change!
    },

    // Bridge methods
    playCards(cards) {
        // cards are sent to server. The server confirms and we wait for game_state_update
        const cardIds = cards.map(c => c.id);
        socket.emit('game_action', { action: 'play_cards', cards: cardIds });
        game.selectedCards = []; // clear selection instantly
        ui.renderPlayerHand();
    },

    passTurn() {
        socket.emit('game_action', { action: 'pass_turn' });
    },

    sendEmoji(emoji) {
        if(socket) socket.emit('chat_reaction', emoji);
    }
};

window.MP_TienLen = Socket_TienLen;
window.addEventListener('load', () => Socket_TienLen.init());
