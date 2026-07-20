// Mirrors the exact field names returned by GET /api/employees. Status is free-text
// on the backend (varchar, default 'active') rather than a fixed enum, and there is
// no gps/attendance/lastSeen/avatar data — those come from the attendance table, not
// the employee record, and are not merged into this endpoint.
export interface Employee {
  id: number;
  emp_id: string;
  cpr: string | null;
  name: string;
  designation: string | null;
  cost_center: string | null;
  phone: string | null;
  status: string | null;
  nationality: string | null;
  joining_date: string | null;
  company: string | null;
  department: string | null;
  office_shift: string | null;
  ot_eligible: string | null;
  cr_name: string | null;
  cr_number: string | null;
  reporting_manager: string | null;
  zk_is_active: boolean | null;
  zk_hire_date: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entity_id: number;
  employee_name: string;
  created_at: string;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  otEligible: number;
  departmentCounts: { department: string; count: number }[];
  statusCounts: { status: string; count: number }[];
}

// Mirrors GET /api/exceptions. 'employee_name' comes from a LEFT JOIN on employees,
// so it can be null if emp_id doesn't match any employee record. 'status' is
// free-text on the backend ('open' | 'resolved' in practice, default 'open').
export interface Exception {
  id: number;
  type: string;
  emp_id: string;
  employee_name: string | null;
  ref_table: string | null;
  ref_id: number | null;
  details: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// Mirrors GET /api/tasks. 'employee_name' and 'project_name' come from LEFT JOINs on
// employees/projects, so either can be null if the id doesn't match a record. 'status'
// and 'source' are free-text on the backend ('pending' and 'admin_portal' are the
// current defaults).
export interface Task {
  id: number;
  emp_id: string;
  employee_name: string | null;
  task_date: string;
  project_code: number;
  project_name: string | null;
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

// Mirrors GET /api/projects (only status='OPEN' projects are returned). project_name is
// nullable on the backend — a handful of real OPEN projects have no name set.
export interface Project {
  project_code: number;
  project_name: string | null;
  project_company_name: string | null;
}

export interface TaskReport {
  completed: number;
  cannot_complete: number;
}

export type AttendanceView = 'daily' | 'monthly' | 'employee-wise' | 'site-wise';
export type ExportFormat = 'excel' | 'csv' | 'pdf';

// Mirrors the exact field names returned by GET /api/attendance/{daily,monthly,employee/:id,site/:siteId}.
// 'OT ELIGIBLE' is the literal string 'YES' | 'NO'. 'APPROVAL REQUIRED' is the matched
// approver's name, or '' when no approval tier applies. There is no 'site' field yet —
// the backend has no site/geofence name lookup, only a numeric geofence id used as a filter.
export interface AttendanceRecord {
  '#': number;
  'EMP ID': string;
  CPR: string;
  'EMPLOYEE NAME': string;
  DESIGNATION: string;
  'COST CENTER': string;
  'ATTENDANCE DATE': string;
  'START DATE': string;
  'START TIME': string;
  'END TIME': string;
  'END DATE': string;
  'T. WORKING H.': string;
  JOB: string;
  'PROJECT NAME': string;
  REMARKS: string;
  'OT ELIGIBLE': string;
  OT: string;
  'APPROVAL REQUIRED': string;
}
