import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../utils/ApiResponse.js';
import { env } from '../config/env.js';

const router = Router();

// Quick check that the API is up and the database is connected.
router.get('/health', (_req: Request, res: Response) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  ApiResponse.ok(res, { status: 'up', db });
});

// Public facts the dashboard needs before login: where the collector is.
router.get('/meta', (_req: Request, res: Response) => {
  ApiResponse.ok(res, { collector: env.collectorUrl, region: env.region });
});

export default router;
