import {
  Body,
  Get,
  Header,
  Controller,
  HttpCode,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordTokenDto } from './dto/reset-password-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  RevokeSessionDto,
  SessionListQueryDto,
} from './dto/session-management.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  listSessions(
    @Request() req: AuthenticatedRequest,
    @Query() query: SessionListQueryDto,
  ) {
    return this.authService.listOwnSessions(req.user.id, req.user.sid, query);
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async revokeAllSessions(
    @Request() req: AuthenticatedRequest,
    @Body() dto: RevokeSessionDto,
  ) {
    await this.authService.revokeOwnSessions(
      req.user.id,
      req.user.sid,
      dto.senhaAtual,
    );
  }

  @Post('sessions/:id/revoke')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async revokeSession(
    @Request() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RevokeSessionDto,
  ) {
    await this.authService.revokeOwnSessions(
      req.user.id,
      req.user.sid,
      dto.senhaAtual,
      id,
    );
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  currentSession(
    @Request() req: AuthenticatedRequest & { user: { sessionState: unknown } },
  ) {
    return req.user.sessionState;
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async signIn(@Body() loginDto: LoginDto) {
    return this.authService.signIn(loginDto.email, loginDto.senha);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password-token')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPasswordWithToken(@Body() dto: ResetPasswordTokenDto) {
    return this.authService.resetPasswordWithToken(dto.token, dto.novaSenha);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshSession(refreshTokenDto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(@Request() req: AuthenticatedRequest) {
    return this.authService.logout(req.user.id, req.user.sid);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.authService.resetPassword(
      req.user.id,
      resetPasswordDto.novaSenha,
      resetPasswordDto.senhaAtual,
      req.user.sid,
    );
  }
}
