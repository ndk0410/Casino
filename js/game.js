// ============================================================
// game.js - Game State Manager for Tiến Lên Miền Nam
// ============================================================

class Game {
    constructor() {
        this.deck = new Deck();
        this.hands = [];           // Array of 4 hands (Card arrays)
        this.currentPlayer = 0;    // Index of current player (0 = human)
        this.lastPlayedCards = null; // Cards on the table
        this.lastPlayedBy = -1;    // Who played last
        this.passCount = 0;        // How many consecutive passes
        this.isNewRound = true;    // True if free play
        this.gameOver = false;
        this.winner = -1;
        this.mustPlay3Spade = true;  // First turn must include 3♠
        this.playerNames = ['Bạn', 'Dealer 1', 'Dealer 2', 'Dealer 3'];
        this.aiPlayers = [null, new AIPlayer(1), new AIPlayer(2), new AIPlayer(3)];
        this.selectedCards = [];   // Human's currently selected cards
        this.turnHistory = [];     // Record of all plays
        this.isAnimating = false;
        this.aiChips = [0, 1000, 1000, 1000]; // Track AI chips
        this.isMultiplayer = false;
    }

    newGame() {
        if (this.isMultiplayer) return; // Managed by mp-tienlen.js
        this.hands = this.deck.deal(4);
        this.currentPlayer = findFirstPlayer(this.hands);
        this.lastPlayedCards = null;
        this.lastPlayedBy = -1;
        this.passCount = 0;
        this.isNewRound = true;
        this.gameOver = false;
        this.winner = -1;
        this.mustPlay3Spade = true;
        this.selectedCards = [];
        this.turnHistory = [];
        this.isAnimating = false;

        audioManager.shuffle();
    }

    getGameState() {
        return {
            mustPlay3Spade: this.mustPlay3Spade,
            currentPlayer: this.currentPlayer,
            passCount: this.passCount,
            handsCount: this.hands.map(h => h.length),
            isNewRound: this.isNewRound
        };
    }

    // Toggle card selection for human player
    toggleCardSelection(card) {
        const index = this.selectedCards.findIndex(c => c.id === card.id);
        if (index >= 0) {
            this.selectedCards.splice(index, 1);
            audioManager.cardDeselect();
        } else {
            this.selectedCards.push(card);
            audioManager.cardSelect();
        }
    }

    // Human attempts to play selected cards
    playSelectedCards() {
        if (this.currentPlayer !== 0 || this.gameOver || this.isAnimating) return false;
        if (this.selectedCards.length === 0) return false;

        const sorted = sortCards(this.selectedCards);

        // First turn must include 3♠
        if (this.mustPlay3Spade) {
            const has3S = sorted.some(c => c.rank === '3' && c.suit === 's');
            if (!has3S) {
                ui.showMessage('Lượt đầu phải đánh bài có 3♠!');
                audioManager.invalidMove();
                return false;
            }
        }

        const result = canBeatMove(sorted, this.lastPlayedCards, this.isNewRound);

        if (!result.valid) {
            ui.showMessage(result.reason);
            audioManager.invalidMove();
            return false;
        }

        // Multiplayer hook
        if (this.isMultiplayer) {
            window.MP_TienLen.playCards(sorted);
            return true;
        }

        // Play the cards
        this.executePlay(0, sorted, result.reason);
        return true;
    }

    executePlay(playerIndex, cards, specialMessage = '') {
        // Remove cards from hand
        for (const card of cards) {
            const idx = this.hands[playerIndex].findIndex(c => c.id === card.id);
            if (idx >= 0) {
                this.hands[playerIndex].splice(idx, 1);
            }
        }

        this.lastPlayedCards = cards;
        this.lastPlayedBy = playerIndex;
        this.passCount = 0;
        this.isNewRound = false;
        if (this.mustPlay3Spade) this.mustPlay3Spade = false;

        this.turnHistory.push({
            player: playerIndex,
            cards: cards.map(c => c.id),
            type: detectMoveType(cards).type
        });

        const moveType = detectMoveType(cards);

        // Play sound
        if (moveType.type === MoveType.FOUR_OF_KIND || 
            moveType.type === MoveType.SEQUENCE_PAIRS) {
            audioManager.cardSlam();
        } else {
            audioManager.cardPlay();
        }

        // Check win
        if (this.hands[playerIndex].length === 0) {
            this.gameOver = true;
            this.winner = playerIndex;
            
            // Calculate chip difference (10 chips per card remaining)
            if (playerIndex === 0) {
                // Human won, AI loses chips = number of their remaining cards * 10
                let totalWon = 0;
                for (let i = 1; i < 4; i++) {
                    const aiLoss = this.hands[i].length * 10;
                    this.aiChips[i] -= aiLoss;
                    totalWon += aiLoss;
                }
                Account.addChips(totalWon);
                specialMessage = `Thắng! +${totalWon} Chip`;
                audioManager.win();
            } else {
                // AI won
                let totalAIWon = 0;
                // Human loses
                const humanLoss = this.hands[0].length * 10;
                if (humanLoss > 0) {
                    Account.deductChips(humanLoss);
                    totalAIWon += humanLoss;
                    specialMessage = `Thua mất ${humanLoss} Chip!`;
                }
                
                // Other AIs lose
                for (let i = 1; i < 4; i++) {
                    if (i !== playerIndex) {
                        const aiLoss = this.hands[i].length * 10;
                        this.aiChips[i] -= aiLoss;
                        totalAIWon += aiLoss;
                    }
                }
                this.aiChips[playerIndex] += totalAIWon;
                if (playerIndex !== 0) audioManager.lose();
            }
            
            // Re-render UI to show new chip balance
            if (window.ui && ui.updateChipDisplay) {
                ui.updateChipDisplay();
            }
        }

        if (playerIndex === 0) {
            this.selectedCards = [];
        }

        // Update UI
        ui.render();

        if (specialMessage) {
            ui.showMessage(`${this.playerNames[playerIndex]}: ${specialMessage}`);
        }

        if (this.gameOver) {
            ui.showGameOver(this.winner);
            return;
        }

        // Move to next player
        this.advanceTurn();
    }

