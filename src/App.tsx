import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Mic,
  Sparkles,
  Calendar as CalendarIcon,
  Clock,
  User,
  Settings,
  X,
  AlertCircle,
  TrendingUp,
  Bookmark,
  ChevronRight,
  ListTodo,
  CheckCircle2,
  Trash2,
  Edit2,
  Volume2,
  Lock,
  Globe,
  Sliders,
  Bell,
  RefreshCw,
  Search
} from 'lucide-react';

import { Task, FocusBlock, AgentActivityLog } from './types';
import { Button } from './components/Button';
import { Card } from './components/Card';
import { Input, TextArea } from './components/Input';
import { Chip } from './components/Chip';
import { FAB } from './components/FAB';
import { Modal } from './components/Modal';
import { ListItem } from './components/ListItem';
import { NavShell } from './components/NavShell';
import { MotionSpring } from './design-tokens';

import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider, getCachedAccessToken, setCachedAccessToken } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { LoginScreen } from './components/LoginScreen';

// Predefined Chips & Tags
const PREDEFINED_EFFORTS = [0.5, 1, 2, 3, 5, 8];
const PREDEFINED_TAGS = ['Assignment', 'Project', 'Exam', 'Reading', 'Admin', 'Personal'];

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentTab, setCurrentTab] = useState<string>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);

  const [focusBlocks, setFocusBlocks] = useState<FocusBlock[]>([
    {
      id: 'focus-1',
      timeStart: '09:00 AM',
      timeEnd: '10:30 AM',
      title: 'Inbox Zero & Triage',
    },
    {
      id: 'focus-2',
      timeStart: '11:00 AM',
      timeEnd: '12:30 PM',
      title: 'Deep Work: Strategy Deck',
      isActive: true,
      statusText: 'Focus mode activated. Notifications muted.'
    },
    {
      id: 'focus-3',
      timeStart: '02:00 PM',
      timeEnd: '03:00 PM',
      title: 'Executive Briefing',
    }
  ]);

  const [activityLogs, setActivityLogs] = useState<AgentActivityLog[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  // Filters State
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  // Modals States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form States for Creating/Editing
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formDueTime, setFormDueTime] = useState('');
  const [formEffort, setFormEffort] = useState<number>(1);
  const [customEffortInput, setCustomEffortInput] = useState('');
  const [formTag, setFormTag] = useState('Assignment');
  const [customTagInput, setCustomTagInput] = useState('');
  const [formPriority, setFormPriority] = useState<Task['priority']>('Normal');
  const [isGoogleSyncChecked, setIsGoogleSyncChecked] = useState(true);
  const [isCalendarSyncChecked, setIsCalendarSyncChecked] = useState(true);

  // Voice capture state
  const [voiceInputText, setVoiceInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState('Click the mic to speak your task details...');

  // Planning Week Loading state
  const [isPlanningWeek, setIsPlanningWeek] = useState(false);
  const [planningProgress, setPlanningProgress] = useState(0);

  // Settings State
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [focusReminders, setFocusReminders] = useState(true);
  const [atRiskAlerts, setAtRiskAlerts] = useState(true);
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('05:00 PM');
  const [focusLength, setFocusLength] = useState(90);
  const [bufferMins, setBufferMins] = useState(15);
  const [isCalendarConnected, setIsCalendarConnected] = useState(true);
  const [isGmailConnected, setIsGmailConnected] = useState(true);
  const [isTasksConnected, setIsTasksConnected] = useState(true);

  // Helper date conversions
  function convertToISO(dueDate: string, dueTime?: string): string {
    if (!dueDate) return new Date().toISOString();
    let hours = 17; // default 5 PM
    let minutes = 0;
    if (dueTime) {
      const match = dueTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
        let h = parseInt(match[1]);
        const m = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        hours = h;
        minutes = m;
      }
    }
    const [year, month, day] = dueDate.split('-').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    return date.toISOString();
  }

  function formatTimeFromISO(iso: string): string {
    try {
      const date = new Date(iso);
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minStr = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${minStr} ${ampm}`;
    } catch {
      return '5:00 PM';
    }
  }

  function formatTimestamp(tsString?: string): string {
    if (!tsString) return 'Just now';
    try {
      const diff = Date.now() - new Date(tsString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins} mins ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
      return new Date(tsString).toLocaleDateString();
    } catch {
      return 'Just now';
    }
  }

  // Firebase auth state subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Update profile states when user changes
  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || 'AutoClutch User');
      setProfileEmail(user.email || 'user@autoclutch.ai');
    }
  }, [user]);

  // Firestore Task Listener
  useEffect(() => {
    if (!user) {
      setTasks([]);
      return;
    }

    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const priorityMap: Record<number, Task['priority']> = {
          0: 'Low',
          1: 'Normal',
          2: 'High',
          3: 'Urgent'
        };

        taskList.push({
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          dueDate: data.dueDateTime ? data.dueDateTime.split('T')[0] : '',
          dueTime: data.dueDateTime && data.dueDateTime.includes('T') ? formatTimeFromISO(data.dueDateTime) : '5:00 PM',
          estimatedEffort: data.effortHours || 1,
          tag: data.tag || 'General',
          isCompleted: data.status === 'completed',
          priority: priorityMap[data.priorityScore] || 'Normal',
          googleTaskId: data.googleTaskId || undefined,
          deadlineEventId: data.deadlineEventId || undefined,
          focusEventIds: data.focusEventIds || [],
          source: data.source || 'Manual entry'
        });
      });
      
      if (taskList.length === 0) {
        seedDefaultTasks(user.uid);
      } else {
        setTasks(taskList);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Firestore Agent Logs Listener
  useEffect(() => {
    if (!user) {
      setActivityLogs([]);
      return;
    }

    const logsRef = collection(db, 'users', user.uid, 'agentLogs');
    const unsubscribe = onSnapshot(logsRef, (snapshot) => {
      const logList: AgentActivityLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        let text = `[Step ${data.step}] Executed ${data.toolName}`;
        if (data.result) {
          text += `: ${data.result}`;
        }
        
        let type: AgentActivityLog['type'] = 'info';
        if (data.toolName?.toLowerCase().includes('task')) {
          type = 'task';
        } else if (data.toolName?.toLowerCase().includes('calendar') || data.toolName?.toLowerCase().includes('schedule')) {
          type = 'calendar';
        }

        logList.push({
          id: doc.id,
          text: text,
          timestamp: formatTimestamp(data.ts),
          type: type
        });
      });

      logList.sort((a, b) => b.id.localeCompare(a.id));

      if (logList.length === 0) {
        seedDefaultLogs(user.uid);
      } else {
        setActivityLogs(logList);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Seeding functions
  const seedDefaultTasks = async (uid: string) => {
    const defaultTasks = [
      {
        title: 'Finalize Q3 Strategy Presentation',
        description: "Review the latest metrics from the data science team and integrate them into the final slide deck for tomorrow's executive briefing.",
        dueDateTime: convertToISO('2026-06-29', '2:00 PM'),
        effortHours: 2,
        tag: 'Exec Team',
        priorityScore: 3,
        status: 'pending',
        source: 'AutoClutch Agent Sync',
        googleTaskId: 'gtask-1',
        deadlineEventId: 'gcal-deadline-1',
        focusEventIds: [],
        subtasks: []
      },
      {
        title: 'Update Client Onboarding Flow',
        description: 'Implement the new welcome email sequence and trigger rules in the CRM.',
        dueDateTime: convertToISO('2026-06-30', '10:00 AM'),
        effortHours: 3,
        tag: 'Marketing',
        priorityScore: 2,
        status: 'pending',
        source: 'Slack parsing',
        googleTaskId: 'gtask-2',
        deadlineEventId: null,
        focusEventIds: [],
        subtasks: []
      },
      {
        title: 'DBMS Assignment 4',
        description: 'Complete database normalization exercises and write clean SQL schema declarations.',
        dueDateTime: convertToISO('2026-06-29', '11:59 PM'),
        effortHours: 5,
        tag: 'Assignment',
        priorityScore: 3,
        status: 'pending',
        source: 'Gmail Inbox Parsing',
        googleTaskId: 'gtask-3',
        deadlineEventId: 'gcal-deadline-3',
        focusEventIds: [],
        subtasks: []
      }
    ];

    for (const t of defaultTasks) {
      const taskId = `task-${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'users', uid, 'tasks', taskId), {
        ...t,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  const seedDefaultLogs = async (uid: string) => {
    const defaultLogs = [
      {
        step: 1,
        toolName: 'Gmail Inbox Triage',
        args: '{"folder": "inbox"}',
        result: 'AutoClutch sorted 42 emails into your "To Read" folder.',
        ts: new Date(Date.now() - 10 * 60000).toISOString()
      },
      {
        step: 2,
        toolName: 'Calendar Rescheduler',
        args: '{"event": "1:1 with Sarah"}',
        result: 'AutoClutch rescheduled your 1:1 with Sarah to tomorrow.',
        ts: new Date(Date.now() - 60 * 60000).toISOString()
      },
      {
        step: 3,
        toolName: 'Gemini NLP Extractor',
        args: '{"text": "ML report due Friday"}',
        result: 'Found a deadline in your inbox → created "ML report" → scheduled 3 focus blocks.',
        ts: new Date(Date.now() - 120 * 60000).toISOString()
      }
    ];

    for (const l of defaultLogs) {
      const logId = `log-${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'users', uid, 'agentLogs', logId), l);
    }
  };

  const addFirestoreLog = async (uid: string, toolName: string, result: string, args: string = '{}') => {
    const step = 1;
    const logId = `log-${Date.now()}`;
    await setDoc(doc(db, 'users', uid, 'agentLogs', logId), {
      step,
      toolName,
      args,
      result,
      ts: new Date().toISOString()
    });
  };

  // Open task creator
  const handleOpenCreateModal = () => {
    setSelectedTask(null);
    setFormTitle('');
    setFormDescription('');
    // Default tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setFormDueDate(tomorrow.toISOString().split('T')[0]);
    setFormDueTime('5:00 PM');
    setFormEffort(2);
    setCustomEffortInput('');
    setFormTag('Assignment');
    setCustomTagInput('');
    setFormPriority('Normal');
    setIsGoogleSyncChecked(true);
    setIsCalendarSyncChecked(true);
    setIsTaskModalOpen(true);
  };

  // Open task editor
  const handleOpenEditModal = (task: Task) => {
    setSelectedTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormDueDate(task.dueDate);
    setFormDueTime(task.dueTime || '5:00 PM');
    setFormEffort(task.estimatedEffort);
    setCustomEffortInput('');
    if (PREDEFINED_TAGS.includes(task.tag)) {
      setFormTag(task.tag);
      setCustomTagInput('');
    } else {
      setFormTag('Custom');
      setCustomTagInput(task.tag);
    }
    setFormPriority(task.priority);
    setIsGoogleSyncChecked(!!task.googleTaskId);
    setIsCalendarSyncChecked(!!task.deadlineEventId);
    setIsTaskModalOpen(true);
  };

  // Open task detail view
  const handleOpenDetailModal = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  // Helper to get or request Google OAuth Access Token
  const getOrRequestAccessToken = async (): Promise<string | null> => {
    let token = getCachedAccessToken();
    if (token) return token;
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const fetchedToken = credential?.accessToken || null;
      if (fetchedToken) {
        setCachedAccessToken(fetchedToken);
        return fetchedToken;
      }
    } catch (err) {
      console.error("Error obtaining Google access token:", err);
    }
    return null;
  };

  // Helper to call backend for Google Tasks sync
  const syncTaskToGoogle = async (taskId: string) => {
    if (!user) return;
    const token = await getOrRequestAccessToken();
    if (!token) {
      console.warn("Could not sync to Google Tasks: No access token available");
      return;
    }
    try {
      const res = await fetch('/api/tasks/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId: user.uid,
          accessToken: token
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error("Sync API error response:", errData);
      }
    } catch (err) {
      console.error("Failed to sync task with server-side Google Tasks API:", err);
    }
  };

  // Helper to call backend for Google Tasks deletion
  const deleteGoogleTask = async (googleTaskId: string, title?: string) => {
    if (!user) return;
    const token = getCachedAccessToken();
    if (!token) {
      console.log("No cached access token available, skipping Google Task deletion from server");
      return;
    }
    try {
      const res = await fetch('/api/tasks/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleTaskId,
          userId: user.uid,
          accessToken: token,
          title: title || ''
        })
      });
      if (!res.ok) {
        console.error("Delete API error response:", await res.text());
      }
    } catch (err) {
      console.error("Failed to delete Google Task via server-side API:", err);
    }
  };

  // Helper to call backend for Google Calendar sync
  const syncDeadlineEventToGoogle = async (taskId: string) => {
    if (!user) return;
    const token = await getOrRequestAccessToken();
    if (!token) {
      console.warn("Could not sync to Google Calendar: No access token available");
      return;
    }
    try {
      const res = await fetch('/api/calendar/deadline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId: user.uid,
          accessToken: token
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error("Calendar Sync API error response:", errData);
      }
    } catch (err) {
      console.error("Failed to sync calendar deadline via server-side API:", err);
    }
  };

  // Helper to call backend for Google Calendar deletion
  const deleteDeadlineEventFromGoogle = async (deadlineEventId: string, title?: string) => {
    if (!user) return;
    const token = getCachedAccessToken();
    if (!token) {
      console.log("No cached access token available, skipping Google Calendar event deletion from server");
      return;
    }
    try {
      const res = await fetch('/api/calendar/deadline/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deadlineEventId,
          userId: user.uid,
          accessToken: token,
          title: title || ''
        })
      });
      if (!res.ok) {
        console.error("Calendar Delete API error response:", await res.text());
      }
    } catch (err) {
      console.error("Failed to delete Calendar event via server-side API:", err);
    }
  };

  // Save Task
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !user) return;

    const finalTag = formTag === 'Custom' ? (customTagInput.trim() || 'General') : formTag;
    const finalEffort = customEffortInput ? parseFloat(customEffortInput) : formEffort;

    const priorityScoreMap: Record<string, number> = {
      'Low': 0,
      'Normal': 1,
      'High': 2,
      'Urgent': 3
    };

    const dueDateTimeIso = convertToISO(formDueDate, formDueTime);

    try {
      if (selectedTask) {
        // Editing in Firestore
        const taskRef = doc(db, 'users', user.uid, 'tasks', selectedTask.id);
        const wasSynced = !!selectedTask.googleTaskId;
        const wasCalendarSynced = !!selectedTask.deadlineEventId;
        await updateDoc(taskRef, {
          title: formTitle,
          description: formDescription,
          dueDateTime: dueDateTimeIso,
          effortHours: finalEffort,
          tag: finalTag,
          priorityScore: priorityScoreMap[formPriority] ?? 1,
          googleTaskId: isGoogleSyncChecked ? selectedTask.googleTaskId || null : null,
          deadlineEventId: isCalendarSyncChecked ? selectedTask.deadlineEventId || null : null,
          updatedAt: new Date().toISOString()
        });

        await addFirestoreLog(user.uid, 'Task Update', `Updated Task: "${formTitle}"`);

        // Handle Google Tasks sync/delete
        if (isGoogleSyncChecked) {
          await syncTaskToGoogle(selectedTask.id);
        } else if (wasSynced && selectedTask.googleTaskId) {
          await deleteGoogleTask(selectedTask.googleTaskId, formTitle);
        }

        // Handle Google Calendar sync/delete
        if (isCalendarSyncChecked) {
          await syncDeadlineEventToGoogle(selectedTask.id);
        } else if (wasCalendarSynced && selectedTask.deadlineEventId) {
          await deleteDeadlineEventFromGoogle(selectedTask.deadlineEventId, formTitle);
        }
      } else {
        // Creating in Firestore
        const taskId = `task-${Date.now()}`;
        const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
        await setDoc(taskRef, {
          title: formTitle,
          description: formDescription,
          dueDateTime: dueDateTimeIso,
          effortHours: finalEffort,
          tag: finalTag,
          priorityScore: priorityScoreMap[formPriority] ?? 1,
          status: 'pending',
          source: 'user',
          googleTaskId: null,
          deadlineEventId: null,
          focusEventIds: [],
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await addFirestoreLog(user.uid, 'Task Create', `Created Task: "${formTitle}" (Estimated effort: ${finalEffort} hrs)`);

        // Handle Google Tasks sync
        if (isGoogleSyncChecked) {
          await syncTaskToGoogle(taskId);
        }

        // Handle Google Calendar sync
        if (isCalendarSyncChecked) {
          await syncDeadlineEventToGoogle(taskId);
        }
      }
    } catch (err) {
      console.error("Error saving task:", err);
    }

    setIsTaskModalOpen(false);
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    try {
      const taskToDelete = tasks.find(t => t.id === id);
      if (taskToDelete) {
        if (taskToDelete.googleTaskId) {
          await deleteGoogleTask(taskToDelete.googleTaskId, taskToDelete.title);
        }
        if (taskToDelete.deadlineEventId) {
          await deleteDeadlineEventFromGoogle(taskToDelete.deadlineEventId, taskToDelete.title);
        }
      }
      const taskRef = doc(db, 'users', user.uid, 'tasks', id);
      await deleteDoc(taskRef);
      if (taskToDelete) {
        await addFirestoreLog(user.uid, 'Task Delete', `Deleted Task: "${taskToDelete.title}" and cleaned up references`);
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleToggleComplete = async (id: string) => {
    if (!user) return;
    try {
      const taskToToggle = tasks.find(t => t.id === id);
      if (!taskToToggle) return;
      const nextCompleted = !taskToToggle.isCompleted;

      const taskRef = doc(db, 'users', user.uid, 'tasks', id);
      await updateDoc(taskRef, {
        status: nextCompleted ? 'completed' : 'pending',
        updatedAt: new Date().toISOString()
      });

      await addFirestoreLog(
        user.uid,
        'Task Toggle',
        nextCompleted
          ? `Completed Task: "${taskToToggle.title}" (Verified Sync)`
          : `Reopened Task: "${taskToToggle.title}"`
      );

      // Handle Google Tasks sync
      if (taskToToggle.googleTaskId || (isGoogleSyncChecked && !taskToToggle.googleTaskId)) {
        await syncTaskToGoogle(id);
      }

      // Handle Google Calendar sync
      if (taskToToggle.deadlineEventId || (isCalendarSyncChecked && !taskToToggle.deadlineEventId)) {
        await syncDeadlineEventToGoogle(id);
      }
    } catch (err) {
      console.error("Error toggling task complete:", err);
    }
  };

  const addLog = async (text: string, type: AgentActivityLog['type']) => {
    if (!user) return;
    await addFirestoreLog(user.uid, type === 'task' ? 'Task Sync' : 'System Log', text);
  };

  // Implement prioritize(): priorityScore = 0.40*urgency + 0.30*importance + 0.15*effort_fit - 0.15*slack
  const prioritize = (taskList: Task[]): Task[] => {
    const openTasks = tasks.filter(t => !t.isCompleted);
    if (openTasks.length === 0) {
      return [...taskList].sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;
        return 0;
      });
    }

    const now = Date.now();

    // Calculate raw metrics for open tasks
    const taskDetails = openTasks.map(t => {
      let dueTimeMs = now + 7 * 24 * 60 * 60 * 1000; // default 7 days in future
      if (t.dueDate) {
        try {
          const iso = convertToISO(t.dueDate, t.dueTime || '5:00 PM');
          dueTimeMs = new Date(iso).getTime();
        } catch (e) {
          // fallback
        }
      }
      const timeRemainingHours = (dueTimeMs - now) / 3600000;
      const effort = t.estimatedEffort || 1;
      const slackHours = timeRemainingHours - effort;

      // Importance based on priority field
      let importance = 4; // Normal
      if (t.priority === 'Urgent') importance = 10;
      else if (t.priority === 'High') importance = 7;
      else if (t.priority === 'Normal') importance = 4;
      else if (t.priority === 'Low') importance = 1;

      return {
        id: t.id,
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

    const scoresMap: Record<string, number> = {};
    taskDetails.forEach(d => {
      // urgency: 0 to 10 (shorter remaining time = higher urgency)
      let urgency = 5;
      if (maxTimeRemaining !== minTimeRemaining) {
        urgency = 10 * (1 - (d.timeRemainingHours - minTimeRemaining) / (maxTimeRemaining - minTimeRemaining));
      } else {
        urgency = d.timeRemainingHours <= 24 ? 10 : 5;
      }
      urgency = Math.max(0, Math.min(10, urgency));

      const importance = d.importance;

      // effort_fit: 0 to 10 (smaller effort = higher fit)
      let effort_fit = 5;
      if (maxEffort !== minEffort) {
        effort_fit = 10 * (1 - (d.effort - minEffort) / (maxEffort - minEffort));
      } else {
        effort_fit = d.effort <= 2 ? 10 : 5;
      }
      effort_fit = Math.max(0, Math.min(10, effort_fit));

      // slack: 0 to 10 (larger slack hours = higher slack score)
      let slack = 5;
      if (maxSlack !== minSlack) {
        slack = 10 * (d.slackHours - minSlack) / (maxSlack - minSlack);
      } else {
        slack = d.slackHours >= 48 ? 10 : 5;
      }
      slack = Math.max(0, Math.min(10, slack));

      const score = 0.40 * urgency + 0.30 * importance + 0.15 * effort_fit - 0.15 * slack;
      scoresMap[d.id] = score;
    });

    // Sort: open tasks first (sorted by priority score in descending order), then completed tasks
    return [...taskList].sort((a, b) => {
      if (a.isCompleted && !b.isCompleted) return 1;
      if (!a.isCompleted && b.isCompleted) return -1;
      
      if (!a.isCompleted && !b.isCompleted) {
        const scoreA = scoresMap[a.id] ?? 0;
        const scoreB = scoresMap[b.id] ?? 0;
        return scoreB - scoreA; // descending
      }

      // If both completed, sort alphabetically
      return a.title.localeCompare(b.title);
    });
  };

  // Filter logic
  const unfilteredTasks = tasks.filter(t => {
    // Search query match
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    if (activeFilter === 'completed') return t.isCompleted;
    if (activeFilter === 'today') {
      const todayStr = '2026-06-29'; // Mock fixed today per current local time metadata
      return t.dueDate === todayStr && !t.isCompleted;
    }
    if (activeFilter === 'upcoming') {
      const todayStr = '2026-06-29';
      return t.dueDate > todayStr && !t.isCompleted;
    }
    return true; // All tasks
  });

  const filteredTasks = prioritize(unfilteredTasks);

  // Calculate high priority active tasks count
  const urgentTasksCount = tasks.filter(t => !t.isCompleted && (t.priority === 'Urgent' || t.priority === 'High')).length;

  // Plan My Week animation loop simulation
  const triggerPlanMyWeek = async () => {
    if (!user) return;
    setIsPlanningWeek(true);
    setPlanningProgress(5);
    await addFirestoreLog(user.uid, 'Week-Planning Triage', 'AutoClutch initiated AI Week-Planning and calendar parsing...');

    let progress = 5;
    const interval = setInterval(() => {
      progress += 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(async () => {
          setIsPlanningWeek(false);
          // Insert simulated focus blocks
          setFocusBlocks([
            {
              id: `focus-new-1`,
              timeStart: '01:00 PM',
              timeEnd: '03:00 PM',
              title: 'AutoClutch: Focus block Q3 Strategy Presentation',
              isActive: false
            },
            ...focusBlocks
          ]);
          await addFirestoreLog(user.uid, 'Calendar Sync', 'Week planned! Synced 3 focus sessions directly to your Google Calendar.');
        }, 800);
      }
      setPlanningProgress(progress);
    }, 400);
  };

  // Simulated Voice Capturing parsing logic
  const startRecordingSim = () => {
    setIsRecording(true);
    setVoiceStatusMsg('Listening... speak clearly into your microphone.');
    
    // Simulate speech detection
    setTimeout(() => {
      setVoiceInputText('DBMS project normalization assignment due next Friday at 6:00 PM');
      setVoiceStatusMsg('Analyzing with Gemini-3.5-Flash...');
      
      setTimeout(() => {
        setIsRecording(false);
        setVoiceStatusMsg('Task parsed successfully! Click Create to save.');
      }, 1500);
    }, 2000);
  };

  const handleVoiceCreateTask = async () => {
    if (!voiceInputText || !user) return;
    
    try {
      const taskId = `task-${Date.now()}`;
      const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
      const dueDateTimeIso = convertToISO('2026-07-03', '6:00 PM');

      await setDoc(taskRef, {
        title: 'DBMS project normalization assignment',
        description: 'Extracted automatically from voice capture prompt: "DBMS project normalization assignment due next Friday at 6:00 PM"',
        dueDateTime: dueDateTimeIso,
        effortHours: 3,
        tag: 'Assignment',
        priorityScore: 2,
        status: 'pending',
        source: 'ai',
        googleTaskId: `gtask-v-${Date.now()}`,
        deadlineEventId: `gcal-v-${Date.now()}`,
        focusEventIds: [],
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await addFirestoreLog(user.uid, 'Gemini Voice Parser', 'Gemini parsed voice-input: created "DBMS project normalization assignment" (estimated effort: 3h)');
    } catch (err) {
      console.error("Error creating voice task:", err);
    }

    setIsVoiceModalOpen(false);
    setVoiceInputText('');
  };


  const handleCustomPromptSubmit = async () => {
    if (!customPrompt.trim() || !user || isAgentRunning) return;
    setIsAgentRunning(true);
    const instruction = customPrompt.trim();
    setCustomPrompt('');

    try {
      await addFirestoreLog(user.uid, 'Agent Command', `Instructed: "${instruction}"`);
      const token = await getOrRequestAccessToken();

      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: instruction,
          userId: user.uid,
          accessToken: token || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error running agent loop');
      }

      await response.json();
    } catch (err: any) {
      console.error("[App] Failed to run agent loop:", err);
      await addFirestoreLog(user.uid, 'Agent System Error', `Loop failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAgentRunning(false);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#1A1244] flex items-center justify-center p-4">
        <div className="relative flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#5B4FE3]/20 border-t-[#5B4FE3] animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#5B4FE3] mt-4 animate-pulse">Initializing AutoClutch...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavShell currentTab={currentTab} onChangeTab={setCurrentTab} user={user} onSignOut={handleSignOut}>
      <AnimatePresence mode="wait">
        
        {/* ========================================== */}
        {/* TAB: TASKS (TASK HUB) */}
        {/* ========================================== */}
        {currentTab === 'tasks' && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={MotionSpring}
            className="grid grid-cols-1 xl:grid-cols-3 gap-8"
          >
            {/* Left Content: Tasks & Filters */}
            <div className="xl:col-span-2 space-y-6">
              {/* Header block */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                    Task Hub
                  </h2>
                  <p className="text-sm text-on-surface-variant font-medium mt-1">
                    Good morning, {profileName}. You have <span className="text-primary font-bold">{urgentTasksCount} tasks</span> needing attention.
                  </p>
                </div>

                {/* Quick actions row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="p-3 bg-surface-container-high hover:bg-surface-container-highest border border-white/5 rounded-full text-on-surface hover:text-primary transition-all cursor-pointer active:scale-95"
                    title="Voice Quick-Capture"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <Button
                    variant="ghost"
                    onClick={triggerPlanMyWeek}
                    disabled={isPlanningWeek}
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <span>Plan My Week</span>
                  </Button>

                  <Button
                    variant="primary"
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Task</span>
                  </Button>
                </div>
              </div>

              {/* Weekly Planning banner */}
              {isPlanningWeek && (
                <Card variant="glowing" className="p-4 flex flex-col gap-2 bg-primary/5 animate-pulse">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                    <span className="text-sm font-bold text-white">AutoClutch is compiling research and planning your week...</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${planningProgress}%` }} />
                  </div>
                </Card>
              )}

              {/* Filters & Search Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container/60 p-3 rounded-2xl border border-white/5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'today', 'upcoming', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                        activeFilter === filter
                          ? 'bg-primary text-white shadow-[0_4px_12px_rgba(91,79,227,0.25)]'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                      }`}
                    >
                      {filter === 'all' ? 'All Tasks' : filter}
                    </button>
                  ))}
                </div>

                {/* Search query field */}
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 bg-surface-container-high border border-white/5 rounded-full text-xs text-on-surface placeholder-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>
              </div>

              {/* Task Items List */}
              <div className="space-y-4">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <ListItem
                      key={task.id}
                      task={task}
                      onToggleComplete={handleToggleComplete}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteTask}
                      onViewDetails={handleOpenDetailModal}
                    />
                  ))
                ) : (
                  <Card variant="glass" className="py-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4 border border-white/5">
                      <ListTodo className="w-8 h-8 text-on-surface-variant" />
                    </div>
                    <h3 className="text-lg font-extrabold text-on-surface">No tasks found</h3>
                    <p className="text-sm text-on-surface-variant mt-1.5 max-w-sm">
                      {searchQuery
                        ? 'Try adjusting your search terms or filters to find what you are looking for.'
                        : 'Your schedule is currently clear! Create a new task manually or use voice capture.'}
                    </p>
                    <Button variant="secondary" onClick={handleOpenCreateModal} className="mt-5 h-10 text-xs uppercase tracking-wider">
                      Create a Task
                    </Button>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Side: Quick Stats, Focus Timeline & Activity logs */}
            <div className="space-y-6">
              {/* Calendar Quick Widget */}
              <Card variant="glass" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-extrabold text-white">June 2026</h3>
                  <div className="flex gap-1.5">
                    <button className="p-1 rounded-full hover:bg-white/5 text-on-surface-variant hover:text-on-surface cursor-pointer">❮</button>
                    <button className="p-1 rounded-full hover:bg-white/5 text-on-surface-variant hover:text-on-surface cursor-pointer">❯</button>
                  </div>
                </div>

                {/* Grid Calendar Layout */}
                <div className="grid grid-cols-7 gap-y-2.5 text-center text-xs font-semibold text-on-surface-variant">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <span key={i} className="text-[10px] text-on-surface-variant/55">{day}</span>
                  ))}
                  {/* Mock calendar numbers ending near current metadata date: June 28, 2026 */}
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={`empty-${i}`} className="text-transparent">0</span>
                  ))}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const dateNum = i + 1;
                    const isToday = dateNum === 28; // metadata date: 2026-06-28
                    return (
                      <span
                        key={i}
                        className={`w-7 h-7 flex items-center justify-center mx-auto rounded-full font-bold ${
                          isToday
                            ? 'bg-primary text-white shadow-[0_0_12px_rgba(91,79,227,0.6)]'
                            : 'hover:bg-white/5 cursor-pointer text-on-surface'
                        }`}
                      >
                        {dateNum}
                      </span>
                    );
                  })}
                </div>
              </Card>

              {/* Focus Timeline Panel */}
              <Card variant="glass" className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-white">Today's Focus</h3>
                  <button onClick={() => setCurrentTab('schedule')} className="text-xs text-primary font-bold uppercase tracking-wider hover:underline cursor-pointer">
                    View All
                  </button>
                </div>

                <div className="space-y-4 relative pl-3 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                  {focusBlocks.map((block) => (
                    <div key={block.id} className="relative pl-6">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-[-2px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                          block.isActive
                            ? 'bg-primary border-primary shadow-[0_0_8px_rgba(91,79,227,0.8)] animate-pulse'
                            : 'bg-surface-card border-white/20'
                        }`}
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-on-surface-variant/85 uppercase">
                          {block.timeStart} {block.timeEnd ? `- ${block.timeEnd}` : ''}
                        </span>
                        <h4 className={`text-sm font-bold ${block.isActive ? 'text-primary' : 'text-on-surface'}`}>
                          {block.title}
                        </h4>
                        {block.statusText && (
                          <span className="text-xs text-success font-medium mt-0.5">
                            {block.statusText}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Agent Activity Logger */}
              <Card variant="glass" className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-extrabold text-white">Agent Activity</h3>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 text-xs bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 bg-primary" />
                      <div className="flex-1">
                        <p className="text-on-surface font-semibold leading-relaxed">{log.text}</p>
                        <span className="text-[10px] text-on-surface-variant font-mono mt-1 block">{log.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ========================================== */}
        {/* TAB: AGENT DEEP RESEARCH & EXPLAINER */}
        {/* ========================================== */}
        {currentTab === 'agent' && (
          <motion.div
            key="agent"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={MotionSpring}
            className="space-y-6"
          >
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                AutoClutch Agent Control
              </h2>
              <p className="text-sm text-on-surface-variant mt-1.5">
                Monitor autonomous integrations, active sync models, and prompt parsing history.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sync Status Cards */}
              <Card variant="glass" className="p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-on-surface-variant">Gemini Core Parsing</span>
                  <span className="text-xs text-success font-bold uppercase tracking-wider bg-success/15 px-2 py-0.5 rounded-md border border-success/25">ACTIVE</span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">gemini-3.5-flash</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed font-normal">
                  Powering task drafting, estimated effort calculations, and calendar slot recommendations. Runs fully server-side.
                </p>
              </Card>

              <Card variant="glass" className="p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-on-surface-variant">Google Task API Sync</span>
                  <span className="text-xs text-success font-bold uppercase tracking-wider bg-success/15 px-2 py-0.5 rounded-md border border-success/25">BOUNDED</span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">One-Way Sync</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed font-normal">
                  Tasks manage date-only due-dates directly synced to Google Tasks. Prevents orphaned objects.
                </p>
              </Card>

              <Card variant="glass" className="p-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-on-surface-variant">Agentic Loop Limit</span>
                  <span className="text-xs text-primary font-bold uppercase tracking-wider bg-primary/15 px-2 py-0.5 rounded-md border border-primary/25">8 STEPS MAX</span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">Self-Bounded</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed font-normal">
                  Ensures zero infinite run-loops while conducting auto-scheduling or email inbox triage exercises.
                </p>
              </Card>
            </div>

            {/* Custom Interactive Agent Playground Panel */}
            <Card variant="glass" className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-extrabold text-white">Ask the Agent</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Type a command to simulate how Gemini schedules focus blocks and automates your day.
                </p>
              </div>

              <div className="flex gap-3">
                <Input
                  placeholder={isAgentRunning ? "Agent is processing your instruction..." : "e.g. Schedule 2 hours for Q3 slide preparations on Tuesday morning..."}
                  className="flex-1"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  disabled={isAgentRunning}
                />
                <Button 
                  variant="primary" 
                  onClick={handleCustomPromptSubmit}
                  disabled={isAgentRunning || !customPrompt.trim()}
                >
                  {isAgentRunning ? 'Thinking...' : 'Instruct'}
                </Button>
              </div>

              {/* Mock system logs Terminal */}
              <div className="bg-surface-container-high rounded-xl p-4 border border-white/5 font-mono text-xs space-y-2 text-on-surface-variant">
                <div className="text-primary font-bold">&gt; [AUTOCLUTCH CORE] Online and listening...</div>
                <div>&gt; [INFO] Google workspace Calendar client initialized successfully.</div>
                <div>&gt; [INFO] Google Tasks scope verified. (No orphan references found)</div>
                <div>&gt; [SUCCESS] Scheduled "Deadline: Finalize Q3 Presentation" for 2026-06-29</div>
                <div>&gt; [AI] Calculated estimated effort: 2.0 hours. Tag: Exec Team</div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ========================================== */}
        {/* TAB: SCHEDULE TIMELINE */}
        {/* ========================================== */}
        {currentTab === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={MotionSpring}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Schedule Timeline
                </h2>
                <p className="text-sm text-on-surface-variant mt-1.5">
                  View scheduled focus sessions, deadline reminders, and task timelines.
                </p>
              </div>

              <Button variant="secondary" onClick={triggerPlanMyWeek} disabled={isPlanningWeek}>
                <Sparkles className="w-4 h-4 mr-2 text-primary" />
                Plan Week Slots
              </Button>
            </div>

            {/* Focus blocks and Deadlines Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily calendar timelines */}
              <Card variant="glass" className="p-6 space-y-4">
                <h3 className="text-base font-extrabold text-white">Focus Blocks Timeline</h3>
                
                <div className="space-y-4 relative pl-3 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                  {focusBlocks.map((block, i) => (
                    <div key={i} className="relative pl-6">
                      <div className={`absolute left-[-2px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${block.isActive ? 'bg-primary border-primary shadow-[0_0_8px_rgba(91,79,227,0.8)] animate-pulse' : 'bg-surface-card border-white/20'}`} />
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <span className="text-[10px] font-mono text-primary font-bold uppercase">{block.timeStart} - {block.timeEnd}</span>
                        <h4 className="text-sm font-extrabold text-white mt-0.5">{block.title}</h4>
                        {block.statusText && <p className="text-xs text-success font-semibold mt-1">{block.statusText}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Tasks Deadlines List */}
              <Card variant="glass" className="p-6 space-y-4">
                <h3 className="text-base font-extrabold text-white">Deadline Alerts & Reminders</h3>
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-tertiary uppercase font-extrabold tracking-widest">{task.tag}</span>
                        <h4 className="text-sm font-extrabold text-white mt-0.5">Deadline: {task.title}</h4>
                        <span className="text-xs text-on-surface-variant font-medium block mt-1">Due {task.dueDate} at {task.dueTime}</span>
                      </div>
                      <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${task.priority === 'Urgent' ? 'bg-urgent/15 text-urgent border border-urgent/25' : 'bg-primary/15 text-primary'}`}>
                        {task.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ========================================== */}
        {/* TAB: SETTINGS */}
        {/* ========================================== */}
        {currentTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={MotionSpring}
            className="space-y-8"
          >
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                Settings
              </h2>
              <p className="text-sm text-on-surface-variant mt-1.5">
                Manage your connected accounts, preferences, and workspace configuration.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Account Profile Card */}
              <Card variant="glass" className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-extrabold text-white">Account Profile</h3>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-primary/50 bg-surface-container flex items-center justify-center">
                    <User className="w-10 h-10 text-primary" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-[10px] font-bold text-white uppercase">Edit</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-4">
                    <Input
                      label="Full Name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                    <Input
                      label="Email Address"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* Integrations Card */}
              <Card variant="glass" className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-extrabold text-white">Integrations</h3>
                </div>

                <div className="space-y-4">
                  {/* Google Calendar */}
                  <div className="flex items-center justify-between p-3.5 bg-surface-container-high rounded-xl border border-white/5">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Google Calendar</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {isCalendarConnected ? `Connected as ${profileEmail}` : 'Disconnected'}
                      </p>
                    </div>
                    <Button
                      variant={isCalendarConnected ? 'secondary' : 'primary'}
                      onClick={() => setIsCalendarConnected(!isCalendarConnected)}
                      className="h-9 px-4 text-xs uppercase font-bold"
                    >
                      {isCalendarConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>

                  {/* Gmail */}
                  <div className="flex items-center justify-between p-3.5 bg-surface-container-high rounded-xl border border-white/5">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Gmail</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {isGmailConnected ? 'Active scanning and triage' : 'Disabled'}
                      </p>
                    </div>
                    <Button
                      variant={isGmailConnected ? 'secondary' : 'primary'}
                      onClick={() => setIsGmailConnected(!isGmailConnected)}
                      className="h-9 px-4 text-xs uppercase font-bold"
                    >
                      {isGmailConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>

                  {/* Google Tasks */}
                  <div className="flex items-center justify-between p-3.5 bg-surface-container-high rounded-xl border border-white/5">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Google Tasks</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {isTasksConnected ? 'Active syncing and scheduling' : 'Disabled'}
                      </p>
                    </div>
                    <Button
                      variant={isTasksConnected ? 'secondary' : 'primary'}
                      onClick={() => setIsTasksConnected(!isTasksConnected)}
                      className="h-9 px-4 text-xs uppercase font-bold"
                    >
                      {isTasksConnected ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Focus Settings Card */}
              <Card variant="glass" className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Sliders className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-extrabold text-white">Focus Block Preferences</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Focus-block reminders</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">Notify before deep work sessions start</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={focusReminders}
                      onChange={(e) => setFocusReminders(e.target.checked)}
                      className="w-10 h-5 bg-surface-container rounded-full appearance-none checked:bg-primary transition-all relative before:absolute before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-5 before:transition-all cursor-pointer border border-white/10"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">At-risk task alerts</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">Alert when deadline calendar is tight</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={atRiskAlerts}
                      onChange={(e) => setAtRiskAlerts(e.target.checked)}
                      className="w-10 h-5 bg-surface-container rounded-full appearance-none checked:bg-primary transition-all relative before:absolute before:h-4 before:w-4 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-5 before:transition-all cursor-pointer border border-white/10"
                    />
                  </div>
                </div>
              </Card>

              {/* Working Hours Card */}
              <Card variant="glass" className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-extrabold text-white">Working Hours</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Start Time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <Input
                    label="End Time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Focus block length (mins)"
                    type="number"
                    value={focusLength}
                    onChange={(e) => setFocusLength(parseInt(e.target.value) || 0)}
                  />
                  <Input
                    label="Buffer minutes"
                    type="number"
                    value={bufferMins}
                    onChange={(e) => setBufferMins(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="primary" onClick={() => addLog('Working hours configuration updated successfully', 'info')}>
                    Save Settings
                  </Button>
                </div>
              </Card>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ========================================== */}
      {/* THINKING AI FAB */}
      {/* ========================================== */}
      <FAB onClick={() => setIsVoiceModalOpen(true)} isThinking={isAgentRunning} />

      {/* ========================================== */}
      {/* CREATE / EDIT TASK GLASS MODAL */}
      {/* ========================================== */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title={selectedTask ? 'Edit Task' : 'Create Task'}
      >
        <form onSubmit={handleSaveTask} className="space-y-5">
          <Input
            label="Task Title"
            placeholder="e.g. Machine Learning project report"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <TextArea
            label="Description"
            placeholder="e.g. Analyze dataset and draft findings on gradient boosting performance..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              required
            />
            <Input
              label="Due Time"
              placeholder="e.g. 5:00 PM"
              value={formDueTime}
              onChange={(e) => setFormDueTime(e.target.value)}
            />
          </div>

          {/* Sync Status selectors */}
          <div className="p-3.5 bg-surface-container-high/60 rounded-xl border border-white/5 space-y-3">
            <span className="text-xs uppercase font-extrabold tracking-widest text-on-surface-variant block mb-1">Sync Status</span>
            
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="google-sync"
                checked={isGoogleSyncChecked}
                onChange={(e) => setIsGoogleSyncChecked(e.target.checked)}
                className="w-4 h-4 text-primary bg-surface-container border-white/10 rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
              />
              <label htmlFor="google-sync" className="text-xs text-on-surface font-semibold cursor-pointer select-none">
                Syncing to Google Tasks
              </label>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="calendar-sync"
                checked={isCalendarSyncChecked}
                onChange={(e) => setIsCalendarSyncChecked(e.target.checked)}
                className="w-4 h-4 text-primary bg-surface-container border-white/10 rounded focus:ring-primary focus:ring-2 accent-primary cursor-pointer"
              />
              <label htmlFor="calendar-sync" className="text-xs text-on-surface font-semibold cursor-pointer select-none">
                Creating Calendar Deadline entry
              </label>
            </div>
          </div>

          {/* Effort Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Estimated Effort (Hours)
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PREDEFINED_EFFORTS.map((effort) => (
                <Chip
                  key={effort}
                  label={`${effort}h`}
                  isActive={formEffort === effort && !customEffortInput}
                  onClick={() => {
                    setFormEffort(effort);
                    setCustomEffortInput('');
                  }}
                />
              ))}
              <input
                type="number"
                step="0.5"
                placeholder="+ Custom..."
                value={customEffortInput}
                onChange={(e) => setCustomEffortInput(e.target.value)}
                className="w-24 h-8 px-2.5 rounded-full text-xs bg-surface-container-high border border-white/5 focus:outline-none focus:border-primary text-on-surface placeholder-on-surface-variant/50"
              />
            </div>
          </div>

          {/* Tag Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Classification Tag
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PREDEFINED_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  isActive={formTag === tag && !customTagInput}
                  onClick={() => {
                    setFormTag(tag);
                    setCustomTagInput('');
                  }}
                />
              ))}
              <Chip
                label="Custom"
                isActive={formTag === 'Custom' || !!customTagInput}
                onClick={() => setFormTag('Custom')}
              />
              {(formTag === 'Custom' || customTagInput) && (
                <input
                  type="text"
                  placeholder="Enter custom tag..."
                  value={customTagInput}
                  onChange={(e) => {
                    setFormTag('Custom');
                    setCustomTagInput(e.target.value);
                  }}
                  className="w-32 h-8 px-2.5 rounded-full text-xs bg-surface-container-high border border-white/5 focus:outline-none focus:border-primary text-on-surface placeholder-on-surface-variant/50"
                />
              )}
            </div>
          </div>

          {/* Priority selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant block">
              Task Priority
            </label>
            <div className="flex gap-2">
              {(['Low', 'Normal', 'High', 'Urgent'] as Task['priority'][]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormPriority(p)}
                  className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all border ${
                    formPriority === p
                      ? p === 'Urgent'
                        ? 'bg-urgent text-white border-urgent shadow-[0_2px_10px_rgba(255,90,90,0.3)]'
                        : p === 'High'
                        ? 'bg-tertiary text-on-tertiary border-tertiary shadow-[0_2px_10px_rgba(255,180,166,0.3)]'
                        : 'bg-primary text-white border-primary shadow-[0_2px_10px_rgba(91,79,227,0.3)]'
                      : 'bg-surface-container-high text-on-surface-variant border-white/5 hover:bg-surface-container-highest'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <Button variant="secondary" type="button" onClick={() => setIsTaskModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex-1">
              Save Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================== */}
      {/* VOICE QUICK-CAPTURE GLASS MODAL */}
      {/* ========================================== */}
      <Modal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        title="Voice Quick-Capture"
      >
        <div className="space-y-6 text-center">
          <p className="text-sm text-on-surface-variant font-medium">
            Speak naturally. AutoClutch uses server-side Gemini intelligence to parse task details, dates, and effort estimates.
          </p>

          <div className="flex justify-center py-6">
            <button
              onClick={startRecordingSim}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                isRecording
                  ? 'bg-urgent text-white animate-pulse shadow-[0_0_25px_rgba(255,90,90,0.5)]'
                  : 'bg-primary hover:bg-primary-hover text-white shadow-[0_0_20px_rgba(91,79,227,0.4)] hover:scale-105 active:scale-95'
              }`}
            >
              <Mic className="w-10 h-10" />
              {isRecording && (
                <span className="absolute -inset-2.5 rounded-full border-2 border-urgent/45 animate-ping" />
              )}
            </button>
          </div>

          <div className="bg-surface-container/60 p-4 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-2">Voice Feed Status</span>
            <span className="text-sm font-semibold text-white">{voiceStatusMsg}</span>
          </div>

          {voiceInputText && (
            <div className="space-y-3.5 text-left">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Transcribed Prompt</label>
              <textarea
                value={voiceInputText}
                onChange={(e) => setVoiceInputText(e.target.value)}
                className="w-full h-24 p-3.5 bg-surface-container-high rounded-xl text-sm border border-white/5 text-white focus:border-primary focus:outline-none"
              />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setVoiceInputText('')} className="flex-1">
                  Clear
                </Button>
                <Button variant="primary" onClick={handleVoiceCreateTask} className="flex-1">
                  Create Task
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ========================================== */}
      {/* TASK DETAIL GLASS MODAL */}
      {/* ========================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Task Details"
      >
        {selectedTask && (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* Tag Chip */}
                <Chip
                  label={selectedTask.tag}
                  isActive={true}
                  variant="primary"
                />

                {/* Priority Badge */}
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                    selectedTask.priority === 'Urgent'
                      ? 'bg-urgent/15 text-urgent border border-urgent/25'
                      : selectedTask.priority === 'High'
                      ? 'bg-tertiary/15 text-tertiary border border-tertiary/25'
                      : 'bg-primary/15 text-primary border border-primary/25'
                  }`}
                >
                  {selectedTask.priority} Priority
                </span>

                {/* Completion Status */}
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                    selectedTask.isCompleted
                      ? 'bg-success/15 text-success border border-success/25'
                      : 'bg-white/5 text-on-surface-variant border border-white/5'
                  }`}
                >
                  {selectedTask.isCompleted ? 'Completed' : 'Pending'}
                </span>
              </div>

              <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
                {selectedTask.title}
              </h3>
            </div>

            {selectedTask.description && (
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Description
                </span>
                <div className="p-4 bg-surface-container-high/40 rounded-xl border border-white/5 text-sm text-on-surface font-normal leading-relaxed whitespace-pre-wrap">
                  {selectedTask.description}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Due Date Info */}
              <div className="p-3.5 bg-surface-container-high/40 rounded-xl border border-white/5 flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Due Date & Time</span>
                  <span className="text-sm font-semibold text-white">
                    {selectedTask.dueDate} {selectedTask.dueTime ? `at ${selectedTask.dueTime}` : ''}
                  </span>
                </div>
              </div>

              {/* Effort Info */}
              <div className="p-3.5 bg-surface-container-high/40 rounded-xl border border-white/5 flex items-center gap-3">
                <Bookmark className="w-5 h-5 text-tertiary" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Estimated Effort</span>
                  <span className="text-sm font-semibold text-white font-mono">
                    {selectedTask.estimatedEffort} hours
                  </span>
                </div>
              </div>
            </div>

            {/* Sync details if present */}
            {(selectedTask.googleTaskId || selectedTask.deadlineEventId) && (
              <div className="p-4 bg-surface-container-high/60 rounded-xl border border-white/5 space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-on-surface-variant block">Google Workspace Sync</span>
                <div className="space-y-1.5 text-xs font-semibold">
                  {selectedTask.googleTaskId && (
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Synced to Google Tasks</span>
                    </div>
                  )}
                  {selectedTask.deadlineEventId && (
                    <div className="flex items-center gap-2 text-success">
                      <CalendarIcon className="w-4 h-4" />
                      <span>Calendar Deadline reminder created</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleToggleComplete(selectedTask.id);
                }}
                className="flex-1"
              >
                {selectedTask.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
              </Button>
              
              <div className="flex flex-1 gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleDeleteTask(selectedTask.id);
                  }}
                  className="flex-1 border-urgent/30 hover:bg-urgent/10 text-urgent"
                >
                  Delete
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEditModal(selectedTask);
                  }}
                  className="flex-1"
                >
                  Edit Task
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </NavShell>
  );
}
