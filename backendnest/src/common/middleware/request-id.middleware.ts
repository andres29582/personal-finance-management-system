import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

const MAX_REQUEST_ID_LENGTH = 128;

function normalizeRequestId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized && normalized.length <= MAX_REQUEST_ID_LENGTH
    ? normalized
    : undefined;
}

export function resolveRequestId(req: Request): string {
  return (
    normalizeRequestId(req.id) ??
    normalizeRequestId(req.headers['x-request-id']) ??
    uuid()
  );
}

export function applyRequestId(req: Request, res: Response): string {
  const requestId = resolveRequestId(req);
  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  return requestId;
}

/**
 * Middleware que agrega un ID único a cada request
 * Usado para tracing y correlación de logs
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    applyRequestId(req, res);
    next();
  }
}

// Extender el tipo Request para incluir id
declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}
