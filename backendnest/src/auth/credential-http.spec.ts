import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from '../logs/global-exception.filter';
import { BusinessRuleException } from '../common/exceptions';

describe('credential HTTP boundary without database', () => {
  let app: INestApplication;
  const service = {
    resetPassword: jest.fn(),
    resetPasswordWithToken: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): { user: unknown } };
        }) => {
          context.switchToHttp().getRequest().user = {
            id: 'user-1',
            sid: 'session-1',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        logAccessDenied: jest.fn().mockResolvedValue(undefined),
        logInternalError: jest.fn().mockResolvedValue(undefined),
      } as never),
    );
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    service.resetPassword.mockResolvedValue({ message: 'Senha atualizada' });
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([
    { novaSenha: 'NewPassword123' },
    { novaSenha: 'NewPassword123', senhaAtual: null },
    { novaSenha: 'NewPassword123', senhaAtual: 1 },
    { novaSenha: 'NewPassword123', senhaAtual: 'old', extra: true },
  ])('rejects malformed or extra fields %p', async (payload) => {
    const response = await request(app.getHttpServer() as App)
      .post('/auth/reset-password')
      .send(payload)
      .expect(400);
    expect((response.body as { success: boolean }).success).toBe(false);
    expect(service.resetPassword).not.toHaveBeenCalled();
  });
  it('preserves 201 and forwards current proof and sid without new tokens', async () => {
    const response = await request(app.getHttpServer() as App)
      .post('/auth/reset-password')
      .send({ novaSenha: 'NewPassword123', senhaAtual: ' old ' })
      .expect(201);
    expect(service.resetPassword).toHaveBeenCalledWith(
      'user-1',
      'NewPassword123',
      ' old ',
      'session-1',
    );
    expect(response.body).toMatchObject({
      success: true,
      data: { message: 'Senha atualizada' },
    });
    expect((response.body as { data: unknown }).data).not.toHaveProperty(
      'access_token',
    );
  });
  it('returns the current-password error as 400, not a refresh-triggering 401', async () => {
    service.resetPassword.mockRejectedValueOnce(
      new BusinessRuleException(
        'AUTH_CURRENT_PASSWORD_INVALID',
        'Senha atual incorreta.',
        { field: 'senhaAtual' },
      ),
    );
    const response = await request(app.getHttpServer() as App)
      .post('/auth/reset-password')
      .send({ novaSenha: 'NewPassword123', senhaAtual: 'wrong' })
      .expect(400);
    expect((response.body as { error: unknown }).error).toMatchObject({
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
      field: 'senhaAtual',
    });
  });
});
