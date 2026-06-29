import { Storage } from './storage';
import { TaskItem } from '../types';
import { getRandomQuote } from './quotes';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'urgent' | 'missed' | 'ai' | 'success' | 'info' | 'wishlist' | 'error';
  timestamp: string;
  onClick?: () => void;
}

let activeToasts: ToastMessage[] = [];
let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let checkInterval: ReturnType<typeof setInterval> | null = null;

export const NotificationEngine = {
  subscribe(listener: (toasts: ToastMessage[]) => void) {
    toastListeners.push(listener);
    listener([...activeToasts]);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  },

  notify(toasts: ToastMessage[]) {
    toastListeners.forEach(l => l(toasts));
  },

  addToast(toast: Omit<ToastMessage, 'id' | 'timestamp'>) {
    // Basic deduplication: ignore if same title/message added within 5 seconds
    const now = Date.now();
    const key = `${toast.title}:${toast.message}`;
    const lastTime = (this as any)._lastToastTimes?.get(key) || 0;
    if (now - lastTime < 5000) return;
    
    if (!(this as any)._lastToastTimes) (this as any)._lastToastTimes = new Map();
    (this as any)._lastToastTimes.set(key, now);

    const newToast: ToastMessage = {
      ...toast,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    activeToasts = [newToast, ...activeToasts].slice(0, 5); // Keep max 5
    this.notify([...activeToasts]);

    // Try Native Push Notification if permitted
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(toast.title, {
          body: toast.message,
          icon: '/favicon.ico'
        });
      }
    } catch (e) {
      // Benign iframe restriction
    }
  },

  removeToast(id: string) {
    activeToasts = activeToasts.filter(t => t.id !== id);
    this.notify([...activeToasts]);
  },

  requestPermission() {
    try {
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch (e) {
      console.warn('Notification permission request suppressed in iframe.');
    }
  },

  triggerAIAction(summary: string) {
    const settings = Storage.getSettings();
    if (!settings.notifications.aiActions) return;

    this.addToast({
      title: '✅ AI Assistant Autonomous Action',
      message: summary,
      type: 'ai'
    });
  },

  startPeriodicChecks() {
    if (checkInterval) return;
    this.checkNow();
    checkInterval = setInterval(() => this.checkNow(), 10000); // Every 10s is plenty
  },

  checkNow() {
    const user = Storage.getUser();
    if (!user || !user.onboarded) return;

    const settings = Storage.getSettings();
    const now = new Date();
    const nowTime = now.getTime();

    const profTasks = Storage.getTasks('professional');
    const activeProfCount = profTasks.filter(t => !t.completed && !t.missed).length;

    let hasSettingsChanges = false;

    // 1. Professional Completion Logic (1-hour delay nudge)
    if (activeProfCount === 0) {
      if (!settings.allProfCompletedAt) {
        settings.allProfCompletedAt = now.toISOString();
        hasSettingsChanges = true;
      } else {
        const completedAt = new Date(settings.allProfCompletedAt).getTime();
        const diffMs = nowTime - completedAt;
        const oneHour = 60 * 60 * 1000;

        // If at least 1 hour has passed AND we haven't nudged for THIS completion period yet
        if (diffMs >= oneHour && settings.lastProfCompletionNudge !== settings.allProfCompletedAt) {
          const wishlist = Storage.getTasks('wishlist');
          const activeWishlistCount = wishlist.filter(w => !w.completed && !w.missed).length;

          if (activeWishlistCount > 0 && settings.notifications.wishlistNudge) {
            // Update immediately to prevent duplicate triggers while fetch is in progress
            settings.lastProfCompletionNudge = settings.allProfCompletedAt;
            hasSettingsChanges = true;

            const quote = getRandomQuote();
            this.addToast({
              title: '✨ Aspiration Nudge',
              message: `All professional tasks were finished an hour ago! "${quote}" You have ${activeWishlistCount} dreams on your wishlist.`,
              type: 'wishlist'
            });
          }
        }
      }
    }
 else {
      // If tasks exist, reset the completion tracking
      if (settings.allProfCompletedAt) {
        settings.allProfCompletedAt = undefined;
        settings.lastProfCompletionNudge = undefined;
        hasSettingsChanges = true;
      }
    }

    // 2. Weekly Wishlist Nudge (Independent, every 7 days)
    if (settings.notifications.wishlistNudge) {
      const lastNudgeStr = settings.lastWishlistNudge;
      const lastNudge = lastNudgeStr ? new Date(lastNudgeStr).getTime() : 0;
      const isWeekly = nowTime - lastNudge >= 7 * 24 * 60 * 60 * 1000;

      if (isWeekly) {
        const wishlist = Storage.getTasks('wishlist');
        const activeWishlistCount = wishlist.filter(w => !w.completed && !w.missed).length;
        
        if (activeWishlistCount > 0) {
          // Update immediately to prevent duplicate triggers
          settings.lastWishlistNudge = now.toISOString();
          hasSettingsChanges = true;

          const quote = getRandomQuote();
          this.addToast({
            title: '✨ Weekly Aspiration Nudge',
            message: `"${quote}" You have ${activeWishlistCount} dreams waiting on your wishlist!`,
            type: 'wishlist'
          });
        }
      }
    }

    if (hasSettingsChanges) {
      Storage.setSettings(settings);
    }

    // 2. Check Tasks & Events Deadlines
    const allTasks = [
      ...profTasks,
      ...Storage.getTasks('personal'),
      ...Storage.getTasks('events'),
      ...Storage.getTasks('wishlist')
    ];

    const tasksToMarkMissed: TaskItem[] = [];

    allTasks.forEach(task => {
      if (task.completed || task.missed) return;

      const deadlineStr = task.deadline || task.startTime || task.softDeadline;
      if (!deadlineStr) return;

      const deadline = new Date(deadlineStr).getTime();
      const diffMs = deadline - nowTime;
      const diffMins = Math.floor(diffMs / 60000);

      // Check Missed
      if (diffMs <= 0) {
        // ONLY alert if it was missed within the last 2 minutes (120,000 ms)
        // This ensures the notification is "immediate" as requested, and avoids spamming for old missed tasks
        const isRecentMiss = Math.abs(diffMs) < 120000;

        task.missed = true;
        task.missedAt = now.toISOString();
        tasksToMarkMissed.push(task);

        if (settings.notifications.missedAlerts && isRecentMiss) {
          const alertedIds = settings.alertedMissedTaskIds || [];
          if (!alertedIds.includes(task.id)) {
            settings.alertedMissedTaskIds = [...alertedIds, task.id];
            hasSettingsChanges = true;

            this.addToast({
              title: '😬 Deadline Missed!',
              message: `You missed "${task.title}". Want to reschedule?`,
              type: 'missed'
            });
          }
        }
      } 
      // Check 1-Hour Prior Alert (between 58 and 62 mins)
      else if (diffMins >= 58 && diffMins <= 62) {
        const alertedKey = `alerted_1hr_${task.id}`;
        if (!sessionStorage.getItem(alertedKey) && settings.notifications.deadlineAlerts) {
          sessionStorage.setItem(alertedKey, 'true');
          this.addToast({
            title: '⚠️ 1-Hour Deadline Alert',
            message: `Hurry! "${task.title}" deadline is in 1 hour.`,
            type: 'urgent'
          });
        }
      }
      // Event specific notifications
      else if (task.tab === 'events' && settings.notifications.eventReminders) {
        // At start time (within 2 mins)
        if (diffMins >= -2 && diffMins <= 2) {
          const alertedKey = `alerted_start_${task.id}`;
          if (!sessionStorage.getItem(alertedKey)) {
            sessionStorage.setItem(alertedKey, 'true');
            this.addToast({
              title: '📅 Event Starting Now!',
              message: `"${task.title}" is starting now.`,
              type: 'urgent'
            });
          }
        }
        // 1 hour before (up to 60 mins)
        else if (diffMins <= 60) {
          const alertedKey = `alerted_1hr_${task.id}`;
          if (!sessionStorage.getItem(alertedKey)) {
            sessionStorage.setItem(alertedKey, 'true');
            this.addToast({
              title: '📅 Event Reminder',
              message: `"${task.title}" starts in 1 hour.`,
              type: 'info'
            });
          }
        }
        // 24 hours before (up to 1440 mins)
        else if (diffMins <= 1440) {
          const alertedKey = `alerted_24hr_${task.id}`;
          if (!sessionStorage.getItem(alertedKey)) {
            sessionStorage.setItem(alertedKey, 'true');
            this.addToast({
              title: '📅 Event Reminder',
              message: `"${task.title}" starts in 24 hours.`,
              type: 'info'
            });
          }
        }
      }
    });

    if (tasksToMarkMissed.length > 0) {
      Storage.markTasksAsMissed(tasksToMarkMissed);
    }

    if (hasSettingsChanges) {
      Storage.setSettings(settings);
    }
  }
};
