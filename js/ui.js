// ============================================================
// ui.js - Enhanced casino presentation for Tiến Lên Miền Nam
// ============================================================

class UI {
    constructor() {
        this.messageTimeout = null;
        this.accountListenerBound = false;
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.showBettingOverlay();

        if (!this.accountListenerBound) {
            window.addEventListener('accountUpdated', () => {
                this.updateScores();
                this.updateChipDisplay();
                if (this.bettingOverlay && this.bettingOverlay.style.display !== 'none') {
                    this.showBettingOverlay();
                }
            });
            this.accountListenerBound = true;
        }
    }

    cacheElements() {
        this.gameContainer = document.querySelector('.game-container');
        this.playArea = document.getElementById('play-area');
        this.playAreaCards = document.getElementById('play-area-cards');
        this.playerHand = document.getElementById('player-hand');
        this.westHand = document.getElementById('west-hand');
        this.northHand = document.getElementById('north-hand');
        this.eastHand = document.getElementById('east-hand');
        this.centerArea = document.getElementById('center-area');
        this.fxLayer = document.getElementById('fx-layer');
        this.tableDeck = document.getElementById('table-deck');
        this.tablePot = document.getElementById('table-pot');
        this.potDisplay = document.getElementById('pot-display');
        this.potAmount = document.getElementById('pot-amount');
        this.betAmount = document.getElementById('bet-amount');

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
        this.playerName = document.getElementById('player-name');
        this.westName = document.getElementById('west-name');
        this.northName = document.getElementById('north-name');
        this.eastName = document.getElementById('east-name');

        this.bettingOverlay = document.getElementById('betting-overlay');
        this.betInput = document.getElementById('bet-input');
        this.btnMaxBet = document.getElementById('btn-max-bet');
        this.quickBetBtns = document.querySelectorAll('.quick-bets .premium-chip');
        this.btnStartGame = document.getElementById('btn-start-game');

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
            if (e.dataTransfer.getData('text/plain') === 'play_cards' && !this.btnPlay.disabled) {
                this.btnPlay.click();
            }
        });
    }

    bindEvents() {
        this.bindRipple(this.btnPlay, true);
        this.bindRipple(this.btnPass, true);
        this.bindRipple(this.btnHint, true);
        this.bindRipple(this.btnSound, true);
        this.quickBetBtns.forEach((btn) => this.bindRipple(btn, true));
        this.bindRipple(this.btnStartGame, true);
        this.bindRipple(this.btnPlayAgain, true);
        this.bindRipple(this.btnEmoji, true);

        this.btnPlay.addEventListener('click', () => {
            audioManager.ensureContext();
            if (this.btnPlay.disabled) return;
            this.btnPlay.disabled = true;
            const success = game.playSelectedCards();
            if (!success) {
                setTimeout(() => this.updateButtons(), 300);
            }
        });

        this.btnPass.addEventListener('click', () => {
            audioManager.ensureContext();
            if (this.btnPass.disabled) return;
            this.btnPass.disabled = true;
            const success = game.humanPass();
            if (!success) {
                setTimeout(() => this.updateButtons(), 300);
            }
        });

        this.btnHint.addEventListener('click', () => {
            audioManager.ensureContext();
            this.showHint();
        });

        if (this.btnEmoji) {
            this.btnEmoji.addEventListener('click', (e) => {
                e.stopPropagation();
                this.emojiTray.style.display = this.emojiTray.style.display === 'none' ? 'flex' : 'none';
            });
        }

        if (this.emojiTray) {
            this.emojiTray.querySelectorAll('span').forEach((span) => {
                span.addEventListener('click', () => {
                    const emoji = span.textContent;
                    if (window.MP_TienLen) {
                        window.MP_TienLen.sendEmoji(emoji);
                    } else {
                        this.showEmoji(0, emoji);
                    }
                    this.emojiTray.style.display = 'none';
                });
            });
        }

        document.addEventListener('click', () => {
            if (this.emojiTray) this.emojiTray.style.display = 'none';
        });

        this.btnSound.addEventListener('click', () => {
            const enabled = audioManager.toggle();
            this.btnSound.textContent = enabled ? '🔊' : '🔇';
            this.btnSound.title = enabled ? 'Tắt âm thanh' : 'Bật âm thanh';
        });

        this.btnPlayAgain.addEventListener('click', async () => {
            await game.newGame(game.bet || 100);
            this.hideGameOver();
            this.showMessage('Ván mới bắt đầu!');
            if (game.currentPlayer !== 0) {
                setTimeout(() => game.executeAITurn(), 900);
            }
        });

        if (this.btnMaxBet) {
            this.btnMaxBet.addEventListener('click', () => {
                const max = Math.min(Account.chips, 250000);
                this.betInput.value = max;
                audioManager.cardSelect();
            });
        }

        this.quickBetBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                this.betInput.value = parseInt(btn.dataset.value, 10);
                audioManager.cardSelect();
            });
        });

        this.btnStartGame.addEventListener('click', async () => {
            const bet = parseInt(this.betInput.value, 10) || 100;
            if (bet > Account.chips) {
                this.showMessage('Không đủ chip!');
                return;
            }
            if (bet > 250000) {
                this.showMessage('Cược tối đa là 250,000!');
                return;
            }

            audioManager.ensureContext();
            audioManager.cardSlam();

            if (game.isMultiplayer) {
                if (window.MP_TienLen) {
                    window.MP_TienLen.placeBet(bet);
                    this.btnStartGame.disabled = true;
                    this.btnStartGame.textContent = 'ĐANG ĐỢI...';
                }
                return;
            }

            await game.newGame(bet);
            this.hideBettingOverlay();

            if (game.currentPlayer !== 0) {
                setTimeout(() => game.executeAITurn(), 1000);
            }
        });

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

    bindRipple(element, isButton = false) {
        if (!element) return;
        element.addEventListener('pointerdown', () => {
            element.classList.remove('ripple');
            void element.offsetWidth;
            element.classList.add('ripple');
            setTimeout(() => element.classList.remove('ripple'), isButton ? 420 : 320);
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
        if (!game.isMultiplayer) {
            this.updateNames();
        }
        this.renderPlayerHand();
        this.renderAIHands();
        this.renderPlayArea();
        this.updateTurnIndicator();
        this.updateCardCounts();
        this.updateScores();
        this.updateChipDisplay();
        this.updatePotDisplay();
        this.updateButtons();
    }

    updateNames() {
        const names = game.playerNames || ['Bạn', 'Dealer 1', 'Dealer 2', 'Dealer 3'];
        this.playerName.innerHTML = `${names[0] || 'Bạn'} <span id="player-count" class="card-count">${this.playerCount?.textContent || 0}</span>`;
        this.westName.innerHTML = `${names[1] || 'Dealer Tây'} <span id="west-count" class="card-count">${this.westCount?.textContent || 0}</span>`;
        this.northName.innerHTML = `${names[2] || 'Dealer Bắc'} <span id="north-count" class="card-count">${this.northCount?.textContent || 0}</span>`;
        this.eastName.innerHTML = `${names[3] || 'Dealer Đông'} <span id="east-count" class="card-count">${this.eastCount?.textContent || 0}</span>`;
        this.playerCount = document.getElementById('player-count');
        this.westCount = document.getElementById('west-count');
        this.northCount = document.getElementById('north-count');
        this.eastCount = document.getElementById('east-count');
    }

    renderPlayerHand() {
        this.playerHand.innerHTML = '';
        const hand = game.isMultiplayer ? game.hands[window.MP_TienLen?.getMyPlayerIndex() ?? 0] : game.hands[0];
        if (!hand) return;

        const totalCards = hand.length;
        const isCompact = window.innerHeight < 520 || window.innerWidth < 600;
        const isMyTurn = game.isMultiplayer
            ? game.currentPlayer === (window.MP_TienLen?.getMyPlayerIndex() ?? 0)
            : game.currentPlayer === 0;

        let compactMargin = 0;
        if (isCompact && totalCards > 1) {
            const containerW = this.playerHand.clientWidth || window.innerWidth;
            const style = getComputedStyle(document.documentElement);
            const cardW = parseInt(style.getPropertyValue('--card-width'), 10) || 80;
            const available = containerW - 24;
            if (totalCards * cardW > available) {
                const visiblePx = (available - cardW) / (totalCards - 1);
                compactMargin = -(cardW - Math.max(28, visiblePx));
            }
        }

        hand.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card player-card';
            cardEl.dataset.cardId = card.id;
            cardEl.style.zIndex = index;

            if (isCompact) {
                cardEl.style.setProperty('--rotation', '0deg');
                cardEl.style.setProperty('--translate-y', '0px');
                if (compactMargin < 0) {
                    cardEl.style.margin = `0 ${compactMargin / 2}px`;
                }
            } else {
                const centerIndex = (totalCards - 1) / 2;
                const offset = index - centerIndex;
                cardEl.style.setProperty('--rotation', `${offset * 2.6}deg`);
                cardEl.style.setProperty('--translate-y', `${Math.abs(offset) * 2}px`);
            }

            if (game.selectedCards.some((selected) => selected.id === card.id)) {
                cardEl.classList.add('selected');
            }

            const img = document.createElement('img');
            img.src = card.imagePath;
            img.alt = card.displayName;
            img.draggable = false;
            cardEl.appendChild(img);

            if (isMyTurn && !game.isAnimating) {
                cardEl.classList.add('interactive');
                this.bindRipple(cardEl);
                cardEl.draggable = true;

                cardEl.addEventListener('dragstart', (e) => {
                    if (!game.selectedCards.some((selected) => selected.id === card.id)) {
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
                    cardEl.classList.toggle('selected', game.selectedCards.some((selected) => selected.id === card.id));
                    this.updateButtons();
                });
            } else {
                cardEl.classList.add('disabled');
            }

            this.playerHand.appendChild(cardEl);
        });
    }

    renderAIHands() {
        if (!game.hands[0]) return;

        if (game.isMultiplayer) {
            const myIdx = window.MP_TienLen.getMyPlayerIndex();
            this.renderAIHand(this.westHand, game.hands[(myIdx + 1) % 4], 'west');
            this.renderAIHand(this.northHand, game.hands[(myIdx + 2) % 4], 'north');
            this.renderAIHand(this.eastHand, game.hands[(myIdx + 3) % 4], 'east');
            return;
        }

        this.renderAIHand(this.westHand, game.hands[1], 'west');
        this.renderAIHand(this.northHand, game.hands[2], 'north');
        this.renderAIHand(this.eastHand, game.hands[3], 'east');
    }

    renderAIHand(container, hand, position) {
        container.innerHTML = '';
        if (!hand) return;

        const isLandscape = window.innerHeight < 480;
        hand.forEach((_, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ai-card ai-card-${position}`;
            const img = document.createElement('img');
            img.src = '../assets/cards/back.png';
            img.alt = 'Card Back';
            img.draggable = false;
            cardEl.appendChild(img);

            if (index > 0) {
                if (position === 'north') {
                    cardEl.style.marginLeft = isLandscape ? '-20px' : '-36px';
                } else {
                    cardEl.style.marginTop = isLandscape ? '-32px' : '-50px';
                }
            }

            container.appendChild(cardEl);
        });
    }

    renderPlayArea() {
        this.playAreaCards.innerHTML = '';

        if (!game.lastPlayedCards || game.lastPlayedCards.length === 0) {
            if (game.isNewRound) {
                this.playAreaCards.innerHTML = '<div class="play-area-text">Lượt mới - tự do đánh</div>';
            }
            return;
        }

        const sorted = sortCards(game.lastPlayedCards);
        sorted.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card play-card';
            cardEl.style.animationDelay = `${index * 0.06}s`;
            const offset = (index - (sorted.length - 1) / 2) * 15;
            const rotation = (index - (sorted.length - 1) / 2) * 3;
            cardEl.style.setProperty('--play-offset', `${offset}px`);
            cardEl.style.setProperty('--play-rotation', `${rotation}deg`);

            const img = document.createElement('img');
            img.src = card.imagePath;
            img.alt = card.displayName;
            img.draggable = false;
            cardEl.appendChild(img);
            this.playAreaCards.appendChild(cardEl);
        });

        const playerLabel = document.createElement('div');
        playerLabel.className = 'play-area-label';
        playerLabel.textContent = game.playerNames[game.lastPlayedBy];
        this.playAreaCards.appendChild(playerLabel);
        this.flashPlayArea();
    }

    updateTurnIndicator() {
        const names = game.playerNames;
        const current = game.currentPlayer;
        const isMyTurn = game.isMultiplayer
            ? current === (window.MP_TienLen?.getMyPlayerIndex() ?? 0)
            : current === 0;
        const myIdx = game.isMultiplayer ? (window.MP_TienLen?.getMyPlayerIndex() ?? 0) : 0;
        const positionMap = ['south', 'west', 'north', 'east'];

        this.turnIndicator.classList.remove('winner', 'thinking', 'my-turn', 'ai-turn');

        if (game.gameOver) {
            this.turnIndicator.textContent = `🏆 ${names[game.winner] ?? 'Ai đó'} thắng!`;
            this.turnIndicator.classList.add('winner');
            this.stopTurnTimer();
        } else if (game.isAnimating) {
            this.turnIndicator.textContent = `🃏 ${names[current] ?? 'Dealer'} đang xử lý...`;
            this.turnIndicator.classList.add('thinking');
            this.stopTurnTimer();
        } else if (isMyTurn) {
            this.turnIndicator.textContent = 'Đến lượt của bạn';
            this.turnIndicator.classList.add('my-turn');
            this.startTurnTimer();
        } else {
            this.turnIndicator.textContent = `Lượt của ${names[current] ?? 'Dealer'}`;
            this.turnIndicator.classList.add('ai-turn');
            this.startTurnTimer();
        }

        document.querySelectorAll('.player-area').forEach((el) => el.classList.remove('active-player'));
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
        bar.style.backgroundColor = '#54d8bf';
        void bar.offsetWidth;
        bar.style.transition = 'width 15s linear, background-color 15s linear';
        bar.style.width = '0%';
        bar.style.backgroundColor = '#ff7c67';
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
            const has3SCheck = !game.mustPlay3Spade || sorted.some((c) => c.rank === '3' && c.suit === 's');
            if (has3SCheck && typeof canBeatMove === 'function') {
                isValidMove = canBeatMove(sorted, game.lastPlayedCards, game.isNewRound).valid;
            } else if (has3SCheck) {
                isValidMove = true;
            }
        }

        this.btnPlay.disabled = !isHumanTurn || !isValidMove;
        this.btnPass.disabled = !isHumanTurn || game.isNewRound;
        this.btnHint.disabled = !isHumanTurn;
        this.btnPlay.classList.toggle('valid-glow', isValidMove);
    }

    updateCardCounts() {
        if (game.isMultiplayer) {
            const myIdx = window.MP_TienLen.getMyPlayerIndex();
            if (game.hands[myIdx] && this.playerCount) this.playerCount.textContent = game.hands[myIdx].length;
            if (game.hands[(myIdx + 1) % 4] && this.westCount) this.westCount.textContent = game.hands[(myIdx + 1) % 4].length;
            if (game.hands[(myIdx + 2) % 4] && this.northCount) this.northCount.textContent = game.hands[(myIdx + 2) % 4].length;
            if (game.hands[(myIdx + 3) % 4] && this.eastCount) this.eastCount.textContent = game.hands[(myIdx + 3) % 4].length;
            return;
        }

        if (game.hands[0] && this.playerCount) this.playerCount.textContent = game.hands[0].length;
        if (game.hands[1] && this.westCount) this.westCount.textContent = game.hands[1].length;
        if (game.hands[2] && this.northCount) this.northCount.textContent = game.hands[2].length;
        if (game.hands[3] && this.eastCount) this.eastCount.textContent = game.hands[3].length;
    }

    updateScores() {
        this.updateChipDisplay();
    }

    updateChipDisplay() {
        if (this.chipValueEl) {
            this.chipValueEl.textContent = Account.chips.toLocaleString();
        }
    }

    updatePotDisplay() {
        const bet = Number(game.bet || 0);
        const pot = game.gameOver ? 0 : bet * 4;
        const formattedPot = pot.toLocaleString();
        if (this.potDisplay) this.potDisplay.textContent = formattedPot;
        if (this.potAmount) this.potAmount.textContent = formattedPot;
        if (this.betAmount) this.betAmount.textContent = bet.toLocaleString();
    }

    showMessage(text) {
        this.messageEl.innerHTML = text;
        this.messageEl.classList.add('show');
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.messageEl.classList.remove('show');
        }, 2400);
    }

    showBettingOverlay() {
        if (!this.bettingOverlay) return;
        this.bettingOverlay.style.display = 'flex';
        this.btnStartGame.disabled = false;
        this.btnStartGame.textContent = 'BẮT ĐẦU';
        if (this.betInput) {
            const max = Math.min(Account.chips, 250000);
            this.betInput.max = max;
            if (parseInt(this.betInput.value, 10) > max) {
                this.betInput.value = max;
            }
        }
        this.updateChipDisplay();
    }

    hideBettingOverlay() {
        if (this.bettingOverlay) {
            this.bettingOverlay.style.display = 'none';
        }
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
        const areaEl = document.getElementById(`${positionMap[relativeSeat]}-area`);
        if (!areaEl) return;

        const emojiEl = document.createElement('div');
        emojiEl.className = 'floating-emoji';
        emojiEl.textContent = emojiChars;
        areaEl.appendChild(emojiEl);
        setTimeout(() => emojiEl.remove(), 2000);
    }

    async startRoundPresentation() {
        this.render();
        this.updatePotDisplay();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        await this.animateDealSequence();
        this.render();
    }

    async animateDealSequence() {
        if (!this.tableDeck || !this.gameContainer || !game.hands?.length) return;
        this.gameContainer.classList.add('dealing');
        const deckRect = this.tableDeck.getBoundingClientRect();
        const deckX = deckRect.left + deckRect.width / 2;
        const deckY = deckRect.top + deckRect.height / 2;
        const seats = [
            { container: this.playerHand, flip: true, cards: game.hands[0] || [] },
            { container: this.westHand, flip: false, cards: game.hands[1] || [] },
            { container: this.northHand, flip: false, cards: game.hands[2] || [] },
            { container: this.eastHand, flip: false, cards: game.hands[3] || [] }
        ];

        const animations = [];
        for (let round = 0; round < 13; round += 1) {
            for (let seatIndex = 0; seatIndex < seats.length; seatIndex += 1) {
                const seat = seats[seatIndex];
                const card = seat.cards[round];
                if (!card || !seat.container) continue;

                const targetRect = seat.container.getBoundingClientRect();
                const progress = seat.cards.length > 1 ? round / (seat.cards.length - 1) : 0.5;
                const targetX = targetRect.left + targetRect.width * (0.22 + progress * 0.56);
                const targetY = targetRect.top + targetRect.height / 2;
                const delay = round * 115 + seatIndex * 95;

                animations.push(this.spawnFlyingCard({
                    fromX: deckX,
                    fromY: deckY,
                    toX: targetX,
                    toY: targetY,
                    faceImage: card.imagePath,
                    delay,
                    flip: seat.flip
                }));
            }
        }

        audioManager.shuffle();
        await Promise.all(animations);
        this.gameContainer.classList.remove('dealing');
    }

    spawnFlyingCard({ fromX, fromY, toX, toY, faceImage, delay = 0, flip = false }) {
        return new Promise((resolve) => {
            const card = document.createElement('div');
            card.className = `flying-card${flip ? ' flip' : ''}`;
            card.style.setProperty('--from-x', `${fromX}px`);
            card.style.setProperty('--from-y', `${fromY}px`);
            card.style.setProperty('--to-x', `${toX - fromX}px`);
            card.style.setProperty('--to-y', `${toY - fromY}px`);
            card.style.setProperty('--deal-duration', '650ms');
            card.style.animationPlayState = 'paused';

            const back = document.createElement('div');
            back.className = 'card-back-face';
            card.appendChild(back);

            const front = document.createElement('img');
            front.className = 'card-front-face';
            front.src = faceImage;
            front.alt = 'Card';
            card.appendChild(front);

            document.body.appendChild(card);

            setTimeout(() => {
                card.style.animationPlayState = 'running';
                audioManager.dealCard?.();
                card.style.animationDelay = '0ms';
                card.addEventListener('animationend', () => {
                    card.remove();
                    resolve();
                }, { once: true });
            }, delay);
        });
    }

    async animateChipTransfer({ toPlayer = true, amount = 0 }) {
        if (!this.tablePot || !this.playerName || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const fromRect = (toPlayer ? this.tablePot : document.querySelector('.player-chips-container'))?.getBoundingClientRect();
        const toRect = (toPlayer ? document.querySelector('.player-chips-container') : this.tablePot)?.getBoundingClientRect();
        if (!fromRect || !toRect) return;

        const chips = Math.max(5, Math.min(14, Math.round(amount / Math.max(game.bet || 1, 1))));
        const promises = [];
        for (let i = 0; i < chips; i += 1) {
            promises.push(new Promise((resolve) => {
                const chip = document.createElement('div');
                chip.className = 'chip-fly';
                const fromX = fromRect.left + fromRect.width / 2;
                const fromY = fromRect.top + fromRect.height / 2;
                const toX = toRect.left + toRect.width / 2 + (Math.random() * 24 - 12);
                const toY = toRect.top + toRect.height / 2 + (Math.random() * 24 - 12);
                chip.style.setProperty('--from-x', `${fromX}px`);
                chip.style.setProperty('--from-y', `${fromY}px`);
                chip.style.setProperty('--to-x', `${toX}px`);
                chip.style.setProperty('--to-y', `${toY}px`);
                chip.style.setProperty('--chip-duration', `${780 + i * 28}ms`);
                document.body.appendChild(chip);

                setTimeout(() => audioManager.chip?.(), i * 45);
                chip.addEventListener('animationend', () => {
                    chip.remove();
                    resolve();
                }, { once: true });
            }));
        }

        this.tablePot.classList.add('win-glow');
        if (toPlayer) {
            this.playArea.classList.add('win-glow');
        }
        await Promise.all(promises);
        setTimeout(() => {
            this.tablePot?.classList.remove('win-glow');
            this.playArea?.classList.remove('win-glow');
        }, 900);
    }

    flashPlayArea() {
        this.playArea.classList.remove('win-glow');
        void this.playArea.offsetWidth;
        this.playArea.classList.add('win-glow');
        setTimeout(() => this.playArea.classList.remove('win-glow'), 700);
    }

    showGameOver(winner) {
        const myIdx = game.isMultiplayer ? game.myIndex : 0;
        const isWin = winner === myIdx;
        this.gameOverOverlay.classList.add('show');
        this.stopTurnTimer();
        this.gameOverMessage.innerHTML = isWin
            ? '<span class="win-text">Bạn đã THẮNG!</span>'
            : `<span class="lose-text">${game.playerNames[winner]} thắng rồi!</span>`;

        if (isWin) {
            this.createConfetti();
            this.gameOverOverlay.classList.add('win-glow');
            this.tablePot?.classList.add('win-glow');
        }
    }

    hideGameOver() {
        this.gameOverOverlay.classList.remove('show', 'win-glow');
        this.tablePot?.classList.remove('win-glow');
        this.playArea?.classList.remove('win-glow');
        document.querySelectorAll('.confetti').forEach((el) => el.remove());
    }

    createConfetti() {
        const colors = ['#FFD700', '#4ECDC4', '#7BE495', '#FF9F68', '#FFF0B5', '#57CC99'];
        for (let i = 0; i < 90; i += 1) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = `${Math.random() * 1.5}s`;
            confetti.style.animationDuration = `${2 + Math.random() * 2.4}s`;
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
