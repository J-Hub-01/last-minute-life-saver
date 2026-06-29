import React from 'react';
import { TaskItem } from '../../types';
import { motion } from 'motion/react';
import { X, Clock, MapPin, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DateEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  tasks: TaskItem[];
  onOpenEditModal: (task: TaskItem) => void;
}

export const DateEventsModal: React.FC<DateEventsModalProps> = ({ isOpen, onClose, date, tasks, onOpenEditModal }) => {
  if (!isOpen) return null;

  const dayTasks = tasks.filter(t => {
    const tDate = t.startTime || t.deadline || t.softDeadline;
    if (!tDate) return false;
    try {
      return format(parseISO(tDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    } catch (e) {
      return false;
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-lg w-full glass-panel rounded-3xl p-6 sm:p-8 border-slate-800 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-xl font-bold font-display text-slate-50">
            Events on {format(date, 'MMMM d, yyyy')}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 mt-5">
          {dayTasks.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No events today</p>
          ) : (
            dayTasks.map(task => (
              <div
                key={task.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-50 font-display truncate">{task.title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {task.startTime ? format(parseISO(task.startTime), 'hh:mm a') : 'No time'}
                    </span>
                    {task.location && (
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin className="w-3 h-3" /> {task.location}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => onOpenEditModal(task)} className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
