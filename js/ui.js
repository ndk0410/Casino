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
        
        // Drag over play area
        this.playArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.playArea.classList.add('drag-over');
        });
        
        this.playArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.playArea.classList.remove('drag-over');
        });
        
        this.playArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.playArea.classList.remove('drag-over');
            const action = e.dataTransfer.getData('text/plain');
            if (action === 'play_cards') {
                if (!this.btnPlay.disabled) {
                    this.btnPlay.click();
                }
            }
        });

        this.playerHand = document.getElementById('player-hand');
        this.westHand = document.getElementById('west-hand');
        this.northHand = document.getElementById('north-hand');
        this.eastHand = document.getElementById('east-hand');
        
        // Emoji elements
        this.btnEmoji = document.getElementById('btn-emoji');
        this.emojiTray = document.getElementById('emoji-tray');

        this.messageEl = document.getElementById('message');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.btnPlay = document.getElementById('btn-play');
        this.btnPass = document.getElementById('btn-pass');
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
        this.btnPlay.addEventListener('click', () => {
            audioManager.ensureContext();
            if (this.btnPlay.disabled) return;
            this.btnPlay.disabled = true; // Debounce immediately
            const success = game.playSelectedCards();
            if (!success) {
                setTimeout(() => this.updateButtons(), 300); // Reset if invalid local move
            }
        });
        
        this.btnPass.addEventListener('click', () => {
            audioManager.ensureContext();
            if (this.btnPass.disabled) return;
            this.btnPass.disabled = true; // Debounce immediately
            const success = game.humanPass();
            if (!success) {
                setTimeout(() => this.updateButtons(), 300);
            }
        });
        this.btnHint.addEventListener('click', () => {
            audioManager.ensureContext();
            game.autoSelectHint();
        });

        // Emoji listeners
        if (this.btnEmoji) {
            this.btnEmoji.addEventListener('click', (e) => {
                e.stopPropagation();
                const display = this.emojiTray.style.display;
                this.emojiTray.style.display = display === 'none' ? 'flex' : 'none';
            });
        }

        if (this.emojiTray) {
            this.emojiTray.querySelectorAll('span').forEach(span => {
                span.addEventListener('click', () => {
                    const emoji = span.textContent;
                    if (window.MP_TienLen) {
                        window.MP_TienLen.sendEmoji(emoji);
                    } else {
                        // Solo mode local feedback
                        this.showEmoji(0, emoji);
                    }
                    this.emojiTray.style.display = 'none';
                });
            });
        }

        // Close objects when clicking out
        document.addEventListener('click', () => {
            if (this.emojiTray) this.emojiTray.style.display = 'none';
        });

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
            audioManager.ensureContext();
            if (game.gameOver) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                game.playSelectedCards();
            } else if (e.key === 'Escape' || e.key === 'p') {
                this.handlePassAndClear();
            } else if (e.key === 'h') {
                this.showHint();
            }
        });
    }

    handlePassAndClear() {
        const success = game.humanPass();
        if (success !== false) {
             game.selectedCards = [];
             this.renderPlayerHand();
             this.updateButtons();
        }
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

        // Auto-compute overlap on mobile so all cards fit the available width
        let mobileMargin = 0;
        if (isMobile && totalCards > 1) {
            const containerW = this.playerHand.clientWidth || window.innerWidth;
            // Get actual card width from CSS variable
            const style = getComputedStyle(document.documentElement);
            const cardW = parseInt(style.getPropertyValue('--card-width')) || 80;
            // Total width needed with zero overlap = totalCards * cardW
            // Available = containerW - some padding
            const available = containerW - 16; // 8px padding each side
            if (totalCards * cardW > available) {
                // Need overlap: each card except last shows `visiblePx` pixels
                // totalWidth = visiblePx * (n-1) + cardW = available
                // visiblePx = (available - cardW) / (n-1)
                const visiblePx = (available - cardW) / (totalCards - 1);
                // Minimum 18px visible per card for tap target
                const clampedVisible = Math.max(28, visiblePx);
                mobileMargin = -(cardW - clampedVisible);
            }
        }

        hand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card player-card';
            cardEl.dataset.cardId = card.id;

            const isSelected = game.selectedCards.some(c => c.id === card.id);
            if (isSelected) cardEl.classList.add('selected');

            if (isMobile) {
                cardEl.style.setProperty('--rotation', '0deg');
                cardEl.style.setProperty('--translate-y', '0px');
                if (mobileMargin < 0) {
                    cardEl.style.margin = `0 ${mobileMargin / 2}px`; // split left+right
                }
                cardEl.style.zIndex = index;
            } else {
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
                
                // Drag & Drop feature
                cardEl.draggable = true;
                cardEl.addEventListener('dragstart', (e) => {
                    // Auto-select the dragged card if not selected
                    if (!game.selectedCards.some(c => c.id === card.id)) {
                        game.toggleCardSelection(card);
                        cardEl.classList.add('selected');
                        this.updateButtons();
                    }
                    e.dataTransfer.setData('text/plain', 'play_cards');
                    e.dataTransfer.effectAllowed = 'move';
                });

                cardEl.addEventListener('click', () => {
                    audioManager.ensureContext();
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

        const isMobileLandscape = window.innerHeight < 480;

        hand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ai-card ai-card-${position}`;

            const img = document.createElement('img');
            img.src = '../assets/cards/back.png';
            img.alt = 'Card';
            img.draggable = false;
            cardEl.appendChild(img);

            if (index > 0) {
                if (position === 'north') {
                    // North = horizontal row
                    cardEl.style.marginLeft = isMobileLandscape ? '-20px' : '-36px';
                } else {
                    // West/East = vertical column
                    cardEl.style.marginTop = isMobileLandscape ? '-32px' : '-50px';
                }
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

        // In multiplayer, determine if it's MY turn
        const isMyTurn = game.isMultiplayer
            ? current === (window.MP_TienLen?.getMyPlayerIndex() ?? 0)
            : current === 0;

        const myIdx = game.isMultiplayer ? (window.MP_TienLen?.getMyPlayerIndex() ?? 0) : 0;
        const positionMap = ['south', 'west', 'north', 'east'];

        if (game.gameOver) {
            this.turnIndicator.textContent = `🏆 ${names[game.winner] ?? 'Ai đó'} thắng!`;
            this.turnIndicator.classList.add('winner');
            this.stopTurnTimer();
        } else if (game.isAnimating) {
            this.turnIndicator.textContent = `⏳ ${names[current] ?? 'Máy'} đang suy nghĩ...`;
            this.turnIndicator.classList.add('thinking');
            this.stopTurnTimer();
        } else if (current === myIdx) {
            this.turnIndicator.classList.add('my-turn');
            this.turnIndicator.textContent = '🃏 Lượt của bạn!';
            this.startTurnTimer();
        } else {
            this.turnIndicator.classList.add('ai-turn');
            this.turnIndicator.textContent = `🂴 Lượt của ${names[current] ?? 'Máy'}`;
            this.startTurnTimer();
        }

        // Highlight active player position
        document.querySelectorAll('.player-area').forEach(el => el.classList.remove('active-player'));
        const numPlayers = game.isMultiplayer ? (window.MP_TienLen ? playersOrder?.length ?? 4 : 4) : 4;
        const relativeSeat = (current - myIdx + numPlayers) % numPlayers;
        const activeEl = document.getElementById(`${positionMap[relativeSeat]}-area`);
        if (activeEl) activeEl.classList.add('active-player');
    }

    startTurnTimer() {
        const bar = document.getElementById('turn-timer-bar');
        if (!bar) return;
        bar.style.transition = 'none';
        bar.style.width = '100%';
        bar.style.backgroundColor = '#4ECDC4';
        
        // Trigger reflow
        void bar.offsetWidth;
        
        bar.style.transition = 'width 15s linear, background-color 15s linear';
        bar.style.width = '0%';
        bar.style.backgroundColor = '#ff6b6b';
    }

    stopTurnTimer() {
        const bar = document.getElementById('turn-timer-bar');
        if (bar) {
            bar.style.transition = 'none';
            bar.style.width = '0%';
        }
    }

    updateButtons() {
        const myIdx = game.isMultiplayer ? game.myIndex : 0;
        const isHumanTurn = game.currentPlayer === myIdx && !game.gameOver && !game.isAnimating;
        
        let isValidMove = false;
        if (isHumanTurn && game.selectedCards.length > 0) {
            const sorted = sortCards(game.selectedCards);
            let has3SCheck = true;
            if (game.mustPlay3Spade) {
                has3SCheck = sorted.some(c => c.rank === '3' && c.suit === 's');
            }
            if (has3SCheck && typeof canBeatMove === 'function') {
                const result = canBeatMove(sorted, game.lastPlayedCards, game.isNewRound);
                isValidMove = result.valid;
            } else if (has3SCheck) {
                isValidMove = true; // Fallback if canBeatMove not available
            }
        }

        this.btnPlay.disabled = !isHumanTurn || !isValidMove;
        
        if (isValidMove) {
            this.btnPlay.classList.add('valid-glow');
        } else {
            this.btnPlay.classList.remove('valid-glow');
        }

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
        const myIdx = game.isMultiplayer ? game.myIndex : 0;
        // Bots in corner labels
        for (let i = 0; i < 4; i++) {
            if (i === myIdx) continue;
            const span = document.getElementById(`score-${i}`);
            if (span) {
                const val = game.aiChips[i] || 1000;
                span.textContent = val.toLocaleString();
            }
        }
        // Self in controls
        this.updateChipDisplay();
    }

    updateChipDisplay() {
        if (this.chipValueEl) {
            this.chipValueEl.textContent = Account.chips.toLocaleString();
        }
    }

    showMessage(text) {
        this.messageEl.innerHTML = text;
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

    showEmoji(playerIdx, emojiChars) {
        const myIdx = typeof window.MP_TienLen !== 'undefined' ? window.MP_TienLen.getMyPlayerIndex() : 0;
        const numPlayers = typeof window.MP_TienLen !== 'undefined' && typeof playersOrder !== 'undefined' ? playersOrder.length : 4;
        const relativeSeat = (playerIdx - myIdx + numPlayers) % numPlayers;
        const positionMap = ['south', 'west', 'north', 'east'];
        const areaId = `${positionMap[relativeSeat]}-area`;
        
        const areaEl = document.getElementById(areaId);
        if(!areaEl) return;
        
        const emojiEl = document.createElement('div');
        emojiEl.className = 'floating-emoji';
        emojiEl.textContent = emojiChars;
        areaEl.appendChild(emojiEl);
        
        setTimeout(() => emojiEl.remove(), 2000);
    }

    showGameOver(winner) {
        const myIdx = game.isMultiplayer ? game.myIndex : 0;
        const isWin = (winner === myIdx);
        this.gameOverOverlay.classList.add('show');
        this.stopTurnTimer();

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
});
