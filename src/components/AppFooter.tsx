import React from 'react';
import { useApp } from '../context/AppContext';

interface AppFooterProps {
  variant?: 'main' | 'auth' | 'minimal';
  className?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({ variant = 'main', className = '' }) => {
  const { theme } = useApp();
  const isLight = theme === 'light';

  if (variant === 'auth') {
    return (
      <footer
        className={`mt-6 text-center select-none z-10 space-y-1 text-xs font-sans tracking-wide transition-colors ${
          isLight ? 'text-slate-500' : 'text-slate-400'
        } ${className}`}
      >
        <p className="text-[11px] opacity-90">Copyright (c) 2026 AutoPilot AI (V.B)</p>
        <p className={`text-[11px] font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          Developed by{' '}
          <span className="font-semibold text-blue-500 dark:text-blue-400 tracking-normal">
            V.B.
          </span>
        </p>
      </footer>
    );
  }

  if (variant === 'minimal') {
    return (
      <footer
        className={`text-center select-none text-[11px] font-sans tracking-wide flex items-center justify-center gap-2 transition-colors ${
          isLight ? 'text-slate-500' : 'text-slate-400'
        } ${className}`}
      >
        <span>Copyright (c) 2026 AutoPilot AI (V.B)</span>
        <span className={isLight ? 'text-slate-300' : 'text-slate-700'}>•</span>
        <span>
          Developed by{' '}
          <span className="font-semibold text-blue-500 dark:text-blue-400">
            V.B.
          </span>
        </span>
      </footer>
    );
  }

  // Default: 'main' application layout footer bar
  return (
    <footer
      className={`min-h-[32px] px-3 sm:px-6 py-1 sm:py-0 border-t backdrop-blur-md flex flex-wrap items-center justify-between gap-1 text-[10px] sm:text-[11px] select-none z-20 transition-colors ${
        isLight
          ? 'bg-slate-100/90 border-slate-200 text-slate-600'
          : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-normal opacity-90 truncate">
          Copyright (c) 2026 AutoPilot AI (V.B)
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-normal opacity-90">Developed by</span>
        <span
          className={`font-semibold px-1.5 py-0.5 rounded text-[10px] tracking-wide border transition-colors ${
            isLight
              ? 'text-slate-800 bg-white border-slate-300/80 shadow-xs'
              : 'text-slate-200 bg-slate-900 border-slate-700/60'
          }`}
        >
          V.B.
        </span>
      </div>
    </footer>
  );
};

