import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

type CardColor = 'emerald' | 'blue' | 'amber' | 'rose' | 'orange';

const colorMap: Record<CardColor, { bg: string; text: string; ring: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-100' },
};

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: CardColor;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ label, value, icon: Icon, color, trend, trendUp }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${c.bg} ${c.text} ring-1 ${c.ring}`}>
          <Icon size={22} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trendUp !== undefined && (trendUp ? (
            <TrendingUp size={13} className="text-emerald-500" />
          ) : (
            <TrendingDown size={13} className="text-rose-500" />
          ))}
          <span className={trendUp ? 'text-emerald-600' : 'text-slate-500'}>{trend}</span>
        </div>
      )}
    </div>
  );
}
