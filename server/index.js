require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: corsOrigin }));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST']
    }
});

app.get('/', (req, res) => {
    res.send('Tien Len Mien Nam Authoritative Server is running.');
});

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

const RoomManager = require('./managers/roomManager');
const ioManager = require('./managers/ioManager');

const roomManager = new RoomManager();

io.on('connection', (socket) => {
    ioManager.handleConnection(io, socket, roomManager);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});
