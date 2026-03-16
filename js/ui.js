// ============================================================
// ui.js - User Interface for Tiến Lên Miền Nam
// ============================================================

class UI {
    constructor() {
        this.messageTimeout = null;
    }

    init() {
        this.cacheElements();
        this.bindEvents();
    }

    cacheElements() {
        this.playArea = document.getElementById('play-area');
        this.playAreaCards = document.getElementById('play-area-cards');
        this.playerHand = document.getElementById('player-hand');
        this.westHand = document.getElementById('west-hand');
        this.northHand = document.getElementById('north-hand');
        this.eastHand = document.getElementById('east-hand');
        this.messageEl = document.getElementById('message');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.btnPlay = document.getElementById('btn-play');
        this.btnPass = document.getElementById('btn-pass');
        this.btnNewGame = document.getElementById('btn-new-game');
        this.btnHint = document.getElementById('btn-hint');
        this.btnSound = document.getElementById('btn-sound');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.gameOverMessage = document.getElementById('game-over-message');
        this.btnPlayAgain = document.getElementById('btn-play-again');
        this.westCount = document.getElementById('west-count');
        this.northCount = document.getElementById('north-count');
        this.eastCount = document.getElementById('east-count');
        this.playerCount = document.getElementById('player-count');

        // Score elements
        this.scoreEls = [
            document.getElementById('score-0'),
            document.getElementById('score-1'),
            document.getElementById('score-2'),
            document.getElementById('score-3')
        ];
    }

    bindEvents() {
        this.btnPlay.addEventListener('click', () => game.playSelectedCards());
        this.btnPass.addEventListener('click', () => game.humanPass());
        this.btnNewGame.addEventListener('click', () => {
            game.newGame();
            this.hideGameOver();
            this.render();
            this.showMessage('Ván mới bắt đầu!');
            // If AI goes first
            if (game.currentPlayer !== 0) {
                setTimeout(() => game.executeAITurn(), 1000);
            }
        });
        this.btnHint.addEventListener('click', () => this.showHint());
        this.btnSound.addEventListener('click', () => {
            const enabled = audioManager.toggle();
            this.btnSound.textContent = enabled ? '🔊' : '🔇';
            this.btnSound.title = enabled ? 'Tắt âm thanh' : 'Bật âm thanh';
        });
        this.btnPlayAgain.addEventListener('click', () => {
            game.newGame();
            this.hideGameOver();
            this.render();
            this.showMessage('Ván mới bắt đầu!');
            if (game.currentPlayer !== 0) {
                setTimeout(() => game.executeAITurn(), 1000);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (game.gameOver) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                game.playSelectedCards();
            } else if (e.key === 'Escape' || e.key === 'p') {
                game.humanPass();
            } else if (e.key === 'h') {
                this.showHint();
            }
        });
    }

    render() {
        this.renderPlayerHand();
        this.renderAIHands();
        this.renderPlayArea();
        this.updateTurnIndicator();
        // Initial render
        this.updateScores();
        this.updateChipDisplay();

        // Listen for global account updates
        window.addEventListener('accountUpdated', () => {
            this.updateScores();
            this.updateChipDisplay();
        });
    }

