import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.requestContextService.run(
      {
        method: req.method,
        route: this.getRoute(req),
        ip: this.getIp(req),
        userAgent: this.getUserAgent(req),
      },
      next,
    );
  }

  private getRoute(req: Request): string {
    return req.originalUrl.split('?')[0] || req.url;
  }

  private getIp(req: Request): string | undefined {
    const forwardedForHeader = req.headers['x-forwarded-for'];

    if (typeof forwardedForHeader === 'string') {
      return forwardedForHeader.split(',')[0]?.trim();
    }

    return req.ip;
  }

  private getUserAgent(req: Request): string | undefined {
    const userAgent = req.headers['user-agent'];

    return typeof userAgent === 'string' ? userAgent : undefined;
  }
}
