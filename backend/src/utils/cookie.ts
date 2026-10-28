import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ACCESS_TOKEN_SECONDS } from './jwt.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const base: CookieOptions = {
  httpOnly: true, // JavaScript in the browser cannot read them
  secure: env.isProd, // HTTPS only in production
  sameSite: 'lax',
};

// The access token goes with every API request.
const accessOptions: CookieOptions = { ...base, path: '/' };

// The refresh token goes only to the auth routes (refresh, logout), never to the rest of the API.
const refreshOptions: CookieOptions = { ...base, path: '/api/v1/auth' };

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: ACCESS_TOKEN_SECONDS * 1000 });
  const refreshMaxAge = env.sessionDays * 24 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE, refreshToken, { ...refreshOptions, maxAge: refreshMaxAge });
}

// Only a new access token (used when the refresh token stays the same).
export function setAccessCookie(res: Response, accessToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, { ...accessOptions, maxAge: ACCESS_TOKEN_SECONDS * 1000 });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, accessOptions);
  res.clearCookie(REFRESH_COOKIE, refreshOptions);
}

// Reads one cookie as a string; null when it is missing or empty.
export function readCookie(req: Request, name: string): string | null {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' && value ? value : null;
}
