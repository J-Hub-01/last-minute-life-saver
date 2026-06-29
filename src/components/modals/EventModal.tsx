import React, { useState } from 'react';
import { TaskItem, EventType } from '../../types';
import { motion } from 'motion/react';
import { X, Calendar, MapPin, Sparkles } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskItem) => void;
  initialTask?: TaskItem | null;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, initialTask }) => {
  const isEditing = !!initialTask;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [title, setTitle] = useState(initialTask?.title || '');
  const [dateStr, setDateStr] = useState(initialTask?.deadline ? initialTask.deadline.split('T')[0] : tomorrow);
  const [startTime, setStartTime] = useState(initialTask?.startTime ? new Date(initialTask.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '14:00');
  const [endTime, setEndTime] = useState(initialTask?.endTime ? new Date(initialTask.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '15:00');
  const [eventType, setEventType] = useState<EventType>(initialTask?.eventType || 'Meeting');
  const [location, setLocation] = useState(initialTask?.location || '');
  const [notes, setNotes] = useState(initialTask?.notes || '');

  if (!isOpen) return null;

  const sampleLocations = [
    'Google Meet (Virtual Link)',
    'Google HQ - Mountain View, CA',
    'Panvel Gymkhana Hall, Sector 15',
    'Starbucks Coffee, MG Road',
    'Zoom Video Call'
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const startIso = new Date(`${dateStr}T${startTime}`).toISOString();
    const endIso = new Date(`${dateStr}T${endTime}`).toISOString();

    const newTask: TaskItem = {
      id: initialTask?.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tab: 'events',
      title: title.trim(),
      hasDeadline: true,
      deadline: startIso,
      startTime: startIso,
      endTime: endIso,
      eventType,
      location: location.trim() || 'Virtual Sync',
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
        className="relative max-w-lg w-full glass-panel rounded-3xl p-6 sm:p-8 border-slate-800 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-xl font-bold font-display text-slate-50 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span>{isEditing ? 'Edit Calendar Event' : 'Add Calendar Event'}</span>
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5 mt-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Event Name *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Google DeepMind Pitch or Surprise Birthday Party"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Event Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Meeting', 'Birthday/Party', 'Other'] as EventType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEventType(t)}
                  className={`py-2 px-3 rounded-xl text-xs font-medium uppercase tracking-wider transition-all border ${
                    eventType === t
                      ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block font-mono">
              ⚡ Notification rule: {eventType === 'Meeting' ? '25 hrs, 1 hr, & exact time' : '1 day before 9 AM & day of 9 AM'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">DATE</label>
              <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-mono text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">START TIME</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-mono text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-1">END TIME</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 font-mono text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span>Location (Google Maps Autocomplete Simulation)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Start typing location..."
              list="map-autocomplete-list"
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 font-sans text-sm"
            />
            <datalist id="map-autocomplete-list">
              {sampleLocations.map(loc => <option key={loc} value={loc} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda or party preparation notes..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder-slate-500 text-sm font-sans"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-slate-50 text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Push to Google Calendar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
