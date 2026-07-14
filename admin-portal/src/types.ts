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
