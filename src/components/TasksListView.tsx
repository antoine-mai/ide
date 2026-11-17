import React, { useState, useEffect } from 'react';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertCircle,
  XCircle,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Bot,
  Filter,
} from 'lucide-react';
import { TaskItem } from '../types/agent-roles';

interface TasksListViewProps {
  projectPath?: string;
  projectName?: string;
  onSelectTask?: (task: TaskItem) => void;
}

export const TasksListView: React.FC<TasksListViewProps> = ({
  projectPath,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (!projectPath) return [];
    try {
      const saved = localStorage.getItem(`tasks_${projectPath}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Sync tasks with localStorage when updated
  useEffect(() => {
    if (projectPath) {
      try {
        localStorage.setItem(`tasks_${projectPath}`, JSON.stringify(tasks));
      } catch (err) {
        console.error('Failed to save tasks:', err);
      }
    }
  }, [tasks, projectPath]);

  // Reload when projectPath changes or when tasks-updated event fires
  useEffect(() => {
    const loadTasks = () => {
      if (!projectPath) {
        setTasks([]);
        return;
      }
      try {
        const saved = localStorage.getItem(`tasks_${projectPath}`);
        if (saved) {
          setTasks(JSON.parse(saved));
        } else {
          setTasks([]);
        }
      } catch {
        setTasks([]);
      }
    };

    loadTasks();

    const handleTasksUpdated = (e: any) => {
      if (!e.detail || e.detail.projectPath === projectPath) {
        loadTasks();
      }
    };

    window.addEventListener('tasks-updated', handleTasksUpdated);
    return () => {
      window.removeEventListener('tasks-updated', handleTasksUpdated);
    };
  }, [projectPath]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      roleId: 'custom',
      roleName: 'Member Agent',
      title: newTaskTitle.trim(),
      instructions: newTaskTitle.trim(),
      status: 'pending',
    };
    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle('');
    setIsAdding(false);
  };

  const handleUpdateStatus = (taskId: string, newStatus: TaskItem['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const getStatusBadge = (status: TaskItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="task-status-pill completed">
            <CheckCircle2 size={11} color="#10b981" />
            <span>Done</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="task-status-pill in_progress">
            <PlayCircle size={11} color="#60a5fa" />
            <span>Running</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="task-status-pill rejected">
            <XCircle size={11} color="#ef4444" />
            <span>Rejected</span>
          </span>
        );
      case 'evaluating':
        return (
          <span className="task-status-pill evaluating">
            <Clock size={11} color="#f59e0b" />
            <span>Reviewing</span>
          </span>
        );
      default:
        return (
          <span className="task-status-pill pending">
            <Clock size={11} color="#94a3b8" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="tasks-list-container">
      {/* Top Filter and Actions Toolbar */}
      <div className="tasks-toolbar">
        <div className="tasks-filter-group">
          <Filter size={12} color="#717582" />
          <select
            className="tasks-status-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Tasks ({tasks.length})</option>
            <option value="in_progress">Running</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <button
          className="tasks-add-btn"
          title="Add new task"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus size={12} />
          <span>New Task</span>
        </button>
      </div>

      {/* Add New Task Input Box */}
      {isAdding && (
        <div className="tasks-new-box">
          <input
            type="text"
            className="tasks-new-input"
            placeholder="Describe new task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTask();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            autoFocus
          />
          <div className="tasks-new-actions">
            <button className="tasks-btn-primary" onClick={handleAddTask}>
              Add
            </button>
            <button className="tasks-btn-cancel" onClick={() => setIsAdding(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tasks List Content */}
      <div className="tasks-items-list">
        {filteredTasks.length === 0 ? (
          <div className="tasks-empty-state">
            <ListTodo size={28} color="#454854" />
            <p>No tasks {filterStatus !== 'all' ? `marked as ${filterStatus}` : 'yet'}</p>
            <span>Tasks dispatched by supervisor or created manually will appear here.</span>
          </div>
        ) : (
          filteredTasks.map((t) => {
            const isExpanded = expandedTaskId === t.id;
            return (
              <div
                key={t.id}
                className={`task-item-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
              >
                <div className="task-item-header">
                  <div className="task-item-left">
                    {isExpanded ? (
                      <ChevronDown size={13} color="#94a3b8" />
                    ) : (
                      <ChevronRight size={13} color="#94a3b8" />
                    )}
                    <span className="task-item-title">{t.title}</span>
                  </div>
                  <div className="task-item-right">
                    {getStatusBadge(t.status)}
                    <button
                      className="task-delete-btn"
                      title="Delete task"
                      onClick={(e) => handleDeleteTask(t.id, e)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Expanded Task Details */}
                {isExpanded && (
                  <div className="task-item-details" onClick={(e) => e.stopPropagation()}>
                    {t.roleName && (
                      <div className="task-detail-row">
                        <span className="task-detail-label">Assignee:</span>
                        <div className="task-role-badge">
                          <Bot size={11} color="#60a5fa" />
                          <span>{t.roleName}</span>
                        </div>
                      </div>
                    )}

                    {t.instructions && (
                      <div className="task-detail-section">
                        <span className="task-detail-label">Instructions:</span>
                        <p className="task-detail-text">{t.instructions}</p>
                      </div>
                    )}

                    {t.validationFeedback && (
                      <div className="task-detail-section objection-box">
                        <div className="objection-title">
                          <AlertCircle size={11} color="#ef4444" />
                          <span>Role Pushback / Objection:</span>
                        </div>
                        <p className="task-detail-text">{t.validationFeedback}</p>
                      </div>
                    )}

                    {t.result && (
                      <div className="task-detail-section result-box">
                        <span className="task-detail-label">Output / Deliverable:</span>
                        <pre className="task-result-pre">{t.result}</pre>
                      </div>
                    )}

                    {/* Quick status change controls */}
                    <div className="task-status-actions">
                      <span className="task-detail-label">Change Status:</span>
                      <div className="task-status-btn-group">
                        <button
                          className={`task-status-toggle ${t.status === 'pending' ? 'active' : ''}`}
                          onClick={() => handleUpdateStatus(t.id, 'pending')}
                        >
                          Pending
                        </button>
                        <button
                          className={`task-status-toggle ${t.status === 'in_progress' ? 'active' : ''}`}
                          onClick={() => handleUpdateStatus(t.id, 'in_progress')}
                        >
                          Running
                        </button>
                        <button
                          className={`task-status-toggle ${t.status === 'completed' ? 'active' : ''}`}
                          onClick={() => handleUpdateStatus(t.id, 'completed')}
                        >
                          Completed
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
