const TienLenEngine = require('../engine/TienLenEngine');

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
        const winAmount = this.engine.bets[winnerId] || 100;
        
        for (const p of this.players) {
            if (p.isBot) continue;
            if (p.id === winnerId) {
                // Winner gets the sum of all other players' bets (simplified)
                // Actually closer to: winner gets 1x bet from each person who lost
                let totalGained = 0;
                this.players.forEach(other => {
                    if (other.id !== winnerId) {
                        totalGained += (this.engine.bets[other.id] || 100);
                    }
                });
                changes[p.id] = totalGained;
            } else {
                changes[p.id] = -(this.engine.bets[p.id] || 100);
            }
        }
        return changes;
    }

    handleAction(socketId, payload, io) {
        if (payload.action === 'start_game') {
            const player = this.players.find(p => p.id === socketId);
            if (player && player.isHost) {
                this.gameState = 'BETTING';
                
                // Initialize engine but don't deal cards yet
                this.engine = new TienLenEngine(this.players, (event, data) => {
                    io.to(this.id).emit(event, data);
                });

                // Notify room that game state moved to BETTING
                io.to(this.id).emit('room_state_update', this.getState());
            }
        } else if (payload.action === 'place_bet') {
            if (this.gameState === 'BETTING') {
                this.engine.setBet(socketId, payload.amount);
                
                // Check if all human players have bet
                const humans = this.players.filter(p => !p.isBot);
                const allBet = humans.every(p => this.engine.bets[p.id] !== undefined);
                
                if (allBet) {
                    // Automatically set bets for bots
                    for (const p of this.players) {
                        if (p.isBot && this.engine.bets[p.id] === undefined) {
                            this.engine.setBet(p.id, 100);
                        }
                    }

                    this.gameState = 'PLAYING';
                    this.engine.start(); // This deals cards and broadcasts game_state_update
                    
                    io.to(this.id).emit('room_state_update', this.getState());
                    
                    // Privately emit initial hands
                    for (const p of this.players) {
                        io.to(p.id).emit('private_hand', this.engine.hands[p.id]);
                    }
                } else {
                    // Update room state so others see who bet
                    io.to(this.id).emit('room_state_update', this.getState());
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
