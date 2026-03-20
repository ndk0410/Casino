let socket = null;
let roomData = null;
let myPlayerIndex = -1;
let playersOrder = [];

const Socket_TienLen = {
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        let roomId = urlParams.get('room');
        const isHost = urlParams.get('host') === 'true';

        if (!roomId) {
            roomId = `SOLO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            game.isMultiplayer = false;
            return;
        }

        if (typeof io === 'undefined') {
            console.error('Socket.io not loaded');
            return;
        }

        game.isMultiplayer = true;
        const socketUrl =
            window.localStorage.getItem('coca_socket_url') ||
            window.CASINO_SOCKET_URL ||
            (window.location.hostname === 'localhost' ? 'http://localhost:8080' : window.location.origin);

        socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 8,
            reconnectionDelay: 700
        });

        socket.on('connect', () => {
            socket.emit('join_room', {
                roomId,
                playerName: Account.username || 'Khach',
                isHost,
                isSolo: false
            });
        });

        socket.on('connect_error', () => {
            ui.showMessage('Khong ket noi duoc server online.');
        });

        socket.on('room_state_update', (state) => {
            roomData = state;
            this.setupSittingOrder();
            this.syncRoomMeta();
            this.syncLobbyState();
        });

        socket.on('game_state_update', (state) => {
            this.handleStateUpdate(state);
        });

        socket.on('private_hand', (cardsRaw) => {
            if (!cardsRaw || myPlayerIndex === -1) return;
            game.hands[myPlayerIndex] = cardsRaw.map((card) => Card.fromId(card.id));
            ui.render();
        });

        socket.on('error_message', (message) => {
            ui.showMessage(message);
        });

        socket.on('play_action', () => {
            audioManager.cardPlay();
        });

        socket.on('pass_action', () => {
            audioManager.passTurn();
        });

        socket.on('game_over', (data) => {
            const winnerIdx = playersOrder.findIndex((player) => player.id === data.winner);
            game.winner = winnerIdx;
            game.gameOver = true;
            ui.showGameOver(winnerIdx);
        });

        socket.on('chat_reaction', (data) => {
            const senderIdx = playersOrder.findIndex((player) => player.id === data.sender);
            if (senderIdx !== -1) ui.showEmoji(senderIdx, data.emoji);
        });

        socket.on('elo_update', (changes) => {
            const myChange = changes[socket.id];
            if (myChange !== undefined) {
                setTimeout(() => ui.showMessage(myChange > 0 ? `ELO +${myChange}` : `ELO ${myChange}`), 2500);
            }
        });

        socket.on('chip_update', (changes) => {
            const myChange = changes[socket.id];
            if (myChange === undefined) return;
            setTimeout(() => ui.showMessage(myChange > 0 ? `+${myChange} chip` : `${myChange} chip`), 3200);
            if (myChange > 0) {
                Account.addChips(myChange);
            } else {
                Account.deductChips(Math.abs(myChange));
            }
        });

        socket.on('disconnect', () => {
            this.syncRoomMeta('Mat ket noi. Dang thu noi lai...');
        });
    },

    setupSittingOrder() {
        if (!roomData?.players || !socket) return;

        playersOrder = [...roomData.players];
        myPlayerIndex = playersOrder.findIndex((player) => player.id === socket.id);
        game.myIndex = myPlayerIndex >= 0 ? myPlayerIndex : 0;
        game.playerNames = playersOrder.map((player) => player.name);

        const seatIds = ['south-area', 'west-area', 'north-area', 'east-area'];
        const labelIds = ['player-name', 'west-name', 'north-name', 'east-name'];

        for (let seat = 0; seat < 4; seat += 1) {
            const seatEl = document.getElementById(seatIds[seat]);
            if (seatEl) seatEl.style.display = 'none';
        }

        playersOrder.forEach((player, idx) => {
            const relativePos = myPlayerIndex >= 0 ? (idx - myPlayerIndex + playersOrder.length) % playersOrder.length : idx;
            const seatEl = document.getElementById(seatIds[relativePos]);
            const labelEl = document.getElementById(labelIds[relativePos]);
            if (seatEl) seatEl.style.display = '';
            if (labelEl) {
                const suffix = player.isBot ? ' [BOT]' : player.isHost ? ' [HOST]' : '';
                const countId = labelIds[relativePos].replace('name', 'count');
                labelEl.innerHTML = `${player.name}${suffix} <span class="card-count" id="${countId}">0</span>`;
            }
        });

        ui.playerCount = document.getElementById('player-count');
        ui.westCount = document.getElementById('west-count');
        ui.northCount = document.getElementById('north-count');
        ui.eastCount = document.getElementById('east-count');
    },

    syncRoomMeta(overrideText = '') {
        const meta = document.getElementById('room-meta');
        if (!meta || !roomData) return;
        meta.hidden = false;

        if (overrideText) {
            meta.innerHTML = overrideText;
            return;
        }

        meta.innerHTML = `
            <strong>Room ${roomData.roomId}</strong><br>
            Human ${roomData.humanCount || 0}/4, Bot ${roomData.botCount || 0}<br>
            Trang thai: ${roomData.gameState}
        `;
    },

    syncLobbyState() {
        if (!roomData) return;

        const isHost = playersOrder[myPlayerIndex]?.isHost;
        const canStart = !!roomData.canStart;

        if (roomData.gameState === 'LOBBY') {
            ui.hideBettingOverlay();
            this.showStartButton(isHost, canStart);
            if (isHost && !canStart) {
                ui.showMessage('Can them nguoi choi that de bat dau.');
            } else if (!isHost) {
                ui.showMessage('Dang doi chu phong bat dau van.');
            }
            return;
        }

        if (roomData.gameState === 'BETTING') {
            this.hideStartButton();
            if (!roomData.engineState?.bets?.[socket.id]) {
                ui.showBettingOverlay();
                ui.showMessage('Dat cuoc de vao van.');
            } else {
                ui.btnStartGame.disabled = true;
                ui.btnStartGame.textContent = 'DANG DOI...';
            }
            return;
        }

        if (roomData.gameState === 'PLAYING') {
            this.hideStartButton();
            ui.hideBettingOverlay();
        }
    },

    showStartButton(isHost, canStart) {
        let button = document.getElementById('btn-server-start');
        if (!button) {
            button = document.createElement('button');
            button.id = 'btn-server-start';
            button.className = 'btn btn-play';
            button.style.position = 'absolute';
            button.style.top = '10px';
            button.style.left = '50%';
            button.style.transform = 'translateX(-50%)';
            button.style.zIndex = '1000';
            button.onclick = () => socket.emit('game_action', { action: 'start_game' });
            document.getElementById('center-area').appendChild(button);
        }

        if (!isHost) {
            button.style.display = 'none';
            return;
        }

        button.style.display = 'block';
        button.disabled = !canStart;
        button.textContent = canStart ? 'Bat dau van online' : 'Can toi thieu 2 nguoi that';
    },

    hideStartButton() {
        const button = document.getElementById('btn-server-start');
        if (button) button.style.display = 'none';
    },

    handleStateUpdate(state) {
        if (!state) return;

        game.gameOver = false;
        game.isAnimating = false;
        game.currentPlayer = playersOrder.findIndex((player) => player.id === state.currentPlayerId);
        game.isNewRound = state.isNewRound;
        game.mustPlay3Spade = state.mustPlay3Spade;
        game.lastPlayedBy = playersOrder.findIndex((player) => player.id === state.lastPlayedBy);
        game.bet = Math.max(...Object.values(state.bets || { default: 100 }));

        if (state.lastPlayedCards?.length) {
            game.lastPlayedCards = state.lastPlayedCards.map((card) => Card.fromId(card.id));
        } else {
            game.lastPlayedCards = null;
        }

        playersOrder.forEach((player, idx) => {
            if (idx === myPlayerIndex) return;
            const count = state.handsCount?.[player.id] || 0;
            game.hands[idx] = Array.from({ length: count }, (_, cardIndex) => new Card(cardIndex % 2 === 0 ? '3' : '4', cardIndex % 4 === 0 ? 's' : 'c'));
        });

        if (state.gameOver && state.winner) {
            game.winner = playersOrder.findIndex((player) => player.id === state.winner);
            game.gameOver = true;
            ui.showGameOver(game.winner);
            return;
        }

        ui.render();
    },

    playCards(cards) {
        if (!socket) return;
        socket.emit('game_action', { action: 'play_cards', cards: cards.map((card) => card.id) });
        game.selectedCards = [];
        ui.renderPlayerHand();
    },

    passTurn() {
        if (socket) {
            socket.emit('game_action', { action: 'pass_turn' });
        }
    },

    sendEmoji(emoji) {
        if (socket) {
            socket.emit('chat_reaction', emoji);
        }
    },

    placeBet(amount) {
        if (socket) {
            socket.emit('game_action', { action: 'place_bet', amount });
        }
    }
};

window.MP_TienLen = Socket_TienLen;
window.addEventListener('load', () => Socket_TienLen.init());
