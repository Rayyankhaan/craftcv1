import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db.ts';
import { attachAuth } from './server/services/auth.ts';
import { authRouter } from './server/routes/auth.ts';
import { resumesRouter, publicResumeRouter } from './server/routes/resumes.ts';
import { uploadRouter } from './server/routes/upload.ts';
import { aiRouter } from './server/routes/ai.ts';
import { jobsRouter } from './server/routes/jobs.ts';
import { billingRouter } from './server/routes/billing.ts';
import { supportRouter } from './server/routes/support.ts';
import { adminRouter } from './server/routes/admin.ts';

async function startServer() {
  initializeDatabase();

  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);

  // Capture rawBody for Razorpay webhook signature verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(cookieParser());
  app.use(attachAuth);

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/resumes', resumesRouter);
  app.use('/api/public/resumes', publicResumeRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/admin', adminRouter);

  // Multer & API error handler
  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(400).json({ error: message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CraftCV server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
