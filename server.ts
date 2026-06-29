import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/firebase';
import { doc, getDoc, getDocs, updateDoc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { GoogleGenAI, Type } from '@google/genai';

// Helper to convert due date + time to ISO string
function convertToISO(dueDate: string, dueTime?: string): string {
  if (!dueDate) return '';
  try {
    const [year, month, day] = dueDate.split('-').map(Number);
    let hour = 17; // 5 PM default
    let minute = 0;
    if (dueTime) {
      const match = dueTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hour = h;
        minute = m;
      }
    }
    const date = new Date(year, month - 1, day, hour, minute);
    return date.toISOString();
  } catch (err) {
    console.error("Error converting to ISO:", err);
    return '';
  }
}

// Google Tasks Sync Helper
async function performGoogleTasksSync(userId: string, taskId: string, accessToken: string) {
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error(`Task not found with ID: ${taskId}`);
  }

  const taskData = taskSnap.data();
  const existingGoogleTaskId = taskData.googleTaskId;
  const isCompleted = taskData.status === 'completed';

  let googleTaskId = existingGoogleTaskId;
  let actionTaken = 'create';

  if (existingGoogleTaskId && !existingGoogleTaskId.startsWith('gtask-')) {
    console.log(`[Server] Updating Google Task: ${existingGoogleTaskId}`);
    const response = await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks/${existingGoogleTaskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: existingGoogleTaskId,
        title: taskData.title,
        notes: taskData.description || '',
        due: taskData.dueDateTime || undefined,
        status: isCompleted ? 'completed' : 'needsAction'
      })
    });

    if (response.ok) {
      actionTaken = 'update';
    } else if (response.status === 404) {
      console.log(`[Server] Google Task ${existingGoogleTaskId} not found. Recreating...`);
      const recreateResponse = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskData.title,
          notes: taskData.description || '',
          due: taskData.dueDateTime || undefined,
          status: isCompleted ? 'completed' : 'needsAction'
        })
      });

      if (!recreateResponse.ok) {
        const errorText = await recreateResponse.text();
        throw new Error(`Google Tasks recreate API error: ${recreateResponse.status} - ${errorText}`);
      }

      const gtask = await recreateResponse.json();
      googleTaskId = gtask.id;
      actionTaken = 'recreate';

      await updateDoc(taskRef, {
        googleTaskId: googleTaskId,
        updatedAt: new Date().toISOString()
      });
    } else {
      const errorText = await response.text();
      throw new Error(`Google Tasks update API error: ${response.status} - ${errorText}`);
    }
  } else {
    console.log('[Server] Creating a new Google Task');
    const response = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: taskData.title,
        notes: taskData.description || '',
        due: taskData.dueDateTime || undefined,
        status: isCompleted ? 'completed' : 'needsAction'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Tasks create API error: ${response.status} - ${errorText}`);
    }

    const gtask = await response.json();
    googleTaskId = gtask.id;
    actionTaken = 'create';

    await updateDoc(taskRef, {
      googleTaskId: googleTaskId,
      updatedAt: new Date().toISOString()
    });
  }

  return { success: true, googleTaskId, action: actionTaken };
}

// Google Calendar Deadline Sync Helper
async function performCalendarDeadlineSync(userId: string, taskId: string, accessToken: string) {
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) {
    throw new Error(`Task not found with ID: ${taskId}`);
  }

  const taskData = taskSnap.data();
  const existingDeadlineEventId = taskData.deadlineEventId;
  const startDateTime = taskData.dueDateTime || new Date().toISOString();
  const endDateTime = new Date(new Date(startDateTime).getTime() + 30 * 60 * 1000).toISOString();

  let deadlineEventId = existingDeadlineEventId;
  let actionTaken = 'create';

  if (existingDeadlineEventId && !existingDeadlineEventId.startsWith('gcal-')) {
    console.log(`[Server] Updating Google Calendar event: ${existingDeadlineEventId}`);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingDeadlineEventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Deadline: ${taskData.title}`,
        description: taskData.description || '',
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime }
      })
    });

    if (response.ok) {
      actionTaken = 'update';
    } else if (response.status === 404) {
      console.log(`[Server] Google Calendar event ${existingDeadlineEventId} not found. Recreating...`);
      const recreateResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: `Deadline: ${taskData.title}`,
          description: taskData.description || '',
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime }
        })
      });

      if (!recreateResponse.ok) {
        const errorText = await recreateResponse.text();
        throw new Error(`Google Calendar recreate API error: ${recreateResponse.status} - ${errorText}`);
      }

      const event = await recreateResponse.json();
      deadlineEventId = event.id;
      actionTaken = 'recreate';

      await updateDoc(taskRef, {
        deadlineEventId: deadlineEventId,
        updatedAt: new Date().toISOString()
      });
    } else {
      const errorText = await response.text();
      throw new Error(`Google Calendar update API error: ${response.status} - ${errorText}`);
    }
  } else {
    console.log('[Server] Creating a new Google Calendar event');
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Deadline: ${taskData.title}`,
        description: taskData.description || '',
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar create API error: ${response.status} - ${errorText}`);
    }

    const event = await response.json();
    deadlineEventId = event.id;
    actionTaken = 'create';

    await updateDoc(taskRef, {
      deadlineEventId: deadlineEventId,
      updatedAt: new Date().toISOString()
    });
  }

  return { success: true, deadlineEventId, action: actionTaken };
}

