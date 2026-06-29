import React, { useState } from 'react';
import { TaskItem, TimeUnit, Attachment } from '../../types';
import { Storage } from '../../utils/storage';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, Paperclip, AlertCircle, FileText, Check } from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTask?: TaskItem | null;
  initialDate?: string;
  defaultTab?: 'professional' | 'personal' | 'events' | 'wishlist';
  onSave: (task: TaskItem) => void;
  onDelete?: (id: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  initialTask,
  initialDate,
  defaultTab,
  onSave,
  onDelete
}) => {
  const isEditing = !!initialTask;

  const [title, setTitle] = useState<string>(initialTask?.title || '');
  const [tab, setTab] = useState<'professional' | 'personal' | 'events' | 'wishlist'>(
    initialTask?.tab || defaultTab || 'professional'
  );
  const [hasDeadline, setHasDeadline] = useState<boolean>(initialTask?.hasDeadline ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const getLocalDateStr = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  };

  const getLocalTimeStr = (iso?: string, fallback = '23:59') => {
    if (!iso) return fallback;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return fallback;
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };

  // Professional / General fields
  const [dateStr, setDateStr] = useState<string>(() => {
    if (initialTask?.deadline) return getLocalDateStr(initialTask.deadline);
    if (initialTask?.startTime) return getLocalDateStr(initialTask.startTime);
    if (initialTask?.softDeadline) return getLocalDateStr(initialTask.softDeadline);
    if (initialDate) return initialDate;
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [timeStr, setTimeStr] = useState<string>(getLocalTimeStr(initialTask?.deadline, '23:59'));

  // Personal fields
  const [recurrence, setRecurrence] = useState<TaskItem['recurrence']>(initialTask?.recurrence || 'one-time');
  const [customDays, setCustomDays] = useState<string[]>(initialTask?.customDays || ['Mon', 'Wed', 'Fri']);

  // Event fields
  const [eventType, setEventType] = useState<TaskItem['eventType']>(initialTask?.eventType || 'Meeting');
  const [startTime, setStartTime] = useState(getLocalTimeStr(initialTask?.startTime, '09:00'));
  const [endTime, setEndTime] = useState(getLocalTimeStr(initialTask?.endTime, '10:00'));
  const [location, setLocation] = useState(initialTask?.location || '');

  // Wishlist fields
  const [softDeadline, setSoftDeadline] = useState(getLocalDateStr(initialTask?.softDeadline) || '');

  const [maxValue, setMaxValue] = useState<number>(initialTask?.maxTimeValue || 2);
  const [maxUnit, setMaxUnit] = useState<TimeUnit>(initialTask?.maxTimeUnit || 'hours');
  const [hasDuration, setHasDuration] = useState<boolean>(initialTask?.maxTimeValue !== undefined && initialTask?.maxTimeValue !== null);
  const [notes, setNotes] = useState<string>(initialTask?.notes || '');
  const [attachments, setAttachments] = useState<Attachment[]>(initialTask?.attachments || []);

  const [showNudge, setShowNudge] = useState<boolean>(false);
  const [dontAskAgain, setDontAskAgain] = useState<boolean>(false);

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setCustomDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };
  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const calculateTotalMinutes = (val: number, unit: TimeUnit): number => {
    if (unit === 'minutes') return val;
    if (unit === 'hours') return val * 60;
    return val * 1440;
  };

  const handleAttemptSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!title.trim()) {
      setIsSubmitting(false);
      return;
    }


    const settings = Storage.getSettings();
    if (settings.askMaxTimeConfirmation) {
      setIsSubmitting(false);
      setShowNudge(true);
    } else {
      finalizeSave();
    }
  };

  const finalizeSave = () => {
    setIsSubmitting(true);
    const totalMinutes = hasDuration ? calculateTotalMinutes(maxValue || 60, maxUnit) : 0;
    // Apply 80-90% buffer rule if no deadline and has duration
    let aiTargetMinutes = totalMinutes;
    let bufferSavedMinutes = 0;

    if (!hasDeadline && hasDuration) {
      const bufferRatio = 0.82; // 82% target
      aiTargetMinutes = Math.round(totalMinutes * bufferRatio);
      bufferSavedMinutes = totalMinutes - aiTargetMinutes;
    }

    let isoDeadline = '';
    if (hasDeadline && dateStr) {
      const finalTime = (timeStr || '23:59').padEnd(5, '0');
      try {
        isoDeadline = new Date(`${dateStr}T${finalTime}:00`).toISOString();
      } catch (e) {
        console.error('Invalid deadline date/time', e);
        isoDeadline = new Date(`${dateStr}T23:59:59`).toISOString();
      }
    }

    // Validation for events: ensure end time is after start time
    let finalStartTime = startTime || '09:00';
    let finalEndTime = endTime || '10:00';
    
    if (tab === 'events' && dateStr) {
      try {
        const start = new Date(`${dateStr}T${finalStartTime}:00`).getTime();
        const end = new Date(`${dateStr}T${finalEndTime}:00`).getTime();
        
        if (isNaN(start) || isNaN(end) || end <= start) {
          const baseStart = isNaN(start) ? new Date(`${dateStr}T09:00:00`).getTime() : start;
          const newEnd = new Date(baseStart + 3600000);
          finalEndTime = newEnd.toTimeString().substring(0, 5);
        }
      } catch (e) {
        finalStartTime = '09:00';
        finalEndTime = '10:00';
      }
    }

    const newTask: TaskItem = {
      ...(initialTask || {}),
      id: initialTask?.id || `${tab.substring(0, 4)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tab: tab,
      title: title.trim(),
      hasDeadline,
      deadline: isoDeadline,
      maxTimeValue: tab === 'professional' && hasDuration ? maxValue : undefined,
      maxTimeUnit: tab === 'professional' && hasDuration ? maxUnit : undefined,
      estimatedMinutes: tab === 'professional' ? totalMinutes : undefined,
      aiTargetMinutes: tab === 'professional' ? aiTargetMinutes : undefined,
      bufferSavedMinutes: tab === 'professional' ? bufferSavedMinutes : undefined,
      notes: notes.trim(),
      attachments,
      completed: initialTask?.completed || false,
      missed: false, // Reset missed status on edit/save to allow recovery
      createdAt: initialTask?.createdAt || new Date().toISOString(),
      // Add extra fields based on tab
      recurrence: tab === 'personal' ? recurrence : undefined,
      customDays: tab === 'personal' && recurrence === 'custom' ? customDays : undefined,
      eventType: tab === 'events' ? eventType : undefined,
      location: tab === 'events' ? location : undefined,
      startTime: tab === 'events' && dateStr ? new Date(`${dateStr}T${finalStartTime}:00`).toISOString() : undefined,
      endTime: tab === 'events' && dateStr ? new Date(`${dateStr}T${finalEndTime}:00`).toISOString() : undefined,
      softDeadline: tab === 'wishlist' ? (softDeadline ? new Date(`${softDeadline}T23:59:59`).toISOString() : undefined) : undefined,
    };

    if (dontAskAgain) {
      const settings = Storage.getSettings();
      settings.askMaxTimeConfirmation = false;
      Storage.setSettings(settings);
    }

    onSave(newTask);
    onClose();
  };

  const processFiles = (files: FileList) => {
    Array.from(files).forEach((file: File) => {
      const url = URL.createObjectURL(file);
      const newAtt: Attachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: file.type,
        url: url,
      };

      if (file.type.startsWith('text/') || file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
          newAtt.content = event.target?.result as string;
          setAttachments(prev => [...prev, newAtt]);
        };
        reader.readAsText(file);
      } else {
        setAttachments(prev => [...prev, newAtt]);
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-lg w-full glass-panel rounded-3xl p-6 sm:p-8 border-slate-800 shadow-2xl overflow-hidden my-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-xl font-bold font-display text-slate-50">
            {isEditing ? `Edit ${tab.charAt(0).toUpperCase() + tab.slice(1)} Item` : 'Quick Add Task'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAttemptSave} className="flex flex-col gap-5 mt-5">
          {/* 0. Category Selection (Only for New Tasks) */}
          {!initialTask && (
            <div className="mb-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-1">Select Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'professional', label: 'Work', color: 'bg-indigo-500', text: 'text-indigo-400' },
                  { id: 'personal', label: 'Life', color: 'bg-cyan-500', text: 'text-cyan-400' },
                  { id: 'events', label: 'Event', color: 'bg-blue-500', text: 'text-blue-400' },
                  { id: 'wishlist', label: 'Dream', color: 'bg-pink-500', text: 'text-pink-400' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTab(cat.id as any)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      tab === cat.id 
                        ? `${cat.color} border-transparent text-slate-950 shadow-lg scale-[1.02]` 
                        : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${tab === cat.id ? 'bg-slate-950' : cat.color}`} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Task Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Task Name *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Architect Backend Service for Vibe2Ship"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          {/* 2. Category Specific Fields */}
          <div className="flex flex-col gap-4">
            {tab === 'professional' && (
              <>
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-50 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      {isEditing ? 'Extended deadline?' : 'Does this task have a deadline?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHasDeadline(!hasDeadline)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-1 ${hasDeadline ? 'bg-indigo-600' : 'bg-slate-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${hasDeadline ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {hasDeadline ? (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-3 pt-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">DATE</label>
                        <input
                          type="date"
                          value={dateStr}
                          onChange={(e) => setDateStr(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs font-mono"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-[10px] font-mono text-slate-400 mb-1">TIME (23:59 default)</label>
                        <input
                          type="time"
                          value={timeStr}
                          onChange={(e) => setTimeStr(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs font-mono"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <span className="text-xs text-emerald-400 font-mono">
                      ⚡ No deadline set. Eligible for AI 80-90% Time Buffer optimization!
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-50 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      Add estimated time?
                    </span>
                    <button
                      type="button"
                      onClick={() => setHasDuration(!hasDuration)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-1 ${hasDuration ? 'bg-emerald-600' : 'bg-slate-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${hasDuration ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {hasDuration && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-3 pt-2">
                      <input
                        type="number"
                        min="1"
                        value={maxValue}
                        onChange={(e) => setMaxValue(parseInt(e.target.value) || 1)}
                        required
                        className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-50 font-mono text-sm"
                      />
                      <select
                        value={maxUnit}
                        onChange={(e) => setMaxUnit(e.target.value as TimeUnit)}
                        className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-50 font-sans text-sm"
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </motion.div>
                  )}
                </div>
              </>
            )}

            {tab === 'personal' && (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Recurrence Preference</label>
                <div className="flex flex-wrap gap-2">
                  {['one-time', 'daily', 'weekly', 'custom'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrence(r as any)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                        recurrence === r 
                          ? 'bg-cyan-600 border-transparent text-white' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {r === 'one-time' ? 'One-time' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
                {recurrence === 'custom' && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800">
                    {daysList.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`w-8 h-8 rounded-lg text-xs font-mono font-bold flex items-center justify-center border ${
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
            )}

            {tab === 'events' && (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase">Date</label>
                    <input
                      type="date"
                      value={dateStr}
                      onChange={(e) => setDateStr(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase">Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs"
                    >
                      <option value="Meeting">Meeting</option>
                      <option value="Birthday/Party">Party</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase">Starts</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase">Ends</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1 uppercase">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Meeting link or room..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs"
                  />
                </div>
              </div>
            )}

            {tab === 'wishlist' && (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col gap-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Target Date (Optional)</label>
                <input
                  type="date"
                  value={softDeadline}
                  onChange={(e) => setSoftDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-50 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-500 italic">When would you like to achieve this by?</p>
              </div>
            )}
          </div>

          {/* 4. Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Notes (Optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key deliverables, links, or sub-items..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans text-sm"
            />
          </div>

          {/* 5. Attachments */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Attachments (For AI Q&A)</label>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/50 text-slate-400 hover:text-slate-50 transition-all text-xs">
                <Paperclip className="w-4 h-4 text-indigo-400" />
                <span>Upload PDF, DOC, or TXT for AI Assistant analysis</span>
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
              </label>

              {attachments.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate font-medium">{att.name}</span>
                        <span className="text-[10px] opacity-60 font-mono">({att.size})</span>
                      </div>
                      <button type="button" onClick={() => removeAttachment(att.id)} className="text-rose-400 hover:text-rose-300 p-1">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-800 mt-2">
            {isEditing && initialTask?.googleEventId && tab === 'events' && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tight">Sync Active</span>
                  <span className="text-[11px] text-slate-400">This event is on your Google Calendar.</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (initialTask.googleEventId) {
                      try {
                        const { CalendarEngine } = await import('../../utils/calendar');
                        const { NotificationEngine } = await import('../../utils/notifications');
                        
                        NotificationEngine.addToast({ title: 'Unsyncing...', message: 'Removing event from Google Calendar.', type: 'info' });
                        const success = await CalendarEngine.deleteFromCalendar(initialTask.googleEventId);
                        
                        if (success) {
                          onSave({ ...initialTask, googleEventId: undefined });
                          onClose();
                          NotificationEngine.addToast({ title: 'Unsynced', message: 'Event removed from Google Calendar but kept locally.', type: 'success' });
                        } else {
                          NotificationEngine.addToast({ title: 'Unsync Failed', message: 'Could not remove from Google. It might already be deleted.', type: 'error' });
                          // Still allow local unsync if the user wants
                          onSave({ ...initialTask, googleEventId: undefined });
                          onClose();
                        }
                      } catch (err) {
                        console.error('Unsync error:', err);
                      }
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold transition-all"
                >
                  Unsync & Remove from Google
                </button>
              </div>
            )}
            <div className="flex justify-end gap-3">
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(initialTask.id);
                    onClose();
                  }}
                  className="mr-auto px-5 py-2.5 rounded-xl text-rose-400 hover:text-rose-50 hover:bg-rose-500/10 text-sm transition-all"
                >
                  Delete Task
                </button>
              )}
              <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-50 text-sm">Cancel</button>
              <button type="submit" className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all">
                {isEditing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>

        {/* Nudge Confirmation Modal */}
        <AnimatePresence>
          {showNudge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl p-8 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.3)] mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold font-display text-slate-50">Are you sure about this timing?</h4>
              <p className="text-sm text-slate-300 mt-2 max-w-sm leading-relaxed">
                You estimated <strong className="text-amber-300">{maxValue} {maxUnit}</strong>. This timing won't be extended automatically by Jarvis.
              </p>

              <label className="flex items-center gap-2 mt-6 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                />
                <span>Don't ask again for timing edits</span>
              </label>

              <div className="flex gap-3 mt-8 w-full max-w-xs">
                <button
                  onClick={() => setShowNudge(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-50 font-medium text-sm transition-colors"
                >
                  Edit Time
                </button>
                <button
                  onClick={finalizeSave}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Confirm
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
