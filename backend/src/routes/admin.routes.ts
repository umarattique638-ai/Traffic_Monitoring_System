import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireSuperAdmin } from '../middlewares/superAdmin.middleware.js';

const router = Router();

// Every route below: logged in, and a super admin.
router.use(requireAuth, requireSuperAdmin);

router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id/role', adminController.changeRole);
router.post('/users/:id/block', adminController.blockUser);
router.post('/users/:id/unblock', adminController.unblockUser);
router.delete('/users/:id', adminController.deleteUser);

export default router;
