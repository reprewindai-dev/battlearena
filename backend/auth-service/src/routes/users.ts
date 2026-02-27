import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authenticateToken);

// Get current user profile
router.get('/profile', userController.getProfile);

// Update current user profile
router.put('/profile', userController.updateProfile);

// Get public user profile
router.get('/:userId', userController.getPublicProfile);

// Get leaderboard
router.get('/leaderboard', userController.getLeaderboard);

export { router as userRoutes };
