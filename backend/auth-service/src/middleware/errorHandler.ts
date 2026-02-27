import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  logger.error('Error occurred', {
    error: message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't expose stack trace in production
  const response: any = {
    error: {
      code: getErrorCode(statusCode),
      message: statusCode === 500 ? 'Internal Server Error' : message,
      request_id: req.headers['x-request-id'] || generateRequestId()
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

const getErrorCode = (statusCode: number): string => {
  switch (statusCode) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'AUTHENTICATION_REQUIRED';
    case 403: return 'AUTHORIZATION_FAILED';
    case 404: return 'RESOURCE_NOT_FOUND';
    case 429: return 'RATE_LIMIT_EXCEEDED';
    case 500: return 'INTERNAL_ERROR';
    default: return 'UNKNOWN_ERROR';
  }
};

const generateRequestId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
