import { apiRequest } from './client';
import { ApiResponse, Driver } from '../types/api';

type LoginData = {
  token: string;
  driver: Driver;
};

export function login(deviceCode: string, pin = ''): Promise<ApiResponse<LoginData>> {
  return apiRequest<LoginData>('/driver/login', 'POST', undefined, {
    device_code: deviceCode,
    pin
  });
}

export function logout(token: string): Promise<ApiResponse<{ message: string }>> {
  return apiRequest<{ message: string }>('/driver/logout', 'POST', token, {});
}
