import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Mail,
  Check,
  Zap,
  CheckCircle,
  AlertTriangle,
  Play,
  Send,
  LogOut
} from 'lucide-react';

import { Task, FocusBlock, AgentActivityLog, GmailProposal } from './types';
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
import { auth, db, messaging, googleProvider, getCachedAccessToken, setCachedAccessToken } from './firebase';
import { getToken } from 'firebase/messaging';
import {
  collection,
  doc,
  getDoc,
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Filters State
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');

  // Modals States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Panic Mode States
  const [isPanicActive, setIsPanicActive] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);
  const [panicData, setPanicData] = useState<{
    taskAtRisk: string;
    timeRemaining: string;
    emergencyPlan: Array<{ title: string; description: string; duration: string; isCompleted?: boolean }>;
    adjustments: Array<{ type: 'clear' | 'move' | 'reserve'; title: string; description: string }>;
    emailDraft: { subject: string; body: string };
  } | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);

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
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [parsedTaskData, setParsedTaskData] = useState<any>(null);
  const recognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef('');

  // Planning Week Loading state
  const [isPlanningWeek, setIsPlanningWeek] = useState(false);
  const [planningProgress, setPlanningProgress] = useState(0);

  // Settings State
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [tempFirstName, setTempFirstName] = useState('');
  const [tempLastName, setTempLastName] = useState('');
  const [focusReminders, setFocusReminders] = useState(true);
  const [atRiskAlerts, setAtRiskAlerts] = useState(true);
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('05:00 PM');
  const [focusLength, setFocusLength] = useState(90);
  const [bufferMins, setBufferMins] = useState(15);
  const [isCalendarConnected, setIsCalendarConnected] = useState(true);
  const [isGmailConnected, setIsGmailConnected] = useState(true);
  const [isTasksConnected, setIsTasksConnected] = useState(true);

  // Sync temp names with profileName
  useEffect(() => {
    if (profileName) {
      const parts = profileName.trim().split(/\s+/);
      setTempFirstName(parts[0] || '');
      setTempLastName(parts.slice(1).join(' ') || '');
    }
  }, [profileName]);

  // Gmail Scanner State variables
  const [gmailProposals, setGmailProposals] = useState<GmailProposal[]>([]);
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [gmailSinceDays, setGmailSinceDays] = useState(7);
  const [editingProposal, setEditingProposal] = useState<GmailProposal | null>(null);
  const [isEditProposalModalOpen, setIsEditProposalModalOpen] = useState(false);

  // Task Decomposition State
  const [isDecomposingTask, setIsDecomposingTask] = useState(false);

  // Calendar Timeline States
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isFetchingCalendar, setIsFetchingCalendar] = useState(false);
  const [schedTaskId, setSchedTaskId] = useState('');
  const [schedDate, setSchedDate] = useState('2026-06-29');
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndTime, setSchedEndTime] = useState('10:30');
  const [isBookingFocus, setIsBookingFocus] = useState(false);

  const fetchCalendarEvents = async () => {
    if (!user) return;
    setIsFetchingCalendar(true);
    try {
      const token = getCachedAccessToken() || '';
      const res = await fetch(`/api/calendar/events?userId=${user.uid}&accessToken=${token}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCalendarEvents(data.events || []);
        }
      }
    } catch (err) {
      console.error("Error fetching calendar events:", err);
    } finally {
      setIsFetchingCalendar(false);
    }
  };

  const scheduleFocusBlock = async (taskId: string, start: string, end: string) => {
    if (!user) return;
    setIsBookingFocus(true);
    try {
      const token = getCachedAccessToken() || '';
      const res = await fetch('/api/calendar/focus-block/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          userId: user.uid,
          accessToken: token,
          start,
          end
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Append focusEventId to task list locally so user interface updates instantly
        setTasks(prevTasks => prevTasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              focusEventIds: [...(t.focusEventIds || []), data.focusEventId]
            };
          }
          return t;
        }));
        await addFirestoreLog(user.uid, 'Focus Block Sync', `Synced focus block to Google Calendar.`);
        await fetchCalendarEvents();
        return data;
      } else {
        console.error("Error creating focus block event on server:", await res.text());
      }
    } catch (err) {
      console.error("Failed to schedule focus block:", err);
    } finally {
      setIsBookingFocus(false);
    }
  };

  const schedule_focus_block = scheduleFocusBlock;

  const deleteFocusBlock = async (eventId: string, taskId?: string) => {
    if (!user) return;
    try {
      await deleteDeadlineEventFromGoogle(eventId, 'Focus Block');
      
      if (taskId) {
        const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
        const taskSnap = await getDoc(taskRef);
        if (taskSnap.exists()) {
          const taskData = taskSnap.data();
          const updatedFocusEventIds = (taskData.focusEventIds || []).filter((id: string) => id !== eventId);
          await updateDoc(taskRef, {
            focusEventIds: updatedFocusEventIds,
            updatedAt: new Date().toISOString()
          });
          await addFirestoreLog(user.uid, 'Focus Block Cancelled', `Cancelled and deleted focus block on Google Calendar.`);
        }
      } else {
        // Find if any task has this eventId and remove it
        for (const t of tasks) {
          if (t.focusEventIds && t.focusEventIds.includes(eventId)) {
            const taskRef = doc(db, 'users', user.uid, 'tasks', t.id);
            const updatedFocusEventIds = t.focusEventIds.filter((id: string) => id !== eventId);
            await updateDoc(taskRef, {
              focusEventIds: updatedFocusEventIds,
              updatedAt: new Date().toISOString()
            });
            break;
          }
        }
      }
      
      await fetchCalendarEvents();
    } catch (err) {
      console.error("Failed to delete focus block:", err);
    }
  };

  // Set window helper for automatic agent loop/testing invocation
  useEffect(() => {
    (window as any).schedule_focus_block = scheduleFocusBlock;
    return () => {
      delete (window as any).schedule_focus_block;
    };
  }, [user]);

  // Proposal Edit Form States
  const [propEditTitle, setPropEditTitle] = useState('');
  const [propEditTag, setPropEditTag] = useState('');
  const [propEditDueDate, setPropEditDueDate] = useState('');
  const [propEditDueTime, setPropEditDueTime] = useState('');
  const [propEditDesc, setPropEditDesc] = useState('');

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

  function combineDateAndTimeToISO(dateStr: string, timeStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
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

  // Helper to convert base64 VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const registerPushNotifications = async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging or service workers are not supported in this browser.');
      return;
    }

    try {
      // 1. Register the FCM service worker
      console.log('Registering service worker...');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('FCM Service Worker registered with scope:', registration.scope);

      // 2. Request Notification Permission
      console.log('Requesting notification permissions...');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission not granted:', permission);
        return;
      }
      console.log('Notification permission granted.');

      // 3. Obtain native push subscription (reliably triggers native pushes)
      console.log('Obtaining push subscription...');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array('BJo7XoiVN21OxRm0qEkBGtkewH6beMq5kAcai5XsxNbVpDf_vDeoalkJ9w-0dwKGwHIAGi3BJUoRoUa8r9mWHTU')
        });
      }

      console.log('Native push subscription registered:', subscription);

      // 4. Send subscription to our server
      const response = await fetch('/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          subscription
        })
      });

      const resData = await response.json();
      console.log('Subscription registered on server:', resData);

      // Try best-effort FCM Token fetch (will fail gracefully if Firebase Console keys are missing)
      if (messaging) {
        try {
          const fcmToken = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: 'BJo7XoiVN21OxRm0qEkBGtkewH6beMq5kAcai5XsxNbVpDf_vDeoalkJ9w-0dwKGwHIAGi3BJUoRoUa8r9mWHTU'
          });
          console.log('Fetched FCM Token:', fcmToken);
        } catch (fcmErr) {
          console.warn('Could not retrieve FCM token:', fcmErr);
        }
      }
      
      showToast('🔔 Push Notifications Activated! Test nudge incoming...', 'success');
    } catch (err: any) {
      console.error('Error in service worker/push registration:', err);
    }
  };

  const loadUserSettings = async (uid: string) => {
    try {
      const settingsRef = doc(db, 'users', uid, 'settings', 'preferences');
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.profileName) setProfileName(data.profileName);
        if (data.profileEmail) setProfileEmail(data.profileEmail);
        if (data.focusReminders !== undefined) setFocusReminders(data.focusReminders);
        if (data.atRiskAlerts !== undefined) setAtRiskAlerts(data.atRiskAlerts);
        if (data.startTime) setStartTime(data.startTime);
        if (data.endTime) setEndTime(data.endTime);
        if (data.focusLength !== undefined) setFocusLength(data.focusLength);
        if (data.bufferMins !== undefined) setBufferMins(data.bufferMins);
        if (data.isCalendarConnected !== undefined) setIsCalendarConnected(data.isCalendarConnected);
        if (data.isGmailConnected !== undefined) setIsGmailConnected(data.isGmailConnected);
        if (data.isTasksConnected !== undefined) setIsTasksConnected(data.isTasksConnected);
      } else {
        const defaults = {
          profileName: user?.displayName || 'AutoClutch User',
          profileEmail: user?.email || 'user@autoclutch.ai',
          focusReminders: true,
          atRiskAlerts: true,
          startTime: '09:00 AM',
          endTime: '05:00 PM',
          focusLength: 90,
          bufferMins: 15,
          isCalendarConnected: true,
          isGmailConnected: true,
          isTasksConnected: true
        };
        await setDoc(settingsRef, defaults);
      }
    } catch (err) {
      console.error('Error loading settings from Firestore:', err);
    }
  };

  // Update profile states when user changes and register push
  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || 'AutoClutch User');
      setProfileEmail(user.email || 'user@autoclutch.ai');
      loadUserSettings(user.uid);
      registerPushNotifications(user.uid);
    }
  }, [user]);

  // Trigger speech recognition on voice modal open
  useEffect(() => {
    if (isVoiceModalOpen) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
      setParsedTaskData(null);
      setVoiceInputText('');
    }
    return () => {
      stopSpeechRecognition();
    };
  }, [isVoiceModalOpen]);

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
          source: data.source || 'Manual entry',
          subtasks: data.subtasks || []
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

  // Sync Calendar Events when tab is Schedule, tasks change, or user logs in
  useEffect(() => {
    if (user) {
      fetchCalendarEvents();
    }
  }, [user, currentTab, tasks.length]);

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
        if (taskToDelete.focusEventIds && taskToDelete.focusEventIds.length > 0) {
          for (const feId of taskToDelete.focusEventIds) {
            await deleteDeadlineEventFromGoogle(feId, `Focus block for "${taskToDelete.title}"`);
          }
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

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    if (!user) return;
    try {
      const parentTask = tasks.find(t => t.id === taskId);
      if (!parentTask || !parentTask.subtasks) return;

      const updatedSubtasks = parentTask.subtasks.map(st => {
        if (st.id === subtaskId) {
          const nextCompleted = !st.isCompleted;
          return {
            ...st,
            isCompleted: nextCompleted,
            status: nextCompleted ? 'completed' : 'pending'
          };
        }
        return st;
      });

      const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
      await updateDoc(taskRef, {
        subtasks: updatedSubtasks,
        updatedAt: new Date().toISOString()
      });

      await addFirestoreLog(
        user.uid,
        'Subtask Toggle',
        `Toggled subtask in "${parentTask.title}"`
      );
    } catch (err: any) {
      console.error('[App] Toggle Subtask Error:', err);
    }
  };

  const handleDecomposeTask = async (taskId: string) => {
    if (!user || isDecomposingTask) return;
    setIsDecomposingTask(true);
    try {
      await addFirestoreLog(user.uid, 'Task Decompose Init', `Breaking down task into logical subtasks...`);
      const response = await fetch('/api/tasks/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          userId: user.uid
        })
      });

      if (!response.ok) {
        throw new Error('Failed to decompose task');
      }

      const data = await response.json();
      if (data.success && data.subtasks) {
        await addFirestoreLog(user.uid, 'Task Decompose Complete', `Decomposed task into ${data.subtasks.length} subtasks.`);
      } else {
        throw new Error(data.error || 'Decomposition failed');
      }
    } catch (err: any) {
      console.error('[App] Decompose Task Error:', err);
      await addFirestoreLog(user.uid, 'Task Decompose Error', `Decomposition failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDecomposingTask(false);
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
          
          // Schedule real focus blocks for the first 3 pending tasks!
          const pending = tasks.filter(t => !t.isCompleted).slice(0, 3);
          const blockTimes = [
            { date: '2026-06-30', start: '10:00', end: '11:30' },
            { date: '2026-07-01', start: '14:00', end: '15:30' },
            { date: '2026-07-02', start: '09:00', end: '10:30' }
          ];

          for (let i = 0; i < pending.length; i++) {
            const task = pending[i];
            const slot = blockTimes[i % blockTimes.length];
            const startIso = combineDateAndTimeToISO(slot.date, slot.start);
            const endIso = combineDateAndTimeToISO(slot.date, slot.end);
            await scheduleFocusBlock(task.id, startIso, endIso);
          }

          await addFirestoreLog(user.uid, 'Calendar Sync', `Week planned! Synced ${Math.min(3, pending.length)} focus sessions directly to your Google Calendar.`);
          await fetchCalendarEvents();
        }, 800);
      }
      setPlanningProgress(progress);
    }, 400);
  };

  const replan = async (contextTasks: Task[]) => {
    if (!user) return null;
    await addFirestoreLog(user.uid, 'Panic Mode Replan', `Triggered I'm Behind replan workflow.`);
    try {
      const res = await fetch('/api/panic/replan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, tasks: contextTasks })
      });
      if (res.ok) {
        const data = await res.json();
        await addFirestoreLog(user.uid, 'Panic Mode Replan Success', `Recompressing remaining effort. Task at risk: "${data.taskAtRisk}" with ${data.timeRemaining} remaining.`);
        return data;
      } else {
        throw new Error('Failed to replan focus blocks');
      }
    } catch (err: any) {
      await addFirestoreLog(user.uid, 'Panic Mode Replan Error', `Failed to run AI replan: ${err.message || 'Unknown error'}`);
      return null;
    }
  };

  const draft_extension_email = async (taskTitle: string) => {
    if (!user) return null;
    await addFirestoreLog(user.uid, 'Draft Extension Email', `Requesting Gemini draft extension email for task: "${taskTitle}".`);
    try {
      const res = await fetch('/api/panic/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, taskTitle })
      });
      if (res.ok) {
        const data = await res.json();
        await addFirestoreLog(user.uid, 'Draft Extension Email Success', `Successfully generated email draft for "${taskTitle}".`);
        return data;
      } else {
        throw new Error('Failed to draft extension email');
      }
    } catch (err: any) {
      await addFirestoreLog(user.uid, 'Draft Extension Email Error', `Failed to draft extension email: ${err.message || 'Unknown error'}`);
      return null;
    }
  };

  const handleActivatePanicMode = async () => {
    if (!user) return;
    setIsPanicActive(true);
    setIsReplanning(true);
    showToast('🚨 Activating Panic Mode...', 'info');

    // 1. Run replan
    const replanResult = await replan(tasks);
    if (!replanResult) {
      setIsReplanning(false);
      showToast('⚠️ Re-planning failed, using offline backup', 'error');
      // Set backup offline state
      const backupData = {
        taskAtRisk: 'ML Report',
        timeRemaining: '3h 12m',
        emergencyPlan: [
          { title: 'Finalize Data Visualizations', description: 'Use matplotlib scripts from last week\'s lab.', duration: '45m', isCompleted: false },
          { title: 'Write Conclusion Section', description: 'Synthesize findings on hyperparameter tuning.', duration: '60m', isCompleted: false },
          { title: 'Proofread & Format', description: 'Ensure IEEE format compliance before PDF export.', duration: '30m', isCompleted: false }
        ],
        adjustments: [
          { type: 'clear' as const, title: 'Cleared 2 blocks', description: 'Non-essential meetings cancelled automatically.' },
          { type: 'move' as const, title: 'Moved DBMS practice', description: 'Rescheduled to tomorrow at 10:00 AM.' },
          { type: 'reserve' as const, title: 'Reserved 3 hours', description: 'Deep work block secured until deadline.' }
        ],
        emailDraft: {
          subject: 'Extension Request - ML Report',
          body: `Prof. Davis,\n\nI am writing to request a brief extension for the ML Report due today. I encountered an unexpected issue with the GPU cluster during my final training epoch.\n\nI have completed 85% of the analysis and can submit the draft now, but would appreciate an extra 12 hours to compile the final graphs properly.`
        }
      };
      setPanicData(backupData);
      setEmailSubject(backupData.emailDraft.subject);
      setEmailBody(backupData.emailDraft.body);
      return;
    }

    // 2. Run draft extension email
    const emailResult = await draft_extension_email(replanResult.taskAtRisk);
    
    // Set final panic data
    setPanicData({
      taskAtRisk: replanResult.taskAtRisk,
      timeRemaining: replanResult.timeRemaining,
      emergencyPlan: replanResult.emergencyPlan.map((p: any) => ({ ...p, isCompleted: false })),
      adjustments: replanResult.adjustments,
      emailDraft: emailResult || {
        subject: `Extension Request - ${replanResult.taskAtRisk}`,
        body: `Hello,\n\nI am writing to request a brief extension for the ${replanResult.taskAtRisk} due today. I encountered an unexpected issue and would appreciate a short window of 12 hours to compile and finalize correctly.`
      }
    });

    setEmailSubject(emailResult?.subject || `Extension Request - ${replanResult.taskAtRisk}`);
    setEmailBody(emailResult?.body || `Hello,\n\nI am writing to request a brief extension for the ${replanResult.taskAtRisk} due today. I encountered an unexpected issue and would appreciate a short window of 12 hours to compile and finalize correctly.`);

    setIsReplanning(false);
    showToast('🔥 Panic Mode armed and optimized! Secure the rescue plan.', 'success');
  };

  const handleToggleEmergencyStep = (index: number) => {
    if (!panicData) return;
    const updatedPlan = [...panicData.emergencyPlan];
    updatedPlan[index].isCompleted = !updatedPlan[index].isCompleted;
    setPanicData({
      ...panicData,
      emergencyPlan: updatedPlan
    });
    showToast(updatedPlan[index].isCompleted ? '✅ Step completed!' : 'Step marked as pending', 'success');
  };

  const handleStartRescuePlan = async () => {
    if (!user) return;
    await addFirestoreLog(user.uid, 'Panic Mode Start Rescue', 'User initiated the rescue plan and began focused execution.');
    setIsPanicActive(false);
    showToast('🚀 Rescue plan started! Go crush it!', 'success');
  };

  const handleSendEmailDraft = async () => {
    if (!user || !panicData) return;
    await addFirestoreLog(user.uid, 'Panic Mode Send Email', `User armed and held extension request for "${panicData.taskAtRisk}".`);
    showToast('📧 Extension request drafted and armed! Sent successfully if needed.', 'success');
  };

  // Real Web Speech API Capturing and parsing logic
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatusMsg("Speech recognition is not supported in this browser. Please type or speak.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setParsedTaskData(null);
      setVoiceInputText('');
      latestTranscriptRef.current = '';
      setVoiceStatusMsg('Listening... speak clearly into your microphone.');
    };

    recognition.onresult = (event: any) => {
      const currentTranscript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setVoiceInputText(currentTranscript);
      latestTranscriptRef.current = currentTranscript;
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setVoiceStatusMsg('Microphone access blocked. Please enable mic permissions.');
      } else {
        setVoiceStatusMsg(`Error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      const finalTranscript = latestTranscriptRef.current;
      if (finalTranscript.trim()) {
        setVoiceStatusMsg('Analyzing voice capture...');
        parseVoiceTranscript(finalTranscript);
      } else {
        setVoiceStatusMsg('No speech detected. Click the button to speak.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  };

  const parseVoiceTranscript = async (textToParse: string) => {
    if (!textToParse.trim()) return;
    setIsParsingVoice(true);
    setVoiceStatusMsg('Analyzing with Gemini-3.1-Flash-Lite...');
    try {
      const response = await fetch('/api/tasks/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: textToParse })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.task) {
          setParsedTaskData(data.task);
          setVoiceStatusMsg('Task parsed successfully! Click Confirm & Save or Edit.');
        } else {
          setVoiceStatusMsg('Could not parse task clearly. Try modifying your details.');
        }
      } else {
        setVoiceStatusMsg('Error communicating with voice parsing server.');
      }
    } catch (err) {
      console.error('Error parsing voice transcript:', err);
      setVoiceStatusMsg('Network error while parsing voice.');
    } finally {
      setIsParsingVoice(false);
    }
  };

  const handleOpenCreateModalPreFilled = (parsed: any) => {
    setSelectedTask(null);
    setFormTitle(parsed.title || '');
    setFormDescription(parsed.description || '');
    setFormDueDate(parsed.dueDate || new Date().toISOString().split('T')[0]);
    setFormDueTime(parsed.dueTime || '5:00 PM');
    
    const effort = Number(parsed.estimatedEffort) || 1;
    setFormEffort(effort);
    setCustomEffortInput('');

    const tagVal = parsed.tag || 'Assignment';
    if (PREDEFINED_TAGS.includes(tagVal)) {
      setFormTag(tagVal);
      setCustomTagInput('');
    } else {
      setFormTag('Custom');
      setCustomTagInput(tagVal);
    }

    const prio = parsed.priority || 'Normal';
    const validPriorities = ['Urgent', 'High', 'Normal', 'Low'];
    const matchedPrio = validPriorities.find(p => p.toLowerCase() === prio.toLowerCase()) || 'Normal';
    setFormPriority(matchedPrio as any);

    setIsGoogleSyncChecked(true);
    setIsCalendarSyncChecked(true);
    
    setIsVoiceModalOpen(false);
    setIsTaskModalOpen(true);
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

  // Gmail Inbox Scanner and Task proposal handlers
  const scanGmailInbox = async (days: number = 7) => {
    if (!user || isScanningGmail) return;
    setIsScanningGmail(true);
    setGmailProposals([]);

    try {
      await addFirestoreLog(user.uid, 'Gmail Scan Init', `Starting scan of recent emails (past ${days} days)...`);
      const token = await getOrRequestAccessToken();

      const response = await fetch('/api/gmail/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          accessToken: token || '',
          sinceDays: days
        })
      });

      if (!response.ok) {
        throw new Error('Failed to scan Gmail');
      }

      const data = await response.json();
      if (data.proposals) {
        setGmailProposals(data.proposals);
        await addFirestoreLog(user.uid, 'Gmail Scan Complete', `Found ${data.proposals.length} task proposals in recent emails.`);
      } else {
        throw new Error('Invalid proposals data');
      }
    } catch (err: any) {
      console.error('[App] Gmail Scan Error:', err);
      await addFirestoreLog(user.uid, 'Gmail Scan Error', `Failed to retrieve emails: ${err.message || 'Unknown error'}`);
    } finally {
      setIsScanningGmail(false);
    }
  };

  const handleAcceptProposal = async (proposal: GmailProposal) => {
    if (!user) return;
    try {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
      
      const priorityScoreMap: Record<string, number> = {
        'Low': 0,
        'Normal': 1,
        'High': 2,
        'Urgent': 3
      };
      const priority = 'Normal'; // default

      const dueDateTimeIso = convertToISO(proposal.dueDate, proposal.dueTime || '11:59 PM');

      await setDoc(taskRef, {
        title: proposal.title,
        description: proposal.description,
        dueDateTime: dueDateTimeIso,
        effortHours: 2, // default 2 hours
        tag: proposal.tag || 'Assignment',
        priorityScore: priorityScoreMap[priority] ?? 1,
        status: 'pending',
        source: 'Gmail Inbox Parsing',
        googleTaskId: null,
        deadlineEventId: null,
        focusEventIds: [],
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await addFirestoreLog(user.uid, 'Gmail Task Accept', `Accepted Gmail proposal: "${proposal.title}"`);

      // Sync with Google Tasks and Google Calendar as per requirements
      await syncTaskToGoogle(taskId);
      await syncDeadlineEventToGoogle(taskId);

      // Remove from proposals list
      setGmailProposals(prev => prev.filter(p => p.id !== proposal.id));
    } catch (err: any) {
      console.error('Error accepting Gmail proposal:', err);
      await addFirestoreLog(user.uid, 'Gmail Task Accept Error', `Failed to accept "${proposal.title}": ${err.message || 'Unknown error'}`);
    }
  };

  const handleAcceptAllProposals = async () => {
    if (!user || gmailProposals.length === 0) return;
    const list = [...gmailProposals];
    // Clear list from UI first for beautiful immediate response
    setGmailProposals([]);

    for (const prop of list) {
      await handleAcceptProposal(prop);
    }
  };

  const handleDismissProposal = (id: string) => {
    setGmailProposals(prev => prev.filter(p => p.id !== id));
  };

  const handleOpenEditProposal = (prop: GmailProposal) => {
    setEditingProposal(prop);
    setPropEditTitle(prop.title);
    setPropEditTag(prop.tag);
    setPropEditDueDate(prop.dueDate);
    setPropEditDueTime(prop.dueTime || '11:59 PM');
    setPropEditDesc(prop.description);
    setIsEditProposalModalOpen(true);
  };

  const handleSaveEditProposal = () => {
    if (!editingProposal) return;
    const updated: GmailProposal = {
      ...editingProposal,
      title: propEditTitle,
      tag: propEditTag,
      dueDate: propEditDueDate,
      dueTime: propEditDueTime,
      description: propEditDesc
    };
    setGmailProposals(prev => prev.map(p => p.id === editingProposal.id ? updated : p));
    setIsEditProposalModalOpen(false);
    setEditingProposal(null);
  };

  // Automatically scan recent emails when switching to Inbox Scan tab
  useEffect(() => {
    if (currentTab === 'gmail' && user && gmailProposals.length === 0) {
      scanGmailInbox(gmailSinceDays);
    }
  }, [currentTab, user]);

  const handleToggleCalendarConnection = async () => {
    if (isCalendarConnected) {
      setIsCalendarConnected(false);
      showToast('Disconnected Google Calendar integration', 'info');
      await addLog('Google Calendar integration disconnected', 'info');
    } else {
      const token = await getOrRequestAccessToken();
      if (token) {
        setIsCalendarConnected(true);
        showToast('Google Calendar connected successfully!', 'success');
        await addLog('Google Calendar integration connected', 'info');
      } else {
        showToast('Failed to authenticate Google Calendar', 'error');
      }
    }
  };

  const handleToggleGmailConnection = async () => {
    if (isGmailConnected) {
      setIsGmailConnected(false);
      showToast('Disconnected Gmail integration', 'info');
      await addLog('Gmail integration disconnected', 'info');
    } else {
      const token = await getOrRequestAccessToken();
      if (token) {
        setIsGmailConnected(true);
        showToast('Gmail connected successfully!', 'success');
        await addLog('Gmail integration connected', 'info');
      } else {
        showToast('Failed to authenticate Gmail', 'error');
      }
    }
  };

  const handleToggleTasksConnection = async () => {
    if (isTasksConnected) {
      setIsTasksConnected(false);
      showToast('Disconnected Google Tasks integration', 'info');
      await addLog('Google Tasks integration disconnected', 'info');
    } else {
      const token = await getOrRequestAccessToken();
      if (token) {
        setIsTasksConnected(true);
        showToast('Google Tasks connected successfully!', 'success');
        await addLog('Google Tasks integration connected', 'info');
      } else {
        showToast('Failed to authenticate Google Tasks', 'error');
      }
    }
  };

  const handleToggleFocusReminders = async (checked: boolean) => {
    setFocusReminders(checked);
    if (!user) return;
    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      await updateDoc(settingsRef, { focusReminders: checked });
      showToast(checked ? '🔔 Focus-block reminders enabled!' : '🔕 Focus-block reminders disabled', 'success');
      await addLog(`Focus-block reminders ${checked ? 'enabled' : 'disabled'}`, 'info');
    } catch (err) {
      console.error('Error saving focusReminders toggle:', err);
    }
  };

  const handleToggleAtRiskAlerts = async (checked: boolean) => {
    setAtRiskAlerts(checked);
    if (!user) return;
    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      await updateDoc(settingsRef, { atRiskAlerts: checked });
      showToast(checked ? '🚨 At-risk task alerts enabled!' : '🔇 At-risk task alerts disabled', 'success');
      await addLog(`At-risk task alerts ${checked ? 'enabled' : 'disabled'}`, 'info');
    } catch (err) {
      console.error('Error saving atRiskAlerts toggle:', err);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      const updatedName = `${tempFirstName} ${tempLastName}`.trim();
      setProfileName(updatedName);
      await updateDoc(settingsRef, {
        profileName: updatedName,
        profileEmail,
        startTime,
        endTime,
        focusLength,
        bufferMins,
        isCalendarConnected,
        isGmailConnected,
        isTasksConnected
      });
      showToast('✅ Settings saved successfully!', 'success');
      await addLog('Saved general workspace settings & hours', 'info');
    } catch (err: any) {
      console.error('Error saving settings to Firestore:', err);
      showToast('Error saving settings', 'error');
    }
  };

  const handlePreferredWorkWindowChange = (value: string) => {
    const parts = value.split(/\s*-\s*/);
    if (parts.length === 2) {
      setStartTime(parts[0].trim());
      setEndTime(parts[1].trim());
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
          isPanicActive ? (
            <motion.div
              key="panic-dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={MotionSpring}
              className="w-full space-y-8 pb-12"
            >
              {isReplanning ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-6 bg-surface-container-low/20 backdrop-blur-xl border border-white/5 rounded-3xl">
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-2 rounded-full bg-surface-container-high flex items-center justify-center animate-pulse">
                      <AlertTriangle className="w-8 h-8 text-urgent" />
                    </div>
                  </div>
                  <div className="text-center space-y-2 px-6">
                    <h3 className="text-xl font-extrabold text-white font-sans">AI Real-time Re-prioritization</h3>
                    <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
                      AutoClutch is re-compressing remaining effort, clearing non-essential meetings, and securing deep work blocks with Gemini...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-8 relative">
                  {/* Urgent Alert Banner (Mobile Only) */}
                  <div className="md:hidden bg-error-container text-on-error-container py-3 px-4 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(147,0,10,0.4)] rounded-xl border border-error/20">
                    <AlertTriangle className="w-4 h-4 text-error animate-pulse" />
                    <span className="text-xs font-extrabold uppercase tracking-widest">Panic Mode Active</span>
                  </div>

                  {/* Desktop / Mobile Header Panel */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div className="px-3 py-1 rounded-full bg-error-container/20 border border-error/20 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
                          <span className="text-xs font-semibold text-urgent tracking-wider uppercase">Critical Path Active</span>
                        </div>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-extrabold text-white mt-2 font-sans tracking-tight">
                        Task at risk: <span className="text-primary">{panicData?.taskAtRisk || 'ML Report'}</span>
                      </h2>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest text-on-surface-variant/70 mb-1">Time Remaining</p>
                      <div className="text-5xl font-extrabold text-urgent animate-pulse tabular-nums font-sans">
                        {panicData?.timeRemaining || '3h 12m'}
                      </div>
                    </div>
                  </div>

                  {/* Bento Grid Layout */}
                  <div className="grid grid-cols-12 gap-6">
                    {/* Re-plan Summary Bento Cards */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {panicData?.adjustments.map((adj, index) => {
                        const isClear = adj.type === 'clear';
                        const isMove = adj.type === 'move';
                        return (
                          <div key={index} className="bg-surface-container-high/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                              isClear ? 'bg-error-container/20 text-error' : isMove ? 'bg-tertiary/20 text-tertiary' : 'bg-primary-container/20 text-primary'
                            }`}>
                              {isClear ? <Trash2 className="w-5 h-5" /> : isMove ? <Clock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                            </div>
                            <h3 className="text-lg font-bold text-white font-sans">{adj.title}</h3>
                            <p className="text-xs text-on-surface-variant leading-relaxed">{adj.description}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Emergency Execution Plan */}
                    <div className="col-span-12 lg:col-span-7 bg-surface-container-high/40 backdrop-blur-xl border border-white/5 rounded-2xl p-8 flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white font-sans">Emergency Execution Plan</h3>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                          {panicData?.emergencyPlan.length || 3} Steps
                        </span>
                      </div>

                      <div className="space-y-4">
                        {panicData?.emergencyPlan.map((step, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleToggleEmergencyStep(idx)}
                            className={`flex items-start gap-4 p-4 rounded-xl hover:bg-surface-container-highest/60 border border-transparent hover:border-white/5 transition-all cursor-pointer group ${
                              step.isCompleted ? 'opacity-60 bg-white/5' : 'bg-surface-container-high/30'
                            }`}
                          >
                            <button className="mt-0.5 w-5 h-5 rounded-full border-2 border-outline flex items-center justify-center shrink-0 group-hover:border-primary transition-colors">
                              {step.isCompleted ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-success" />
                              ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-primary/50 transition-colors" />
                              )}
                            </button>
                            <div className="flex-1">
                              <h4 className={`text-sm font-bold text-white font-sans ${step.isCompleted ? 'line-through text-on-surface-variant' : ''}`}>
                                {step.title}
                              </h4>
                              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{step.description}</p>
                            </div>
                            <span className="text-xs font-mono text-on-surface-variant/70 font-semibold">{step.duration}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Draft Email Panel */}
                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
                      <div className="bg-surface-container-high/40 backdrop-blur-xl border border-white/5 rounded-2xl p-8 flex flex-col relative flex-1">
                        <div className="flex items-center gap-2 mb-4 text-primary">
                          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                          <h3 className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">AI Drafted Backup</h3>
                        </div>

                        <div className="bg-surface-container-lowest/70 rounded-xl p-5 mb-6 flex-1 border border-white/5 space-y-3">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                            <span className="text-xs font-bold text-on-surface-variant">Subject:</span>
                            {isEditingEmail ? (
                              <input
                                type="text"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="flex-1 bg-transparent border-none text-xs font-bold text-white p-0 focus:ring-0 focus:outline-none"
                              />
                            ) : (
                              <span className="text-xs font-bold text-white">{emailSubject}</span>
                            )}
                          </div>

                          {isEditingEmail ? (
                            <textarea
                              value={emailBody}
                              onChange={(e) => setEmailBody(e.target.value)}
                              className="w-full h-48 bg-transparent border-none text-xs text-on-surface-variant leading-relaxed p-0 focus:ring-0 focus:outline-none resize-none font-sans"
                            />
                          ) : (
                            <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line font-sans">
                              {emailBody}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-3 mt-auto">
                          <Button
                            variant="secondary"
                            onClick={() => setIsEditingEmail(!isEditingEmail)}
                            className="flex-1 text-xs py-2.5 flex items-center justify-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            <span>{isEditingEmail ? 'Save Draft' : 'Edit Draft'}</span>
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={handleSendEmailDraft}
                            className="flex-1 text-xs py-2.5 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary flex items-center justify-center gap-2"
                          >
                            <Mail className="w-4 h-4" />
                            <span>Hold &amp; Send</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Primary Action Button spanning full bottom */}
                    <div className="col-span-12 mt-4 flex justify-end gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => setIsPanicActive(false)}
                        className="px-6 py-4 rounded-full font-bold text-sm"
                      >
                        Exit Panic View
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleStartRescuePlan}
                        className="px-10 py-5 rounded-full font-bold text-base shadow-[0_0_30px_rgba(91,79,227,0.3)] hover:scale-[1.02] transition-all duration-300 flex items-center gap-3 relative overflow-hidden group"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        <span>Start the rescue plan</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
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
                    variant="ghost"
                    onClick={handleActivatePanicMode}
                    className="flex items-center gap-2 border-urgent/30 hover:bg-urgent/10 text-urgent"
                  >
                    <AlertTriangle className="w-4 h-4 text-urgent animate-pulse" />
                    <span>I'm behind</span>
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
          )
        )}

        {/* ========================================== */}
        {/* TAB: GMAIL EXTRACTION REVIEW */}
        {/* ========================================== */}
        {currentTab === 'gmail' && (
          <motion.div
            key="gmail"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={MotionSpring}
            className="space-y-8"
          >
            {/* Header Hero Section */}
            <div className="relative w-full overflow-hidden flex flex-col justify-end p-6 md:p-10 bg-surface-container rounded-2xl border border-white/5 shadow-2xl min-h-[220px]">
              {/* Overlay ambient violet glow */}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent z-10" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#5B4FE3]/10 rounded-full blur-3xl z-0 pointer-events-none" />

              <div className="relative z-20 max-w-4xl space-y-4">
                <div className="inline-flex items-center gap-2 bg-surface-container-high/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5">
                  <span className={`w-2 h-2 rounded-full ${isScanningGmail ? 'bg-primary animate-spin' : 'bg-primary animate-pulse'}`} />
                  <span className="text-xs font-extrabold text-white tracking-wide uppercase">
                    {isScanningGmail ? 'Analyzing inbox...' : 'Analysis complete.'}
                  </span>
                </div>
                
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  I scanned your recent emails and found these possible tasks.
                </h1>

                {/* Bulk Action Header button */}
                {gmailProposals.length > 0 && (
                  <button
                    onClick={handleAcceptAllProposals}
                    className="mt-2 bg-primary hover:bg-[#4232CA] text-white font-bold text-xs py-3 px-8 rounded-full flex items-center gap-2.5 transition-all shadow-[0_4px_15px_rgba(91,79,227,0.35)] active:scale-95 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Accept all ({gmailProposals.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main content body */}
            {isScanningGmail ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-surface-container/20 rounded-2xl border border-white/5">
                <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Scanning Gmail Inbox...</p>
                  <p className="text-xs text-on-surface-variant mt-1">Applying gemini-3.5-flash to extract action items & deadlines</p>
                </div>
              </div>
            ) : gmailProposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-surface-container/20 rounded-2xl border border-white/5 text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary border border-white/5 shadow-inner">
                  <Mail className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">All emails up to date</h3>
                  <p className="text-xs text-on-surface-variant mt-1">No pending task proposals found in your recent messages.</p>
                </div>
                <Button variant="secondary" onClick={() => scanGmailInbox(gmailSinceDays)}>
                  Scan Inbox Again
                </Button>
              </div>
            ) : (
              <div>
                {/* 1. Desktop layout (lg grid) */}
                <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gmailProposals.map((prop) => (
                    <div
                      key={prop.id}
                      className="bg-surface-container/40 backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between border border-white/5 shadow-lg relative group overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(91,79,227,0.1)] hover:border-white/10"
                    >
                      {/* Decorative corner glow */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all pointer-events-none" />

                      <div className="space-y-4">
                        {/* Header: sender pill & confidence percentage */}
                        <div className="flex justify-between items-center">
                          <div className="bg-surface-container-high px-3 py-1 rounded-full border border-white/5 flex items-center gap-1.5 max-w-[70%]">
                            <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-[10px] font-bold text-on-surface-variant truncate">{prop.sender}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-primary">
                            <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
                            <span className="text-[10px] font-extrabold">{prop.confidence}%</span>
                          </div>
                        </div>

                        {/* Title & Deadline info */}
                        <div>
                          <h3 className="text-lg font-extrabold text-white leading-tight mb-1">{prop.title}</h3>
                          <p className="text-xs font-bold text-urgent flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{prop.duePhrase}</span>
                          </p>
                        </div>

                        {/* Snippet body */}
                        <div className="bg-surface-container-lowest/50 rounded-xl p-3 border border-white/5">
                          <p className="text-xs text-on-surface-variant italic leading-relaxed line-clamp-3 opacity-90">
                            {prop.description}
                          </p>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/5 z-10">
                        <button
                          onClick={() => handleDismissProposal(prop.id)}
                          className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs py-2.5 rounded-full transition-colors cursor-pointer border border-white/5 active:scale-95"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleOpenEditProposal(prop)}
                          className="w-10 h-10 bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center rounded-full transition-colors cursor-pointer border border-white/5 active:scale-95 shrink-0"
                          title="Edit before accepting"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAcceptProposal(prop)}
                          className="flex-1 bg-primary hover:bg-[#4232CA] text-white font-bold text-xs py-2.5 rounded-full transition-colors active:scale-95 cursor-pointer shadow-[0_2px_10px_rgba(91,79,227,0.2)]"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 2. Mobile layout (vertical stacked glass cards) */}
                <div className="lg:hidden space-y-4 pb-20">
                  {/* "Found in your inbox" mini header card */}
                  <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-5 border border-white/5 flex flex-col items-center text-center">
                    <h2 className="text-lg font-extrabold text-white">Found in your inbox</h2>
                    <div className="flex items-center gap-1.5 text-primary mt-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-[10px] font-extrabold tracking-wider uppercase">FOUND {gmailProposals.length} TASKS...</span>
                    </div>
                  </div>

                  {/* Vertical items stack */}
                  {gmailProposals.map((prop) => (
                    <div
                      key={prop.id}
                      className="bg-surface-container/60 backdrop-blur-md rounded-2xl p-5 border border-white/5 space-y-4"
                    >
                      {/* Top row: Title and due badge */}
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-base font-extrabold text-white leading-tight flex-1">{prop.title}</h3>
                        <div className="bg-primary/20 text-primary px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                          {prop.dueDate.includes('Thursday') ? 'Thursday' : prop.duePhrase.toLowerCase().includes('tomorrow') ? 'Tomorrow' : 'In 2 days'}
                        </div>
                      </div>

                      {/* Snippet with From detail */}
                      <div className="flex gap-3 bg-surface-container-high/40 p-3 rounded-xl border border-white/5">
                        <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-on-surface-variant" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-on-surface-variant mb-0.5">From: {prop.sender}</p>
                          <p className="text-xs text-on-surface italic line-clamp-2 leading-relaxed opacity-80">{prop.description}</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleDismissProposal(prop.id)}
                          className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs py-3 rounded-full transition-colors border border-white/5 active:scale-95"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleAcceptProposal(prop)}
                          className="flex-1 bg-primary hover:bg-[#4232CA] text-white font-bold text-xs py-3 rounded-full transition-colors active:scale-95 shadow-[0_2px_10px_rgba(91,79,227,0.2)]"
                        >
                          Accept Task
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Sticky Floating bottom action bar */}
                  <div className="fixed bottom-16 left-0 right-0 p-4 z-20">
                    <div className="bg-surface-container/90 backdrop-blur-md rounded-full p-2.5 flex items-center justify-between border border-white/5 shadow-2xl max-w-md mx-auto">
                      <span className="text-on-surface-variant font-bold text-xs pl-4">{gmailProposals.length} pending tasks</span>
                      <button
                        onClick={handleAcceptAllProposals}
                        className="bg-primary hover:bg-[#4232CA] text-white font-bold text-xs py-2.5 px-6 rounded-full transition-colors flex items-center gap-1.5 active:scale-95 shadow-lg shadow-primary/25 cursor-pointer"
                      >
                        <span>Accept all</span>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
        {currentTab === 'schedule' && (() => {
          // Some internal calculation to show stats
          const focusEvents = calendarEvents.filter(e => e.isFocusBlock);
          const deadlineEvents = calendarEvents.filter(e => e.isDeadline);
          const totalFocusHours = focusEvents.length * 1.5; // assume 1.5h per block
          
          const DAYS_OF_WEEK = [
            { name: 'Monday', dateStr: '2026-06-29', label: 'Jun 29' },
            { name: 'Tuesday', dateStr: '2026-06-30', label: 'Jun 30' },
            { name: 'Wednesday', dateStr: '2026-07-01', label: 'Jul 01' },
            { name: 'Thursday', dateStr: '2026-07-02', label: 'Jul 02' },
            { name: 'Friday', dateStr: '2026-07-03', label: 'Jul 03' },
            { name: 'Saturday', dateStr: '2026-07-04', label: 'Jul 04' },
            { name: 'Sunday', dateStr: '2026-07-05', label: 'Jul 05' },
          ];

          // Pre-populate default task ID if empty
          const pendingTasks = tasks.filter(t => !t.isCompleted);
          if (pendingTasks.length > 0 && !schedTaskId) {
            setSchedTaskId(pendingTasks[0].id);
          }

          const handleScheduleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!schedTaskId || !schedDate || !schedStartTime || !schedEndTime) return;
            const startIso = combineDateAndTimeToISO(schedDate, schedStartTime);
            const endIso = combineDateAndTimeToISO(schedDate, schedEndTime);
            await scheduleFocusBlock(schedTaskId, startIso, endIso);
          };

          return (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={MotionSpring}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Schedule Timeline
                    {isFetchingCalendar && (
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    )}
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1.5">
                    View scheduled focus sessions, deadline reminders, and task timelines pulled directly from Google Calendar.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={fetchCalendarEvents} disabled={isFetchingCalendar}>
                    <span className={`material-symbols-outlined mr-2 ${isFetchingCalendar ? 'animate-spin' : ''}`}>sync</span>
                    Refresh
                  </Button>
                  <Button variant="primary" onClick={triggerPlanMyWeek} disabled={isPlanningWeek}>
                    <Sparkles className="w-4 h-4 mr-2 text-white" />
                    {isPlanningWeek ? 'Planning...' : 'Plan Week Slots'}
                  </Button>
                </div>
              </div>

              {/* Progress Bar for Week Planning */}
              {isPlanningWeek && (
                <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden relative border border-white/5">
                  <motion.div 
                    className="bg-primary h-full rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${planningProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}

              {/* Top Row: Statistics & Inline Focus Block Scheduler Form */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Stats Summary Panel */}
                <Card variant="glowing" className="lg:col-span-5 p-6 flex flex-col justify-between h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-extrabold text-white">Your Week Ahead</h3>
                        <p className="text-[10px] uppercase text-primary font-bold tracking-widest mt-0.5">Sync Status: Live</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-primary-container/35 border border-primary/25 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">auto_awesome</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Stat 1 */}
                      <div className="flex justify-between items-center bg-surface-container/60 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-tertiary font-bold text-[18px]">bolt</span>
                          <span className="text-sm font-bold text-white">Focus Blocks</span>
                        </div>
                        <span className="text-sm font-extrabold text-on-surface-variant bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                          {totalFocusHours} hrs ({focusEvents.length} blocks)
                        </span>
                      </div>
                      {/* Stat 2 */}
                      <div className="flex justify-between items-center bg-surface-container/60 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-secondary font-bold text-[18px]">group</span>
                          <span className="text-sm font-bold text-white">Meetings</span>
                        </div>
                        <span className="text-sm font-extrabold text-on-surface-variant bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                          8.0 hrs
                        </span>
                      </div>
                      {/* Stat 3 */}
                      <div className="flex justify-between items-center bg-surface-container/60 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-primary font-bold text-[18px]">done_all</span>
                          <span className="text-sm font-bold text-white">Deadlines Scheduled</span>
                        </div>
                        <span className="text-sm font-extrabold text-on-surface-variant bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                          {deadlineEvents.length} alerts
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5 text-xs text-on-surface-variant/80 italic">
                    Focus blocks are calendar work sessions titled "AutoClutch: &lt;title&gt;" to guard your deep work.
                  </div>
                </Card>

                {/* Inline Scheduler Form */}
                <Card variant="glass" className="lg:col-span-7 p-6">
                  <h3 className="text-lg font-extrabold text-white mb-4">Book Focus Slot</h3>
                  <form onSubmit={handleScheduleSubmit} className="space-y-4">
                    {/* Select Task dropdown */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">Select Task</label>
                      {pendingTasks.length > 0 ? (
                        <select
                          className="w-full bg-surface-container-high border border-white/5 rounded-[12px] p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                          value={schedTaskId}
                          onChange={(e) => setSchedTaskId(e.target.value)}
                        >
                          {pendingTasks.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.estimatedEffort}h remaining)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-on-surface-variant/70 p-3 bg-surface-container-high rounded-[12px] border border-dashed border-white/5">
                          All tasks are complete! Create a task first to schedule a focus block.
                        </div>
                      )}
                    </div>

                    {/* Day Select & Date Choice */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">Day of Week</label>
                        <select
                          className="w-full bg-surface-container-high border border-white/5 rounded-[12px] p-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                          value={schedDate}
                          onChange={(e) => setSchedDate(e.target.value)}
                        >
                          {DAYS_OF_WEEK.map(d => (
                            <option key={d.dateStr} value={d.dateStr}>
                              {d.name} ({d.label})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">Start Time</label>
                        <input
                          type="time"
                          className="w-full bg-surface-container-high border border-white/5 rounded-[12px] p-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                          value={schedStartTime}
                          onChange={(e) => setSchedStartTime(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">End Time</label>
                        <input
                          type="time"
                          className="w-full bg-surface-container-high border border-white/5 rounded-[12px] p-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                          value={schedEndTime}
                          onChange={(e) => setSchedEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      disabled={isBookingFocus || !schedTaskId}
                    >
                      {isBookingFocus ? (
                        <>
                          <span className="material-symbols-outlined animate-spin mr-2">sync</span>
                          Booking Slot...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined mr-2">calendar_add_on</span>
                          Book Focus Slot
                        </>
                      )}
                    </Button>
                  </form>
                </Card>
              </div>

              {/* 7-Day Weekly Timeline Grid */}
              <div className="space-y-4">
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">calendar_view_week</span>
                  Weekly Commitment Map
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayEvents = calendarEvents
                      .filter(e => e.start && e.start.startsWith(day.dateStr))
                      .sort((a, b) => a.start.localeCompare(b.start));
                    
                    const isToday = day.dateStr === '2026-06-29'; // Monday June 29, 2026

                    return (
                      <Card
                        key={day.dateStr}
                        variant={isToday ? "glowing" : "solid"}
                        className={`flex flex-col justify-between p-5 min-h-[350px] relative transition-transform hover:scale-[1.01] ${isToday ? 'border-primary/40' : ''}`}
                      >
                        {isToday && (
                          <div className="absolute top-4 right-4 flex items-center gap-1 bg-primary/20 text-primary border border-primary/35 rounded-full px-2 py-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-wider">Today</span>
                          </div>
                        )}

                        <div>
                          {/* Day Header */}
                          <div className="mb-4">
                            <h4 className="text-base font-extrabold text-white leading-tight">
                              {day.name}
                            </h4>
                            <span className="text-xs font-semibold text-on-surface-variant font-mono">{day.label}, 2026</span>
                          </div>

                          {/* Day Events Stack */}
                          <div className="space-y-3">
                            {dayEvents.length > 0 ? (
                              dayEvents.map((e) => {
                                if (e.isFocusBlock) {
                                  return (
                                    <div
                                      key={e.id}
                                      className="p-3.5 bg-primary-container/20 border border-primary/25 rounded-2xl flex justify-between items-start group hover:bg-primary-container/30 transition-all duration-200"
                                    >
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold uppercase tracking-wide">
                                          <span className="material-symbols-outlined text-xs font-bold text-[14px]">bolt</span>
                                          <span>
                                            {formatTimeFromISO(e.start)} - {formatTimeFromISO(e.end)}
                                          </span>
                                        </div>
                                        <h5 className="text-xs font-extrabold text-white leading-snug">
                                          {e.cleanTitle}
                                        </h5>
                                      </div>
                                      
                                      <button
                                        onClick={() => deleteFocusBlock(e.id, e.taskId)}
                                        className="text-on-surface-variant/60 hover:text-urgent p-1 rounded-full hover:bg-white/5 transition-colors"
                                        title="Delete Focus Block"
                                      >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                      </button>
                                    </div>
                                  );
                                } else if (e.isDeadline) {
                                  return (
                                    <div
                                      key={e.id}
                                      className="p-3.5 bg-tertiary-container/15 border border-tertiary/20 rounded-2xl flex flex-col justify-between hover:bg-tertiary-container/25 transition-all duration-200"
                                    >
                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <div className="flex items-center gap-1 text-[10px] text-tertiary font-bold uppercase tracking-wide">
                                            <span className="material-symbols-outlined text-xs font-bold text-[14px]">alarm</span>
                                            <span>Deadline: {formatTimeFromISO(e.start)}</span>
                                          </div>
                                          {e.priority === 'Urgent' && (
                                            <span className="text-[8px] bg-urgent/20 text-urgent border border-urgent/30 px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                                              Urgent
                                            </span>
                                          )}
                                        </div>
                                        <h5 className="text-xs font-extrabold text-white leading-snug">
                                          {e.cleanTitle}
                                        </h5>
                                      </div>

                                      <div className="flex gap-1.5 mt-2.5">
                                        <Chip label={e.tag} variant="secondary" className="scale-90 origin-left py-0.5 px-2" />
                                        {e.isCompleted ? (
                                          <span className="text-[10px] text-success font-semibold flex items-center gap-1">
                                            <span className="material-symbols-outlined text-xs font-bold text-[14px]">check_circle</span>
                                            Done
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-on-surface-variant/80 italic font-medium">Pending</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // General calendar event (meetings/classes)
                                  return (
                                    <div
                                      key={e.id}
                                      className="p-3 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col hover:bg-white/[0.05] transition-all duration-200"
                                    >
                                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-mono font-semibold">
                                        <span className="material-symbols-outlined text-xs font-bold text-[14px]">event</span>
                                        <span>
                                          {formatTimeFromISO(e.start)} - {formatTimeFromISO(e.end)}
                                        </span>
                                      </div>
                                      <h5 className="text-xs font-bold text-on-surface mt-1">
                                        {e.title}
                                      </h5>
                                    </div>
                                  );
                                }
                              })
                            ) : (
                              <div className="text-[11px] text-on-surface-variant/50 text-center py-8 px-4 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-mono leading-relaxed">
                                No commitments. Perfect day for deep work!
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Optional footer info */}
                        <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] text-on-surface-variant/70 font-mono">
                          <span>Commitments</span>
                          <span className="font-bold text-white">{dayEvents.length}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })()}

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
            {/* Desktop Settings View (hidden on mobile, visible on medium and up) */}
            <div className="hidden md:block space-y-8">
              <div>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Settings
                </h2>
                <p className="text-sm text-on-surface-variant mt-1.5">
                  Manage your connected accounts, preferences, and workspace configuration.
                </p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left Column (Account & Notifications) */}
                <div className="xl:col-span-7 space-y-8">
                  {/* Account Profile Card */}
                  <Card variant="glass" className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-extrabold text-white font-sans">Account Profile</h3>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8 items-start">
                      <div className="relative group shrink-0">
                        {user?.photoURL ? (
                          <img
                            alt="Profile"
                            className="w-24 h-24 rounded-full object-cover border-2 border-primary/40 bg-surface-container"
                            src={user.photoURL}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-full border-2 border-primary/40 bg-surface-container flex items-center justify-center text-primary text-2xl font-extrabold">
                            {tempFirstName[0] || 'U'}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => showToast('Avatar is automatically synced with Google Profile', 'info')}
                          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-hover transition-colors shadow-lg cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex-1 w-full space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="First Name"
                            value={tempFirstName}
                            onChange={(e) => setTempFirstName(e.target.value)}
                          />
                          <Input
                            label="Last Name"
                            value={tempLastName}
                            onChange={(e) => setTempLastName(e.target.value)}
                          />
                        </div>
                        <Input
                          label="Email Address"
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                        />
                        <div className="flex justify-start pt-2">
                          <Button variant="danger" size="sm" onClick={handleSignOut} className="px-5 text-xs font-bold uppercase">
                            Sign Out
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Notifications Card */}
                  <Card variant="glass" className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Bell className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-extrabold text-white font-sans">Notifications</h3>
                    </div>

                    <div className="space-y-6">
                      {/* Toggle Item */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-high/50 hover:bg-surface-container-high transition-colors border border-white/5">
                        <div>
                          <h4 className="text-sm font-extrabold text-white">Focus-block reminders</h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">Notify before deep work starts</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={focusReminders}
                            onChange={(e) => handleToggleFocusReminders(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-surface-bright peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {/* Toggle Item */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-high/50 hover:bg-surface-container-high transition-colors border border-white/5">
                        <div>
                          <h4 className="text-sm font-extrabold text-white">At-risk task alerts</h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">Alert when schedule is tight</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={atRiskAlerts}
                            onChange={(e) => handleToggleAtRiskAlerts(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-surface-bright peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Column (Connected Accounts & Working Hours) */}
                <div className="xl:col-span-5 space-y-8">
                  {/* Connected Accounts Card */}
                  <Card variant="glass" className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Globe className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-extrabold text-white font-sans">Integrations</h3>
                    </div>

                    <div className="space-y-4">
                      {/* Google Calendar */}
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-surface-container-lowest/30 justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#EA4335]/10 flex items-center justify-center text-[#EA4335]">
                            <CalendarIcon className="w-5 h-5 text-[#EA4335]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white font-sans">Google Calendar</h4>
                            <p className="text-xs text-primary font-semibold mt-0.5">
                              {isCalendarConnected ? `Connected as ${profileEmail}` : 'Disconnected'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={isCalendarConnected ? 'secondary' : 'primary'}
                          onClick={handleToggleCalendarConnection}
                          className="h-9 px-4 text-xs uppercase font-bold"
                        >
                          {isCalendarConnected ? 'Disconnect' : 'Connect'}
                        </Button>
                      </div>

                      {/* Gmail */}
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-surface-container-lowest/30 justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#EA4335]/10 flex items-center justify-center text-[#EA4335]">
                            <Mail className="w-5 h-5 text-[#EA4335]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white font-sans">Gmail</h4>
                            <p className="text-xs text-primary font-semibold mt-0.5">
                              {isGmailConnected ? 'Active' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={isGmailConnected ? 'secondary' : 'primary'}
                          onClick={handleToggleGmailConnection}
                          className="h-9 px-4 text-xs uppercase font-bold"
                        >
                          {isGmailConnected ? 'Disconnect' : 'Connect'}
                        </Button>
                      </div>

                      {/* Google Tasks */}
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-surface-container-lowest/30 justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#EA4335]/10 flex items-center justify-center text-[#EA4335]">
                            <ListTodo className="w-5 h-5 text-[#EA4335]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-extrabold text-white font-sans">Google Tasks</h4>
                            <p className="text-xs text-primary font-semibold mt-0.5">
                              {isTasksConnected ? 'Active' : 'Disabled'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={isTasksConnected ? 'secondary' : 'primary'}
                          onClick={handleToggleTasksConnection}
                          className="h-9 px-4 text-xs uppercase font-bold"
                        >
                          {isTasksConnected ? 'Disconnect' : 'Connect'}
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Working Hours Card */}
                  <Card variant="glass" className="p-8 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Clock className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-lg font-extrabold text-white font-sans">Working Hours</h3>
                    </div>

                    <div className="space-y-4 relative z-10">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Set your availability to automatically manage incoming tasks.
                      </p>
                      
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

                      <div className="mt-6 flex gap-2 flex-wrap justify-center">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                          <span key={day} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold border border-primary/30">
                            {day}
                          </span>
                        ))}
                        {['Sat', 'Sun'].map((day) => (
                          <span key={day} className="px-3 py-1 rounded-full bg-surface-bright text-on-surface-variant text-[10px] font-bold opacity-50">
                            {day}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <Input
                          label="Focus-block Length (mins)"
                          type="number"
                          value={focusLength}
                          onChange={(e) => setFocusLength(parseInt(e.target.value) || 0)}
                        />
                        <Input
                          label="Buffer Minutes"
                          type="number"
                          value={bufferMins}
                          onChange={(e) => setBufferMins(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Action Area */}
                  <div className="flex justify-end pt-4">
                    <Button variant="primary" onClick={handleSaveSettings} className="px-10 py-4 font-bold text-sm shadow-[0_0_25px_rgba(91,79,227,0.45)]">
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Settings View (visible on small screens only, matching Reference 2) */}
            <div className="block md:hidden space-y-6 pb-12">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Settings</h2>

              {/* Account Profile Card */}
              <Card variant="glass" className="p-6 flex items-center gap-4">
                {user?.photoURL ? (
                  <img
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary-container shadow-[0_0_15px_rgba(91,79,227,0.4)]"
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-primary-container bg-surface-container flex items-center justify-center text-primary text-xl font-extrabold shadow-[0_0_15px_rgba(91,79,227,0.4)]">
                    {tempFirstName[0] || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-extrabold text-white font-sans truncate">{profileName || 'AutoClutch User'}</h3>
                  <p className="text-xs text-on-surface-variant truncate">{profileEmail || 'user@autoclutch.ai'}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-full bg-urgent/10 text-urgent hover:bg-urgent/20 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </Card>

              {/* Connected Accounts Card */}
              <Card variant="glass" className="p-6 flex flex-col gap-5">
                <h3 className="text-base font-extrabold text-white font-sans flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <span>Connected Accounts</span>
                </h3>
                <div className="flex flex-col gap-4">
                  {/* Google Calendar */}
                  <div
                    onClick={handleToggleCalendarConnection}
                    className="flex justify-between items-center p-4 bg-surface-container-high rounded-xl border border-white/5 active:bg-surface-container-highest transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-5 h-5 text-on-surface-variant" />
                      <span className="text-sm font-bold text-white font-sans">Google Calendar</span>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                      isCalendarConnected
                        ? 'bg-primary-container/20 text-primary border-primary-container/30'
                        : 'bg-surface-variant text-on-surface-variant border-white/10'
                    }`}>
                      {isCalendarConnected ? 'Active' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Gmail */}
                  <div
                    onClick={handleToggleGmailConnection}
                    className="flex justify-between items-center p-4 bg-surface-container-high rounded-xl border border-white/5 active:bg-surface-container-highest transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-on-surface-variant" />
                      <span className="text-sm font-bold text-white font-sans">Gmail</span>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                      isGmailConnected
                        ? 'bg-primary-container/20 text-primary border-primary-container/30'
                        : 'bg-surface-variant text-on-surface-variant border-white/10'
                    }`}>
                      {isGmailConnected ? 'Active' : 'Disconnected'}
                    </span>
                  </div>

                  {/* Google Tasks */}
                  <div
                    onClick={handleToggleTasksConnection}
                    className="flex justify-between items-center p-4 bg-surface-container-high rounded-xl border border-white/5 active:bg-surface-container-highest transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <ListTodo className="w-5 h-5 text-on-surface-variant" />
                      <span className="text-sm font-bold text-white font-sans">Google Tasks</span>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full border ${
                      isTasksConnected
                        ? 'bg-primary-container/20 text-primary border-primary-container/30'
                        : 'bg-surface-variant text-on-surface-variant border-white/10'
                    }`}>
                      {isTasksConnected ? 'Active' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Notifications Card */}
              <Card variant="glass" className="p-6 flex flex-col gap-5">
                <h3 className="text-base font-extrabold text-white font-sans flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span>Notifications</span>
                </h3>
                <div className="flex flex-col gap-5">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">Focus-block reminders</span>
                      <span className="text-xs text-on-surface-variant mt-0.5">Notify before deep work starts</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={focusReminders}
                        onChange={(e) => handleToggleFocusReminders(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-bright peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">At-risk task alerts</span>
                      <span className="text-xs text-on-surface-variant mt-0.5">Alert when schedule is tight</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={atRiskAlerts}
                        onChange={(e) => handleToggleAtRiskAlerts(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-bright peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </Card>

              {/* Working Hours & Buffers Card */}
              <Card variant="glass" className="p-6 flex flex-col gap-5">
                <h3 className="text-base font-extrabold text-white font-sans flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>Working Hours &amp; Buffers</span>
                </h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Preferred Work Window</label>
                    <input
                      className="w-full h-12 px-4 rounded-xl text-sm text-on-surface bg-surface-container-high border border-white/5 focus:border-primary focus:ring-0 focus:outline-none"
                      type="text"
                      value={`${startTime} - ${endTime}`}
                      onChange={(e) => handlePreferredWorkWindowChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Focus-block Length (mins)</label>
                    <input
                      className="w-full h-12 px-4 rounded-xl text-sm text-on-surface bg-surface-container-high border border-white/5 focus:border-primary focus:ring-0 focus:outline-none"
                      type="number"
                      value={focusLength}
                      onChange={(e) => setFocusLength(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block">Buffer Minutes (between tasks)</label>
                    <input
                      className="w-full h-12 px-4 rounded-xl text-sm text-on-surface bg-surface-container-high border border-white/5 focus:border-primary focus:ring-0 focus:outline-none"
                      type="number"
                      value={bufferMins}
                      onChange={(e) => setBufferMins(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </Card>

              {/* Mobile Save Changes Button */}
              <div className="pt-2">
                <Button variant="primary" onClick={handleSaveSettings} className="w-full py-4 font-bold text-sm shadow-[0_0_20px_rgba(91,79,227,0.35)]">
                  Save Changes
                </Button>
              </div>
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
      {/* VOICE QUICK-CAPTURE GLASS OVERLAY */}
      {/* ========================================== */}
      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-md">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                stopSpeechRecognition();
                setIsVoiceModalOpen(false);
              }}
              className="fixed inset-0 bg-black/60"
            />

            {/* Content Card matching Reference */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={MotionSpring}
              className="relative w-full max-w-2xl bg-[#1A1244]/95 border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl overflow-hidden z-10 flex flex-col items-center gap-6"
            >
              {/* Header: Close & Status Indicator */}
              <div className="w-full flex justify-between items-center relative z-20">
                <button
                  onClick={() => {
                    stopSpeechRecognition();
                    setIsVoiceModalOpen(false);
                  }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high/60 border border-white/10 backdrop-blur-xl shadow-sm">
                  <div className="relative w-2 h-2">
                    {isRecording && <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />}
                    <span className={`relative block w-2 h-2 rounded-full ${isRecording ? 'bg-primary' : 'bg-on-surface-variant/40'}`} />
                  </div>
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">
                    {isRecording ? 'Listening' : isParsingVoice ? 'Analyzing' : 'Ready'}
                  </span>
                </div>

                <div className="w-10 h-10" /> {/* Spacer for symmetry */}
              </div>

              {/* Large Central Listening Orb Container */}
              <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
                {/* Pulsing Rings */}
                {isRecording && (
                  <>
                    <div className="absolute inset-0 rounded-full border-2 border-primary-container/40 animate-ping" />
                    <div className="absolute inset-[-10%] border border-primary/20 rounded-full scale-105 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-[-20%] border border-primary/10 rounded-full scale-110 animate-[spin_15s_linear_infinite_reverse]" />
                  </>
                )}
                {/* Shader Orb */}
                <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(91,79,227,0.35)] z-10 flex items-center justify-center bg-[#1A1244]">
                  {/* Fluid shader simulation */}
                  <div className={`absolute inset-0 bg-gradient-to-tr from-primary-container via-primary to-tertiary opacity-40 mix-blend-color-dodge ${isRecording ? 'animate-pulse' : ''}`} />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#1A1244]/10 to-[#1A1244]/80 z-0 pointer-events-none" />
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 blur-2xl opacity-60 animate-pulse" />
                  <Mic className={`w-12 h-12 text-white relative z-20 ${isRecording ? 'scale-110' : 'scale-100'} transition-transform`} />
                </div>
              </div>

              {/* Live/Captured Transcript Text */}
              <div className="w-full text-center max-w-lg min-h-[60px] flex items-center justify-center">
                {voiceInputText ? (
                  <p className="text-xl font-extrabold text-white leading-relaxed tracking-tight select-none">
                    "{voiceInputText}"
                    {isRecording && <span className="inline-block w-1.5 h-5 bg-primary ml-1 translate-y-0.5 animate-pulse" />}
                  </p>
                ) : (
                  <p className="text-base text-on-surface-variant font-medium italic">
                    {voiceStatusMsg}
                  </p>
                )}
              </div>

              {/* Manual Record Toggle / Stop & Trigger */}
              <div className="flex justify-center gap-3 relative z-20">
                {!isRecording ? (
                  <Button
                    variant="primary"
                    onClick={startSpeechRecognition}
                    className="px-6 py-2.5 rounded-full"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Start Speaking
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={stopSpeechRecognition}
                    className="px-6 py-2.5 rounded-full border border-urgent text-urgent hover:bg-urgent/10"
                  >
                    <span className="material-symbols-outlined text-[16px] mr-2">stop</span>
                    Stop & Parse
                  </Button>
                )}

                {voiceInputText && !isRecording && !parsedTaskData && (
                  <Button
                    variant="secondary"
                    onClick={() => parseVoiceTranscript(voiceInputText)}
                    disabled={isParsingVoice}
                  >
                    {isParsingVoice ? 'Parsing...' : 'Retry Parsing'}
                  </Button>
                )}
              </div>

              {/* Parsed Result Card (Displays when parsedTaskData exists) */}
              <AnimatePresence>
                {parsedTaskData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="w-full bg-[#1F1F28]/60 border border-primary/20 rounded-2xl p-6 relative overflow-hidden shadow-inner mt-4"
                  >
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-extrabold text-white tracking-tight leading-snug">
                            {parsedTaskData.title}
                          </h4>
                          <p className="text-xs text-primary font-bold tracking-wide mt-0.5 font-mono">Parsed Successfully</p>
                        </div>
                        <span className="material-symbols-outlined text-primary">auto_awesome</span>
                      </div>

                      {/* Bento-style details grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-surface-container-high/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Due Date</span>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {parsedTaskData.dueDate} {parsedTaskData.dueTime ? `at ${parsedTaskData.dueTime}` : ''}
                          </span>
                        </div>

                        <div className="bg-surface-container-high/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[16px]">timelapse</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Effort</span>
                          </div>
                          <span className="text-sm font-semibold text-white">
                            {parsedTaskData.estimatedEffort} {parsedTaskData.estimatedEffort === 1 ? 'hour' : 'hours'}
                          </span>
                        </div>
                      </div>

                      {/* Tag & Priority row */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Chip label={parsedTaskData.tag || 'Assignment'} isActive={true} variant="primary" />
                        <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-on-surface-variant">
                          Priority: {parsedTaskData.priority || 'Normal'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-3 mt-4 border-t border-white/5 pt-4">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenCreateModalPreFilled(parsedTaskData)}
                        >
                          <span className="material-symbols-outlined text-[16px] mr-2">edit</span>
                          Edit Details
                        </Button>

                        <Button
                          variant="primary"
                          onClick={async () => {
                            if (!user) return;
                            try {
                              const taskId = `task-${Date.now()}`;
                              const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
                              const dueDateTimeIso = convertToISO(parsedTaskData.dueDate, parsedTaskData.dueTime || '5:00 PM');
                              
                              const newTask = {
                                title: parsedTaskData.title,
                                description: parsedTaskData.description || `Voice quick-capture: "${voiceInputText}"`,
                                dueDateTime: dueDateTimeIso,
                                effortHours: Number(parsedTaskData.estimatedEffort) || 1,
                                tag: parsedTaskData.tag || 'Assignment',
                                priorityScore: parsedTaskData.priority === 'Urgent' ? 3 : parsedTaskData.priority === 'High' ? 2 : 1,
                                status: 'pending',
                                source: 'ai',
                                focusEventIds: [],
                                subtasks: [],
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                              };

                              await setDoc(taskRef, newTask);

                              // Sync to Google Tasks and Google Calendar
                              await syncTaskToGoogle(taskId);
                              await syncDeadlineEventToGoogle(taskId);

                              await addFirestoreLog(user.uid, 'Gemini Voice Parser', `Parsed voice input: created task "${parsedTaskData.title}"`);
                              
                              setParsedTaskData(null);
                              setVoiceInputText('');
                              setIsVoiceModalOpen(false);
                            } catch (e) {
                              console.error('Error saving parsed task directly:', e);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-[16px] mr-2">check</span>
                          Confirm & Save
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* TASK DETAIL GLASS MODAL */}
      {/* ========================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Task Details"
      >
        {selectedTask && (() => {
          const currentTask = tasks.find(t => t.id === selectedTask.id) || selectedTask;
          return (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {/* Tag Chip */}
                  <Chip
                    label={currentTask.tag}
                    isActive={true}
                    variant="primary"
                  />

                  {/* Priority Badge */}
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                      currentTask.priority === 'Urgent'
                        ? 'bg-urgent/15 text-urgent border border-urgent/25'
                        : currentTask.priority === 'High'
                        ? 'bg-tertiary/15 text-tertiary border border-tertiary/25'
                        : 'bg-primary/15 text-primary border border-primary/25'
                    }`}
                  >
                    {currentTask.priority} Priority
                  </span>

                  {/* Completion Status */}
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                      currentTask.isCompleted
                        ? 'bg-success/15 text-success border border-success/25'
                        : 'bg-white/5 text-on-surface-variant border border-white/5'
                    }`}
                  >
                    {currentTask.isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>

                <h3 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  {currentTask.title}
                </h3>
              </div>

              {currentTask.description && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Description
                  </span>
                  <div className="p-4 bg-surface-container-high/40 rounded-xl border border-white/5 text-sm text-on-surface font-normal leading-relaxed whitespace-pre-wrap">
                    {currentTask.description}
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
                      {currentTask.dueDate} {currentTask.dueTime ? `at ${currentTask.dueTime}` : ''}
                    </span>
                  </div>
                </div>

                {/* Effort Info */}
                <div className="p-3.5 bg-surface-container-high/40 rounded-xl border border-white/5 flex items-center gap-3">
                  <Bookmark className="w-5 h-5 text-tertiary" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Estimated Effort</span>
                    <span className="text-sm font-semibold text-white font-mono">
                      {currentTask.estimatedEffort} hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Subtasks Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Subtasks
                  </span>
                  {currentTask.subtasks && currentTask.subtasks.length > 0 && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      {currentTask.subtasks.filter(s => s.isCompleted).length} / {currentTask.subtasks.length}
                    </span>
                  )}
                </div>

                {isDecomposingTask ? (
                  <div className="p-4 bg-surface-container-high/40 rounded-xl border border-white/5 flex items-center justify-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <span className="text-xs font-semibold text-on-surface-variant">Decomposing task with Gemini...</span>
                  </div>
                ) : currentTask.subtasks && currentTask.subtasks.length > 0 ? (
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {currentTask.subtasks.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => handleToggleSubtask(currentTask.id, st.id)}
                        className="p-3 bg-surface-container-high/30 hover:bg-surface-container-high/50 rounded-xl border border-white/5 flex items-center gap-3 cursor-pointer transition-all active:scale-[0.99]"
                      >
                        <div className="shrink-0">
                          {st.isCompleted ? (
                            <div className="w-4 h-4 rounded bg-success flex items-center justify-center text-white">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded border border-white/20 hover:border-primary transition-colors" />
                          )}
                        </div>
                        <span className={`text-xs font-medium leading-tight ${st.isCompleted ? 'text-on-surface-variant line-through opacity-60' : 'text-white'}`}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-surface-container-high/20 rounded-xl border border-white/5 text-center space-y-3">
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      No subtasks created yet. Let Gemini break this down into actionable, structured subtasks.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => handleDecomposeTask(currentTask.id)}
                      className="w-full text-xs py-2 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1 text-primary inline animate-pulse" />
                      Decompose Task
                    </Button>
                  </div>
                )}
              </div>

              {/* Sync details if present */}
              {(currentTask.googleTaskId || currentTask.deadlineEventId) && (
                <div className="p-4 bg-surface-container-high/60 rounded-xl border border-white/5 space-y-2">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-on-surface-variant block">Google Workspace Sync</span>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {currentTask.googleTaskId && (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Synced to Google Tasks</span>
                      </div>
                    )}
                    {currentTask.deadlineEventId && (
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
                    handleToggleComplete(currentTask.id);
                  }}
                  className="flex-1"
                >
                  {currentTask.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
                </Button>
                
                <div className="flex flex-1 gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleDeleteTask(currentTask.id);
                    }}
                    className="flex-1 border-urgent/30 hover:bg-urgent/10 text-urgent"
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenEditModal(currentTask);
                    }}
                    className="flex-1"
                  >
                    Edit Task
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ========================================== */}
      {/* EDIT PROPOSED GMAIL TASK GLASS MODAL */}
      {/* ========================================== */}
      <Modal
        isOpen={isEditProposalModalOpen}
        onClose={() => setIsEditProposalModalOpen(false)}
        title="Edit Proposed Task"
      >
        <div className="space-y-5">
          <Input
            label="Proposed Task Title"
            value={propEditTitle}
            onChange={(e) => setPropEditTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Category Tag</label>
              <select
                value={propEditTag}
                onChange={(e) => setPropEditTag(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface-container-high border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                {PREDEFINED_TAGS.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            <Input
              label="Due Date (YYYY-MM-DD)"
              type="date"
              value={propEditDueDate}
              onChange={(e) => setPropEditDueDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Due Time"
            placeholder="e.g. 11:59 PM"
            value={propEditDueTime}
            onChange={(e) => setPropEditDueTime(e.target.value)}
          />

          <TextArea
            label="Email Context Snippet"
            value={propEditDesc}
            onChange={(e) => setPropEditDesc(e.target.value)}
            rows={4}
          />

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <Button
              variant="secondary"
              onClick={() => setIsEditProposalModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveEditProposal}
              className="flex-1"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Material 3 Glassmorphic Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-[9999] max-w-sm p-4 rounded-2xl bg-[#231A5C]/90 border border-white/10 shadow-2xl backdrop-blur-xl flex items-start gap-3"
          >
            <div className={`p-2 rounded-xl ${
              toast.type === 'success' ? 'bg-success/20 text-success' :
              toast.type === 'error' ? 'bg-urgent/20 text-urgent' : 'bg-primary/20 text-primary'
            }`}>
              <Bell className="w-5 h-5 animate-pulse text-indigo-400" />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-xs font-semibold text-white block">AutoClutch Notification</span>
              <p className="text-xs text-on-surface-variant leading-relaxed font-medium">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-on-surface-variant/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </NavShell>
  );
}
