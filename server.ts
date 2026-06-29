import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Google Auth Helper
function getGoogleAuth(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Authorization header missing');
  }
  const token = authHeader.split(' ')[1];
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return oauth2Client;
}

// Lazy AI Client Initialization
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({ apiKey });
}

// System instructions for the Jarvis/Notion AI Assistant
const ASSISTANT_SYSTEM_PROMPT = `You are "The Last-Minute Life Saver" AI Assistant — an elite, sophisticated personal productivity companion. Think Notion meets Jarvis. You are confident, futuristic, highly organized, proactive, and calm.

When analyzing user requests, you have access to their existing tasks and schedule.
You MUST output your response strictly as valid JSON matching this schema:
{
  "text": "Your conversational response here...",
  "proposals": [ // Optional array of tasks/events to suggest adding
    {
      "title": "Task Title",
      "tab": "professional" | "personal" | "events" | "wishlist",
      "estimatedMinutes": 60,
      "deadline": "2026-06-28T21:00:00.000Z",
      "notes": "Optional details",
      "location": "Optional location"
    }
  ],
  "conflictWarning": null | { // If you detect a scheduling conflict with existing tasks
    "conflictingTask": "Existing task title and time",
    "newProposal": "The new task title and time that conflicts",
    "suggestionText": "Smart advice on how to merge or resolve (e.g. combine errands on the same trip)"
  },
  "places": null | [ // If user asks for nearby cake shops, restaurants, or places
    {
      "id": "place_1",
      "name": "Ribbons & Balloons Cake Shop",
      "rating": 4.8,
      "address": "Shop 4, MG Road, Near Station, Panvel",
      "distance": "0.8 km",
      "isOpen": true,
      "url": "https://maps.google.com/?q=Ribbons+Balloons+Panvel"
    },
    {
      "id": "place_2",
      "name": "Monginis Cake Shop & Bakery",
      "rating": 4.6,
      "address": "Sector 17, New Panvel East",
      "distance": "1.2 km",
      "isOpen": true,
      "url": "https://maps.google.com/?q=Monginis+Panvel"
    },
    {
      "id": "place_3",
      "name": "Theobroma Patisserie",
      "rating": 4.9,
      "address": "Ormay Mall, Panvel Highway",
      "distance": "2.1 km",
      "isOpen": true,
      "url": "https://maps.google.com/?q=Theobroma+Panvel"
    }
  ]
}

SPECIAL BEHAVIOR RULES:
1. If user says "I want to throw a surprise birthday party for my friend tonight at 9 PM":
   Check their existing schedule. If they have a task like "Buy groceries" or "Grocery shopping" around 5 PM, return a conflictWarning comparing "Grocery shopping at 5 PM" with the party preparation errands (like picking up cake at 5 PM). Propose 4 clear subtasks for the party: ① Invite friends (1 hr) ② Order/pick up cake (by 5 PM) ③ Decorate hall (by 7 PM) ④ Get ready (by 8:30 PM).
2. If user clicks suggestion or asks to combine grocery and cake shop near Panvel:
   Suggest merging them into one errand trip. If they ask for cake shops near Panvel in person, populate the "places" array with top cake shops in Panvel.
3. If user asks about an uploaded document (e.g. contract or chemistry assignment):
   Answer clearly and intelligently based on the document text provided in context.
4. Always maintain your calm, capable Jarvis tone.`;

// Helper to retry AI requests on rate limits (429)
async function callAIWithRetry(fn: () => Promise<any>, retries = 5, delay = 5000): Promise<any> {
  try {
    return await fn();
  } catch (err: any) {
    // Check if err has code 429, or err.error.code is 429
    const errorCode = err.code || (err.error && err.error.code) || (err.message && err.message.includes('429') ? 429 : null);
    
    if (errorCode === 429 && retries > 0) {
      // Try to parse retry delay from error details
      let retryDelay = delay;
      if (err.details && Array.isArray(err.details)) {
        const retryInfo = err.details.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
        if (retryInfo && retryInfo.retryDelay) {
          const match = retryInfo.retryDelay.match(/(\d+)s/);
          if (match) {
            retryDelay = parseInt(match[1]) * 1000;
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return callAIWithRetry(fn, retries - 1, retryDelay * 2);
    }
    throw err;
  }
}

// API Route: AI Chat Assistant
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, userContext, allTasks } = req.body;
    const ai = getAIClient();

    // Build context summary
    const scheduleSummary = (allTasks || []).map((t: any) => 
      `- [${t.tab.toUpperCase()}] "${t.title}" ${t.deadline ? `(Deadline: ${t.deadline})` : ''} ${t.timeOfDay ? `(Time: ${t.timeOfDay})` : ''} [Completed: ${t.completed}]`
    ).join('\n');

    const prompt = `CURRENT USER CONTEXT:\n${userContext || 'No specific context'}\n\nEXISTING TASKS & SCHEDULE:\n${scheduleSummary || 'No tasks scheduled yet.'}\n\nCONVERSATION HISTORY:\n${messages.map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n')}\n\nRespond as The Last-Minute Life Saver assistant in strict JSON matching the required schema.`;

    const response = await callAIWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: ASSISTANT_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
      }
    }));

    const textOutput = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(textOutput);
    } catch (e) {
      parsed = { text: textOutput };
    }

    res.json(parsed);
  } catch (err: any) {
    res.json({ text: "I'm having trouble connecting to my AI brain right now. Please try again in a moment." });
  }
});

