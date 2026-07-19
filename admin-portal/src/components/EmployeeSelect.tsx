import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Employee } from '../types';
import { getEmployees } from '../data/api';

interface EmployeeSelectProps {
  value: Employee | null;
  onChange: (employee: Employee | null) => void;
  placeholder?: string;
}

export default function EmployeeSelect({ value, onChange, placeholder }: EmployeeSelectProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState(value ? `${value.name} (${value.emp_id})` : '');
  const [showList, setShowList] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return employees.slice(0, 20);
    const q = query.toLowerCase();
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.emp_id.toLowerCase().includes(q)).slice(0, 20);
  }, [employees, query]);

  const handleSelect = (emp: Employee) => {
    onChange(emp);
    setQuery(`${emp.name} (${emp.emp_id})`);
    setShowList(false);
  };

  const handleQueryChange = (v: string) => {
    setQuery(v);
    onChange(null);
    setShowList(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setShowList(true)}
          placeholder={placeholder || 'Search by name or employee ID...'}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-emerald-400 focus:bg-white"
        />
      </div>
      {showList && matches.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => handleSelect(emp)}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-700">{emp.name}</span>
              <span className="text-xs text-slate-400">{emp.emp_id} · {emp.department || '—'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
