import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Clipboard,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { FileNode } from '../types';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null; // null if clicked in empty workspace area
}

interface InlineInputState {
  parentPath: string;
  isDirectory: boolean;
  mode: 'create' | 'rename';
  oldNode?: FileNode;
}

interface TreeBrowserProps {
  rootPath?: string;
  rootName?: string;
  onOpenFile?: (filePath: string, fileName: string) => void;
  onOpenTerminal?: (customCwd: string, title?: string) => void;
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  onOpenFile?: (filePath: string, fileName: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  refreshTrigger: number;
  inlineInput: InlineInputState | null;
  onInlineSubmit: (val: string) => void;
  onInlineCancel: () => void;
}

export const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  onOpenFile,
  onContextMenu,
  refreshTrigger,
  inlineInput,
  onInlineSubmit,
  onInlineCancel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [localInputVal, setLocalInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isRenamingThis =
    inlineInput?.mode === 'rename' && inlineInput.oldNode?.path === node.path;
  const isCreatingInsideThis =
    inlineInput?.mode === 'create' && inlineInput.parentPath === node.path;

  // Reload children when folder refreshed
  useEffect(() => {
    if (node.isDirectory && isOpen) {
      window.electronAPI?.readDir(node.path).then((res) => {
        setChildren(res || []);
        setLoaded(true);
      });
    }
  }, [refreshTrigger, isOpen, node.path, node.isDirectory]);

  // Auto focus inline rename input
  useEffect(() => {
    if (isRenamingThis) {
      setLocalInputVal(node.name);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isRenamingThis, node.name]);

  const handleClick = async () => {
    if (node.isDirectory) {
      if (!isOpen && !loaded) {
        const result = await window.electronAPI?.readDir(node.path);
        setChildren(result || []);
        setLoaded(true);
      }
      setIsOpen(!isOpen);
    } else {
      onOpenFile?.(node.path, node.name);
    }
  };

  const handleRowContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  return (
    <div>
      {isRenamingThis ? (
        <div
          className="tree-inline-input-row"
          style={{ paddingLeft: `${level * 14 + 20}px` }}
        >
          {node.isDirectory ? (
            <Folder size={14} color="#60a5fa" />
          ) : (
            <File size={13} color="#8f9299" />
          )}
          <input
            ref={inputRef}
            type="text"
            className="tree-inline-input"
            value={localInputVal}
            onChange={(e) => setLocalInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onInlineSubmit(localInputVal);
              if (e.key === 'Escape') onInlineCancel();
            }}
            onBlur={() => onInlineSubmit(localInputVal)}
          />
        </div>
      ) : (
        <div
          className="tree-node-row"
          style={{ paddingLeft: `${level * 14 + 6}px` }}
          onClick={handleClick}
          onContextMenu={handleRowContextMenu}
          title={node.path}
        >
          <span className="tree-arrow">
            {node.isDirectory ? (
              isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            ) : (
              <span style={{ width: 12 }} />
            )}
          </span>

          <span className="tree-icon">
            {node.isDirectory ? (
              isOpen ? (
                <FolderOpen size={14} color="#60a5fa" />
              ) : (
                <Folder size={14} color="#60a5fa" />
              )
            ) : (
              <File size={13} color="#8f9299" />
            )}
          </span>

          <span className="tree-label">{node.name}</span>
        </div>
      )}

      {isOpen && (
        <div>
          {/* Creating inside this folder */}
          {isCreatingInsideThis && (
            <div
              className="tree-inline-input-row"
              style={{ paddingLeft: `${(level + 1) * 14 + 20}px` }}
            >
              {inlineInput.isDirectory ? (
                <Folder size={14} color="#60a5fa" />
              ) : (
                <File size={13} color="#8f9299" />
              )}
              <input
                autoFocus
                type="text"
                className="tree-inline-input"
                placeholder={inlineInput.isDirectory ? 'folder name' : 'file name'}
                value={localInputVal}
                onChange={(e) => setLocalInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onInlineSubmit(localInputVal);
                  if (e.key === 'Escape') onInlineCancel();
                }}
                onBlur={() => onInlineSubmit(localInputVal)}
              />
            </div>
          )}

          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              refreshTrigger={refreshTrigger}
              inlineInput={inlineInput}
              onInlineSubmit={onInlineSubmit}
              onInlineCancel={onInlineCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeBrowser: React.FC<TreeBrowserProps> = ({ rootPath, onOpenFile, onOpenTerminal }) => {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  // Inline Create / Rename State
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);
  const [rootInputVal, setRootInputVal] = useState('');

  const loadRootNodes = () => {
    if (!rootPath) {
      setRootNodes([]);
      return;
    }
    setLoading(true);
    window.electronAPI?.readDir(rootPath).then((nodes) => {
      setRootNodes(nodes || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadRootNodes();
  }, [rootPath, refreshTrigger]);

  // Close context menu on outside click
  useEffect(() => {
    const handleCloseMenu = () => {
      if (contextMenu.visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, [contextMenu.visible]);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    e.stopPropagation();

    // Bound menu coordinates within window
    const menuWidth = 230;
    const menuHeight = 280;
    const posX = e.clientX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : e.clientX;
    const posY = e.clientY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 8 : e.clientY;

    setContextMenu({
      visible: true,
      x: posX,
      y: posY,
      node,
    });
  };

  // Action Handlers
  const handleTriggerNewFile = () => {
    const targetDir = contextMenu.node?.isDirectory
      ? contextMenu.node.path
      : contextMenu.node
      ? contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
      : rootPath || '';

    setInlineInput({
      parentPath: targetDir,
      isDirectory: false,
      mode: 'create',
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTriggerNewFolder = () => {
    const targetDir = contextMenu.node?.isDirectory
      ? contextMenu.node.path
      : contextMenu.node
      ? contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
      : rootPath || '';

    setInlineInput({
      parentPath: targetDir,
      isDirectory: true,
      mode: 'create',
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTriggerRename = () => {
    if (!contextMenu.node) return;
    setInlineInput({
      parentPath: contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/')),
      isDirectory: contextMenu.node.isDirectory,
      mode: 'rename',
      oldNode: contextMenu.node,
    });
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTriggerDelete = async () => {
    if (!contextMenu.node) return;
    const name = contextMenu.node.name;
    const targetPath = contextMenu.node.path;
    setContextMenu((prev) => ({ ...prev, visible: false }));

    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const res = await window.electronAPI?.deleteEntry(targetPath);
      if (res?.success) {
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alert(`Failed to delete: ${res?.error || 'Unknown error'}`);
      }
    }
  };

  const handleTriggerDuplicate = async () => {
    if (!contextMenu.node || contextMenu.node.isDirectory) return;
    const sourcePath = contextMenu.node.path;
    setContextMenu((prev) => ({ ...prev, visible: false }));

    const res = await window.electronAPI?.duplicateEntry(sourcePath);
    if (res?.success) {
      setRefreshTrigger((prev) => prev + 1);
    } else {
      alert(`Failed to duplicate: ${res?.error || 'Unknown error'}`);
    }
  };

  const handleCopyPath = () => {
    if (!contextMenu.node) return;
    navigator.clipboard.writeText(contextMenu.node.path);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleCopyRelativePath = () => {
    if (!contextMenu.node || !rootPath) return;
    const rel = contextMenu.node.path.replace(rootPath, '').replace(/^\//, '');
    navigator.clipboard.writeText(rel);
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleRevealInOS = () => {
    const target = contextMenu.node?.path || rootPath;
    if (target) {
      window.electronAPI?.revealInExplorer(target);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleOpenTerminalInFolder = () => {
    const targetDir = contextMenu.node?.isDirectory
      ? contextMenu.node.path
      : contextMenu.node
      ? contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'))
      : rootPath;
    if (targetDir) {
      onOpenTerminal?.(targetDir);
    }
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // Submit Inline Input
  const handleInlineSubmit = async (val: string) => {
    const name = val.trim();
    if (!name || !inlineInput) {
      setInlineInput(null);
      return;
    }

    if (inlineInput.mode === 'create') {
      const targetPath = `${inlineInput.parentPath}/${name}`.replace(/\/+/g, '/');
      const res = await window.electronAPI?.createEntry(targetPath, inlineInput.isDirectory);
      if (res?.success) {
        setRefreshTrigger((prev) => prev + 1);
        if (!inlineInput.isDirectory) {
          onOpenFile?.(targetPath, name);
        }
      } else {
        alert(`Failed to create: ${res?.error || 'Error'}`);
      }
    } else if (inlineInput.mode === 'rename' && inlineInput.oldNode) {
      if (name === inlineInput.oldNode.name) {
        setInlineInput(null);
        return;
      }
      const newPath = `${inlineInput.parentPath}/${name}`.replace(/\/+/g, '/');
      const res = await window.electronAPI?.renameEntry(inlineInput.oldNode.path, newPath);
      if (res?.success) {
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alert(`Failed to rename: ${res?.error || 'Error'}`);
      }
    }

    setInlineInput(null);
  };

  const handleInlineCancel = () => {
    setInlineInput(null);
  };

  if (!rootPath) {
    return <div className="tree-empty">No workspace selected</div>;
  }

  if (loading && rootNodes.length === 0) {
    return <div className="tree-empty">Loading...</div>;
  }

  const isCreatingAtRoot = inlineInput?.mode === 'create' && inlineInput.parentPath === rootPath;

  return (
    <div
      className="tree-browser-list"
      style={{ minHeight: '100%', position: 'relative' }}
      onContextMenu={(e) => handleContextMenu(e, null)}
    >
      {/* Inline input if creating directly at root */}
      {isCreatingAtRoot && (
        <div className="tree-inline-input-row" style={{ paddingLeft: '16px' }}>
          {inlineInput.isDirectory ? (
            <Folder size={14} color="#60a5fa" />
          ) : (
            <File size={13} color="#8f9299" />
          )}
          <input
            autoFocus
            type="text"
            className="tree-inline-input"
            placeholder={inlineInput.isDirectory ? 'folder name' : 'file name'}
            value={rootInputVal}
            onChange={(e) => setRootInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInlineSubmit(rootInputVal);
              if (e.key === 'Escape') handleInlineCancel();
            }}
            onBlur={() => handleInlineSubmit(rootInputVal)}
          />
        </div>
      )}

      {rootNodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          level={0}
          onOpenFile={onOpenFile}
          onContextMenu={(e, n) => handleContextMenu(e, n)}
          refreshTrigger={refreshTrigger}
          inlineInput={inlineInput}
          onInlineSubmit={handleInlineSubmit}
          onInlineCancel={handleInlineCancel}
        />
      ))}

      {/* VS Code Style Context Menu Popup */}
      {contextMenu.visible && (
        <div
          className="explorer-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="explorer-context-item" onClick={handleTriggerNewFile}>
            <div className="explorer-context-item-left">
              <FilePlus size={13} />
              <span>New File</span>
            </div>
          </button>

          <button className="explorer-context-item" onClick={handleTriggerNewFolder}>
            <div className="explorer-context-item-left">
              <FolderPlus size={13} />
              <span>New Folder</span>
            </div>
          </button>

          <button
            className="explorer-context-item"
            onClick={() => {
              setRefreshTrigger((prev) => prev + 1);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <div className="explorer-context-item-left">
              <RefreshCw size={13} />
              <span>Refresh Explorer</span>
            </div>
          </button>

          <div className="explorer-context-divider" />

          <button className="explorer-context-item" onClick={handleRevealInOS}>
            <div className="explorer-context-item-left">
              <ExternalLink size={13} />
              <span>Reveal in File Manager</span>
            </div>
            <span className="explorer-context-item-shortcut">Alt+R</span>
          </button>

          {(!contextMenu.node || contextMenu.node.isDirectory) && (
            <button className="explorer-context-item" onClick={handleOpenTerminalInFolder}>
              <div className="explorer-context-item-left">
                <Terminal size={13} color="#10b981" />
                <span>Open in Integrated Terminal</span>
              </div>
              <span className="explorer-context-item-shortcut">Ctrl+`</span>
            </button>
          )}

          {contextMenu.node && (
            <>
              <div className="explorer-context-divider" />

              <button className="explorer-context-item" onClick={handleCopyPath}>
                <div className="explorer-context-item-left">
                  <Clipboard size={13} />
                  <span>Copy Path</span>
                </div>
                <span className="explorer-context-item-shortcut">Shift+Alt+C</span>
              </button>

              <button className="explorer-context-item" onClick={handleCopyRelativePath}>
                <div className="explorer-context-item-left">
                  <Copy size={13} />
                  <span>Copy Relative Path</span>
                </div>
              </button>

              {!contextMenu.node.isDirectory && (
                <button className="explorer-context-item" onClick={handleTriggerDuplicate}>
                  <div className="explorer-context-item-left">
                    <Copy size={13} />
                    <span>Duplicate</span>
                  </div>
                </button>
              )}

              <div className="explorer-context-divider" />

              <button className="explorer-context-item" onClick={handleTriggerRename}>
                <div className="explorer-context-item-left">
                  <Edit2 size={13} />
                  <span>Rename...</span>
                </div>
                <span className="explorer-context-item-shortcut">F2</span>
              </button>

              <button
                className="explorer-context-item"
                style={{ color: '#f87171' }}
                onClick={handleTriggerDelete}
              >
                <div className="explorer-context-item-left">
                  <Trash2 size={13} color="#f87171" />
                  <span>Delete</span>
                </div>
                <span className="explorer-context-item-shortcut">Del</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
