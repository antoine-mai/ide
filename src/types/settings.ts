export interface AppSettings {
  // General & Window
  confirmOnClose: boolean;
  autoSaveFiles: boolean;
  autoSaveDelayMs: number;

  // Editor (Monaco)
  editorFontSize: number;
  editorFontFamily: string;
  editorFontWeight: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700';
  editorLineHeight: number;
  editorTabSize: number;
  editorMinimap: boolean;
  editorWordWrap: 'on' | 'off' | 'wordWrapColumn';
  editorLineNumbers: 'on' | 'off' | 'relative';
  editorBracketPairColorization: boolean;

  // Terminal
  terminalFontSize: number;
  terminalFontFamily: string;
  terminalLineHeight: number;
  terminalCursorBlink: boolean;

  // AI & Workflow
  soundEffects: boolean;
  defaultExecutionMode: 'default' | 'auto' | 'plan';
  autoReviewMode: 'auto_review' | 'manual_review' | 'disabled';
}

export const PRESET_FONTS = [
  { id: 'monaco', name: 'Monaco', value: "Monaco, Menlo, 'Courier New', monospace" },
  { id: 'jetbrains', name: 'JetBrains Mono', value: "'JetBrains Mono', Monaco, Consolas, monospace" },
  { id: 'fira', name: 'Fira Code', value: "'Fira Code', Monaco, Consolas, monospace" },
  { id: 'consolas', name: 'Consolas', value: "Consolas, Monaco, 'Courier New', monospace" },
  { id: 'cascadia', name: 'Cascadia Code', value: "'Cascadia Code', Monaco, Consolas, monospace" },
  { id: 'source_code', name: 'Source Code Pro', value: "'Source Code Pro', Monaco, Consolas, monospace" },
  { id: 'system_mono', name: 'System Monospace', value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  confirmOnClose: false,
  autoSaveFiles: true,
  autoSaveDelayMs: 1000,

  editorFontSize: 13,
  editorFontFamily: "Monaco, Menlo, 'JetBrains Mono', Consolas, 'Courier New', monospace",
  editorFontWeight: 'normal',
  editorLineHeight: 20,
  editorTabSize: 2,
  editorMinimap: true,
  editorWordWrap: 'off',
  editorLineNumbers: 'on',
  editorBracketPairColorization: true,

  terminalFontSize: 13,
  terminalFontFamily: "Monaco, Menlo, 'JetBrains Mono', Consolas, monospace",
  terminalLineHeight: 1.2,
  terminalCursorBlink: true,

  soundEffects: false,
  defaultExecutionMode: 'default',
  autoReviewMode: 'auto_review',
};
