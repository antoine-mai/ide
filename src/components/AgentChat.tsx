import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Square,
  Folder,
  History,
  ArrowRight,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  FileText,
  Target,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

interface WorkspaceContextItem {
  conversationId: string;
  title: string;
  preview: string;
  lastModified?: string;
}

interface AgentChatProps {
  sessionId: string;
  agentName: string;
  agentCommand: string;
  defaultArgs?: string;
  customHome?: string;
  customEnv?: Record<string, string>;
  cwd: string;
  projectName: string;
}

interface ModelOption {
  id: string;
  name: string;
  short: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)', short: '3.8 Flash' },
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Med)', short: '3.8 Med' },
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', short: '3.8 High' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)', short: 'Sonnet 4.6' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)', short: 'Opus 4.6' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)', short: 'GPT-OSS' },
];

const REASONING_EFFORTS = [
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'xhigh', name: 'Extra High' },
  { id: 'max', name: 'Max' },
];

const EXEC_MODES = [
  { id: 'default', name: 'Default' },
  { id: 'auto', name: 'Auto (YOLO)' },
  { id: 'accept-edits', name: 'Accept Edits' },
  { id: 'plan', name: 'Plan Mode' },
];

const AUTO_REVIEW_MODES = [
  { id: 'auto_review', name: 'Auto review' },
  { id: 'manual_review', name: 'Manual review' },
  { id: 'disabled', name: 'No review' },
];

