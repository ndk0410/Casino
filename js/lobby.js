// lobby.js - Multiplayer Room Management

let currentRoomId = null;
let isHost = false;

// Redirect if not logged in
if (!Account.username) {
    console.warn("Lobby: No username found, redirecting to index.html");
    window.location.href = 'index.html';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.form-group').forEach(f => f.classList.remove('active'));
    
    if (tab === 'create') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('form-create').classList.add('active');
    } else {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('form-join').classList.add('active');
    }
}

async function createRoom() {
    const gameType = document.getElementById('create-game-type').value;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const roomRef = db.ref('rooms/' + roomId);
    
    const roomData = {
        status: 'waiting',
        gameType: gameType,
        host: Account.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        players: {
            [Account.uid]: {
                name: Account.username,
                uid: Account.uid,
                isReady: true,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            }
        }
    };

    try {
        await roomRef.set(roomData);
        enterRoom(roomId, true);
    } catch (e) {
        alert("Lỗi khi tạo phòng: " + e.message);
    }
}

async function joinRoom() {
    const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
    if (roomId.length !== 6) {
        alert("Mã phòng phải có 6 ký tự!");
        return;
    }

    const roomRef = db.ref('rooms/' + roomId);
    const snapshot = await roomRef.once('value');
    
    if (!snapshot.exists()) {
        alert("Phòng không tồn tại!");
        return;
    }

    const room = snapshot.val();
    if (room.status !== 'waiting') {
        alert("Phòng này đã bắt đầu hoặc không còn hiệu lực!");
        return;
    }

    const playersCount = Object.keys(room.players || {}).length;
    if (playersCount >= 4) { // Max 4 for Tien Len
        alert("Phòng đã đầy!");
        return;
    }

    // Add player to room
    try {
        await roomRef.child('players/' + Account.uid).set({
            name: Account.username,
            uid: Account.uid,
            isReady: true,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        });
        enterRoom(roomId, false);
    } catch (e) {
        alert("Lỗi khi vào phòng: " + e.message);
    }
}

function enterRoom(roomId, host) {
    currentRoomId = roomId;
    isHost = host;
    
    document.getElementById('lobby-selection').style.display = 'none';
    document.getElementById('lobby-room-view').style.display = 'block';
    document.getElementById('view-room-id').textContent = roomId;
    
    // Listen for room updates
    const roomRef = db.ref('rooms/' + roomId);
    roomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (!room) {
            alert("Phòng đã bị giải tán!");
            window.location.reload();
            return;
        }

        // Check if game started
        if (room.status === 'playing') {
            currentRoomId = null; // Prevent leaveRoom from firing on navigate
            window.location.href = `${room.gameType}.html?room=${roomId}`;
            return;
        }

        updatePlayerList(room.players, room.host);
        
        // Host vs Guest UI
        if (Account.uid === room.host) {
            isHost = true;
            document.getElementById('host-controls').style.display = 'block';
            document.getElementById('guest-waiting').style.display = 'none';
            
            const playersArr = Object.values(room.players);
            document.getElementById('start-btn').disabled = playersArr.length < 2;
        } else {
            isHost = false;
            document.getElementById('host-controls').style.display = 'none';
            document.getElementById('guest-waiting').style.display = 'block';
        }
    });
}

function updatePlayerList(players, hostUid) {
    const listEl = document.getElementById('view-player-list');
    listEl.innerHTML = '';
    
    Object.values(players).forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item' + (p.uid === hostUid ? ' is-host' : '') + (p.uid === Account.uid ? ' is-me' : '');
        item.innerHTML = `
            <span>${p.name} <span style="font-size:9px; color:#555;">(${p.uid})</span></span>
            <span class="ready-tag">Sẵn sàng</span>
        `;
        listEl.appendChild(item);
    });
}

async function leaveRoom() {
    if (!currentRoomId) return;
    
    const roomRef = db.ref('rooms/' + currentRoomId);
    
    if (isHost) {
        // If host leaves, delete room (simple approach) or transfer host
        await roomRef.remove();
    } else {
        await roomRef.child('players/' + Account.uid).remove();
    }
    
    currentRoomId = null;
    console.log("Leaving room, redirecting to index.html");
    window.location.href = 'index.html';
}

async function startGame() {
    if (!isHost || !currentRoomId) return;
    
    await db.ref('rooms/' + currentRoomId).update({
        status: 'playing',
        startedAt: firebase.database.ServerValue.TIMESTAMP
    });
}
