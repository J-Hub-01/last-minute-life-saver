import React, { useState } from 'react';
import { Storage } from '../utils/storage';
import { UserProfile, AppSettings } from '../types';
import { googleSignIn, logout } from '../utils/auth';
import { motion } from 'motion/react';
import { X, User, Sun, Moon, Database, Bell, RotateCcw, Calendar, Info, LogOut, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSignOut }) => {
  const [user, setUser] = useState<UserProfile>(Storage.getUser() || { name: 'Alex Rivera', dob: '2002-06-28', onboarded: true, calendarConnected: true });
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings());
  const [saveMessage, setSaveMessage] = useState('');

  const showSavedToast = () => {
    setSaveMessage('Saved!');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  if (!isOpen) return null;

  const calculateAge = (dateStr: string): number => {
    if (!dateStr) return 0;
    const today = new Date();
    const birthDate = new Date(dateStr);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return Math.max(0, age);
  };

  const handleUserChange = (field: keyof UserProfile, val: any) => {
    const updated = { ...user, [field]: val };
    if (field === 'dob') {
      updated.age = calculateAge(val);
    }
    setUser(updated);
    Storage.setUser(updated);
    showSavedToast();
  };

  const handleSettingToggle = (path: keyof AppSettings['notifications']) => {
    const currentNotifs = settings.notifications || {};
    const updatedNotifs = { ...currentNotifs, [path]: !currentNotifs[path] };
    const updatedSettings = { ...settings, notifications: updatedNotifs as AppSettings['notifications'] };
    setSettings(updatedSettings);
    Storage.setSettings(updatedSettings);
    showSavedToast();
  };

  const handleStorageDays = (days: number) => {
    const updated = { ...settings, storageDurationDays: days };
    setSettings(updated);
    Storage.setSettings(updated);
    Storage.cleanOldItems();
    showSavedToast();
  };

  const handleTheme = (t: 'dark' | 'light') => {
    const updated = { ...settings, theme: t };
    setSettings(updated);
    Storage.setSettings(updated);
    showSavedToast();
  };

  const handleReEnableNudge = () => {
    const updated = { ...settings, askMaxTimeConfirmation: true };
    setSettings(updated);
    Storage.setSettings(updated);
    setSaveMessage('Timing nudge re-enabled!');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleCalendarToggle = async () => {
    if (user.calendarConnected) {
      await logout();
      handleUserChange('calendarConnected', false);
    } else {
      try {
        const result = await googleSignIn();
        if (result && result.accessToken) {
          handleUserChange('calendarConnected', true);
        }
      } catch (err) {
        console.error('Calendar connection failed:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-2xl w-full glass-panel rounded-3xl p-6 sm:p-8 border-slate-800 shadow-2xl max-h-[90vh] flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-extrabold font-display text-slate-50">Profile & Settings</h3>
            {saveMessage && (
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5 animate-fade-in">
                <Check className="w-3 h-3" /> {saveMessage}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-2 py-6 flex flex-col gap-8 divide-y divide-slate-800/80">
          {/* Section 1: Profile */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
              <User className="w-4 h-4" /> Profile & Birthday Engine
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">FULL NAME</label>
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => handleUserChange('name', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-sans text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">DATE OF BIRTH</label>
                <input
                  type="date"
                  value={user.dob}
                  onChange={(e) => handleUserChange('dob', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-mono text-sm"
                />
                <span className="text-[11px] text-cyan-400 mt-1 block font-mono">
                  Age auto-calculated: <strong className="text-slate-50">{user.age || calculateAge(user.dob)} years old</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Appearance */}
          <div className="pt-6 flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
              <Sun className="w-4 h-4" /> Appearance (Dark / Light)
            </h4>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <button
                type="button"
                onClick={() => handleTheme('dark')}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  settings.theme === 'dark'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-50'
                }`}
              >
                <Moon className="w-6 h-6 text-indigo-400" />
                <span className="text-xs font-bold font-display">Deep Space Navy (Dark)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTheme('light')}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  settings.theme === 'light'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-50'
                }`}
              >
                <Sun className="w-6 h-6 text-amber-500" />
                <span className="text-xs font-bold font-display">Crisp Slate (Light)</span>
              </button>
            </div>
          </div>

          {/* Section 3: Task Storage */}
          <div className="pt-6 flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
              <Database className="w-4 h-4" /> Task Storage Cleanup
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Keep completed and missed tasks in your history for:
            </p>
            <div className="flex gap-3">
              {[7, 15, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleStorageDays(days)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all border ${
                    settings.storageDurationDays === days
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-50'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Notifications */}
          <div className="pt-6 flex flex-col gap-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
              <Bell className="w-4 h-4" /> Push Notifications Engine
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              {[
                { id: 'deadlineAlerts', label: 'Deadline alerts (1 hour prior)' },
                { id: 'missedAlerts', label: 'Missed task alerts' },
                { id: 'eventReminders', label: 'Event reminders (25 hr & 1 hr)' },
                { id: 'wishlistNudge', label: 'Wishlist weekly motivational nudge' },
                { id: 'aiActions', label: 'Jarvis ✨ action notifications' },
                { id: 'birthdayWish', label: 'Birthday celebration modal' },
              ].map((notif) => (
                <label key={notif.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <span>{notif.label}</span>
                  <input
                    type="checkbox"
                    checked={settings?.notifications?.[notif.id as keyof typeof settings.notifications] ?? true}
                    onChange={() => handleSettingToggle(notif.id as any)}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Section 5: Timing Nudge */}
          <div className="pt-6 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Timing Nudge Confirmation
              </h4>
              <p className="text-xs text-slate-400 mt-1">Re-enable max time confirmation dialog for tasks.</p>
            </div>
            <button
              type="button"
              onClick={handleReEnableNudge}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-50 text-xs font-medium transition-colors shrink-0"
            >
              Re-enable Nudge
            </button>
          </div>

          {/* Section 6: Google Calendar Sync */}
          <div className="pt-6 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Google Calendar Integration
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Status: {user.calendarConnected ? '🟢 Connected & Synchronized' : '⚪ Disconnected'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCalendarToggle}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 ${
                user.calendarConnected
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {user.calendarConnected ? 'Disconnect Calendar' : 'Connect Calendar'}
            </button>
          </div>

          {/* Section 7: About */}
          <div className="pt-6 flex flex-col gap-3 text-xs text-slate-400 font-mono">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
              <Info className="w-4 h-4" /> About Priora
            </h4>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-1.5 leading-relaxed">
              <p><strong className="text-slate-50">App Version:</strong> 2026.1.0-RC</p>
              <p><strong className="text-slate-50">Agentic Engine:</strong> Gemini 2.0 Flash API (Google AI Studio)</p>
              <p><strong className="text-slate-50">Core Innovation:</strong> Autonomous 80-90% Time Buffer Optimization</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center shrink-0">
          <button
            onClick={onSignOut}
            className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Reset & Sign Out
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all"
          >
            Close Settings
          </button>
        </div>
      </motion.div>
    </div>
  );
};
