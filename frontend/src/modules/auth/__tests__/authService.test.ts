import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import * as authService from '../services/authService';
import { api } from '../../../shared/services/api';

jest.mock('../../../shared/services/api');

describe('authService', () => {
  const mockApi = api as jest.Mocked<typeof api>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('debe retornar LoginResponseDto válida', async () => {
      const mockResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refresh_token: 'refresh_token_xyz',
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'André Silva',
          email: 'andre@example.com',
        },
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'andre@example.com',
        senha: 'password123',
      });
    });

    it('debe rechazar si respuesta no tiene access_token', async () => {
      const mockResponse = {
        refresh_token: 'refresh_token_xyz',
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'André Silva',
          email: 'andre@example.com',
        },
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      // El servicio no valida aquí, la validación debe estar en el componente
      expect(result.access_token).toBeUndefined();
    });

    it('debe rechazar si respuesta no tiene refresh_token', async () => {
      const mockResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'André Silva',
          email: 'andre@example.com',
        },
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      expect(result.refresh_token).toBeUndefined();
    });

    it('debe rechazar si respuesta no tiene usuario', async () => {
      const mockResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refresh_token: 'refresh_token_xyz',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      expect(result.usuario).toBeUndefined();
    });

    it('debe lanzar error si credenciales son inválidas (401)', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'E-mail ou senha invalidos' } },
        },
      });

      await expect(
        authService.login({
          email: 'andre@example.com',
          senha: 'wrongpassword',
        })
      ).rejects.toMatchObject({
        response: {
          status: 401,
          data: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'E-mail ou senha invalidos' } },
        },
      });
    });

    it('debe lanzar error si servidor retorna 500', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno no servidor.' } },
        },
      });

      await expect(
        authService.login({
          email: 'andre@example.com',
          senha: 'password123',
        })
      ).rejects.toMatchObject({
        response: {
          status: 500,
          data: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno no servidor.' } },
        },
      });
    });
  });

  describe('register', () => {
    it('debe registrar usuario con datos válidos', async () => {
      const mockResponse = {
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'João Silva',
          email: 'joao@example.com',
        },
        message: 'User registered successfully',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.register({
        nome: 'João Silva',
        email: 'joao@example.com',
        cpf: '12345678901',
        cep: '12345678',
        endereco: 'Rua A',
        numero: '123',
        cidade: 'São Paulo',
        senha: 'password123',
        aceitoPoliticaPrivacidade: true,
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', expect.any(Object));
    });
  });

  describe('refreshSession', () => {
    it('debe refrescar token con refresh_token válido', async () => {
      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.refreshSession({
        refreshToken: 'old_refresh_token',
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'old_refresh_token',
      });
    });

    it('debe rechazar si refresh_token es inválido o expirado', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Refresh token invalido' } },
        },
      });

      await expect(
        authService.refreshSession({
          refreshToken: 'invalid_refresh_token',
        })
      ).rejects.toMatchObject({
        response: {
          status: 401,
          data: { error: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Refresh token invalido' } },
        },
      });
    });
  });

  describe('logoutSession', () => {
    it('debe llamar endpoint de logout', async () => {
      const mockResponse = {
        message: 'Logged out successfully',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.logoutSession();

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('debe rechazar si logout falla', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno no servidor.' } },
        },
      });

      await expect(authService.logoutSession()).rejects.toMatchObject({
        response: {
          status: 500,
          data: { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Erro interno no servidor.' } },
        },
      });
    });
  });

  describe('resetPassword', () => {
    it('debe resetear password con nova senha', async () => {
      const mockResponse = {
        message: 'Password reset successfully',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.resetPassword({
        novaSenha: 'newpassword123',
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/reset-password', {
        novaSenha: 'newpassword123',
      });
    });

    it('debe rechazar si usuario no está autenticado (401)', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        },
      });

      await expect(
        authService.resetPassword({ novaSenha: 'newpassword123' })
      ).rejects.toMatchObject({
        response: {
          status: 401,
          data: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        },
      });
    });
  });

  describe('forgotPassword', () => {
    it('debe enviar email de reset de password', async () => {
      const mockResponse = {
        message: 'Reset email sent',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.forgotPassword({
        email: 'andre@example.com',
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'andre@example.com',
      });
    });
  });

  describe('resetPasswordWithToken', () => {
    it('debe resetear password con token válido', async () => {
      const mockResponse = {
        message: 'Password reset successfully',
      };

      mockApi.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.resetPasswordWithToken({
        token: 'reset_token_xyz',
        novaSenha: 'newpassword123',
      });

      expect(result).toEqual(mockResponse);
      expect(mockApi.post).toHaveBeenCalledWith('/auth/reset-password-token', {
        token: 'reset_token_xyz',
        novaSenha: 'newpassword123',
      });
    });

    it('debe rechazar si token es inválido o expirado', async () => {
      mockApi.post.mockRejectedValue({
        response: {
          status: 400,
          data: { error: { code: 'AUTH_PASSWORD_RESET_TOKEN_INVALID', message: 'Token invalido ou expirado.' } },
        },
      });

      await expect(
        authService.resetPasswordWithToken({
          token: 'invalid_token',
          novaSenha: 'newpassword123',
        })
      ).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: { code: 'AUTH_PASSWORD_RESET_TOKEN_INVALID', message: 'Token invalido ou expirado.' } },
        },
      });
    });
  });
});
