const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// App route
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/app.html'));
});

// Store room connections
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    // Leave previous room if any
    if (socket.roomId) {
      socket.leave(socket.roomId);
    }
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    // Track room members
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Notify others in room
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      count: rooms.get(roomId).size
    });
    
    // Send current user count to all in room
    io.to(roomId).emit('room-update', {
      count: rooms.get(roomId).size
    });
  });
  
  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });
  
  // Gesture trigger for file transfer
  socket.on('gesture-trigger', (data) => {
    console.log(`🎬 Gesture triggered in room ${data.roomId}`);
    socket.to(data.roomId).emit('ready-to-receive', {
      from: socket.id,
      fileInfo: data.fileInfo
    });
  });
  
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    if (socket.roomId && rooms.has(socket.roomId)) {
      rooms.get(socket.roomId).delete(socket.id);
      io.to(socket.roomId).emit('room-update', {
        count: rooms.get(socket.roomId).size
      });
      
      if (rooms.get(socket.roomId).size === 0) {
        rooms.delete(socket.roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Share on network: http://192.168.x.x:${PORT}`);
});