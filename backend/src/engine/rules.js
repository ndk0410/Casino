const { sortCards, getHighestCard } = require('./card');

const MoveType = {
    SINGLE: 'single',
    PAIR: 'pair',
    TRIPLE: 'triple',
    SEQUENCE: 'sequence',
    FOUR_OF_KIND: 'four_of_kind',
    SEQUENCE_PAIRS: 'sequence_pairs',
    INVALID: 'invalid'
};

function detectMoveType(cards) {
    if (!cards || cards.length === 0) return { type: MoveType.INVALID };

    const sorted = sortCards(cards);
    const len = sorted.length;

    if (len === 1) {
        return { type: MoveType.SINGLE, highCard: sorted[0] };
    }

    if (len === 2 && sorted[0].rankValue === sorted[1].rankValue) {
        return { type: MoveType.PAIR, highCard: getHighestCard(sorted), rank: sorted[0].rankValue };
    }

    if (len === 3 && sorted[0].rankValue === sorted[1].rankValue && sorted[1].rankValue === sorted[2].rankValue) {
        return { type: MoveType.TRIPLE, highCard: getHighestCard(sorted), rank: sorted[0].rankValue };
    }

    if (len === 4 && sorted[0].rankValue === sorted[1].rankValue &&
        sorted[1].rankValue === sorted[2].rankValue && sorted[2].rankValue === sorted[3].rankValue) {
        return { type: MoveType.FOUR_OF_KIND, highCard: getHighestCard(sorted), rank: sorted[0].rankValue };
    }

    if (len >= 3 && isSequence(sorted)) {
        return { type: MoveType.SEQUENCE, highCard: sorted[len - 1], length: len };
    }

    if (len >= 6 && len % 2 === 0 && isSequencePairs(sorted)) {
        const numPairs = len / 2;
        return { type: MoveType.SEQUENCE_PAIRS, highCard: getHighestCard(sorted), length: numPairs };
    }

    return { type: MoveType.INVALID };
}

function isSequence(sorted) {
    if (sorted.some(c => c.isTwo())) return false;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].rankValue !== sorted[i - 1].rankValue + 1) return false;
    }
    return true;
}

function isSequencePairs(sorted) {
    if (sorted.some(c => c.isTwo())) return false;
    for (let i = 0; i < sorted.length; i += 2) {
        if (sorted[i].rankValue !== sorted[i + 1].rankValue) return false;
    }
    for (let i = 2; i < sorted.length; i += 2) {
        if (sorted[i].rankValue !== sorted[i - 2].rankValue + 1) return false;
    }
    return true;
}

function canBeatMove(newCards, currentCards, isNewRound) {
    const newMove = detectMoveType(newCards);

    if (newMove.type === MoveType.INVALID) {
        return { valid: false, reason: 'Bài không hợp lệ!' };
    }

    if (isNewRound || !currentCards || currentCards.length === 0) {
        return { valid: true, reason: '' };
    }

    const currentMove = detectMoveType(currentCards);

    // Special Rules
    if (newMove.type === MoveType.FOUR_OF_KIND) {
        if (currentMove.type === MoveType.SINGLE && currentCards[0].isTwo()) {
            return { valid: true, reason: 'Tứ quý chặt heo!' };
        }
        if (currentMove.type === MoveType.PAIR && currentCards[0].isTwo()) {
            return { valid: true, reason: 'Tứ quý chặt đôi heo!' };
        }
        if (currentMove.type === MoveType.FOUR_OF_KIND) {
            return newMove.highCard.beats(currentMove.highCard)
                ? { valid: true, reason: '' }
                : { valid: false, reason: 'Tứ quý phải lớn hơn!' };
        }
    }

    if (newMove.type === MoveType.SEQUENCE_PAIRS && newMove.length >= 3) {
        if (currentMove.type === MoveType.SINGLE && currentCards[0].isTwo()) {
            return { valid: true, reason: 'Ba đôi thông chặt heo!' };
        }
    }

    if (newMove.type === MoveType.SEQUENCE_PAIRS && newMove.length >= 4) {
        if (currentMove.type === MoveType.PAIR && currentCards[0].isTwo()) {
            return { valid: true, reason: 'Bốn đôi thông chặt đôi heo!' };
        }
    }

    // Normal play
    if (newMove.type !== currentMove.type) {
        return { valid: false, reason: 'Phải đánh cùng loại bài!' };
    }

    if (newMove.type === MoveType.SEQUENCE && newCards.length !== currentCards.length) {
        return { valid: false, reason: 'Sảnh phải cùng độ dài!' };
    }

    if (newMove.type === MoveType.SEQUENCE_PAIRS && newCards.length !== currentCards.length) {
        return { valid: false, reason: 'Đôi thông phải cùng độ dài!' };
    }

    if (newMove.highCard.beats(currentMove.highCard)) {
        return { valid: true, reason: '' };
    }

    return { valid: false, reason: 'Bài phải lớn hơn!' };
}

