import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { createError } from './errorHandler';

export const validateRequest = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        issue: detail.message
      }));

      const validationError = createError('Validation failed', 400);
      (validationError as any).details = details;
      return next(validationError);
    }

    req.body = value;
    next();
  };
};
