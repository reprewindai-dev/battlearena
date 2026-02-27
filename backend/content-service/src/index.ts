import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import multer from 'multer';
import { beatsRoutes } from './routes/beats';
import { connectDB } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { ContentService } from './services/ContentService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;
const contentService = new ContentService();

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

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, OGG, and M4A files are allowed.'));
    }
  }
});

// Routes
app.use('/api/beats', beatsRoutes);

// Beat upload endpoint
app.post('/api/beats/upload', upload.single('beat_file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { title, artist, tempo, key_signature, genre, license_type } = req.body;
    
    const beat = await contentService.uploadBeat({
      title,
      artist,
      tempo: parseInt(tempo),
      key_signature,
      genre,
      license_type,
      uploaded_by: (req as any).user?.id || 'demo-user',
      audioBuffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype
    });

    res.status(201).json(beat);
  } catch (error) {
    next(error);
  }
});

// Beat streaming endpoint
app.get('/api/beats/:beatId/stream', async (req, res, next) => {
  try {
    const { beatId } = req.params;
    const stream = await contentService.getBeatStream(beatId);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stream.length);
    res.send(stream);
  } catch (error) {
    next(error);
  }
});

// Beat preview endpoint
app.get('/api/beats/:beatId/preview', async (req, res, next) => {
  try {
    const { beatId } = req.params;
    const preview = await contentService.getBeatPreview(beatId);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', preview.length);
    res.send(preview);
  } catch (error) {
    next(error);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'content-service', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await connectDB();
    await connectRedis();
    
    app.listen(PORT, () => {
      logger.info(`Content service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