// Tool Implementation: Create Task
async function handleCreateTaskTool(userId: string, args: any) {
  const taskId = `task-${Date.now()}`;
  const priorityScoreMap: Record<string, number> = { Low: 1, Normal: 2, High: 3, Urgent: 4 };
  const priority = args.priority || 'Normal';
  const dueDateTime = convertToISO(args.dueDate || '', args.dueTime || '');

  const taskData = {
    title: args.title,
    description: args.description || '',
    dueDate: args.dueDate || '',
    dueTime: args.dueTime || '',
    dueDateTime: dueDateTime || '',
    estimatedEffort: args.estimatedEffort || 1,
    tag: args.tag || 'General',
    priority: priority,
    priorityScore: priorityScoreMap[priority] ?? 2,
    status: 'pending',
    source: 'AutoClutch Agent',
    googleTaskId: null,
    deadlineEventId: null,
    focusEventIds: [],
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'users', userId, 'tasks', taskId), taskData);
  return { success: true, taskId, task: taskData };
}

// Tool Implementation: Update Task
async function handleUpdateTaskTool(userId: string, args: any) {
  const taskRef = doc(db, 'users', userId, 'tasks', args.id);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) {
    throw new Error(`Task with ID ${args.id} not found.`);
  }

  const existingTask = taskSnap.data();
  const updateData: any = { updatedAt: new Date().toISOString() };
  if (args.title !== undefined) updateData.title = args.title;
  if (args.description !== undefined) updateData.description = args.description;
  if (args.dueDate !== undefined) updateData.dueDate = args.dueDate;
  if (args.dueTime !== undefined) updateData.dueTime = args.dueTime;
  if (args.dueDate !== undefined || args.dueTime !== undefined) {
    const finalDueDate = args.dueDate !== undefined ? args.dueDate : existingTask.dueDate || '';
    const finalDueTime = args.dueTime !== undefined ? args.dueTime : existingTask.dueTime || '';
    updateData.dueDateTime = convertToISO(finalDueDate, finalDueTime);
  }
  if (args.estimatedEffort !== undefined) updateData.estimatedEffort = args.estimatedEffort;
  if (args.tag !== undefined) updateData.tag = args.tag;
  if (args.priority !== undefined) {
    updateData.priority = args.priority;
    const priorityScoreMap: Record<string, number> = { Low: 1, Normal: 2, High: 3, Urgent: 4 };
    updateData.priorityScore = priorityScoreMap[args.priority] ?? 2;
  }
  if (args.status !== undefined) updateData.status = args.status;

  await updateDoc(taskRef, updateData);
  return { success: true, taskId: args.id, updatedFields: updateData };
}

