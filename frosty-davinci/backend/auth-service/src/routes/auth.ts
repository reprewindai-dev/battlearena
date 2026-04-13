import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validateRequest } from '../middleware/validation';
import { authSchemas } from '../schemas/authSchemas';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const authController = new AuthController();

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration
router.post('/register', authLimiter, validateRequest(authSchemas.register), authController.register);

// Login
router.post('/login', authLimiter, validateRequest(authSchemas.login), authController.login);

// Refresh token
router.post('/refresh', validateRequest(authSchemas.refresh), authController.refresh);

// Logout
router.post('/logout', authController.logout);

// Password reset request
router.post('/forgot-password', authLimiter, validateRequest(authSchemas.forgotPassword), authController.forgotPassword);

// Password reset
router.post('/reset-password', validateRequest(authSchemas.resetPassword), authController.resetPassword);

// Email verification
router.post('/verify-email', validateRequest(authSchemas.verifyEmail), authController.verifyEmail);

// Resend verification
router.post('/resend-verification', authLimiter, validateRequest(authSchemas.resendVerification), authController.resendVerification);

export { router as authRoutes };
