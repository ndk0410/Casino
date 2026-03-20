// lobby.js - Socket-first lobby flow for online Tien Len

if (!Account.username) {
    window.location.href = '../index.html';
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((button) => button.classList.remove('active'));
    document.querySelectorAll('.form-group').forEach((group) => group.classList.remove('active'));

    if (tab === 'create') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('form-create').classList.add('active');
        return;
    }

    document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('form-join').classList.add('active');
}

function createRoom() {
    const gameType = document.getElementById('create-game-type').value;
    const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    window.location.href = `${gameType}.html?room=${roomId}&host=true`;
}

function joinRoom() {
    const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(roomId)) {
        alert('Mã phòng phải gồm 6 ký tự chữ hoặc số.');
        return;
    }

    window.location.href = `tienlen.html?room=${roomId}`;
}

document.getElementById('join-room-id')?.addEventListener('input', (event) => {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
