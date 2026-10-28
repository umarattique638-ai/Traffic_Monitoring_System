/**
 * The API as ONE Vercel serverless function. Vercel serves the built dashboard (Frontend/dist) from its CDN
 * and sends every /api/* request here (see ../scripts/build-vercel.mjs and ../../vercel.json).
 *
 * The same Express app as the local server; the MongoDB connection is made once per warm instance and reused.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { adminService } from './services/admin.service.js';

let ready: Promise<void> | null = null;

async function boot(): Promise<void> {
  if (mongoose.connection.readyState !== 1) await connectDB();
  await adminService.syncSuperAdmins().catch(() => 0);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // The route sends /api/<rest> here as /api?__path=/api/<rest>: put the original path back.
  const url = new URL(req.url ?? '/', 'http://local');
  const path = url.searchParams.get('__path');
  if (path) {
    url.searchParams.delete('__path');
    req.url = path + (url.search ? url.search : '');
  }
  try {
    ready ??= boot();
    await ready;
  } catch (error) {
    ready = null; // the next request tries again (Atlas briefly unreachable)
    console.error(JSON.stringify({ tw: 'setup_failed', message: error instanceof Error ? error.message : String(error) }));
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'setup_failed', message: 'The server could not connect to its database.' } }));
    return;
  }
  app(req as never, res as never);
}
