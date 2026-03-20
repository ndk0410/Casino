const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');

const PORT = 8091;
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const ROOM_ID = 'ROOM42';

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function onceEvent(socket, eventName, predicate = () => true, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off(eventName, handler);
            reject(new Error(`Timeout waiting for ${eventName}`));
        }, timeoutMs);

        const handler = (payload) => {
            if (!predicate(payload)) return;
            clearTimeout(timeout);
            socket.off(eventName, handler);
            resolve(payload);
        };

        socket.on(eventName, handler);
    });
}

async function main() {
    const serverProcess = spawn(process.execPath, ['index.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PORT: String(PORT), CORS_ORIGIN: '*' },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let booted = false;
    serverProcess.stdout.on('data', (chunk) => {
        if (String(chunk).includes('Listening on port')) {
            booted = true;
        }
    });

    serverProcess.stderr.on('data', (chunk) => {
        process.stderr.write(chunk);
    });

    for (let i = 0; i < 40 && !booted; i += 1) {
        await wait(150);
    }
    assert(booted, 'Server did not boot');

    const host = io(SERVER_URL, { transports: ['websocket'] });
    const guest = io(SERVER_URL, { transports: ['websocket'] });

    try {
        await Promise.all([onceEvent(host, 'connect'), onceEvent(guest, 'connect')]);

        host.emit('join_room', {
            roomId: ROOM_ID,
            playerName: 'Host',
            isHost: true,
            isSolo: false
        });

        const hostLobbyState = await onceEvent(host, 'room_state_update', (state) => state.roomId === ROOM_ID);
        assert.strictEqual(hostLobbyState.humanCount, 1);
        assert.strictEqual(hostLobbyState.canStart, false);

        const startBlocked = onceEvent(host, 'error_message', (message) => /2 nguoi/i.test(message));
        host.emit('game_action', { action: 'start_game' });
        await startBlocked;

        guest.emit('join_room', {
            roomId: ROOM_ID,
            playerName: 'Guest',
            isHost: false,
            isSolo: false
        });

        const lobbyAfterGuest = await onceEvent(host, 'room_state_update', (state) => state.humanCount === 2);
        assert.strictEqual(lobbyAfterGuest.canStart, true);

        const bettingStatePromise = onceEvent(host, 'room_state_update', (state) => state.gameState === 'BETTING');
        host.emit('game_action', { action: 'start_game' });
        const bettingState = await bettingStatePromise;
        assert.strictEqual(bettingState.players.length, 4);
        assert.strictEqual(bettingState.botCount, 2);

        const hostPrivateHand = onceEvent(host, 'private_hand', (hand) => Array.isArray(hand) && hand.length === 13, 8000);
        const guestPrivateHand = onceEvent(guest, 'private_hand', (hand) => Array.isArray(hand) && hand.length === 13, 8000);
        const playingStatePromise = onceEvent(host, 'room_state_update', (state) => state.gameState === 'PLAYING', 8000);

        host.emit('game_action', { action: 'place_bet', amount: 200 });
        guest.emit('game_action', { action: 'place_bet', amount: 300 });

        const playingState = await playingStatePromise;
        assert.strictEqual(playingState.gameState, 'PLAYING');
        assert.deepStrictEqual(Object.keys(playingState.engineState.bets).length, 4);
        await Promise.all([hostPrivateHand, guestPrivateHand]);

        guest.disconnect();
        const takeoverState = await onceEvent(host, 'room_state_update', (state) => state.players.some((player) => /\(Bot tiep quan\)/.test(player.name)), 8000);
        assert.ok(takeoverState.players.some((player) => /\(Bot tiep quan\)/.test(player.name)));
    } finally {
        host.disconnect();
        guest.disconnect();
        serverProcess.kill('SIGTERM');
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
