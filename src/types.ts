export type TabType = 'all' | 'professional' | 'personal' | 'events' | 'wishlist';

export type TimeUnit = 'minutes' | 'hours' | 'days';

export type RecurrenceType = 'one-time' | 'daily' | 'weekly' | 'custom';

export type EventType = 'Meeting' | 'Birthday/Party' | 'Other';

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string;
  content?: string; // Text extracted or mock content for AI Q&A
}

export interface TaskItem {
  id: string;
  tab: 'professional' | 'personal' | 'events' | 'wishlist';
  title: string;
  deadline?: string; // ISO string or empty
  hasDeadline: boolean;
  maxTimeValue?: number;
  maxTimeUnit?: TimeUnit;
  estimatedMinutes?: number; // Total estimated minutes
  aiTargetMinutes?: number; // 80-90% buffered target in minutes
  bufferSavedMinutes?: number; // Difference
  notes?: string;
  attachments?: Attachment[];
  completed: boolean;
  completedAt?: string;
  missed: boolean;
  missedAt?: string;
  createdAt: string;
  googleEventId?: string;
  isUrgent?: boolean;
  // Personal specific
  recurrence?: RecurrenceType;
  customDays?: string[];
  timeOfDay?: string; // HH:mm
  // Event specific
  eventType?: EventType;
  location?: string;
  startTime?: string;
  endTime?: string;
  // Wishlist specific
  softDeadline?: string;
}

export interface UserProfile {
  name: string;
  email?: string;
  dob: string; // YYYY-MM-DD
  age?: number;
  onboarded: boolean;
  calendarConnected: boolean;
}

export interface AppSettings {
  storageDurationDays: number; // 7 | 15 | 30
  notifications: {
    deadlineAlerts: boolean;
    missedAlerts: boolean;
    eventReminders: boolean;
    wishlistNudge: boolean;
    aiActions: boolean;
    birthdayWish: boolean;
  };
  askMaxTimeConfirmation: boolean;
  theme: 'dark' | 'light';
  lastWishlistNudge?: string;
  lastProfCompletionNudge?: string;
  allProfCompletedAt?: string;
  alertedMissedTaskIds?: string[];
  lastBirthdayShown?: string;
}

export interface AIMapPlace {
  id: string;
  name: string;
  rating: number;
  address: string;
  distance?: string;
  isOpen?: boolean;
  url?: string;
}

export interface AITaskProposal {
  title: string;
  tab: 'professional' | 'personal' | 'events' | 'wishlist';
  estimatedMinutes: number;
  deadline?: string;
  notes?: string;
  location?: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isLoading?: boolean;
  loadingStep?: string;
  proposals?: AITaskProposal[];
  conflictWarning?: {
    conflictingTask: string;
    newProposal: string;
    suggestionText?: string;
  };
  places?: AIMapPlace[];
}
