import type { LucideIcon } from 'lucide-react';
import { Clock, CheckSquare, AlertTriangle, FileBarChart } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  icon: 'attendance' | 'tasks' | 'exceptions' | 'reports';
}

const iconMap: Record<PlaceholderProps['icon'], LucideIcon> = {
  attendance: Clock,
  tasks: CheckSquare,
  exceptions: AlertTriangle,
  reports: FileBarChart,
};

export default function PlaceholderPage({ title, description, icon }: PlaceholderProps) {
  const Icon = iconMap[icon];
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={32} />
      </div>
      <h2 className="text-xl font-bold text-slate-700">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
        Coming Soon
      </span>
    </div>
  );
}
