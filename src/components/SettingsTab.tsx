import React, { useState } from 'react';
import {
  Settings,
  Search,
  Code,
  Terminal as TerminalIcon,
  Bot,
  Sliders,
  RotateCcw,
  X,
  Plus,
  Trash2,
  Terminal,
  Folder,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AppSettings } from '../types/settings';
import { InstalledAI } from './ManageAgentsModal';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  installedAIs: InstalledAI[];
  onAddAgent: (agent: InstalledAI) => void;
  onDeleteAgent: (id: string) => void;
  initialSection?: SettingsSection;
}

type SettingsSection = 'commonly_used' | 'agents' | 'editor' | 'terminal' | 'ai_orchestrator';

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  installedAIs,
  onAddAgent,
  onDeleteAgent,
  initialSection = 'commonly_used',
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [searchQuery, setSearchQuery] = useState('');

  // Add agent form inside settings
  const [showAddAgentForm, setShowAddAgentForm] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [defaultArgs, setDefaultArgs] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customHome, setCustomHome] = useState('');
  const [envPairs, setEnvPairs] = useState<{ key: string; value: string }[]>([]);

  const handleAutoGenerateHome = () => {
    const slug = (name || command || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-');
    setCustomHome(`~/.agents-profiles/${slug}-${Date.now().toString().slice(-4)}`);
  };

  const handleAddEnvPair = () => {
    setEnvPairs([...envPairs, { key: '', value: '' }]);
  };

  const handleRemoveEnvPair = (index: number) => {
    setEnvPairs(envPairs.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...envPairs];
    updated[index][field] = val;
    setEnvPairs(updated);
  };

  const handleSubmitAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const envMap: Record<string, string> = {};
    for (const pair of envPairs) {
      if (pair.key.trim()) {
        envMap[pair.key.trim()] = pair.value;
      }
    }

    onAddAgent({
      id: `${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name: name.trim(),
      command: command.trim(),
      defaultArgs: defaultArgs.trim() || undefined,
      customHome: customHome.trim() || undefined,
      customEnv: Object.keys(envMap).length > 0 ? envMap : undefined,
    });

    setName('');
    setCommand('');
    setDefaultArgs('');
    setCustomHome('');
    setEnvPairs([]);
    setShowAdvanced(false);
    setShowAddAgentForm(false);
  };

  const filterMatches = (key: string, label: string, desc?: string) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      key.toLowerCase().includes(q) ||
      label.toLowerCase().includes(q) ||
      (desc && desc.toLowerCase().includes(q))
    );
  };

  return (
    <div className="settings-page-container">
      {/* Settings Header with VS Code style search bar */}
      <div className="settings-top-header">
        <div className="settings-header-title-wrap">
          <Settings size={18} color="#60a5fa" />
          <span className="settings-header-title">Settings</span>
        </div>

        <div className="settings-search-wrapper">
          <Search size={14} className="settings-search-icon" />
          <input
            type="text"
            className="settings-search-input"
            placeholder="Search settings (e.g. agents, font size, minimap)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="settings-search-clear" onClick={() => setSearchQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>

        <button
          className="settings-reset-all-btn"
          title="Reset all settings to default"
          onClick={() => {
            if (window.confirm('Reset all settings to default values?')) {
              onResetSettings();
            }
          }}
        >
          <RotateCcw size={12} />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Main Layout: Left Sidebar + Right Content */}
      <div className="settings-body-layout">
        {/* Left Section Navigation */}
        <aside className="settings-sidebar">
          <button
            className={`settings-nav-item ${activeSection === 'commonly_used' ? 'active' : ''}`}
            onClick={() => setActiveSection('commonly_used')}
          >
            <Sliders size={14} />
            <span>Commonly Used</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveSection('agents')}
          >
            <Bot size={14} />
            <span>Installed Agents ({installedAIs.length})</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveSection('editor')}
          >
            <Code size={14} />
            <span>Text Editor</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveSection('terminal')}
          >
            <TerminalIcon size={14} />
            <span>Terminal</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'ai_orchestrator' ? 'active' : ''}`}
            onClick={() => setActiveSection('ai_orchestrator')}
          >
            <Sparkles size={14} />
            <span>AI Orchestrator</span>
          </button>
        </aside>

        {/* Right Settings Options Pane */}
        <div className="settings-content-pane">
          {/* SECTION: INSTALLED AGENTS */}
          {(activeSection === 'agents' || searchQuery.toLowerCase().includes('agent')) && (
            <div className="settings-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #232630', paddingBottom: 8 }}>
                <div className="settings-group-header" style={{ border: 'none', padding: 0 }}>
                  Installed AI Agents ({installedAIs.length})
                </div>
                <button
                  type="button"
                  className="role-add-btn"
                  onClick={() => setShowAddAgentForm(!showAddAgentForm)}
                >
                  {showAddAgentForm ? <X size={12} /> : <Plus size={12} />}
                  <span>{showAddAgentForm ? 'Cancel' : 'Install New Agent'}</span>
                </button>
              </div>

              {/* Form to Add New Agent */}
              {showAddAgentForm && (
                <form className="settings-agent-form" onSubmit={handleSubmitAgent}>
                  <div className="settings-agent-form-title">Register CLI Agent</div>
                  <div className="role-form-grid">
                    <div className="role-form-group">
                      <label className="role-form-label">Display Name *</label>
                      <input
                        type="text"
                        className="role-form-input"
                        placeholder="e.g. Claude CLI, Aider, OpenBot"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="role-form-group">
                      <label className="role-form-label">CLI Executable *</label>
                      <input
                        type="text"
                        className="role-form-input"
                        placeholder="e.g. claude, agy, aider"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        required
                      />
                    </div>
                    <div className="role-form-group full-width">
                      <label className="role-form-label">Default Arguments</label>
                      <input
                        type="text"
                        className="role-form-input"
                        placeholder="e.g. --dangerously-skip-permissions"
                        value={defaultArgs}
                        onChange={(e) => setDefaultArgs(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Advanced Isolation Settings */}
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="settings-advanced-toggle"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                      {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>Advanced Sandbox &amp; Environment Isolation</span>
                    </button>

                    {showAdvanced && (
                      <div className="settings-advanced-pane">
                        <div className="role-form-group">
                          <label className="role-form-label">Isolated HOME Directory</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              className="role-form-input"
                              placeholder="~/.agents-profiles/custom-agent"
                              value={customHome}
                              onChange={(e) => setCustomHome(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              className="role-add-btn"
                              onClick={handleAutoGenerateHome}
                              title="Auto generate dedicated directory"
                            >
                              Auto
                            </button>
                          </div>
                        </div>

                        <div className="role-form-group" style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label className="role-form-label">Custom Environment Variables</label>
                            <button
                              type="button"
                              className="role-add-btn"
                              onClick={handleAddEnvPair}
                            >
                              <Plus size={11} /> Add Variable
                            </button>
                          </div>
                          {envPairs.map((pair, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <input
                                type="text"
                                className="role-form-input"
                                placeholder="KEY (e.g. API_KEY)"
                                value={pair.key}
                                onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                                style={{ flex: 1 }}
                              />
                              <input
                                type="text"
                                className="role-form-input"
                                placeholder="VALUE"
                                value={pair.value}
                                onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                                style={{ flex: 1 }}
                              />
                              <button
                                type="button"
                                className="role-item-delete"
                                onClick={() => handleRemoveEnvPair(idx)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="role-cancel-btn"
                      onClick={() => setShowAddAgentForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="role-save-btn"
                      disabled={!name.trim() || !command.trim()}
                    >
                      Save Agent
                    </button>
                  </div>
                </form>
              )}

              {/* List of Installed Agents */}
              <div className="settings-agents-list">
                {installedAIs.map((ai) => (
                  <div key={ai.id} className="settings-agent-card">
                    <div className="settings-agent-card-left">
                      <div className="settings-agent-icon">
                        <Bot size={16} color="#60a5fa" />
                      </div>
                      <div className="settings-agent-info">
                        <div className="settings-agent-name-row">
                          <span className="settings-agent-name">{ai.name}</span>
                          {ai.customHome && (
                            <span className="settings-agent-isolated-tag">Isolated HOME</span>
                          )}
                        </div>
                        <div className="settings-agent-cmd">
                          <Terminal size={11} />
                          <code>{ai.command} {ai.defaultArgs || ''}</code>
                        </div>
                        {ai.customHome && (
                          <div className="settings-agent-subtext">
                            <Folder size={11} />
                            <span>{ai.customHome}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {installedAIs.length > 1 && (
                      <button
                        type="button"
                        className="role-item-delete"
                        title={`Delete ${ai.name}`}
                        onClick={() => {
                          if (window.confirm(`Delete agent "${ai.name}"?`)) {
                            onDeleteAgent(ai.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Commonly Used */}
          {(activeSection === 'commonly_used' || (searchQuery && activeSection !== 'agents')) && (
            <div className="settings-group">
              <div className="settings-group-header">Commonly Used</div>

              {/* Editor Font Size */}
              {filterMatches('editor.fontSize', 'Editor: Font Size', 'Controls the font size in pixels.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor: Font Size</span>
                    <span className="settings-row-desc">Controls the font size in pixels for the code editor.</span>
                  </div>
                  <div className="settings-row-control">
                    <input
                      type="number"
                      className="settings-input-number"
                      value={settings.editorFontSize}
                      min={10}
                      max={36}
                      onChange={(e) => onUpdateSettings({ editorFontSize: Number(e.target.value) || 13 })}
                    />
                  </div>
                </div>
              )}

              {/* Auto Save */}
              {filterMatches('files.autoSave', 'Files: Auto Save', 'Controls auto saving of dirty files.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Files: Auto Save</span>
                    <span className="settings-row-desc">Automatically saves files after editing in Monaco Editor.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="settings-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={settings.autoSaveFiles}
                        onChange={(e) => onUpdateSettings({ autoSaveFiles: e.target.checked })}
                      />
                      <span className="settings-checkbox-custom" />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Text Editor */}
          {(activeSection === 'editor' || (searchQuery && activeSection !== 'agents')) && (
            <div className="settings-group">
              <div className="settings-group-header">Text Editor</div>

              {/* Editor Font Family */}
              {filterMatches('editor.fontFamily', 'Editor: Font Family', 'Controls the font family.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor: Font Family</span>
                    <span className="settings-row-desc">Controls the font family for code syntax rendering.</span>
                  </div>
                  <div className="settings-row-control">
                    <input
                      type="text"
                      className="settings-input-text"
                      value={settings.editorFontFamily}
                      onChange={(e) => onUpdateSettings({ editorFontFamily: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Tab Size */}
              {filterMatches('editor.tabSize', 'Editor: Tab Size', 'The number of spaces a tab is equal to.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor: Tab Size</span>
                    <span className="settings-row-desc">The number of spaces a tab is equal to.</span>
                  </div>
                  <div className="settings-row-control">
                    <input
                      type="number"
                      className="settings-input-number"
                      value={settings.editorTabSize}
                      min={1}
                      max={8}
                      onChange={(e) => onUpdateSettings({ editorTabSize: Number(e.target.value) || 2 })}
                    />
                  </div>
                </div>
              )}

              {/* Minimap */}
              {filterMatches('editor.minimap', 'Editor > Minimap: Enabled', 'Controls whether the minimap is shown.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor &gt; Minimap: Enabled</span>
                    <span className="settings-row-desc">Controls whether the right-side minimap code overview is shown.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="settings-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={settings.editorMinimap}
                        onChange={(e) => onUpdateSettings({ editorMinimap: e.target.checked })}
                      />
                      <span className="settings-checkbox-custom" />
                    </label>
                  </div>
                </div>
              )}

              {/* Word Wrap */}
              {filterMatches('editor.wordWrap', 'Editor: Word Wrap', 'Controls how lines should wrap.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor: Word Wrap</span>
                    <span className="settings-row-desc">Controls how long lines should wrap in the editor.</span>
                  </div>
                  <div className="settings-row-control">
                    <select
                      className="settings-select"
                      value={settings.editorWordWrap}
                      onChange={(e) => onUpdateSettings({ editorWordWrap: e.target.value as any })}
                    >
                      <option value="off">off</option>
                      <option value="on">on</option>
                      <option value="wordWrapColumn">wordWrapColumn</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Line Numbers */}
              {filterMatches('editor.lineNumbers', 'Editor: Line Numbers', 'Controls the display of line numbers.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor: Line Numbers</span>
                    <span className="settings-row-desc">Controls the display of line numbers in the gutter.</span>
                  </div>
                  <div className="settings-row-control">
                    <select
                      className="settings-select"
                      value={settings.editorLineNumbers}
                      onChange={(e) => onUpdateSettings({ editorLineNumbers: e.target.value as any })}
                    >
                      <option value="on">on</option>
                      <option value="off">off</option>
                      <option value="relative">relative</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Bracket Pair Colorization */}
              {filterMatches('editor.bracketPairColorization', 'Editor: Bracket Pair Colorization', 'Controls whether bracket pair colorization is enabled.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Editor: Bracket Pair Colorization</span>
                    <span className="settings-row-desc">Controls whether bracket pairs are colored with matching identifiers.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="settings-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={settings.editorBracketPairColorization}
                        onChange={(e) => onUpdateSettings({ editorBracketPairColorization: e.target.checked })}
                      />
                      <span className="settings-checkbox-custom" />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Terminal */}
          {(activeSection === 'terminal' || (searchQuery && activeSection !== 'agents')) && (
            <div className="settings-group">
              <div className="settings-group-header">Integrated Terminal</div>

              {/* Terminal Font Size */}
              {filterMatches('terminal.fontSize', 'Terminal: Font Size', 'Controls the font size in pixels.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Terminal: Font Size</span>
                    <span className="settings-row-desc">Controls the font size in pixels of the integrated terminal.</span>
                  </div>
                  <div className="settings-row-control">
                    <input
                      type="number"
                      className="settings-input-number"
                      value={settings.terminalFontSize}
                      min={10}
                      max={32}
                      onChange={(e) => onUpdateSettings({ terminalFontSize: Number(e.target.value) || 13 })}
                    />
                  </div>
                </div>
              )}

              {/* Terminal Cursor Blink */}
              {filterMatches('terminal.cursorBlinking', 'Terminal: Cursor Blinking', 'Controls whether the terminal cursor blinks.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">Terminal: Cursor Blinking</span>
                    <span className="settings-row-desc">Controls whether the terminal cursor blinks in active sessions.</span>
                  </div>
                  <div className="settings-row-control">
                    <label className="settings-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={settings.terminalCursorBlink}
                        onChange={(e) => onUpdateSettings({ terminalCursorBlink: e.target.checked })}
                      />
                      <span className="settings-checkbox-custom" />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 4: AI Orchestrator */}
          {(activeSection === 'ai_orchestrator' || (searchQuery && activeSection !== 'agents')) && (
            <div className="settings-group">
              <div className="settings-group-header">AI Orchestrator &amp; Discussions</div>

              {/* Default Execution Mode */}
              {filterMatches('ai.executionMode', 'AI: Default Execution Mode', 'Default mode for dispatching tasks.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">AI: Default Execution Mode</span>
                    <span className="settings-row-desc">Specifies the initial execution mode for agent prompts in discussions.</span>
                  </div>
                  <div className="settings-row-control">
                    <select
                      className="settings-select"
                      value={settings.defaultExecutionMode}
                      onChange={(e) => onUpdateSettings({ defaultExecutionMode: e.target.value as any })}
                    >
                      <option value="default">Default</option>
                      <option value="auto">Auto (YOLO)</option>
                      <option value="plan">Plan Mode</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Auto Review Mode */}
              {filterMatches('ai.reviewMode', 'AI: Code Review Mode', 'Automatic code review behavior.') && (
                <div className="settings-row">
                  <div className="settings-row-info">
                    <span className="settings-row-key">AI: Code Review Mode</span>
                    <span className="settings-row-desc">Select whether agents automatically review generated code deliverables.</span>
                  </div>
                  <div className="settings-row-control">
                    <select
                      className="settings-select"
                      value={settings.autoReviewMode}
                      onChange={(e) => onUpdateSettings({ autoReviewMode: e.target.value as any })}
                    >
                      <option value="auto_review">Auto review</option>
                      <option value="manual_review">Manual review</option>
                      <option value="disabled">No review</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
