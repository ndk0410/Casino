// ============================================================
// game.js - Game State Manager for Tien Len Mien Nam
// ============================================================

class Game {
    constructor() {
        this.deck = new Deck();
        this.hands = [];
        this.currentPlayer = 0;
        this.lastPlayedCards = null;
        this.lastPlayedBy = -1;
        this.passCount = 0;
        this.isNewRound = true;
        this.gameOver = false;
        this.winner = -1;
        this.mustPlay3Spade = true;
        this.playerNames = ['Ban', 'Dealer 1', 'Dealer 2', 'Dealer 3'];
        this.aiPlayers = [null, new AIPlayer(1), new AIPlayer(2), new AIPlayer(3)];
        this.selectedCards = [];
        this.turnHistory = [];
        this.isAnimating = false;
        this.aiChips = [0, 1000, 1000, 1000];
        this.isMultiplayer = false;
        this.myIndex = 0;
        this.bet = 100;
        this.humanBetEscrowed = false;
    }

    async newGame(betAmount = 100) {
        if (this.isMultiplayer) return;
        if (betAmount < 100) return false;
        if (Account.chips < betAmount) {
            ui.showMessage(`Không đủ chip để vào ván ${betAmount.toLocaleString()}!`);
            return false;
        }

        this.bet = betAmount;
        const escrowed = await Account.deductChips(betAmount);
        if (!escrowed) {
            ui.showMessage('Không thể giữ cược cho ván mới.');
            return false;
        }

        this.humanBetEscrowed = true;

        try {
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
            this.isAnimating = true;

            audioManager.shuffle();
            ui.hideGameOver();
            ui.updateChipDisplay();
            await ui.startRoundPresentation();
            this.isAnimating = false;
            ui.render();
            return true;
        } catch (error) {
            this.humanBetEscrowed = false;
            await Account.addChips(betAmount);
            this.isAnimating = false;
            ui.updateChipDisplay();
            ui.showMessage('Lỗi khởi tạo ván bài. Đã hoàn lại cược.');
            console.error('Tien Len newGame failed:', error);
            return false;
        }
    }

    getGameState() {
        return {
            mustPlay3Spade: this.mustPlay3Spade,
            currentPlayer: this.currentPlayer,
            passCount: this.passCount,
            handsCount: this.hands.map((hand) => hand.length),
            isNewRound: this.isNewRound
        };
    }

    toggleCardSelection(card) {
        const index = this.selectedCards.findIndex((selected) => selected.id === card.id);
        if (index >= 0) {
            this.selectedCards.splice(index, 1);
            audioManager.cardDeselect();
        } else {
            this.selectedCards.push(card);
            audioManager.cardSelect();
        }
    }

    playSelectedCards() {
        const myIdx = this.isMultiplayer ? this.myIndex : 0;
        if (this.currentPlayer !== myIdx || this.gameOver || this.isAnimating) return false;
        if (this.selectedCards.length === 0) return false;

        const sorted = sortCards(this.selectedCards);
        if (this.mustPlay3Spade && !sorted.some((card) => card.rank === '3' && card.suit === 's')) {
            audioManager.invalidMove();
            return false;
        }

        const result = canBeatMove(sorted, this.lastPlayedCards, this.isNewRound);
        if (!result.valid) {
            ui.showMessage(result.reason);
            audioManager.invalidMove();
            return false;
        }

        if (this.isMultiplayer) {
            window.MP_TienLen.playCards(sorted);
            return true;
        }

        this.executePlay(0, sorted, result.reason);
        return true;
    }

