const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'chat-server.log' })
  ]
});

// Configuration
const PORT = process.env.CHAT_PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'chat-secret';
const MAX_CONNECTIONS = 1000;
const MESSAGE_RATE_LIMIT = 10; // messages per minute
const ROOM_CLEANUP_INTERVAL = 300000; // 5 minutes

// In-memory storage (in production, use Redis)
const rooms = new Map();
const userConnections = new Map();
const messageHistory = new Map();
const flaggedMessages = new Map();

class ChatRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.clients = new Map();
    this.typingUsers = new Set();
    this.messageHistory = [];
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  addClient(ws, userId, username, isModerator = false) {
    const client = {
      ws,
      userId,
      username,
      isModerator,
      joinedAt: Date.now(),
      lastPing: Date.now(),
      messageCount: 0,
      lastMessageTime: 0
    };

    this.clients.set(userId, client);
    this.lastActivity = Date.now();

    // Notify others
    this.broadcast({
      type: 'user_joined',
      data: { id: userId, username }
    }, userId);

    // Send room history to new client
    client.ws.send(JSON.stringify({
      type: 'history',
      data: this.messageHistory.slice(-50) // Last 50 messages
    }));

    logger.info(`User ${username} (${userId}) joined room ${roomId}`);
  }

  removeClient(userId) {
    const client = this.clients.get(userId);
    if (client) {
      this.clients.delete(userId);
      this.typingUsers.delete(userId);
      
      // Notify others
      this.broadcast({
        type: 'user_left',
        data: { userId }
      });

      logger.info(`User ${client.username} (${userId}) left room ${roomId}`);
    }
  }

  broadcast(message, excludeUserId = null) {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client, userId) => {
      if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
        } catch (error) {
          logger.error(`Failed to send message to user ${userId}:`, error);
        }
      }
    });
  }

  addMessage(message) {
    // Check rate limiting
    const client = this.clients.get(message.userId);
    if (client) {
      const now = Date.now();
      const timeSinceLastMessage = now - client.lastMessageTime;
      
      if (timeSinceLastMessage < 6000) { // 6 seconds between messages
        client.ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Please wait before sending another message' }
        }));
        return false;
      }

      client.lastMessageTime = now;
      client.messageCount++;
    }

    // Add profanity filter (simple version)
    const filteredMessage = this.filterMessage(message.message);
    if (filteredMessage !== message.message) {
      message.message = filteredMessage;
      message.isFiltered = true;
    }

    // Add to history
    this.messageHistory.push({
      ...message,
      timestamp: Date.now()
    });

    // Keep only last 100 messages
    if (this.messageHistory.length > 100) {
      this.messageHistory = this.messageHistory.slice(-100);
    }

    this.lastActivity = Date.now();
    return true;
  }

  filterMessage(message) {
    const profanityList = ['fuck', 'shit', 'ass', 'bitch', 'cunt']; // Add more as needed
    let filtered = message;
    
    profanityList.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    });

    return filtered;
  }

  setTyping(userId, isTyping) {
    if (isTyping) {
      this.typingUsers.add(userId);
    } else {
      this.typingUsers.delete(userId);
    }

    this.broadcast({
      type: 'typing',
      data: { users: Array.from(this.typingUsers) }
    });
  }

  flagMessage(messageId, reason, flaggedBy) {
    const message = this.messageHistory.find(m => m.id === messageId);
    if (message) {
      message.isFlagged = true;
      message.flaggedBy = flaggedBy;
      message.flagReason = reason;
      message.flaggedAt = Date.now();

      // Store in flagged messages
      flaggedMessages.set(messageId, {
        ...message,
        roomId: this.roomId,
        flaggedBy,
        reason,
        flaggedAt: Date.now()
      });

      logger.warn(`Message flagged in room ${roomId}: ${reason}`);
      return true;
    }
    return false;
  }

  getClientCount() {
    return this.clients.size;
  }

  cleanup() {
    const now = Date.now();
    const inactiveClients = [];

    this.clients.forEach((client, userId) => {
      if (now - client.lastPing > 60000) { // 1 minute timeout
        inactiveClients.push(userId);
      }
    });

    inactiveClients.forEach(userId => {
      this.removeClient(userId);
    });

    return inactiveClients.length;
  }
}

