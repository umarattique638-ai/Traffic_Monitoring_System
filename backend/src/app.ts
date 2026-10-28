import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { AppError } from './utils/AppError.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';

const app = express();

// Behind a proxy (Vercel, Render, Nginx) the client address comes from X-Forwarded-For.
// Rate limits and the install check's per-address limit need the real one.
if (process.env.VERCEL || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

// Security headers.
app.use(helmet());

// Only our frontend may call the API from a browser, and it may send cookies.
const allowedOrigins = env.clientUrl.split(',').map((o) => o.trim());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: same-origin, curl or Postman.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(AppError.forbidden(`Origin ${origin} is not allowed.`, 'cors_not_allowed'));
      }
    },
    credentials: true,
    // The dashboard reads the file name of a download (CSV report, account export).
    exposedHeaders: ['Content-Disposition'],
  }),
);

// Limit requests before doing any work on them.
app.use(apiLimiter);

// JSON body only, at most 10 KB.
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
