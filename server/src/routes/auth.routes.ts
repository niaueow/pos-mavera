import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validate';
import { loginSchema } from '../validators/auth.validator';
import { authenticate } from '../middlewares/auth';
import { loginRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  (req, res, next) => authController.login(req, res, next)
);

router.get(
  '/me',
  authenticate,
  (req, res, next) => authController.getMe(req, res, next)
);

export default router;
