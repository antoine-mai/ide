import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  X,
  FileCode,
  FileText,
  History,
  GitCommit,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { GitRepoDetails, GitFileStatus, GitCommitItem } from '../types/git';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName: string;
  initialTab?: 'changes' | 'branches' | 'history';
  onRefreshProject?: () => void;
}

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  projectPath,
  projectName,
  initialTab = 'changes',
  onRefreshProject,
}) => {
  const [activeTab, setActiveTab] = useState<'changes' | 'branches' | 'history'>(initialTab);
  const [gitDetails, setGitDetails] = useState<GitRepoDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [selectedDiffFile, setSelectedDiffFile] = useState<{ path: string; staged: boolean } | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync tab with props
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load Git Details
  const loadGitDetails = async () => {
    setIsLoading(true);
    try {
      const res = await window.electronAPI?.gitGetDetails(projectPath);
      if (res) {
        setGitDetails(res);
      }
    } catch (err: any) {
      console.error('Failed to load git details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const res = await window.electronAPI?.gitGetBranches(projectPath);
      if (res?.success) {
        setBranches(res.branches || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await window.electronAPI?.gitGetLog(projectPath, 30);
      if (res?.success) {
        setCommits(res.commits || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadGitDetails();
      loadBranches();
      loadHistory();
      setActionNotice(null);
    }
  }, [isOpen, projectPath]);

  // View Diff
  const handleSelectFileDiff = async (file: GitFileStatus, staged: boolean) => {
    setSelectedDiffFile({ path: file.path, staged });
    setIsLoadingDiff(true);
    try {
      const res = await window.electronAPI?.gitGetDiff(projectPath, file.path, staged);
      setDiffContent(res?.diff || '(No difference or binary file)');
    } catch {
      setDiffContent('Error loading diff.');
    } finally {
      setIsLoadingDiff(false);
    }
  };

  // Stage single file
  const handleStageFile = async (filePath: string) => {
    const res = await window.electronAPI?.gitStageFile(projectPath, filePath);
    if (res?.success) {
      loadGitDetails();
      onRefreshProject?.();
      if (selectedDiffFile?.path === filePath) {
        handleSelectFileDiff({ path: filePath, indexStatus: 'M', workTreeStatus: ' ', isStaged: true }, true);
      }
    }
  };

  // Unstage single file
  const handleUnstageFile = async (filePath: string) => {
    const res = await window.electronAPI?.gitUnstageFile(projectPath, filePath);
    if (res?.success) {
      loadGitDetails();
      onRefreshProject?.();
      if (selectedDiffFile?.path === filePath) {
        handleSelectFileDiff({ path: filePath, indexStatus: ' ', workTreeStatus: 'M', isStaged: false }, false);
      }
    }
  };

  // Stage all
  const handleStageAll = async () => {
    const res = await window.electronAPI?.gitStageAll(projectPath);
    if (res?.success) {
      loadGitDetails();
      onRefreshProject?.();
    }
  };

  // Unstage all
  const handleUnstageAll = async () => {
    const res = await window.electronAPI?.gitUnstageAll(projectPath);
    if (res?.success) {
      loadGitDetails();
      onRefreshProject?.();
    }
  };

  // Discard changes
  const handleDiscardFile = async (filePath: string) => {
    if (!window.confirm(`Discard all changes in "${filePath}"? This action cannot be undone.`)) {
      return;
    }
    const res = await window.electronAPI?.gitDiscardFile(projectPath, filePath);
    if (res?.success) {
      loadGitDetails();
      onRefreshProject?.();
      if (selectedDiffFile?.path === filePath) {
        setSelectedDiffFile(null);
        setDiffContent('');
      }
    }
  };

  // Commit
  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setIsLoading(true);
    const res = await window.electronAPI?.gitCommit(projectPath, commitMsg.trim());
    setIsLoading(false);

    if (res?.success) {
      setCommitMsg('');
      setActionNotice({ type: 'success', text: `Committed successfully: ${res.output || ''}` });
      loadGitDetails();
      loadHistory();
      onRefreshProject?.();
      setSelectedDiffFile(null);
    } else {
      setActionNotice({ type: 'error', text: `Commit failed: ${res?.error || 'Unknown error'}` });
    }
  };

  // Pull
  const handlePull = async () => {
    setIsLoading(true);
    setActionNotice(null);
    const res = await window.electronAPI?.gitPull(projectPath);
    setIsLoading(false);
    if (res?.success) {
      setActionNotice({ type: 'success', text: `Pull completed: ${res.output || 'Already up to date'}` });
      loadGitDetails();
      loadHistory();
      onRefreshProject?.();
    } else {
      setActionNotice({ type: 'error', text: `Pull failed: ${res?.error}` });
    }
  };

  // Push
  const handlePush = async () => {
    setIsLoading(true);
    setActionNotice(null);
    const res = await window.electronAPI?.gitPush(projectPath);
    setIsLoading(false);
    if (res?.success) {
      setActionNotice({ type: 'success', text: `Push completed: ${res.output || 'Everything up-to-date'}` });
      loadGitDetails();
      onRefreshProject?.();
    } else {
      setActionNotice({ type: 'error', text: `Push failed: ${res?.error}` });
    }
  };

  // Checkout branch
  const handleCheckoutBranch = async (branchName: string) => {
    setIsLoading(true);
    const res = await window.electronAPI?.gitCheckoutBranch(projectPath, branchName);
    setIsLoading(false);
    if (res?.success) {
      setActionNotice({ type: 'success', text: `Switched to branch "${branchName}"` });
      loadGitDetails();
      loadBranches();
      onRefreshProject?.();
    } else {
      setActionNotice({ type: 'error', text: `Checkout failed: ${res?.error}` });
    }
  };

  // Create & Checkout branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setIsLoading(true);
    const res = await window.electronAPI?.gitCreateBranch(projectPath, newBranchName.trim());
    setIsLoading(false);
    if (res?.success) {
      setActionNotice({ type: 'success', text: `Created and switched to branch "${newBranchName.trim()}"` });
      setNewBranchName('');
      loadGitDetails();
      loadBranches();
      onRefreshProject?.();
    } else {
      setActionNotice({ type: 'error', text: `Branch creation failed: ${res?.error}` });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="role-modal-overlay" onClick={onClose}>
      <div className="git-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Top Header Bar */}
        <div className="git-modal-header">
          <div className="git-modal-header-left">
            <div className="git-modal-icon-badge">
              <GitBranch size={16} color="#60a5fa" />
            </div>
            <div className="git-modal-title-wrap">
              <div className="git-modal-main-title">
                Source Control &amp; Git &bull; <span className="git-repo-name">{projectName}</span>
              </div>
              <div className="git-modal-meta">
                <span className="git-badge-branch">
                  <GitBranch size={11} /> {gitDetails?.branch || 'main'}
                </span>
                {gitDetails?.remoteUrl && (
                  <span className="git-badge-remote" title={gitDetails.remoteUrl}>
                    {gitDetails.remoteUrl.replace(/^git@github\.com:/, 'github.com/')}
                  </span>
                )}
                {gitDetails?.ahead ? (
                  <span className="git-ahead-chip">
                    <ArrowUp size={11} /> {gitDetails.ahead} ahead
                  </span>
                ) : null}
                {gitDetails?.behind ? (
                  <span className="git-behind-chip">
                    <ArrowDown size={11} /> {gitDetails.behind} behind
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="role-modal-tabs">
            <button
              type="button"
              className={`role-tab-btn ${activeTab === 'changes' ? 'active' : ''}`}
              onClick={() => setActiveTab('changes')}
            >
              <FileCode size={13} />
              <span>
                Changes ({gitDetails ? gitDetails.stagedFiles.length + gitDetails.unstagedFiles.length + gitDetails.untrackedFiles.length : 0})
              </span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
              onClick={() => setActiveTab('branches')}
            >
              <GitBranch size={13} />
              <span>Branches ({branches.length})</span>
            </button>
            <button
              type="button"
              className={`role-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={13} />
              <span>History</span>
            </button>
          </div>

          {/* Quick Header Actions */}
          <div className="git-header-actions">
            <button
              type="button"
              className="git-action-btn"
              onClick={handlePull}
              title="Pull changes from remote (git pull)"
              disabled={isLoading}
            >
              <ArrowDown size={13} />
              <span>Pull</span>
            </button>
            <button
              type="button"
              className="git-action-btn"
              onClick={handlePush}
              title="Push commits to remote (git push)"
              disabled={isLoading}
            >
              <ArrowUp size={13} />
              <span>Push</span>
            </button>
            <button
              type="button"
              className="git-action-btn icon-only"
              onClick={() => {
                loadGitDetails();
                loadBranches();
                loadHistory();
              }}
              title="Refresh repository status"
              disabled={isLoading}
            >
              <RotateCw size={13} className={isLoading ? 'live-spin' : ''} />
            </button>
            <button className="role-modal-close" onClick={onClose} title="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Action Notice (Banner) */}
        {actionNotice && (
          <div className={`git-notice-bar ${actionNotice.type}`}>
            <AlertCircle size={13} />
            <span>{actionNotice.text}</span>
            <button onClick={() => setActionNotice(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="git-modal-body">
          {/* TAB 1: CHANGES & DIFF VIEWER */}
          {activeTab === 'changes' && (
            <div className="git-changes-layout">
              {/* Left Pane: Changed Files & Commit Bar */}
              <div className="git-files-pane">
                {/* Commit Box */}
                <div className="git-commit-box">
                  <textarea
                    className="git-commit-input"
                    rows={2}
                    placeholder="Commit message (Enter to commit, Shift+Enter for newline)..."
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCommit();
                      }
                    }}
                  />
                  <div className="git-commit-actions">
                    <button
                      type="button"
                      className="git-commit-btn"
                      disabled={!commitMsg.trim() || isLoading || (gitDetails?.stagedFiles.length === 0)}
                      onClick={handleCommit}
                      title={gitDetails?.stagedFiles.length === 0 ? 'Stage files first to commit' : 'Commit staged changes'}
                    >
                      <GitCommit size={13} />
                      <span>Commit Staged ({gitDetails?.stagedFiles.length || 0})</span>
                    </button>
                  </div>
                </div>

                <div className="git-files-scroll-list">
                  {/* STAGED FILES */}
                  <div className="git-files-section">
                    <div className="git-section-header">
                      <span>STAGED CHANGES ({gitDetails?.stagedFiles.length || 0})</span>
                      {gitDetails && gitDetails.stagedFiles.length > 0 && (
                        <button
                          type="button"
                          className="git-section-action"
                          onClick={handleUnstageAll}
                          title="Unstage all files"
                        >
                          <Minus size={12} /> Unstage All
                        </button>
                      )}
                    </div>
                    {gitDetails?.stagedFiles.length === 0 && (
                      <div className="git-empty-hint">No staged changes</div>
                    )}
                    {gitDetails?.stagedFiles.map((file) => {
                      const isSelected = selectedDiffFile?.path === file.path && selectedDiffFile?.staged;
                      return (
                        <div
                          key={`staged-${file.path}`}
                          className={`git-file-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectFileDiff(file, true)}
                        >
                          <span className={`git-status-letter ${file.indexStatus}`}>
                            {file.indexStatus}
                          </span>
                          <span className="git-file-path" title={file.path}>
                            {file.path}
                          </span>
                          <div className="git-file-hover-actions">
                            <button
                              type="button"
                              className="git-row-btn"
                              title="Unstage file"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnstageFile(file.path);
                              }}
                            >
                              <Minus size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* UNSTAGED / MODIFIED FILES */}
                  <div className="git-files-section">
                    <div className="git-section-header">
                      <span>CHANGES ({gitDetails?.unstagedFiles.length || 0})</span>
                      {gitDetails && gitDetails.unstagedFiles.length > 0 && (
                        <button
                          type="button"
                          className="git-section-action"
                          onClick={handleStageAll}
                          title="Stage all changes"
                        >
                          <Plus size={12} /> Stage All
                        </button>
                      )}
                    </div>
                    {gitDetails?.unstagedFiles.length === 0 && (
                      <div className="git-empty-hint">No unstaged changes</div>
                    )}
                    {gitDetails?.unstagedFiles.map((file) => {
                      const isSelected = selectedDiffFile?.path === file.path && !selectedDiffFile?.staged;
                      return (
                        <div
                          key={`unstaged-${file.path}`}
                          className={`git-file-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectFileDiff(file, false)}
                        >
                          <span className={`git-status-letter ${file.workTreeStatus}`}>
                            {file.workTreeStatus}
                          </span>
                          <span className="git-file-path" title={file.path}>
                            {file.path}
                          </span>
                          <div className="git-file-hover-actions">
                            <button
                              type="button"
                              className="git-row-btn"
                              title="Discard changes in file"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDiscardFile(file.path);
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="git-row-btn"
                              title="Stage file"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStageFile(file.path);
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* UNTRACKED FILES */}
                  {gitDetails && gitDetails.untrackedFiles.length > 0 && (
                    <div className="git-files-section">
                      <div className="git-section-header">
                        <span>UNTRACKED FILES ({gitDetails.untrackedFiles.length})</span>
                      </div>
                      {gitDetails.untrackedFiles.map((file) => (
                        <div
                          key={`untracked-${file.path}`}
                          className="git-file-row"
                          onClick={() => handleSelectFileDiff(file, false)}
                        >
                          <span className="git-status-letter untracked">U</span>
                          <span className="git-file-path" title={file.path}>
                            {file.path}
                          </span>
                          <div className="git-file-hover-actions">
                            <button
                              type="button"
                              className="git-row-btn"
                              title="Delete untracked file"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDiscardFile(file.path);
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                            <button
                              type="button"
                              className="git-row-btn"
                              title="Stage new file"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStageFile(file.path);
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Diff Viewer */}
              <div className="git-diff-pane">
                {selectedDiffFile ? (
                  <>
                    <div className="git-diff-topbar">
                      <div className="git-diff-filepath">
                        <FileCode size={14} color="#60a5fa" />
                        <span>{selectedDiffFile.path}</span>
                        <span className="git-diff-tag">
                          {selectedDiffFile.staged ? 'Staged Diff' : 'Working Tree Diff'}
                        </span>
                      </div>
                      <div className="git-diff-actions">
                        {selectedDiffFile.staged ? (
                          <button
                            type="button"
                            className="git-diff-btn"
                            onClick={() => handleUnstageFile(selectedDiffFile.path)}
                          >
                            <Minus size={12} /> Unstage
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="git-diff-btn stage"
                            onClick={() => handleStageFile(selectedDiffFile.path)}
                          >
                            <Plus size={12} /> Stage
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="git-diff-content-scroll">
                      {isLoadingDiff ? (
                        <div className="git-diff-loading">Loading diff...</div>
                      ) : (
                        <pre className="git-diff-code">
                          {diffContent.split('\n').map((line, idx) => {
                            let lineClass = 'diff-line';
                            if (line.startsWith('+') && !line.startsWith('+++')) {
                              lineClass += ' add';
                            } else if (line.startsWith('-') && !line.startsWith('---')) {
                              lineClass += ' remove';
                            } else if (line.startsWith('@@')) {
                              lineClass += ' chunk';
                            }
                            return (
                              <div key={idx} className={lineClass}>
                                {line}
                              </div>
                            );
                          })}
                        </pre>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="git-diff-placeholder">
                    <FileText size={32} color="#383c4e" />
                    <div>Select a changed file from the left pane to inspect diff</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BRANCHES */}
          {activeTab === 'branches' && (
            <div className="git-branches-layout">
              <div className="git-branch-create-bar">
                <input
                  type="text"
                  className="role-form-input"
                  placeholder="New branch name (e.g. feat/login, fix/sidebar)..."
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateBranch();
                  }}
                />
                <button
                  type="button"
                  className="role-save-btn"
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || isLoading}
                >
                  <Plus size={13} />
                  <span>Create Branch</span>
                </button>
              </div>

              <div className="git-branches-list">
                {branches.map((b) => {
                  const isCurrent = b === gitDetails?.branch;
                  const isRemote = b.startsWith('remotes/');

                  return (
                    <div key={b} className={`git-branch-row ${isCurrent ? 'current' : ''}`}>
                      <div className="git-branch-info">
                        <GitBranch size={14} color={isCurrent ? '#60a5fa' : '#8f9299'} />
                        <span className="git-branch-name">{b}</span>
                        {isCurrent && <span className="git-current-badge">CURRENT</span>}
                        {isRemote && <span className="git-remote-badge">REMOTE</span>}
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          className="git-checkout-btn"
                          onClick={() => handleCheckoutBranch(b.replace(/^remotes\/origin\//, ''))}
                          disabled={isLoading}
                        >
                          Checkout
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <div className="git-history-layout">
              <div className="git-history-list">
                {commits.map((c) => (
                  <div key={c.hash} className="git-commit-row">
                    <div className="git-commit-dot-line">
                      <div className="git-commit-dot" />
                      <div className="git-commit-line" />
                    </div>
                    <div className="git-commit-info">
                      <div className="git-commit-header">
                        <span className="git-commit-msg">{c.message}</span>
                        <span className="git-commit-hash">{c.shortHash}</span>
                      </div>
                      <div className="git-commit-meta">
                        <span className="git-commit-author">{c.author}</span>
                        <span className="git-commit-time">{c.relativeTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {commits.length === 0 && (
                  <div className="git-empty-hint" style={{ padding: 24, textAlign: 'center' }}>
                    No commit history found in this repository.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
