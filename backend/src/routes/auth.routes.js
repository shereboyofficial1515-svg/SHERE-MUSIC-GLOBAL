import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter, emailLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from '../validators/auth.validators.js';
import { oauthTokenSchema, providerParam } from '../validators/me.validators.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), auth.register);
router.post('/login', authLimiter, validate(loginSchema), auth.login);
router.post('/logout', auth.logout);
router.get('/me', auth.me);
router.post('/verify-email', authLimiter, validate(tokenSchema), auth.verifyEmail);
router.post('/resend-verification', emailLimiter, validate(emailOnlySchema), auth.resendVerification);
router.post('/forgot-password', emailLimiter, validate(emailOnlySchema), auth.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), auth.resetPassword);
router.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), auth.changePassword);
router.post('/confirm-email', authLimiter, validate(tokenSchema), auth.confirmEmailChange);
router.post('/oauth/:provider', authLimiter, validate(providerParam, 'params'), validate(oauthTokenSchema), auth.oauthSignIn);
router.post('/oauth/:provider/link', requireAuth, authLimiter, validate(providerParam, 'params'), validate(oauthTokenSchema), auth.oauthLink);

export default router;
