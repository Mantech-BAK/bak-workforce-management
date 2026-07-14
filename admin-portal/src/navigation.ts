import { LayoutDashboard, Users, Clock, CheckSquare, AlertTriangle, UserPlus, FileBarChart, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type PageId = 'dashboard' | 'employees' | 'attendance' | 'tasks' | 'exceptions' | 'enrollment' | 'reports';

export interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle },
  { id: 'enrollment', label: 'Enrollment Log', icon: UserPlus },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
];

export const PAGE_TITLES: Record<PageId, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  attendance: 'Attendance',
  tasks: 'Tasks',
  exceptions: 'Exceptions',
  enrollment: 'Enrollment Log',
  reports: 'Reports',
};

export const APP_BRAND = { name: 'Workforce Admin', tagline: 'Management Portal', icon: ShieldCheck };
