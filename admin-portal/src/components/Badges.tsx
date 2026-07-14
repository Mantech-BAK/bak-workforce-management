import type { Employee } from '../types';

export function GpsBadge({ state }: { state: Employee['gps'] }) {
  const styles = {
    inside: 'bg-blue-50 text-blue-700',
    outside: 'bg-amber-50 text-amber-700',
    disabled: 'bg-rose-50 text-rose-700',
  };
  const labels = { inside: 'Inside', outside: 'Outside', disabled: 'Disabled' };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[state]}`}>{labels[state]}</span>;
}

export function AttendanceBadge({ state }: { state: Employee['attendance'] }) {
  const styles = {
    clocked_in: 'bg-emerald-50 text-emerald-700',
    clocked_out: 'bg-slate-100 text-slate-600',
    missing_punch_out: 'bg-orange-50 text-orange-700',
  };
  const labels = { clocked_in: 'Clocked In', clocked_out: 'Clocked Out', missing_punch_out: 'Missing Punch-Out' };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[state]}`}>{labels[state]}</span>;
}

export function StatusBadge({ status }: { status: Employee['status'] }) {
  const styles = {
    active: 'bg-emerald-50 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-600',
    suspended: 'bg-rose-50 text-rose-700',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{status}</span>;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
