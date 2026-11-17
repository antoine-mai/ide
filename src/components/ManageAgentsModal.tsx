import React, { useState } from 'react';
import { X, Trash2, Plus, Bot } from 'lucide-react';

export interface InstalledAI {
  id: string;
  name: string;
  command: string; // e.g., 'agy', 'claude', 'gemini-cli'
  defaultArgs?: string;
  customHome?: string; // Optional custom HOME directory for isolation
  customEnv?: Record<string, string>; // Optional custom environment variables
}

interface ManageAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: InstalledAI[];
  onAddAgent: (agent: InstalledAI) => void;
  onDeleteAgent: (id: string) => void;
}

export const ManageAgentsModal: React.FC<ManageAgentsModalProps> = ({
  isOpen,
  onClose,
  agents,
  onAddAgent,
  onDeleteAgent,
}) => {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [defaultArgs, setDefaultArgs] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    onAddAgent({
      id: `${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name: name.trim(),
      command: command.trim(),
      defaultArgs: defaultArgs.trim() || undefined,
    });

    setName('');
    setCommand('');
    setDefaultArgs('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} color="#60a5fa" />
            <span>Quản lý AI Installed</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* List of currently installed AIs */}
          <div>
            <div className="modal-section-title">Danh sách AI đã cài đặt</div>
            <div className="manage-ai-list">
              {agents.map((ai) => (
                <div key={ai.id} className="manage-ai-item">
                  <div className="manage-ai-info">
                    <span className="manage-ai-name">{ai.name}</span>
                    <span className="manage-ai-command">
                      Lệnh CLI: {ai.command} {ai.defaultArgs || ''}
                    </span>
                  </div>
                  {agents.length > 1 && (
                    <button
                      className="manage-ai-delete"
                      title="Xóa AI này"
                      onClick={() => onDeleteAgent(ai.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form to add a new AI */}
          <div>
            <div className="modal-section-title">Thêm AI mới</div>
            <form className="add-ai-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tên hiển thị</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: Claude CLI, Aider, Gemini..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Lệnh CLI (Executable)</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: agy, claude, aider..."
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Tham số mặc định (Tùy chọn)</label>
                <input
                  className="form-input"
                  placeholder="Ví dụ: --model=claude-sonnet-4-6"
                  value={defaultArgs}
                  onChange={(e) => setDefaultArgs(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="add-ai-submit"
                disabled={!name.trim() || !command.trim()}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} />
                  Thêm AI
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
