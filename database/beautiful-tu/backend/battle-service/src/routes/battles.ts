import { Router } from 'express';
import { BattleService } from '../services/BattleService';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
const battleService = new BattleService();

// Get all available battles
router.get('/', asyncHandler(async (req, res) => {
  const { status = 'waiting', limit = 20, offset = 0 } = req.query;
  
  const battles = await battleService.getAvailableBattles({
    status: status as string,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  });
  
  res.json(battles);
}));

// Get battle by ID
router.get('/:battleId', asyncHandler(async (req, res) => {
  const { battleId } = req.params;
  const battle = await battleService.getBattleById(battleId);
  res.json(battle);
}));

// Create new battle
router.post('/', asyncHandler(async (req, res) => {
  const battleData = req.body;
  const battle = await battleService.createBattle(battleData);
  res.status(201).json(battle);
}));

// Join battle
router.post('/:battleId/join', asyncHandler(async (req, res) => {
  const { battleId } = req.params;
  const { userId } = req.body;
  
  const result = await battleService.joinBattle(battleId, userId);
  res.json(result);
}));

// Leave battle
router.post('/:battleId/leave', asyncHandler(async (req, res) => {
  const { battleId } = req.params;
  const { userId } = req.body;
  
  const result = await battleService.leaveBattle(battleId, userId);
  res.json(result);
}));

export { router as battlesRoutes };
