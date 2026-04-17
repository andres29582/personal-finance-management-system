import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthService } from './auth.service';
import { AuthSession } from './entities/auth-session.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CategoriasModule } from '../categorias/categorias.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    CategoriasModule,
    TypeOrmModule.forFeature([AuthSession]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn =
          configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';

        return {
          secret:
            configService.get<string>('JWT_ACCESS_SECRET') ??
            configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn as never,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionsService, JwtStrategy],
})
export class AuthModule {}
