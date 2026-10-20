import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'dark' | 'light';
  onToggle: () => void;
  compact?: boolean;
}

export function ThemeToggle({ theme, onToggle, compact = false }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
        title={`Current: ${isDark ? 'Dark Mode' : 'Light Mode'} (Click to switch)`}
        className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
            <span className="text-[11px] font-mono font-semibold hidden md:inline text-amber-300">Light</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-mono font-semibold hidden md:inline text-indigo-600">Dark</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all active:scale-95 ${
        isDark
          ? 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-800'
          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-sm'
      }`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg ${isDark ? 'bg-amber-400/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-600'}`}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </div>
        <span className="font-medium text-xs">
          {isDark ? 'Theme: Dark Mode' : 'Theme: Light Mode'}
        </span>
      </div>

      <div className={`w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${
        isDark ? 'bg-slate-800 justify-start' : 'bg-indigo-600 justify-end'
      }`}>
        <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
      </div>
    </button>
  );
}