    renderPlayerHand() {
        this.playerHand.innerHTML = '';
        const hand = game.isMultiplayer ? game.hands[window.MP_TienLen?.getMyPlayerIndex() ?? 0] : game.hands[0];
        if (!hand) return;

        const totalCards = hand.length;
        const isMobile = window.innerHeight < 520 || window.innerWidth < 600;

        // Determine if it's the local player's turn
        const isMyTurn = game.isMultiplayer
            ? game.currentPlayer === (window.MP_TienLen?.getMyPlayerIndex() ?? 0)
            : game.currentPlayer === 0;

        hand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card player-card';
            cardEl.dataset.cardId = card.id; // store for in-place toggling

            const isSelected = game.selectedCards.some(c => c.id === card.id);
            if (isSelected) cardEl.classList.add('selected');

            if (isMobile) {
                // Flat layout, reduced overlap so each card is easy to tap
                cardEl.style.setProperty('--rotation', '0deg');
                cardEl.style.setProperty('--translate-y', '0px');
                cardEl.style.margin = '0 -6px'; // less overlap than default
                cardEl.style.zIndex = index;
            } else {
                // Desktop fan layout
                const centerIndex = (totalCards - 1) / 2;
                const offset = index - centerIndex;
                cardEl.style.setProperty('--rotation', `${offset * 2.5}deg`);
                cardEl.style.setProperty('--translate-y', `${Math.abs(offset) * 2}px`);
                cardEl.style.zIndex = index;
            }

            const img = document.createElement('img');
            img.src = card.imagePath;
            img.alt = card.displayName;
            img.draggable = false;
            cardEl.appendChild(img);

            if (isMyTurn && !game.isAnimating) {
                cardEl.classList.add('interactive');
                cardEl.addEventListener('click', () => {
                    // Toggle selection IN PLACE — no re-render, no jumping
                    game.toggleCardSelection(card);
                    const nowSelected = game.selectedCards.some(c => c.id === card.id);
                    cardEl.classList.toggle('selected', nowSelected);
                    this.updateButtons();
                });
            } else {
                cardEl.classList.add('disabled');
            }

            this.playerHand.appendChild(cardEl);
        });
    }

    renderAIHands() {
        if (!game.hands[0]) return; // Not initialized

        if (game.isMultiplayer) {
            const myIdx = window.MP_TienLen.getMyPlayerIndex();
            // Seats are 1: West, 2: North, 3: East
            this.renderAIHand(this.westHand, game.hands[(myIdx + 1) % 4], 'west');
            this.renderAIHand(this.northHand, game.hands[(myIdx + 2) % 4], 'north');
            this.renderAIHand(this.eastHand, game.hands[(myIdx + 3) % 4], 'east');
        } else {
            this.renderAIHand(this.westHand, game.hands[1], 'west');
            this.renderAIHand(this.northHand, game.hands[2], 'north');
            this.renderAIHand(this.eastHand, game.hands[3], 'east');
        }
    }

    renderAIHand(container, hand, position) {
        container.innerHTML = '';
        if (!hand) return;

        // Adjust overlap based on screen size
        const isMobileLandscape = window.innerHeight < 480;
        const northOverlap = isMobileLandscape ? '-20px' : '-40px';
        const sideOverlap  = isMobileLandscape ? '-32px' : '-55px';

        hand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ai-card ai-card-${position}`;

            const img = document.createElement('img');
            img.src = '52 playing card/back.png';
            img.alt = 'Card';
            img.draggable = false;
            cardEl.appendChild(img);

            if (position === 'north') {
                cardEl.style.marginLeft = index === 0 ? '0' : northOverlap;
            } else {
                cardEl.style.marginTop = index === 0 ? '0' : sideOverlap;
            }

            container.appendChild(cardEl);
        });
    }

    renderPlayArea() {
        this.playAreaCards.innerHTML = '';

        if (!game.lastPlayedCards || game.lastPlayedCards.length === 0) {
            if (game.isNewRound) {
                this.playAreaCards.innerHTML = '<div class="play-area-text">Lượt mới - Tự do đánh</div>';
            }
            return;
        }

        const sorted = sortCards(game.lastPlayedCards);
        sorted.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card play-card';
            cardEl.style.animationDelay = `${index * 0.05}s`;

            // Slight spread
            const offset = (index - (sorted.length - 1) / 2) * 15;
            const rotation = (index - (sorted.length - 1) / 2) * 3;
            cardEl.style.transform = `translateX(${offset}px) rotate(${rotation}deg)`;

            const img = document.createElement('img');
            img.src = card.imagePath;
            img.alt = card.displayName;
            img.draggable = false;

            cardEl.appendChild(img);
            this.playAreaCards.appendChild(cardEl);
        });

        // Show who played
        const playerLabel = document.createElement('div');
        playerLabel.className = 'play-area-label';
        playerLabel.textContent = game.playerNames[game.lastPlayedBy];
        this.playAreaCards.appendChild(playerLabel);
    }

    updateTurnIndicator() {
        const names = game.playerNames;
        const current = game.currentPlayer;

        if (game.gameOver) {
            this.turnIndicator.textContent = `🏆 ${names[game.winner]} thắng!`;
            this.turnIndicator.className = 'turn-indicator winner';
        } else if (game.isAnimating) {
            this.turnIndicator.textContent = `⏳ ${names[current]} đang suy nghĩ...`;
            this.turnIndicator.className = 'turn-indicator thinking';
        } else if (current === 0) {
            this.turnIndicator.textContent = '🃏 Lượt của bạn!';
            this.turnIndicator.className = 'turn-indicator your-turn';
        } else {
            this.turnIndicator.textContent = `🎴 Lượt của ${names[current]}`;
            this.turnIndicator.className = 'turn-indicator ai-turn';
        }

        // Highlight active player position
        document.querySelectorAll('.player-area').forEach(el => el.classList.remove('active-player'));
        const positionMap = { 0: 'south', 1: 'west', 2: 'north', 3: 'east' };
        const activeEl = document.getElementById(`${positionMap[current]}-area`);
        if (activeEl) activeEl.classList.add('active-player');
    }

    updateButtons() {
        const isHumanTurn = game.currentPlayer === 0 && !game.gameOver && !game.isAnimating;
        this.btnPlay.disabled = !isHumanTurn || game.selectedCards.length === 0;
        this.btnPass.disabled = !isHumanTurn || game.isNewRound;
        this.btnHint.disabled = !isHumanTurn;
    }

    updateCardCounts() {
        if (game.isMultiplayer) {
            const myIdx = window.MP_TienLen.getMyPlayerIndex();
            if (game.hands[myIdx]) this.playerCount.textContent = game.hands[myIdx].length;
            if (game.hands[(myIdx + 1) % 4]) this.westCount.textContent = game.hands[(myIdx + 1) % 4].length;
            if (game.hands[(myIdx + 2) % 4]) this.northCount.textContent = game.hands[(myIdx + 2) % 4].length;
            if (game.hands[(myIdx + 3) % 4]) this.eastCount.textContent = game.hands[(myIdx + 3) % 4].length;
        } else {
            if (game.hands[0]) this.playerCount.textContent = game.hands[0].length;
            if (game.hands[1]) this.westCount.textContent = game.hands[1].length;
            if (game.hands[2]) this.northCount.textContent = game.hands[2].length;
            if (game.hands[3]) this.eastCount.textContent = game.hands[3].length;
        }
    }

    updateScores() {
        // Player 0 = human, uses Account.chips
        if (this.scoreEls[0]) {
            this.scoreEls[0].textContent = Account.chips.toLocaleString();
        }
        // Players 1-3 = AI, uses game.aiChips
        for (let i = 1; i < 4; i++) {
            if (this.scoreEls[i]) {
                this.scoreEls[i].textContent = game.aiChips[i].toLocaleString();
            }
        }
    }

    updateChipDisplay() {
        if (this.chipValueEl) {
            this.chipValueEl.textContent = Account.chips.toLocaleString();
        }
    }

    showMessage(text) {
        this.messageEl.textContent = text;
        this.messageEl.classList.add('show');

        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.messageEl.classList.remove('show');
        }, 2500);
    }

    showHint() {
        if (game.currentPlayer !== 0 || game.gameOver) return;
        const hint = game.getHint();
        if (hint) {
            game.selectedCards = [...hint];
            this.renderPlayerHand();
            this.updateButtons();
            audioManager.cardSelect();
        } else {
            this.showMessage('Không có nước đi hợp lệ. Hãy bỏ lượt!');
        }
    }

    showGameOver(winner) {
        const isWin = winner === 0;
        this.gameOverOverlay.classList.add('show');
        this.gameOverMessage.innerHTML = isWin
            ? `<span class="win-text">🎉 Bạn đã THẮNG! 🎉</span>`
            : `<span class="lose-text">😞 ${game.playerNames[winner]} thắng rồi!</span>`;
        
        // Add confetti for win
        if (isWin) {
            this.createConfetti();
        }
    }

    hideGameOver() {
        this.gameOverOverlay.classList.remove('show');
        // Remove confetti
        document.querySelectorAll('.confetti').forEach(el => el.remove());
    }

    createConfetti() {
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        for (let i = 0; i < 60; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (2 + Math.random() * 3) + 's';
            document.body.appendChild(confetti);
        }
    }
}

const ui = new UI();

document.addEventListener('DOMContentLoaded', () => {
    ui.chipValueEl = document.getElementById('account-chips-val');
    ui.init();
    ui.updateChipDisplay();
    
    // Skip auto-start if multiplayer
    if (new URLSearchParams(window.location.search).get('room')) return;

    // Auto-start first game
    setTimeout(() => {
        game.newGame();
        ui.render();
        ui.showMessage('Ván mới! Hãy đánh bài đi!');

        // If AI starts first
        if (game.currentPlayer !== 0) {
            ui.showMessage(`${game.playerNames[game.currentPlayer]} có 3♠, đi trước!`);
            setTimeout(() => game.executeAITurn(), 1500);
        } else {
            ui.showMessage('Bạn có 3♠, hãy đi trước!');
        }
    }, 500); // 500ms delay ensures DOM layout is stable before rendering cards
});
