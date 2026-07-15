import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Filter, RefreshCw } from 'lucide-react';
import type { Exception } from '../types';
import { getExceptions, resolveException } from '../data/api';

function formatTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function TypeBadge({ type }: { type: string }) {
  const t = type.toLowerCase();
  let style = 'bg-slate-100 text-slate-600';
  if (t === 'face_match_failed') {
    style = 'bg-rose-50 text-rose-700';
  } else if (t.includes('geofence') || t.includes('gps')) {
    style = 'bg-orange-50 text-orange-700';
  }
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {formatTypeLabel(type)}
    </span>
  );
}

function ExceptionStatusBadge({ status }: { status: string }) {
  const isResolved = status === 'resolved';
  const style = isResolved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
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

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getExceptions({
      type: typeFilter !== 'all' ? typeFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }).then((data) => {
      setExceptions(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const types = useMemo(() => Array.from(new Set(exceptions.map((e) => e.type))).sort(), [exceptions]);

  const handleResolve = async (id: number) => {
    const resolvedBy = window.prompt("Who's resolving this exception?");
    if (!resolvedBy || !resolvedBy.trim()) return;

    setResolvingId(id);
    setErrorMsg(null);
    const result = await resolveException(id, resolvedBy.trim());
    setResolvingId(null);

    if (result.ok) {
      load();
    } else {
      setErrorMsg(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Exceptions</h2>
          <p className="mt-1 text-sm text-slate-500">{exceptions.length} exceptions matching current filters</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="all">All Types</option>
              {types.map((t) => (
                <option key={t} value={t}>{formatTypeLabel(t)}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
          </div>
        ) : exceptions.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-slate-400">
            <CheckCircle2 size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No exceptions found</p>
            <p className="text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Employee</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {exceptions.map((ex) => (
                  <tr key={ex.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-3.5"><TypeBadge type={ex.type} /></td>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-slate-700">{ex.employee_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{ex.emp_id}</p>
                    </td>
                    <td className="max-w-xs truncate px-6 py-3.5 text-slate-500" title={ex.details ?? ''}>
                      {ex.details || '—'}
                    </td>
                    <td className="px-6 py-3.5">
                      <ExceptionStatusBadge status={ex.status} />
                      {ex.status === 'resolved' && ex.resolved_by && (
                        <p className="mt-1 text-xs text-slate-400">by {ex.resolved_by}</p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">{formatDateTime(ex.created_at)}</td>
                    <td className="px-6 py-3.5">
                      {ex.status === 'open' ? (
                        <button
                          onClick={() => handleResolve(ex.id)}
                          disabled={resolvingId === ex.id}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {resolvingId === ex.id ? 'Resolving...' : 'Resolve'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
