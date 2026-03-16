const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));

const rooms = {};

function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

io.on('connection', (socket) => {
    console.log('Connect:', socket.id);

    socket.on('create-room', () => {
        let code = genCode();
        while (rooms[code]) code = genCode();
        rooms[code] = { players: [socket.id], host: socket.id };
        socket.join(code);
        socket.roomCode = code;
        socket.playerNum = 1;
        socket.emit('room-created', code);
        console.log('Room created:', code);
    });

    socket.on('join-room', (code) => {
        code = code.toUpperCase().trim();
        const room = rooms[code];
        if (!room) return socket.emit('join-error', 'Code invalide');
        if (room.players.length >= 2) return socket.emit('join-error', 'Partie pleine');

        room.players.push(socket.id);
        socket.join(code);
        socket.roomCode = code;
        socket.playerNum = 2;
        socket.emit('room-joined', code);

        // Tell both players to start
        io.to(code).emit('game-start', { host: room.host });
        console.log('Room', code, 'starting');
    });

    // Relay position data
    socket.on('pos', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('pos', data);
        }
    });

    // Relay obstacles from host to guest
    socket.on('sync-obstacles', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('sync-obstacles', data);
        }
    });

    // Relay bonus spawn (from host)
    socket.on('bonus-spawn', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('bonus-spawn', data);
        }
    });

    // Relay bonus pickup
    socket.on('bonus-pickup', (data) => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit('bonus-pickup', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnect:', socket.id);
        if (socket.roomCode && rooms[socket.roomCode]) {
            io.to(socket.roomCode).emit('opponent-left');
            delete rooms[socket.roomCode];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Paint Battle server on port ${PORT}`));
