import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { siteController } from '../controllers/site.controller.js';
import { statsController } from '../controllers/stats.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { setupLimiter } from '../middlewares/rateLimit.middleware.js';
import { attachUser } from '../middlewares/user.middleware.js';

const router = Router();

// Every route below: logged in; each user sees only their own sites.
router.use(requireAuth, attachUser);

// Sites
router.get('/', siteController.list);
router.get('/preview', siteController.preview);
router.post('/sync-all', siteController.syncAll);
router.get('/:id', siteController.get);
router.patch('/:id', siteController.update);
router.delete('/:id', siteController.remove);
router.post('/:id/sync', siteController.sync);
router.get('/:id/health', siteController.health);
router.post('/:id/health/check', setupLimiter, siteController.checkHealth);
router.post('/:id/domain', setupLimiter, siteController.changeDomain);
router.post('/:id/allowed-hosts', siteController.allowHost);

// Keys: add a new one, then revoke the old one
router.post('/:id/keys', siteController.createKey);
router.post('/:id/keys/:keyId/revoke', siteController.revokeKey);

// Analytics (ClickHouse)
router.get('/:id/stats/overview', statsController.overview);
router.get('/:id/stats/filter-values', statsController.filterValues);
router.get('/:id/stats/live', statsController.live);
router.get('/:id/stats/events', statsController.events);
router.get('/:id/stats/drops', statsController.drops);
router.get('/:id/export.csv', statsController.csv);

// Reports (saved CSV exports)
router.get('/:id/exports', reportController.list);
router.post('/:id/exports', reportController.create);
router.get('/:id/exports/:reportId/download', reportController.download);
router.delete('/:id/exports/:reportId', reportController.remove);

export default router;
