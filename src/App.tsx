import React, { useState, useEffect } from 'react';
import { UserProfile, AppSettings, TabType, TaskItem, AITaskProposal } from './types';
import { Storage } from './utils/storage';
import { NotificationEngine } from './utils/notifications';

import { Header } from './components/Header';
import { NavBar } from './components/NavBar';
import { Footer } from './components/Footer';
import { OnboardingModal } from './components/OnboardingModal';
import { BirthdayModal } from './components/BirthdayModal';
import { SettingsModal } from './components/SettingsModal';
import { ToastContainer } from './components/ToastContainer';

import { TaskModal } from './components/modals/TaskModal';

import { AllTab } from './components/tabs/AllTab';
import { ProfessionalTab } from './components/tabs/ProfessionalTab';
import { PersonalTab } from './components/tabs/PersonalTab';
import { EventsTab } from './components/tabs/EventsTab';
import { WishlistTab } from './components/tabs/WishlistTab';
import { endOfMonth } from 'date-fns';

import { CalendarEngine } from './utils/calendar';
import { initAuth, googleSignIn, logout } from './utils/auth';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => Storage.getUser());
  const [settings, setSettings] = useState<AppSettings>(() => Storage.getSettings());
  const [activeTab, setActiveTab] = useState<TabType>('professional');

  const [tasks, setTasks] = useState<Record<'professional' | 'personal' | 'events' | 'wishlist', TaskItem[]>>({
    professional: [],
    personal: [],
    events: [],
    wishlist: []
  });

  // Modal controls
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [activeAddModal, setActiveAddModal] = useState<'professional' | 'personal' | 'events' | 'wishlist' | null>(null);
  const [initialAddDate, setInitialAddDate] = useState<string | undefined>(undefined);
  const [activeEditTask, setActiveEditTask] = useState<TaskItem | null>(null);

  // Load initial data
  useEffect(() => {
    Storage.seedDefaultDemoDataIfEmpty();
    Storage.cleanOldItems();

    // Init Auth
    initAuth();

    const currentSettings = Storage.getSettings();
    if (currentSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }

    const loadedUser = Storage.getUser();
    if (!loadedUser || !loadedUser.onboarded) {
      setShowOnboarding(true);
    } else {
      setUser(loadedUser);
      checkBirthday(loadedUser, currentSettings);
      if (loadedUser.calendarConnected) {
        handleRefreshCalendar(false);
      }
    }

    reloadAllTasks();
  }, []);

  const reloadAllTasks = () => {
    setTasks({
      professional: Storage.getTasks('professional'),
      personal: Storage.getTasks('personal'),
      events: Storage.getTasks('events'),
      wishlist: Storage.getTasks('wishlist')
    });
  };

  // Notification engine loop
  useEffect(() => {
    NotificationEngine.startPeriodicChecks();

    const handleStorageUpdate = () => {
      const u = Storage.getUser();
      const s = Storage.getSettings();
      setUser(u);
      setSettings(s);
      reloadAllTasks();
    };
    window.addEventListener('lmls_storage_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('lmls_storage_updated', handleStorageUpdate);
    };
  }, []);

  // Auto-sync calendar when connected
  useEffect(() => {
    if (user?.calendarConnected) {
      handleRefreshCalendar(false);
    }
  }, [user?.calendarConnected]);

  const checkBirthday = (currUser: UserProfile | null | undefined, currSettings: AppSettings) => {
    if (!currUser || !currUser.dob || !currSettings.notifications.birthdayWish) return;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayMMDD = todayStr.substring(5);
    const dobMMDD = currUser.dob.substring(5);

    if (todayMMDD === dobMMDD && currSettings.lastBirthdayShown !== todayStr) {
      setShowBirthday(true);
    }
  };

  const handleOnboardComplete = () => {
    const newUser = Storage.getUser();
    if (!newUser) return;
    setUser(newUser);
    setShowOnboarding(false);
    Storage.seedDefaultDemoDataIfEmpty();
    reloadAllTasks();
    checkBirthday(newUser, settings);
    if (newUser.calendarConnected) {
      handleRefreshCalendar();
    }
    NotificationEngine.addToast({ title: 'Welcome Aboard! 🚀', message: `Glad to have you, ${newUser.name}. The Last-Minute Life Saver is active!`, type: 'info' });
  };

  const handleUpdateTasks = (tab: 'professional' | 'personal' | 'events' | 'wishlist', updatedList: TaskItem[]) => {
    Storage.setTasks(tab, updatedList);
    setTasks(prev => ({ ...prev, [tab]: updatedList }));
  };

  const handleAddTask = (tab: 'professional' | 'personal' | 'events' | 'wishlist', date?: string) => {
    setInitialAddDate(date);
    setActiveAddModal(tab);
  };

  const handleDeleteTask = async (tab: 'professional' | 'personal' | 'events' | 'wishlist', id: string) => {
    let taskTitle = 'Item';
    
    setTasks(prev => {
      const taskToDelete = prev[tab].find(t => t.id === id);
      if (taskToDelete) {
        taskTitle = taskToDelete.title;
        
        // Google Calendar Sync
        if (tab === 'events' && taskToDelete.googleEventId) {
          CalendarEngine.getToken().then(token => {
            if (token) {
              CalendarEngine.deleteFromCalendar(taskToDelete.googleEventId!).catch((err: any) => {
                if (err.message === 'Unauthorized') {
                  const u = Storage.getUser();
                  if (u) Storage.setUser({ ...u, calendarConnected: false });
                }
              });
            }
          });
        }
      }

      const updated = prev[tab].filter(t => t.id !== id);
      Storage.setTasks(tab, updated);
      return { ...prev, [tab]: updated };
    });

    Storage.removeCompleted(id);
    Storage.removeMissed(id);
    NotificationEngine.addToast({ title: 'Item Deleted', message: `Removed "${taskTitle}" successfully.`, type: 'info' });
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    Storage.setSettings(newSettings);
    setSettings(newSettings);
    Storage.cleanOldItems();
    if (newSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  const handleAICreateTask = (proposal: AITaskProposal) => {
    const tab = proposal.tab || 'professional';
    const currList = tasks[tab] || [];

    const now = new Date().toISOString();
    let aiTarget = proposal.estimatedMinutes;
    let bufferSaved = 0;

    if (tab === 'professional' && proposal.estimatedMinutes > 0) {
      aiTarget = Math.round(proposal.estimatedMinutes * 0.8);
      bufferSaved = proposal.estimatedMinutes - aiTarget;
    }

    const newItem: TaskItem = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tab,
      title: proposal.title,
      hasDeadline: !!proposal.deadline,
      deadline: proposal.deadline,
      estimatedMinutes: proposal.estimatedMinutes,
      aiTargetMinutes: aiTarget,
      bufferSavedMinutes: bufferSaved,
      notes: proposal.notes || 'Created via Gemini AI Assistant',
      location: proposal.location,
      completed: false,
      missed: false,
      createdAt: now
    };

    const updated = [newItem, ...currList];
    handleUpdateTasks(tab, updated);
    NotificationEngine.addToast({ title: 'AI Task Added ⚡', message: `Added "${proposal.title}" to ${tab.toUpperCase()} tab.`, type: 'success' });
  };

  const handleAISortTasks = (sortedProfessional: TaskItem[]) => {
    handleUpdateTasks('professional', sortedProfessional);
  };

  const handleRefreshCalendar = async (isManual = false) => {
    if (!user || isSyncingCalendar) return;
    
    // If not manual and not connected, don't auto-sync
    if (!isManual && !user.calendarConnected) return;
    
    try {
      let token = await CalendarEngine.getToken();
      if (!token) {
        // If we're on the events tab and it's a manual click, we MUST have a token.
        // Otherwise, we skip background sync to avoid annoying popups.
        if (!isManual && activeTab !== 'events') {
          console.log('Calendar sync skipped: No active token and not on events tab.');
          return;
        }

        // If manual OR on events tab, we might need to prompt for sign-in if token is missing
        if (isManual) {
          const result = await googleSignIn();
          if (result && result.accessToken) {
            token = result.accessToken;
            // Update user state immediately to reflect connection
            setUser(prev => prev ? { ...prev, calendarConnected: true } : null);
          } else {
            throw new Error('Authentication required');
          }
        } else {
          // Background sync failed to find token, just silent exit
          return;
        }
      }

      setIsSyncingCalendar(true);
      if (isManual) {
        NotificationEngine.addToast({ title: 'Syncing Calendar...', message: 'Updating your schedule from Google.', type: 'info' });
      }
      const gEvents = await CalendarEngine.listEvents();
      console.log(`[CalendarSync] Fetched ${gEvents.length} events from Google.`);
      
      const localEvents = tasks.events;
      const gEventMap = new Map(gEvents.map(ge => [ge.id, ge]));
      const existingIds = new Set(localEvents.map(e => e.googleEventId).filter(Boolean));

      let updatedCount = 0;
      let addedCount = 0;

      // 1. Update existing
      const mergedEvents = localEvents.map(le => {
        if (le.googleEventId && gEventMap.has(le.googleEventId)) {
          const ge = gEventMap.get(le.googleEventId);
          updatedCount++;
          return {
            ...le,
            title: ge.summary || le.title,
            deadline: ge.start?.dateTime || ge.start?.date || le.deadline,
            startTime: ge.start?.dateTime || ge.start?.date || le.startTime,
            endTime: ge.end?.dateTime || ge.end?.date || le.endTime,
            location: ge.location || le.location,
            notes: ge.description || le.notes
          };
        }
        return le;
      });

      // 2. Remove events that were deleted from Google Calendar
      const currentGoogleIds = new Set(gEvents.map(ge => ge.id));
      const syncedEvents = mergedEvents.filter(le => {
        if (le.googleEventId && !currentGoogleIds.has(le.googleEventId)) {
          return false;
        }
        return true;
      });

      // 3. Add new
      const newItems: TaskItem[] = [];
      gEvents.forEach((ge: any) => {
        if (!existingIds.has(ge.id)) {
          addedCount++;
          newItems.push({
            id: `cal_${ge.id}_${Date.now()}`,
            googleEventId: ge.id,
            tab: 'events',
            title: ge.summary || 'Google Calendar Event',
            hasDeadline: true,
            deadline: ge.start?.dateTime || ge.start?.date,
            startTime: ge.start?.dateTime || ge.start?.date,
            endTime: ge.end?.dateTime || ge.end?.date,
            eventType: 'Meeting',
            location: ge.location || '',
            notes: ge.description || 'Synchronized from Google Calendar',
            completed: false,
            missed: false,
            createdAt: ge.created || new Date().toISOString()
          });
        }
      });

      const finalEvents = [...newItems, ...syncedEvents];
      handleUpdateTasks('events', finalEvents);
      
      console.log(`[CalendarSync] Done. Added: ${addedCount}, Updated: ${updatedCount}. Total: ${finalEvents.length}`);

      if (addedCount > 0 || updatedCount > 0) {
        NotificationEngine.addToast({ 
          title: 'Sync Successful 📅', 
          message: `Integrated ${addedCount} new items into your schedule.`, 
          type: 'success' 
        });
      } else {
        NotificationEngine.addToast({ title: 'Up to Date', message: 'Your schedule is currently in sync.', type: 'success' });
      }
    } catch (err: any) {
      console.error('Calendar Sync Error:', err);
      if (err.message === 'Unauthorized') {
        NotificationEngine.addToast({ title: 'Authentication Expired', message: 'Please reconnect your Google Calendar in Settings.', type: 'error' });
        const user = Storage.getUser();
        if (user) {
          Storage.setUser({ ...user, calendarConnected: false });
        }
      } else if (err.code !== 'auth/popup-blocked' && err.code !== 'auth/cancelled-popup-request') {
        NotificationEngine.addToast({ title: 'Sync Failed', message: 'Could not connect to Google Calendar.', type: 'error' });
      }
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  // Badge counts
  const counts = (() => {
    const now = Date.now();
    const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
    const endOfThisMonth = endOfMonth(new Date()).getTime();

    const activeEventsNext7Days = tasks.events.filter(t => {
      if (t.completed || t.missed) return false;
      const dateStr = t.startTime || t.deadline || t.softDeadline;
      if (!dateStr) return false;
      try {
        const date = new Date(dateStr).getTime();
        return date >= now && date <= nextWeek;
      } catch (e) {
        return false;
      }
    });

    const activeEventsThisMonth = tasks.events.filter(t => {
      if (t.completed || t.missed) return false;
      const dateStr = t.startTime || t.deadline || t.softDeadline;
      if (!dateStr) return false;
      try {
        const date = new Date(dateStr).getTime();
        return date >= now && date <= endOfThisMonth;
      } catch (e) {
        return false;
      }
    });

    const profCount = tasks.professional.filter(t => !t.completed && !t.missed).length;
    const persCount = tasks.personal.filter(t => !t.completed && !t.missed).length;
    const wishCount = tasks.wishlist.filter(t => !t.completed && !t.missed).length;

    return {
      all: profCount + persCount + wishCount + activeEventsNext7Days.length,
      professional: profCount,
      personal: persCount,
      events: activeEventsThisMonth.length,
      wishlist: wishCount,
    };
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-slate-50 relative overflow-x-hidden">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          onOpenSettings={() => setShowSettings(true)}
        />

        <NavBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          counts={counts}
        />

        <main className="flex-1 w-full">
          {activeTab === 'all' && (
            <AllTab
              tasks={tasks}
              onSelectCategory={cat => setActiveTab(cat)}
              onOpenAddModal={() => setActiveAddModal('professional')}
              onOpenEditModal={setActiveEditTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === 'professional' && (
            <ProfessionalTab
              tasks={tasks.professional}
              onUpdateTasks={list => handleUpdateTasks('professional', list)}
              onDeleteTask={id => handleDeleteTask('professional', id)}
              onOpenAddModal={() => handleAddTask('professional')}
              onOpenEditModal={setActiveEditTask}
              onAICreateTask={handleAICreateTask}
              onAISortTasks={handleAISortTasks}
              askMaxTimeConfirmation={settings.askMaxTimeConfirmation}
            />
          )}

          {activeTab === 'personal' && (
            <PersonalTab
              tasks={tasks.personal}
              onUpdateTasks={list => handleUpdateTasks('personal', list)}
              onDeleteTask={id => handleDeleteTask('personal', id)}
              onOpenAddModal={() => setActiveAddModal('personal')}
              onOpenEditModal={setActiveEditTask}
            />
          )}

          {activeTab === 'events' && (
            <EventsTab
              tasks={tasks.events}
              onUpdateTasks={list => handleUpdateTasks('events', list)}
              onDeleteTask={id => handleDeleteTask('events', id)}
              onOpenAddModal={(date) => handleAddTask('events', date)}
              onOpenEditModal={setActiveEditTask}
              onRefreshCalendar={() => handleRefreshCalendar(true)}
              isSyncing={isSyncingCalendar}
            />
          )}

          {activeTab === 'wishlist' && (
            <WishlistTab
              tasks={tasks.wishlist}
              onUpdateTasks={list => handleUpdateTasks('wishlist', list)}
              onDeleteTask={id => handleDeleteTask('wishlist', id)}
              onOpenAddModal={() => setActiveAddModal('wishlist')}
              onOpenEditModal={setActiveEditTask}
            />
          )}
        </main>

        <Footer />
      </div>

      {/* Global Toast Overlay */}
      <ToastContainer />

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={handleOnboardComplete}
        />
      )}

      {showBirthday && user && (
        <BirthdayModal
          userName={user.name}
          onClose={() => {
            setShowBirthday(false);
            const now = new Date().toISOString().split('T')[0];
            const updated = { ...settings, lastBirthdayShown: now };
            handleSaveSettings(updated);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          isOpen={true}
          onClose={() => setShowSettings(false)}
          onSignOut={async () => {
            await logout();
            // Clear all LMLS related keys
            [
              'lmls_professional_tasks',
              'lmls_personal_reminders',
              'lmls_events',
              'lmls_wishlist',
              'lmls_settings',
              'lmls_completed',
              'lmls_missed',
              'lmls_user'
            ].forEach(key => localStorage.removeItem(key));
            sessionStorage.removeItem('lmls_google_token');
            setUser(null);
            setShowOnboarding(true);
            setShowSettings(false);
          }}
        />
      )}

      {/* Unified Item Modals (Add & Edit) */}
      {(activeAddModal || activeEditTask) && (
        <TaskModal
          isOpen={true}
          initialTask={activeEditTask}
          initialDate={initialAddDate}
          defaultTab={activeAddModal || undefined}
          onClose={() => {
            setActiveAddModal(null);
            setActiveEditTask(null);
            setInitialAddDate(undefined);
          }}
          onDelete={id => {
            const currentTab = activeEditTask?.tab;
            if (currentTab) {
              handleDeleteTask(currentTab, id);
            }
          }}
          onSave={async task => {
            const tabKey = task.tab;
            const isEditing = !!activeEditTask;
            let finalTask = { ...task };
            let syncError = false;

            // Google Calendar Sync for Events
            if (tabKey === 'events') {
              try {
                const token = await CalendarEngine.getToken();
                if (token) {
                  if (finalTask.googleEventId) {
                    await CalendarEngine.updateInCalendar(finalTask);
                  } else {
                    const gId = await CalendarEngine.addToCalendar(finalTask);
                    if (gId) {
                      finalTask.googleEventId = gId;
                    }
                  }
                }
              } catch (err: any) {
                console.error('Calendar sync failed:', err);
                syncError = true;
                if (err.message === 'Unauthorized') {
                  const u = Storage.getUser();
                  if (u) Storage.setUser({ ...u, calendarConnected: false });
                  NotificationEngine.addToast({ title: 'Authentication Expired', message: 'Please reconnect your Google Calendar.', type: 'error' });
                }
              }
            }

            setTasks(prev => {
              const oldTab = activeEditTask?.tab;
              const newTab = finalTask.tab;

              let updatedTasks = { ...prev };

              if (isEditing && oldTab && oldTab !== newTab) {
                // Category changed: remove from old, add to new
                updatedTasks[oldTab] = prev[oldTab].filter(t => t.id !== finalTask.id);
                updatedTasks[newTab] = [finalTask, ...prev[newTab]];
                Storage.setTasks(oldTab, updatedTasks[oldTab]);
                Storage.setTasks(newTab, updatedTasks[newTab]);
              } else if (isEditing) {
                // Same category: update in place
                updatedTasks[newTab] = prev[newTab].map(t => t.id === finalTask.id ? finalTask : t);
                Storage.setTasks(newTab, updatedTasks[newTab]);
              } else {
                // New task: add to category
                updatedTasks[newTab] = [finalTask, ...prev[newTab]];
                Storage.setTasks(newTab, updatedTasks[newTab]);
              }

              if (isEditing) Storage.removeMissed(finalTask.id);
              return updatedTasks;
            });

            setActiveAddModal(null);
            setActiveEditTask(null);
            setInitialAddDate(undefined);
            
            const action = isEditing ? 'Updated' : 'Created';
            NotificationEngine.addToast({ 
              title: `${task.tab.charAt(0).toUpperCase() + task.tab.slice(1)} ${action}`, 
              message: syncError && tabKey === 'events' 
                ? `${isEditing ? 'Refined' : 'Added'} "${task.title}" (Local only - sync failed).`
                : `${isEditing ? 'Refined' : 'Added'} "${task.title}".`,
              type: syncError && tabKey === 'events' ? 'error' : 'success'
            });
          }}
        />
      )}
    </div>
  );
}

