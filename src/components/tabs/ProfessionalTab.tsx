import React, { useState, useMemo, useEffect } from 'react';
import mammoth from 'mammoth';
import { TaskItem, Attachment } from '../../types';
import { Storage } from '../../utils/storage';
import { NotificationEngine } from '../../utils/notifications';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isTomorrow } from 'date-fns';
import { Sparkles, Plus, Clock, Paperclip, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, MoreVertical, Edit2, Trash2, Calendar as CalendarIcon, Info, ArrowUp, ArrowDown } from 'lucide-react';

interface ProfessionalTabProps {
  tasks: TaskItem[];
  onUpdateTasks: (tasks: TaskItem[]) => void;
  onDeleteTask: (id: string) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (task: TaskItem) => void;
  onAICreateTask: (proposal: any) => void;
  onAISortTasks: (sorted: TaskItem[]) => void;
  askMaxTimeConfirmation: boolean;
}

export const ProfessionalTab: React.FC<ProfessionalTabProps> = ({
  tasks,
  onUpdateTasks,
  onDeleteTask,
  onOpenAddModal,
  onOpenEditModal,
  onAICreateTask,
  onAISortTasks,
  askMaxTimeConfirmation
}) => {
  const [isSorting, setIsSorting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showMissed, setShowMissed] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [tooltipId, setTooltipId] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAttachment && (selectedAttachment.type.includes('word') || selectedAttachment.name.endsWith('.docx'))) {
      // Convert docx
      fetch(selectedAttachment.url)
        .then(res => res.arrayBuffer())
        .then(arrayBuffer => mammoth.convertToHtml({ arrayBuffer }))
        .then(result => setDocxHtml(result.value))
        .catch(err => {
          console.error(err);
          setDocxHtml('<p class="text-red-500">Error converting document</p>');
        });
    } else {
      setDocxHtml(null);
    }
  }, [selectedAttachment]);

  const activeTasks = tasks.filter(t => !t.completed && !t.missed);
  const completedTasks = tasks
    .filter(t => t.completed)
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
  const missedTasks = tasks
    .filter(t => t.missed && !t.completed)
    .sort((a, b) => {
      const d1 = a.deadline || a.startTime || a.missedAt;
      const d2 = b.deadline || b.startTime || b.missedAt;
      if (!d1 && !d2) return 0;
      if (!d1) return 1;
      if (!d2) return -1;
      const t1 = new Date(d1).getTime();
      const t2 = new Date(d2).getTime();
      if (isNaN(t1) && isNaN(t2)) return 0;
      if (isNaN(t1)) return 1;
      if (isNaN(t2)) return -1;
      return t1 - t2;
    });

  // 80-90% Buffer Rule Summary Calculations
  const nonDeadlineTasks = activeTasks.filter(t => !t.hasDeadline);
  const count = nonDeadlineTasks.length;
  
  // Calculate percentage: 90% for 3 tasks, down to 80% for 10+ tasks
  const percentage = Math.max(80, 90 - Math.min(10, Math.max(0, count - 3) * (10 / 7)));
  
  const totalEstMins = nonDeadlineTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 60), 0);
  const totalTargetMins = Math.round(totalEstMins * (percentage / 100));
  const bufferSavedMins = totalEstMins - totalTargetMins;

  const formatMinsToReadable = (mins: number) => {
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.round((mins / 60) * 10) / 10;
    if (hrs < 24) return `${hrs} hours`;
    const days = Math.round(hrs / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const handleAISort = async () => {
    if (activeTasks.length === 0) return;
    setIsSorting(true);

    try {
      // Reorder tasks by deadline (earliest first, then no deadline)
      const reorderedActive = [...activeTasks].sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (a.deadline && !b.deadline) return -1;
        if (!a.deadline && b.deadline) return 1;
        return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
      });

      const fullUpdated = [...reorderedActive, ...missedTasks, ...completedTasks];
      onUpdateTasks(fullUpdated);
      Storage.setTasks('professional', fullUpdated);

      NotificationEngine.addToast({
        title: '✨ Auto Sorting Applied',
        message: 'Tasks ordered by upcoming deadlines.',
        type: 'info'
      });
    } catch (e) {
      NotificationEngine.addToast({
        title: 'Sort failed',
        message: 'Could not sort tasks.',
        type: 'info'
      });
    } finally {
      setIsSorting(false);
    }
  };

  const handleToggleComplete = (task: TaskItem) => {
    const nextCompleted = !task.completed;
    const updated = tasks.map(t => {
      if (t.id === task.id) {
        return {
          ...t,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          missed: false // If completed, no longer missed
        };
      }
      return t;
    });

    onUpdateTasks(updated);
    Storage.setTasks('professional', updated);

    if (nextCompleted) {
      Storage.addCompleted({ ...task, completed: true });
      Storage.removeMissed(task.id);
    } else {
      Storage.removeCompleted(task.id);
    }
  };

  const handleDelete = (id: string) => {
    onDeleteTask(id);
    Storage.removeCompleted(id);
    Storage.removeMissed(id);
  };

  const moveTaskManual = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= activeTasks.length) return;

    const newActive = [...activeTasks];
    const temp = newActive[idx];
    newActive[idx] = newActive[targetIdx];
    newActive[targetIdx] = temp;

    const full = [...newActive, ...missedTasks, ...completedTasks];
    onUpdateTasks(full);
    Storage.setTasks('professional', full);
  };

  const getDeadlineBadge = (iso?: string, completed?: boolean) => {
    if (!iso || completed) return null;
    const now = Date.now();
    const target = new Date(iso).getTime();
    const diffHours = (target - now) / 3600000;

    if (diffHours < 0) {
      return <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[12px] font-mono font-bold">MISSED</span>;
    }
    if (diffHours <= 24) {
      const hrsMins = `${Math.floor(diffHours)}h ${Math.floor((diffHours % 1) * 60)}m`;
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[12px] font-mono font-bold animate-soft-pulse">
          ⏰ {hrsMins} remaining
        </span>
      );
    }
    if (diffHours <= 72) {
      return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[12px] font-mono font-bold">{Math.round(diffHours / 24)}d left</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[12px] font-mono font-bold">{Math.round(diffHours / 24)}d left</span>;
  };

  const closestTaskId = useMemo(() => {
    let closestId = null;
    let minTime = Infinity;
    activeTasks.forEach(t => {
      if (t.deadline) {
        const time = new Date(t.deadline).getTime();
        if (time < minTime) {
           minTime = time;
           closestId = t.id;
        }
      }
    });
    return closestId;
  }, [activeTasks]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* 80-90% Time Buffer Summary Banner */}
      {nonDeadlineTasks.length >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-950 border border-indigo-500/40 shadow-[0_0_35px_rgba(99,102,241,0.2)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.6)] shrink-0">
              <Sparkles className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-bold">⚡ Signature Innovation: 80-90% AI Time Buffer Engine</span>
              <h3 className="text-base sm:text-lg font-bold font-display text-slate-50 mt-0.5">
                Complete all {nonDeadlineTasks.length} flexible tasks in <span className="text-cyan-300">{formatMinsToReadable(totalTargetMins)}</span> — <span className="text-emerald-400">{formatMinsToReadable(bufferSavedMins)} ahead</span> of your estimates.
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-mono text-emerald-300 shrink-0">
            <span>Buffer time:</span>
            <strong className="text-slate-50 font-bold">{formatMinsToReadable(bufferSavedMins)} saved</strong>
          </div>
        </motion.div>
      )}

      {/* Action Controls: Add Task & AI Sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-50">Professional Workspace</h2>
          <p className="text-xs text-slate-400 mt-1">Glassmorphic cards with autonomous buffer targets and countdown rings.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="ai-sort-button"
            onClick={handleAISort}
            disabled={isSorting || activeTasks.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-sm shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.6)] transition-all flex items-center justify-center gap-2 group shrink-0 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 ${isSorting ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
            <span>{isSorting ? 'Analyzing your tasks...' : '✨ AI Sort'}</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* AI Buffer Summary Banner */}
      {nonDeadlineTasks.length >= 3 && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-indigo-300">
          <div className="flex flex-col">
            <span className="font-bold text-sm">AI Productivity Summary</span>
            <span className="text-xs">Original Est: {formatMinsToReadable(totalEstMins)} | Buffered Target: {formatMinsToReadable(totalTargetMins)}</span>
          </div>
          <div className="font-bold text-sm text-emerald-400">
            {formatMinsToReadable(bufferSavedMins)} saved
          </div>
        </div>
      )}

      {/* Active Tasks Grid */}
      {activeTasks.length === 0 ? (
        <div className="p-16 rounded-3xl glass-panel text-center flex flex-col items-center justify-center gap-4 border-dashed border-slate-800 my-8">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-50 font-display">All active professional tasks completed!</h3>
          <p className="text-xs text-slate-400 max-w-sm">Enjoy your breathing room or ask Jarvis to draft new project roadmaps.</p>
          <button onClick={onOpenAddModal} className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Add New Task</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {activeTasks.map((task, idx) => {
              const isMostUrgent = task.id === closestTaskId;

              return (
                <motion.div
                  key={task.id}
                  layoutId={task.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  className={`relative rounded-3xl p-6 glass-panel transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] flex flex-col justify-between gap-4 group ${
                    isMostUrgent ? 'animate-urgent-ring ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)] border-rose-500' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      aria-label="Complete task"
                      className="mt-1 w-6 h-6 rounded-lg border border-slate-600 hover:border-emerald-400 flex items-center justify-center transition-colors shrink-0 group-hover:scale-110"
                    >
                      {task.completed && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </button>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {/* Manual Reorder Buttons Simulation */}
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => moveTaskManual(idx, -1)} disabled={idx === 0} className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-50 rounded disabled:opacity-20"><ArrowUp className="w-3 h-3" /></button>
                    <button onClick={() => moveTaskManual(idx, 1)} disabled={idx === activeTasks.length - 1} className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-50 rounded disabled:opacity-20"><ArrowDown className="w-3 h-3" /></button>
                  </div>

                  {/* Three-dot Menu */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === task.id ? null : task.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === task.id && (
                        <div className="absolute right-0 top-8 z-30 w-36 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col text-xs text-slate-300 font-sans">
                          <button
                            onClick={() => { setActiveMenuId(null); onOpenEditModal(task); }}
                            className="px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-indigo-400" /> Edit
                          </button>
                          <button
                            onClick={() => { setActiveMenuId(null); onOpenEditModal(task); }}
                            className="px-3 py-2 hover:bg-slate-800 flex items-center gap-2 text-left"
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" /> Reschedule
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 pr-24">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold font-display text-slate-50 tracking-tight break-words pr-2">
                      {task.title}
                    </h3>
                    <div className="flex flex-col items-end gap-1">
                      {getDeadlineBadge(task.deadline)}
                      
                      {task.deadline && !task.completed && !isNaN(new Date(task.deadline).getTime()) && (
                        <div className="text-sm text-rose-300 font-mono font-bold whitespace-nowrap">
                          {(() => {
                            const aimDate = new Date(new Date(task.deadline).getTime() - 3600000);
                            const timeStr = format(aimDate, 'hh:mm a');
                            if (isToday(aimDate)) return `Aim: Today, ${timeStr}`;
                            if (isTomorrow(aimDate)) return `Aim: Tomorrow, ${timeStr}`;
                            return `Aim: ${format(aimDate, 'MMM d, hh:mm a')}`;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                      {/* Notes Preview */}
                      {task.notes && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-1 leading-relaxed font-sans pr-4">
                          {task.notes}
                        </p>
                      )}

                      {/* Timing & Buffer Details */}
                      <div className="flex items-center gap-4 mt-4 flex-wrap text-xs font-mono">
                        {task.maxTimeValue !== undefined && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            Est: {formatMinsToReadable(task.estimatedMinutes || 60)}
                          </span>
                        )}

                        {!task.hasDeadline && nonDeadlineTasks.length >= 3 && (
                          <div className="flex flex-col gap-1 text-[10px] text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 p-2 rounded-lg">
                            <span>Orig Est: {formatMinsToReadable(task.estimatedMinutes || 60)}</span>
                            <span>AI Buffer Target: {formatMinsToReadable(Math.round((task.estimatedMinutes || 60) * (percentage / 100)))}</span>
                            <span className="text-emerald-400 font-bold">Buffer Saved: {formatMinsToReadable((task.estimatedMinutes || 60) - Math.round((task.estimatedMinutes || 60) * (percentage / 100)))}</span>
                          </div>
                        )}

                        {task.attachments && task.attachments.length > 0 && (
                          <div className="flex flex-col gap-1 mt-2">
                            {task.attachments.map((att) => (
                              <button
                                key={att.id}
                                onClick={() => setSelectedAttachment(att)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-cyan-400 text-[11px] hover:text-cyan-300 hover:bg-slate-700 transition-colors w-full text-left"
                              >
                                <Paperclip className="w-3 h-3" />
                                {att.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Attachment Preview Modal */}
      <AnimatePresence>
        {selectedAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedAttachment(null)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative z-10 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-50">{selectedAttachment.name}</h3>
                <button onClick={() => setSelectedAttachment(null)} className="text-slate-400 hover:text-slate-50">✕</button>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 min-h-[200px] flex flex-col items-center justify-center gap-4">
                {selectedAttachment.url ? (
                  <div className="w-full flex items-center justify-center">
                    {selectedAttachment.type.startsWith('image/') ? (
                      <img src={selectedAttachment.url} alt={selectedAttachment.name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
                    ) : selectedAttachment.type.startsWith('video/') ? (
                      <video controls src={selectedAttachment.url} className="max-w-full max-h-[60vh] rounded-lg" />
                    ) : selectedAttachment.type.startsWith('audio/') ? (
                      <audio controls src={selectedAttachment.url} className="w-full" />
                    ) : (selectedAttachment.type.includes('word') || selectedAttachment.name.endsWith('.docx')) && docxHtml ? (
                      <div className="w-full h-[60vh] overflow-auto bg-white p-4 text-black rounded-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: docxHtml }} />
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-slate-400">Preview is not supported for this file type: {selectedAttachment.type}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-slate-400 mb-2">Preview not available (URL missing)</p>
                    {selectedAttachment.content && (
                      <div className="text-left w-full p-4 bg-slate-900 rounded-lg text-slate-300 font-mono text-xs overflow-auto max-h-[40vh]">
                        {selectedAttachment.content}
                      </div>
                    )}
                  </div>
                )}

                {selectedAttachment.url && (
                  <div className="flex gap-4 mt-4">
                    <a href={selectedAttachment.url} download={selectedAttachment.name} className="text-indigo-400 underline font-bold text-lg hover:text-indigo-300">
                      Download
                    </a>
                    <a href={selectedAttachment.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline font-bold text-lg hover:text-indigo-300">
                      Open
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Missed Tasks Section (Collapsible Rose Red) */}
      {missedTasks.length > 0 && (
        <div className="mt-12 rounded-3xl p-6 bg-rose-950/20 border border-rose-500/30">
          <div onClick={() => setShowMissed(!showMissed)} className="flex items-center justify-between cursor-pointer">
            <h3 className="text-base font-bold font-display text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500 animate-bounce" />
              <span>😬 Missed Deadlines ({missedTasks.length}) — Click to Reschedule</span>
            </h3>
            {showMissed ? <ChevronUp className="w-5 h-5 text-rose-400" /> : <ChevronDown className="w-5 h-5 text-rose-400" />}
          </div>

          <AnimatePresence>
            {showMissed && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {missedTasks.map(task => (
                  <div key={task.id} className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className="w-5 h-5 rounded border border-rose-500 bg-rose-500/20 flex items-center justify-center text-rose-300 shrink-0 hover:bg-rose-500/40"
                        title="Mark as completed anyway"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-50 truncate font-display">{task.title}</h4>
                        <span className="text-[11px] font-mono text-rose-300">Missed at: {task.missedAt ? new Date(task.missedAt).toLocaleDateString() : 'Past deadline'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => onOpenEditModal(task)} className="reschedule-btn px-3 py-1.5 rounded-xl font-bold text-xs">Reschedule</button>
                      <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-xl hover:bg-rose-900/50 text-rose-400 hover:text-slate-50"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Completed Tasks Section (Collapsible Emerald) */}
      {completedTasks.length > 0 && (
        <div className="mt-8 rounded-3xl p-6 bg-emerald-950/15 border border-emerald-500/20">
          <div onClick={() => setShowCompleted(!showCompleted)} className="flex items-center justify-between cursor-pointer">
            <h3 className="text-base font-bold font-display text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>✅ Completed Triumphs ({completedTasks.length})</span>
            </h3>
            {showCompleted ? <ChevronUp className="w-5 h-5 text-emerald-400" /> : <ChevronDown className="w-5 h-5 text-emerald-400" />}
          </div>

          <AnimatePresence>
            {showCompleted && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {completedTasks.map(task => (
                  <div key={task.id} className="p-4 rounded-2xl bg-slate-900/50 border border-emerald-500/30 flex items-center justify-between gap-4 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => handleToggleComplete(task)} className="w-5 h-5 rounded border border-emerald-500 bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">✓</button>
                      <span className="text-sm line-through text-slate-300 truncate font-display">{task.title}</span>
                    </div>
                    <button onClick={() => handleDelete(task.id)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
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
