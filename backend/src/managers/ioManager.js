module.exports = {
    handleConnection: (io, socket, roomManager) => {
        let currentRoomId = null;

        socket.on('join_room', (data) => {
            const { roomId, playerName, isHost, isSolo } = data;
            
            let room;
            if (isHost) {
                room = roomManager.createRoom(roomId, socket.id, playerName);
                if (isSolo) {
                    room.addPlayer({ id: 'bot_1', name: 'Bot Gà mờ', isHost: false, isBot: true, difficulty: 'easy' });
                    room.addPlayer({ id: 'bot_2', name: 'Bot Khó chịu', isHost: false, isBot: true, difficulty: 'medium' });
                    room.addPlayer({ id: 'bot_3', name: 'Bot Trùm', isHost: false, isBot: true, difficulty: 'hard' });
                }
            } else {
                room = roomManager.getRoom(roomId);
            }
            
            if (!room) {
                return socket.emit('error_message', 'Room not found');
            }

            const joinResult = room.addPlayer({ id: socket.id, name: playerName, isHost });
            if (!joinResult.success) {
                return socket.emit('error', joinResult.message);
            }

            currentRoomId = roomId;
            socket.join(roomId);
            
            io.to(roomId).emit('room_state_update', room.getState());
            console.log(`[Join] ${playerName} joined Room ${roomId}. Total: ${room.players.length}`);
        });

        socket.on('game_action', (data) => {
            // Data looks like: { action: 'play_cards', cards: [...] }
            if (!currentRoomId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (room) {
                const result = room.handleAction(socket.id, data, io);
            }
        });

        socket.on('chat_reaction', (emoji) => {
            if (currentRoomId) {
                io.to(currentRoomId).emit('chat_reaction', { sender: socket.id, emoji: emoji });
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Disconnect] Client ${socket.id} disconnected.`);
            if (currentRoomId) {
                const { room, isEmpty } = roomManager.leaveRoom(currentRoomId, socket.id);
                if (room && !isEmpty) {
                    io.to(currentRoomId).emit('room_state_update', room.getState());
                }
            }
        });
    }
}
