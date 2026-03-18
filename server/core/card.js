const SUITS = ['s', 'c', 'd', 'h']; // ♠ < ♣ < ♦ < ♥
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a', '2'];

class Card {
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
        this.rankValue = RANKS.indexOf(rank);   // 0 (3) → 12 (2)
        this.suitValue = SUITS.indexOf(suit);    // 0 (♠) → 3 (♥)
        this.id = `${rank}${suit}`;
    }

    static fromId(id) {
        if (!id) return null;
        const rank = id.length === 3 ? id.substring(0, 2) : id.charAt(0);
        const suit = id.charAt(id.length - 1);
        return new Card(rank, suit);
    }

    // Overall card value for comparison
    get value() {
        return this.rankValue * 4 + this.suitValue;
    }

    compareTo(other) {
        if (this.rankValue !== other.rankValue) {
            return this.rankValue - other.rankValue;
        }
        return this.suitValue - other.suitValue;
    }

    beats(other) {
        return this.compareTo(other) > 0;
    }

    isTwo() {
        return this.rank === '2';
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.build();
    }

    build() {
        this.cards = [];
        for (const rank of RANKS) {
            for (const suit of SUITS) {
                this.cards.push(new Card(rank, suit));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(numPlayers = 4, cardsPerPlayer = 13) {
        this.shuffle();
        const hands = Array.from({ length: numPlayers }, () => []);
        for (let i = 0; i < numPlayers * cardsPerPlayer; i++) {
            if (i >= this.cards.length) break;
            hands[i % numPlayers].push(this.cards[i]);
        }
        hands.forEach(hand => hand.sort((a, b) => a.value - b.value));
        return hands;
    }
}

function sortCards(cards) {
    return [...cards].sort((a, b) => a.value - b.value);
}

function getHighestCard(cards) {
    return cards.reduce((max, card) => card.value > max.value ? card : max, cards[0]);
}

module.exports = { Card, Deck, sortCards, getHighestCard };
