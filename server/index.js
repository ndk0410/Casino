require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // allow any origin for local dev
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Tien Len Miền Nam Authoritative Server is running.');
});

// Import Managers
const RoomManager = require('./managers/roomManager');
const ioManager = require('./managers/ioManager');

// Keep global references if needed
const roomManager = new RoomManager();

io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    ioManager.handleConnection(io, socket, roomManager);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});