// API Route: AI Smart Sorting
app.post('/api/ai/sort', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!tasks || tasks.length === 0) {
      return res.json({ sortedIds: [], reasoning: 'No active tasks to sort.' });
    }
    const ai = getAIClient();

    const taskList = tasks.map((t: any) => 
      `ID: "${t.id}", Title: "${t.title}", Deadline: "${t.deadline || 'None'}", EstimatedMins: ${t.estimatedMinutes || 60}, AITargetMins: ${t.aiTargetMinutes || 48}`
    ).join('\n');

    const prompt = `You are an elite productivity AI. Analyze the following professional tasks and sort them by strict urgency, deadline proximity, and strategic complexity.
Tasks:
${taskList}

Return strict JSON:
{
  "sortedIds": ["id1", "id2", ...],
  "reasoning": "Brief 1-sentence Jarvis explanation of why this order optimizes the user's focus."
}`;

    const response = await callAIWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    }));

    res.json(JSON.parse(response.text || '{"sortedIds":[]}'));
  } catch (err: any) {
    res.json({ sortedIds: [] });
  }
});

// API Route: AI Motivational Quote
app.post('/api/ai/quote', async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getAIClient();
    const response = await callAIWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Generate a single short, inspiring, sophisticated motivational quote (under 20 words) for a productivity assistant app named "The Last-Minute Life Saver". Context: ${prompt || 'General focus'}. Return ONLY the quote text without quotes.`
    }));
    res.json({ quote: response.text?.trim() || "Action is the foundational key to all success." });
  } catch (err: any) {
    res.json({ quote: "Small daily improvements over time lead to stunning results." });
  }
});

// API Route: 80-90% Time Buffer Rule Calculator
app.post('/api/ai/buffer', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!tasks || tasks.length < 3) {
      return res.json({ applicable: false, message: 'Requires 3+ tasks without deadlines.' });
    }
    const ai = getAIClient();
    const taskList = tasks.map((t: any) => `${t.title} (${t.estimatedMinutes || 1440} mins)`).join(', ');

    const response = await callAIWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Analyze these tasks without deadlines: ${taskList}.
Calculate an exact buffer percentage (between 80% and 90%) to save time.
Return strict JSON:
{
  "bufferPercent": 82,
  "summaryBanner": "Complete all tasks 1 day ahead of your estimates."
}`,
      config: { responseMimeType: 'application/json' }
    }));
    res.json(JSON.parse(response.text || '{"bufferPercent": 85}'));
  } catch (err: any) {
    res.json({ bufferPercent: 85, summaryBanner: "AI target active: finishing 15% ahead of schedule." });
  }
});

// API Route: Google Calendar Sync
app.post('/api/calendar/add', async (req, res) => {
  try {
    const auth = getGoogleAuth(req);
    const { title, location, startTime, endTime, notes } = req.body;
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: title,
      location: location || '',
      description: notes || '',
      start: {
        dateTime: startTime, // ISO string (e.g. 2026-06-29T09:00:00Z)
      },
      end: {
        dateTime: endTime, // ISO string
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    res.json({ success: true, googleEventId: response.data.id });
  } catch (err: any) {
    console.error('Calendar Add Error:', err);
    if (err.code === 401 || err.message?.includes('authentication') || err.message?.includes('credentials')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/calendar/update', async (req, res) => {
  try {
    const auth = getGoogleAuth(req);
    const { googleEventId, title, location, startTime, endTime, notes } = req.body;
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: title,
      location: location || '',
      description: notes || '',
      start: {
        dateTime: startTime,
      },
      end: {
        dateTime: endTime,
      },
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: event,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Calendar Update Error:', err);
    if (err.code === 404 || err.code === 410) {
      return res.status(410).json({ success: false, error: 'Event not found on Google Calendar', code: 'EVENT_NOT_FOUND' });
    }
    if (err.code === 401 || err.message?.includes('authentication') || err.message?.includes('credentials')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/calendar/delete', async (req, res) => {
  try {
    const auth = getGoogleAuth(req);
    const { googleEventId } = req.body;
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Calendar Delete Error:', err);
    // If the resource is already deleted (410) or not found (404), we consider it a success
    if (err.code === 404 || err.code === 410) {
      return res.json({ success: true, alreadyDeleted: true });
    }
    if (err.code === 401 || err.message?.includes('authentication') || err.message?.includes('credentials')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/calendar/list', async (req, res) => {
  try {
    const auth = getGoogleAuth(req);
    const calendar = google.calendar({ version: 'v3', auth });
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json({ events: response.data.items });
  } catch (err: any) {
    console.error('Calendar List Error:', err);
    if (err.code === 401 || err.message?.includes('authentication') || err.message?.includes('credentials')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mount Vite middleware in development or serve static files in production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Jarvis Core] Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
