import React, { useState } from 'react';
import { Trash2, Plus, Bot, Settings2, X, Terminal, Sparkles, Folder, KeyRound, ChevronRight, ChevronDown } from 'lucide-react';
import { InstalledAI } from './ManageAgentsModal';

interface ManageAgentsTabProps {
  agents: InstalledAI[];
  onAddAgent: (agent: InstalledAI) => void;
  onDeleteAgent: (id: string) => void;
}

export const ManageAgentsTab: React.FC<ManageAgentsTabProps> = ({
  agents,
  onAddAgent,
  onDeleteAgent,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [defaultArgs, setDefaultArgs] = useState('');

  // Isolation & Environment Extensions
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

  const handleSubmit = (e: React.FormEvent) => {
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
    setShowAddForm(false);
  };

  return (
    <div className="manage-agents-tab-container">
      <div className="manage-agents-tab-content">
        {/* Header with Title and Add Agent Button */}
        <div className="manage-agents-tab-header">
          <div className="manage-agents-header-left">
            <div className="manage-agents-header-icon">
              <Settings2 size={20} color="#60a5fa" />
            </div>
            <div>
              <h2 className="manage-agents-tab-title">Installed Agents</h2>
              <p className="manage-agents-tab-desc">
                Configure CLI agents available for chat sessions across your workspaces.
              </p>
            </div>
          </div>

          <button
            className={`manage-agents-add-btn ${showAddForm ? 'active' : ''}`}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? (
              <>
                <X size={14} />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Add Agent</span>
              </>
            )}
          </button>
        </div>

        {/* Collapsible Add Agent Form */}
        {showAddForm && (
          <div className="manage-agents-add-panel">
            <div className="manage-agents-panel-header">
              <div className="manage-agents-panel-title">
                <Sparkles size={14} color="#60a5fa" />
                <span>New Agent</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="manage-agents-form-grid">
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Claude Work, Claude Personal, Agy Bot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>Executable Command</label>
                <input
                  type="text"
                  placeholder="e.g. claude, agy, aider, opencode"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Default Arguments (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. --model=claude-3-7-sonnet"
                  value={defaultArgs}
                  onChange={(e) => setDefaultArgs(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Extended: Environment & Profile Isolation Toggle */}
              <div className="full-width" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="manage-agents-advanced-toggle"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Environment & Profile Isolation (Run multiple of same agent)</span>
                </button>
              </div>

              {showAdvanced && (
                <div className="manage-agents-advanced-box full-width">
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Folder size={12} color="#60a5fa" />
                        <span>Isolated Profile Directory (Custom $HOME)</span>
                      </label>
                      <button
                        type="button"
                        className="auto-gen-profile-btn"
                        onClick={handleAutoGenerateHome}
                      >
                        Auto-generate path
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. ~/.agents-profiles/claude-secondary (separate config, auth & memory)"
                      value={customHome}
                      onChange={(e) => setCustomHome(e.target.value)}
                      className="form-input"
                    />
                    <span className="form-hint">
                      Stores configs, auth credentials, cache and transcripts in an isolated directory so multiple instances of the same agent run concurrently without conflict.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <KeyRound size={12} color="#10b981" />
                        <span>Custom Environment Variables</span>
                      </label>
                      <button
                        type="button"
                        className="auto-gen-profile-btn"
                        onClick={handleAddEnvPair}
                      >
                        + Add Variable
                      </button>
                    </div>

                    {envPairs.map((pair, idx) => (
                      <div key={idx} className="env-pair-row">
                        <input
                          type="text"
                          placeholder="KEY (e.g. ANTHROPIC_API_KEY)"
                          value={pair.key}
                          onChange={(e) => handleEnvChange(idx, 'key', e.target.value)}
                          className="form-input env-key"
                        />
                        <span style={{ color: '#555866' }}>=</span>
                        <input
                          type="text"
                          placeholder="VALUE"
                          value={pair.value}
                          onChange={(e) => handleEnvChange(idx, 'value', e.target.value)}
                          className="form-input env-value"
                        />
                        <button
                          type="button"
                          className="env-remove-btn"
                          onClick={() => handleRemoveEnvPair(idx)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-actions full-width">
                <button
                  type="button"
                  className="manage-agents-cancel-btn"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="add-ai-submit"
                  disabled={!name.trim() || !command.trim()}
                >
                  <Plus size={14} />
                  <span>Save Agent</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Agents List */}
        <div className="manage-agents-list-wrapper">
          <div className="manage-agents-list-header">
            <span>Agents ({agents.length})</span>
          </div>

          <div className="manage-agents-list">
            {agents.map((agent) => (
              <div key={agent.id} className="manage-agent-row">
                <div className="manage-agent-row-left">
                  <div className="manage-agent-row-icon">
                    <Bot size={18} color="#60a5fa" />
                  </div>
                  <div className="manage-agent-row-details">
                    <div className="manage-agent-row-name-wrap">
                      <span className="manage-agent-row-name">{agent.name}</span>
                      {agent.customHome && (
                        <span className="manage-agent-profile-badge" title={`Isolated HOME: ${agent.customHome}`}>
                          <Folder size={10} />
                          <span>Isolated Profile</span>
                        </span>
                      )}
                    </div>
                    <div className="manage-agent-row-command">
                      <Terminal size={11} color="#6e727e" />
                      <code>{agent.command}</code>
                      {agent.defaultArgs && (
                        <span className="manage-agent-row-args">{agent.defaultArgs}</span>
                      )}
                      {agent.customHome && (
                        <span className="manage-agent-row-home" title={agent.customHome}>
                          HOME={agent.customHome}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="manage-agent-row-actions">
                  <button
                    className="manage-ai-card-delete"
                    title={`Delete ${agent.name}`}
                    onClick={() => onDeleteAgent(agent.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {agents.length === 0 && (
              <div className="manage-agents-empty">
                <Bot size={36} color="#383b47" />
                <p>No agents installed yet. Click "Add Agent" to register an executable.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
