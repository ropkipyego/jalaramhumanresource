import { apiRequest } from '@/lib/api-client';
import { DEFAULT_TEMP_PASSWORD } from '@/lib/tempPassword';

/** Production-safe staff password reset via NestJS (hr.app_credentials). */
export async function adminResetStaffPassword(userId: string, password = DEFAULT_TEMP_PASSWORD) {
  return apiRequest<{ success: boolean; email: string }>('/staff/reset-password', {
    method: 'POST',
    body: JSON.stringify({ userId, password }),
  });
}
