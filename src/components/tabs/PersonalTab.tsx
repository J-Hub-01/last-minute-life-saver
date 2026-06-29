import React, { useState } from 'react';
import { TaskItem } from '../../types';
import { Storage } from '../../utils/storage';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, User, CheckCircle2, Bell, RotateCcw, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';

interface PersonalTabProps {
  tasks: TaskItem[];
  onUpdateTasks: (tasks: TaskItem[]) => void;
  onDeleteTask: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (task: TaskItem) => void;
}

export const PersonalTab: React.FC<PersonalTabProps> = ({ tasks, onUpdateTasks, onDeleteTask, onOpenAddModal, onOpenEditModal }) => {
  const [showCompleted, setShowCompleted] = useState(true);

  const active = tasks.filter(t => !t.missed && (!t.completed || t.recurrence === 'daily' || t.recurrence === 'weekly' || t.recurrence === 'custom'));
  const completed = tasks
    .filter(t => t.completed && t.recurrence === 'one-time')
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  const handleToggle = (task: TaskItem) => {
    const next = !task.completed;
    const updated = tasks.map(t => {
      if (t.id === task.id) {
        return { 
          ...t, 
          completed: next, 
          completedAt: next ? new Date().toISOString() : undefined,
          missed: false 
        };
      }
      return t;
    });
    onUpdateTasks(updated);
    Storage.setTasks('personal', updated);

    if (next) {
      if (task.recurrence === 'one-time') {
        Storage.addCompleted({ ...task, completed: true });
      }
      Storage.removeMissed(task.id);
    } else {
      if (task.recurrence === 'one-time') {
        Storage.removeCompleted(task.id);
      }
    }
  };

  const handleDelete = (id: string) => {
    onDeleteTask(id);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-50 flex items-center gap-2">
            <User className="w-6 h-6 text-cyan-400" />
            <span>Personal Habits & Routines</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Daily recurring reminders and wellness triggers. No hard deadlines — pure life rhythm.</p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Reminder
        </button>
      </div>

      {active.length === 0 ? (
        <div className="p-16 rounded-3xl glass-panel text-center flex flex-col items-center justify-center gap-4 border-dashed border-slate-800 my-8">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-50 font-display">All personal habits checked off today!</h3>
          <p className="text-xs text-slate-400 max-w-sm">Take a mindful walk or drink a glass of water.</p>
          <button onClick={onOpenAddModal} className="mt-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold">Add Habit</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {active.map(task => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rounded-3xl p-6 glass-panel border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between gap-4 group shadow-lg"
              >
                <div className="flex items-start gap-3.5">
                  <button
                    onClick={() => handleToggle(task)}
                    className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${task.completed ? 'bg-cyan-500 border-cyan-400' : 'border-slate-600 hover:border-cyan-400'}`}
                  >
                    {task.completed && <CheckCircle2 className="w-4 h-4 text-slate-950" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold font-display text-slate-50 tracking-tight truncate">{task.title}</h3>
                    {task.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.notes}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-bold bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-500/30">
                    <Bell className="w-3.5 h-3.5" /> {task.timeOfDay || '08:00'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> {task.recurrence}
                    </span>
                    <button 
                      onClick={() => onOpenEditModal(task)} 
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-slate-800/80 text-slate-400 hover:text-cyan-300 hover:bg-slate-700 transition-all border border-slate-700/50"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(task.id)} 
                      className="p-1.5 rounded-lg bg-slate-800/80 text-slate-500 hover:text-rose-400 hover:bg-slate-700 transition-all border border-slate-700/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completed Section */}
      {completed.length > 0 && (
        <div className="mt-12 rounded-3xl p-6 bg-cyan-950/10 border border-cyan-500/20">
          <div onClick={() => setShowCompleted(!showCompleted)} className="flex items-center justify-between cursor-pointer">
            <h3 className="text-base font-bold font-display text-cyan-400">✅ Completed Habits Today ({completed.length})</h3>
            {showCompleted ? <ChevronUp className="w-5 h-5 text-cyan-400" /> : <ChevronDown className="w-5 h-5 text-cyan-400" />}
          </div>
          {showCompleted && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {completed.map(task => (
                <div key={task.id} className="p-4 rounded-2xl bg-slate-900/40 border border-cyan-500/20 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(task)}
                      className="w-5 h-5 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/30 transition-colors shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="line-through text-slate-300 text-sm font-display">{task.title}</span>
                  </div>
                  <button onClick={() => handleDelete(task.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
