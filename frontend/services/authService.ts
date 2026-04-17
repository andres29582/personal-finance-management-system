import {
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  RefreshTokenRequestDto,
  RefreshTokenResponseDto,
  RegisterRequestDto,
  RegisterResponseDto,
  ResetPasswordRequestDto,
  ResetPasswordResponseDto,
} from '../types/auth';
import { api } from './api';

export async function register(
  data: RegisterRequestDto,
): Promise<RegisterResponseDto> {
  const response = await api.post<RegisterResponseDto>('/auth/register', data);
  return response.data;
}

export async function login(data: LoginRequestDto): Promise<LoginResponseDto> {
  const response = await api.post<LoginResponseDto>('/auth/login', data);
  return response.data;
}

export async function refreshSession(
  data: RefreshTokenRequestDto,
): Promise<RefreshTokenResponseDto> {
  const response = await api.post<RefreshTokenResponseDto>('/auth/refresh', data);
  return response.data;
}

export async function logoutSession(): Promise<LogoutResponseDto> {
  const response = await api.post<LogoutResponseDto>('/auth/logout');
  return response.data;
}

export async function resetPassword(
  data: ResetPasswordRequestDto,
): Promise<ResetPasswordResponseDto> {
  const response = await api.post<ResetPasswordResponseDto>(
    '/auth/reset-password',
    data,
  );

  return response.data;
}
