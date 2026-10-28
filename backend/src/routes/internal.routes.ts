import { Router } from 'express';
import { internalController } from '../controllers/internal.controller.js';
import { requireCron } from '../middlewares/cron.middleware.js';

const router = Router();

// Scheduled jobs (Vercel Cron): only with the CRON_SECRET bearer token.
router.use(requireCron);

router.get('/maintenance', internalController.maintenance);
router.get('/reconcile', internalController.reconcile);
router.get('/health', internalController.health);

export default router;
