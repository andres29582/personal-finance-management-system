import { ForgotPasswordRequestDto, ForgotPasswordResponseDto, LoginRequestDto, LoginResponseDto, LogoutResponseDto, RefreshTokenRequestDto, RefreshTokenResponseDto, RegisterRequestDto, RegisterResponseDto, ResetPasswordRequestDto, ResetPasswordResponseDto, ResetPasswordTokenRequestDto, } from '../types/auth';
import { api } from '../../../shared/services/api';
import { logout } from './logoutCoordinator';
import { getSessionSnapshot } from '../../../../storage/authStorage';
import { refreshOwnedSession } from '../../../shared/services/api';
export async function register(data: RegisterRequestDto): Promise<RegisterResponseDto> {
  const response = await api.post<RegisterResponseDto>('/auth/register', data);
  return response.data;
}
export async function login(data: LoginRequestDto): Promise<LoginResponseDto> {
  const response = await api.post<LoginResponseDto>('/auth/login', data);
  return response.data;
}
export async function refreshSession(data: RefreshTokenRequestDto): Promise<RefreshTokenResponseDto> {
  const origin = await getSessionSnapshot();
  if (origin.refreshToken !== data.refreshToken) throw new Error('Session refresh ownership changed.');
  const result = await refreshOwnedSession(origin);
  if (!result) throw new Error('Session refresh unavailable.');
  return result;
}
export async function logoutSession(): Promise<LogoutResponseDto> {
  const result = await logout().completion;
  if (!result.localDurable || !result.cleanupComplete || result.remote !== 'confirmed')
    throw new Error('Logout confirmation unavailable.');
  return { message: 'Logout realizado com sucesso.' };
}
export async function resetPassword(data: ResetPasswordRequestDto): Promise<ResetPasswordResponseDto> {
  const response = await api.post<ResetPasswordResponseDto>('/auth/reset-password', data);
  return response.data;
}
export async function forgotPassword(data: ForgotPasswordRequestDto): Promise<ForgotPasswordResponseDto> {
  const response = await api.post<ForgotPasswordResponseDto>('/auth/forgot-password', data);
  return response.data;
}
export async function resetPasswordWithToken(data: ResetPasswordTokenRequestDto): Promise<ResetPasswordResponseDto> {
  const response = await api.post<ResetPasswordResponseDto>('/auth/reset-password-token', data);
  return response.data;
}
