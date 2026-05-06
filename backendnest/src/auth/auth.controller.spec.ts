import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<
      AuthService,
      'logout' | 'refreshSession' | 'register' | 'resetPassword' | 'signIn'
    >
  >;

  beforeEach(() => {
    authService = {
      logout: jest.fn(),
      refreshSession: jest.fn(),
      register: jest.fn(),
      resetPassword: jest.fn(),
      signIn: jest.fn(),
    };

    controller = new AuthController(authService as unknown as AuthService);
  });

  it('delegates register to the service', async () => {
    authService.register.mockResolvedValue({
      usuario: {
        cep: '01001000',
        cidade: 'Sao Paulo',
        cpf: '52998224725',
        email: 'ana@example.com',
        endereco: 'Rua das Flores',
        id: 'user-1',
        nome: 'Ana',
        numero: '123',
        moedaPadrao: 'BRL',
      },
    });

    const result = await controller.register({
      aceitoPoliticaPrivacidade: true,
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });

    expect(authService.register).toHaveBeenCalledWith({
      aceitoPoliticaPrivacidade: true,
      cep: '01001-000',
      cidade: 'Sao Paulo',
      cpf: '529.982.247-25',
      email: 'ana@example.com',
      endereco: 'Rua das Flores',
      nome: 'Ana',
      numero: '123',
      senha: 'segredo123',
    });
    expect(result.usuario.email).toBe('ana@example.com');
  });

  it('delegates signIn to the service', async () => {
    authService.signIn.mockResolvedValue({
      access_token: 'token-1',
      refresh_token: 'refresh-token-1',
      usuario: {
        cep: '01001000',
        cidade: 'Sao Paulo',
        cpf: '52998224725',
        email: 'ana@example.com',
        endereco: 'Rua das Flores',
        id: 'user-1',
        nome: 'Ana',
        numero: '123',
        moedaPadrao: 'BRL',
      },
    });

    const result = await controller.signIn({
      email: 'ana@example.com',
      senha: 'segredo123',
    });

    expect(authService.signIn).toHaveBeenCalledWith(
      'ana@example.com',
      'segredo123',
    );
    expect(result.access_token).toBe('token-1');
  });

  it('delegates refresh to the service', async () => {
    authService.refreshSession.mockResolvedValue({
      access_token: 'token-2',
      refresh_token: 'refresh-token-2',
    });

    const result = await controller.refresh({
      refreshToken: 'refresh-token-1',
    });

    expect(authService.refreshSession).toHaveBeenCalledWith('refresh-token-1');
    expect(result.refresh_token).toBe('refresh-token-2');
  });

  it('uses the authenticated user and session on logout', async () => {
    authService.logout.mockResolvedValue({
      message: 'Sessao encerrada com sucesso',
    });

    const result = await controller.logout({
      user: {
        id: 'user-1',
        email: 'test@test.com',
        nome: 'Test',
        sid: 'session-1',
      },
    } as never);

    expect(authService.logout).toHaveBeenCalledWith('user-1', 'session-1');
    expect(result.message).toContain('Sessao encerrada');
  });

  it('uses the user id from the authenticated request on resetPassword', async () => {
    authService.resetPassword.mockResolvedValue({
      message: 'Senha atualizada com sucesso',
    });

    const result = await controller.resetPassword(
      { novaSenha: 'novaSenha123' },
      {
        user: {
          id: 'user-1',
          email: 'test@test.com',
          nome: 'Test',
          sid: 'session-1',
        },
      } as never,
    );

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'user-1',
      'novaSenha123',
    );
    expect(result.message).toContain('Senha atualizada');
  });
});
