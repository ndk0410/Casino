const TienLenEngine = require('../core/TienLenEngine');

const BOT_PROFILES = [
    { name: 'Bot Co Van', difficulty: 'easy' },
    { name: 'Bot Tay To', difficulty: 'medium' },
    { name: 'Bot Nha Cai', difficulty: 'hard' }
];

class GameRoom {
    constructor(id, hostId, hostName) {
        this.id = id;
        this.players = [];
        this.gameState = 'LOBBY';
        this.engine = null;
        this.addPlayer({ id: hostId, name: hostName, isHost: true });
    }

    getHumanPlayers() {
        return this.players.filter((player) => !player.isBot);
    }

    getBotPlayers() {
        return this.players.filter((player) => player.isBot);
    }

    canStartGame() {
        return this.getHumanPlayers().length >= 2;
    }

    addPlayer(playerParam) {
        if (this.gameState !== 'LOBBY') {
            return { success: false, message: 'Game already started' };
        }
        if (this.players.length >= 4) {
            return { success: false, message: 'Room is full (max 4)' };
        }
        if (this.players.find((player) => player.id === playerParam.id)) {
            return { success: false, message: 'Already in room' };
        }

        this.players.push({
            id: playerParam.id,
            name: playerParam.name,
            isHost: playerParam.isHost || this.players.length === 0,
            isBot: playerParam.isBot || false,
            difficulty: playerParam.difficulty || 'medium',
            isReady: true
        });

        return { success: true };
    }

    removePlayer(socketId) {
        this.players = this.players.filter((player) => player.id !== socketId);
        if (this.players.length > 0 && !this.players.find((player) => player.isHost && !player.isBot)) {
            const nextHuman = this.players.find((player) => !player.isBot);
            if (nextHuman) nextHuman.isHost = true;
        }
        return this.players.length === 0;
    }

    ensureBotSeats() {
        this.players = this.players.filter((player) => !player.isBot);
        let botIndex = 0;
        while (this.players.length < 4) {
            const profile = BOT_PROFILES[botIndex % BOT_PROFILES.length];
            this.players.push({
                id: `bot_${this.id}_${botIndex + 1}`,
                name: profile.name,
                isHost: false,
                isBot: true,
                difficulty: profile.difficulty,
                isReady: true
            });
            botIndex += 1;
        }
    }

    resetToLobbyState() {
        this.gameState = 'LOBBY';
        this.engine = null;
        this.players = this.players.filter((player) => !player.isBot);
        this.players.forEach((player, index) => {
            player.isHost = index === 0;
        });
    }

    calculateELO(winnerId) {
        const changes = {};
        for (const player of this.players) {
            if (player.isBot) continue;
            changes[player.id] = player.id === winnerId ? 25 : -10;
        }
        return changes;
    }

    calculateChips(winnerId) {
        const changes = {};
        for (const player of this.players) {
            if (player.isBot) continue;
            if (player.id === winnerId) {
                let totalGained = 0;
                this.players.forEach((other) => {
                    if (other.id !== winnerId) {
                        totalGained += this.engine.bets[other.id] || 100;
                    }
                });
                changes[player.id] = totalGained;
            } else {
                changes[player.id] = -(this.engine.bets[player.id] || 100);
            }
        }
        return changes;
    }

    startBetting(io) {
        if (!this.canStartGame()) {
            return { success: false, message: 'Can it nhat 2 nguoi choi that de bat dau.' };
        }

        this.ensureBotSeats();
        this.gameState = 'BETTING';
        this.engine = new TienLenEngine(this.players, (event, data) => {
            io.to(this.id).emit(event, data);
        });

        io.to(this.id).emit('room_state_update', this.getState());
        return { success: true };
    }

    handleAction(socketId, payload, io) {
        if (payload.action === 'start_game') {
            const player = this.players.find((entry) => entry.id === socketId);
            if (!player || !player.isHost) {
                io.to(socketId).emit('error_message', 'Chi chu phong moi duoc bat dau van.');
                return;
            }

            const result = this.startBetting(io);
            if (!result.success) {
                io.to(socketId).emit('error_message', result.message);
            }
            return;
        }

        if (payload.action === 'place_bet') {
            if (!this.engine || this.gameState !== 'BETTING') return;

            this.engine.setBet(socketId, payload.amount);
            const humans = this.players.filter((player) => !player.isBot);
            const allHumansBet = humans.every((player) => this.engine.bets[player.id] !== undefined);

            if (!allHumansBet) {
                io.to(this.id).emit('room_state_update', this.getState());
                return;
            }

            for (const player of this.players) {
                if (player.isBot && this.engine.bets[player.id] === undefined) {
                    this.engine.setBet(player.id, Math.max(100, Math.min(250000, payload.amount || 100)));
                }
            }

            this.gameState = 'PLAYING';
            this.engine.start();
            io.to(this.id).emit('room_state_update', this.getState());

            for (const player of this.players) {
                if (!player.isBot) {
                    io.to(player.id).emit('private_hand', this.engine.hands[player.id]);
                }
            }
            return;
        }

        if (!this.engine || this.gameState !== 'PLAYING') return;

        if (payload.action === 'play_cards') {
            const result = this.engine.playCards(socketId, payload.cards);
            if (!result.success) {
                io.to(socketId).emit('error_message', result.message);
                return;
            }

            if (this.engine.gameOver) {
                const eloChanges = this.calculateELO(this.engine.winner);
                const chipChanges = this.calculateChips(this.engine.winner);
                io.to(this.id).emit('elo_update', eloChanges);
                io.to(this.id).emit('chip_update', chipChanges);
                this.resetToLobbyState();
                io.to(this.id).emit('room_state_update', this.getState());
                return;
            }

            io.to(socketId).emit('private_hand', this.engine.hands[socketId]);
            return;
        }

        if (payload.action === 'pass_turn') {
            const result = this.engine.passTurn(socketId);
            if (!result.success) {
                io.to(socketId).emit('error_message', result.message);
            }
        }
    }

    handleDisconnect(socketId, io) {
        const player = this.players.find((entry) => entry.id === socketId);
        if (!player) {
            return { isEmpty: this.players.length === 0 };
        }

        if (this.gameState === 'PLAYING' && this.engine && !player.isBot) {
            player.isBot = true;
            player.isHost = false;
            player.name = `${player.name} (Bot tiep quan)`;
            player.difficulty = 'medium';
            this.engine.replacePlayerWithBot(socketId, player.name, player.difficulty);
            const humansLeft = this.getHumanPlayers();
            if (humansLeft.length > 0 && !humansLeft.find((entry) => entry.isHost)) {
                humansLeft[0].isHost = true;
            }
            io.to(this.id).emit('room_state_update', this.getState());
            return { isEmpty: false };
        }

        const isEmpty = this.removePlayer(socketId);
        if (!isEmpty) {
            io.to(this.id).emit('room_state_update', this.getState());
        }
        return { isEmpty };
    }

    getState() {
        return {
            roomId: this.id,
            players: this.players,
            gameState: this.gameState,
            minHumansToStart: 2,
            humanCount: this.getHumanPlayers().length,
            botCount: this.getBotPlayers().length,
            canStart: this.canStartGame(),
            engineState: this.engine ? this.engine.getState() : null
        };
    }
}

module.exports = GameRoom;
