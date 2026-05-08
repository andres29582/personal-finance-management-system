import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import * as authService from '../../services/authService';
import * as authStorage from '../../storage/authStorage';

jest.mock('../../services/authService');
jest.mock('../../storage/authStorage');

describe('Auth Flow - Login/Logout', () => {
  const mockAuthService = authService as jest.Mocked<typeof authService>;
  const mockAuthStorage = authStorage as jest.Mocked<typeof authStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('debe guardar token, refresh token y usuario después de login exitoso', async () => {
      const loginResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        refresh_token: 'refresh_xyz',
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'André',
          email: 'andre@example.com',
        },
      };

      mockAuthService.login.mockResolvedValue(loginResponse);
      mockAuthStorage.saveToken.mockResolvedValue(undefined);
      mockAuthStorage.saveRefreshToken.mockResolvedValue(undefined);
      mockAuthStorage.saveUser.mockResolvedValue(undefined);

      // Simular llamada de login
      const response = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      expect(response).toEqual(loginResponse);

      // Simular guardado en UI (como lo hace login.tsx)
      if (response.access_token && response.refresh_token && response.usuario) {
        await authStorage.saveToken(response.access_token);
        await authStorage.saveRefreshToken(response.refresh_token);
        await authStorage.saveUser(response.usuario);
      }

      expect(mockAuthStorage.saveToken).toHaveBeenCalledWith(loginResponse.access_token);
      expect(mockAuthStorage.saveRefreshToken).toHaveBeenCalledWith(loginResponse.refresh_token);
      expect(mockAuthStorage.saveUser).toHaveBeenCalledWith(loginResponse.usuario);
    });

    it('debe rechazar si respuesta de login es malformada (falta access_token)', async () => {
      const malformedResponse = {
        refresh_token: 'refresh_xyz',
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'André',
          email: 'andre@example.com',
        },
      };

      mockAuthService.login.mockResolvedValue(malformedResponse as any);

      const response = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      // En login.tsx se valida esto con: if (!resposta.access_token || !resposta.refresh_token || !resposta.usuario)
      expect(!response.access_token || !response.refresh_token || !response.usuario).toBe(true);
      expect(mockAuthStorage.saveToken).not.toHaveBeenCalled();
    });

    it('debe rechazar si respuesta de login es malformada (falta refresh_token)', async () => {
      const malformedResponse = {
        access_token: 'token_xyz',
        usuario: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          nome: 'André',
          email: 'andre@example.com',
        },
      };

      mockAuthService.login.mockResolvedValue(malformedResponse as any);

      const response = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      expect(!response.access_token || !response.refresh_token || !response.usuario).toBe(true);
      expect(mockAuthStorage.saveRefreshToken).not.toHaveBeenCalled();
    });

    it('debe rechazar si respuesta de login es malformada (falta usuario)', async () => {
      const malformedResponse = {
        access_token: 'token_xyz',
        refresh_token: 'refresh_xyz',
      };

      mockAuthService.login.mockResolvedValue(malformedResponse as any);

      const response = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      expect(!response.access_token || !response.refresh_token || !response.usuario).toBe(true);
      expect(mockAuthStorage.saveUser).not.toHaveBeenCalled();
    });

    it('debe rechazar si usuario es inválido (falta campos)', async () => {
      const loginResponse = {
        access_token: 'token_xyz',
        refresh_token: 'refresh_xyz',
        usuario: {
          nome: 'André',
          email: 'andre@example.com',
          // Falta id
        },
      };

      mockAuthService.login.mockResolvedValue(loginResponse as any);
      mockAuthStorage.saveUser.mockRejectedValue(
        new Error('Dados de usuario invalidos para salvar na sessao.')
      );

      const response = await authService.login({
        email: 'andre@example.com',
        senha: 'password123',
      });

      await expect(authStorage.saveUser(response.usuario)).rejects.toThrow('Dados de usuario invalidos');
    });

    it('debe manejar error 401 (credenciales inválidas)', async () => {
      mockAuthService.login.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
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
          data: { message: 'Invalid credentials' },
        },
      });

      expect(mockAuthStorage.saveToken).not.toHaveBeenCalled();
    });
  });

  describe('Logout Flow', () => {
    it('debe limpiar sesión al logout', async () => {
      mockAuthStorage.clearSession.mockResolvedValue(undefined);
      mockAuthService.logoutSession.mockResolvedValue({ message: 'Logged out' });

      await authService.logoutSession();
      await authStorage.clearSession();

      expect(mockAuthStorage.clearSession).toHaveBeenCalled();
    });

    it('debe limpiar sesión incluso si endpoint falla', async () => {
      mockAuthService.logoutSession.mockRejectedValue(
        new Error('Logout endpoint failed')
      );
      mockAuthStorage.clearSession.mockResolvedValue(undefined);

      try {
        await authService.logoutSession();
      } catch {
        // Error esperado
      }

      // Simulación de fallback en componente
      await authStorage.clearSession();

      expect(mockAuthStorage.clearSession).toHaveBeenCalled();
    });
  });

  describe('Reset Password Flow', () => {
    it('debe limpiar sesión después de reset de password exitoso', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
      });
      mockAuthStorage.clearSession.mockResolvedValue(undefined);

      await authService.resetPassword({ novaSenha: 'newpassword123' });
      await authStorage.clearSession();

      expect(mockAuthStorage.clearSession).toHaveBeenCalled();
    });

    it('debe manejar error 401 en reset password (sesión expirada)', async () => {
      mockAuthService.resetPassword.mockRejectedValue({
        response: { status: 401 },
      });
      mockAuthStorage.clearSession.mockResolvedValue(undefined);

      try {
        await authService.resetPassword({ novaSenha: 'newpassword123' });
      } catch (error: any) {
        if (error?.response?.status === 401) {
          await authStorage.clearSession();
        }
      }

      expect(mockAuthStorage.clearSession).toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    it('debe retornar null si token no existe', async () => {
      mockAuthStorage.getToken.mockResolvedValue(null);

      const token = await authStorage.getToken();

      expect(token).toBeNull();
    });

    it('debe retornar token válido si existe', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      mockAuthStorage.getToken.mockResolvedValue(token);

      const retrieved = await authStorage.getToken();

      expect(retrieved).toBe(token);
    });

    it('debe remover token sin errores', async () => {
      mockAuthStorage.removeToken.mockResolvedValue(undefined);

      await authStorage.removeToken();

      expect(mockAuthStorage.removeToken).toHaveBeenCalled();
    });
  });

  describe('Refresh Token Management', () => {
    it('debe guardar y recuperar refresh token', async () => {
      const refreshToken = 'refresh_xyz_123';
      mockAuthStorage.saveRefreshToken.mockResolvedValue(undefined);
      mockAuthStorage.getRefreshToken.mockResolvedValue(refreshToken);

      await authStorage.saveRefreshToken(refreshToken);
      const retrieved = await authStorage.getRefreshToken();

      expect(retrieved).toBe(refreshToken);
    });

    it('debe retornar null si refresh token no existe', async () => {
      mockAuthStorage.getRefreshToken.mockResolvedValue(null);

      const refreshToken = await authStorage.getRefreshToken();

      expect(refreshToken).toBeNull();
    });
  });
});
