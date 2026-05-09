import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestLogContext } from './types/audit-log.types';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestLogContext>();

  run<T>(context: RequestLogContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestLogContext {
    return this.storage.getStore() ?? {};
  }

  set(partialContext: Partial<RequestLogContext>): void {
    const currentContext = this.storage.getStore();

    if (!currentContext) {
      return;
    }

    Object.assign(currentContext, partialContext);
  }

  setUserId(userId: string | null): void {
    this.set({ userId });
  }
}
