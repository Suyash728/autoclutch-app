import React from 'react';
import { Calendar, CheckCircle2, Clock, Eye, Trash2, Edit2, Bookmark, Check } from 'lucide-react';
import { Task } from '../types';
import { Card } from './Card';
import { Chip } from './Chip';

interface ListItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const ListItem: React.FC<ListItemProps> = ({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
}) => {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'Urgent':
        return 'urgent';
      case 'High':
        return 'tertiary';
      case 'Normal':
        return 'primary';
      default:
        return 'success';
    }
  };

  const getPriorityLabel = (priority: Task['priority']) => {
    return priority.toUpperCase();
  };

  return (
    <Card
      variant={task.isCompleted ? 'solid' : 'glass'}
      className={`relative overflow-hidden group border-l-4 transition-all duration-300 ${
        task.isCompleted
          ? 'border-l-success opacity-75'
          : task.priority === 'Urgent'
          ? 'border-l-urgent shadow-[0_4px_20px_rgba(255,90,90,0.08)]'
          : 'border-l-primary'
      } hover:translate-x-1`}
    >
      <div className="flex items-start gap-4">
        {/* Toggle Checkbox */}
        <button
          onClick={() => onToggleComplete(task.id)}
          className="mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 border-primary/40 hover:border-primary flex items-center justify-center transition-all cursor-pointer"
        >
          {task.isCompleted ? (
            <div className="w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <Check className="w-3 h-3 text-white stroke-[3px]" />
            </div>
          ) : (
            <div className="w-0 h-0 rounded-full bg-primary group-hover:w-3 group-hover:h-3 transition-all" />
          )}
        </button>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* Tag */}
            <Chip
              label={task.tag}
              isActive={false}
              className="text-[10px] uppercase py-0.5 px-2"
            />

            {/* Priority */}
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                task.priority === 'Urgent'
                  ? 'bg-urgent/15 text-urgent border border-urgent/25'
                  : task.priority === 'High'
                  ? 'bg-tertiary/15 text-tertiary border border-tertiary/25'
                  : 'bg-primary/15 text-primary border border-primary/25'
              }`}
            >
              {getPriorityLabel(task.priority)}
            </span>

            {/* Sync States */}
            {task.googleTaskId && (
              <span className="inline-flex items-center gap-1 text-[10px] text-success/80 bg-success/10 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" />
                Google Tasks
              </span>
            )}
            {task.deadlineEventId && (
              <span className="inline-flex items-center gap-1 text-[10px] text-success/80 bg-success/10 px-1.5 py-0.5 rounded">
                <Calendar className="w-3 h-3" />
                Calendar
              </span>
            )}
          </div>

          <h3
            className={`text-base font-extrabold text-on-surface tracking-tight truncate ${
              task.isCompleted ? 'line-through text-on-surface-variant' : ''
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="text-sm text-on-surface-variant mt-1.5 line-clamp-2 font-normal leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Subtasks Progress Bar */}
          {task.subtasksCount && (
            <div className="mt-3">
              <div className="flex justify-between text-xs font-semibold text-on-surface-variant mb-1">
                <span>Subtasks ({task.subtasksCount.completed}/{task.subtasksCount.total})</span>
                <span>{Math.round((task.subtasksCount.completed / task.subtasksCount.total) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(task.subtasksCount.completed / task.subtasksCount.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Details footer */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-on-surface-variant font-medium">
            {task.dueDate && (
              <span className="flex items-center gap-1.5 bg-white/5 py-1 px-2.5 rounded-lg border border-white/5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>
                  {task.dueDate} {task.dueTime ? `at ${task.dueTime}` : ''}
                </span>
              </span>
            )}

            {task.estimatedEffort && (
              <span className="flex items-center gap-1.5 bg-white/5 py-1 px-2.5 rounded-lg border border-white/5 font-mono">
                <Bookmark className="w-3.5 h-3.5 text-tertiary" />
                <span>{task.estimatedEffort}h effort</span>
              </span>
            )}

            {task.source && (
              <span className="text-[11px] opacity-75">
                Source: <span className="font-semibold">{task.source}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onEdit(task)}
            className="p-2 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
            title="Edit Task"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 rounded-full hover:bg-urgent/20 text-on-surface-variant hover:text-urgent transition-all cursor-pointer"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
};
