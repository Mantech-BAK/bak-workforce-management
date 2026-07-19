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

export interface DevLoginSuccess {
  ok: true;
  token: string;
}

export interface DevLoginFailure {
  ok: false;
  error: string;
}

export async function devLogin(empId: string): Promise<DevLoginSuccess | DevLoginFailure> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emp_id: empId }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Dev login failed' };
    }
    return { ok: true, token: data.token };
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

export interface Task {
  id: number;
  emp_id: string;
  task_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  priority: string | null;
  remarks: string | null;
  status: string;
  source: string | null;
  teams_message_id: string | null;
  created_at: string;
}

export function getMyTasks(token: string): Promise<Task[] | null> {
  return authedGet<Task[]>('/api/tasks/me', token);
}

export type TaskStatus = 'in_progress' | 'completed' | 'cannot_complete';

export function updateTaskStatus(
  token: string,
  id: number,
  status: TaskStatus
): Promise<ApiSuccess<Task> | ApiFailure> {
  return authedPatch<Task>(`/api/tasks/${id}/status`, token, { status });
}

export function rescheduleTaskTomorrow(token: string, id: number): Promise<ApiSuccess<Task> | ApiFailure> {
  return authedPost<Task>(`/api/tasks/${id}/reschedule-tomorrow`, token, {});
}

export interface Project {
  project_code: number;
  project_name: string;
  project_company_name: string | null;
}

export function getProjects(token: string): Promise<Project[] | null> {
  return authedGet<Project[]>('/api/projects', token);
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
}

async function authedPost<T>(path: string, token: string, body: unknown): Promise<ApiSuccess<T> | ApiFailure> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Request failed' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

async function authedPatch<T>(path: string, token: string, body: unknown): Promise<ApiSuccess<T> | ApiFailure> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Request failed' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export interface PunchInResult {
  status: 'clocked_in';
  punch_in_time: string;
}

export function punchIn(
  token: string,
  params: { lat: number; lng: number }
): Promise<ApiSuccess<PunchInResult> | ApiFailure> {
  return authedPost<PunchInResult>('/api/attendance/punch-in', token, params);
}

export interface PunchOutResult {
  status: 'clocked_out';
  punch_in_time: string;
  punch_out_time: string;
}

export function punchOut(
  token: string,
  params: { lat: number; lng: number }
): Promise<ApiSuccess<PunchOutResult> | ApiFailure> {
  return authedPost<PunchOutResult>('/api/attendance/punch-out', token, params);
}

export function reportLocation(
  token: string,
  params: { lat: number; lng: number }
): Promise<ApiSuccess<{ ok: true }> | ApiFailure> {
  return authedPost<{ ok: true }>('/api/attendance/location', token, params);
}