// Tool Implementation: Delete Task
async function handleDeleteTaskTool(userId: string, args: any, accessToken?: string) {
  const taskRef = doc(db, 'users', userId, 'tasks', args.id);
  const taskSnap = await getDoc(taskRef);
  if (!taskSnap.exists()) {
    throw new Error(`Task with ID ${args.id} not found.`);
  }
  const taskData = taskSnap.data();

  if (accessToken) {
    if (taskData.googleTaskId && !taskData.googleTaskId.startsWith('gtask-')) {
      try {
        await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks/${taskData.googleTaskId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } catch (e) {
        console.error("Failed to delete Google task via agent delete_task tool:", e);
      }
    }
    if (taskData.deadlineEventId && !taskData.deadlineEventId.startsWith('gcal-')) {
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${taskData.deadlineEventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      } catch (e) {
        console.error("Failed to delete Google Calendar event via agent delete_task tool:", e);
      }
    }
  }

  await deleteDoc(taskRef);
  return { success: true, taskId: args.id, title: taskData.title };
}

// Tool Implementation: Prioritize (0.40*urgency + 0.30*importance + 0.15*effort_fit - 0.15*slack)
async function handlePrioritizeTool(userId: string) {
  const tasksRef = collection(db, 'users', userId, 'tasks');
  const tasksSnap = await getDocs(tasksRef);
  const openTasks: any[] = [];
  tasksSnap.forEach(docSnap => {
    const t = docSnap.data();
    if (t.status !== 'completed') {
      openTasks.push({ id: docSnap.id, ...t });
    }
  });

  if (openTasks.length === 0) {
    return { success: true, message: "No open tasks to prioritize." };
  }

  const now = Date.now();
  const taskDetails = openTasks.map(t => {
    let dueTimeMs = now + 7 * 24 * 60 * 60 * 1000;
    if (t.dueDateTime) {
      dueTimeMs = new Date(t.dueDateTime).getTime();
    } else if (t.dueDate) {
      try {
        const iso = convertToISO(t.dueDate, t.dueTime || '5:00 PM');
        dueTimeMs = new Date(iso).getTime();
      } catch (e) {}
    }
    const timeRemainingHours = (dueTimeMs - now) / 3600000;
    const effort = t.estimatedEffort || 1;
    const slackHours = timeRemainingHours - effort;

    let importance = 4;
    if (t.priority === 'Urgent') importance = 10;
    else if (t.priority === 'High') importance = 7;
    else if (t.priority === 'Normal') importance = 4;
    else if (t.priority === 'Low') importance = 1;

    return {
      id: t.id,
      title: t.title,
      timeRemainingHours,
      importance,
      effort,
      slackHours
    };
  });

  const timeRemainings = taskDetails.map(d => d.timeRemainingHours);
  const minTimeRemaining = Math.min(...timeRemainings);
  const maxTimeRemaining = Math.max(...timeRemainings);

  const efforts = taskDetails.map(d => d.effort);
  const minEffort = Math.min(...efforts);
  const maxEffort = Math.max(...efforts);

  const slacks = taskDetails.map(d => d.slackHours);
  const minSlack = Math.min(...slacks);
  const maxSlack = Math.max(...slacks);

  const updatedTasks: any[] = [];

  for (const d of taskDetails) {
    let urgency = 5;
    if (maxTimeRemaining !== minTimeRemaining) {
      urgency = 10 * (1 - (d.timeRemainingHours - minTimeRemaining) / (maxTimeRemaining - minTimeRemaining));
    } else {
      urgency = d.timeRemainingHours <= 24 ? 10 : 5;
    }
    urgency = Math.max(0, Math.min(10, urgency));

    const importance = d.importance;

    let effort_fit = 5;
    if (maxEffort !== minEffort) {
      effort_fit = 10 * (1 - (d.effort - minEffort) / (maxEffort - minEffort));
    } else {
      effort_fit = d.effort <= 2 ? 10 : 5;
    }
    effort_fit = Math.max(0, Math.min(10, effort_fit));

    let slack = 5;
    if (maxSlack !== minSlack) {
      slack = 10 * (d.slackHours - minSlack) / (maxSlack - minSlack);
    } else {
      slack = d.slackHours >= 48 ? 10 : 5;
    }
    slack = Math.max(0, Math.min(10, slack));

    const score = 0.40 * urgency + 0.30 * importance + 0.15 * effort_fit - 0.15 * slack;
    const finalScore = Number(score.toFixed(2));

    await updateDoc(doc(db, 'users', userId, 'tasks', d.id), {
      priorityScore: finalScore,
      updatedAt: new Date().toISOString()
    });

    updatedTasks.push({ id: d.id, title: d.title, priorityScore: finalScore });
  }

  return { success: true, message: "Prioritized open tasks", updatedTasks };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Route: Sync Task with Google Tasks
  app.post('/api/tasks/sync', async (req, res) => {
    console.log('[Server] Received Sync Task Request:', req.body);
    const { taskId, userId, accessToken } = req.body;

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: taskId' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: userId' });
    }
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: accessToken' });
    }

    try {
      const syncResult = await performGoogleTasksSync(userId, taskId, accessToken);

      const taskSnap = await getDoc(doc(db, 'users', userId, 'tasks', taskId));
      const taskData = taskSnap.exists() ? taskSnap.data() : { title: taskId };

      const logId = `log-${Date.now()}`;
      await setDoc(doc(db, 'users', userId, 'agentLogs', logId), {
        step: 1,
        toolName: 'Google Tasks Sync',
        args: JSON.stringify({ taskId, googleTaskId: syncResult.googleTaskId, action: syncResult.action }),
        result: `Successfully ${syncResult.action === 'create' ? 'created' : syncResult.action === 'recreate' ? 'recreated' : 'updated'} Google Task: "${taskData.title}"`,
        ts: new Date().toISOString()
      });

      return res.json(syncResult);
    } catch (error: any) {
      console.error('[Server] Sync Task Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API Route: Delete Task
  app.post('/api/tasks/delete', async (req, res) => {
    console.log('[Server] Received Delete Task Request:', req.body);
    const { googleTaskId, userId, accessToken, title } = req.body;

    if (!googleTaskId || typeof googleTaskId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: googleTaskId' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: userId' });
    }
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: accessToken' });
    }

    try {
      if (!googleTaskId.startsWith('gtask-')) {
        await fetch(`https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks/${googleTaskId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      }

      const logId = `log-${Date.now()}`;
      await setDoc(doc(db, 'users', userId, 'agentLogs', logId), {
        step: 1,
        toolName: 'Google Tasks Delete',
        args: JSON.stringify({ googleTaskId }),
        result: `Successfully deleted Google Task: "${title || 'Untitled task'}"`,
        ts: new Date().toISOString()
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Server] Delete Task Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API Route: Create/Update Google Calendar Deadline Event
  app.post('/api/calendar/deadline/sync', async (req, res) => {
    console.log('[Server] Received Sync Calendar Deadline Request:', req.body);
    const { taskId, userId, accessToken } = req.body;

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: taskId' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: userId' });
    }
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: accessToken' });
    }

    try {
      const syncResult = await performCalendarDeadlineSync(userId, taskId, accessToken);

      const taskSnap = await getDoc(doc(db, 'users', userId, 'tasks', taskId));
      const taskData = taskSnap.exists() ? taskSnap.data() : { title: taskId };

      const logId = `log-${Date.now()}`;
      await setDoc(doc(db, 'users', userId, 'agentLogs', logId), {
        step: 1,
        toolName: 'Google Calendar Sync',
        args: JSON.stringify({ taskId, deadlineEventId: syncResult.deadlineEventId, action: syncResult.action }),
        result: `Successfully ${syncResult.action === 'create' ? 'created' : syncResult.action === 'recreate' ? 'recreated' : 'updated'} Calendar deadline reminder: "Deadline: ${taskData.title}"`,
        ts: new Date().toISOString()
      });

      return res.json(syncResult);
    } catch (error: any) {
      console.error('[Server] Sync Calendar Deadline Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API Route: Delete Calendar Deadline
  app.post('/api/calendar/deadline/delete', async (req, res) => {
    console.log('[Server] Received Delete Calendar Deadline Request:', req.body);
    const { deadlineEventId, userId, accessToken, title } = req.body;

    if (!deadlineEventId || typeof deadlineEventId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: deadlineEventId' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: userId' });
    }
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: accessToken' });
    }

    try {
      if (!deadlineEventId.startsWith('gcal-')) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${deadlineEventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
      }

      const logId = `log-${Date.now()}`;
      await setDoc(doc(db, 'users', userId, 'agentLogs', logId), {
        step: 1,
        toolName: 'Google Calendar Delete',
        args: JSON.stringify({ deadlineEventId }),
        result: `Successfully deleted Calendar event: "Deadline: ${title || 'Untitled event'}"`,
        ts: new Date().toISOString()
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Server] Delete Calendar Deadline Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // API Route: Real Server-Side Bounded Agent Loop (Max 8 Steps) using gemini-3.5-flash
  app.post('/api/agent/run', async (req, res) => {
    console.log('[Server] Running Agent Loop for:', req.body);
    const { prompt, userId, accessToken } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: prompt' });
    }
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameter: userId' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY environment variable is required' });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      // Function Declarations
      const create_task_decl = {
        name: 'create_task',
        description: 'Create a new task with details such as title, description, due date/time, estimated effort, tags, and priority.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'The title of the task. (Required)' },
            description: { type: Type.STRING, description: 'The detailed description of the task.' },
            dueDate: { type: Type.STRING, description: 'The due date in YYYY-MM-DD format.' },
            dueTime: { type: Type.STRING, description: 'The due time, e.g., "11:59 PM" or "2:00 PM".' },
            estimatedEffort: { type: Type.NUMBER, description: 'The estimated effort in hours.' },
            tag: { type: Type.STRING, description: 'Category tag of the task (e.g. Assignment, Project, Exam, Reading, Admin, Personal).' },
            priority: { type: Type.STRING, description: 'Priority level of the task. Allowed values: "Low", "Normal", "High", "Urgent".' }
          },
          required: ['title']
        }
      };

      const update_task_decl = {
        name: 'update_task',
        description: 'Update an existing task\'s details.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The database ID of the task to update. (Required)' },
            title: { type: Type.STRING, description: 'The updated title of the task.' },
            description: { type: Type.STRING, description: 'The updated description.' },
            dueDate: { type: Type.STRING, description: 'The updated due date in YYYY-MM-DD format.' },
            dueTime: { type: Type.STRING, description: 'The updated due time, e.g., "11:59 PM".' },
            estimatedEffort: { type: Type.NUMBER, description: 'The updated estimated effort in hours.' },
            tag: { type: Type.STRING, description: 'The updated category tag.' },
            priority: { type: Type.STRING, description: 'The updated priority level: "Low", "Normal", "High", "Urgent".' },
            status: { type: Type.STRING, description: 'The task status: "pending" or "completed".' }
          },
          required: ['id']
        }
      };

      const delete_task_decl = {
        name: 'delete_task',
        description: 'Delete an existing task from Firestore.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: 'The database ID of the task to delete. (Required)' }
          },
          required: ['id']
        }
      };

      const sync_to_google_tasks_decl = {
        name: 'sync_to_google_tasks',
        description: 'Syncs a task to Google Tasks. Generates or updates the task in the user\'s primary task list.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: { type: Type.STRING, description: 'The database ID of the task to sync. (Required)' }
          },
          required: ['taskId']
        }
      };

      const write_calendar_deadline_decl = {
        name: 'write_calendar_deadline',
        description: 'Creates or updates a deadline reminder event on the user\'s Google Calendar for a task.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            taskId: { type: Type.STRING, description: 'The database ID of the task. (Required)' }
          },
          required: ['taskId']
        }
      };

      const prioritize_decl = {
        name: 'prioritize',
        description: 'Recomputes priority scores for all open tasks based on the formula: 0.40*urgency + 0.30*importance + 0.15*effort_fit - 0.15*slack, and updates them in the database.',
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      };

      let step = 1;
      const maxSteps = 8;
      const conversationHistory: any[] = [
        { role: 'user', parts: [{ text: prompt }] }
      ];

      while (step <= maxSteps) {
        console.log(`[Server] Calling Gemini - Step ${step}`);
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: conversationHistory,
          config: {
            systemInstruction: 'You are AutoClutch, an autonomous agentic productivity companion. You help users manage tasks, sync them to Google Tasks, schedule deadline reminders on Google Calendar, and prioritize their workload. Use the available tools when requested to carry out actions. Perform tools as needed, and call prioritize to recompute scores. Break down actions sequentially. You must only call one tool at a time (or multiple if appropriate), execute them, and feed the results back. Limit your planning to at most 8 steps.',
            tools: [{
              functionDeclarations: [
                create_task_decl,
                update_task_decl,
                delete_task_decl,
                sync_to_google_tasks_decl,
                write_calendar_deadline_decl,
                prioritize_decl
              ]
            }]
          }
        });

        const functionCalls = response.functionCalls;
        const assistantContent = response.candidates?.[0]?.content;
        if (assistantContent) {
          conversationHistory.push(assistantContent);
        }

        if (!functionCalls || functionCalls.length === 0) {
          console.log('[Agent] Loop complete. No more function calls.');
          break;
        }

        const toolOutputs: any[] = [];
        for (const call of functionCalls) {
          const name = call.name;
          const args = call.args as any;
          const id = call.id;
          console.log(`[Agent] Executing tool: ${name} with args:`, args);

          let result: any;
          try {
            if (name === 'create_task') {
              if (!args.title) throw new Error("Missing 'title' parameter for create_task");
              result = await handleCreateTaskTool(userId, args);
            } else if (name === 'update_task') {
              if (!args.id) throw new Error("Missing 'id' parameter for update_task");
              result = await handleUpdateTaskTool(userId, args);
            } else if (name === 'delete_task') {
              if (!args.id) throw new Error("Missing 'id' parameter for delete_task");
              result = await handleDeleteTaskTool(userId, args, accessToken);
            } else if (name === 'sync_to_google_tasks') {
              if (!args.taskId) throw new Error("Missing 'taskId' parameter for sync_to_google_tasks");
              if (!accessToken) throw new Error("Google access token required to sync to Google Tasks");
              result = await performGoogleTasksSync(userId, args.taskId, accessToken);
            } else if (name === 'write_calendar_deadline') {
              if (!args.taskId) throw new Error("Missing 'taskId' parameter for write_calendar_deadline");
              if (!accessToken) throw new Error("Google access token required to write calendar deadline");
              result = await performCalendarDeadlineSync(userId, args.taskId, accessToken);
            } else if (name === 'prioritize') {
              result = await handlePrioritizeTool(userId);
            } else {
              throw new Error(`Unknown tool: ${name}`);
            }
          } catch (err: any) {
            console.error(`[Agent] Step ${step} Tool Exception:`, err);
            result = { error: err.message || 'Unknown tool error' };
          }

          // Log to Firestore agentLogs
          const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          await setDoc(doc(db, 'users', userId, 'agentLogs', logId), {
            step,
            toolName: name,
            args: JSON.stringify(args),
            result: typeof result === 'string' ? result : JSON.stringify(result),
            ts: new Date().toISOString()
          });

          toolOutputs.push({
            id: id,
            name: name,
            response: { result: result }
          });
        }

        conversationHistory.push({
          role: 'user',
          parts: toolOutputs.map(out => ({
            functionResponse: {
              name: out.name,
              response: out.response,
              id: out.id
            }
          }))
        });

        step++;
      }

      return res.json({ success: true, message: 'Agent loop finished execution successfully.' });
    } catch (error: any) {
      console.error('[Server] Agent Loop Error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  });

  // Serve static assets or mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
