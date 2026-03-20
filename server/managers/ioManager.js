module.exports = {
    handleConnection: (io, socket, roomManager) => {
        let currentRoomId = null;

        socket.on('join_room', (data) => {
            const { roomId, playerName, isHost, isSolo } = data;
            let room = null;

            if (isHost) {
                room = roomManager.createRoom(roomId, socket.id, playerName);
            } else {
                room = roomManager.getRoom(roomId);
            }

            if (!room) {
                socket.emit('error_message', 'Phong khong ton tai hoac chu phong chua vao ban.');
                return;
            }

            const joinResult = isHost ? { success: true } : room.addPlayer({
                id: socket.id,
                name: playerName,
                isHost: false
            });

            if (!joinResult.success) {
                socket.emit('error_message', joinResult.message);
                return;
            }

            currentRoomId = roomId;
            socket.join(roomId);

            if (isSolo && room.canStartGame()) {
                room.startBetting(io);
            } else {
                io.to(roomId).emit('room_state_update', room.getState());
            }
        });

        socket.on('game_action', (data) => {
            if (!currentRoomId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (room) {
                room.handleAction(socket.id, data, io);
            }
        });

        socket.on('chat_reaction', (emoji) => {
            if (currentRoomId) {
                io.to(currentRoomId).emit('chat_reaction', { sender: socket.id, emoji });
            }
        });

        socket.on('disconnect', () => {
            if (!currentRoomId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;

            const { isEmpty } = room.handleDisconnect(socket.id, io);
            if (isEmpty) {
                roomManager.deleteRoom(currentRoomId);
            }
        });
    }
};
