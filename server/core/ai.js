const { detectMoveType, MoveType, findAllValidMoves } = require('./rules');
const { getHighestCard } = require('./card');

class AIPlayer {
    constructor(id, name, difficulty = 'medium') {
        this.id = id;
        this.name = name;
        this.difficulty = difficulty;
    }

    chooseMove(hand, currentCards, isNewRound, gameState) {
        const validMoves = findAllValidMoves(hand, currentCards, isNewRound);

        if (validMoves.length === 0) {
            return null; // Must pass
        }

        if (this.difficulty === 'easy') {
            // Very stupid, just play smallest valid combo blindly
            return this.pickSmallestMove(validMoves);
        }

        // If new round (free play), use opening strategy
        if (isNewRound) {
            return this.chooseOpeningMove(hand, validMoves, gameState);
        }

        // Try to beat the current play strategically
        return this.chooseBeatMove(hand, validMoves, currentCards, gameState);
    }

    chooseOpeningMove(hand, validMoves, gameState) {
        if (gameState && gameState.mustPlay3Spade) {
            const movesWith3S = validMoves.filter(m =>
                m.cards.some(c => c.rank === '3' && c.suit === 's')
            );
            if (movesWith3S.length > 0) {
                const combos = movesWith3S.filter(m => m.type !== MoveType.SINGLE);
                if (combos.length > 0) {
                    return this.pickSmallestMove(combos);
                }
                return movesWith3S[0].cards;
            }
        }

        const nonTwoMoves = validMoves.filter(m => !m.cards.some(c => c.isTwo()));

        const sequences = nonTwoMoves.filter(m =>
            m.type === MoveType.SEQUENCE || m.type === MoveType.SEQUENCE_PAIRS
        );
        if (sequences.length > 0) {
            return this.pickSmallestMove(sequences);
        }

        const multiCards = nonTwoMoves.filter(m =>
            m.type === MoveType.PAIR || m.type === MoveType.TRIPLE
        );
        if (multiCards.length > 0) {
            return this.pickSmallestMove(multiCards);
        }

        const singles = nonTwoMoves.filter(m => m.type === MoveType.SINGLE);
        if (singles.length > 0) {
            return singles[0].cards; // lowest single
        }

        return this.pickSmallestMove(validMoves);
    }

    chooseBeatMove(hand, validMoves, currentCards, gameState) {
        const currentMove = detectMoveType(currentCards);
        const nonTwoMoves = validMoves.filter(m => !m.cards.some(c => c.isTwo()));

        if (hand.length <= 3) {
            return this.pickSmallestMove(validMoves);
        }

        // Hard mode: Never use 2s unless it's necessary to block a win or less than 5 cards left
        if (this.difficulty === 'hard' && hand.length > 5 && validMoves.some(m => m.cards.some(c => c.isTwo()))) {
            if (nonTwoMoves.length === 0 && Math.random() < 0.8) {
                return null; // Pass instead of wasting a 2 early
            }
        }

        if (currentMove.type === MoveType.SINGLE && currentCards[0].isTwo()) {
            const chatMoves = validMoves.filter(m =>
                m.type === MoveType.FOUR_OF_KIND ||
                (m.type === MoveType.SEQUENCE_PAIRS && m.length >= 3)
            );
            if (chatMoves.length > 0) {
                return chatMoves[0].cards;
            }
        }

        if (currentMove.type === MoveType.PAIR && currentCards[0].isTwo()) {
            const chatMoves = validMoves.filter(m =>
                m.type === MoveType.FOUR_OF_KIND ||
                (m.type === MoveType.SEQUENCE_PAIRS && m.length >= 4)
            );
            if (chatMoves.length > 0) {
                return chatMoves[0].cards;
            }
        }

        if (nonTwoMoves.length > 0) {
            if (this.difficulty === 'hard' && Math.random() < 0.3 && hand.length > 5) {
                return null; // Strategic pass
            }
            if (this.difficulty === 'medium' && Math.random() < 0.15 && hand.length > 5) {
                return null;
            }
            return this.pickSmallestMove(nonTwoMoves);
        }

        if (hand.length <= 5 || this.difficulty !== 'hard') {
            return this.pickSmallestMove(validMoves);
        }

        return null;
    }

    pickSmallestMove(moves) {
        moves.sort((a, b) => {
            const highA = getHighestCard(a.cards);
            const highB = getHighestCard(b.cards);
            return highA.value - highB.value;
        });
        return moves[0].cards;
    }
}

module.exports = AIPlayer;
