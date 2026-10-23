import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Operational AppError
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode, message: err.message, details: err.details },
      `Operational Error: ${err.message}`
    );
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Handle TypeORM database specific errors (e.g. unique constraint violation, check constraint violation)
  const dbError = err as { code?: string; detail?: string; message?: string };
  if (dbError.code === '23505') {
    // Unique violation
    logger.warn({ err }, 'PostgreSQL unique constraint violation');
    res.status(409).json({
      success: false,
      message: 'A record with this identifier already exists',
      code: 'DUPLICATE_KEY',
    });
    return;
  }

  if (dbError.code === '23514') {
    // Check constraint violation
    logger.warn({ err }, 'PostgreSQL check constraint violation');
    res.status(400).json({
      success: false,
      message: 'Operation violates a database integrity constraint',
      code: 'CONSTRAINT_VIOLATION',
    });
    return;
  }

  // Unhandled / Internal Server Error
  logger.error({ err }, `Unhandled Server Error: ${err.message}`);

  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
