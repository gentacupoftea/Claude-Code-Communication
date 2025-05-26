import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  language: string;
}

interface GitHubActivity {
  event: string;
  action: string;
  repository: string;
  timestamp: string;
}

interface PRRequest {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  labels: string[];
}

const GitHubDashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  
  // PR作成フォーム
  const [showPRForm, setShowPRForm] = useState(false);
  const [prRequest, setPrRequest] = useState<PRRequest>({
    owner: '',
    repo: '',
    title: '',
    body: '',
    head: '',
    base: 'main',
    labels: []
  });

  useEffect(() => {
    // Socket.IO接続
    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('github_activity', (data: GitHubActivity) => {
      console.log('GitHub activity:', data);
      setActivities(prev => [data, ...prev.slice(0, 19)]);
    });

    // 初期データ取得
    fetchRepositories();
    checkGitHubConnection();

    return () => {
      newSocket.close();
    };
  }, []);

  const checkGitHubConnection = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/github/repos');
      setConnected(response.ok);
    } catch (error) {
      setConnected(false);
    }
  };

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/github/repos');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repos || []);
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPR = async () => {
    if (!prRequest.owner || !prRequest.repo || !prRequest.title || !prRequest.head) {
      alert('Owner, Repo, Title, and Head branch are required');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...prRequest,
          user_id: 'mourigenta'
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(`PR created successfully! #${result.pr.number}\n${result.pr.url}`);
        setShowPRForm(false);
        setPrRequest({
          owner: '',
          repo: '',
          title: '',
          body: '',
          head: '',
          base: 'main',
          labels: []
        });
      } else {
        alert(`Failed to create PR: ${result.error}`);
      }
    } catch (error) {
      alert('Network error while creating PR');
    }
  };

  const getLanguageColor = (language: string) => {
    const colors: { [key: string]: string } = {
      'JavaScript': 'bg-yellow-400',
      'TypeScript': 'bg-blue-400',
      'Python': 'bg-green-400',
      'Java': 'bg-red-400',
      'Go': 'bg-cyan-400',
      'Rust': 'bg-orange-400',
      'C++': 'bg-pink-400',
      'Ruby': 'bg-red-500',
      'PHP': 'bg-purple-400',
      'Swift': 'bg-orange-500',
    };
    return colors[language] || 'bg-gray-400';
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'push': return '📤';
      case 'pull_request': return '🔀';
      case 'issues': return '🐛';
      case 'release': return '🚀';
      default: return '📝';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          🐙 GitHub Dashboard
        </h1>
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm ${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          <button
            onClick={() => setShowPRForm(true)}
            disabled={!connected}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300"
          >
            Create PR
          </button>
          <button
            onClick={fetchRepositories}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {!connected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            ⚠️ GitHub Not Connected
          </h3>
          <p className="text-yellow-700">
            Please configure GITHUB_TOKEN in your environment variables to enable GitHub integration.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* リポジトリ一覧 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📁 Repositories ({repositories.length})
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading repositories...</p>
              </div>
            ) : repositories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No repositories found or GitHub not connected.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {repositories.map((repo) => (
                  <div key={repo.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">
                        {repo.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {repo.language && (
                          <span className={`px-2 py-1 rounded text-xs text-white ${getLanguageColor(repo.language)}`}>
                            {repo.language}
                          </span>
                        )}
                        {repo.private && (
                          <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                            Private
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {repo.full_name}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Updated: {new Date(repo.updated_at).toLocaleDateString()}</span>
                      <button
                        onClick={() => {
                          const [owner, repoName] = repo.full_name.split('/');
                          setPrRequest(prev => ({ ...prev, owner, repo: repoName }));
                          setShowPRForm(true);
                        }}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        Create PR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* アクティビティフィード */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow border p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              📡 Live Activity
            </h3>
            {activities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                No recent activity. Push to a repository or create a PR to see live updates.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {activities.map((activity, index) => (
                  <div key={index} className="border-b border-gray-100 pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getEventIcon(activity.event)}</span>
                      <span className="font-medium text-sm">{activity.event}</span>
                      <span className="text-xs text-gray-500">{activity.action}</span>
                    </div>
                    <div className="text-xs text-gray-600 ml-6">
                      {activity.repository}
                    </div>
                    <div className="text-xs text-gray-400 ml-6">
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Webhook情報 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              🔗 Webhook Setup
            </h3>
            <div className="text-sm text-blue-700 space-y-1">
              <div>Webhook URL:</div>
              <code className="bg-white px-2 py-1 rounded text-xs">
                http://localhost:8000/api/github/webhook
              </code>
              <div className="mt-2">Events:</div>
              <div>• push • pull_request • issues</div>
            </div>
          </div>
        </div>
      </div>

      {/* PR作成モーダル */}
      {showPRForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Pull Request</h2>
              <button
                onClick={() => setShowPRForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner *
                </label>
                <input
                  type="text"
                  value={prRequest.owner}
                  onChange={(e) => setPrRequest(prev => ({ ...prev, owner: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="username or organization"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repository *
                </label>
                <input
                  type="text"
                  value={prRequest.repo}
                  onChange={(e) => setPrRequest(prev => ({ ...prev, repo: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="repository-name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={prRequest.title}
                  onChange={(e) => setPrRequest(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Pull request title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body
                </label>
                <textarea
                  value={prRequest.body}
                  onChange={(e) => setPrRequest(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-20"
                  placeholder="Pull request description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Head Branch *
                  </label>
                  <input
                    type="text"
                    value={prRequest.head}
                    onChange={(e) => setPrRequest(prev => ({ ...prev, head: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="feature-branch"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Branch
                  </label>
                  <input
                    type="text"
                    value={prRequest.base}
                    onChange={(e) => setPrRequest(prev => ({ ...prev, base: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="main"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labels (comma-separated)
                </label>
                <input
                  type="text"
                  value={prRequest.labels.join(', ')}
                  onChange={(e) => setPrRequest(prev => ({ 
                    ...prev, 
                    labels: e.target.value.split(',').map(l => l.trim()).filter(l => l) 
                  }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="bug, feature, enhancement"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={createPR}
                className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600"
              >
                Create PR
              </button>
              <button
                onClick={() => setShowPRForm(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitHubDashboard;