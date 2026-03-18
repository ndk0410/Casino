const GameRoom = require('./GameRoom');

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(roomId, hostId, hostName) {
        if (this.rooms.has(roomId)) {
            return this.rooms.get(roomId);
        }
        const room = new GameRoom(roomId, hostId, hostName);
        this.rooms.set(roomId, room);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }

    // Attempt to join
    joinRoom(roomId, player) {
        let room = this.rooms.get(roomId);
        if (!room) {
            return { success: false, message: 'Room not found' };
        }
        return room.addPlayer(player);
    }

    leaveRoom(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (room) {
            const isEmpty = room.removePlayer(socketId);
            if (isEmpty) {
                this.deleteRoom(roomId);
            }
            return { room, isEmpty };
        }
        return { room: null };
    }
}

module.exports = RoomManager;
