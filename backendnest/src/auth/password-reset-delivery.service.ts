import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PasswordResetConfig,
  resolvePasswordResetConfig,
} from './config/password-reset.config';

@Injectable()
export class PasswordResetDeliveryService {
  private readonly config: PasswordResetConfig;
  private readonly logger = new Logger(PasswordResetDeliveryService.name);

  constructor(configService: ConfigService) {
    this.config = resolvePasswordResetConfig(configService);
  }

  async deliver(input: {
    email: string;
    resetToken: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.config.deliveryUrl) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(this.config.deliveryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.deliveryApiKey
            ? { Authorization: `Bearer ${this.config.deliveryApiKey}` }
            : {}),
        },
        body: JSON.stringify({
          email: input.email,
          expiresAt: input.expiresAt.toISOString(),
          resetToken: input.resetToken,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Password reset delivery endpoint returned an error.');
      }
    } catch {
      this.logger.error(
        'Falha ao entregar instrucoes de recuperacao de senha.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
