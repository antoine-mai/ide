import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Square,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  FileText,
  GitBranch,
  Folder,
  Sparkles,
  Target,
  RotateCw,
  Sliders,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  AtSign,
  Play,
  Terminal as TerminalIcon,
  GitCommit,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { InstalledAI } from './ManageAgentsModal';
import { AgentRole, SupervisorConfig } from '../types/agent-roles';
import { RoleSettingsModal } from './RoleSettingsModal';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  agentId?: string;
  agentName?: string;
  text: string;
  timestamp: number;
  type?: 'normal' | 'supervisor_plan' | 'agent_evaluating' | 'agent_pushback' | 'agent_executing' | 'agent_done' | 'workflow_finished';
  validationFeedback?: string;
  isDirectAgentTask?: boolean; // Dispatched directly to a specific @agent
  sectionId?: string;
  taskTitle?: string;
}

const DEFAULT_ROLES: AgentRole[] = [
  {
    id: 'role-dev',
    name: 'Lead Developer',
    description: 'Implements features, writes core code and unit tests',
    rules: `# Lead Developer Rules & Contract
1. Must write clean, modular, and maintainable TypeScript/JavaScript code.
2. Ensure all inputs are validated before execution.
3. Reject requirements that lack clear specifications or provide conflicting goals.
4. Token Saver: Return code changes as concise Unified Diffs (--- a/file +++ b/file) or targeted function edits instead of re-printing unchanged files.`,
  },
  {
    id: 'role-reviewer',
    name: 'Code & Security Reviewer',
    description: 'Performs static analysis, validates safety, finds bugs',
    rules: `# Security & Code Reviewer Rules & Contract
1. Reject any tasks containing hardcoded credentials, plain API keys, or unsafe evals.
2. Verify code adheres to clean architectural patterns and proper error handling.
3. If an implementation has potential security flaws, emit strict OBJECTION with remedies.
4. Token Saver: Be concise. Bullet-point findings with exact line numbers and concrete 1-2 line fixes.`,
  },
  {
    id: 'role-qa',
    name: 'QA & Verification Specialist',
    description: 'Verifies edge cases, runs verification and tests',
    rules: `# QA Rules & Contract
1. Verify functional correctness against original user intent.
2. Flag missing test coverage or unhandled edge cases.
3. Ensure no regressions are introduced.
4. Token Saver: Provide reproduction steps and pass/fail checklist concisely.`,
  },
];

const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  type: 'agent',
  selectedAgentId: '',
  apiProvider: 'openai',
  modelName: 'gpt-4o-mini',
};

interface DiscussionViewProps {
  project: { id: string; name: string; path: string };
  installedAIs: InstalledAI[];
  activeAgentIds: string[];
  onToggleAgent: (agentId: string) => void;
  onOpenManageAgents: () => void;
  onRunScript?: (scriptName: string, scriptCmd: string) => void;
  onOpenGitModal?: (tab: 'changes' | 'branches' | 'history') => void;
  gitDetails?: {
    isRepo: boolean;
    branch: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
    changeCount: number;
  };
  projectBadge: string;
}

const EXEC_MODES = [
  { id: 'default', name: 'Default' },
  { id: 'auto', name: 'Auto (YOLO)' },
  { id: 'plan', name: 'Plan Mode' },
];

const AUTO_REVIEW_MODES = [
  { id: 'auto_review', name: 'Auto review' },
  { id: 'manual_review', name: 'Manual review' },
  { id: 'disabled', name: 'No review' },
];

