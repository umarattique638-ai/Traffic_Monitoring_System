import { Router } from 'express';
import { setupController } from '../controllers/setup.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { setupLimiter } from '../middlewares/rateLimit.middleware.js';
import { attachUser } from '../middlewares/user.middleware.js';

const router = Router();

// Adding a site: nothing is stored until every install check passed.
router.use(requireAuth, attachUser);

router.get('/', setupController.current);
router.post('/', setupLimiter, setupController.start);
router.delete('/', setupController.cancel);
router.post('/verify', setupLimiter, setupController.verify);

export default router;
