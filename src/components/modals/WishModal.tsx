import React, { useState } from 'react';
import { TaskItem } from '../../types';
import { motion } from 'motion/react';
import { X, Heart, Sparkles } from 'lucide-react';

interface WishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskItem) => void;
  initialTask?: TaskItem | null;
}

export const WishModal: React.FC<WishModalProps> = ({ isOpen, onClose, onSave, initialTask }) => {
  const isEditing = !!initialTask;
  const [title, setTitle] = useState(initialTask?.title || '');
  const [softDeadline, setSoftDeadline] = useState(
    initialTask?.softDeadline ? initialTask.softDeadline.split('T')[0] : ''
  );
  const [notes, setNotes] = useState(initialTask?.notes || '');

  if (!isOpen) return null;

  const handlePreset = (preset: 'week' | 'month' | 'year') => {
    const now = new Date();
    if (preset === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? 0 : 7); // Sunday
      const sunday = new Date(now.setDate(diff));
      setSoftDeadline(sunday.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setSoftDeadline(lastDay.toISOString().split('T')[0]);
    } else if (preset === 'year') {
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      setSoftDeadline(yearEnd.toISOString().split('T')[0]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let iso = '';
    if (softDeadline) {
      iso = new Date(`${softDeadline}T23:59:59`).toISOString();
    }

    const newTask: TaskItem = {
      id: initialTask?.id || `wish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tab: 'wishlist',
      title: title.trim(),
      hasDeadline: !!softDeadline,
      softDeadline: iso || undefined,
      notes: notes.trim(),
      completed: initialTask?.completed || false,
      missed: initialTask?.missed || false,
      createdAt: initialTask?.createdAt || new Date().toISOString()
    };

    onSave(newTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-lg w-full glass-panel rounded-3xl p-6 sm:p-8 border-pink-500/30 bg-gradient-to-b from-slate-900 to-indigo-950/90 shadow-[0_0_50px_rgba(236,72,153,0.15)] my-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-xl font-bold font-display text-slate-50 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400 fill-pink-400/20" />
            <span>{isEditing ? 'Edit Wishlist Dream' : 'Add Wishlist Dream'}</span>
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5 mt-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-pink-300 mb-2">Aspiration / Bucket List Item *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Visit Manali or Learn fingerstyle guitar"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-pink-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Optional Soft Deadline</label>
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={() => handlePreset('week')} className="px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 text-xs font-mono">
                ⚡ End of this week
              </button>
              <button type="button" onClick={() => handlePreset('month')} className="px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 text-xs font-mono">
                ⚡ End of this month
              </button>
              <button type="button" onClick={() => handlePreset('year')} className="px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-300 hover:bg-pink-500/20 text-xs font-mono">
                ⚡ End of this year
              </button>
            </div>
            <input
              type="date"
              value={softDeadline}
              onChange={(e) => setSoftDeadline(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-mono text-sm"
            />
            <span className="text-[10px] text-slate-400 mt-1.5 block font-mono">
              💡 Fires a motivational nudge quote every 7 days to keep your dreams alive.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Why is this important to you?</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the feeling or experience..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 text-sm font-sans"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-50 text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(236,72,153,0.4)] transition-all flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Save Wish
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
