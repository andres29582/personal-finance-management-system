import {
  UpdateUserProfileRequestDto,
  UserProfile,
} from '../types/user';
import { api } from './api';

export async function getCurrentUserProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>('/users/me');
  return response.data;
}

export async function updateCurrentUserProfile(
  data: UpdateUserProfileRequestDto,
): Promise<UserProfile> {
  const response = await api.patch<UserProfile>('/users/me', data);
  return response.data;
}
