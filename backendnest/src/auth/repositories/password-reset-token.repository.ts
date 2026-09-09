import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { User } from '../../users/entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';

@Injectable()
export class PasswordResetTokenRepository extends BaseRepository<PasswordResetToken> {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly dataSource: DataSource,
  ) {
    super(passwordResetTokenRepository);
  }

  async createToken(
    token: Partial<PasswordResetToken>,
  ): Promise<PasswordResetToken> {
    const entity = this.passwordResetTokenRepository.create(token);
    return this.passwordResetTokenRepository.save(entity);
  }

  async consumeAndResetPassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<string | null> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(PasswordResetToken)
        .set({ usedAt: now })
        .where('token_hash = :tokenHash', { tokenHash })
        .andWhere('used_at IS NULL')
        .andWhere('expires_at > :now', { now })
        .returning('user_id')
        .execute();
      const raw = result.raw as unknown;
      const firstRow = isRecordArray(raw) ? raw[0] : undefined;
      const userId =
        firstRow && typeof firstRow.user_id === 'string'
          ? firstRow.user_id
          : undefined;

      if (!userId) {
        return null;
      }

      await manager
        .createQueryBuilder()
        .update(User)
        .set({ senhaHash: passwordHash })
        .where('id = :userId', { userId })
        .execute();
      await manager
        .createQueryBuilder()
        .update(AuthSession)
        .set({ revokedAt: now, updatedAt: now })
        .where('usuario_id = :userId', { userId })
        .andWhere('revoked_at IS NULL')
        .execute();

      return userId;
    });
  }
}

function isRecordArray(
  value: unknown,
): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
