import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { attachUser } from './middleware/auth.js';
import { apiLimiter, csrfGuard, CSRF_HEADER } from './middleware/security.js';
import { maintenanceGate } from './middleware/maintenance.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import libraryRoutes from './routes/library.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.set('query parser', 'simple'); // no nested objects in query strings

  // The API serves JSON only, so the strictest CSP is fine here.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin/non-browser requests (no Origin header) and configured frontends only.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', CSRF_HEADER],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    })
  );

  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.get('/health', (req, res) => res.json({ data: { status: 'ok', time: new Date().toISOString() } }));
  api.use(apiLimiter);
  api.use(csrfGuard);
  api.use(attachUser);
  api.use(maintenanceGate);
  api.use('/auth', authRoutes);
  api.use('/admin', adminRoutes);
  api.use('/', libraryRoutes);
  api.use('/', publicRoutes);

  app.use('/api', api);
  app.get('/', (req, res) => res.json({ data: { name: 'SHERE MUSIC API', health: '/api/health' } }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