// Rate limiting middleware
const createRateLimit = () => {
  const requests = new Map();

  return (userId, callback) => {
    const now = Date.now();
    const userRequests = requests.get(userId) || [];
    
    // Remove old requests (older than 1 minute)
    const validRequests = userRequests.filter(time => now - time < 60000);
    
    if (validRequests.length >= MESSAGE_RATE_LIMIT) {
      callback(false);
      return;
    }

    validRequests.push(now);
    requests.set(userId, validRequests);
    callback(true);
  };
};

const rateLimit = createRateLimit();

// WebSocket server setup
const wss = new WebSocket.Server({ 
  port: PORT,
  maxPayload: 1024 * 1024, // 1MB max message size
});

logger.info(`Chat server started on port ${PORT}`);

wss.on('connection', (ws, request) => {
  const url = new URL(request.url, 'http://localhost');
  const roomId = url.searchParams.get('room');
  const userId = url.searchParams.get('user');
  const token = url.searchParams.get('token');

  if (!roomId || !userId) {
    ws.close(1008, 'Missing room or user parameter');
    return;
  }

  // Verify JWT token if provided
  let isModerator = false;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      isModerator = decoded.role === 'moderator' || decoded.role === 'admin';
    } catch (error) {
      logger.warn(`Invalid token for user ${userId}`);
    }
  }

  // Get or create room
  let room = rooms.get(roomId);
  if (!room) {
    room = new ChatRoom(roomId);
    rooms.set(roomId, room);
    messageHistory.set(roomId, []);
  }

  // Check room capacity
  if (room.getClientCount() >= MAX_CONNECTIONS / 10) { // Max 100 users per room
    ws.close(1013, 'Room is full');
    return;
  }

  // Get username (in production, fetch from database)
  const username = url.searchParams.get('username') || `User${userId.slice(-4)}`;

  // Add client to room
  room.addClient(ws, userId, username, isModerator);
  userConnections.set(userId, { ws, roomId, username });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(room, userId, message);
    } catch (error) {
      logger.error(`Invalid message from user ${userId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Invalid message format' }
      }));
    }
  });

  ws.on('close', () => {
    room.removeClient(userId);
    userConnections.delete(userId);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket error for user ${userId}:`, error);
  });

  ws.on('pong', () => {
    const client = room.clients.get(userId);
    if (client) {
      client.lastPing = Date.now();
    }
  });
});

function handleMessage(room, userId, message) {
  const client = room.clients.get(userId);
  if (!client) return;

  switch (message.type) {
    case 'message':
      rateLimit(userId, (allowed) => {
        if (!allowed) {
          client.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Rate limit exceeded' }
          }));
          return;
        }

        const chatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          username: client.username,
          message: message.data.message,
          timestamp: Date.now(),
          type: 'message',
          metadata: {
            battleId: room.roomId,
            isModerator: client.isModerator
          }
        };

        if (room.addMessage(chatMessage)) {
          room.broadcast({
            type: 'message',
            data: chatMessage
          });
        }
      });
      break;

    case 'typing':
      room.setTyping(userId, message.data.isTyping);
      break;

    case 'flag':
      if (client.isModerator) {
        room.flagMessage(message.data.messageId, message.data.reason, userId);
      }
      break;

    case 'ping':
      client.ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

// Cleanup inactive rooms and connections
setInterval(() => {
  const now = Date.now();
  const roomsToDelete = [];

  rooms.forEach((room, roomId) => {
    const cleaned = room.cleanup();
    
    // Delete room if empty for more than 10 minutes
    if (room.getClientCount() === 0 && (now - room.lastActivity) > 600000) {
      roomsToDelete.push(roomId);
    }
  });

  roomsToDelete.forEach(roomId => {
    rooms.delete(roomId);
    messageHistory.delete(roomId);
    logger.info(`Cleaned up inactive room: ${roomId}`);
  });

  logger.info(`Active rooms: ${rooms.size}, Total connections: ${userConnections.size}`);
}, ROOM_CLEANUP_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down chat server...');
  wss.close(() => {
    logger.info('Chat server shut down');
    process.exit(0);
  });
});

module.exports = { ChatRoom, ChatServer: wss };
