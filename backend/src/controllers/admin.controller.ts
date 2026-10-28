import type { Request, Response } from 'express';
import { toAdminUserDTO } from '../dtos/user.dto.js';
import type { UserDocument } from '../models/user.model.js';
import { adminService } from '../services/admin.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { AppError } from '../utils/AppError.js';
import {
  blockUserSchema,
  changeRoleSchema,
  listUsersSchema,
  userIdSchema,
} from '../validators/admin.validator.js';

// Admin routes are behind requireAuth + requireSuperAdmin, so req.user is the super admin doing the action.
function actorOf(req: Request): UserDocument {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const adminController = {
  // GET /api/v1/admin/users?q=&role=&status=&page=&limit=
  async listUsers(req: Request, res: Response): Promise<void> {
    const query = listUsersSchema.parse(req.query);
    const result = await adminService.listUsers(query);
    ApiResponse.ok(res, {
      ...result,
      siteCounts: undefined,
      users: result.users.map((u) => ({ ...toAdminUserDTO(u), sites: result.siteCounts.get(u._id.toString()) ?? 0 })),
    });
  },

  // GET /api/v1/admin/users/:id   The user and their logged-in devices.
  async getUser(req: Request, res: Response): Promise<void> {
    const { id } = userIdSchema.parse(req.params);
    const { user, sessions, sites } = await adminService.getUser(id);
    ApiResponse.ok(res, {
      user: toAdminUserDTO(user),
      sessions: sessions.map((s) => ({
        id: s._id.toString(),
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      sites: sites.map((s) => ({ id: s._id, domain: s.domain, status: s.status, createdAt: s.createdAt })),
    });
  },

  // PATCH /api/v1/admin/users/:id/role   { "role": "super_admin" | "admin" }
  async changeRole(req: Request, res: Response): Promise<void> {
    const { id } = userIdSchema.parse(req.params);
    const { role } = changeRoleSchema.parse(req.body);
    const user = await adminService.changeRole(actorOf(req), id, role);
    ApiResponse.ok(res, { user: toAdminUserDTO(user) }, `Role changed to ${role}.`);
  },

  // POST /api/v1/admin/users/:id/block   { "reason": "..." } (optional)
  async blockUser(req: Request, res: Response): Promise<void> {
    const { id } = userIdSchema.parse(req.params);
    const { reason } = blockUserSchema.parse(req.body);
    const user = await adminService.blockUser(actorOf(req), id, reason);
    ApiResponse.ok(res, { user: toAdminUserDTO(user) }, 'User blocked and logged out everywhere.');
  },

  // POST /api/v1/admin/users/:id/unblock
  async unblockUser(req: Request, res: Response): Promise<void> {
    const { id } = userIdSchema.parse(req.params);
    const user = await adminService.unblockUser(actorOf(req), id);
    ApiResponse.ok(res, { user: toAdminUserDTO(user) }, 'User unblocked.');
  },

  // DELETE /api/v1/admin/users/:id
  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = userIdSchema.parse(req.params);
    await adminService.deleteUser(actorOf(req), id);
    ApiResponse.ok(res, null, 'User deleted.');
  },
};
