require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const logger = require('./utils/logger');
const redis = require('./utils/redis');
const ioManager = require('./managers/ioManager');
const RoomManager = require('./managers/roomManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
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
server.listen(PORT, () => {
    logger.info(`[Server] Production-ready casino backend execution started on port ${PORT}`);
});
