import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { PasswordResetToken } from '../entities/password-reset-token.entity';

@Injectable()
export class PasswordResetTokenRepository extends BaseRepository<PasswordResetToken> {
  constructor(
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {
    super(passwordResetTokenRepository);
  }

  async createToken(
    token: Partial<PasswordResetToken>,
  ): Promise<PasswordResetToken> {
    const entity = this.passwordResetTokenRepository.create(token);
    return this.passwordResetTokenRepository.save(entity);
  }

  async findLatestByHash(
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    return this.passwordResetTokenRepository.findOne({
      where: { tokenHash },
      order: { createdAt: 'DESC' },
    });
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    await this.passwordResetTokenRepository.update({ id }, { usedAt });
  }
}
