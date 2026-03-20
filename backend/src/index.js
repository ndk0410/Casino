require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const logger = require('./utils/logger');
const ioManager = require('./managers/ioManager');
const RoomManager = require('./managers/roomManager');

const app = express();
const allowedOrigin = process.env.CORS_ORIGIN || '*';

app.use(cors({
    origin: allowedOrigin === '*' ? true : allowedOrigin,
    credentials: true
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigin === '*' ? true : allowedOrigin,
        methods: ["GET", "POST"]
    }
});

// Initialize Managers
const roomManager = new RoomManager();

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    logger.info(`[Socket] Client connected: ${socket.id}`);
    ioManager.handleConnection(io, socket, roomManager);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Casino Backend is running' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[Server] Production-ready casino backend execution started on port ${PORT}`);
});
