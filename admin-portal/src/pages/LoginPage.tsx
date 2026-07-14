import { useState } from 'react';
import { Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_BRAND } from '../navigation';

export default function LoginPage() {
  const { login } = useAuth();
  const [token, setToken] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const BrandIcon = APP_BRAND.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setTimeout(() => {
      const ok = login(token);
      if (!ok) setError(true);
      setLoading(false);
    }, 400);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">
            <BrandIcon size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">{APP_BRAND.name}</h1>
          <p className="mt-1 text-sm text-slate-400">{APP_BRAND.tagline} — Internal Access</p>
        </div>

        <div className="rounded-2xl bg-slate-800/60 p-8 shadow-2xl ring-1 ring-slate-700/50 backdrop-blur-sm">
          <div className="mb-6 flex items-center gap-2 text-slate-300">
            <Lock size={18} className="text-emerald-400" />
            <span className="text-sm font-medium">Admin Token Required</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Access Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setError(false);
                }}
                placeholder="Enter admin token"
                autoFocus
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle size={16} />
                Invalid token. Please try again.
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Sign In'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-6 rounded-lg bg-slate-900/40 px-4 py-3 text-center">
            <p className="text-xs text-slate-500">
              Demo token: <code className="font-mono text-emerald-400">wf-admin-2026</code>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Authorized personnel only. All access is logged.
        </p>
      </div>
    </div>
  );
}
