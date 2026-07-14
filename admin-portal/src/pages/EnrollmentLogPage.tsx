import { useEffect, useMemo, useState } from 'react';
import { UserPlus, Smartphone, Fingerprint, Clock, RefreshCw, Search } from 'lucide-react';
import type { AuditLogEntry } from '../types';
import { getAuditLogs } from '../data/api';

export default function EnrollmentLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAuditLogs().then((data) => {
      setLogs(data.filter((l) => l.event_type === 'face_self_enrolled'));
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.actor_name.toLowerCase().includes(q) ||
        l.actor_id.toLowerCase().includes(q) ||
        l.metadata.device?.toLowerCase().includes(q),
    );
  }, [logs, search]);

  const reload = () => {
    setLoading(true);
    getAuditLogs().then((data) => {
      setLogs(data.filter((l) => l.event_type === 'face_self_enrolled'));
      setLoading(false);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Face Enrollment Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            {filtered.length} self-enrollment {filtered.length === 1 ? 'event' : 'events'} recorded
          </p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name, ID, or device..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-slate-400">
          <UserPlus size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">No enrollment events found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <Fingerprint size={24} />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800">{log.actor_name}</span>
                  <span className="text-xs text-slate-400">({log.actor_id})</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <UserPlus size={11} /> Self-Enrolled
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Smartphone size={13} className="text-slate-400" />
                    {log.metadata.device ?? 'Unknown device'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-400">v{log.metadata.app_version ?? '—'}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Fingerprint size={13} className="text-slate-400" />
                    {log.metadata.template_count ?? '0'} face templates
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 sm:flex-col sm:items-end sm:gap-0.5">
                <Clock size={13} />
                <span>{formatDateTime(log.created_at)}</span>
                <span className="text-[10px] text-slate-300">{log.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
