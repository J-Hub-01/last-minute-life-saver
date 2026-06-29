import { UserProfile, AppSettings, TaskItem } from '../types';

const KEYS = {
  USER: 'lmls_user',
  PROFESSIONAL: 'lmls_professional_tasks',
  PERSONAL: 'lmls_personal_reminders',
  EVENTS: 'lmls_events',
  WISHLIST: 'lmls_wishlist',
  SETTINGS: 'lmls_settings',
  COMPLETED: 'lmls_completed',
  MISSED: 'lmls_missed',
};

const DEFAULT_SETTINGS: AppSettings = {
  storageDurationDays: 15,
  notifications: {
    deadlineAlerts: true,
    missedAlerts: true,
    eventReminders: true,
    wishlistNudge: true,
    aiActions: true,
    birthdayWish: true,
  },
  askMaxTimeConfirmation: true,
  theme: 'dark',
};

function safeParseJSON<T>(data: string | null, fallback: T): T {
  if (!data || data === 'undefined' || data === 'null') return fallback;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.warn('Failed to parse JSON from localStorage:', e);
    return fallback;
  }
}

export const Storage = {
  getUser(): UserProfile | null {
    const data = localStorage.getItem(KEYS.USER);
    return safeParseJSON<UserProfile | null>(data, null);
  },
  setUser(user: UserProfile) {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lmls_storage_updated'));
    }, 0);
  },

  getSettings(): AppSettings {
    const data = localStorage.getItem(KEYS.SETTINGS);
    const parsed = safeParseJSON<Partial<AppSettings>>(data, {});
    return { ...DEFAULT_SETTINGS, ...parsed };
  },
  setSettings(settings: AppSettings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lmls_storage_updated'));
    }, 0);
  },

  getTasks(tab: 'professional' | 'personal' | 'events' | 'wishlist'): TaskItem[] {
    const key = KEYS[tab.toUpperCase() as keyof typeof KEYS];
    const data = localStorage.getItem(key);
    const parsed = safeParseJSON<TaskItem[]>(data, []);
    const seen = new Set<string>();
    return parsed.filter(item => {
      if (!item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  },
  setTasks(tab: 'professional' | 'personal' | 'events' | 'wishlist', tasks: TaskItem[]) {
    const key = KEYS[tab.toUpperCase() as keyof typeof KEYS];
    localStorage.setItem(key, JSON.stringify(tasks));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lmls_storage_updated'));
    }, 0);
  },

  getAllActiveTasks(): TaskItem[] {
    return [
      ...this.getTasks('professional'),
      ...this.getTasks('personal'),
      ...this.getTasks('events'),
      ...this.getTasks('wishlist'),
    ].filter(t => !t.completed && !t.missed);
  },

  getCompleted(): TaskItem[] {
    const data = localStorage.getItem(KEYS.COMPLETED);
    const list = safeParseJSON<TaskItem[]>(data, []);
    const seen = new Set<string>();
    const filtered = list.filter(item => {
      if (!item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return filtered.sort((a, b) => {
      const timeA = new Date(a.completedAt || 0).getTime();
      const timeB = new Date(b.completedAt || 0).getTime();
      return timeB - timeA; // Most recently completed first
    });
  },
  addCompleted(task: TaskItem) {
    const completed = this.getCompleted();
    if (!completed.some(c => c.id === task.id)) {
      const taskWithCompleted = { ...task, completed: true, completedAt: new Date().toISOString() };
      const updated = [taskWithCompleted, ...completed];
      localStorage.setItem(KEYS.COMPLETED, JSON.stringify(updated));
      
      // Also update in original tab
      const list = this.getTasks(task.tab);
      const updatedTabList = list.map(t => t.id === task.id ? taskWithCompleted : t);
      this.setTasks(task.tab, updatedTabList);
    }
  },
  removeCompleted(id: string) {
    const completed = this.getCompleted();
    localStorage.setItem(KEYS.COMPLETED, JSON.stringify(completed.filter(t => t.id !== id)));
  },

  getMissed(): TaskItem[] {
    const data = localStorage.getItem(KEYS.MISSED);
    const list = safeParseJSON<TaskItem[]>(data, []);
    const seen = new Set<string>();
    const filtered = list.filter(item => {
      if (!item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return filtered.sort((a, b) => {
      // Sort by original deadline ascending (the one that missed first is at the top)
      const d1 = a.deadline || a.startTime || a.softDeadline || a.missedAt || '';
      const d2 = b.deadline || b.startTime || b.softDeadline || b.missedAt || '';
      if (!d1 && !d2) return 0;
      if (!d1) return 1;
      if (!d2) return -1;
      return new Date(d1).getTime() - new Date(d2).getTime();
    });
  },
  addMissed(task: TaskItem) {
    const missed = this.getMissed();
    if (!missed.some(m => m.id === task.id)) {
      const taskWithMissed = { ...task, missed: true, missedAt: new Date().toISOString() };
      const updated = [taskWithMissed, ...missed];
      localStorage.setItem(KEYS.MISSED, JSON.stringify(updated));

      // Also update in original tab
      const list = this.getTasks(task.tab);
      const updatedTabList = list.map(t => t.id === task.id ? taskWithMissed : t);
      this.setTasks(task.tab, updatedTabList);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('lmls_storage_updated'));
      }, 0);
    }
  },
  removeMissed(id: string) {
    const missed = this.getMissed();
    localStorage.setItem(KEYS.MISSED, JSON.stringify(missed.filter(t => t.id !== id)));
    
    // Also clear from alerted IDs in settings to allow re-alerting if rescheduled and missed again
    const settings = this.getSettings();
    if (settings.alertedMissedTaskIds?.includes(id)) {
      settings.alertedMissedTaskIds = settings.alertedMissedTaskIds.filter(tid => tid !== id);
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    }
  },

  markTasksAsMissed(tasks: TaskItem[]) {
    if (tasks.length === 0) return;
    
    const missed = this.getMissed();
    const newMissed = [...missed];
    const now = new Date().toISOString();
    
    tasks.forEach(task => {
      if (!newMissed.some(m => m.id === task.id)) {
        const taskWithMissed = { ...task, missed: true, missedAt: now };
        newMissed.unshift(taskWithMissed);
        
        // Update in its respective tab list
        const tabList = this.getTasks(task.tab);
        const updatedTabList = tabList.map(t => t.id === task.id ? taskWithMissed : t);
        const key = KEYS[task.tab.toUpperCase() as keyof typeof KEYS];
        localStorage.setItem(key, JSON.stringify(updatedTabList));
      }
    });
    
    localStorage.setItem(KEYS.MISSED, JSON.stringify(newMissed));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lmls_storage_updated'));
    }, 0);
  },

  cleanOldItems() {
    const settings = this.getSettings();
    const maxDays = settings.storageDurationDays || 15;
    const now = new Date().getTime();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    const cleanList = (list: TaskItem[]) => 
      list.filter(item => {
        // If it's active, keep it. Only clean completed/missed history.
        if (!item.completed && !item.missed) return true;
        
        const time = new Date(item.completedAt || item.missedAt || item.createdAt).getTime();
        return (now - time) <= maxAgeMs;
      });

    // Clean global history
    localStorage.setItem(KEYS.COMPLETED, JSON.stringify(cleanList(this.getCompleted())));
    localStorage.setItem(KEYS.MISSED, JSON.stringify(cleanList(this.getMissed())));

    // Clean individual tab arrays
    const tabs: ('professional' | 'personal' | 'events' | 'wishlist')[] = ['professional', 'personal', 'events', 'wishlist'];
    tabs.forEach(tab => {
      const list = this.getTasks(tab);
      const cleaned = cleanList(list);
      if (cleaned.length !== list.length) {
        this.setTasks(tab, cleaned);
      }
    });
  },

  seedDefaultDemoDataIfEmpty() {
    if (!this.getUser()) {
      return; // Not onboarded yet
    }
    const prof = this.getTasks('professional');
    if (prof.length === 0) {
      const now = new Date();
      const in3Hours = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
      const in2Days = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
      const in5Days = new Date(now.getTime() + 120 * 60 * 60 * 1000).toISOString();

      const sampleProf: TaskItem[] = [
        {
          id: 'prof_urgent_1',
          tab: 'professional',
          title: 'Finalize Vibe2Ship Hackathon Pitch Deck',
          hasDeadline: true,
          deadline: in3Hours,
          estimatedMinutes: 180,
          aiTargetMinutes: 144,
          bufferSavedMinutes: 36,
          maxTimeValue: 3,
          maxTimeUnit: 'hours',
          notes: 'Ensure architecture slide highlights Gemini 2.0 Flash agentic loop.',
          completed: false,
          missed: false,
          createdAt: now.toISOString(),
          attachments: [
            { id: 'att_1', name: 'Hackathon_Guidelines_2026.pdf', size: '2.4 MB', type: 'PDF', content: 'Vibe2Ship Hackathon 2026 Guidelines: Evaluation heavily prioritizes Agentic Depth (20%), Problem Solving (20%), and Innovation (20%). Applications must integrate Gemini 2.0 Flash.' }
          ]
        },
        {
          id: 'prof_buf_1',
          tab: 'professional',
          title: 'Refactor Auth Middleware for Production',
          hasDeadline: false,
          estimatedMinutes: 2880, // 2 days
          aiTargetMinutes: 2304, // ~1.6 days
          bufferSavedMinutes: 576,
          notes: 'Apply 80-90% buffer rule to maintain breathing room.',
          completed: false,
          missed: false,
          createdAt: now.toISOString(),
        },
        {
          id: 'prof_buf_2',
          tab: 'professional',
          title: 'Design GraphQL API Schema for Q3',
          hasDeadline: false,
          estimatedMinutes: 4320, // 3 days
          aiTargetMinutes: 3456, // 2.4 days
          bufferSavedMinutes: 864,
          completed: false,
          missed: false,
          createdAt: now.toISOString(),
        },
        {
          id: 'prof_norm_1',
          tab: 'professional',
          title: 'Review PR #418 - Cloud Run Deployment',
          hasDeadline: true,
          deadline: in2Days,
          estimatedMinutes: 45,
          completed: false,
          missed: false,
          createdAt: now.toISOString(),
        }
      ];
      this.setTasks('professional', sampleProf);
    }

    const pers = this.getTasks('personal');
    if (pers.length === 0) {
      this.setTasks('personal', [
        {
          id: 'pers_1',
          tab: 'personal',
          title: 'Morning Diaphragmatic Run & Cardio',
          hasDeadline: false,
          timeOfDay: '07:30',
          recurrence: 'daily',
          completed: false,
          missed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'pers_grocery',
          tab: 'personal',
          title: 'Grocery shopping',
          hasDeadline: false,
          timeOfDay: '17:00',
          notes: 'Pick up organic almond milk and fresh avocados.',
          recurrence: 'one-time',
          completed: false,
          missed: false,
          createdAt: new Date().toISOString()
        }
      ]);
    }

    const ev = this.getTasks('events');
    if (ev.length === 0) {
      this.setTasks('events', []);
    }

    const wish = this.getTasks('wishlist');
    if (wish.length === 0) {
      this.setTasks('wishlist', [
        {
          id: 'wish_1',
          tab: 'wishlist',
          title: 'Backpacking Expedition across Manali & Spiti Valley',
          hasDeadline: false,
          softDeadline: new Date(new Date().getFullYear(), 11, 31).toISOString(),
          notes: 'Experience stargazing in zero-pollution altitude.',
          completed: false,
          missed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: 'wish_2',
          tab: 'wishlist',
          title: 'Master Neo-Soul Fingerstyle Guitar',
          hasDeadline: false,
          completed: false,
          missed: false,
          createdAt: new Date().toISOString()
        }
      ]);
    }
  }
};
