import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

/**
 * Middleware que agrega un ID único a cada request
 * Usado para tracing y correlación de logs
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Si ya existe request-id (ej: desde API Gateway), usarlo
    // De lo contrario, generar uno nuevo
    req.id = (req.headers['x-request-id'] as string) || uuid();

    // Agregar al response header para que el cliente lo reciba
    res.setHeader('x-request-id', req.id);

    next();
  }
}

// Extender el tipo Request para incluir id
declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}
