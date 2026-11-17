export interface AppSettings {
  // General & Window
  confirmOnClose: boolean;
  autoSaveFiles: boolean;
  autoSaveDelayMs: number;

  // Editor (Monaco)
  editorFontSize: number;
  editorFontFamily: string;
  editorTabSize: number;
  editorMinimap: boolean;
  editorWordWrap: 'on' | 'off' | 'wordWrapColumn';
  editorLineNumbers: 'on' | 'off' | 'relative';
  editorBracketPairColorization: boolean;

  // Terminal
  terminalFontSize: number;
  terminalFontFamily: string;
  terminalCursorBlink: boolean;

  // AI & Workflow
  soundEffects: boolean;
  defaultExecutionMode: 'default' | 'auto' | 'plan';
  autoReviewMode: 'auto_review' | 'manual_review' | 'disabled';
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  confirmOnClose: false,
  autoSaveFiles: true,
  autoSaveDelayMs: 1000,

  editorFontSize: 13,
  editorFontFamily: "'JetBrains Mono', Consolas, Monaco, 'Courier New', monospace",
  editorTabSize: 2,
  editorMinimap: true,
  editorWordWrap: 'off',
  editorLineNumbers: 'on',
  editorBracketPairColorization: true,

  terminalFontSize: 13,
  terminalFontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
  terminalCursorBlink: true,

  soundEffects: false,
  defaultExecutionMode: 'default',
  autoReviewMode: 'auto_review',
};
