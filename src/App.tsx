import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  ChevronDown,
  Check,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  GitBranch,
  Terminal as TerminalIcon,
  FileText,
  X,
  MessageSquare,
  FolderOpen,
  RotateCcw,
} from 'lucide-react';
import { TreeBrowser } from './components/TreeBrowser';
import { AgentChat } from './components/AgentChat';
import { TerminalTab } from './components/TerminalTab';
import { FileEditorTab } from './components/FileEditorTab';
import { ManageAgentsTab } from './components/ManageAgentsTab';
import { DiscussionView } from './components/DiscussionView';
import { InstalledAI } from './components/ManageAgentsModal';
import { GitModal } from './components/GitModal';
import { SettingsTab } from './components/SettingsTab';
import { TasksListView } from './components/TasksListView';
import { AppSettings, DEFAULT_APP_SETTINGS } from './types/settings';
import { ArrowUp, ArrowDown, GitCommit, Settings as SettingsIcon, Files, ListTodo } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  path: string;
}

interface OpenTab {
  id: string;
  type: 'agent' | 'terminal' | 'file' | 'manage_agents' | 'settings';
  title?: string;
  filePath?: string;
  cwd?: string;
  selectedAIId?: string | null;
  sessionId?: string;
  settingsSection?: 'commonly_used' | 'agents' | 'editor' | 'terminal' | 'ai_orchestrator';
}

interface ProjectState {
  primaryAIId: string | null;
  assignedAgentIds?: string[]; // Multiple agents assigned to project's discussion
  openTabs: OpenTab[];
  activeTabId: string;
}

const INITIAL_PROJECTS: Project[] = [];

const DEFAULT_INSTALLED_AIS: InstalledAI[] = [
  { id: 'agy-default', name: 'Antigravity CLI (agy)', command: 'agy' },
  { id: 'claude-cli', name: 'Claude Code', command: 'claude' },
  { id: 'aider-cli', name: 'Aider', command: 'aider' },
];

