const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// ✅ CORS properly configured for Vercel frontend
const io = new Server(server, {
  cors: {
    origin: "https://frontend-air-gesture-share.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type"]
  },
  transports: ['websocket', 'polling']
});

// ✅ Health check endpoint (Render ke liye)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Store room connections
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  socket.on('join-room', (roomId) => {
    if (socket.roomId) {
      socket.leave(socket.roomId);
    }
    
    socket.join(roomId);
    socket.roomId = roomId;
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      count: rooms.get(roomId).size
    });
    
    io.to(roomId).emit('room-update', {
      count: rooms.get(roomId).size
    });
  });
  
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
  console.log(`🚀 Signaling server running on port ${PORT}`);
  console.log(`✅ Allowed origin: https://frontend-air-gesture-share.vercel.app`);
  console.log(`💚 Health check: /health`);
});