export const AgentChat: React.FC<AgentChatProps> = ({
  sessionId,
  agentName,
  agentCommand,
  defaultArgs,
  customHome,
  customEnv,
  cwd,
  projectName,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [contexts, setContexts] = useState<WorkspaceContextItem[]>([]);
  const [loadingContexts, setLoadingContexts] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  // Toolbar state matching screenshot
  const [selectedReview, setSelectedReview] = useState('auto_review');
  const [selectedMode, setSelectedMode] = useState('default');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash-low');
  const [selectedEffort, setSelectedEffort] = useState('low');
  const [isFastMode, setIsFastMode] = useState(false);

  // Active dropdown
  const [openDropdown, setOpenDropdown] = useState<'review' | 'mode' | 'model' | 'effort' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Realtime Live Terminal Drawer
  const [isLiveTermExpanded, setIsLiveTermExpanded] = useState(false);
  const liveTermRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Click outside to close toolbar dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Khởi tạo terminal xterm cho realtime live stream
  useEffect(() => {
    if (!liveTermRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      fontSize: 12,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      disableStdin: true,
      scrollback: 1000,
      theme: {
        background: '#0d0e12',
        foreground: '#cbd5e1',
        black: '#1e293b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(liveTermRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln(`\x1b[90m--- Phiên giám sát thời gian thực của ${agentName} (${agentCommand}) ---\x1b[0m`);

    return () => {
      term.dispose();
      xtermInstance.current = null;
    };
  }, []);

  // Fit terminal khi expand/collapse
  useEffect(() => {
    if (isLiveTermExpanded) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {}
      }, 50);
    }
  }, [isLiveTermExpanded]);

  // Tải danh sách contexts (conversations đã từng chạy) liên quan tới workspace này
  useEffect(() => {
    let mounted = true;
    setLoadingContexts(true);

    window.electronAPI?.aiGetWorkspaceContexts(cwd, customHome).then((list) => {
      if (mounted) {
        setContexts(list || []);
        setLoadingContexts(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [cwd]);

  // Lắng nghe stream delta, raw logs và kết quả từ CLI process
  useEffect(() => {
    const removeRawLog = window.electronAPI?.onAiRawLog?.(sessionId, (rawLog) => {
      if (xtermInstance.current) {
        try {
          const parsed = JSON.parse(rawLog.trim());
          if (parsed.event === 'step_update' && parsed.step_update) {
            const step = parsed.step_update;
            if (step.tool_calls) {
              for (const tc of step.tool_calls) {
                xtermInstance.current.writeln(`\x1b[33m⚡ [Tool Call]\x1b[0m \x1b[1m${tc.name}\x1b[0m: ${JSON.stringify(tc.args || {})}`);
              }
            }
            if (step.thinking) {
              xtermInstance.current.writeln(`\x1b[90m💭 [Suy nghĩ]\x1b[0m ${step.thinking.slice(0, 150)}...`);
            }
            if (step.text_delta) {
              xtermInstance.current.write(step.text_delta);
            }
          } else if (parsed.event === 'result') {
            xtermInstance.current.writeln(`\r\n\x1b[32m✔ [Hoàn tất]\x1b[0m Kết quả đã sẵn sàng`);
          } else {
            xtermInstance.current.writeln(`\x1b[90m[${parsed.event || 'stream'}]\x1b[0m ${rawLog.trim()}`);
          }
        } catch {
          xtermInstance.current.write(rawLog.replace(/\n/g, '\r\n'));
        }
      }
    });

    const removeDelta = window.electronAPI?.onAiDelta(sessionId, (delta) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + delta },
          ];
        } else {
          return [
            ...prev,
            {
              id: `${Date.now()}-bot-stream`,
              sender: 'assistant',
              text: delta,
              timestamp: Date.now(),
            },
          ];
        }
      });
    });

    const removeDone = window.electronAPI?.onAiDone(sessionId, ({ code }) => {
      setIsStreaming(false);
      if (xtermInstance.current) {
        xtermInstance.current.writeln(`\r\n\x1b[90m[Tiến trình kết thúc với mã ${code}]\x1b[0m`);
      }
    });

    const removeError = window.electronAPI?.onAiError(sessionId, (data) => {
      setIsStreaming(false);
      if (xtermInstance.current) {
        xtermInstance.current.writeln(`\r\n\x1b[31m[Lỗi]: ${data.error}\x1b[0m`);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          sender: 'assistant',
          text: `[Lỗi CLI ${agentCommand} tại ${cwd}]: ${data.error}`,
          timestamp: Date.now(),
        },
      ]);
    });

    return () => {
      removeRawLog?.();
      removeDelta?.();
      removeDone?.();
      removeError?.();
    };
  }, [sessionId, agentCommand, cwd, agentName]);

  const handleAttachFiles = async () => {
    try {
      const selected = await window.electronAPI?.openFilesDialog(cwd);
      if (selected && selected.length > 0) {
        setAttachedFiles((prev) => Array.from(new Set([...prev, ...selected])));
      }
    } catch (err) {
      console.error('Failed to attach files:', err);
    }
  };

  const handleRemoveAttachedFile = (fileToRemove: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const handleSend = async (customPrompt?: string) => {
    let textToSend = typeof customPrompt === 'string' ? customPrompt : inputValue.trim();
    if ((!textToSend && attachedFiles.length === 0) || isStreaming) return;

    if (attachedFiles.length > 0) {
      const attachInfo = attachedFiles.map((f) => `@${f}`).join(' ');
      textToSend = textToSend ? `${textToSend}\n\n[Attached Files]: ${attachInfo}` : `[Attached Files]: ${attachInfo}`;
      setAttachedFiles([]);
    }

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      sender: 'user',
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) {
      setInputValue('');
    }
    setIsStreaming(true);

    if (xtermInstance.current) {
      xtermInstance.current.writeln(`\r\n\x1b[36m▶ [User Request]\x1b[0m: ${textToSend}`);
    }

    try {
      await window.electronAPI?.aiSendPrompt(
        sessionId,
        agentCommand,
        textToSend,
        cwd,
        defaultArgs,
        {
          model: selectedModel,
          effort: selectedEffort,
          mode: selectedMode,
          customHome,
          customEnv,
        }
      );
    } catch (err) {
      console.error('Failed to send prompt to CLI:', err);
      setIsStreaming(false);
    }
  };

  const handleResumeContext = async (context: WorkspaceContextItem) => {
    const result = await window.electronAPI?.aiResumeConversation(sessionId, context.conversationId, customHome);
    setActiveConversationId(context.conversationId);

    const historyMessages: ChatMessage[] = (result?.messages || []).map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
    }));

    const resumeNotice: ChatMessage = {
      id: `${Date.now()}-resume`,
      sender: 'assistant',
      text: `Reconnected to Conversation: \`${context.conversationId}\`\nYou can continue the discussion from where it left off.`,
      timestamp: Date.now(),
    };

    if (historyMessages.length > 0) {
      setMessages([...historyMessages, resumeNotice]);
    } else {
      setMessages([resumeNotice]);
    }

    if (xtermInstance.current) {
      xtermInstance.current.writeln(`\r\n\x1b[32m✔ [Resume Context]\x1b[0m Restored session: ${context.conversationId}`);
    }
  };

  const handleAbort = () => {
    window.electronAPI?.aiAbort(sessionId);
    setIsStreaming(false);
    if (xtermInstance.current) {
      xtermInstance.current.writeln(`\r\n\x1b[31m⏹ [User Aborted]\x1b[0m Execution stopped`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const currentModelObj = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];
  const currentModeObj = EXEC_MODES.find((m) => m.id === selectedMode) || EXEC_MODES[0];
  const currentEffortObj = REASONING_EFFORTS.find((e) => e.id === selectedEffort) || REASONING_EFFORTS[0];
  const currentReviewObj = AUTO_REVIEW_MODES.find((r) => r.id === selectedReview) || AUTO_REVIEW_MODES[0];

  return (
    <div className="chat-container">
      {/* Messages list */}
      <div className="chat-messages">
        {/* Banner Workspace & Contexts khởi đầu (thay thế lời chào mặc định) */}
        {messages.length === 0 && (
          <div className="workspace-context-card">
            <div className="workspace-context-header">
              <div className="workspace-path-label">
                <Folder size={14} color="#60a5fa" />
                <span>Workspace:</span>
                <strong className="workspace-path-value">{cwd}</strong>
              </div>
            </div>

            <div className="context-section">
              <div className="context-section-title">
                <History size={13} color="#94a3b8" />
                <span>Related Workspace Contexts:</span>
                {loadingContexts && <span style={{ fontSize: 11, color: '#64748b' }}>(loading...)</span>}
              </div>

              {contexts.length > 0 ? (
                <div className="context-list">
                  {contexts.map((ctx) => (
                    <div
                      key={ctx.conversationId}
                      className={`context-item ${activeConversationId === ctx.conversationId ? 'active' : ''}`}
                      onClick={() => handleResumeContext(ctx)}
                      title={`Resume session: ${ctx.conversationId}`}
                    >
                      <div className="context-item-body">
                        <div className="context-item-title">
                          {ctx.title || `Session ${ctx.conversationId.slice(0, 8)}`}
                        </div>
                        {ctx.preview && (
                          <div className="context-item-preview">{ctx.preview}</div>
                        )}
                        <div className="context-item-meta">
                          <span>ID: {ctx.conversationId.slice(0, 8)}</span>
                          {ctx.lastModified && (
                            <span>• {new Date(ctx.lastModified).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <button className="context-resume-btn">
                        <span>Resume</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="context-empty-hint">
                  No previous contexts for this workspace. Type a prompt below to start a new session.
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.sender}`}>
            <div className={`chat-avatar ${msg.sender}`}>
              {msg.sender === 'user' ? <User size={15} /> : <Bot size={15} />}
            </div>
            <div className="chat-bubble" style={{ whiteSpace: 'pre-wrap' }}>
              {msg.text}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div style={{ fontSize: 12, color: '#60a5fa', paddingLeft: 42, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="live-spin-dot" />
            <span>{agentName} is thinking in {projectName}...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Collapsible Realtime Agent Terminal Drawer */}
      <div className={`live-terminal-drawer ${isLiveTermExpanded ? 'expanded' : 'collapsed'}`}>
        <div
          className="live-terminal-bar"
          onClick={() => setIsLiveTermExpanded(!isLiveTermExpanded)}
        >
          <div className="live-terminal-bar-left">
            <TerminalIcon size={13} color={isStreaming ? '#10b981' : '#64748b'} />
            <span className="live-terminal-title">Realtime Agent Terminal</span>
            {isStreaming && <span className="live-badge-running">RUNNING</span>}
          </div>
          <div className="live-terminal-bar-right">
            <span className="live-terminal-hint">
              {isLiveTermExpanded ? 'Collapse' : 'Detailed stream'}
            </span>
            {isLiveTermExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </div>

        {/* Khung xterm luôn mounted trong DOM */}
        <div
          className="live-terminal-content"
          style={{ display: isLiveTermExpanded ? 'block' : 'none' }}
        >
          <div ref={liveTermRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        {/* Attached files preview chips if any */}
        {attachedFiles.length > 0 && (
          <div className="chat-attached-files-bar">
            {attachedFiles.map((f) => {
              const name = f.split('/').filter(Boolean).pop() || f;
              return (
                <div key={f} className="chat-attached-chip" title={f}>
                  <FileText size={12} color="#60a5fa" />
                  <span className="chat-attached-chip-name">{name}</span>
                  <button
                    className="chat-attached-chip-remove"
                    onClick={() => handleRemoveAttachedFile(f)}
                    title="Remove attachment"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea */}
        <div className="chat-textarea-wrapper">
          <textarea
            className="chat-textarea"
            placeholder={`Ask ${agentName} in ${projectName}... (Enter to send)`}
            rows={3}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
        </div>

        {/* Bottom Toolbar row: Exactly matching user screenshot */}
        <div className="chat-bottom-toolbar" ref={toolbarRef}>
          {/* Left items: + icon, crosshair icon, circle icon, dropdowns */}
          <div className="chat-toolbar-left">
            <button
              className="chat-toolbar-icon-btn"
              title="Attach files..."
              onClick={handleAttachFiles}
              disabled={isStreaming}
            >
              <Plus size={14} />
            </button>

            <button
              className="chat-toolbar-icon-btn"
              title="Target context"
            >
              <Target size={14} />
            </button>

            <button
              className="chat-toolbar-icon-btn"
              title="Agent status / Loop"
            >
              <span className="chat-toolbar-circle-icon" />
            </button>

            {/* Auto review dropdown */}
            <div className="chat-toolbar-select-wrap">
              <button
                className={`chat-toolbar-select-btn ${openDropdown === 'review' ? 'open' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'review' ? null : 'review')}
              >
                <span>{currentReviewObj.name}</span>
                <ChevronDown size={12} className="chevron" />
              </button>
              {openDropdown === 'review' && (
                <div className="chat-toolbar-menu">
                  {AUTO_REVIEW_MODES.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-toolbar-menu-item ${selectedReview === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedReview(item.id);
                        setOpenDropdown(null);
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mode dropdown (Default / YOLO / Accept edits / Plan) */}
            <div className="chat-toolbar-select-wrap">
              <button
                className={`chat-toolbar-select-btn ${openDropdown === 'mode' ? 'open' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'mode' ? null : 'mode')}
              >
                <span>{currentModeObj.name}</span>
                <ChevronDown size={12} className="chevron" />
              </button>
              {openDropdown === 'mode' && (
                <div className="chat-toolbar-menu">
                  {EXEC_MODES.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-toolbar-menu-item ${selectedMode === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMode(item.id);
                        setOpenDropdown(null);
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Model Switcher dropdown (Gemini 3.8, Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS...) */}
            <div className="chat-toolbar-select-wrap">
              <button
                className={`chat-toolbar-select-btn model-btn ${openDropdown === 'model' ? 'open' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'model' ? null : 'model')}
                title={currentModelObj.name}
              >
                <span>{currentModelObj.short}</span>
                <ChevronDown size={12} className="chevron" />
              </button>
              {openDropdown === 'model' && (
                <div className="chat-toolbar-menu model-menu">
                  <div className="chat-toolbar-menu-title">Select Model</div>
                  {AVAILABLE_MODELS.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-toolbar-menu-item ${selectedModel === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedModel(item.id);
                        setOpenDropdown(null);
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{item.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reasoning Effort dropdown (Low / Medium / High / Max) */}
            <div className="chat-toolbar-select-wrap">
              <button
                className={`chat-toolbar-select-btn ${openDropdown === 'effort' ? 'open' : ''}`}
                onClick={() => setOpenDropdown(openDropdown === 'effort' ? null : 'effort')}
              >
                <span>{currentEffortObj.name}</span>
                <ChevronDown size={12} className="chevron" />
              </button>
              {openDropdown === 'effort' && (
                <div className="chat-toolbar-menu">
                  <div className="chat-toolbar-menu-title">Reasoning Effort</div>
                  {REASONING_EFFORTS.map((item) => (
                    <div
                      key={item.id}
                      className={`chat-toolbar-menu-item ${selectedEffort === item.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedEffort(item.id);
                        setOpenDropdown(null);
                      }}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fast mode switch button */}
            <div className="chat-toolbar-toggle-wrap" onClick={() => setIsFastMode(!isFastMode)}>
              <span className="chat-toolbar-toggle-label">Fast mode</span>
              <div className={`chat-toolbar-switch ${isFastMode ? 'on' : 'off'}`}>
                <div className="chat-toolbar-switch-thumb" />
              </div>
            </div>
          </div>

          {/* Right items: Send button */}
          <div className="chat-toolbar-right">
            {isStreaming ? (
              <button
                className="chat-send-btn"
                style={{ backgroundColor: '#dc2626' }}
                title="Stop generation"
                onClick={handleAbort}
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                className="chat-send-btn"
                title="Send"
                disabled={!inputValue.trim() && attachedFiles.length === 0}
                onClick={() => handleSend()}
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
