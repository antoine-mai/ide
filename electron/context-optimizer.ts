import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.zerous',
  'dist',
  'dist-electron',
  'release',
  'build',
  '.cache',
  '.vscode',
  'coverage',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.py',
  '.rs',
  '.go',
  '.php',
  '.sql',
  '.sh',
]);

/**
 * Extracts class, interface, function, and exported type signatures
 * from code text without function bodies, saving up to 80-90% tokens.
 */
export function extractFileSkeleton(filePath: string, content: string): string {
  const ext = path.extname(filePath);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return '';
  }

  // If JSON file, keep top-level keys only
  if (ext === '.json') {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed).slice(0, 15);
        return `// Top keys: ${keys.join(', ')}`;
      }
    } catch {
      return '';
    }
  }

  const lines = content.split('\n');
  const skeletonLines: string[] = [];

  // Match exports, interfaces, classes, functions, types
  const signatureRegex =
    /^(export\s+(default\s+)?(async\s+)?function\s+[\w$]+|export\s+(const|let|var)\s+[\w$]+(\s*:\s*[^=]+)?|export\s+(class|interface|type|enum)\s+[\w$]+|class\s+[\w$]+|interface\s+[\w$]+|type\s+[\w$]+\s*=|(public|private|protected|async)\s+[\w$]+\s*\(|def\s+[\w_]+|fn\s+[\w_]+|func\s+[\w_]+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Match signature headers
    if (signatureRegex.test(trimmed)) {
      // Capture signature line and close with {} or ;
      let sig = trimmed;
      if (sig.endsWith('{')) {
        sig = sig.slice(0, -1).trim() + ' { ... }';
      }
      skeletonLines.push(`  ${sig}`);
    }
  }

  if (skeletonLines.length === 0) {
    return '';
  }

  return skeletonLines.slice(0, 25).join('\n');
}

/**
 * Generates a lightweight Repository Map (Architecture Outline)
 * specifically designed for the Supervisor Leader.
 * Max token footprint: ~500 to 1,500 tokens.
 */
export async function generateRepoMap(
  projectPath: string,
  maxFiles = 40
): Promise<string> {
  if (!projectPath || !fs.existsSync(projectPath)) {
    return 'Project path does not exist';
  }

  const fileEntries: { relPath: string; fullPath: string }[] = [];

  async function walk(currentDir: string, depth = 0) {
    if (depth > 5 || fileEntries.length >= maxFiles) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          const rel = path.relative(projectPath, full);
          fileEntries.push({ relPath: rel, fullPath: full });
          if (fileEntries.length >= maxFiles) return;
        }
      }
    }
  }

  await walk(projectPath);

  const mapOutput: string[] = [];
  mapOutput.push(`# Repository Architecture Map (${fileEntries.length} files scanned)`);

  for (const file of fileEntries) {
    try {
      const content = await fs.promises.readFile(file.fullPath, 'utf-8');
      const skeleton = extractFileSkeleton(file.relPath, content);
      if (skeleton) {
        mapOutput.push(`\n📄 ${file.relPath}:\n${skeleton}`);
      } else {
        mapOutput.push(`📄 ${file.relPath}`);
      }
    } catch {
      mapOutput.push(`📄 ${file.relPath}`);
    }
  }

  return mapOutput.join('\n');
}

/**
 * Filter and compress raw Member outputs before forwarding to Leader.
 * Prevents Leader context bloat by extracting deliverables, status & summaries only.
 */
export function compressMemberOutputForLeader(
  memberName: string,
  taskTitle: string,
  rawOutput: string,
  maxChars = 600
): string {
  if (!rawOutput) {
    return `[${memberName}] Completed task "${taskTitle}".`;
  }

  const trimmed = rawOutput.trim();

  // If already concise, return directly
  if (trimmed.length <= maxChars) {
    return `[${memberName} - ${taskTitle}]:\n${trimmed}`;
  }

  // Extract key summary lines (first 3 lines + deliverables/summary section + tail)
  const lines = trimmed.split('\n');
  const summaryLines: string[] = [];

  let foundSummarySection = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      lower.includes('summary') ||
      lower.includes('completed') ||
      lower.includes('deliverable') ||
      lower.includes('result') ||
      lower.includes('created') ||
      lower.includes('modified')
    ) {
      foundSummarySection = true;
    }
    if (foundSummarySection && line.trim()) {
      summaryLines.push(line);
      if (summaryLines.length >= 8) break;
    }
  }

  if (summaryLines.length > 0) {
    return `[${memberName} - ${taskTitle} (Summary)]:\n${summaryLines.join('\n')}`;
  }

  // Fallback head and tail truncation
  const head = lines.slice(0, 4).join('\n');
  const tail = lines.slice(-4).join('\n');
  return `[${memberName} - ${taskTitle} (Compressed Output)]:\n${head}\n... [trimmed ${trimmed.length - maxChars} chars] ...\n${tail}`;
}