    async executePlay(playerIndex, cards, specialMessage = '') {
        for (const card of cards) {
            const idx = this.hands[playerIndex].findIndex((entry) => entry.id === card.id);
            if (idx >= 0) this.hands[playerIndex].splice(idx, 1);
        }

        this.lastPlayedCards = cards;
        this.lastPlayedBy = playerIndex;
        this.passCount = 0;
        this.isNewRound = false;
        if (this.mustPlay3Spade) this.mustPlay3Spade = false;

        const moveType = detectMoveType(cards);
        this.turnHistory.push({
            player: playerIndex,
            cards: cards.map((card) => card.id),
            type: moveType.type
        });

        if (moveType.type === MoveType.FOUR_OF_KIND || moveType.type === MoveType.SEQUENCE_PAIRS) {
            audioManager.cardSlam();
        } else {
            audioManager.cardPlay();
        }

        if (this.hands[playerIndex].length === 0) {
            this.gameOver = true;
            this.winner = playerIndex;

            if (playerIndex === 0) {
                let totalWon = 0;
                for (let i = 1; i < 4; i += 1) {
                    this.aiChips[i] -= this.bet;
                    totalWon += this.bet;
                }

                if (totalWon > 0 || this.humanBetEscrowed) {
                    const payout = totalWon + (this.humanBetEscrowed ? this.bet : 0);
                    await Account.addChips(payout);
                    await ui.animateChipTransfer({ toPlayer: true, amount: totalWon });
                    ui.showMessage(`Ban thang ${totalWon.toLocaleString()} chip!`);
                }

                this.humanBetEscrowed = false;
                specialMessage = `Thang! +${totalWon} chip`;
                audioManager.win();
            } else {
                let totalAIWon = 0;
                const humanLoss = this.humanBetEscrowed ? 0 : this.bet;

                if (humanLoss > 0) {
                    await Account.deductChips(humanLoss);
                    await ui.animateChipTransfer({ toPlayer: false, amount: humanLoss });
                    totalAIWon += humanLoss;
                    specialMessage = `Thua mat ${humanLoss} chip!`;
                    ui.showMessage(`Ban thua ${humanLoss.toLocaleString()} chip!`);
                } else {
                    await ui.animateChipTransfer({ toPlayer: false, amount: this.bet });
                    totalAIWon += this.bet;
                    specialMessage = `Thua mat ${this.bet} chip!`;
                    ui.showMessage(`Ban thua ${this.bet.toLocaleString()} chip!`);
                }

                for (let i = 1; i < 4; i += 1) {
                    if (i !== playerIndex) {
                        this.aiChips[i] -= this.bet;
                        totalAIWon += this.bet;
                    }
                }

                this.aiChips[playerIndex] += totalAIWon;
                this.humanBetEscrowed = false;
                audioManager.lose();
            }

            if (window.ui && ui.updateChipDisplay) {
                ui.updateChipDisplay();
            }
        }

        if (playerIndex === 0) {
            this.selectedCards = [];
        }

        ui.render();

        if (specialMessage) {
            ui.showMessage(`${this.playerNames[playerIndex]}: ${specialMessage}`);
        }

        if (this.gameOver) {
            ui.showGameOver(this.winner);
            return;
        }

        this.advanceTurn();
    }

    executePass(playerIndex) {
        this.passCount += 1;
        audioManager.pass();

        this.turnHistory.push({
            player: playerIndex,
            cards: [],
            type: 'pass'
        });

        if (this.passCount >= 3) {
            this.isNewRound = true;
            this.lastPlayedCards = null;
            this.passCount = 0;
            this.currentPlayer = this.lastPlayedBy;
            audioManager.newRound();
            ui.showMessage(`${this.playerNames[this.lastPlayedBy]} bat dau luot moi!`);
            ui.render();

            if (this.currentPlayer !== 0) {
                setTimeout(() => this.executeAITurn(), 1000);
            }
            return;
        }

        this.advanceTurn();
    }

    humanPass() {
        const myIdx = this.isMultiplayer ? this.myIndex : 0;
        if (this.currentPlayer !== myIdx || this.gameOver || this.isAnimating || this.isNewRound) return false;
        if (this.isMultiplayer) {
            window.MP_TienLen.passTurn();
            return true;
        }
        ui.showMessage('Ban bo luot.');
        this.executePass(0);
        return true;
    }

    advanceTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % 4;
        let safety = 0;

        while (this.hands[this.currentPlayer].length === 0 && safety < 4) {
            this.currentPlayer = (this.currentPlayer + 1) % 4;
            safety += 1;
        }

        ui.render();
        if (this.isMultiplayer) return;

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
            ui.showMessage(`${this.playerNames[this.currentPlayer]} bo luot.`);
            this.executePass(this.currentPlayer);
            return;
        }

        const moveType = detectMoveType(move);
        const moveDesc = this.getMoveDescription(moveType, move);
        ui.showMessage(`${this.playerNames[this.currentPlayer]} danh ${moveDesc}`);
        const result = canBeatMove(move, this.lastPlayedCards, this.isNewRound);
        this.executePlay(this.currentPlayer, move, result.reason);
    }

    getMoveDescription(moveType, cards) {
        const sorted = sortCards(cards);
        const names = sorted.map((card) => card.displayName).join(' ');
        switch (moveType.type) {
            case MoveType.SINGLE: return names;
            case MoveType.PAIR: return `doi ${names}`;
            case MoveType.TRIPLE: return `ba ${names}`;
            case MoveType.SEQUENCE: return `sanh ${names}`;
            case MoveType.FOUR_OF_KIND: return `tu quy ${names}`;
            case MoveType.SEQUENCE_PAIRS: return `doi thong ${names}`;
            default: return names;
        }
    }

    getHint() {
        const validMoves = findAllValidMoves(this.hands[0], this.lastPlayedCards, this.isNewRound);
        if (validMoves.length === 0) return null;

        if (this.mustPlay3Spade) {
            const movesWith3S = validMoves.filter((move) => move.cards.some((card) => card.rank === '3' && card.suit === 's'));
            if (movesWith3S.length > 0) return movesWith3S[0].cards;
        }

        validMoves.sort((a, b) => getHighestCard(a.cards).value - getHighestCard(b.cards).value);
        return validMoves[0].cards;
    }
}

const game = new Game();
