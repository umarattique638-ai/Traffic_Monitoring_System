import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// Errors from express.json() carry a "type" field.
function bodyErrorType(err: unknown): string | undefined {
  if (err instanceof Error && 'type' in err && typeof err.type === 'string') return err.type;
  return undefined;
}

// Every error ends up here. Express 5 also catches errors thrown in async handlers.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // 1. Errors we throw on purpose (CORS, email taken, wrong password, ...).
  if (err instanceof AppError) {
    ApiResponse.error(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // 2. Request data failed a zod schema: say which field and why.
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    ApiResponse.error(res, 400, 'validation_error', 'Some fields are not valid.', details);
    return;
  }

  // 3. The body could not be read.
  switch (bodyErrorType(err)) {
    case 'entity.parse.failed':
      ApiResponse.error(res, 400, 'invalid_json', 'The request body is not valid JSON.');
      return;
    case 'entity.too.large':
      ApiResponse.error(res, 413, 'body_too_large', 'The request body is too large.');
      return;
    case 'encoding.unsupported':
    case 'charset.unsupported':
      ApiResponse.error(res, 415, 'unsupported_encoding', 'Send the body as UTF-8 JSON.');
      return;
  }

  // 4. Anything else is a bug: log it, and never show its details to the client in production.
  console.error(err);
  const message =
    !env.isProd && err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  ApiResponse.error(res, 500, 'server_error', message);
}
