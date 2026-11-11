import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthSessionsService } from './auth-sessions.service';
import { PasswordResetDeliveryService } from './password-reset-delivery.service';
import { AuthService } from './auth.service';
import { AuthSession } from './entities/auth-session.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CategoriasModule } from '../categorias/categorias.module';
import { UsersModule } from '../users/users.module';
import { AuthSessionRepository } from './repositories/auth-session.repository';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { resolveAuthTokenConfig } from './config/auth-token.config';
import { PasswordChangedOutbox } from './entities/password-changed-outbox.entity';
import { PasswordChangedOutboxRepository } from './notifications/password-changed-outbox.repository';
import { PasswordChangedWorker } from './notifications/password-changed.worker';

@Module({
  imports: [
    UsersModule,
    CategoriasModule,
    TypeOrmModule.forFeature([
      AuthSession,
      PasswordResetToken,
      PasswordChangedOutbox,
    ]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const tokenConfig = resolveAuthTokenConfig(configService);

        return {
          secret: tokenConfig.accessSecret,
          signOptions: {
            algorithm: tokenConfig.algorithm,
            expiresIn: tokenConfig.accessExpiresIn as never,
            issuer: tokenConfig.issuer,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionsService,
    PasswordResetDeliveryService,
    JwtStrategy,
    JwtAuthGuard,
    AuthSessionRepository,
    PasswordResetTokenRepository,
    PasswordChangedOutboxRepository,
    PasswordChangedWorker,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
