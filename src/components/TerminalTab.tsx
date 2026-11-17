import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalTabProps {
  sessionId: string;
  cwd?: string;
}

export const TerminalTab: React.FC<TerminalTabProps> = ({ sessionId, cwd }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      theme: {
        background: '#121316',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        selectionBackground: 'rgba(96, 165, 250, 0.3)',
        black: '#121316',
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
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    // Send input from user to PTY
    const onDataDisposable = term.onData((data) => {
      window.electronAPI?.terminalWrite(sessionId, data);
    });

    // Receive data from PTY
    const removeDataListener = window.electronAPI?.onTerminalData(
      sessionId,
      (data) => {
        term.write(data);
      }
    );

    const removeExitListener = window.electronAPI?.onTerminalExit(
      sessionId,
      ({ exitCode }) => {
        term.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
      }
    );

    // Create PTY process
    window.electronAPI?.terminalCreate(sessionId, cwd).then(() => {
      fitAddon.fit();
      if (term.cols && term.rows) {
        window.electronAPI?.terminalResize(sessionId, term.cols, term.rows);
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (term.cols && term.rows) {
          window.electronAPI?.terminalResize(sessionId, term.cols, term.rows);
        }
      } catch {}
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(terminalRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      onDataDisposable.dispose();
      removeDataListener?.();
      removeExitListener?.();
      window.electronAPI?.terminalKill(sessionId);
      term.dispose();
    };
  }, [sessionId, cwd]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#121316',
        padding: '8px 12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      ref={terminalRef}
    />
  );
};