    executePass(playerIndex) {
        this.passCount++;
        audioManager.pass();

        this.turnHistory.push({
            player: playerIndex,
            cards: [],
            type: 'pass'
        });

        // If 3 players passed, the last player who played starts new round
        if (this.passCount >= 3) {
            this.isNewRound = true;
            this.lastPlayedCards = null;
            this.passCount = 0;
            this.currentPlayer = this.lastPlayedBy;
            audioManager.newRound();
            ui.showMessage(`${this.playerNames[this.lastPlayedBy]} bắt đầu lượt mới!`);
            ui.render();

            if (this.currentPlayer !== 0) {
                setTimeout(() => this.executeAITurn(), 1000);
            }
            return;
        }

        this.advanceTurn();
    }

    humanPass() {
        if (this.currentPlayer !== 0 || this.gameOver || this.isAnimating) return;
        if (this.isNewRound) {
            ui.showMessage('Bạn phải đánh bài khi bắt đầu lượt mới!');
            audioManager.invalidMove();
            return;
        }
        if (this.isMultiplayer) {
            window.MP_TienLen.passTurn();
            return;
        }
        ui.showMessage('Bạn bỏ lượt.');
        this.executePass(0);
    }

    advanceTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % 4;

        // Skip players who have no cards
        let safety = 0;
        while (this.hands[this.currentPlayer].length === 0 && safety < 4) {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
            safety++;
        }

        ui.render();
        if (this.isMultiplayer) return; // MP handles turns

        // If it's an AI's turn, execute after delay
        if (this.currentPlayer !== 0 && !this.gameOver) {
            this.isAnimating = true;
            ui.render();
            setTimeout(() => {
                this.isAnimating = false;
                this.executeAITurn();
            }, 800 + Math.random() * 600);
        }
    }

    executeAITurn() {
        if (this.gameOver) return;

        const ai = this.aiPlayers[this.currentPlayer];
        const hand = this.hands[this.currentPlayer];
        const state = this.getGameState();

        const move = ai.chooseMove(hand, this.lastPlayedCards, this.isNewRound, state);

        if (move === null) {
            ui.showMessage(`${this.playerNames[this.currentPlayer]} bỏ lượt.`);
            this.executePass(this.currentPlayer);
        } else {
            const moveType = detectMoveType(move);
            const moveDesc = this.getMoveDescription(moveType, move);
            ui.showMessage(`${this.playerNames[this.currentPlayer]} đánh ${moveDesc}`);
            
            const result = canBeatMove(move, this.lastPlayedCards, this.isNewRound);
            this.executePlay(this.currentPlayer, move, result.reason);
        }
    }

    getMoveDescription(moveType, cards) {
        const sorted = sortCards(cards);
        const names = sorted.map(c => c.displayName).join(' ');
        switch (moveType.type) {
            case MoveType.SINGLE: return names;
            case MoveType.PAIR: return `đôi ${names}`;
            case MoveType.TRIPLE: return `ba ${names}`;
            case MoveType.SEQUENCE: return `sảnh ${names}`;
            case MoveType.FOUR_OF_KIND: return `tứ quý ${names}`;
            case MoveType.SEQUENCE_PAIRS: return `đôi thông ${names}`;
            default: return names;
        }
    }

    // Auto-select hint for human
    getHint() {
        const validMoves = findAllValidMoves(this.hands[0], this.lastPlayedCards, this.isNewRound);
        if (validMoves.length === 0) return null;

        // If must play 3♠
        if (this.mustPlay3Spade) {
            const movesWith3S = validMoves.filter(m =>
                m.cards.some(c => c.rank === '3' && c.suit === 's')
            );
            if (movesWith3S.length > 0) return movesWith3S[0].cards;
        }

        // Return the smallest valid move
        validMoves.sort((a, b) => {
            const highA = getHighestCard(a.cards);
            const highB = getHighestCard(b.cards);
            return highA.value - highB.value;
        });
        return validMoves[0].cards;
    }
}

const game = new Game();
