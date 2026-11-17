import { ipcRenderer, contextBridge } from 'electron';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
}

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openFolderDialog: () => ipcRenderer.invoke('dialog-open-folder'),
  openFilesDialog: (defaultPath?: string) =>
    ipcRenderer.invoke('dialog-open-files', defaultPath),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs-read-dir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs-read-file', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('fs-write-file', { filePath, content }),
  createEntry: (targetPath: string, isDirectory: boolean) =>
    ipcRenderer.invoke('fs-create-entry', { targetPath, isDirectory }),
  renameEntry: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('fs-rename-entry', { oldPath, newPath }),
  deleteEntry: (targetPath: string) =>
    ipcRenderer.invoke('fs-delete-entry', targetPath),
  duplicateEntry: (sourcePath: string) =>
    ipcRenderer.invoke('fs-duplicate-entry', sourcePath),
  revealInExplorer: (targetPath: string) =>
    ipcRenderer.invoke('reveal-in-explorer', targetPath),

  // .zerous Project Initialization & Discussion Persistence
  projectInitZerous: (projectPath: string) =>
    ipcRenderer.invoke('project-init-zerous', projectPath),
  discussionLoadHistory: (projectPath: string, sessionId?: string) =>
    ipcRenderer.invoke('discussion-load-history', { projectPath, sessionId }),
  discussionSaveHistory: (projectPath: string, messages: any[], sessionId?: string) =>
    ipcRenderer.invoke('discussion-save-history', { projectPath, messages, sessionId }),
  discussionClearHistory: (projectPath: string, sessionId?: string) =>
    ipcRenderer.invoke('discussion-clear-history', { projectPath, sessionId }),

  // Agent Context Management (.zerous/agent-contexts)
  agentContextLoad: (projectPath: string, agentId: string) =>
    ipcRenderer.invoke('agent-context-load', { projectPath, agentId }),
  agentContextSave: (projectPath: string, agentId: string, context: any) =>
    ipcRenderer.invoke('agent-context-save', { projectPath, agentId, context }),
  agentContextClear: (projectPath: string, agentId: string) =>
    ipcRenderer.invoke('agent-context-clear', { projectPath, agentId }),

  gitGetStatus: (projectPath: string) =>
    ipcRenderer.invoke('git-get-status', projectPath),
  gitGetDetails: (projectPath: string) =>
    ipcRenderer.invoke('git-get-details', projectPath),
  gitStageFile: (projectPath: string, filePath: string) =>
    ipcRenderer.invoke('git-stage-file', { projectPath, filePath }),
  gitUnstageFile: (projectPath: string, filePath: string) =>
    ipcRenderer.invoke('git-unstage-file', { projectPath, filePath }),
  gitStageAll: (projectPath: string) =>
    ipcRenderer.invoke('git-stage-all', projectPath),
  gitUnstageAll: (projectPath: string) =>
    ipcRenderer.invoke('git-unstage-all', projectPath),
  gitDiscardFile: (projectPath: string, filePath: string) =>
    ipcRenderer.invoke('git-discard-file', { projectPath, filePath }),
  gitCommit: (projectPath: string, message: string) =>
    ipcRenderer.invoke('git-commit', { projectPath, message }),
  gitGetDiff: (projectPath: string, filePath: string, staged?: boolean) =>
    ipcRenderer.invoke('git-get-diff', { projectPath, filePath, staged }),
  gitGetBranches: (projectPath: string) =>
    ipcRenderer.invoke('git-get-branches', projectPath),
  gitCheckoutBranch: (projectPath: string, branch: string) =>
    ipcRenderer.invoke('git-checkout-branch', { projectPath, branch }),
  gitCreateBranch: (projectPath: string, branch: string) =>
    ipcRenderer.invoke('git-create-branch', { projectPath, branch }),
  gitPull: (projectPath: string) =>
    ipcRenderer.invoke('git-pull', projectPath),
  gitPush: (projectPath: string) =>
    ipcRenderer.invoke('git-push', projectPath),
  gitGetLog: (projectPath: string, limit?: number) =>
    ipcRenderer.invoke('git-get-log', { projectPath, limit }),

  // Terminal PTY APIs
  terminalCreate: (sessionId: string, cwd?: string) =>
    ipcRenderer.invoke('terminal-create', { sessionId, cwd }),
  terminalWrite: (sessionId: string, data: string) =>
    ipcRenderer.send('terminal-write', { sessionId, data }),
  terminalResize: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal-resize', { sessionId, cols, rows }),
  terminalKill: (sessionId: string) =>
    ipcRenderer.send('terminal-kill', sessionId),
  onTerminalData: (sessionId: string, callback: (data: string) => void) => {
    const channel = `terminal-data-${sessionId}`;
    const listener = (_event: any, data: string) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },
  onTerminalExit: (sessionId: string, callback: (data: { exitCode: number }) => void) => {
    const channel = `terminal-exit-${sessionId}`;
    const listener = (_event: any, data: { exitCode: number }) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },

  // Generic AI CLI Wrapper APIs with specific Project CWD
  aiGetWorkspaceContexts: (workspacePath: string, customHome?: string) =>
    ipcRenderer.invoke('ai-get-workspace-contexts', { workspacePath, customHome }),
  aiResumeConversation: (sessionId: string, conversationId: string, customHome?: string) =>
    ipcRenderer.invoke('ai-resume-conversation', { sessionId, conversationId, customHome }),
  aiSendPrompt: (
    sessionId: string,
    command: string,
    prompt: string,
    cwd: string,
    defaultArgs?: string,
    options?: {
      model?: string;
      effort?: string;
      mode?: string;
      customHome?: string;
      customEnv?: Record<string, string>;
    }
  ) =>
    ipcRenderer.invoke('ai-send-prompt', {
      sessionId,
      command,
      prompt,
      cwd,
      defaultArgs,
      model: options?.model,
      effort: options?.effort,
      mode: options?.mode,
      customHome: options?.customHome,
      customEnv: options?.customEnv,
    }),
  aiAbort: (sessionId: string) =>
    ipcRenderer.send('ai-abort', sessionId),

  onAiRawLog: (sessionId: string, callback: (log: string) => void) => {
    const channel = `ai-raw-log-${sessionId}`;
    const listener = (_event: any, log: string) => callback(log);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },
  onAiDelta: (sessionId: string, callback: (delta: string) => void) => {
    const channel = `ai-delta-${sessionId}`;
    const listener = (_event: any, delta: string) => callback(delta);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },

  onAiResult: (sessionId: string, callback: (result: any) => void) => {
    const channel = `ai-result-${sessionId}`;
    const listener = (_event: any, result: any) => callback(result);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },

  onAiDone: (sessionId: string, callback: (data: { code: number }) => void) => {
    const channel = `ai-done-${sessionId}`;
    const listener = (_event: any, data: { code: number }) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },

  onAiError: (sessionId: string, callback: (data: { error: string }) => void) => {
    const channel = `ai-error-${sessionId}`;
    const listener = (_event: any, data: { error: string }) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },

  // LangGraph Multi-Agent Orchestrator
  orchestratorRunWorkflow: (payload: {
    sessionId: string;
    userPrompt: string;
    projectPath: string;
    supervisorConfig: any;
    roles: any[];
    installedAIs: any[];
  }) => ipcRenderer.invoke('orchestrator-run-workflow', payload),

  onOrchestratorEvent: (sessionId: string, callback: (event: any) => void) => {
    const channel = `orchestrator-event-${sessionId}`;
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  },
});
