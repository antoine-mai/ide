import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import * as pty from 'node-pty';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  const appRoot = process.env.APP_ROOT || path.join(__dirname, '..');
  const iconPath = path.join(appRoot, 'public', 'icon.png');
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#121316',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setMenu(null);
  win.maximize();
  win.show();

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

ipcMain.on('window-minimize', (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) ?? win;
  targetWin?.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) ?? win;
  if (targetWin?.isMaximized()) {
    targetWin.unmaximize();
  } else {
    targetWin?.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) ?? win;
  targetWin?.close();
});

// Open Folder Dialog
ipcMain.handle('dialog-open-folder', async (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) ?? win;
  if (!targetWin) return null;

  const result = await dialog.showOpenDialog(targetWin, {
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Open File(s) Dialog for attachments
ipcMain.handle('dialog-open-files', async (event, defaultPath?: string) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender) ?? win;
  if (!targetWin) return [];

  const result = await dialog.showOpenDialog(targetWin, {
    defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
    properties: ['openFile', 'multiSelections'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  return result.filePaths;
});

// Reveal in System File Manager (OS Explorer)
ipcMain.handle('reveal-in-explorer', async (_event, targetPath: string) => {
  try {
    if (!targetPath) return { success: false, error: 'Path required' };
    if (fs.existsSync(targetPath)) {
      const stat = await fs.promises.stat(targetPath);
      if (stat.isDirectory()) {
        await shell.openPath(targetPath);
      } else {
        shell.showItemInFolder(targetPath);
      }
      return { success: true };
    } else {
      return { success: false, error: 'Path does not exist' };
    }
  } catch (err: any) {
    console.error('Failed to reveal in explorer:', err);
    return { success: false, error: err?.message || err };
  }
});

// Read Directory for Tree Browser
export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
}

ipcMain.handle('fs-read-dir', async (_event, dirPath: string): Promise<FileNode[]> => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = entries
      .filter((entry) => !entry.name.startsWith('.git') && entry.name !== '.zerous')
      .map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
      }));

    return nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return a.isDirectory ? -1 : 1;
    });
  } catch (err) {
    console.error('Failed to read directory:', dirPath, err);
    return [];
  }
});

// Ensure .zerous folder and project metadata initialization
ipcMain.handle('project-init-zerous', async (_event, projectPath: string) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) return { success: false, error: 'Invalid project path' };
    const zerousDir = path.join(projectPath, '.zerous');
    if (!fs.existsSync(zerousDir)) {
      await fs.promises.mkdir(zerousDir, { recursive: true });
    }

    // Subdirectories for structured storage
    const subDirs = ['discussions', 'data', 'history', 'agent-contexts'];
    for (const sub of subDirs) {
      const p = path.join(zerousDir, sub);
      if (!fs.existsSync(p)) {
        await fs.promises.mkdir(p, { recursive: true });
      }
    }

    return { success: true, zerousDir };
  } catch (err: any) {
    console.error('Failed to initialize .zerous directory:', err);
    return { success: false, error: err?.message || err };
  }
});

// Discussion history storage in .zerous/discussions
ipcMain.handle('discussion-load-history', async (_event, { projectPath, sessionId }: { projectPath: string; sessionId?: string }) => {
  try {
    const fileName = sessionId ? `history-${sessionId}.json` : 'discussion-history.json';
    const filePath = path.join(projectPath, '.zerous', 'discussions', fileName);
    if (!fs.existsSync(filePath)) {
      return { success: true, messages: [] };
    }
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const messages = JSON.parse(raw);
    return { success: true, messages: Array.isArray(messages) ? messages : [] };
  } catch (err: any) {
    console.error('Failed to load discussion history:', err);
    return { success: false, messages: [], error: err?.message || err };
  }
});

ipcMain.handle('discussion-save-history', async (_event, { projectPath, sessionId, messages }: { projectPath: string; sessionId?: string; messages: any[] }) => {
  try {
    const zerousDir = path.join(projectPath, '.zerous', 'discussions');
    if (!fs.existsSync(zerousDir)) {
      await fs.promises.mkdir(zerousDir, { recursive: true });
    }
    const fileName = sessionId ? `history-${sessionId}.json` : 'discussion-history.json';
    const filePath = path.join(zerousDir, fileName);
    await fs.promises.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to save discussion history:', err);
    return { success: false, error: err?.message || err };
  }
});

