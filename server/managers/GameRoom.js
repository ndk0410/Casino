const TienLenEngine = require('../core/TienLenEngine');

class GameRoom {
    constructor(id, hostId, hostName) {
        this.id = id;
        this.players = []; // { id, name, isHost, isReady }
        this.gameState = 'LOBBY'; // LOBBY, PLAYING, ENDED
        this.engine = null; // Will point to TienLenEngine
    }

    addPlayer(playerParam) {
        if (this.players.length >= 4) {
            return { success: false, message: 'Room is full (max 4)' };
        }
        if (this.players.find(p => p.id === playerParam.id)) {
            return { success: false, message: 'Already in room' };
        }
        
        this.players.push({
            id: playerParam.id,
            name: playerParam.name,
            isHost: playerParam.isHost || this.players.length === 0,
            isBot: playerParam.isBot || false,
            difficulty: playerParam.difficulty || 'medium',
            isReady: false
        });
        
        return { success: true };
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.id !== socketId);
        // re-assign host if host left
        if (this.players.length > 0 && !this.players.find(p => p.isHost)) {
            this.players[0].isHost = true;
        }
        return this.players.length === 0; // return true if empty
    }

    calculateELO(winnerId) {
        const changes = {};
        for (const p of this.players) {
            if (p.isBot) continue;
            if (p.id === winnerId) {
                changes[p.id] = 25;
            } else {
                changes[p.id] = -10;
            }
        }
        return changes;
    }

    calculateChips(winnerId) {
        const changes = {};
        for (const p of this.players) {
            if (p.isBot) continue;
            if (p.id === winnerId) {
                changes[p.id] = 500;
            } else {
                changes[p.id] = -100;
            }
        }
        return changes;
    }

    handleAction(socketId, payload, io) {
        if (payload.action === 'start_game') {
            const player = this.players.find(p => p.id === socketId);
            if (player && player.isHost) {
                this.gameState = 'PLAYING';
                
                // Initialize engine
                this.engine = new TienLenEngine(this.players, (event, data) => {
                    io.to(this.id).emit(event, data);
                });
                this.engine.start();

                // Notify room that game state moved from LOBBY to PLAYING
                io.to(this.id).emit('room_state_update', this.getState());

                // Privately emit initial hands to each player socket
                for (const p of this.players) {
                    io.to(p.id).emit('private_hand', this.engine.hands[p.id]);
                }
            }
        } else if (this.engine && this.gameState === 'PLAYING') {
            if (payload.action === 'play_cards') {
                const res = this.engine.playCards(socketId, payload.cards);
                if (!res.success) {
                    io.to(socketId).emit('error_message', res.message);
                } else if (this.engine.gameOver) {
                    this.gameState = 'LOBBY';
                    const eloChanges = this.calculateELO(this.engine.winner);
                    const chipChanges = this.calculateChips(this.engine.winner);
                    
                    io.to(this.id).emit('elo_update', eloChanges);
                    io.to(this.id).emit('chip_update', chipChanges);
                    io.to(this.id).emit('room_state_update', this.getState());
                }
                // When play is successful, private hand updates
                io.to(socketId).emit('private_hand', this.engine.hands[socketId]);

            } else if (payload.action === 'pass_turn') {
                const res = this.engine.passTurn(socketId);
                if (!res.success) {
                    io.to(socketId).emit('error_message', res.message);
                }
            }
        }
    }

    getState() {
        return {
            roomId: this.id,
            players: this.players,
            gameState: this.gameState,
            engineState: this.engine ? this.engine.getState() : null
        };
    }
}

module.exports = GameRoom;
