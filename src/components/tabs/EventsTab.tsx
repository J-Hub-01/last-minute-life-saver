import React, { useState } from 'react';
import { TaskItem } from '../../types';
import { Storage } from '../../utils/storage';
import { motion, AnimatePresence } from 'motion/react';
import { DateEventsModal } from '../modals/DateEventsModal';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Pencil, 
  List, 
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';

interface EventsTabProps {
  tasks: TaskItem[];
  onUpdateTasks: (tasks: TaskItem[]) => void;
  onDeleteTask: (id: string) => void;
  onOpenAddModal: (initialDate?: string) => void;
  onOpenEditModal: (task: TaskItem) => void;
  onRefreshCalendar?: () => void;
  isSyncing?: boolean;
}

export const EventsTab: React.FC<EventsTabProps> = ({ 
  tasks, 
  onUpdateTasks, 
  onDeleteTask, 
  onOpenAddModal, 
  onOpenEditModal,
  onRefreshCalendar,
  isSyncing
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showPast, setShowPast] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const sortByDate = (a: TaskItem, b: TaskItem) => {
    const d1 = a.startTime || a.deadline || a.softDeadline;
    const d2 = b.startTime || b.deadline || b.softDeadline;
    if (!d1 && !d2) return 0;
    if (!d1) return 1;
    if (!d2) return -1;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) && isNaN(t2)) return 0;
    if (isNaN(t1)) return 1;
    if (isNaN(t2)) return -1;
    return t1 - t2;
  };

  const active = tasks.filter(t => {
    if (t.completed || t.missed) return false;
    const dateStr = t.startTime || t.deadline || t.softDeadline;
    if (!dateStr) return false;
    try {
      const date = new Date(dateStr).getTime();
      const now = Date.now();
      const endOfThisMonth = endOfMonth(new Date()).getTime();
      // Only upcoming events in the current month
      return date >= now && date <= endOfThisMonth;
    } catch (e) {
      return false;
    }
  }).sort(sortByDate);
  const pastEvents = tasks
    .filter(t => t.completed || t.missed)
    .sort((a, b) => sortByDate(b, a)); // Reverse sort for history

  const handleToggle = (task: TaskItem) => {
    const next = !task.completed;
    const updated = tasks.map(t => t.id === task.id ? { 
      ...t, 
      completed: next, 
      completedAt: next ? new Date().toISOString() : undefined,
      missed: false 
    } : t);
    onUpdateTasks(updated);
    Storage.setTasks('events', updated);
    if (next) {
      Storage.addCompleted({ ...task, completed: true });
      Storage.removeMissed(task.id);
    } else {
      Storage.removeCompleted(task.id);
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getBadgeColor = (type?: string) => {
    if (type === 'Birthday/Party') return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Header / Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-50 font-display">Events Workspace</h2>
          <p className="text-xs text-slate-400 mt-1">Manage your professional meetings and personal life events in one sync.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-50'}`}
              title="Calendar View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-50'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onRefreshCalendar}
            disabled={isSyncing}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <CalendarIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Google'}</span>
          </button>

          <button
            onClick={() => onOpenAddModal()}
            className="px-6 py-3 rounded-xl bg-slate-50 text-slate-950 hover:bg-slate-200 font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'calendar' ? (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-panel rounded-[32px] border-slate-800 overflow-hidden shadow-2xl"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/40">
              <h3 className="text-xl font-bold font-display text-slate-50 flex items-center gap-3">
                <CalendarIcon className="w-6 h-6 text-blue-400" />
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors border border-slate-800">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-2 rounded-xl hover:bg-slate-800 text-xs font-bold text-slate-300 border border-slate-800">Today</button>
                <button onClick={nextMonth} className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors border border-slate-800">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/20">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-3 text-center text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">{day}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayTasks = tasks.filter(t => {
                  const tDate = t.startTime || t.deadline || t.softDeadline;
                  if (!tDate) return false;
                  try {
                    return isSameDay(parseISO(tDate), day);
                  } catch (e) {
                    return false;
                  }
                });
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, monthStart);

                return (
                  <div 
                    key={day.toISOString()} 
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[140px] p-2 border-r border-b border-slate-800 relative transition-all hover:bg-slate-800/30 group cursor-pointer ${!isCurrentMonth ? 'opacity-20 bg-slate-950/50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-mono font-bold flex items-center justify-center w-8 h-8 rounded-full ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : isCurrentMonth ? 'text-slate-400' : 'text-slate-700'}`}>
                        {format(day, 'd')}
                      </span>
                      <div 
                        className="p-1.5 rounded-lg bg-blue-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddModal(format(day, 'yyyy-MM-dd'));
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[100px] scrollbar-hide">
                      {dayTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditModal(task);
                          }}
                          className={`text-[10px] p-1.5 rounded-lg border text-left truncate transition-all group/item flex items-center gap-1 ${
                            task.completed 
                              ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through opacity-60' 
                              : task.eventType === 'Birthday/Party'
                                ? 'bg-pink-500/10 border-pink-500/30 text-pink-300 hover:bg-pink-500/20'
                                : 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
                          }`}
                        >
                          {task.googleEventId && (
                            <svg className="w-2.5 h-2.5 text-blue-400 opacity-80" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/>
                            </svg>
                          )}
                          <span className="truncate">{task.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
            {active.length === 0 ? (
              <div className="p-16 rounded-3xl glass-panel text-center flex flex-col items-center justify-center gap-4 border-dashed border-slate-800 my-8">
                <CalendarIcon className="w-12 h-12 text-blue-400 opacity-50" />
                <h3 className="text-lg font-bold text-slate-50 font-display">No upcoming events found</h3>
                <p className="text-xs text-slate-400">Add a new meeting or sync with Google Calendar.</p>
                <button onClick={() => onOpenAddModal()} className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold">Add New Event</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {active.map(task => {
                  const startDt = task.startTime ? parseISO(task.startTime) : new Date();
                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-3xl p-6 glass-panel border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between gap-4 group shadow-xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex items-start justify-between gap-4 relative z-10">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="w-14 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center shrink-0">
                            <span className="text-[10px] font-mono uppercase text-blue-400 font-bold">{format(startDt, 'MMM')}</span>
                            <span className="text-lg font-extrabold font-mono text-slate-50">{format(startDt, 'd')}</span>
                          </div>
                          <div className="min-w-0">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border font-bold ${getBadgeColor(task.eventType)}`}>
                              {task.eventType || 'Meeting'}
                            </span>
                            <h3 className="text-lg font-bold font-display text-slate-50 tracking-tight mt-1 truncate flex items-center gap-2">
                              {task.title}
                              {task.googleEventId && (
                                <span className="p-1 rounded-md bg-blue-500/10 border border-blue-500/20" title="Synced with Google Calendar">
                                  <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z" fill="#EA4335"/>
                                  </svg>
                                </span>
                              )}
                            </h3>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {format(startDt, 'hh:mm a')}
                              </span>
                              {task.location && (
                                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 truncate max-w-[120px]">
                                  <MapPin className="w-3 h-3" /> {task.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 relative z-10">
                          <button onClick={() => handleToggle(task)} className="w-8 h-8 rounded-xl border border-slate-700 hover:border-emerald-400 flex items-center justify-center shrink-0 text-slate-500 hover:text-emerald-400 transition-colors">
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => onOpenEditModal(task)} className="w-8 h-8 rounded-xl border border-slate-700 hover:border-blue-400 flex items-center justify-center shrink-0 text-slate-500 hover:text-blue-400 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => onDeleteTask(task.id)} className="w-8 h-8 rounded-xl border border-slate-700 hover:border-rose-400 flex items-center justify-center shrink-0 text-slate-500 hover:text-rose-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <DateEventsModal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        date={selectedDate || new Date()}
        tasks={tasks}
        onOpenEditModal={(task) => {
          setSelectedDate(null);
          onOpenEditModal(task);
        }}
      />

      {/* History & Past Events */}
      {pastEvents.length > 0 && (
        <div className="mt-12 rounded-3xl p-6 bg-slate-900/40 border border-slate-800">
          <div onClick={() => setShowPast(!showPast)} className="flex items-center justify-between cursor-pointer group">
            <h3 className="text-base font-bold font-display text-slate-400 group-hover:text-slate-300 transition-colors flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-400" />
              <span>History & Past Events ({pastEvents.length})</span>
            </h3>
            {showPast ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
          </div>
          
          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 overflow-hidden"
              >
                {pastEvents.map(task => (
                  <div key={task.id} className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between gap-4 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${task.completed ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-300 truncate font-display">{task.title}</h4>
                        <p className="text-[10px] text-slate-500 font-mono">{task.startTime ? format(parseISO(task.startTime), 'MMM d, yyyy') : 'Past event'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggle(task)} className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors" title="Re-activate">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors" title="Delete Permanent">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