// Clear discussion history
ipcMain.handle('discussion-clear-history', async (_event, { projectPath, sessionId }: { projectPath: string; sessionId?: string }) => {
  try {
    const fileName = sessionId ? `history-${sessionId}.json` : 'discussion-history.json';
    const filePath = path.join(projectPath, '.zerous', 'discussions', fileName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to clear discussion history:', err);
    return { success: false, error: err?.message || err };
  }
});

// Agent-specific context storage in .zerous/agent-contexts/[agentId].json
ipcMain.handle('agent-context-load', async (_event, { projectPath, agentId }: { projectPath: string; agentId: string }) => {
  try {
    const filePath = path.join(projectPath, '.zerous', 'agent-contexts', `${agentId}.json`);
    if (!fs.existsSync(filePath)) {
      return { success: true, context: { messages: [], lastUpdated: 0 } };
    }
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { success: true, context: parsed };
  } catch (err: any) {
    console.error('Failed to load agent context:', err);
    return { success: false, context: { messages: [], lastUpdated: 0 }, error: err?.message || err };
  }
});

ipcMain.handle('agent-context-save', async (_event, { projectPath, agentId, context }: { projectPath: string; agentId: string; context: any }) => {
  try {
    const dirPath = path.join(projectPath, '.zerous', 'agent-contexts');
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, `${agentId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(context, null, 2), 'utf-8');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to save agent context:', err);
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('agent-context-clear', async (_event, { projectPath, agentId }: { projectPath: string; agentId: string }) => {
  try {
    const filePath = path.join(projectPath, '.zerous', 'agent-contexts', `${agentId}.json`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to clear agent context:', err);
    return { success: false, error: err?.message || err };
  }
});

// Read File Content
ipcMain.handle('fs-read-file', async (_event, filePath: string): Promise<string> => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (err: any) {
    console.error('Failed to read file:', filePath, err);
    return `Error reading file: ${err?.message || err}`;
  }
});

// Save File Content
ipcMain.handle('fs-write-file', async (_event, { filePath, content }: { filePath: string; content: string }): Promise<boolean> => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write file:', filePath, err);
    return false;
  }
});

// Create File or Folder
ipcMain.handle('fs-create-entry', async (_event, { targetPath, isDirectory }: { targetPath: string; isDirectory: boolean }) => {
  try {
    if (isDirectory) {
      await fs.promises.mkdir(targetPath, { recursive: true });
    } else {
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        await fs.promises.mkdir(parentDir, { recursive: true });
      }
      await fs.promises.writeFile(targetPath, '', 'utf-8');
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to create entry:', targetPath, err);
    return { success: false, error: err?.message || err };
  }
});

// Rename File or Folder
ipcMain.handle('fs-rename-entry', async (_event, { oldPath, newPath }: { oldPath: string; newPath: string }) => {
  try {
    await fs.promises.rename(oldPath, newPath);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to rename entry:', oldPath, newPath, err);
    return { success: false, error: err?.message || err };
  }
});

// Delete File or Folder (recursive)
ipcMain.handle('fs-delete-entry', async (_event, targetPath: string) => {
  try {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete entry:', targetPath, err);
    return { success: false, error: err?.message || err };
  }
});

// Duplicate File
ipcMain.handle('fs-duplicate-entry', async (_event, sourcePath: string) => {
  try {
    const dir = path.dirname(sourcePath);
    const ext = path.extname(sourcePath);
    const base = path.basename(sourcePath, ext);
    let newPath = path.join(dir, `${base} copy${ext}`);
    let counter = 1;
    while (fs.existsSync(newPath)) {
      counter++;
      newPath = path.join(dir, `${base} copy ${counter}${ext}`);
    }
    await fs.promises.copyFile(sourcePath, newPath);
    return { success: true, newPath };
  } catch (err: any) {
    console.error('Failed to duplicate entry:', sourcePath, err);
    return { success: false, error: err?.message || err };
  }
});

// Git helpers
ipcMain.handle('git-get-status', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: projectPath });
      const branch = branchOut.trim() || 'detached';
      const { stdout: statusOut } = await execAsync('git status --short', { cwd: projectPath });
      const isDirty = statusOut.trim().length > 0;
      return { isRepo: true, branch, isDirty };
    } catch {
      return { isRepo: false, branch: '', isDirty: false };
    }
  } catch (err) {
    return { isRepo: false, branch: '', isDirty: false };
  }
});

// Full Git status with files, ahead/behind, remote
ipcMain.handle('git-get-details', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // 1. Check if it's a git repo & get branch
    let branch = 'main';
    try {
      const { stdout: bOut } = await execAsync('git branch --show-current', { cwd: projectPath });
      branch = bOut.trim() || 'detached';
    } catch {
      return { isRepo: false, branch: '', isDirty: false, ahead: 0, behind: 0, files: [], stagedFiles: [], unstagedFiles: [], untrackedFiles: [] };
    }

    // 2. Remote URL
    let remoteUrl = '';
    try {
      const { stdout: rOut } = await execAsync('git remote get-url origin', { cwd: projectPath });
      remoteUrl = rOut.trim();
    } catch {}

    // 3. Ahead / Behind
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: countOut } = await execAsync(`git rev-list --left-right --count origin/${branch}...HEAD`, { cwd: projectPath });
      const parts = countOut.trim().split(/\s+/);
      if (parts.length >= 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    } catch {}

    // 4. File status (porcelain format)
    const { stdout: statusOut } = await execAsync('git status --porcelain=v1 -uall', { cwd: projectPath });
    const lines = statusOut.split('\n').filter(Boolean);

    const stagedFiles: any[] = [];
    const unstagedFiles: any[] = [];
    const untrackedFiles: any[] = [];
    const files: any[] = [];

    for (const line of lines) {
      if (line.length < 3) continue;
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.substring(3).trim();

      const item = {
        path: filePath,
        indexStatus,
        workTreeStatus,
        isStaged: false,
      };

      if (indexStatus === '?' && workTreeStatus === '?') {
        untrackedFiles.push(item);
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          stagedFiles.push({ ...item, isStaged: true });
        }
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
          unstagedFiles.push({ ...item, isStaged: false });
        }
      }
      files.push(item);
    }

    const isDirty = files.length > 0;
    return {
      isRepo: true,
      branch,
      isDirty,
      remoteUrl,
      ahead,
      behind,
      files,
      stagedFiles,
      unstagedFiles,
      untrackedFiles,
    };
  } catch (err: any) {
    console.error('git-get-details failed:', err);
    return { isRepo: false, branch: '', isDirty: false, ahead: 0, behind: 0, files: [], stagedFiles: [], unstagedFiles: [], untrackedFiles: [] };
  }
});

ipcMain.handle('git-stage-file', async (_event, { projectPath, filePath }: { projectPath: string; filePath: string }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync(`git add "${filePath.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-unstage-file', async (_event, { projectPath, filePath }: { projectPath: string; filePath: string }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync(`git restore --staged "${filePath.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-stage-all', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync('git add -A', { cwd: projectPath });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-unstage-all', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync('git restore --staged .', { cwd: projectPath });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-discard-file', async (_event, { projectPath, filePath }: { projectPath: string; filePath: string }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    // If untracked, remove file; if tracked, restore
    try {
      await execAsync(`git restore "${filePath.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    } catch {
      await execAsync(`git clean -f "${filePath.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-commit', async (_event, { projectPath, message }: { projectPath: string; message: string }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true, output: stdout.trim() };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-get-diff', async (_event, { projectPath, filePath, staged }: { projectPath: string; filePath: string; staged?: boolean }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const flag = staged ? '--staged' : '';
    const { stdout } = await execAsync(`git diff ${flag} -- "${filePath.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true, diff: stdout };
  } catch (err: any) {
    return { success: false, error: err?.message || err, diff: '' };
  }
});

ipcMain.handle('git-get-branches', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync('git branch -a', { cwd: projectPath });
    const branches = stdout
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => (b.startsWith('*') ? b.substring(1).trim() : b));
    return { success: true, branches };
  } catch (err: any) {
    return { success: false, error: err?.message || err, branches: [] };
  }
});

ipcMain.handle('git-checkout-branch', async (_event, { projectPath, branch }: { projectPath: string; branch: string }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync(`git checkout "${branch.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-create-branch', async (_event, { projectPath, branch }: { projectPath: string; branch: string }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    await execAsync(`git checkout -b "${branch.replace(/"/g, '\\"')}"`, { cwd: projectPath });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-pull', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync('git pull', { cwd: projectPath });
    return { success: true, output: stdout.trim() };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-push', async (_event, projectPath: string) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const { stdout } = await execAsync('git push', { cwd: projectPath });
    return { success: true, output: stdout.trim() };
  } catch (err: any) {
    return { success: false, error: err?.message || err };
  }
});

ipcMain.handle('git-get-log', async (_event, { projectPath, limit = 20 }: { projectPath: string; limit?: number }) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const format = '%H%x00%h%x00%an%x00%ad%x00%ar%x00%s';
    const { stdout } = await execAsync(`git log -n ${limit} --pretty=format:"${format}"`, { cwd: projectPath });
    const commits = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, date, relativeTime, message] = line.split('\0');
        return { hash, shortHash, author, date, relativeTime, message };
      });
    return { success: true, commits };
  } catch (err: any) {
    return { success: false, error: err?.message || err, commits: [] };
  }
});

// ================= AI CLI Wrapper (Project CWD Scope) =================
interface AISession {
  conversationId?: string;
  activeProcess?: any;
}

const aiSessions = new Map<string, AISession>();

// Query available contexts (conversations) for a workspace/project
export interface WorkspaceContextItem {
  conversationId: string;
  title: string;
  preview: string;
  lastModified?: string;
}

ipcMain.handle('ai-get-workspace-contexts', async (_event, payload: any): Promise<WorkspaceContextItem[]> => {
  try {
    const workspacePath = typeof payload === 'string' ? payload : payload?.workspacePath || '';
    const customHome = typeof payload === 'object' ? payload?.customHome : undefined;
    const effectiveHome = customHome && fs.existsSync(customHome) ? customHome : os.homedir();

    const normWs = path.normalize(workspacePath).toLowerCase();
    const folderName = path.basename(normWs);
    const results: WorkspaceContextItem[] = [];
    const seen = new Set<string>();

    const brainDir = path.join(effectiveHome, '.gemini/antigravity-cli/brain');
    if (fs.existsSync(brainDir)) {
      const entries = await fs.promises.readdir(brainDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const cid = entry.name;
        const transPath = path.join(brainDir, cid, '.system_generated', 'logs', 'transcript.jsonl');
        if (!fs.existsSync(transPath)) continue;

        try {
          const content = await fs.promises.readFile(transPath, 'utf-8');
          const lines = content.split('\n');
          let matched = false;
          let firstPrompt = '';

          for (const line of lines) {
            if (!line.trim()) continue;
            if (!firstPrompt && line.includes('"type":"USER_INPUT"')) {
              try {
                const parsed = JSON.parse(line);
                let text = parsed.content || '';
                text = text.replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim();
                firstPrompt = text.split('\n')[0].trim();
              } catch {}
            }

            const lower = line.toLowerCase();
            if (lower.includes(normWs) || lower.includes('/' + folderName)) {
              matched = true;
              if (firstPrompt) break;
            }
          }

          if (matched && !seen.has(cid)) {
            const stat = await fs.promises.stat(transPath);
            results.push({
              conversationId: cid,
              title: firstPrompt ? firstPrompt.slice(0, 80) : `Phiên ${cid.slice(0, 8)}`,
              preview: firstPrompt,
              lastModified: stat.mtime.toISOString(),
            });
            seen.add(cid);
          }
        } catch {}
      }
    }

    results.sort((a, b) => {
      const tA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const tB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return tB - tA;
    });

    return results;
  } catch (err) {
    console.error('Failed to get workspace contexts:', err);
    return [];
  }
});

// Set session's conversation ID to resume & load previous conversation messages
export interface ConversationHistoryMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

ipcMain.handle('ai-resume-conversation', async (_event, { sessionId, conversationId, customHome }: { sessionId: string; conversationId: string; customHome?: string }) => {
  let session = aiSessions.get(sessionId);
  if (!session) {
    session = {};
    aiSessions.set(sessionId, session);
  }
  session.conversationId = conversationId;

  const effectiveHome = customHome && fs.existsSync(customHome) ? customHome : os.homedir();

  // Đọc toàn bộ nội dung từ transcript.jsonl nếu tồn tại
  const messages: ConversationHistoryMessage[] = [];
  const transPath = path.join(
    effectiveHome,
    '.gemini/antigravity-cli/brain',
    conversationId,
    '.system_generated',
    'logs',
    'transcript.jsonl'
  );

  if (fs.existsSync(transPath)) {
    try {
      const content = await fs.promises.readFile(transPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const item = JSON.parse(line);
          const type = item.type;
          const text = item.content || '';
          const stepIndex = item.step_index ?? i;
          const ts = item.created_at ? new Date(item.created_at).getTime() : Date.now();

          if (type === 'USER_INPUT') {
            // Loại bỏ các tag nội bộ của hệ thống
            let userPrompt = text;
            const match = userPrompt.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
            if (match) {
              userPrompt = match[1].trim();
            } else {
              userPrompt = userPrompt.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '');
              userPrompt = userPrompt.replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/g, '');
              userPrompt = userPrompt.trim();
            }

            if (userPrompt) {
              messages.push({
                id: `hist-user-${stepIndex}`,
                sender: 'user',
                text: userPrompt,
                timestamp: ts,
              });
            }
          } else if (type === 'PLANNER_RESPONSE') {
            if (text && text.trim()) {
              messages.push({
                id: `hist-bot-${stepIndex}`,
                sender: 'assistant',
                text: text.trim(),
                timestamp: ts,
              });
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load conversation history:', e);
    }
  }

  return { success: true, conversationId, messages };
});

ipcMain.handle(
  'ai-send-prompt',
  async (
    event,
    {
      sessionId,
      command,
      prompt,
      cwd,
      defaultArgs,
      model,
      effort,
      mode,
      customHome,
      customEnv,
    }: {
      sessionId: string;
      command: string;
      prompt: string;
      cwd: string;
      defaultArgs?: string;
      model?: string;
      effort?: string;
      mode?: string;
      customHome?: string;
      customEnv?: Record<string, string>;
    }
  ) => {
    let session = aiSessions.get(sessionId);
    if (!session) {
      session = {};
      aiSessions.set(sessionId, session);
    }

    // Đảm bảo tuyệt đối thực thi trực tiếp tại thư mục của project
    const workingDir = cwd && fs.existsSync(cwd) ? cwd : process.cwd();

    // Chuẩn bị arguments theo loại CLI
    let args: string[] = [];

    if (command === 'agy') {
      args = [
        `-p=${prompt}`,
        '--output-format=stream-json',
        '--dangerously-skip-permissions',
      ];
      if (model) {
        args.push(`--model=${model}`);
      }
      if (effort) {
        args.push(`--effort=${effort}`);
      }
      if (mode && mode !== 'default') {
        args.push(`--mode=${mode}`);
      }
      if (defaultArgs) {
        args.push(...defaultArgs.split(/\s+/).filter(Boolean));
      }
      if (session.conversationId) {
        args.push(`--conversation=${session.conversationId}`);
      }
    } else {
      // Hỗ trợ các CLI khác như claude, aider...
      if (defaultArgs) {
        args.push(...defaultArgs.split(/\s+/).filter(Boolean));
      }
      args.push(prompt);
    }

    // Determine custom isolated HOME directory
    let effectiveHome = os.homedir();
    if (customHome && customHome.trim()) {
      let resolvedHome = customHome.trim();
      if (resolvedHome.startsWith('~/')) {
        resolvedHome = path.join(os.homedir(), resolvedHome.slice(2));
      }
      try {
        if (!fs.existsSync(resolvedHome)) {
          fs.mkdirSync(resolvedHome, { recursive: true });
        }
        effectiveHome = resolvedHome;
      } catch (e) {
        console.error('Failed to create custom home dir:', resolvedHome, e);
      }
    }

    console.log(`[AI CLI] Spawning "${command}" inside folder: ${workingDir} with HOME: ${effectiveHome}`);

    const spawnEnv: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: effectiveHome,
      USERPROFILE: effectiveHome,
      PATH: `${path.join(effectiveHome, '.local/bin')}:${path.join(os.homedir(), '.local/bin')}:${process.env.PATH}`,
      ...(customEnv || {}),
    };

    const child = spawn(command, args, {
      cwd: workingDir, // BẮT BUỘC nằm trong folder của project được chọn
      env: spawnEnv,
    });

    session.activeProcess = child;

    const rl = readline.createInterface({
      input: child.stdout,
      terminal: false,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Gửi raw stream log thời gian thực về terminal của agent
      event.sender.send(`ai-raw-log-${sessionId}`, line + '\n');

      try {
        const parsed = JSON.parse(trimmed);

        if (parsed.event === 'init' && parsed.conversation_id) {
          session!.conversationId = parsed.conversation_id;
        }

        if (parsed.event === 'step_update' && parsed.step_update) {
          const update = parsed.step_update;
          if (update.text_delta) {
            event.sender.send(`ai-delta-${sessionId}`, update.text_delta);
          }
        }

        if (parsed.event === 'result') {
          event.sender.send(`ai-result-${sessionId}`, parsed.result);
        }
      } catch (e) {
        // Raw text stream từ CLI thường
        event.sender.send(`ai-delta-${sessionId}`, line + '\n');
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      console.error(`[AI stderr (${command})]:`, str);
      event.sender.send(`ai-raw-log-${sessionId}`, str);
    });

    child.on('close', (code) => {
      session!.activeProcess = null;
      event.sender.send(`ai-done-${sessionId}`, { code });
    });

    child.on('error', (err) => {
      session!.activeProcess = null;
      event.sender.send(`ai-error-${sessionId}`, { error: err.message });
    });

    return true;
  }
);

ipcMain.on('ai-abort', (_event, sessionId: string) => {
  const session = aiSessions.get(sessionId);
  if (session?.activeProcess) {
    session.activeProcess.kill('SIGINT');
    session.activeProcess = null;
  }
});

// ================= Terminal PTY Management =================
interface PtySession {
  process: pty.IPty;
}

const ptySessions = new Map<string, PtySession>();

ipcMain.handle(
  'terminal-create',
  (event, { sessionId, cwd }: { sessionId: string; cwd?: string }) => {
    try {
      const existing = ptySessions.get(sessionId);
      if (existing) {
        existing.process.kill();
        ptySessions.delete(sessionId);
      }

      const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
      const workingDir = cwd && fs.existsSync(cwd) ? cwd : (os.homedir() || process.cwd());

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: workingDir,
        env: process.env as Record<string, string>,
      });

      ptyProcess.onData((data: string) => {
        event.sender.send(`terminal-data-${sessionId}`, data);
      });

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        ptySessions.delete(sessionId);
        event.sender.send(`terminal-exit-${sessionId}`, { exitCode });
      });

      ptySessions.set(sessionId, { process: ptyProcess });
      return true;
    } catch (err) {
      console.error('Failed to create terminal pty:', err);
      return false;
    }
  }
);

