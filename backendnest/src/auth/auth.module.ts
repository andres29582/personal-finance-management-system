import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthSessionsService } from './auth-sessions.service';
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

@Module({
  imports: [
    UsersModule,
    CategoriasModule,
    TypeOrmModule.forFeature([AuthSession, PasswordResetToken]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const tokenConfig = resolveAuthTokenConfig(configService);

        return {
          secret: tokenConfig.accessSecret,
          signOptions: {
            expiresIn: tokenConfig.accessExpiresIn as never,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionsService,
    JwtStrategy,
    JwtAuthGuard,
    AuthSessionRepository,
    PasswordResetTokenRepository,
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
