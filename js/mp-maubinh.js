// mp-maubinh.js - Multiplayer logic for Mậu Binh

window.MP_MauBinh = {
    isMultiplayer: false,
    isHost: false,
    roomId: null,
    roomRef: null,
    playersOrder: [], // uids

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.roomId = urlParams.get('room');
        
        if (!this.roomId || !Account.uid) return; // Solo mode

        console.log("Multiplayer MauBinh mode active. Room:", this.roomId);
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
        const players = Object.values(roomData.players).sort((a, b) => a.joinedAt - b.joinedAt);
        this.playersOrder = players.map(p => p.uid);
        
        // Map to offline engine structure (0 is Me, 1-3 are others)
        // We only use the amount of players actually in the room
        MauBinh.players = [{ name: 'Bạn', hand: [], arrangement: null, isAI: false, score: 0 }];
        
        this.playersOrder.forEach(uid => {
            if (uid !== Account.uid) {
                MauBinh.players.push({
                    uid: uid,
                    name: roomData.players[uid].name,
                    hand: [], arrangement: null, isAI: false, score: 0
                });
            }
        });

        this.setupUI();
        this.listenToState();
    },

    setupUI() {
        const startBtn = document.querySelector('#mb-bet-panel .mb-btn-primary');
        if (startBtn) {
            startBtn.textContent = this.isHost ? '🎮 CHIA BÀI' : '⏳ CHỜ CHIA BÀI';
            // Override the default startGame
            startBtn.onclick = () => {
                if (this.isHost) this.hostDeal();
            };
        }
        
        // Override confirm arrangement
        const originalConfirm = MauBinhUI.confirm.bind(MauBinhUI);
        MauBinhUI.confirm = () => {
            if (!this.isMultiplayer) return originalConfirm();
            this.submitArrangement();
        };
    },

    async hostDeal() {
        if (!this.isHost) return;
        
        const bet = parseInt(document.getElementById('mb-bet-input').value) || 100;
        
        // Generate deck
        const d = new Deck(); d.shuffle();
        const hands = {};
        
        this.playersOrder.forEach(uid => {
            hands[uid] = [];
            for (let i = 0; i < 13; i++) hands[uid].push(d.cards.pop().id);
        });

        // Push state
        await this.roomRef.child('state').set({
            phase: 'arranging',
            bet: bet,
            hands: hands,
            arrangements: {},
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    },

    submitArrangement() {
        if (MauBinhUI.front.length !== 3 || MauBinhUI.middle.length !== 5 || MauBinhUI.back.length !== 5) {
            MauBinhUI.messageEl.textContent = '⚠️ Chưa xếp đủ bài!';
            return;
        }

        const arr = { front: MauBinhUI.front, middle: MauBinhUI.middle, back: MauBinhUI.back };
        if (!MauBinh.validateArrangement(arr)) {
            MauBinhUI.messageEl.textContent = '⚠️ Sai luật! Back phải ≥ Middle ≥ Front';
            return;
        }

        // Convert cards back to IDs for Firebase
        const arrIds = {
            front: arr.front.map(c => c.id),
            middle: arr.middle.map(c => c.id),
            back: arr.back.map(c => c.id)
        };

        this.roomRef.child('state/arrangements/' + Account.uid).set(arrIds);
        
        MauBinhUI.arrangePanel.style.display = 'none';
        MauBinhUI.messageEl.textContent = '⏳ Đã xếp xong! Đang chờ người khác...';
        MauBinhUI.resultPanel.style.display = 'flex';
        MauBinhUI.resultDetail.innerHTML = '<div style="text-align:center; padding: 20px;">Đang đợi người chơi khác hoàn tất xếp bài...</div>';
    },

    listenToState() {
        this.roomRef.child('state').on('value', (snapshot) => {
            const state = snapshot.val();
            if (!state) return;

            MauBinh.bet = state.bet || 100;

            if (state.phase === 'arranging') {
                if (MauBinh.phase !== 'arranging') {
                    // Deal cards to me
                    MauBinh.phase = 'arranging';
                    const myCardIds = state.hands[Account.uid] || [];
                    MauBinh.players[0].hand = myCardIds.map(id => Card.fromId(id));
                    
                    MauBinhUI.front = []; MauBinhUI.middle = []; MauBinhUI.back = []; MauBinhUI.selected = [];
                    document.getElementById('mb-bet-panel').style.display = 'none';
                    MauBinhUI.arrangePanel.style.display = 'flex';
                    MauBinhUI.resultPanel.style.display = 'none';
                    MauBinhUI.messageEl.textContent = '🃏 Xếp bài (Front 3, Middle 5, Back 5)';
                    MauBinhUI.renderHand();
                    MauBinhUI.renderChis();
                }

                // Check if all players have submitted
                const arrCount = state.arrangements ? Object.keys(state.arrangements).length : 0;
                if (arrCount === this.playersOrder.length) {
                    // Everyone is ready. Move to result
                    if (this.isHost) {
                        this.roomRef.child('state/phase').set('result');
                    }
                }
            }
            else if (state.phase === 'result') {
                if (MauBinh.phase !== 'result') {
                    MauBinh.phase = 'result';
                    this.executeShowdown(state.arrangements);
                }
            }
        });
    },

    executeShowdown(arrangements) {
        // Map arrangements to offline structure
        this.playersOrder.forEach(uid => {
            const arrIds = arrangements[uid];
            if (!arrIds) return;
            
            const arr = {
                front: arrIds.front.map(id => Card.fromId(id)),
                middle: arrIds.middle.map(id => Card.fromId(id)),
                back: arrIds.back.map(id => Card.fromId(id))
            };
            
            const playerIdx = uid === Account.uid ? 0 : MauBinh.players.findIndex(p => p.uid === uid);
            if (playerIdx >= 0) {
                MauBinh.players[playerIdx].arrangement = arr;
            }
        });

        // Use offline score calculation
        const totalScore = MauBinh.calculateScores();
        const chipWin = totalScore * MauBinh.bet;

        if (chipWin > 0) Account.addChips(chipWin);
        else if (chipWin < 0) Account.deductChips(-chipWin);

        // UI Update
        MauBinhUI.arrangePanel.style.display = 'none';
        MauBinhUI.resultPanel.style.display = 'flex';

        if (chipWin > 0) {
            MauBinhUI.messageEl.textContent = `🎉 Thắng! +${chipWin.toLocaleString()} chip (${totalScore > 0 ? '+' : ''}${totalScore} chi)`;
        } else if (chipWin < 0) {
            MauBinhUI.messageEl.textContent = `😞 Thua! ${chipWin.toLocaleString()} chip (${totalScore} chi)`;
        } else {
            MauBinhUI.messageEl.textContent = '🤝 Hòa!';
        }

        // Show detailed results
        MauBinhUI.resultDetail.innerHTML = '';
        MauBinh.players.forEach((p) => {
            const arr = p.arrangement;
            const div = document.createElement('div');
            div.className = 'mb-result-player';
            const frontName = mbHandName(mbEval3(arr.front));
            const midName = mbHandName(mbEval5(arr.middle));
            const backName = mbHandName(mbEval5(arr.back));
            div.innerHTML = `
                <strong>${p.name}</strong> (${p.score > 0 ? '+' : ''}${p.score} chi)
                <div class="mb-result-chis">
                    <span>Front: ${frontName}</span>
                    <span>Mid: ${midName}</span>
                    <span>Back: ${backName}</span>
                </div>
            `;
            MauBinhUI.resultDetail.appendChild(div);
        });

        MauBinhUI.updateChips();

        // Host reveals new round button
        if (this.isHost) {
            const resetBtn = document.createElement('button');
            resetBtn.className = 'mb-btn mb-btn-primary';
            resetBtn.style.marginTop = '20px';
            resetBtn.textContent = 'VÁN MỚI';
            resetBtn.onclick = () => {
                this.roomRef.child('state').remove();
                MauBinhUI.newRound();
                this.setupUI(); // Reset button text
            };
            MauBinhUI.resultDetail.appendChild(resetBtn);
        } else {
            const waitMsg = document.createElement('div');
            waitMsg.style.marginTop = '20px';
            waitMsg.style.color = '#FFD700';
            waitMsg.textContent = 'Chờ chủ phòng bắt đầu ván mới...';
            MauBinhUI.resultDetail.appendChild(waitMsg);
            
            // Listen for state removal to trigger new round locally
            this.roomRef.child('state').on('value', snap => {
                if (!snap.exists() && MauBinh.phase === 'result') {
                    MauBinh.phase = 'idle';
                    MauBinhUI.newRound();
                    this.setupUI();
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.MP_MauBinh) {
            MP_MauBinh.init();
        }
    }, 100);
});
