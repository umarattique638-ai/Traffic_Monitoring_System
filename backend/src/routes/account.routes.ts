import { Router } from 'express';
import { accountController } from '../controllers/account.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { attachUser } from '../middlewares/user.middleware.js';

const router = Router();

router.use(requireAuth, attachUser);

router.get('/', accountController.profile);
router.get('/activity', accountController.activity);
router.get('/export', accountController.exportAll);
router.post('/delete', accountController.remove);

export default router;
