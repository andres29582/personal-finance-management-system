import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BaseRepository } from '../../common/abstract/base.repository';
import { AuthSession } from '../entities/auth-session.entity';

@Injectable()
export class AuthSessionRepository extends BaseRepository<AuthSession> {
  constructor(
    @InjectRepository(AuthSession)
    private readonly authSessionRepository: Repository<AuthSession>,
  ) {
    super(authSessionRepository);
  }

  async createSession(session: Partial<AuthSession>): Promise<AuthSession> {
    const entity = this.authSessionRepository.create(session);
    return this.authSessionRepository.save(entity);
  }

  async findActiveById(sessionId: string): Promise<AuthSession | null> {
    return this.authSessionRepository.findOne({
      where: {
        id: sessionId,
        revokedAt: IsNull(),
      },
    });
  }

  async rotate(sessionId: string, data: Partial<AuthSession>): Promise<void> {
    await this.authSessionRepository.update(sessionId, data);
  }

  async revoke(
    sessionId: string,
    userId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.authSessionRepository.update(
      {
        id: sessionId,
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt,
        updatedAt: revokedAt,
      },
    );
  }

  async revokeAllByUser(userId: string, revokedAt: Date): Promise<void> {
    await this.authSessionRepository.update(
      {
        userId,
        revokedAt: IsNull(),
      },
      {
        revokedAt,
        updatedAt: revokedAt,
      },
    );
  }
}