export const DiscussionView: React.FC<DiscussionViewProps> = ({
  project,
  installedAIs,
  activeAgentIds,
  onToggleAgent,
  onOpenManageAgents,
  onRunScript,
  onOpenGitModal,
  gitDetails,
  projectBadge,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  // Git status of this project
  const [gitInfo, setGitInfo] = useState<{ isRepo: boolean; branch: string; isDirty: boolean }>({
    isRepo: false,
    branch: '',
    isDirty: false,
  });

  // Project package.json scripts (for Node.js projects)
  const [projectScripts, setProjectScripts] = useState<Record<string, string>>({});
  const [showScriptsMenu, setShowScriptsMenu] = useState(false);
  const scriptsRef = useRef<HTMLDivElement>(null);

  // Read package.json scripts on mount or project path change
  useEffect(() => {
    let mounted = true;
    if (!project.path) {
      setProjectScripts({});
      return;
    }

    const packageJsonPath = `${project.path.replace(/\\/g, '/')}/package.json`;
    window.electronAPI?.readFile(packageJsonPath).then((content) => {
      if (!mounted) return;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed.scripts === 'object' && parsed.scripts !== null) {
            setProjectScripts(parsed.scripts);
            return;
          }
        } catch {}
      }
      setProjectScripts({});
    }).catch(() => {
      if (mounted) setProjectScripts({});
    });

    return () => {
      mounted = false;
    };
  }, [project.path]);

  // Close scripts dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (scriptsRef.current && !scriptsRef.current.contains(e.target as Node)) {
        setShowScriptsMenu(false);
      }
    };
    if (showScriptsMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showScriptsMenu]);

  // Toolbar state
  const [selectedReview, setSelectedReview] = useState('auto_review');
  const [selectedMode, setSelectedMode] = useState('default');
  const [isFastMode, setIsFastMode] = useState(false);

  // Active dropdown
  const [openDropdown, setOpenDropdown] = useState<'review' | 'mode' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Multi-Agent Roles & Rules + Supervisor Config
  const [roles, setRoles] = useState<AgentRole[]>(() => {
    try {
      const saved = localStorage.getItem(`roles_${project.id}`);
      return saved ? JSON.parse(saved) : DEFAULT_ROLES;
    } catch {
      return DEFAULT_ROLES;
    }
  });

  const [supervisorConfig, setSupervisorConfig] = useState<SupervisorConfig>(() => {
    try {
      const saved = localStorage.getItem(`supervisor_${project.id}`);
      return saved ? JSON.parse(saved) : DEFAULT_SUPERVISOR_CONFIG;
    } catch {
      return DEFAULT_SUPERVISOR_CONFIG;
    }
  });

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<string | null>(null);

  // Accordion collapsed states (mapped by message id or step id, default collapsed)
  const [openAccordionIds, setOpenAccordionIds] = useState<Record<string, boolean>>({});

  const toggleAccordion = (id: string) => {
    setOpenAccordionIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // @ Mention auto-complete state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const handleSaveRoles = (updatedRoles: AgentRole[]) => {
    setRoles(updatedRoles);
    try {
      localStorage.setItem(`roles_${project.id}`, JSON.stringify(updatedRoles));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSupervisorConfig = (updatedConfig: SupervisorConfig) => {
    setSupervisorConfig(updatedConfig);
    try {
      localStorage.setItem(`supervisor_${project.id}`, JSON.stringify(updatedConfig));
    } catch (err) {
      console.error(err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadedRef = useRef(false);
  const activeSessionId = `discussion-${project.id}`;

  // Load discussion history from .zerous/discussions when switching/opening project
  useEffect(() => {
    isLoadedRef.current = false;
    let mounted = true;

    if (window.electronAPI?.discussionLoadHistory) {
      window.electronAPI.discussionLoadHistory(project.path, activeSessionId).then((res) => {
        if (!mounted) return;
        if (res && res.success && Array.isArray(res.messages) && res.messages.length > 0) {
          setMessages(res.messages);
        } else {
          // Fallback to localStorage if any
          try {
            const saved = localStorage.getItem(`chat_history_${project.id}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setMessages(parsed);
              } else {
                setMessages([]);
              }
            } else {
              setMessages([]);
            }
          } catch {
            setMessages([]);
          }
        }
        isLoadedRef.current = true;
      });
    } else {
      isLoadedRef.current = true;
    }

    return () => {
      mounted = false;
    };
  }, [project.path, project.id, activeSessionId]);

  // Persist discussion messages to .zerous and localStorage whenever messages change
  useEffect(() => {
    if (!isLoadedRef.current) return;
    try {
      localStorage.setItem(`chat_history_${project.id}`, JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
    if (window.electronAPI?.discussionSaveHistory) {
      window.electronAPI.discussionSaveHistory(project.path, messages, activeSessionId).catch(console.error);
    }
  }, [messages, project.path, project.id, activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Load Git info
  useEffect(() => {
    let mounted = true;
    window.electronAPI?.gitGetStatus?.(project.path).then((res) => {
      if (mounted && res) {
        setGitInfo(res);
      }
    });
    return () => {
      mounted = false;
    };
  }, [project.path]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Listen to CLI stream
  useEffect(() => {
    const unsubDelta = window.electronAPI?.onAiDelta(activeSessionId, (delta) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'assistant' && last.id.startsWith('streaming-')) {
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + delta },
          ];
        } else {
          return [
            ...prev,
            {
              id: `streaming-${Date.now()}`,
              sender: 'assistant',
              agentName: assignedAgents[0]?.name || 'Agent',
              text: delta,
              timestamp: Date.now(),
            },
          ];
        }
      });
    });

    const unsubDone = window.electronAPI?.onAiDone(activeSessionId, () => {
      setIsStreaming(false);
    });

    return () => {
      unsubDelta?.();
      unsubDone?.();
    };
  }, [activeSessionId, activeAgentIds]);

  // Subscribe to LangGraph Orchestrator Stream Events
  useEffect(() => {
    const unsubWorkflow = window.electronAPI?.onOrchestratorEvent(activeSessionId, (event: any) => {
      setActiveWorkflowStep(event.content || null);

      if (event.type === 'agent_pushback') {
        setMessages((prev) => [
          ...prev,
          {
            id: `event-${Date.now()}-${Math.random()}`,
            sender: 'assistant',
            agentName: event.agentName || event.roleName || 'Agent',
            type: 'agent_pushback',
            text: `⚠️ **[OBJECTION RAISED BY ${event.roleName || 'AGENT'}]**\n${event.content}`,
            timestamp: Date.now(),
          },
        ]);
      } else if (event.type === 'agent_done' && event.data) {
        setMessages((prev) => [
          ...prev,
          {
            id: `done-${Date.now()}-${Math.random()}`,
            sender: 'assistant',
            agentName: event.agentName || event.roleName || 'Agent',
            type: 'agent_done',
            text: event.data,
            timestamp: Date.now(),
          },
        ]);

        // Sync completed task into project tasks storage
        if (project.path && (event.taskId || event.taskItem)) {
          try {
            const storageKey = `tasks_${project.path}`;
            const existingRaw = localStorage.getItem(storageKey);
            const currentTasks: any[] = existingRaw ? JSON.parse(existingRaw) : [];
            const updated = currentTasks.map((t) => {
              if (t.id === event.taskId || t.id === event.taskItem?.id) {
                return {
                  ...t,
                  status: 'completed',
                  result: event.data,
                };
              }
              return t;
            });
            localStorage.setItem(storageKey, JSON.stringify(updated));
            window.dispatchEvent(new CustomEvent('tasks-updated', { detail: { projectPath: project.path } }));
          } catch (e) {
            console.error('Failed to sync completed task:', e);
          }
        }
      } else if (event.type === 'supervisor_plan') {
        setMessages((prev) => [
          ...prev,
          {
            id: `plan-${Date.now()}-${Math.random()}`,
            sender: 'assistant',
            agentName: 'Supervisor',
            type: 'supervisor_plan',
            text: event.content,
            timestamp: Date.now(),
          },
        ]);

        // Automatically store tasks created by Supervisor in tasks list
        if (Array.isArray(event.data) && project.path) {
          try {
            const storageKey = `tasks_${project.path}`;
            const existingRaw = localStorage.getItem(storageKey);
            const currentTasks: any[] = existingRaw ? JSON.parse(existingRaw) : [];
            const newTasks = event.data as any[];

            // Merge new planned tasks at the beginning
            const merged = [
              ...newTasks,
              ...currentTasks.filter((ct) => !newTasks.some((nt) => nt.id === ct.id)),
            ];
            localStorage.setItem(storageKey, JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent('tasks-updated', { detail: { projectPath: project.path } }));
          } catch (e) {
            console.error('Failed to sync supervisor tasks:', e);
          }
        }
      }
    });

    return () => {
      unsubWorkflow?.();
    };
  }, [activeSessionId]);

  const assignedAgents = installedAIs.filter((a) => activeAgentIds.includes(a.id));

  // Attachment Picker
  const handlePickAttachments = async () => {
    try {
      const files = await window.electronAPI?.openFilesDialog(project.path);
      if (files && files.length > 0) {
        setAttachedFiles((prev) => {
          const set = new Set([...prev, ...files]);
          return Array.from(set);
        });
      }
    } catch (err) {
      console.error('Failed to open files dialog:', err);
    }
  };

  const handleRemoveAttachedFile = (pathToRemove: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f !== pathToRemove));
  };

  const handleSend = async (customPrompt?: string) => {
    const rawText = (customPrompt ?? inputValue).trim();
    if (!rawText && attachedFiles.length === 0) return;

    // Detect if user is specifically @mentioning an agent (e.g. "@claude fix this", "@Antigravity check api")
    let targetDirectAgent: InstalledAI | null = null;
    let cleanPrompt = rawText;

    const mentionMatch = rawText.match(/^@([a-zA-Z0-9_\-\.\s]+?)(?::|\s+)([\s\S]*)$/);
    if (mentionMatch) {
      const queriedName = mentionMatch[1].trim().toLowerCase();
      const remainder = mentionMatch[2].trim();

      const matchedAgent = installedAIs.find(
        (a) =>
          a.name.toLowerCase() === queriedName ||
          a.command.toLowerCase() === queriedName ||
          a.id.toLowerCase() === queriedName ||
          a.name.toLowerCase().startsWith(queriedName) ||
          a.command.toLowerCase().startsWith(queriedName)
      );

      if (matchedAgent) {
        targetDirectAgent = matchedAgent;
        cleanPrompt = remainder || rawText;
        // Automatically ensure this agent is assigned to the project discussion
        if (!activeAgentIds.includes(matchedAgent.id)) {
          onToggleAgent(matchedAgent.id);
        }
      }
    }

    // Must have at least 1 agent assigned
    if (!targetDirectAgent && assignedAgents.length === 0) {
      if (installedAIs.length > 0) {
        onToggleAgent(installedAIs[0].id);
      } else {
        onOpenManageAgents();
        return;
      }
    }

    let fullPrompt = cleanPrompt;
    if (attachedFiles.length > 0) {
      const fileHeader = `[Attached Context Files]:\n${attachedFiles.map((f) => `- ${f}`).join('\n')}\n\n`;
      fullPrompt = fileHeader + fullPrompt;
      setAttachedFiles([]);
    }

    const currentSectionId = `sec-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      sender: 'user',
      text: rawText,
      timestamp: Date.now(),
      isDirectAgentTask: !!targetDirectAgent,
      sectionId: currentSectionId,
      agentName: targetDirectAgent ? targetDirectAgent.name : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) {
      setInputValue('');
    }
    setIsStreaming(true);

    // CASE 1: DIRECT AGENT TASK (@agent) - Isolated from Supervisor workflow
    if (targetDirectAgent) {
      const agentSessionId = `agent-direct-${project.id}-${targetDirectAgent.id}`;
      const assistantMsgId = `direct-${Date.now()}`;

      try {
        // Load isolated agent context from .zerous/agent-contexts/[agentId].json
        let agentContext: { messages: Array<{ role: string; content: string }> } = { messages: [] };
        if (window.electronAPI?.agentContextLoad) {
          const res = await window.electronAPI.agentContextLoad(project.path, targetDirectAgent.id);
          if (res?.success && res.context?.messages) {
            agentContext = res.context;
          }
        }

        // Add prompt with context memory reminder
        const contextHistoryText = agentContext.messages.length > 0
          ? `[Isolated Conversation History with @${targetDirectAgent.name}]:\n` +
            agentContext.messages.slice(-6).map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n') +
            '\n\n[New Direct Instruction]:\n'
          : '';

        const effectivePrompt = contextHistoryText + fullPrompt;

        // Initialize placeholder message for direct response
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            sender: 'assistant',
            agentName: targetDirectAgent!.name,
            agentId: targetDirectAgent!.id,
            text: '',
            timestamp: Date.now(),
            isDirectAgentTask: true,
            sectionId: currentSectionId,
            type: 'agent_done',
          },
        ]);

        // Subscribe to direct agent streaming
        let streamAccumulator = '';
        const unsubDelta = window.electronAPI?.onAiDelta(agentSessionId, (delta) => {
          streamAccumulator += delta;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, text: streamAccumulator } : msg
            )
          );
        });

        const unsubDone = window.electronAPI?.onAiDone(agentSessionId, async () => {
          setIsStreaming(false);
          unsubDelta?.();
          unsubDone?.();

          // Save back into isolated agent context with Rolling Buffer (Keep last 8 messages to prevent bloat)
          const allNewMessages = [
            ...(agentContext.messages || []),
            { role: 'user', content: cleanPrompt },
            { role: 'assistant', content: streamAccumulator },
          ];
          const trimmedMessages =
            allNewMessages.length > 8 ? allNewMessages.slice(-8) : allNewMessages;

          const updatedContext = {
            agentId: targetDirectAgent!.id,
            agentName: targetDirectAgent!.name,
            lastUpdated: Date.now(),
            messages: trimmedMessages,
          };
          if (window.electronAPI?.agentContextSave) {
            await window.electronAPI.agentContextSave(project.path, targetDirectAgent!.id, updatedContext);
          }
        });

        await window.electronAPI?.aiSendPrompt(
          agentSessionId,
          targetDirectAgent.command,
          effectivePrompt,
          project.path,
          targetDirectAgent.defaultArgs,
          {
            mode: selectedMode,
            customHome: targetDirectAgent.customHome,
            customEnv: targetDirectAgent.customEnv,
          }
        );
      } catch (err: any) {
        console.error('Direct agent execution failed:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            agentName: targetDirectAgent!.name,
            text: `Direct Agent error: ${err?.message || err}`,
            timestamp: Date.now(),
            isDirectAgentTask: true,
            sectionId: currentSectionId,
          },
        ]);
        setIsStreaming(false);
      }
      return;
    }

    // CASE 2: SUPERVISOR MULTI-AGENT WORKFLOW (No direct @agent mention)
    const useMultiAgentGraph = roles.length > 0;

    if (useMultiAgentGraph && window.electronAPI?.orchestratorRunWorkflow) {
      try {
        // Map assigned agents to roles if not explicitly assigned
        const mappedRoles = roles.map((r, idx) => ({
          ...r,
          assignedAgentId: r.assignedAgentId || assignedAgents[idx % assignedAgents.length]?.id || installedAIs[0]?.id,
        }));

        const result = await window.electronAPI.orchestratorRunWorkflow({
          sessionId: activeSessionId,
          userPrompt: fullPrompt,
          projectPath: project.path,
          supervisorConfig,
          roles: mappedRoles,
          installedAIs,
        });

        if (result?.finalState?.finalSummary) {
          setMessages((prev) => [
            ...prev,
            {
              id: `summary-${Date.now()}`,
              sender: 'assistant',
              agentName: 'Supervisor',
              type: 'workflow_finished',
              text: `✅ **Workflow Completed**\n\n${result.finalState.finalSummary}`,
              timestamp: Date.now(),
              sectionId: currentSectionId,
            },
          ]);
        }
      } catch (err: any) {
        console.error('Workflow execution failed:', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'assistant',
            agentName: 'System',
            text: `Workflow execution error: ${err?.message || err}`,
            timestamp: Date.now(),
            sectionId: currentSectionId,
          },
        ]);
      } finally {
        setIsStreaming(false);
        setActiveWorkflowStep(null);
      }
      return;
    }

    // Fallback: Dispatch directly to primary assigned agent
    const targetAgent = assignedAgents[0] || installedAIs[0];

    try {
      await window.electronAPI?.aiSendPrompt(
        activeSessionId,
        targetAgent.command,
        fullPrompt,
        project.path,
        targetAgent.defaultArgs,
        {
          mode: selectedMode,
          customHome: targetAgent.customHome,
          customEnv: targetAgent.customEnv,
        }
      );
    } catch (err) {
      console.error('Failed to send prompt in discussion:', err);
      setIsStreaming(false);
    }
  };

  const handleAbort = () => {
    window.electronAPI?.aiAbort(activeSessionId);
    setIsStreaming(false);
  };

  const handleClearHistory = async () => {
    if (messages.length === 0) return;
    if (window.confirm(`Clear discussion history for ${project.name}?`)) {
      setMessages([]);
      try {
        localStorage.removeItem(`chat_history_${project.id}`);
      } catch (e) {
        console.error(e);
      }
      if (window.electronAPI?.discussionClearHistory) {
        await window.electronAPI.discussionClearHistory(project.path, activeSessionId);
      }
    }
  };

  // Filter installed agents for @mention menu
  const filteredMentionAgents = installedAIs.filter(
    (a) =>
      a.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
      a.command.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect if typing @
    const cursor = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show menu if query doesn't contain spaces or newline
      if (!/[\s\n]/.test(query)) {
        setShowMentionMenu(true);
        setMentionFilter(query);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectMention = (agent: InstalledAI) => {
    // Replace the @query with @agentName
    const lastAtIndex = inputValue.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const before = inputValue.slice(0, lastAtIndex);
      const after = inputValue.slice(lastAtIndex + 1 + mentionFilter.length);
      setInputValue(`${before}@${agent.name} ${after}`);
    } else {
      setInputValue((prev) => `@${agent.name} ${prev}`);
    }
    setShowMentionMenu(false);
    // Ensure agent is active in project
    if (!activeAgentIds.includes(agent.id)) {
      onToggleAgent(agent.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredMentionAgents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionAgents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentionAgents.length) % filteredMentionAgents.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentionAgents[mentionIndex] || filteredMentionAgents[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentModeObj = EXEC_MODES.find((m) => m.id === selectedMode) || EXEC_MODES[0];
  const currentReviewObj = AUTO_REVIEW_MODES.find((r) => r.id === selectedReview) || AUTO_REVIEW_MODES[0];

  return (
    <div className="discussion-container">
      {/* Discussion Header */}
      <div className="discussion-header">
        <div className="discussion-header-left">
          <div className="discussion-project-badge">{projectBadge}</div>
          <div className="discussion-project-info">
            <div className="discussion-project-name">{project.name}</div>
            <div className="discussion-project-meta">
              <span className="discussion-project-path" title={project.path}>
                <Folder size={11} />
                <span>{project.path}</span>
              </span>
              {gitInfo.isRepo && (
                <span className={`discussion-git-badge ${gitInfo.isDirty ? 'dirty' : 'clean'}`}>
                  <GitBranch size={11} />
                  <span>{gitInfo.branch || 'main'}</span>
                  {gitInfo.isDirty && <span className="git-dot">●</span>}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: 2-Row Action Bars (Top: Project & Script Actions | Bottom: Git Controls) */}
        <div className="discussion-header-right">
          {/* Row 1 (Top): Project Actions, Supervisor/Roles, Agents & npm scripts */}
          <div className="discussion-header-row top-row">
            {/* Roles & Supervisor Modal Trigger */}
            <button
              className="discussion-header-icon-btn"
              title={`Configure Roles & Supervisor (${roles.length} roles)`}
              onClick={() => setIsRoleModalOpen(true)}
            >
              <Sliders size={12} color="#a5b4fc" />
              <span className="discussion-btn-text">Roles ({roles.length})</span>
            </button>

            {/* Clear History Button */}
            {messages.length > 0 && (
              <button
                className="discussion-header-icon-btn"
                title="Clear discussion history"
                onClick={handleClearHistory}
              >
                <Trash2 size={12} color="#9ca3af" />
              </button>
            )}

            <div className="discussion-header-divider" />

            {/* Assigned Agents Pill List */}
            <div className="discussion-agents-list">
              {assignedAgents.slice(0, 3).map((ag) => (
                <div key={ag.id} className="discussion-agent-pill" title={`${ag.name} (${ag.command})`}>
                  <Bot size={11} color="#60a5fa" />
                  <span className="discussion-agent-pill-name">{ag.name}</span>
                  <button
                    className="discussion-agent-pill-remove"
                    title={`Remove ${ag.name}`}
                    onClick={() => onToggleAgent(ag.id)}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {assignedAgents.length > 3 && (
                <span
                  className="discussion-agent-pill more-pill"
                  title={assignedAgents.slice(3).map((a) => a.name).join(', ')}
                >
                  +{assignedAgents.length - 3}
                </span>
              )}
            </div>

            {/* Smart Node.js Project Scripts Buttons */}
            {Object.keys(projectScripts).length > 0 && (
              <>
                <div className="discussion-header-divider" />
                <div className="discussion-scripts-bar" ref={scriptsRef}>
                  {Object.entries(projectScripts).slice(0, 3).map(([scriptName, scriptCmd]) => (
                    <button
                      key={scriptName}
                      className="discussion-script-btn"
                      title={`Run 'npm run ${scriptName}' in terminal\nCommand: ${scriptCmd}`}
                      onClick={() => onRunScript?.(scriptName, scriptCmd)}
                    >
                      <Play size={10} color="#10b981" />
                      <span>{scriptName}</span>
                    </button>
                  ))}

                  {Object.keys(projectScripts).length > 3 && (
                    <div style={{ position: 'relative' }}>
                      <button
                        className="discussion-script-btn more-btn"
                        title="More npm scripts..."
                        onClick={() => setShowScriptsMenu(!showScriptsMenu)}
                      >
                        <TerminalIcon size={11} color="#60a5fa" />
                        <span>+{Object.keys(projectScripts).length - 3}</span>
                        <ChevronDown size={10} />
                      </button>

                      {showScriptsMenu && (
                        <div className="discussion-scripts-dropdown">
                          <div className="discussion-dropdown-title">npm scripts</div>
                          {Object.entries(projectScripts).slice(3).map(([scriptName, scriptCmd]) => (
                            <button
                              key={scriptName}
                              className="discussion-dropdown-item"
                              onClick={() => {
                                setShowScriptsMenu(false);
                                onRunScript?.(scriptName, scriptCmd);
                              }}
                              title={scriptCmd}
                            >
                              <Play size={11} color="#10b981" />
                              <span className="agent-item-name" style={{ fontFamily: 'monospace' }}>
                                {scriptName}
                              </span>
                              <span style={{ fontSize: 9, color: '#64748b', marginLeft: 'auto', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {scriptCmd}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Row 2 (Bottom): Git Actions (Branch, Status, Changes, History, Sync) */}
          <div className="discussion-header-row bottom-row">
            {gitInfo.isRepo || gitDetails?.isRepo ? (
              <>
                {/* Branch Switcher Button */}
                <button
                  className="discussion-git-action-btn branch-btn"
                  title="Switch or view Git branches"
                  onClick={() => onOpenGitModal?.('branches')}
                >
                  <GitBranch size={11} color="#60a5fa" />
                  <span>{gitDetails?.branch || gitInfo.branch || 'main'}</span>
                </button>

                {/* Changes / Diff Reviewer Button */}
                <button
                  className={`discussion-git-action-btn ${(gitDetails?.isDirty || gitInfo.isDirty) ? 'dirty' : ''}`}
                  title="View Git Changes & Diff"
                  onClick={() => onOpenGitModal?.('changes')}
                >
                  <FileText size={11} color={(gitDetails?.isDirty || gitInfo.isDirty) ? '#f59e0b' : '#10b981'} />
                  <span>{(gitDetails?.isDirty || gitInfo.isDirty) ? `${gitDetails?.changeCount || 'Modified'} changes` : 'Clean'}</span>
                </button>

                {/* Ahead / Behind Sync Info */}
                {((gitDetails?.ahead ?? 0) > 0 || (gitDetails?.behind ?? 0) > 0) && (
                  <button
                    className="discussion-git-action-btn sync-btn"
                    title="Pull/Push changes with remote repository"
                    onClick={() => onOpenGitModal?.('changes')}
                  >
                    {(gitDetails?.behind ?? 0) > 0 && (
                      <span className="git-sync-item">
                        <ArrowDown size={10} color="#38bdf8" />
                        <span>{gitDetails?.behind}</span>
                      </span>
                    )}
                    {(gitDetails?.ahead ?? 0) > 0 && (
                      <span className="git-sync-item">
                        <ArrowUp size={10} color="#38bdf8" />
                        <span>{gitDetails?.ahead}</span>
                      </span>
                    )}
                  </button>
                )}

                {/* Commit History Button */}
                <button
                  className="discussion-git-action-btn"
                  title="View Commit History"
                  onClick={() => onOpenGitModal?.('history')}
                >
                  <GitCommit size={11} color="#94a3b8" />
                  <span>History</span>
                </button>
              </>
            ) : (
              <span className="discussion-no-git-notice">No Git repository detected</span>
            )}
          </div>
        </div>
      </div>

      {/* Discussion Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="discussion-empty-placeholder">
            <div className="discussion-empty-icon">
              <Sparkles size={28} color="#60a5fa" />
            </div>
            <div className="discussion-empty-title">Discussion & Task Dispatch</div>
            <p className="discussion-empty-desc">
              This is the centralized project workspace to collaborate with one or multiple AI agents in <strong>{project.name}</strong>.
            </p>
            <div className="discussion-empty-hints">
              <div className="discussion-hint-chip">
                <span>1</span> Assign one or more agents from the header above
              </div>
              <div className="discussion-hint-chip">
                <span>2</span> Type instructions or attach context files to delegate tasks
              </div>
              <div className="discussion-hint-chip">
                <span>3</span> Receive structured responses and code deliverables from agents
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          let badgeClass = 'chat-msg-agent-tag';
          if (msg.type === 'supervisor_plan' || msg.agentName === 'Supervisor') {
            badgeClass += ' supervisor';
          } else if (msg.type === 'agent_pushback') {
            badgeClass += ' pushback';
          } else if (msg.type === 'agent_evaluating') {
            badgeClass += ' evaluating';
          }

          // Section divider indicator when section changes or direct task
          const prevMsg = messages[index - 1];
          const isNewSection = msg.sectionId && msg.sectionId !== prevMsg?.sectionId;

          // Render accordion for detailed assistant steps/plans
          const isAccordionStep =
            msg.sender === 'assistant' &&
            (msg.type === 'agent_done' ||
              msg.type === 'agent_executing' ||
              msg.type === 'agent_evaluating' ||
              msg.type === 'agent_pushback' ||
              msg.text.length > 250);

          const isExpanded = !!openAccordionIds[msg.id];

          return (
            <React.Fragment key={msg.id}>
              {/* Section Header Divider */}
              {isNewSection && (
                <div className="discussion-section-divider">
                  {msg.isDirectAgentTask ? (
                    <span className="discussion-section-badge direct-agent">
                      <AtSign size={11} />
                      <span>Direct Agent Task ({msg.agentName || 'Agent'})</span>
                    </span>
                  ) : (
                    <span className="discussion-section-badge">
                      <Sparkles size={11} />
                      <span>Supervisor Workflow Section</span>
                    </span>
                  )}
                </div>
              )}

              <div className={`chat-message ${msg.sender}`}>
                <div className={`chat-avatar ${msg.sender}`}>
                  {msg.sender === 'user' ? (
                    <User size={15} />
                  ) : msg.type === 'agent_pushback' ? (
                    <ShieldAlert size={15} color="#f87171" />
                  ) : (
                    <Bot size={15} />
                  )}
                </div>

                <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.agentName && msg.sender === 'assistant' && (
                    <div className={badgeClass}>
                      {msg.type === 'agent_pushback' && <ShieldAlert size={11} />}
                      {msg.type === 'agent_done' && <CheckCircle2 size={11} />}
                      <span>{msg.agentName}</span>
                      {msg.isDirectAgentTask && (
                        <span className="discussion-mention-tag" style={{ marginLeft: 6 }}>
                          Direct @{msg.agentName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Accordion view for execution deliverables or detailed text */}
                  {isAccordionStep ? (
                    <div className="discussion-accordion">
                      <div
                        className="discussion-accordion-header"
                        onClick={() => toggleAccordion(msg.id)}
                      >
                        <div className="discussion-accordion-header-left">
                          <span className={`discussion-accordion-arrow ${isExpanded ? 'open' : ''}`}>
                            <ChevronRight size={13} />
                          </span>
                          <span style={{ fontWeight: 600 }}>
                            {msg.type === 'agent_pushback'
                              ? `Objection & Pushback (${msg.agentName})`
                              : msg.taskTitle
                              ? `Step: ${msg.taskTitle}`
                              : `Execution Output (${msg.agentName || 'Step'})`}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#9da3af' }}>
                          {isExpanded ? 'Collapse' : 'Expand details'}
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="discussion-accordion-body">
                          {msg.text || '(No additional output)'}
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {isStreaming && (
          <div style={{ fontSize: 12, color: '#60a5fa', paddingLeft: 42, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-spin-dot" />
            <span>
              {activeWorkflowStep ||
                `${assignedAgents.map((a) => a.name).join(', ') || 'Team agents'} working on task in ${project.name}...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat input area */}
      <div className="chat-input-area">
        {attachedFiles.length > 0 && (
          <div className="chat-attached-files-bar">
            {attachedFiles.map((f) => {
              const name = f.split('/').filter(Boolean).pop() || f;
              return (
                <div key={f} className="chat-attached-chip" title={f}>
                  <FileText size={12} color="#60a5fa" />
                  <span className="chat-attached-chip-name">{name}</span>
                  <button
                    className="chat-attached-chip-remove"
                    onClick={() => handleRemoveAttachedFile(f)}
                    title="Remove attachment"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="chat-textarea-wrapper" style={{ position: 'relative' }}>
          {/* @ Mention Autocomplete Popup */}
          {showMentionMenu && filteredMentionAgents.length > 0 && (
            <div className="mention-popup">
              {filteredMentionAgents.map((ag, idx) => (
                <button
                  key={ag.id}
                  type="button"
                  className={`mention-popup-item ${idx === mentionIndex ? 'active' : ''}`}
                  onClick={() => handleSelectMention(ag)}
                >
                  <Bot size={13} color="#60a5fa" />
                  <span style={{ fontWeight: 600 }}>{ag.name}</span>
                  <span className="mention-popup-item-cmd">@{ag.command}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            className="chat-textarea"
            placeholder={
              assignedAgents.length > 0
                ? `Dispatch tasks to ${assignedAgents.map((a) => a.name).join(', ')} (type @agent to assign private task) in ${project.name}...`
                : `Type @agent or add an agent to start discussion in ${project.name}...`
            }
            rows={3}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
        </div>

        {/* Modern Compact Toolbar matching screenshot */}
        <div className="chat-bottom-toolbar" ref={toolbarRef}>
          <div className="chat-toolbar-left">
            {/* Attachment Button (+) */}
            <button
              type="button"
              className="chat-toolbar-icon-btn"
              title="Attach files to task context"
              onClick={handlePickAttachments}
            >
              <Plus size={15} />
            </button>

            {/* Target Scope Icon */}
            <button
              type="button"
              className="chat-toolbar-icon-btn"
              title="Target Scope"
            >
              <Target size={14} />
            </button>

            {/* Incomplete Ring / Progress indicator Icon */}
            <button
              type="button"
              className="chat-toolbar-icon-btn"
              title="Iteration Status"
            >
              <RotateCw size={13} />
            </button>

            {/* Review mode select */}
            <div className="chat-toolbar-select-wrap">
              <button
                type="button"
                className={`chat-toolbar-select-btn ${openDropdown === 'review' ? 'open' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'review' ? null : 'review')}
              >
                <span>{currentReviewObj.name}</span>
                <ChevronDown size={12} className="chevron" />
              </button>
              {openDropdown === 'review' && (
                <div className="chat-toolbar-menu">
                  {AUTO_REVIEW_MODES.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-toolbar-menu-item ${selectedReview === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedReview(item.id);
                        setOpenDropdown(null);
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exec Mode select */}
            <div className="chat-toolbar-select-wrap">
              <button
                type="button"
                className={`chat-toolbar-select-btn ${openDropdown === 'mode' ? 'open' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'mode' ? null : 'mode')}
              >
                <span>{currentModeObj.name}</span>
                <ChevronDown size={12} className="chevron" />
              </button>
              {openDropdown === 'mode' && (
                <div className="chat-toolbar-menu">
                  {EXEC_MODES.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-toolbar-menu-item ${selectedMode === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMode(item.id);
                        setOpenDropdown(null);
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fast Mode Toggle with Switch */}
            <div
              className="chat-toolbar-toggle-wrap"
              onClick={() => setIsFastMode(!isFastMode)}
              title="Toggle Fast Mode"
            >
              <span className="chat-toolbar-toggle-label">Fast mode</span>
              <div className={`chat-toolbar-switch ${isFastMode ? 'on' : ''}`}>
                <div className="chat-toolbar-switch-thumb" />
              </div>
            </div>
          </div>

          <div className="chat-toolbar-right">
            {isStreaming ? (
              <button
                type="button"
                className="chat-send-btn"
                style={{ backgroundColor: '#dc2626' }}
                title="Stop generation"
                onClick={handleAbort}
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="chat-send-btn"
                title="Send Task to Agents"
                disabled={!inputValue.trim() && attachedFiles.length === 0}
                onClick={() => handleSend()}
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Role Settings Modal */}
      <RoleSettingsModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        roles={roles}
        onSaveRoles={handleSaveRoles}
        supervisorConfig={supervisorConfig}
        onSaveSupervisorConfig={handleSaveSupervisorConfig}
        installedAIs={installedAIs}
      />
    </div>
  );
};
