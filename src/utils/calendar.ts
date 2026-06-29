import { TaskItem } from '../types';

declare global {
  interface Window {
    getOAuthToken: () => Promise<string | null>;
  }
}

export const CalendarEngine = {
  async getToken(): Promise<string | null> {
    if (typeof window.getOAuthToken === 'function') {
      try {
        return await window.getOAuthToken();
      } catch (err) {
        console.error('Failed to get OAuth token:', err);
        return null;
      }
    }
    return null;
  },

  async listEvents(): Promise<any[]> {
    const token = await this.getToken();
    if (!token) return [];

    try {
      const res = await fetch('/api/calendar/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('lmls_google_token');
        throw new Error('Unauthorized');
      }
      if (!res.ok) throw new Error('Failed to fetch calendar events');
      const data = await res.json();
      return data.events || [];
    } catch (err: any) {
      console.error('Calendar List Error:', err);
      if (err.message === 'Unauthorized') throw err;
      return [];
    }
  },

  async addToCalendar(task: TaskItem): Promise<string | null> {
    const token = await this.getToken();
    if (!token) return null;

    try {
      console.log(`[CalendarEngine] Adding event: ${task.title} at ${task.startTime}`);
      const res = await fetch('/api/calendar/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: task.title,
          location: task.location,
          startTime: task.startTime,
          endTime: task.endTime,
          notes: task.notes
        })
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('lmls_google_token');
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[CalendarEngine] Add failed: ${res.status}`, errText);
        throw new Error('Failed to add event');
      }
      const data = await res.json();
      console.log(`[CalendarEngine] Added successfully. GID: ${data.googleEventId}`);
      return data.googleEventId || null;
    } catch (err: any) {
      console.error('Calendar Add Error:', err);
      if (err.message === 'Unauthorized') throw err;
      return null;
    }
  },

  async updateInCalendar(task: TaskItem): Promise<boolean> {
    if (!task.googleEventId) return false;
    const token = await this.getToken();
    if (!token) return false;

    try {
      console.log(`[CalendarEngine] Updating event: ${task.googleEventId}`);
      const res = await fetch('/api/calendar/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          googleEventId: task.googleEventId,
          title: task.title,
          location: task.location,
          startTime: task.startTime,
          endTime: task.endTime,
          notes: task.notes
        })
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('lmls_google_token');
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`[CalendarEngine] Update failed: ${res.status}`, errData);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('Calendar Update Error:', err);
      if (err.message === 'Unauthorized') throw err;
      return false;
    }
  },

  async deleteFromCalendar(googleEventId: string): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    try {
      console.log(`[CalendarEngine] Deleting event: ${googleEventId}`);
      const res = await fetch('/api/calendar/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ googleEventId })
      });
      if (res.status === 401) {
        if (typeof window !== 'undefined') sessionStorage.removeItem('lmls_google_token');
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        // If the event was already deleted (404 Not Found or 410 Gone), treat as success
        if (res.status === 404 || res.status === 410) {
          console.log(`[CalendarEngine] Event ${googleEventId} already deleted (status: ${res.status}).`);
          return true;
        }
        const errData = await res.json().catch(() => ({}));
        console.error(`[CalendarEngine] Delete failed: ${res.status}`, errData);
        return false;
      }
      return true;
    } catch (err: any) {
      // If the error indicates the resource is already gone, treat as success
      const errMessage = (err.message || '').toString();
      const errString = err.toString();
      const status = err.response?.status;
      
      if (errMessage.includes('Resource has been deleted') || 
          errString.includes('Resource has been deleted') ||
          errMessage.includes('404') ||
          errMessage.includes('410') ||
          status === 404 ||
          status === 410) {
        console.log(`[CalendarEngine] Event ${googleEventId} already deleted or not found (status: ${status}).`);
        return true;
      }
      console.error('Calendar Delete Error:', err);
      if (err.message === 'Unauthorized') throw err;
      return false;
    }
  }
};
