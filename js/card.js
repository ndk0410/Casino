// ============================================================
// card.js - Card Model & Deck for Tiến Lên Miền Nam
// ============================================================

const SUITS = ['s', 'c', 'd', 'h']; // ♠ < ♣ < ♦ < ♥
const SUIT_NAMES = { s: 'Bích', c: 'Tép', d: 'Rô', h: 'Cơ' };
const SUIT_SYMBOLS = { s: '♠', c: '♣', d: '♦', h: '♥' };

// Rank order for Tiến Lên: 3 is lowest, 2 is highest
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'j', 'q', 'k', 'a', '2'];
const RANK_NAMES = {
    '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    '8': '8', '9': '9', '10': '10', 'j': 'J', 'q': 'Q',
    'k': 'K', 'a': 'A', '2': '2'
};

class Card {
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
        this.rankValue = RANKS.indexOf(rank);   // 0 (3) → 12 (2)
        this.suitValue = SUITS.indexOf(suit);    // 0 (♠) → 3 (♥)
        this.id = `${rank}${suit}`;
        this.imagePath = `52 playing card/${rank}${suit}.png`;
    }

    static fromId(id) {
        if (!id) return null;
        const rank = id.length === 3 ? id.substring(0, 2) : id.charAt(0);
        const suit = id.charAt(id.length - 1);
        return new Card(rank, suit);
    }

    // Overall card value for comparison (rank is primary, suit is tiebreaker)
    get value() {
        return this.rankValue * 4 + this.suitValue;
    }

    get displayName() {
        return `${RANK_NAMES[this.rank]}${SUIT_SYMBOLS[this.suit]}`;
    }

    // Compare this card to another: positive = this is higher
    compareTo(other) {
        if (this.rankValue !== other.rankValue) {
            return this.rankValue - other.rankValue;
        }
        return this.suitValue - other.suitValue;
    }

    // Check if this card beats another single card
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
        // Fisher-Yates shuffle
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(numPlayers = 4) {
        this.shuffle();
        const hands = Array.from({ length: numPlayers }, () => []);
        for (let i = 0; i < this.cards.length; i++) {
            hands[i % numPlayers].push(this.cards[i]);
        }
        // Sort each hand by value
        hands.forEach(hand => hand.sort((a, b) => a.value - b.value));
        return hands;
    }
}

// Utility: sort cards by value
function sortCards(cards) {
    return [...cards].sort((a, b) => a.value - b.value);
}

// Utility: find card with specific rank and suit
function findCard(cards, rank, suit) {
    return cards.find(c => c.rank === rank && c.suit === suit);
}

// Utility: get the highest card in a set
function getHighestCard(cards) {
    return cards.reduce((max, card) => card.value > max.value ? card : max, cards[0]);
}
