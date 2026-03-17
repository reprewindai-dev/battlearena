import { Router } from 'express';
import { ContentService } from '../services/ContentService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const contentService = new ContentService();

// Browse beats with filtering
router.get('/', asyncHandler(async (req, res) => {
  const { genre, tempo_min, tempo_max, limit = 20, offset = 0 } = req.query;
  
  const result = await contentService.browseBeats({
    genre: genre as string,
    tempo_min: tempo_min ? parseInt(tempo_min as string) : undefined,
    tempo_max: tempo_max ? parseInt(tempo_max as string) : undefined,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  });
  
  res.json(result);
}));

// Get beat by ID
router.get('/:beatId', asyncHandler(async (req, res) => {
  const { beatId } = req.params;
  const beat = await contentService.getBeatById(beatId);
  res.json(beat);
}));

// Upload beat (protected route)
router.post('/upload', asyncHandler(async (req, res) => {
  // This would be handled by the main upload endpoint in index.ts
  res.status(501).json({ error: 'Use /api/beats/upload endpoint' });
}));

export { router as beatsRoutes };
