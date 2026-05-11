import { apiRequest } from './client';
import { ApiResponse, Driver, Job } from '../types/api';

type RunsData = {
  driver: Driver;
  jobs: Job[];
};

export function getRuns(token: string, runDate: string): Promise<ApiResponse<RunsData>> {
  const query = runDate ? `?run_date=${encodeURIComponent(runDate)}` : '';
  return apiRequest<RunsData>(`/driver/runs${query}`, 'GET', token);
}

export function updateRun(
  token: string,
  payload: {
    assignment_id: number;
    status: 'on_route' | 'arrived' | 'failed' | 'completed';
    route_started_at?: string;
    route_eta_at?: string;
    proof_signature_data?: string;
    proof_photo_data?: string;
    proof_latitude?: string;
    proof_longitude?: string;
    proof_captured_at?: string;
  }
): Promise<ApiResponse<{ message: string }>> {
  return apiRequest<{ message: string }>('/driver/run/update', 'POST', token, payload);
}
