// mp-bala.js - Multiplayer logic for Ba Lá (Three Card Poker)

window.MP_BaLa = {
    isMultiplayer: false,
    isHost: false,
    roomId: null,
    roomRef: null,
    playersOrder: [], // uids

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');
        
        if (!this.roomId || !Account.uid) return; // Solo mode

        console.log("Multiplayer BaLa mode active. Room:", this.roomId);
        this.isMultiplayer = true;
        this.roomRef = db.ref('rooms/' + this.roomId);
        
        const snapshot = await this.roomRef.once('value');
        const roomData = snapshot.val();
        
        if (!roomData) {
            alert("Phòng không tồn tại!");
            window.location.href = 'lobby.html';
            return;
        }

        this.isHost = (Account.uid === roomData.host);
        
        // Setup Players Mapping
        const ObjectPlayers = Object.values(roomData.players).sort((a, b) => a.joinedAt - b.joinedAt);
        this.playersOrder = ObjectPlayers.map(p => p.uid);

        this.setupUI();
        this.listenToState();
        
        // Override Deal action to push to Firebase
        BaLaUI.doDeal = () => {
             const ante = parseInt(BaLaUI.anteInput.value) || 50;
             const pp = parseInt(BaLaUI.ppInput.value) || 0;

             if (ante < 10) {
                 BaLaUI.messageEl.textContent = '⚠️ Ante tối thiểu 10 chip!';
                 return;
             }
             if (ante + pp > Account.chips) {
                 BaLaUI.messageEl.textContent = '⚠️ Không đủ chip!';
                 return;
             }
             
             // Deduct bets immediately for responsiveness
             Account.deductChips(ante + pp);
             BaLaUI.updateChips();

             BaLaUI.betPanel.style.display = 'none';
             BaLaUI.messageEl.textContent = '⏳ Đang chờ hệ thống chia bài...';
             
             this.submitBet(ante, pp);
        };
        
        // Override Play action
        BaLaUI.doPlay = () => this.submitAction('play');
        
        // Override Fold action
        BaLaUI.doFold = () => this.submitAction('fold');
    },

    setupUI() {
        if (this.isHost) {
            BaLaUI.playerLabel.textContent = 'DEALER (BẠN)';
            BaLaUI.dealerLabel.textContent = '---'; // Not used by host directly in the same way
            BaLaUI.betPanel.innerHTML = '<div style="color:#FFD700; text-align:center; padding: 20px;">Bạn là Cái (Dealer). Hãy nhấn Bắt Đầu Chia Bài khi người chơi vào đủ.</div><button class="bl-btn bl-btn-primary" id="bl-host-deal-btn" style="margin-top:10px;">🎮 DEALER CHIA BÀI</button>';
            
            document.getElementById('bl-host-deal-btn').onclick = () => this.hostDeal();
        } else {
            // Keep the bet UI, but adjust labels
            BaLaUI.dealerLabel.textContent = 'DEALER (CHỦ PHÒNG)';
        }
    },

    // ==========================================
    // HOST LOGIC (DEALER)
    // ==========================================

    async hostDeal() {
        if (!this.isHost) return;
        
        const d = new Deck(); d.shuffle();
        const hands = {};
        
        // Deal 3 cards to everyone including Dealer (Host)
        this.playersOrder.forEach(uid => {
            hands[uid] = [d.cards.pop().id, d.cards.pop().id, d.cards.pop().id];
        });

        // Initialize state
        await this.roomRef.child('state').set({
            phase: 'dealt',
            hands: hands,
            actions: {}, // To track who played vs folded
            bets: {}, // Track {ante, pp} for each guest
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    },
    
    // Evaluate and finish the round once all guests have decided
    async hostEvaluateRound(state) {
        if (!this.isHost) return;
        
        const dealerHandIds = state.hands[Account.uid];
        const dealerHandObj = dealerHandIds.map(id => Card.fromId(id));
        const dealerEval = evaluateThreeCardHand(dealerHandObj);
        const dealerQualifies = dealerEval.handRank >= BA_LA_HANDS.PAIR || (dealerEval.kickers[0] >= 12);
        
        // We will push a final result object so clients know what they won/lost
        const results = {};
        
        this.playersOrder.forEach(uid => {
            if (uid === Account.uid) return; // skip host
            
            // Default 0 payout if they didn't even bet (e.g joined late)
            if (!state.bets || !state.bets[uid]) {
                results[uid] = { net: 0, result: 'none' };
                return;
            }
            
            const betInfo = state.bets[uid];
            const action = state.actions ? state.actions[uid] : 'fold'; // implicit fold if disconnected/timeout
            
            const playerHandIds = state.hands[uid];
            const playerHandObj = playerHandIds.map(id => Card.fromId(id));
            const playerEval = evaluateThreeCardHand(playerHandObj);
            
            let payout = 0;
            let resultType = '';
            
            // Pair Plus calculation
            let ppResult = 0;
            if (betInfo.pp > 0) {
                const ppMult = getPairPlusPayout(playerEval);
                if (ppMult > 0) ppResult = betInfo.pp * ppMult;
                else ppResult = -betInfo.pp;
                payout += ppResult;
            }
            
            if (action === 'fold') {
                payout -= betInfo.ante; // Lose ante
                resultType = 'fold';
            } else if (action === 'play') {
                if (!dealerQualifies) {
                    // + Ante (1:1), Play bet is pushed (0 net, so technically they just get their play bet back, but we return +ante as the win)
                    payout += betInfo.ante; 
                    resultType = 'dealer-no-qualify';
                } else {
                    const cmp = compareHands(playerEval, dealerEval);
                    if (cmp > 0) {
                        const anteBonus = getAnteBonus(playerEval);
                        payout += (betInfo.ante * 2); // Win Ante + Play
                        if (anteBonus > 0) payout += betInfo.ante * anteBonus;
                        resultType = 'win';
                    } else if (cmp < 0) {
                        payout -= (betInfo.ante * 2); // Lose Ante + Play
                        resultType = 'lose';
                    } else {
                        // Push leaves payout as 0 (for ante/play portion)
                        resultType = 'push';
                    }
                }
            }
            
            // We want the total chips the player actually gets ADDED to their balance.
            // Remember they already deducted Ante + PP when betting. If they Play, they technically need to wager another Ante,
            // but for simplicity of this adaptation, we pretend the Play bet is "pledged" and the payout returns the net delta to their balance.
            
            // Wait, standard rules:
            // 1. You bet Ante. (Deducted)
            // 2. You Play -> You put another Ante in.
            // Delta logic is tricky. Let's return the NET WIN/LOSS.
            // If they lose, NET = -(ante + play + ppLoss). 
            // If they win, NET is positive. 
            // The client already deducted (Ante + PP). 
            // So if they Play (pledging another Ante) and win, we need to return: (Ante*2 + PP_Return + Winnings).
            // Let's make "results[uid].netReturn" strictly the amount of chips to `Account.addChips()` at the end.
            
            let netReturn = 0;
            
            if (action === 'fold') {
                // They already paid Ante + PP. They get nothing back for Ante. 
                // They might get PP back.
                netReturn = (ppResult > 0) ? (betInfo.pp + ppResult) : 0; 
            } else if (action === 'play') {
                // They pledged another Ante.
                if (resultType === 'dealer-no-qualify') {
                    // Win Ante, Push Play. You get back: Ante_bet + Ante_win + Play_push + PP_result
                    netReturn = betInfo.ante + betInfo.ante + 0 + ((ppResult > 0) ? (betInfo.pp + ppResult) : 0);
                    // But wait, the Play bet was never explicitly deducted from their Account in step 1!
                    // In `doPlay`, offline BaLa deducts the second ante. Our multiplayer adapter doesn't explicitly deduct the second ante yet.
                    // Let's assume on `submitAction('play')`, the client deducts the second ante locally.
                    // If so, they paid (Ante + Play + PP) = (2*Ante + PP).
                    // They get back: 2*Ante (push) + Ante (win) + PP_Return.
                    netReturn = (betInfo.ante * 2) + betInfo.ante + ((ppResult>0) ? (betInfo.pp+ppResult) : 0);
                } else if (resultType === 'win') {
                    const anteBonus = getAnteBonus(playerEval);
                    netReturn = (betInfo.ante * 2) + (betInfo.ante * 2) + (betInfo.ante * anteBonus) + ((ppResult>0) ? (betInfo.pp+ppResult) : 0);
                } else if (resultType === 'lose') {
                    netReturn = (ppResult>0) ? (betInfo.pp+ppResult) : 0;
                } else if (resultType === 'push') {
                    netReturn = (betInfo.ante * 2) + ((ppResult>0) ? (betInfo.pp+ppResult) : 0);
                }
            }
            
            results[uid] = { 
                netReturn: netReturn,
                result: resultType,
                ppResult: ppResult,
                handEval: playerEval
            };
        });
        
        await this.roomRef.child('state/phase').set('result');
        await this.roomRef.child('state/results').set(results);
    },

    // ==========================================
    // CLIENT ACTIONS
    // ==========================================

    submitBet(ante, pp) {
        if (this.isHost) return;
        this.roomRef.child('state/bets/' + Account.uid).set({ ante: ante, pp: pp });
    },

    submitAction(action) {
        if (this.isHost) return;
        
        // If play, deduct the second bet
        if (action === 'play') {
            const ante = parseInt(BaLaUI.anteInput.value) || 50;
            Account.deductChips(ante); // Play bet = Ante
            BaLaUI.updateChips();
        }
        
        BaLaUI.actionPanel.style.display = 'none';
        BaLaUI.messageEl.textContent = '⏳ Chờ cập nhật kết quả từ Dealer...';
        this.roomRef.child('state/actions/' + Account.uid).set(action);
    },

    listenToState() {
        this.roomRef.child('state').on('value', (snapshot) => {
            const state = snapshot.val();
            if (!state) {
                // Reset
                BaLa.phase = 'bet';
                BaLaUI.showBetPanel();
                if (this.isHost) this.setupUI(); // Reset host UI
                return;
            }

            if (state.phase === 'dealt') {
                if (BaLa.phase !== 'dealt') {
                    BaLa.phase = 'dealt';
                    
                    if (this.isHost) {
                        BaLaUI.betPanel.style.display = 'none';
                        BaLaUI.messageEl.textContent = 'Đang chờ người chơi ra quyết định...';
                        
                        // Load Dealer hand visually
                        BaLa.playerHand = state.hands[Account.uid].map(id => Card.fromId(id));
                        BaLa.dealerHand = []; // Guests' hands are hidden from dealer for now
                        BaLaUI.renderHands(true);
                        
                    } else {
                        // Load Guest hand visually
                        const myHandIds = state.hands[Account.uid] || [];
                        BaLa.playerHand = myHandIds.map(id => Card.fromId(id));
                        BaLa.dealerHand = state.hands[roomData.host].map(id => Card.fromId(id));
                        
                        BaLaUI.betPanel.style.display = 'none';
                        // Only show action panel if they bet
                        if (state.bets && state.bets[Account.uid]) {
                            BaLaUI.actionPanel.style.display = 'flex';
                            BaLaUI.messageEl.textContent = 'Thấy bài! Xem và chọn: ĐÁNH (Play) hoặc BỎ (Fold)';
                        } else {
                            BaLaUI.messageEl.textContent = 'Bạn không đặt cược ván này. Vui lòng xem!';
                        }
                        
                        BaLaUI.renderHands(false); // hide dealer
                    }
                }
                
                // Host checking if all joined guests have acted
                if (this.isHost) {
                    const expectedPlayers = this.playersOrder.length - 1; // excluding host
                    const actedPlayers = state.actions ? Object.keys(state.actions).length : 0;
                    
                    if (actedPlayers === expectedPlayers && expectedPlayers > 0) {
                        this.hostEvaluateRound(state);
                    }
                }
            } 
            else if (state.phase === 'result') {
                BaLa.phase = 'result';
                BaLaUI.actionPanel.style.display = 'none';
                BaLaUI.resultPanel.style.display = 'flex';
                
                if (this.isHost) {
                    BaLaUI.messageEl.textContent = 'So bài kết thúc!';
                    BaLaUI.resultPanel.innerHTML = '<button class="bl-btn bl-btn-primary" onclick="MP_BaLa.roomRef.child(\'state\').remove()">🔄 VÁN MỚI</button>';
                } else {
                    BaLaUI.renderHands(true); // reveal dealer
                    
                    const myResult = state.results ? state.results[Account.uid] : null;
                    if (myResult) {
                        if (myResult.netReturn > 0) {
                            Account.addChips(myResult.netReturn);
                            BaLaUI.updateChips();
                        }
                        
                        // Show nice messages
                        const dHand = evaluateThreeCardHand(BaLa.dealerHand);
                        BaLaUI.dealerLabel.textContent = `DEALER - ${getHandName(dHand)}`;
                        BaLaUI.playerLabel.textContent = `BẠN - ${getHandName(myResult.handEval)}`;
                        
                        let msg = "";
                        if (myResult.result === 'dealer-no-qualify') msg = '🤷 Dealer không đủ điều kiện. Bạn ăn Ante!';
                        else if (myResult.result === 'win') msg = '🎉 Bạn Thắng!';
                        else if (myResult.result === 'lose') msg = '😞 Dealer Thắng!';
                        else if (myResult.result === 'push') msg = '🤝 Hòa!';
                        else if (myResult.result === 'fold') msg = '😔 Bạn bỏ bài.';
                        
                        if (myResult.ppResult > 0) msg += ` (Pair Plus: +${myResult.ppResult})`;
                        else if (myResult.ppResult < 0) msg += ` (Pair Plus Thua)`;
                        
                        BaLaUI.messageEl.textContent = msg;
                    }
                }
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.MP_BaLa) {
            MP_BaLa.init();
        }
    }, 100);
});
