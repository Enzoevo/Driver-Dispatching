export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type Driver = {
  id: number;
  name: string;
  device_code: string;
};

export type Job = {
  assignment_id: number;
  booking_id: number;
  run_order: number;
  assignment_status: string;
  driver_start_time?: string;
  scheduled_start_time?: string;
  eta_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  service_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  address_line: string;
  suburb: string;
  state: string;
  postal_code: string;
  latitude?: string;
  longitude?: string;
  proof_captured_at?: string;
};
