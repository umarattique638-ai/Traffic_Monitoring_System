import type { Response } from 'express';

// Every answer from the API has one of these two shapes, so the frontend always knows where to look.
export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const ApiResponse = {
  // 200 OK with data.
  ok<T>(res: Response, data: T, message = 'OK'): void {
    const body: SuccessBody<T> = { success: true, message, data };
    res.status(200).json(body);
  },

  // 201 Created, e.g. after signup.
  created<T>(res: Response, data: T, message = 'Created'): void {
    const body: SuccessBody<T> = { success: true, message, data };
    res.status(201).json(body);
  },

  // Any error answer. Only the error middleware and the rate limiter should call this.
  error(res: Response, statusCode: number, code: string, message: string, details?: unknown): void {
    const body: ErrorBody = {
      success: false,
      error: details === undefined ? { code, message } : { code, message, details },
    };
    res.status(statusCode).json(body);
  },
};
