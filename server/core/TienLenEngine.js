const { Deck, Card, sortCards } = require('./card');
const { canBeatMove } = require('./rules');
const AIPlayer = require('./ai');

class TienLenEngine {
    constructor(players, broadcastCallback) {
        this.players = players; // array of { id, name, isBot, difficulty }
        this.broadcast = broadcastCallback;
        
        this.deck = new Deck();
        this.hands = {}; // playerId -> Card array
        this.aiBots = {};
        this.currentPlayerIdx = 0;
        this.lastPlayedCards = [];
        this.lastPlayedBy = null;
        this.passedPlayers = new Set();
        this.isNewRound = true;
        this.mustPlay3Spade = true;
        this.winner = null;
        this.gameOver = false;
    }

    start() {
        this.deck = new Deck();
        const dealtHands = this.deck.deal(this.players.length);
        
        this.hands = {};
        this.aiBots = {};
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            this.hands[p.id] = dealtHands[i];
            if (p.isBot) {
                this.aiBots[p.id] = new AIPlayer(p.id, p.name, p.difficulty);
            }
        }

        // Find who has 3 Spade
        this.currentPlayerIdx = 0;
        for (let i = 0; i < this.players.length; i++) {
            const has3S = this.hands[this.players[i].id].some(c => c.rank === '3' && c.suit === 's');
            if (has3S) {
                this.currentPlayerIdx = i;
                break;
            }
        }

        this.lastPlayedCards = [];
        this.lastPlayedBy = null;
        this.passedPlayers.clear();
        this.isNewRound = true;
        this.mustPlay3Spade = true;
        this.gameOver = false;
        this.winner = null;

        this._emitState();
        this._checkBotTurn();
    }

    playCards(playerId, cardIds) {
        if (this.gameOver) return { success: false, message: 'Game Over' };
        if (this.players[this.currentPlayerIdx].id !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        // Map IDs to Card objects from hand
        const hand = this.hands[playerId];
        const cardsToPlay = [];
        for (const id of cardIds) {
            const card = hand.find(c => c.id === id);
            if (!card) return { success: false, message: 'Card not in hand' };
            cardsToPlay.push(card);
        }

        // Check if must play 3 spade
        if (this.mustPlay3Spade) {
            const has3S = cardsToPlay.some(c => c.rank === '3' && c.suit === 's');
            if (!has3S) return { success: false, message: 'Must play 3 Spade' };
        }

        // Validate beat
        const result = canBeatMove(cardsToPlay, this.lastPlayedCards, this.isNewRound);
        if (!result.valid) {
            return { success: false, message: result.reason };
        }

        // Execute play
        // Remove from hand
        this.hands[playerId] = hand.filter(c => !cardsToPlay.includes(c));
        
        this.lastPlayedCards = cardsToPlay;
        this.lastPlayedBy = playerId;
        this.isNewRound = false;
        this.mustPlay3Spade = false;

        this.broadcast('play_action', {
            playerId: playerId,
            cards: cardsToPlay
        });

        // Check win
        if (this.hands[playerId].length === 0) {
            this.gameOver = true;
            this.winner = playerId;
            this.broadcast('game_over', { winner: playerId });
        } else {
            this._nextTurn();
        }

        this._emitState();
        return { success: true };
    }

    passTurn(playerId) {
        if (this.gameOver) return { success: false, message: 'Game Over' };
        if (this.players[this.currentPlayerIdx].id !== playerId) {
            return { success: false, message: 'Not your turn' };
        }
        if (this.isNewRound) {
            return { success: false, message: 'Cannot pass on a new round. Free play!' };
        }

        this.passedPlayers.add(playerId);
        
        this.broadcast('pass_action', { playerId });

        this._nextTurn();
        this._emitState();
        return { success: true };
    }

    _nextTurn() {
        let nextIdx = this.currentPlayerIdx;
        let found = false;
        
        // Loop up to N times to find next active player
        for (let i = 0; i < this.players.length; i++) {
            nextIdx = (nextIdx + 1) % this.players.length;
            const nextPlayer = this.players[nextIdx];
            
            // If next player was the one who played last, round resets
            if (nextPlayer.id === this.lastPlayedBy) {
                this.isNewRound = true;
                this.lastPlayedCards = [];
                this.passedPlayers.clear();
                this.currentPlayerIdx = nextIdx;
                found = true;
                break;
            }

            // If player hasn't passed and hasn't won, it's their turn
            if (!this.passedPlayers.has(nextPlayer.id) && this.hands[nextPlayer.id].length > 0) {
                this.currentPlayerIdx = nextIdx;
                found = true;
                break;
            }
        }

        if (!found) {
            // Should not happen unless everyone won or passed
            this.isNewRound = true;
            this.lastPlayedCards = [];
            this.passedPlayers.clear();
        }
        
        this._checkBotTurn();
    }

    _checkBotTurn() {
        const p = this.players[this.currentPlayerIdx];
        if (p && p.isBot && !this.gameOver) {
            setTimeout(() => this._executeBotPlay(p.id), 1500);
        }
    }

    _executeBotPlay(botId) {
        if (this.gameOver) return;
        if (this.players[this.currentPlayerIdx].id !== botId) return;

        const bot = this.aiBots[botId];
        if (!bot) return;

        const hand = this.hands[botId];
        const chosenCards = bot.chooseMove(hand, this.lastPlayedCards, this.isNewRound, {
            mustPlay3Spade: this.mustPlay3Spade
        });

        if (chosenCards && chosenCards.length > 0) {
            this.playCards(botId, chosenCards.map(c => c.id));
        } else {
            this.passTurn(botId);
        }
    }

    _emitState() {
        // Send a masked state to all clients
        this.broadcast('game_state_update', this.getState());
    }

    // Public method to get state (used by ioManager or late joiners)
    getState() {
        // We mask hands: only return number of cards for everyone, the client socket will map it locally
        const handsCount = {};
        for (const p of this.players) {
            handsCount[p.id] = this.hands[p.id] ? this.hands[p.id].length : 0;
        }

        return {
            currentPlayerId: this.players[this.currentPlayerIdx] ? this.players[this.currentPlayerIdx].id : null,
            lastPlayedCards: this.lastPlayedCards,
            lastPlayedBy: this.lastPlayedBy,
            passedPlayers: Array.from(this.passedPlayers),
            isNewRound: this.isNewRound,
            mustPlay3Spade: this.mustPlay3Spade,
            handsCount: handsCount, // map player ID -> count
            gameOver: this.gameOver,
            winner: this.winner
            // NOTE: the server must privately emit actual hands to individuals outside this generic state push
        };
    }
}

module.exports = TienLenEngine;
