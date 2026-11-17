export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  openFolderDialog: () => Promise<string | null>;
  openFilesDialog: (defaultPath?: string) => Promise<string[]>;
  readDir: (dirPath: string) => Promise<FileNode[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  createEntry: (targetPath: string, isDirectory: boolean) => Promise<{ success: boolean; error?: string }>;
  renameEntry: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteEntry: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  duplicateEntry: (sourcePath: string) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  revealInExplorer: (targetPath: string) => Promise<{ success: boolean; error?: string }>;

  // .zerous Project Initialization & Discussion Persistence
  projectInitZerous: (projectPath: string) => Promise<{ success: boolean; zerousDir?: string; error?: string }>;
  discussionLoadHistory: (projectPath: string, sessionId?: string) => Promise<{ success: boolean; messages: any[]; error?: string }>;
  discussionSaveHistory: (projectPath: string, messages: any[], sessionId?: string) => Promise<{ success: boolean; error?: string }>;
  discussionClearHistory: (projectPath: string, sessionId?: string) => Promise<{ success: boolean; error?: string }>;

  // Agent Context Management (.zerous/agent-contexts)
  agentContextLoad: (projectPath: string, agentId: string) => Promise<{ success: boolean; context: any; error?: string }>;
  agentContextSave: (projectPath: string, agentId: string, context: any) => Promise<{ success: boolean; error?: string }>;
  agentContextClear: (projectPath: string, agentId: string) => Promise<{ success: boolean; error?: string }>;

  gitGetStatus: (projectPath: string) => Promise<{ isRepo: boolean; branch: string; isDirty: boolean }>;
  gitGetDetails: (projectPath: string) => Promise<any>;
  gitStageFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  gitUnstageFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  gitStageAll: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  gitUnstageAll: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  gitDiscardFile: (projectPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
  gitCommit: (projectPath: string, message: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  gitGetDiff: (projectPath: string, filePath: string, staged?: boolean) => Promise<{ success: boolean; diff: string; error?: string }>;
  gitGetBranches: (projectPath: string) => Promise<{ success: boolean; branches: string[]; error?: string }>;
  gitCheckoutBranch: (projectPath: string, branch: string) => Promise<{ success: boolean; error?: string }>;
  gitCreateBranch: (projectPath: string, branch: string) => Promise<{ success: boolean; error?: string }>;
  gitPull: (projectPath: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  gitPush: (projectPath: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  gitGetLog: (projectPath: string, limit?: number) => Promise<{ success: boolean; commits: any[]; error?: string }>;

  // Terminal PTY
  terminalCreate: (sessionId: string, cwd?: string) => Promise<boolean>;
  terminalWrite: (sessionId: string, data: string) => void;
  terminalResize: (sessionId: string, cols: number, rows: number) => void;
  terminalKill: (sessionId: string) => void;
  onTerminalData: (sessionId: string, callback: (data: string) => void) => () => void;
  onTerminalExit: (sessionId: string, callback: (data: { exitCode: number }) => void) => () => void;

  // Generic AI CLI Wrapper with project CWD
  aiGetWorkspaceContexts: (workspacePath: string, customHome?: string) => Promise<Array<{
    conversationId: string;
    title: string;
    preview: string;
    lastModified?: string;
  }>>;
  aiResumeConversation: (sessionId: string, conversationId: string, customHome?: string) => Promise<{
    success: boolean;
    conversationId: string;
    messages: Array<{
      id: string;
      sender: 'user' | 'assistant';
      text: string;
      timestamp: number;
    }>;
  }>;
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
  ) => Promise<boolean>;
  aiAbort: (sessionId: string) => void;
  onAiRawLog: (sessionId: string, callback: (log: string) => void) => () => void;
  onAiDelta: (sessionId: string, callback: (delta: string) => void) => () => void;
  onAiResult: (sessionId: string, callback: (result: any) => void) => () => void;
  onAiDone: (sessionId: string, callback: (data: { code: number }) => void) => () => void;
  onAiError: (sessionId: string, callback: (data: { error: string }) => void) => () => void;

  // LangGraph Multi-Agent Orchestrator
  orchestratorRunWorkflow: (payload: {
    sessionId: string;
    userPrompt: string;
    projectPath: string;
    supervisorConfig: any;
    roles: any[];
    installedAIs: any[];
  }) => Promise<{ success: boolean; finalState?: any; error?: string }>;
  onOrchestratorEvent: (sessionId: string, callback: (event: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
