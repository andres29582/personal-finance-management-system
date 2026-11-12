import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../src/common/authenticated-request';
import { REQUEST_DEADLINE_MS } from './postgres-concurrency.helper';

type Decision = 'held' | 'released' | 'cancelled';
type Reservation = {
  decision: Decision;
  entered: () => void;
  completion: Promise<void>;
  settle: () => void;
};

/** Test-only staging AFTER the real guards, before a financial handler starts.
 * User FK locks held by a paused financial transaction must not prevent the
 * competing request from completing authentication before the SQL experiment.
 */
export class AuthorizedRequestAdmissions implements NestInterceptor {
  private readonly reservations = new Map<string, Reservation>();

  hold() {
    const token = randomUUID();
    let entered!: () => void;
    let settle!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const completion = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const reservation: Reservation = {
      decision: 'held',
      entered,
      completion,
      settle,
    };
    this.reservations.set(token, reservation);
    return {
      token,
      entered: ready,
      release: () => {
        if (reservation.decision !== 'held') return;
        reservation.decision = 'released';
        reservation.settle();
      },
    };
  }

  cancelAll(): void {
    for (const reservation of this.reservations.values()) {
      reservation.decision = 'cancelled';
      reservation.settle();
    }
    this.reservations.clear();
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.header('X-E2E-Admission');
    if (!token) return next.handle();
    const reservation = this.reservations.get(token);
    if (!reservation || !request.user?.id)
      throw new Error('Authenticated admission required');
    const response = context.switchToHttp().getResponse<ServerResponse>();
    const cancel = () => {
      if (reservation.decision !== 'held') return;
      reservation.decision = 'cancelled';
      reservation.settle();
    };
    const timer = setTimeout(cancel, REQUEST_DEADLINE_MS);
    response.once('close', cancel);
    try {
      reservation.entered();
      await reservation.completion;
      if (reservation.decision !== 'released')
        throw new Error('Authorized admission cancelled');
      return next.handle();
    } finally {
      clearTimeout(timer);
      response.removeListener('close', cancel);
      this.reservations.delete(token);
    }
  }
}