// Helper to get 3 initial characters of folder/project name
function getProjectBadgeText(name: string): string {
  if (!name) return 'PRJ';
  const clean = name.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 3) {
    return clean.slice(0, 3).toUpperCase();
  }
  return (clean + '___').slice(0, 3).toUpperCase();
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('user_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean out legacy sample projects if user never manually added them
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (p: Project) =>
              p.path !== '/mnt/workspace/htdocs/mthan.net/kws.mthan.net' &&
              p.path !== '/mnt/workspace/htdocs/mthan.net/sms.mthan.net'
          );
        }
      }
      return INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => projects[0]?.id || '');

  // Quản lý riêng trạng thái (Tabs, Agent đang chọn, activeTab) cho TỪNG project
  const [projectStates, setProjectStates] = useState<Record<string, ProjectState>>({});

  // Installed AI list
  const [installedAIs, setInstalledAIs] = useState<InstalledAI[]>(() => {
    try {
      const saved = localStorage.getItem('installed_ais');
      return saved ? JSON.parse(saved) : DEFAULT_INSTALLED_AIS;
    } catch {
      return DEFAULT_INSTALLED_AIS;
    }
  });

  // Dropdown open state for any agent tab
  const [openDropdownTabId, setOpenDropdownTabId] = useState<string | null>(null);
  const [showRightbar, setShowRightbar] = useState(true);
  const [activeRightbarTab, setActiveRightbarTab] = useState<'explorer' | 'tasks'>('explorer');
  const [rightbarWidth, setRightbarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('rightbar_width');
    return saved ? parseInt(saved, 10) : 260;
  });
  const [isResizingRightbar, setIsResizingRightbar] = useState(false);

  // Resize handler for Right Panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRightbar) return;
      // rightbar width = window width - mouseX
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 160 && newWidth <= 800) {
        setRightbarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingRightbar) {
        setIsResizingRightbar(false);
        localStorage.setItem('rightbar_width', rightbarWidth.toString());
      }
    };

    if (isResizingRightbar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingRightbar, rightbarWidth]);

  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  // Git State
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [gitInitialTab, setGitInitialTab] = useState<'changes' | 'branches' | 'history'>('changes');
  const [activeProjectGit, setActiveProjectGit] = useState<{
    isRepo: boolean;
    branch: string;
    isDirty: boolean;
    ahead: number;
    behind: number;
    changeCount: number;
  }>({
    isRepo: false,
    branch: '',
    isDirty: false,
    ahead: 0,
    behind: 0,
    changeCount: 0,
  });

  // Ensure .zerous folder exists when opening/switching projects
  useEffect(() => {
    const proj = projects.find((p) => p.id === activeProjectId);
    if (proj?.path) {
      window.electronAPI?.projectInitZerous?.(proj.path).catch(console.error);
    }
  }, [activeProjectId, projects]);

  const refreshActiveProjectGit = () => {
    const proj = projects.find((p) => p.id === activeProjectId);
    if (!proj) return;
    window.electronAPI?.gitGetDetails?.(proj.path).then((res) => {
      if (res) {
        setActiveProjectGit({
          isRepo: res.isRepo,
          branch: res.branch,
          isDirty: res.isDirty,
          ahead: res.ahead || 0,
          behind: res.behind || 0,
          changeCount: (res.stagedFiles?.length || 0) + (res.unstagedFiles?.length || 0) + (res.untrackedFiles?.length || 0),
        });
      }
    });
  };

  useEffect(() => {
    refreshActiveProjectGit();
    const interval = setInterval(refreshActiveProjectGit, 5000);
    return () => clearInterval(interval);
  }, [activeProjectId, projects]);

  const openGitModalWithTab = (tab: 'changes' | 'branches' | 'history') => {
    setGitInitialTab(tab);
    setIsGitModalOpen(true);
  };

  // Global App Settings
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('app_settings');
      return saved ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) } : DEFAULT_APP_SETTINGS;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  });

  const handleUpdateSettings = (updates: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('app_settings', JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const handleResetSettings = () => {
    setAppSettings(DEFAULT_APP_SETTINGS);
    try {
      localStorage.setItem('app_settings', JSON.stringify(DEFAULT_APP_SETTINGS));
    } catch (err) {
      console.error(err);
    }
  };

  // Lấy trạng thái hiện tại của activeProject
  const currentProjectState: ProjectState = projectStates[activeProjectId] || {
    primaryAIId: null,
    openTabs: [],
    activeTabId: 'primary-agent',
  };

  const primaryAIId = currentProjectState.primaryAIId;
  const openTabs = currentProjectState.openTabs;
  const activeTabId = currentProjectState.activeTabId;

  // Helper cập nhật trạng thái riêng của project hiện tại
  const updateCurrentProjectState = (updater: (prev: ProjectState) => ProjectState) => {
    setProjectStates((prev) => {
      const existing = prev[activeProjectId] || {
        primaryAIId: null,
        openTabs: [],
        activeTabId: 'primary-agent',
      };
      return {
        ...prev,
        [activeProjectId]: updater(existing),
      };
    });
  };

  // Save projects and installed_ais
  useEffect(() => {
    localStorage.setItem('user_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('installed_ais', JSON.stringify(installedAIs));
  }, [installedAIs]);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownTabId(null);
      }
    };

    if (openDropdownTabId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownTabId]);

  // Open directory dialog via Electron and add/select project
  const handleOpenFolder = async () => {
    try {
      const selectedPath = await window.electronAPI?.openFolderDialog();
      if (!selectedPath) return;

      const parts = selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const folderName = parts[parts.length - 1] || selectedPath;

      const existing = projects.find((p) => p.path === selectedPath);
      if (existing) {
        setActiveProjectId(existing.id);
        return;
      }

      const newId = `${Date.now()}-${selectedPath}`;
      const newProject: Project = {
        id: newId,
        name: folderName,
        path: selectedPath,
      };

      setProjects((prev) => [newProject, ...prev]);
      setProjectStates((prev) => ({
        ...prev,
        [newId]: { primaryAIId: null, openTabs: [], activeTabId: 'primary-agent' },
      }));
      setActiveProjectId(newId);

      // Automatically create .zerous structure in new project
      window.electronAPI?.projectInitZerous?.(selectedPath).catch(console.error);
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleRemoveProject = (projectId: string) => {
    const projToRemove = projects.find((p) => p.id === projectId);
    if (!projToRemove) return;

    if (!window.confirm(`Remove project "${projToRemove.name}" from IDE workspace?\n(No local files will be deleted).`)) {
      return;
    }

    const updatedProjects = projects.filter((p) => p.id !== projectId);
    setProjects(updatedProjects);

    // If active project was deleted, switch to first remaining
    if (activeProjectId === projectId) {
      if (updatedProjects.length > 0) {
        setActiveProjectId(updatedProjects[0].id);
      } else {
        setActiveProjectId('');
      }
    }

    // Clean up project state
    setProjectStates((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  };

  const handleAddAI = (newAI: InstalledAI) => {
    setInstalledAIs((prev) => [...prev, newAI]);
    if (!primaryAIId) {
      updateCurrentProjectState((st) => ({ ...st, primaryAIId: newAI.id }));
    }
  };

  const handleDeleteAI = (id: string) => {
    const remaining = installedAIs.filter((a) => a.id !== id);
    setInstalledAIs(remaining);
    setProjectStates((prev) => {
      const updated: Record<string, ProjectState> = {};
      for (const [projId, st] of Object.entries(prev)) {
        updated[projId] = {
          ...st,
          primaryAIId: st.primaryAIId === id ? null : st.primaryAIId,
          openTabs: st.openTabs.map((t) =>
            t.selectedAIId === id ? { ...t, selectedAIId: null } : t
          ),
        };
      }
      return updated;
    });
  };

  // Tab management helpers
  const handleOpenFile = (filePath: string, fileName: string) => {
    const tabId = `file-${filePath}`;
    updateCurrentProjectState((st) => {
      const existing = st.openTabs.find((t) => t.id === tabId);
      if (!existing) {
        return {
          ...st,
          openTabs: [
            ...st.openTabs,
            { id: tabId, type: 'file', title: fileName, filePath },
          ],
          activeTabId: tabId,
        };
      }
      return { ...st, activeTabId: tabId };
    });
  };

  const handleOpenNewTerminal = (customCwd?: string, customTitle?: string) => {
    updateCurrentProjectState((st) => {
      const newIndex = st.openTabs.filter((t) => t.type === 'terminal').length + 1;
      const tabId = `term-${activeProjectId}-${Date.now()}`;
      const folderName = customCwd ? customCwd.split('/').filter(Boolean).pop() : undefined;
      const title = customTitle || (folderName ? `Terminal: ${folderName}` : `Terminal ${newIndex}`);
      return {
        ...st,
        openTabs: [
          ...st.openTabs,
          {
            id: tabId,
            type: 'terminal',
            title,
            sessionId: tabId,
            cwd: customCwd,
          },
        ],
        activeTabId: tabId,
      };
    });
  };

  const handleOpenNewAgent = () => {
    updateCurrentProjectState((st) => {
      const tabId = `agent-${activeProjectId}-${Date.now()}`;
      return {
        ...st,
        openTabs: [
          ...st.openTabs,
          {
            id: tabId,
            type: 'agent',
            selectedAIId: null,
            sessionId: tabId,
          },
        ],
        activeTabId: tabId,
      };
    });
  };

  const handleOpenSettingsTab = (defaultSection?: 'commonly_used' | 'agents' | 'editor' | 'terminal' | 'ai_orchestrator') => {
    setOpenDropdownTabId(null);
    const tabId = 'settings-tab';
    updateCurrentProjectState((st) => {
      const existing = st.openTabs.find((t) => t.id === tabId);
      if (!existing) {
        return {
          ...st,
          openTabs: [
            ...st.openTabs,
            {
              id: tabId,
              type: 'settings',
              title: 'Settings',
              settingsSection: defaultSection,
            },
          ],
          activeTabId: tabId,
        };
      }
      return {
        ...st,
        openTabs: st.openTabs.map((t) =>
          t.id === tabId && defaultSection ? { ...t, settingsSection: defaultSection } : t
        ),
        activeTabId: tabId,
      };
    });
  };

  const handleOpenManageAgents = () => {
    handleOpenSettingsTab('agents');
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (openDropdownTabId === tabId) {
      setOpenDropdownTabId(null);
    }
    updateCurrentProjectState((st) => ({
      ...st,
      openTabs: st.openTabs.filter((t) => t.id !== tabId),
      activeTabId: st.activeTabId === tabId ? 'primary-agent' : st.activeTabId,
    }));
  };

  const handleSelectTabAI = (tabId: string, aiId: string) => {
    updateCurrentProjectState((st) => {
      if (tabId === 'primary-agent') {
        return { ...st, primaryAIId: aiId };
      }
      return {
        ...st,
        openTabs: st.openTabs.map((t) =>
          t.id === tabId ? { ...t, selectedAIId: aiId } : t
        ),
      };
    });
    setOpenDropdownTabId(null);
  };

  const handleToggleDiscussionAgent = (agentId: string) => {
    updateCurrentProjectState((st) => {
      const current = st.assignedAgentIds || (st.primaryAIId ? [st.primaryAIId] : []);
      const exists = current.includes(agentId);
      const next = exists ? current.filter((id) => id !== agentId) : [...current, agentId];
      return {
        ...st,
        assignedAgentIds: next,
        primaryAIId: next[0] || null,
      };
    });
  };

  const activeDynamicTab = openTabs.find((t) => t.id === activeTabId);

  // Tìm AI của tab hiện tại đang focus để hiển thị trên statusbar
  const activeTabAI =
    activeTabId === 'primary-agent'
      ? installedAIs.find((a) => a.id === primaryAIId)
      : activeDynamicTab?.type === 'agent'
      ? installedAIs.find((a) => a.id === activeDynamicTab.selectedAIId)
      : null;

  return (
    <>
      <header className="topbar">
        {/* Left section: 60px Logo box + Primary Agent Tab + Dynamic Tabs (Cloned Agent, Files, Terminals) */}
        <div className="topbar-left" ref={dropdownContainerRef}>
          <div className="app-logo-box" title="Zerous">
            <svg
              className="logo-badge"
              viewBox="0 0 512 512"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g strokeWidth="66" strokeLinejoin="miter" strokeMiterlimit="10">
                {/* Tam giác hướng lên (Xám đậm / Carbon #3F3F46) */}
                <polygon points="256,56 429.2,356 82.8,356" stroke="#3F3F46" />
                {/* Tam giác hướng xuống (Cam rực rỡ #FF5A00) */}
                <polygon points="256,456 82.8,156 429.2,156" stroke="#FF5A00" />
                {/* Các đoạn đan xen (Overpass) */}
                <line x1="256" y1="56" x2="342.6" y2="206" stroke="#3F3F46" strokeLinecap="butt" />
                <line x1="429.2" y1="356" x2="256" y2="356" stroke="#3F3F46" strokeLinecap="butt" />
                <line x1="82.8" y1="356" x2="169.4" y2="206" stroke="#3F3F46" strokeLinecap="butt" />
              </g>
            </svg>
          </div>

          {/* Primary Fixed Tab: Discussion */}
          <div className="agent-tab-container">
            <button
              className={`fixed-agent-tab ${activeTabId === 'primary-agent' ? 'active' : ''} ${openDropdownTabId === 'primary-agent' ? 'open' : ''}`}
              onClick={() => {
                updateCurrentProjectState((st) => ({ ...st, activeTabId: 'primary-agent' }));
                setOpenDropdownTabId(
                  openDropdownTabId === 'primary-agent' ? null : 'primary-agent'
                );
              }}
              title="Discussion (Project Operations)"
            >
              <MessageSquare size={14} color={activeTabId === 'primary-agent' ? '#60a5fa' : '#8f9299'} />
              <span style={{ color: activeTabId === 'primary-agent' ? '#ffffff' : '#8f9299' }}>
                Discussion
              </span>
              <ChevronDown size={12} color="#8f9299" />
            </button>

            {/* Dropdown with Project-scope Operations */}
            {openDropdownTabId === 'primary-agent' && (
              <div className="agents-dropdown">
                <div className="agents-dropdown-title">
                  {activeProject ? activeProject.name : 'Project Operations'}
                </div>
                <div className="agents-dropdown-list">
                  <button
                    className="agent-dropdown-item"
                    onClick={() => {
                      setOpenDropdownTabId(null);
                      handleOpenNewAgent();
                    }}
                  >
                    <div className="agent-item-left">
                      <Bot size={14} color="#60a5fa" />
                      <span className="agent-item-name">New Agent Chat Tab</span>
                    </div>
                  </button>

                  <button
                    className="agent-dropdown-item"
                    onClick={() => {
                      setOpenDropdownTabId(null);
                      handleOpenNewTerminal();
                    }}
                  >
                    <div className="agent-item-left">
                      <TerminalIcon size={14} color="#10b981" />
                      <span className="agent-item-name">New Terminal Session</span>
                    </div>
                  </button>

                  <button
                    className="agent-dropdown-item"
                    onClick={() => {
                      setOpenDropdownTabId(null);
                      setShowRightbar(true);
                      if (activeProject?.path) {
                        window.electronAPI?.revealInExplorer(activeProject.path).catch(console.error);
                      }
                    }}
                    title="Open project folder in OS file manager and expand IDE Explorer"
                  >
                    <div className="agent-item-left">
                      <FolderOpen size={14} color="#60a5fa" />
                      <span className="agent-item-name">Reveal in Explorer</span>
                    </div>
                  </button>

                  {/* Remove Project from Workspace Option */}
                  {activeProject && (
                    <button
                      className="agent-dropdown-item"
                      style={{ color: '#f87171' }}
                      onClick={() => {
                        setOpenDropdownTabId(null);
                        handleRemoveProject(activeProject.id);
                      }}
                      title="Remove this project from IDE workspace (files on disk are safe)"
                    >
                      <div className="agent-item-left">
                        <X size={14} color="#ef4444" />
                        <span className="agent-item-name" style={{ color: '#ef4444' }}>
                          Remove Project from Workspace
                        </span>
                      </div>
                    </button>
                  )}
                </div>

                <div className="agents-dropdown-divider" />

                <button
                  className="agent-dropdown-manage"
                  onClick={handleOpenManageAgents}
                >
                  <Settings2 size={14} />
                  <span>Manage Installed AIs...</span>
                </button>
              </div>
            )}
          </div>

          {/* Dynamic Tabs (Files, Terminals, Cloned Agent Tabs) */}
          <div className="topbar-tabs-scroll">
            {openTabs.map((tab) => {
              const isActive = activeTabId === tab.id;

              if (tab.type === 'agent') {
                const tabAI = installedAIs.find((a) => a.id === tab.selectedAIId);
                const isDropdownOpen = openDropdownTabId === tab.id;

                return (
                  <div key={tab.id} className="agent-tab-container">
                    <div
                      className={`topbar-tab-item ${isActive ? 'active' : ''} ${isDropdownOpen ? 'open' : ''}`}
                      onClick={() => {
                        updateCurrentProjectState((st) => ({ ...st, activeTabId: tab.id }));
                        setOpenDropdownTabId(isDropdownOpen ? null : tab.id);
                      }}
                      title="Select Agent for this session"
                    >
                      <Bot size={13} color={tabAI ? '#60a5fa' : '#8f9299'} />
                      <span className="topbar-tab-title" style={{ color: tabAI ? '#ffffff' : '#8f9299' }}>
                        {tabAI ? tabAI.name : 'Select Agent'}
                      </span>
                      <ChevronDown size={11} color="#8f9299" />
                      <button
                        className="topbar-tab-close"
                        title="Close tab"
                        onClick={(e) => handleCloseTab(tab.id, e)}
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Dropdown with installed AIs for this specific Agent Tab clone */}
                    {isDropdownOpen && (
                      <div className="agents-dropdown">
                        <div className="agents-dropdown-title">Installed AIs</div>
                        <div className="agents-dropdown-list">
                          {installedAIs.map((ai) => (
                            <button
                              key={ai.id}
                              className={`agent-dropdown-item ${tab.selectedAIId === ai.id ? 'active' : ''}`}
                              onClick={() => handleSelectTabAI(tab.id, ai.id)}
                            >
                              <div className="agent-item-left">
                                <Bot
                                  size={14}
                                  color={tab.selectedAIId === ai.id ? '#60a5fa' : '#8f9299'}
                                />
                                <span className="agent-item-name">{ai.name}</span>
                              </div>
                              {tab.selectedAIId === ai.id && <Check size={14} color="#60a5fa" />}
                            </button>
                          ))}
                        </div>

                        <div className="agents-dropdown-divider" />

                        <button
                          className="agent-dropdown-manage"
                          onClick={handleOpenManageAgents}
                        >
                          <Settings2 size={14} />
                          <span>Manage Installed AIs...</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={tab.id}
                  className={`topbar-tab-item ${isActive ? 'active' : ''}`}
                  onClick={() => updateCurrentProjectState((st) => ({ ...st, activeTabId: tab.id }))}
                  title={tab.filePath || tab.title}
                >
                  {tab.type === 'file' && <FileText size={13} color={isActive ? '#60a5fa' : '#8f9299'} />}
                  {tab.type === 'terminal' && <TerminalIcon size={13} color={isActive ? '#10b981' : '#8f9299'} />}
                  {tab.type === 'manage_agents' && <Settings2 size={13} color={isActive ? '#60a5fa' : '#8f9299'} />}
                  {tab.type === 'settings' && <SettingsIcon size={13} color={isActive ? '#60a5fa' : '#8f9299'} />}
                  <span className="topbar-tab-title">{tab.title}</span>
                  <button
                    className="topbar-tab-close"
                    title="Close tab"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Window Drag Area */}
          <div className="topbar-drag-region" />
        </div>

        {/* Right section: Action Icons (Terminal, Settings) + 3 Window Control buttons */}
        <div className="window-controls">
          <button
            className="topbar-btn"
            title="Open new Terminal tab"
            onClick={() => handleOpenNewTerminal()}
          >
            <TerminalIcon size={15} />
          </button>
          <button
            className="topbar-btn"
            style={{ marginRight: 6 }}
            title="Settings"
            onClick={() => handleOpenSettingsTab()}
          >
            <SettingsIcon size={15} />
          </button>

          <button
            className="control-btn"
            title="Minimize"
            aria-label="Minimize"
            onClick={handleMinimize}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 5.5H10" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="control-btn"
            title="Maximize"
            aria-label="Maximize"
            onClick={handleMaximize}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="1.5" y="1.5" width="8" height="8" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="control-btn close"
            title="Close"
            aria-label="Close"
            onClick={handleClose}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Left Bar width 60px: Vertical Projects List */}
        <aside className="leftbar">
          <button
            className="leftbar-add-btn"
            title="Open project folder..."
            onClick={handleOpenFolder}
          >
            <Plus size={16} />
          </button>

          <div className="leftbar-divider" />

          {/* List of Projects */}
          <div className="leftbar-projects-list">
            {projects.map((proj) => {
              const isActive = activeProjectId === proj.id;
              const badgeText = getProjectBadgeText(proj.name);
              return (
                <button
                  key={proj.id}
                  className={`project-icon-btn ${isActive ? 'active' : ''}`}
                  title={`${proj.name}\n${proj.path}`}
                  onClick={() => setActiveProjectId(proj.id)}
                >
                  {badgeText}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center Container: Workspace + Statusbar bounded between Leftbar and Rightbar */}
        <div className="center-container">
          {/* Main Content Workspace */}
          <main className="main-content" style={{ position: 'relative' }}>
            {projects.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: '#64748b',
                  gap: 16,
                  userSelect: 'none',
                }}
              >
                <FolderOpen size={48} color="#3b82f6" />
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: 16, color: '#f1f5f9', margin: '0 0 6px 0', fontWeight: 600 }}>
                    No Project Open
                  </h2>
                  <p style={{ fontSize: 12, color: '#717582', margin: 0, maxWidth: 360 }}>
                    Click the <strong>+</strong> button in the left sidebar to open a project directory and start collaborating with AI agents.
                  </p>
                </div>
                <button
                  onClick={handleOpenFolder}
                  style={{
                    backgroundColor: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Plus size={14} />
                  <span>Open Project Folder</span>
                </button>
              </div>
            ) : (
              projects.map((proj) => {
              const isProjActive = proj.id === activeProjectId;
              const pState = projectStates[proj.id] || {
                primaryAIId: null,
                openTabs: [],
                activeTabId: 'primary-agent',
              };

              return (
                <div
                  key={`proj-layer-${proj.id}`}
                  style={{
                    display: isProjActive ? 'flex' : 'none',
                    width: '100%',
                    height: '100%',
                    flexDirection: 'column',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                >
                  {/* Primary Discussion View for this project */}
                  <div
                    style={{
                      display: pState.activeTabId === 'primary-agent' ? 'flex' : 'none',
                      width: '100%',
                      height: '100%',
                      flexDirection: 'column',
                    }}
                  >
                    <DiscussionView
                      project={proj}
                      installedAIs={installedAIs}
                      activeAgentIds={
                        pState.assignedAgentIds && pState.assignedAgentIds.length > 0
                          ? pState.assignedAgentIds
                          : pState.primaryAIId
                          ? [pState.primaryAIId]
                          : installedAIs[0]
                          ? [installedAIs[0].id]
                          : []
                      }
                      onToggleAgent={handleToggleDiscussionAgent}
                      onOpenManageAgents={handleOpenManageAgents}
                      projectBadge={getProjectBadgeText(proj.name)}
                    />
                  </div>

                  {/* Dynamic Tabs */}
                  {pState.openTabs.map((tab) => {
                    const isTabActive = pState.activeTabId === tab.id;

                    return (
                      <div
                        key={tab.id}
                        style={{
                          display: isTabActive ? 'flex' : 'none',
                          width: '100%',
                          height: '100%',
                          flexDirection: 'column',
                        }}
                      >
                        {tab.type === 'terminal' ? (
                          <TerminalTab
                            sessionId={tab.sessionId || tab.id}
                            cwd={tab.cwd || proj.path}
                          />
                        ) : tab.type === 'agent' ? (
                          (() => {
                            const tabAI = installedAIs.find((a) => a.id === tab.selectedAIId);
                            return tabAI ? (
                              <AgentChat
                                sessionId={`ai-${tab.id}-${tabAI.id}-${proj.id}`}
                                agentName={tabAI.name}
                                agentCommand={tabAI.command}
                                defaultArgs={tabAI.defaultArgs}
                                customHome={tabAI.customHome}
                                customEnv={tabAI.customEnv}
                                cwd={proj.path}
                                projectName={proj.name}
                              />
                            ) : (
                              <div className="empty-state">
                                <Bot size={36} color="#454854" style={{ marginBottom: 12 }} />
                                <p style={{ fontSize: 14, color: '#8f9299', margin: '0 0 6px 0' }}>No Agent Selected for this tab</p>
                                <p style={{ fontSize: 12, color: '#5c606e', margin: 0 }}>
                                  Please click <strong>"Select Agent"</strong> on this tab to choose an AI session in <strong>{proj.name}</strong>.
                                </p>
                              </div>
                            );
                          })()
                        ) : tab.type === 'file' && tab.filePath ? (
                          <FileEditorTab filePath={tab.filePath} />
                        ) : tab.type === 'manage_agents' ? (
                          <ManageAgentsTab
                            agents={installedAIs}
                            onAddAgent={handleAddAI}
                            onDeleteAgent={handleDeleteAI}
                          />
                        ) : tab.type === 'settings' ? (
                          <SettingsTab
                            settings={appSettings}
                            onUpdateSettings={handleUpdateSettings}
                            onResetSettings={handleResetSettings}
                            installedAIs={installedAIs}
                            onAddAgent={handleAddAI}
                            onDeleteAgent={handleDeleteAI}
                            initialSection={tab.settingsSection}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            }))}
          </main>

          {/* Status Bar bounded between Left Bar and Right Bar */}
          <footer className="statusbar">
            <div className="statusbar-left">
              <div className="statusbar-item">
                <span className={`status-dot ${activeTabAI ? '' : 'idle'}`} />
                <span>{activeTabAI ? activeTabAI.name : 'No Agent Selected'}</span>
              </div>

              {activeProject && activeProjectGit.isRepo && (
                <>
                  {/* Branch Button */}
                  <div
                    className="statusbar-item clickable git-statusbar-branch"
                    title={`Current Branch: ${activeProjectGit.branch}\nClick to switch or create branch`}
                    onClick={() => openGitModalWithTab('branches')}
                  >
                    <GitBranch size={13} color="#60a5fa" />
                    <span style={{ fontWeight: 600, color: '#f1f3f7' }}>{activeProjectGit.branch}</span>
                  </div>

                  {/* Sync Status / Ahead & Behind */}
                  {(activeProjectGit.ahead > 0 || activeProjectGit.behind > 0) && (
                    <div
                      className="statusbar-item clickable git-statusbar-sync"
                      title={`${activeProjectGit.behind} to pull, ${activeProjectGit.ahead} to push\nClick to manage sync`}
                      onClick={() => openGitModalWithTab('changes')}
                    >
                      {activeProjectGit.behind > 0 && (
                        <span className="git-sync-down">
                          <ArrowDown size={11} />
                          {activeProjectGit.behind}
                        </span>
                      )}
                      {activeProjectGit.ahead > 0 && (
                        <span className="git-sync-up">
                          <ArrowUp size={11} />
                          {activeProjectGit.ahead}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Changes Counter / Source Control Trigger */}
                  <div
                    className={`statusbar-item clickable git-statusbar-changes ${activeProjectGit.isDirty ? 'dirty' : ''}`}
                    title={`${activeProjectGit.changeCount} uncommitted changes\nClick to view Source Control & Diff`}
                    onClick={() => openGitModalWithTab('changes')}
                  >
                    <GitCommit size={13} color={activeProjectGit.isDirty ? '#f59e0b' : '#10b981'} />
                    <span>
                      {activeProjectGit.changeCount > 0 ? `${activeProjectGit.changeCount} changes` : 'Clean'}
                    </span>
                  </div>

                  {/* Git History Log Trigger */}
                  <div
                    className="statusbar-item clickable git-statusbar-history"
                    title="View Commit History"
                    onClick={() => openGitModalWithTab('history')}
                  >
                    <RotateCcw size={12} />
                    <span>History</span>
                  </div>
                </>
              )}
            </div>

            <div className="statusbar-right">
              {activeProject && (
                <div className="statusbar-item" title={activeProject.path}>
                  <span>{activeProject.name}</span>
                </div>
              )}
              <div className="statusbar-item">
                <span>UTF-8</span>
              </div>
              <button
                className="statusbar-btn"
                title="Open Settings"
                onClick={() => handleOpenSettingsTab()}
              >
                <SettingsIcon size={14} />
              </button>
              <button
                className={`statusbar-btn ${showRightbar ? 'active' : ''}`}
                title={showRightbar ? 'Hide Explorer' : 'Show Explorer'}
                onClick={() => setShowRightbar(!showRightbar)}
              >
                {showRightbar ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </button>
            </div>
          </footer>
        </div>

        {/* Right Bar: Explorer & Tasks List with dedicated Bottombar and Resizer Handle */}
        {showRightbar && (
          <aside className="rightbar" style={{ width: rightbarWidth }}>
            {/* Resizer Handle at the left border of Right Panel */}
            <div
              className={`panel-resizer-handle ${isResizingRightbar ? 'active' : ''}`}
              onMouseDown={() => setIsResizingRightbar(true)}
              title="Drag to resize panel"
            />
            
            {/* Header displaying active tab title */}
            <div className="rightbar-header">
              <span>{activeRightbarTab === 'explorer' ? 'Explorer' : 'Tasks List'}</span>
              {activeProject && (
                <span style={{ fontSize: 11, color: '#6e727e', textTransform: 'none' }}>
                  {activeProject.name}
                </span>
              )}
            </div>

            {/* Content view switching based on active rightbar tab */}
            <div className="rightbar-content">
              {activeRightbarTab === 'explorer' ? (
                <TreeBrowser
                  rootPath={activeProject?.path}
                  rootName={activeProject?.name}
                  onOpenFile={handleOpenFile}
                  onOpenTerminal={handleOpenNewTerminal}
                />
              ) : (
                <TasksListView
                  projectPath={activeProject?.path}
                  projectName={activeProject?.name}
                />
              )}
            </div>

            {/* Rightbar Dedicated Bottom Bar (aligned in height with center statusbar: 32px) */}
            <div className="rightbar-bottombar">
              <button
                className={`rightbar-bottombar-tab ${activeRightbarTab === 'explorer' ? 'active' : ''}`}
                onClick={() => setActiveRightbarTab('explorer')}
                title="Files Explorer"
              >
                <Files size={12} />
                <span>Explorer</span>
              </button>
              <button
                className={`rightbar-bottombar-tab ${activeRightbarTab === 'tasks' ? 'active' : ''}`}
                onClick={() => setActiveRightbarTab('tasks')}
                title="Tasks List & Agent Deliverables"
              >
                <ListTodo size={12} />
                <span>Tasks</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Global Git Management Modal */}
      {activeProject && (
        <GitModal
          isOpen={isGitModalOpen}
          onClose={() => setIsGitModalOpen(false)}
          projectPath={activeProject.path}
          projectName={activeProject.name}
          initialTab={gitInitialTab}
          onRefreshProject={refreshActiveProjectGit}
        />
      )}
    </>
  );
}
