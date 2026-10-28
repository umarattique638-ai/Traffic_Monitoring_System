import type { Request, Response } from 'express';
import { maintenanceService } from '../services/maintenance.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// The scheduled jobs, called by Vercel Cron (or any scheduler) with CRON_SECRET.
export const internalController = {
  // GET /api/v1/internal/maintenance   Erasures and retention.
  async maintenance(_req: Request, res: Response): Promise<void> {
    ApiResponse.ok(res, await maintenanceService.runMaintenance());
  },

  // GET /api/v1/internal/reconcile   Make Cloudflare KV match MongoDB.
  async reconcile(_req: Request, res: Response): Promise<void> {
    ApiResponse.ok(res, await maintenanceService.reconcileKv());
  },

  // GET /api/v1/internal/health   Is every site still sending data?
  async health(_req: Request, res: Response): Promise<void> {
    ApiResponse.ok(res, await maintenanceService.runHealth());
  },
};
