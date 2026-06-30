import React, { useEffect, useState } from 'react';
import { Storage } from '../utils/storage';
import { UserProfile, AppSettings } from '../types';
import { Sparkles, Moon, Sun, Settings as SettingsIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings());
  const [completionPercentage, setCompletionPercentage] = useState<number>(0);

  const calculateProgress = () => {
    const allActive = Storage.getAllActiveTasks();
    const completed = Storage.getCompleted();

    const todayStr = new Date().toISOString().split('T')[0];
    const completedToday = completed.filter(c => c.completedAt && c.completedAt.startsWith(todayStr)).length;
    const totalToday = allActive.length + completedToday;

    if (totalToday === 0) {
      setCompletionPercentage(100);
    } else {
      setCompletionPercentage(Math.round((completedToday / totalToday) * 100));
    }
  };

  useEffect(() => {
    setUser(Storage.getUser());
    calculateProgress();

    const handleUpdate = () => {
      setUser(Storage.getUser());
      setSettings(Storage.getSettings());
      calculateProgress();
    };

    window.addEventListener('lmls_storage_updated', handleUpdate);
    const interval = setInterval(calculateProgress, 30000);

    return () => {
      window.removeEventListener('lmls_storage_updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: nextTheme };
    setSettings(updated);
    Storage.setSettings(updated);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const getInitials = (name: string) => {
    if (!name) return 'JR';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="relative w-full border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30 transition-colors">
      {/* Thin glowing progress bar at very top */}
      <div className="w-full h-1 bg-slate-800/50 relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${completionPercentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 shadow-[0_0_12px_rgba(99,102,241,0.8)]"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        {/* Top Left: Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)] shrink-0">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-xl font-extrabold font-display tracking-tight text-slate-50 flex items-center gap-2">
              <span>Priora</span>
              <span className="hidden md:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">AI CORE</span>
            </h1>
            <span className="text-xs text-slate-400 font-medium tracking-wide mt-0.5">
              Never Miss What Matters.
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">{todayDisplay}</span>
          </div>
        </div>

        {/* Center/Right: Completion Badge on Desktop */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">Today's Momentum:</span>
          <strong className="text-cyan-400 font-bold">{completionPercentage}% Completed</strong>
        </div>

        {/* Top Right: Theme Toggle + Settings + User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-50 transition-all shadow-sm"
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          <div
            onClick={onOpenSettings}
            title={user?.name || 'Alex Rivera'}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center cursor-pointer shadow-md hover:ring-2 hover:ring-indigo-400 transition-all shrink-0"
          >
            <span id="profile-initials" className="text-white font-mono font-bold text-sm select-none">
              {getInitials(user?.name || 'Jarvis Rivera')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