function findAllValidMoves(hand, currentCards, isNewRound) {
    const validMoves = [];

    for (const card of hand) {
        const result = canBeatMove([card], currentCards, isNewRound);
        if (result.valid) { validMoves.push({ cards: [card], type: MoveType.SINGLE }); }
    }

    const pairs = findPairs(hand);
    for (const pair of pairs) {
        const result = canBeatMove(pair, currentCards, isNewRound);
        if (result.valid) { validMoves.push({ cards: pair, type: MoveType.PAIR }); }
    }

    const triples = findTriples(hand);
    for (const triple of triples) {
        const result = canBeatMove(triple, currentCards, isNewRound);
        if (result.valid) { validMoves.push({ cards: triple, type: MoveType.TRIPLE }); }
    }

    const fours = findFourOfKind(hand);
    for (const four of fours) {
        const result = canBeatMove(four, currentCards, isNewRound);
        if (result.valid) { validMoves.push({ cards: four, type: MoveType.FOUR_OF_KIND }); }
    }

    const sequences = findSequences(hand);
    for (const seq of sequences) {
        const result = canBeatMove(seq, currentCards, isNewRound);
        if (result.valid) { validMoves.push({ cards: seq, type: MoveType.SEQUENCE }); }
    }

    const seqPairs = findSequencePairs(hand);
    for (const sp of seqPairs) {
        const result = canBeatMove(sp, currentCards, isNewRound);
        if (result.valid) { validMoves.push({ cards: sp, type: MoveType.SEQUENCE_PAIRS }); }
    }

    return validMoves;
}

function findPairs(hand) {
    const pairs = [];
    const byRank = groupByRank(hand);
    for (const rank in byRank) {
        const cards = byRank[rank];
        if (cards.length >= 2) {
            for (let i = 0; i < cards.length; i++) {
                for (let j = i + 1; j < cards.length; j++) {
                    pairs.push([cards[i], cards[j]]);
                }
            }
        }
    }
    return pairs;
}

function findTriples(hand) {
    const triples = [];
    const byRank = groupByRank(hand);
    for (const rank in byRank) {
        const cards = byRank[rank];
        if (cards.length >= 3) {
            for (let i = 0; i < cards.length; i++) {
                for (let j = i + 1; j < cards.length; j++) {
                    for (let k = j + 1; k < cards.length; k++) {
                        triples.push([cards[i], cards[j], cards[k]]);
                    }
                }
            }
        }
    }
    return triples;
}

function findFourOfKind(hand) {
    const fours = [];
    const byRank = groupByRank(hand);
    for (const rank in byRank) {
        const cards = byRank[rank];
        if (cards.length === 4) { fours.push([...cards]); }
    }
    return fours;
}

function findSequences(hand) {
    const sequences = [];
    const nonTwoCards = hand.filter(c => !c.isTwo());
    const rankGroups = groupByRank(nonTwoCards);
    const uniqueRanks = Object.keys(rankGroups).map(Number).sort((a, b) => a - b);

    for (let start = 0; start < uniqueRanks.length; start++) {
        let end = start;
        while (end + 1 < uniqueRanks.length && uniqueRanks[end + 1] === uniqueRanks[end] + 1) { end++; }
        const runLength = end - start + 1;
        if (runLength >= 3) {
            for (let len = 3; len <= runLength; len++) {
                for (let s = start; s + len - 1 <= end; s++) {
                    const rankSlice = uniqueRanks.slice(s, s + len);
                    generateSequenceCombos(rankGroups, rankSlice, 0, [], sequences);
                }
            }
        }
    }
    return sequences;
}

function generateSequenceCombos(rankGroups, ranks, idx, current, results) {
    if (idx === ranks.length) { results.push([...current]); return; }
    const cards = rankGroups[ranks[idx]];
    for (const card of cards) {
        current.push(card);
        generateSequenceCombos(rankGroups, ranks, idx + 1, current, results);
        current.pop();
    }
}

function findSequencePairs(hand) {
    const results = [];
    const nonTwoCards = hand.filter(c => !c.isTwo());
    const byRank = groupByRank(nonTwoCards);
    const pairableRanks = Object.keys(byRank).map(Number).filter(r => byRank[r].length >= 2).sort((a, b) => a - b);

    for (let start = 0; start < pairableRanks.length; start++) {
        let end = start;
        while (end + 1 < pairableRanks.length && pairableRanks[end + 1] === pairableRanks[end] + 1) { end++; }
        const runLength = end - start + 1;
        if (runLength >= 3) {
            for (let len = 3; len <= runLength; len++) {
                for (let s = start; s + len - 1 <= end; s++) {
                    const rankSlice = pairableRanks.slice(s, s + len);
                    generatePairSequenceCombos(byRank, rankSlice, 0, [], results);
                }
            }
        }
    }
    return results;
}

function generatePairSequenceCombos(byRank, ranks, idx, current, results) {
    if (idx === ranks.length) { results.push([...current]); return; }
    const cards = byRank[ranks[idx]];
    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            current.push(cards[i], cards[j]);
            generatePairSequenceCombos(byRank, ranks, idx + 1, current, results);
            current.pop(); current.pop();
        }
    }
}

function groupByRank(cards) {
    const groups = {};
    for (const card of cards) {
        if (!groups[card.rankValue]) { groups[card.rankValue] = []; }
        groups[card.rankValue].push(card);
    }
    return groups;
}

module.exports = { detectMoveType, canBeatMove, MoveType, findAllValidMoves };
