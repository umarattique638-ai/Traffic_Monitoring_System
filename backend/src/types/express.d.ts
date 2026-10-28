import type { UserDocument } from '../models/user.model.js';

declare global {
  namespace Express {
    interface Request {
      // requireAuth: who is logged in, taken from the access token.
      auth?: {
        userId: string;
        sessionId: string;
      };
      // requireSuperAdmin: the logged-in user, loaded from the database.
      user?: UserDocument;
    }
  }
}

export {};
