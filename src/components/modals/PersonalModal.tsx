import React, { useState } from 'react';
import { TaskItem, RecurrenceType } from '../../types';
import { motion } from 'motion/react';
import { X, User, Bell } from 'lucide-react';

interface PersonalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskItem) => void;
  initialTask?: TaskItem | null;
}

export const PersonalModal: React.FC<PersonalModalProps> = ({ isOpen, onClose, onSave, initialTask }) => {
  const isEditing = !!initialTask;
  const [title, setTitle] = useState(initialTask?.title || '');
  const [timeOfDay, setTimeOfDay] = useState(initialTask?.timeOfDay || '08:00');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(initialTask?.recurrence || 'daily');
  const [customDays, setCustomDays] = useState<string[]>(initialTask?.customDays || ['Mon', 'Wed', 'Fri']);
  const [notes, setNotes] = useState(initialTask?.notes || '');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: TaskItem = {
      id: initialTask?.id || `pers_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tab: 'personal',
      title: title.trim(),
      hasDeadline: false,
      timeOfDay,
      recurrence,
      customDays: recurrence === 'custom' ? customDays : undefined,
      notes: notes.trim(),
      completed: initialTask?.completed || false,
      missed: initialTask?.missed || false,
      createdAt: initialTask?.createdAt || new Date().toISOString()
    };

    onSave(newTask);
    onClose();
  };

  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day: string) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-lg w-full glass-panel rounded-3xl p-6 sm:p-8 border-slate-800 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-xl font-bold font-display text-slate-50 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            <span>{isEditing ? 'Edit Personal Reminder' : 'Add Personal Reminder'}</span>
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5 mt-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Habit / Reminder *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diaphragmatic Running or Buy organic groceries"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-cyan-400" />
              <span>Time of Day</span>
            </label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Recurrence</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['one-time', 'daily', 'weekly', 'custom'] as RecurrenceType[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecurrence(r)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium uppercase tracking-wider transition-all border ${
                    recurrence === r
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {recurrence === 'custom' && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800/80">
                {daysList.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`w-9 h-9 rounded-lg text-xs font-mono font-bold flex items-center justify-center border ${
                      customDays.includes(day)
                        ? 'bg-cyan-400 border-cyan-300 text-slate-950 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or details..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 text-sm font-sans"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-50 text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all">
              Save Reminder
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
