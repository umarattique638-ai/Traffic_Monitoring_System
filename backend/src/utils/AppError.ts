// An error we throw on purpose. The error middleware turns it into a JSON answer.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  // Shortcuts for the common cases.
  static badRequest(message: string, code = 'bad_request', details?: unknown): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Please log in to continue.', code = 'unauthorized'): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(message = 'You are not allowed to do this.', code = 'forbidden'): AppError {
    return new AppError(403, code, message);
  }

  static notFound(message = 'Not found.', code = 'not_found'): AppError {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = 'conflict'): AppError {
    return new AppError(409, code, message);
  }

  static tooManyRequests(
    message = 'Too many requests. Please try again later.',
    code = 'too_many_requests',
  ): AppError {
    return new AppError(429, code, message);
  }
}
