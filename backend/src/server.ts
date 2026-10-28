import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { adminService } from './services/admin.service.js';

// Connect to the database first, then start listening.
async function start(): Promise<void> {
  await connectDB();

  // Accounts listed in SUPER_ADMIN_EMAILS get the super admin role.
  const promoted = await adminService.syncSuperAdmins();
  if (promoted > 0) console.log(`Super admins set from SUPER_ADMIN_EMAILS: ${promoted}`);

  app.listen(env.port, () => {
    console.log(`API on http://localhost:${env.port}`);
  });
}

start().catch((err: unknown) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
