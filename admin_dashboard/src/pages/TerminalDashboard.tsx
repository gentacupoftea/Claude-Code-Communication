import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface TerminalSession {
  id: string;
  userId: string;
  created: string;
  lastActivity: string;
  cwd: string;
  commandCount: number;
}

interface CommandHistory {
  timestamp: string;
  sessionId: string;
  userId: string;
  command: string;
  output: string;
  error: string;
  exitCode: number;
  duration: number;
}

const TerminalDashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Socket.IO接続
    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('terminal_activity', (data) => {
      console.log('Terminal activity:', data);
      setTerminalOutput(prev => [...prev, 
        `$ ${data.command}`,
        data.output || data.error || 'Command completed',
        `[Exit code: ${data.exitCode}]`,
        ''
      ]);
      fetchHistory();
    });

    // 初期データ取得
    fetchSessions();
    fetchHistory();

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalOutput]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/terminal/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/terminal/history?limit=20');
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const executeCommand = async () => {
    if (!currentCommand.trim() || isExecuting) return;

    setIsExecuting(true);
    setTerminalOutput(prev => [...prev, `$ ${currentCommand}`, 'Executing...']);

    try {
      const response = await fetch('http://localhost:8000/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: currentCommand,
          sessionId: currentSession,
          userId: 'mourigenta'
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTerminalOutput(prev => {
          const newOutput = [...prev];
          newOutput[newOutput.length - 1] = result.output || 'Command completed successfully';
          return [...newOutput, `[Exit code: ${result.exitCode}] [Duration: ${result.duration}ms]`, ''];
        });

        if (!currentSession) {
          setCurrentSession(result.sessionId);
        }
      } else {
        setTerminalOutput(prev => {
          const newOutput = [...prev];
          newOutput[newOutput.length - 1] = `Error: ${result.error || result.reason || 'Command failed'}`;
          return [...newOutput, ''];
        });
      }
    } catch (error) {
      setTerminalOutput(prev => {
        const newOutput = [...prev];
        newOutput[newOutput.length - 1] = `Network error: ${error}`;
        return [...newOutput, ''];
      });
    } finally {
      setIsExecuting(false);
      setCurrentCommand('');
      fetchSessions();
      fetchHistory();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`http://localhost:8000/api/terminal/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      fetchSessions();
      if (currentSession === sessionId) {
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const getExitCodeColor = (exitCode: number) => {
    return exitCode === 0 ? 'text-green-600' : 'text-red-600';
  };

  const clearTerminal = () => {
    setTerminalOutput([]);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          💻 Terminal Dashboard
        </h1>
        <div className="flex space-x-3">
          <button
            onClick={clearTerminal}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
          >
            Clear Terminal
          </button>
          <button
            onClick={fetchSessions}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メインターミナル */}
        <div className="lg:col-span-2 space-y-4">
          {/* ターミナル出力 */}
          <div className="bg-black rounded-lg p-4 font-mono text-sm">
            <div className="text-green-400 mb-2">
              Conea Terminal - Session: {currentSession || 'New Session'}
            </div>
            <div className="text-white space-y-1 h-96 overflow-y-auto">
              {terminalOutput.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* コマンド入力 */}
          <div className="bg-white rounded-lg shadow border p-4">
            <div className="flex space-x-2">
              <span className="text-green-600 font-mono">$</span>
              <input
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter command..."
                disabled={isExecuting}
                className="flex-1 font-mono bg-transparent border-none outline-none text-gray-800"
              />
              <button
                onClick={executeCommand}
                disabled={isExecuting || !currentCommand.trim()}
                className="bg-green-500 text-white px-4 py-1 rounded hover:bg-green-600 disabled:bg-gray-300"
              >
                {isExecuting ? 'Running...' : 'Execute'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Allowed commands: git, npm, node, python, docker, ls, cat, grep, find, echo, cd, pwd, mkdir, touch, cp, mv, rm
            </div>
          </div>
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          {/* アクティブセッション */}
          <div className="bg-white rounded-lg shadow border p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              🔄 Active Sessions ({sessions.length})
            </h3>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">No active sessions</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      currentSession === session.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setCurrentSession(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xs text-gray-600">
                          {session.id.substring(0, 8)}...
                        </div>
                        <div className="text-sm text-gray-800">
                          Commands: {session.commandCount}
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.cwd}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* コマンド履歴 */}
          <div className="bg-white rounded-lg shadow border p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              📜 Recent Commands
            </h3>
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm">No command history</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.slice().reverse().map((cmd, index) => (
                  <div key={index} className="border-b border-gray-100 pb-2">
                    <div className="font-mono text-xs text-gray-600 mb-1">
                      {cmd.command}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={getExitCodeColor(cmd.exitCode)}>
                        Exit: {cmd.exitCode}
                      </span>
                      <span className="text-gray-500">
                        {cmd.duration}ms
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(cmd.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* セキュリティ情報 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              🔒 Security Notice
            </h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <div>• Commands are sandboxed</div>
              <div>• 30-second timeout limit</div>
              <div>• Restricted system paths</div>
              <div>• All commands are logged</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalDashboard;