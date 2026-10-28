import { Router } from 'express';
import accountRoutes from './account.routes.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import internalRoutes from './internal.routes.js';
import setupRoutes from './setup.routes.js';
import siteRoutes from './site.routes.js';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/account', accountRoutes);
router.use('/setup', setupRoutes);
router.use('/sites', siteRoutes);
router.use('/internal', internalRoutes);

export default router;
