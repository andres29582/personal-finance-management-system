import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passwordChangedConfig } from './password-changed.config';
import { PasswordChangedOutboxRepository } from './password-changed-outbox.repository';
import { sendPasswordChanged } from './resend-password-changed';

@Injectable()
export class PasswordChangedWorker implements OnModuleInit, OnModuleDestroy {
  private readonly config;
  private readonly logger = new Logger(PasswordChangedWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;
  private stopping = false;

  constructor(
    config: ConfigService,
    private readonly outbox: PasswordChangedOutboxRepository,
  ) {
    this.config = passwordChangedConfig(config);
  }
  onModuleInit() {
    if (!this.config.enabled) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, 30_000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  async runOnce(): Promise<void> {
    if (!this.config.enabled || this.stopping) return;
    if (this.running) return this.running;
    const operation = this.poll();
    this.running = operation;
    try {
      await operation;
    } finally {
      if (this.running === operation) this.running = null;
    }
  }
  private async poll(): Promise<void> {
    try {
      const event = await this.outbox.claim(this.config.sender);
      if (event?.state === 'claimed' && event.payload) {
        // Live configuration is rejected; no key is read and mock != delivered.
        const outcome = await sendPasswordChanged(event.payload, event.id, {
          networkEnabled: false,
        });
        const state = await this.outbox.settle(event, outcome);
        if (!state) this.logger.warn('PASSWORD_CHANGED_STALE_ACK');
        if (state === 'failed' || state === 'reconciliation')
          this.logger.warn('PASSWORD_CHANGED_ATTENTION_REQUIRED');
      } else if (event) {
        this.logger.warn('PASSWORD_CHANGED_ATTENTION_REQUIRED');
      }
      await this.outbox.purgeDelivered();
    } catch {
      // DB acknowledgement failure leaves the claim recoverable; never log payloads.
      this.logger.warn('PASSWORD_CHANGED_WORKER_FAILURE');
    }
  }
}
