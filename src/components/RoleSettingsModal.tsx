import React, { useState } from 'react';
import {
  ShieldAlert,
  Bot,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Globe,
  X,
  Cpu,
  Info,
  Check,
} from 'lucide-react';
import { AgentRole, SupervisorConfig } from '../types/agent-roles';
import { InstalledAI } from './ManageAgentsModal';

interface RoleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: AgentRole[];
  onSaveRoles: (roles: AgentRole[]) => void;
  supervisorConfig: SupervisorConfig;
  onSaveSupervisorConfig: (config: SupervisorConfig) => void;
  installedAIs: InstalledAI[];
}

export const RoleSettingsModal: React.FC<RoleSettingsModalProps> = ({
  isOpen,
  onClose,
  roles,
  onSaveRoles,
  supervisorConfig,
  onSaveSupervisorConfig,
  installedAIs,
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'supervisor'>('roles');

  // Supervisor Form State
  const [supType, setSupType] = useState<SupervisorConfig['type']>(supervisorConfig.type || 'agent');
  const [supAgentId, setSupAgentId] = useState(supervisorConfig.selectedAgentId || installedAIs[0]?.id || '');
  const [apiProvider, setApiProvider] = useState(supervisorConfig.apiProvider || 'openai');
  const [apiKey, setApiKey] = useState(supervisorConfig.apiKey || '');
  const [modelName, setModelName] = useState(supervisorConfig.modelName || 'gpt-4o-mini');

  // Role Form State
  const [editingRoles, setEditingRoles] = useState<AgentRole[]>(roles);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || '');

  if (!isOpen) return null;

  const currentRole = editingRoles.find((r) => r.id === selectedRoleId) || editingRoles[0];

  const handleUpdateRole = (id: string, updates: Partial<AgentRole>) => {
    setEditingRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  };

  const handleAddNewRole = () => {
    const newRole: AgentRole = {
      id: `role-${Date.now()}`,
      name: 'New Custom Role',
      description: 'Scope and responsibilities',
      rules: `# Role Rules & Contract\n1. Verify input specifications before executing tasks.\n2. Reject invalid or ambiguous instructions with OBJECTION: <reason>.\n3. Enforce code quality, schema validation, and security guidelines.`,
      assignedAgentId: installedAIs[0]?.id,
    };
    setEditingRoles([...editingRoles, newRole]);
    setSelectedRoleId(newRole.id);
  };

  const handleDeleteRole = (id: string) => {
    const remaining = editingRoles.filter((r) => r.id !== id);
    setEditingRoles(remaining);
    if (selectedRoleId === id && remaining[0]) {
      setSelectedRoleId(remaining[0].id);
    }
  };

  const handleSaveAll = () => {
    onSaveRoles(editingRoles);
    onSaveSupervisorConfig({
      type: supType,
      selectedAgentId: supAgentId,
      apiProvider: supType === 'api' ? apiProvider : undefined,
      apiKey: supType === 'api' ? apiKey : undefined,
      modelName: supType === 'api' ? modelName : undefined,
    });
    onClose();
  };

  return (
    <div className="role-modal-overlay" onClick={onClose}>
      <div className="role-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="role-modal-top-bar">
          <div className="role-modal-header-left">
            <div className="role-modal-icon-badge">
              <Sliders size={15} color="#60a5fa" />
            </div>
            <div className="role-modal-titles">
              <span className="role-modal-main-title">Multi-Agent Orchestrator</span>
              <span className="role-modal-subtitle">Roles & Rules Contracts &bull; LangGraph Supervisor</span>
            </div>
          </div>

          <div className="role-modal-tabs">
            <button
              type="button"
              className={`role-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <Cpu size={13} />
              <span>Roles &amp; Rules ({editingRoles.length})</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${activeTab === 'supervisor' ? 'active' : ''}`}
              onClick={() => setActiveTab('supervisor')}
            >
              <Sparkles size={13} />
              <span>Supervisor Engine</span>
            </button>
          </div>

          <button className="role-modal-close" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="role-modal-body">
          {activeTab === 'roles' ? (
            <div className="role-management-layout">
              {/* Left Column: Roles Sidebar */}
              <div className="role-sidebar-pane">
                <div className="role-sidebar-header">
                  <span className="role-sidebar-heading">Assigned Roles</span>
                  <button
                    type="button"
                    className="role-add-btn"
                    onClick={handleAddNewRole}
                    title="Add a new role contract"
                  >
                    <Plus size={12} />
                    <span>New Role</span>
                  </button>
                </div>

                <div className="role-sidebar-list">
                  {editingRoles.map((role) => {
                    const assignedAI = installedAIs.find((a) => a.id === role.assignedAgentId);
                    const isSelected = role.id === currentRole?.id;

                    return (
                      <div
                        key={role.id}
                        className={`role-item-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedRoleId(role.id)}
                      >
                        <div className="role-item-indicator" />
                        <div className="role-item-info">
                          <span className="role-item-name">{role.name}</span>
                          <span className="role-item-sub">
                            {assignedAI ? (
                              <span className="role-agent-tag">
                                <Bot size={10} /> {assignedAI.name}
                              </span>
                            ) : (
                              <span className="role-agent-tag unassigned">Unassigned</span>
                            )}
                          </span>
                        </div>

                        {editingRoles.length > 1 && (
                          <button
                            type="button"
                            className="role-item-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(role.id);
                            }}
                            title={`Delete ${role.name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="role-sidebar-footer">
                  <Info size={12} color="#64748b" />
                  <span>Roles evaluate tasks independently before execution.</span>
                </div>
              </div>

              {/* Right Column: Role Editor */}
              {currentRole && (
                <div className="role-editor-pane">
                  <div className="role-editor-top">
                    <div>
                      <div className="role-editor-title">{currentRole.name}</div>
                      <div className="role-editor-subtitle">Configure identity, assigned AI engine, and rule contract</div>
                    </div>
                  </div>

                  <div className="role-form-grid">
                    <div className="role-form-group">
                      <label className="role-form-label">Role Name</label>
                      <input
                        type="text"
                        className="role-form-input"
                        value={currentRole.name}
                        onChange={(e) => handleUpdateRole(currentRole.id, { name: e.target.value })}
                        placeholder="e.g. Lead Developer, Security Reviewer, QA Tester"
                      />
                    </div>

                    <div className="role-form-group">
                      <label className="role-form-label">Assigned AI Executable</label>
                      <select
                        className="role-form-input role-form-select"
                        value={currentRole.assignedAgentId || ''}
                        onChange={(e) => handleUpdateRole(currentRole.id, { assignedAgentId: e.target.value })}
                      >
                        {installedAIs.map((ai) => (
                          <option key={ai.id} value={ai.id}>
                            {ai.name} ({ai.command}) {ai.customHome ? '[Isolated]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="role-form-group full-width">
                      <label className="role-form-label">Description / Scope of Responsibility</label>
                      <input
                        type="text"
                        className="role-form-input"
                        value={currentRole.description}
                        onChange={(e) => handleUpdateRole(currentRole.id, { description: e.target.value })}
                        placeholder="e.g. Audits code changes, enforces unit test coverage, verifies security schemas"
                      />
                    </div>
                  </div>

                  {/* Rules & Contract Code Editor */}
                  <div className="role-rules-section">
                    <div className="role-rules-header">
                      <div className="role-rules-label">
                        <ShieldAlert size={14} color="#f59e0b" />
                        <span>Role Validation Contract &amp; Rules (Agent Script)</span>
                      </div>
                      <span className="role-rules-badge">Pre-flight Pushback Guard</span>
                    </div>

                    <p className="role-rules-desc">
                      Whenever the Supervisor assigns a sub-task, this agent will independently evaluate the task against these rules.
                      If violated, it emits an <code>OBJECTION</code> to reject and renegotiate with the Supervisor before any code is modified.
                    </p>

                    <div className="role-rules-editor-wrapper">
                      <textarea
                        className="role-rules-textarea"
                        value={currentRole.rules}
                        onChange={(e) => handleUpdateRole(currentRole.id, { rules: e.target.value })}
                        placeholder="# Internal Contract Guidelines&#10;1. Reject any tasks containing hardcoded credentials or plain keys.&#10;2. Enforce input schema validation before execution."
                        rows={10}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SUPERVISOR CONFIGURATION PANE */
            <div className="supervisor-settings-pane">
              <div className="supervisor-banner">
                <div className="sup-banner-icon">
                  <Sparkles size={20} color="#60a5fa" />
                </div>
                <div className="sup-banner-content">
                  <div className="sup-banner-title">LangGraph Supervisor Engine</div>
                  <div className="sup-banner-desc">
                    The Supervisor coordinates the entire workflow: decomposes goals into sequential steps, assigns tasks to roles, negotiates pushback/objections, and compiles final deliverables.
                  </div>
                </div>
              </div>

              <div className="sup-section">
                <label className="sup-section-label">Supervisor Engine Type</label>
                <div className="supervisor-type-selector">
                  <button
                    type="button"
                    className={`sup-type-btn ${supType === 'agent' ? 'active' : ''}`}
                    onClick={() => setSupType('agent')}
                  >
                    <div className="sup-type-header">
                      <div className="sup-type-icon-box">
                        <Bot size={16} color={supType === 'agent' ? '#60a5fa' : '#8f9299'} />
                      </div>
                      <div className="sup-type-radio">{supType === 'agent' && <Check size={12} color="#60a5fa" />}</div>
                    </div>
                    <div className="sup-type-title">Registered CLI Agent</div>
                    <div className="sup-type-desc">Use one of your registered CLI tools as the Lead Supervisor</div>
                  </button>

                  <button
                    type="button"
                    className={`sup-type-btn ${supType === 'api' ? 'active' : ''}`}
                    onClick={() => setSupType('api')}
                  >
                    <div className="sup-type-header">
                      <div className="sup-type-icon-box">
                        <Globe size={16} color={supType === 'api' ? '#60a5fa' : '#8f9299'} />
                      </div>
                      <div className="sup-type-radio">{supType === 'api' && <Check size={12} color="#60a5fa" />}</div>
                    </div>
                    <div className="sup-type-title">Direct Cloud LLM API</div>
                    <div className="sup-type-desc">Call OpenAI, Anthropic or Gemini directly via API key</div>
                  </button>
                </div>
              </div>

              {supType === 'agent' ? (
                <div className="sup-config-box">
                  <div className="role-form-group">
                    <label className="role-form-label">Select Registered AI Agent</label>
                    <select
                      className="role-form-input role-form-select"
                      value={supAgentId}
                      onChange={(e) => setSupAgentId(e.target.value)}
                    >
                      {installedAIs.map((ai) => (
                        <option key={ai.id} value={ai.id}>
                          {ai.name} ({ai.command}) {ai.customHome ? '[Isolated]' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="sup-input-hint">The Supervisor will execute planner queries using this agent's binary and environment.</span>
                  </div>
                </div>
              ) : (
                <div className="sup-config-box">
                  <div className="role-form-grid">
                    <div className="role-form-group">
                      <label className="role-form-label">API Provider</label>
                      <select
                        className="role-form-input role-form-select"
                        value={apiProvider}
                        onChange={(e) => setApiProvider(e.target.value as any)}
                      >
                        <option value="openai">OpenAI (ChatGPT / GPT-4o)</option>
                        <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                        <option value="gemini">Google Gemini (Gemini 1.5 Pro / Flash)</option>
                      </select>
                    </div>

                    <div className="role-form-group">
                      <label className="role-form-label">Model Identifier</label>
                      <input
                        type="text"
                        className="role-form-input"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        placeholder="gpt-4o-mini, claude-3-5-sonnet, gemini-1.5-flash"
                      />
                    </div>

                    <div className="role-form-group full-width">
                      <label className="role-form-label">API Secret Key</label>
                      <input
                        type="password"
                        className="role-form-input"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                      />
                      <span className="sup-input-hint">Stored securely in local environment; never logged or transmitted elsewhere.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="role-modal-footer">
          <button type="button" className="role-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="role-save-btn" onClick={handleSaveAll}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
