import type { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';

// No route matched: a JSON 404 instead of Express's HTML page.
export function notFound(req: Request, res: Response): void {
  ApiResponse.error(res, 404, 'not_found', `Cannot ${req.method} ${req.originalUrl}`);
}
