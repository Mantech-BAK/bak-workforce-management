const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export interface FaceLoginSuccess {
  ok: true;
  token: string;
  enrolled: boolean;
}

export interface FaceLoginFailure {
  ok: false;
  error: string;
}

export async function faceLogin(empId: string, imageBase64: string): Promise<FaceLoginSuccess | FaceLoginFailure> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/face-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emp_id: empId, face_image: imageBase64 }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Verification failed' };
    }
    return { ok: true, token: data.token, enrolled: data.enrolled };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

async function authedGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface EmployeeMe {
  emp_id: string;
  name: string;
  designation: string | null;
  department: string | null;
}

export function getMe(token: string): Promise<EmployeeMe | null> {
  return authedGet<EmployeeMe>('/api/employees/me', token);
}

export interface PunchStatus {
  status: 'not_started' | 'clocked_in' | 'clocked_out';
  punch_in_time: string | null;
  punch_out_time: string | null;
}

export function getPunchStatus(token: string): Promise<PunchStatus | null> {
  return authedGet<PunchStatus>('/api/attendance/me/status', token);
}

export interface TodayTaskCount {
  count: number;
}

export function getTodayTaskCount(token: string): Promise<TodayTaskCount | null> {
  return authedGet<TodayTaskCount>('/api/tasks/me/today', token);
}