ipcMain.on(
  'terminal-write',
  (_event, { sessionId, data }: { sessionId: string; data: string }) => {
    const session = ptySessions.get(sessionId);
    if (session) {
      session.process.write(data);
    }
  }
);

ipcMain.on(
  'terminal-resize',
  (_event, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    const session = ptySessions.get(sessionId);
    if (session && cols > 0 && rows > 0) {
      session.process.resize(cols, rows);
    }
  }
);

ipcMain.on('terminal-kill', (_event, sessionId: string) => {
  const session = ptySessions.get(sessionId);
  if (session) {
    session.process.kill();
    ptySessions.delete(sessionId);
  }
});

// Multi-Agent LangGraph Orchestrator Execution
ipcMain.handle(
  'orchestrator-run-workflow',
  async (
    event,
    {
      sessionId,
      userPrompt,
      projectPath,
      supervisorConfig,
      roles,
      installedAIs,
    }: {
      sessionId: string;
      userPrompt: string;
      projectPath: string;
      supervisorConfig: any;
      roles: any[];
      installedAIs: any[];
    }
  ) => {
    try {
      const { buildMultiAgentGraph } = await import('./orchestrator');

      const appGraph = buildMultiAgentGraph((wfEvent) => {
        event.sender.send(`orchestrator-event-${sessionId}`, wfEvent);
      });

      const finalState = await appGraph.invoke({
        userPrompt,
        projectPath,
        supervisorConfig,
        roles,
        installedAIs,
      });

      return { success: true, finalState };
    } catch (err: any) {
      console.error('[Orchestrator error]:', err);
      event.sender.send(`orchestrator-event-${sessionId}`, {
        type: 'agent_pushback',
        content: `Orchestrator execution error: ${err?.message || err}`,
      });
      return { success: false, error: err?.message || err };
    }
  }
);

app.on('window-all-closed', () => {
  for (const session of ptySessions.values()) {
    try {
      session.process.kill();
    } catch {}
  }
  ptySessions.clear();
  for (const session of aiSessions.values()) {
    if (session.activeProcess) {
      session.activeProcess.kill('SIGINT');
    }
  }
  aiSessions.clear();

  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
