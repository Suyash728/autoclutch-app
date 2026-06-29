export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO string or simple string
  dueTime?: string; // Time string like "2:00 PM"
  estimatedEffort: number; // in hours
  tag: string; // predefined or custom
  isCompleted: boolean;
  priority: 'Urgent' | 'High' | 'Normal' | 'Low';
  subtasksCount?: {
    completed: number;
    total: number;
  };
  googleTaskId?: string;
  deadlineEventId?: string;
  focusEventIds?: string[];
  assignees?: { name: string; avatarUrl: string }[];
  source?: string;
}

export interface FocusBlock {
  id: string;
  timeStart: string;
  timeEnd: string;
  title: string;
  isActive?: boolean;
  statusText?: string;
}

export interface AgentActivityLog {
  id: string;
  text: string;
  timestamp: string; // e.g. "10 mins ago", "1 hr ago"
  type: 'info' | 'calendar' | 'task' | 'alert';
}
