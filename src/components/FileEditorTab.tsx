import React, { useState, useEffect, useRef } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import {
  Save,
  FileCode,
  RotateCw,
} from 'lucide-react';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../types/settings';

// Configure Monaco to use locally bundled monaco-editor instead of external CDN
loader.config({ monaco });

interface FileEditorTabProps {
  filePath: string;
  settings?: AppSettings;
}

// Map file extensions to Monaco language identifiers
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'less':
      return 'less';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    case 'php':
      return 'php';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'cpp';
    case 'java':
      return 'java';
    case 'ini':
    case 'env':
      return 'ini';
    case 'dockerfile':
      return 'dockerfile';
    default:
      if (path.endsWith('Dockerfile')) return 'dockerfile';
      if (path.endsWith('.gitignore') || path.endsWith('.env')) return 'ini';
      return 'plaintext';
  }
}

export const FileEditorTab: React.FC<FileEditorTabProps> = ({ filePath, settings }) => {
  const currentSettings = settings || DEFAULT_APP_SETTINGS;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copiedNotice, setCopiedNotice] = useState(false);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const language = getLanguageFromPath(filePath);
  const fileName = filePath.split('/').filter(Boolean).pop() || filePath;

  // Load file content
  const loadFile = () => {
    let mounted = true;
    setLoading(true);

    window.electronAPI?.readFile(filePath).then((text) => {
      if (mounted) {
        setContent(text ?? '');
        setLoading(false);
        setIsDirty(false);
      }
    });

    return () => {
      mounted = false;
    };
  };

  useEffect(() => {
    loadFile();
  }, [filePath]);

  // Handle Save
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const valueToSave = editorRef.current ? editorRef.current.getValue() : content;
    const success = await window.electronAPI?.writeFile(filePath, valueToSave);
    if (success) {
      setIsDirty(false);
    }
    setSaving(false);
  };

  // Editor Mount handler
  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Define custom VS Code dark theme matching IDE palette
    monacoInstance.editor.defineTheme('ide-dark-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
        { token: 'string', foreground: 'a7f3d0' },
        { token: 'number', foreground: 'fcd34d' },
        { token: 'type', foreground: '60a5fa' },
        { token: 'function', foreground: '93c5fd' },
        { token: 'variable', foreground: 'f1f5f9' },
      ],
      colors: {
        'editor.background': '#121316',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#161922',
        'editorCursor.foreground': '#60a5fa',
        'editorWhitespace.foreground': '#2a2e3d',
        'editorIndentGuide.background': '#1e2230',
        'editorIndentGuide.activeBackground': '#3b82f6',
        'editorLineNumber.foreground': '#4b5563',
        'editorLineNumber.activeForeground': '#93c5fd',
        'editorGutter.background': '#121316',
        'editorSuggestWidget.background': '#16181f',
        'editorSuggestWidget.border': '#282c3c',
        'editorSuggestWidget.selectedBackground': '#263048',
      },
    });

    monacoInstance.editor.setTheme('ide-dark-theme');

    // Register Ctrl+S / Cmd+S save command directly in Monaco
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      handleSave();
    });

    // Track Cursor Position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    editor.focus();
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 1500);
  };

  if (loading) {
    return (
      <div className="file-editor-loading">
        <div className="live-spin-dot" />
        <span>Loading {fileName}...</span>
      </div>
    );
  }

  return (
    <div className="file-editor-container">
      {/* Editor Sub-Header Toolbar */}
      <div className="file-editor-toolbar">
        <div className="file-editor-toolbar-left">
          <FileCode size={14} color="#60a5fa" />
          <span className="file-editor-name">{fileName}</span>
          <span className="file-editor-fullpath" title={filePath} onClick={handleCopyPath}>
            {filePath}
          </span>
          {copiedNotice && <span className="file-editor-copied-tag">Copied!</span>}
          {isDirty && (
            <span className="file-editor-dirty-badge" title="Unsaved changes">
              ● Unsaved
            </span>
          )}
        </div>

        <div className="file-editor-toolbar-right">
          <span className="file-editor-meta-item">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="file-editor-meta-item language-tag">
            {language.toUpperCase()}
          </span>

          <button
            type="button"
            className="file-editor-btn reload"
            onClick={loadFile}
            title="Reload from disk"
          >
            <RotateCw size={12} />
          </button>

          <button
            type="button"
            className={`file-editor-btn save ${isDirty ? 'dirty' : ''}`}
            onClick={handleSave}
            disabled={saving}
            title="Save file (Ctrl+S)"
          >
            {saving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Save size={12} />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Code Editor */}
      <div className="file-editor-monaco-wrapper">
        <Editor
          height="100%"
          path={filePath}
          language={language}
          value={content}
          theme="vs-dark"
          onChange={(val) => {
            setContent(val ?? '');
            setIsDirty(true);
          }}
          onMount={handleEditorDidMount}
          options={{
            fontFamily: currentSettings.editorFontFamily,
            fontSize: currentSettings.editorFontSize,
            lineHeight: currentSettings.editorLineHeight || 20,
            fontWeight: currentSettings.editorFontWeight || 'normal',
            minimap: {
              enabled: currentSettings.editorMinimap,
              maxColumn: 80,
              renderCharacters: false,
            },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: currentSettings.editorTabSize || 2,
            insertSpaces: true,
            lineNumbers: currentSettings.editorLineNumbers || 'on',
            wordWrap: currentSettings.editorWordWrap || 'off',
            renderWhitespace: 'selection',
            folding: true,
            bracketPairColorization: {
              enabled: currentSettings.editorBracketPairColorization,
            },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'all',
          }}
        />
      </div>
    </div>
  );
};
