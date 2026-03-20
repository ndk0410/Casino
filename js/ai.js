// ============================================================
// ai.js - AI Opponents for Tiến Lên Miền Nam
// ============================================================

class AIPlayer {
    constructor(playerIndex) {
        this.playerIndex = playerIndex;
    }

    /**
     * Decide what to play given the current game state.
     * @param {Card[]} hand - AI's current hand
     * @param {Card[]} currentCards - cards on the table to beat (null if new round)
     * @param {boolean} isNewRound - true if this is a free play
     * @param {object} gameState - full game state for advanced decisions
     * @returns {Card[]|null} - cards to play, or null to pass
     */
    chooseMove(hand, currentCards, isNewRound, gameState) {
        const validMoves = findAllValidMoves(hand, currentCards, isNewRound);

        if (validMoves.length === 0) {
            return null; // Must pass
        }

        // If new round (free play), use opening strategy
        if (isNewRound) {
            return this.chooseOpeningMove(hand, validMoves, gameState);
        }

        // Try to beat the current play strategically
        return this.chooseBeatMove(hand, validMoves, currentCards, gameState);
    }

    chooseOpeningMove(hand, validMoves, gameState) {
        // If must play 3♠ (first turn of game)
        if (gameState && gameState.mustPlay3Spade) {
            const movesWith3S = validMoves.filter(m =>
                m.cards.some(c => c.rank === '3' && c.suit === 's')
            );
            if (movesWith3S.length > 0) {
                // Prefer combos containing 3♠
                const combos = movesWith3S.filter(m => m.type !== MoveType.SINGLE);
                if (combos.length > 0) {
                    return this.pickSmallestMove(combos);
                }
                return movesWith3S[0].cards;
            }
        }

        // Prefer to play lower cards first, prioritize combos
        const nonTwoMoves = validMoves.filter(m => !m.cards.some(c => c.isTwo()));

        // Try sequences first (good to get rid of many cards)
        const sequences = nonTwoMoves.filter(m =>
            m.type === MoveType.SEQUENCE || m.type === MoveType.SEQUENCE_PAIRS
        );
        if (sequences.length > 0 && Math.random() > 0.3) {
            return this.pickSmallestMove(sequences);
        }

        // Try pairs/triples
        const multiCards = nonTwoMoves.filter(m =>
            m.type === MoveType.PAIR || m.type === MoveType.TRIPLE
        );
        if (multiCards.length > 0 && Math.random() > 0.3) {
            return this.pickSmallestMove(multiCards);
        }

        // Fall back to lowest single
        const singles = nonTwoMoves.filter(m => m.type === MoveType.SINGLE);
        if (singles.length > 0) {
            return singles[0].cards;
        }

        // Last resort: play anything
        return this.pickSmallestMove(validMoves);
    }

    chooseBeatMove(hand, validMoves, currentCards, gameState) {
        const currentMove = detectMoveType(currentCards);

        // Filter out moves that use 2s unless necessary
        const nonTwoMoves = validMoves.filter(m => !m.cards.some(c => c.isTwo()));

        // If few cards left (≤3), be aggressive
        if (hand.length <= 3) {
            return this.pickSmallestMove(validMoves);
        }

        // Against a 2, try to chặt if possible
        if (currentMove.type === MoveType.SINGLE && currentCards[0].isTwo()) {
            const chatMoves = validMoves.filter(m =>
                m.type === MoveType.FOUR_OF_KIND ||
                (m.type === MoveType.SEQUENCE_PAIRS && m.cards.length >= 6)
            );
            if (chatMoves.length > 0) {
                return chatMoves[0].cards;
            }
        }

        if (currentMove.type === MoveType.PAIR && currentCards[0].isTwo()) {
            const chatMoves = validMoves.filter(m =>
                m.type === MoveType.FOUR_OF_KIND ||
                (m.type === MoveType.SEQUENCE_PAIRS && m.cards.length >= 8)
            );
            if (chatMoves.length > 0) {
                return chatMoves[0].cards;
            }
        }

        // Use non-2 moves first
        if (nonTwoMoves.length > 0) {
            // Add some randomness - sometimes don't play (pass) even if can
            if (nonTwoMoves.length > 0 && Math.random() < 0.15 && hand.length > 5) {
                return null; // Strategic pass
            }
            return this.pickSmallestMove(nonTwoMoves);
        }

        // If only 2s left as valid moves, consider using them
        if (hand.length <= 5) {
            return this.pickSmallestMove(validMoves);
        }

        // Sometimes pass to save strong cards
        if (Math.random() < 0.4) {
            return null;
        }

        return this.pickSmallestMove(validMoves);
    }

    pickSmallestMove(moves) {
        // Pick the move with the lowest high card (play weakest valid move)
        moves.sort((a, b) => {
            const highA = getHighestCard(a.cards);
            const highB = getHighestCard(b.cards);
            return highA.value - highB.value;
        });
        return moves[0].cards;
    }
}
