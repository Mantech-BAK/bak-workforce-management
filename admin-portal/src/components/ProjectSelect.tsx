import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Project } from '../types';
import { getProjects } from '../data/api';

interface ProjectSelectProps {
  value: Project | null;
  onChange: (project: Project | null) => void;
  placeholder?: string;
  hasError?: boolean;
}

function projectLabel(project: Project): string {
  return project.project_name || `Project ${project.project_code}`;
}

export default function ProjectSelect({ value, onChange, placeholder, hasError }: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState(value ? `${projectLabel(value)} (${value.project_code})` : '');
  const [showList, setShowList] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProjects().then(setProjects);
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
    if (!query.trim()) return projects.slice(0, 20);
    const q = query.toLowerCase();
    return projects
      .filter((p) => projectLabel(p).toLowerCase().includes(q) || String(p.project_code).includes(q))
      .slice(0, 20);
  }, [projects, query]);

  const handleSelect = (project: Project) => {
    onChange(project);
    setQuery(`${projectLabel(project)} (${project.project_code})`);
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
          placeholder={placeholder || 'Search by project code or name...'}
          className={`w-full rounded-lg border bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:bg-white ${
            hasError ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-emerald-400'
          }`}
        />
      </div>
      {showList && matches.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {matches.map((p) => (
            <button
              key={p.project_code}
              type="button"
              onClick={() => handleSelect(p)}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-700">{projectLabel(p)}</span>
              <span className="text-xs text-slate-400">Code {p.project_code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
