import React from 'react';
import { TaskItem, TabType } from '../../types';
import { AlertCircle, Calendar, Heart, User, CheckCircle2, ArrowUpRight, Plus, Clock, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AllTabProps {
  tasks: Record<'professional' | 'personal' | 'events' | 'wishlist', TaskItem[]>;
  onSelectCategory: (cat: TabType) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (task: TaskItem) => void;
  onDeleteTask: (tab: 'professional' | 'personal' | 'events' | 'wishlist', id: string) => void;
}

export const AllTab: React.FC<AllTabProps> = ({ tasks, onSelectCategory, onOpenAddModal, onOpenEditModal, onDeleteTask }) => {
  const [selectedCats, setSelectedCats] = React.useState<TabType[]>(['professional', 'personal', 'events', 'wishlist']);

  const toggleCat = (cat: TabType) => {
    if (selectedCats.includes(cat)) {
      if (selectedCats.length > 1) {
        setSelectedCats(selectedCats.filter(c => c !== cat));
      }
    } else {
      setSelectedCats([...selectedCats, cat]);
    }
  };

  const allList = [
    ...(selectedCats.includes('professional') ? tasks.professional.map(t => ({ ...t, catName: 'Professional', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' })) : []),
    ...(selectedCats.includes('personal') ? tasks.personal.map(t => ({ ...t, catName: 'Personal', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' })) : []),
    ...(selectedCats.includes('events') ? tasks.events
      .filter(t => {
        const dateStr = t.startTime || t.deadline;
        if (!dateStr) return false;
        try {
          const date = new Date(dateStr).getTime();
          const now = Date.now();
          const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
          return date >= now && date <= nextWeek;
        } catch (e) {
          return false;
        }
      })
      .map(t => ({ ...t, catName: 'Events', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' })) : []),
    ...(selectedCats.includes('wishlist') ? tasks.wishlist.map(t => ({ ...t, catName: 'Wishlist', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' })) : [])
  ];

  const activeAll = allList
    .filter(t => !t.completed && !t.missed)
    .sort((a, b) => {
      const d1 = a.deadline || a.startTime || a.softDeadline;
      const d2 = b.deadline || b.startTime || b.softDeadline;
      if (!d1 && !d2) return 0;
      if (!d1) return 1;
      if (!d2) return -1;
      try {
        const t1 = new Date(d1).getTime();
        const t2 = new Date(d2).getTime();
        if (isNaN(t1) && isNaN(t2)) return 0;
        if (isNaN(t1)) return 1;
        if (isNaN(t2)) return -1;
        return t1 - t2;
      } catch (e) {
        return 0;
      }
    });

  const urgent = activeAll.filter(t => {
    if ((t as any).isUrgent) return true;
    const deadlineStr = t.deadline || t.startTime || t.softDeadline;
    if (!deadlineStr) return false;
    try {
      const deadline = new Date(deadlineStr).getTime();
      if (isNaN(deadline)) return false;
      return deadline - Date.now() <= 4 * 3600 * 1000;
    } catch (e) {
      return false;
    }
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* Overview stats header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-50">Master Overview & Priorities</h2>
          <p className="text-xs text-slate-400 mt-1">Aggregated live view across all your active routines, meetings, goals, and deadlines.</p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Quick Add Anywhere
        </button>
      </div>

      {/* Filter Section */}
      <div className="mb-8">
        <h3 className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-2 px-1">Filter by Category</h3>
        <div className="p-1 rounded-2xl bg-slate-900/80 border border-slate-700/50 flex flex-wrap gap-1 shadow-inner">
          {[
            { id: 'professional' as TabType, label: 'Professional', color: 'bg-indigo-500', text: 'text-indigo-400' },
            { id: 'personal' as TabType, label: 'Personal', color: 'bg-cyan-500', text: 'text-cyan-400' },
            { id: 'events' as TabType, label: 'Events', color: 'bg-blue-500', text: 'text-blue-400' },
            { id: 'wishlist' as TabType, label: 'Wishlist', color: 'bg-pink-500', text: 'text-pink-400' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCat(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                selectedCats.includes(cat.id)
                  ? `${cat.color} text-slate-950 shadow-lg scale-105`
                  : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${selectedCats.includes(cat.id) ? 'bg-slate-950' : cat.color}`} />
              {cat.label}
            </button>
          ))}
          {selectedCats.length < 4 && (
            <button 
              onClick={() => setSelectedCats(['professional', 'personal', 'events', 'wishlist'])}
              className="px-4 py-2 text-xs font-mono text-indigo-400 hover:text-indigo-300 underline underline-offset-4 ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Category Cards Quick Jump */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { cat: 'professional' as TabType, label: 'Standard Tasks', count: tasks.professional.filter(t => !t.completed && !t.missed).length, icon: AlertCircle, color: 'text-indigo-400', border: 'hover:border-indigo-500/50' },
          { cat: 'personal' as TabType, label: 'Habits & Routines', count: tasks.personal.filter(t => !t.completed && !t.missed).length, icon: User, color: 'text-cyan-400', border: 'hover:border-cyan-500/50' },
          { cat: 'events' as TabType, label: 'Calendar Events', count: tasks.events.filter(t => !t.completed && !t.missed).length, icon: Calendar, color: 'text-blue-400', border: 'hover:border-blue-500/50' },
          { cat: 'wishlist' as TabType, label: 'Bucket List Aspirations', count: tasks.wishlist.filter(t => !t.completed && !t.missed).length, icon: Heart, color: 'text-pink-400', border: 'hover:border-pink-500/50' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.cat}
              onClick={() => onSelectCategory(item.cat)}
              className={`p-5 rounded-3xl glass-panel border-slate-800 ${item.border} transition-all cursor-pointer group flex flex-col justify-between gap-4`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-6 h-6 ${item.color}`} />
                <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-50 transition-colors" />
              </div>
              <div>
                <span className="text-2xl font-extrabold font-mono text-slate-50">{item.count}</span>
                <p className="text-xs text-slate-400 font-display mt-0.5">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Urgent Section */}
      {urgent.length > 0 && (
        <div className="mb-10 p-6 rounded-3xl bg-rose-950/20 border border-rose-500/30">
          <h3 className="text-sm font-extrabold font-display uppercase tracking-wider text-rose-400 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 animate-bounce" /> High Priority & Last-Minute Urgent Focus ({urgent.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgent.map(task => (
              <div key={task.id} className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/40 flex flex-col justify-between gap-2 group relative">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">{task.catName}</span>
                  <div className="flex items-center gap-2">
                    {task.deadline && <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenEditModal(task); }}
                      className="p-1 text-slate-500 hover:text-white transition-all"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onDeleteTask(task.tab, task.id); 
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-50 font-display truncate">{task.title}</h4>
                {task.notes && <p className="text-xs text-slate-400 line-clamp-1">{task.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Active Items Stream */}
      <div className="space-y-4">
        <h3 className="text-base font-extrabold font-display text-slate-300 flex items-center gap-2">
          <span>All Active Items Stream</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">{activeAll.length}</span>
        </h3>

        {activeAll.length === 0 ? (
          <div className="p-12 rounded-3xl glass-panel text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
            <h4 className="text-base font-bold text-slate-50">Zero active items across all tabs!</h4>
            <p className="text-xs text-slate-400 mt-1">Enjoy your completely free schedule.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAll.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => onSelectCategory(item.tab as TabType)}
                className={`p-5 rounded-2xl glass-panel border-slate-800 hover:border-slate-500 transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${item.bg} ${item.color} ${item.border}`}>
                    {item.catName}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.deadline && <span className="text-[10px] font-mono text-slate-400">{new Date(item.deadline).toLocaleDateString()}</span>}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenEditModal(item); }}
                      className="p-1 text-slate-500 hover:text-white transition-all bg-slate-900/80 rounded-lg shadow-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        onDeleteTask(item.tab as any, item.id); 
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-all bg-slate-900/80 rounded-lg shadow-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold font-display text-slate-50 line-clamp-1">{item.title}</h4>
                  {item.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.notes}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
