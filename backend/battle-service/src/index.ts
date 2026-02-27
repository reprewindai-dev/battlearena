import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { battlesRoutes } from './routes/battles';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/battles', battlesRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'battle-service', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDB();
    await connectRedis();
    
    server.listen(PORT, () => {
      logger.info(`Battle service running on port ${PORT}`);
      logger.info(`WebSocket server ready for battle connections`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
