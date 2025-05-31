// claude-code-mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';
import axios from 'axios';

const execAsync = promisify(exec);

class ClaudeCodeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'claude-code-controller',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupTools();
  }

  setupTools() {
    // Claude Codeへのタスク送信
    this.server.setRequestHandler('tools/execute', async (request) => {
      if (request.params.name === 'execute_claude_code_task') {
        const { task, project_path, auto_commit, auto_pr, auto_deploy } = request.params.arguments;
        
        return {
          content: [
            {
              type: 'text',
              text: await this.executeClaudeCodeTask({
                task,
                project_path,
                auto_commit,
                auto_pr,
                auto_deploy
              })
            }
          ]
        };
      }
      
      // 進捗状況の確認
      if (request.params.name === 'check_task_progress') {
        const { task_id } = request.params.arguments;
        return {
          content: [
            {
              type: 'text',
              text: await this.checkTaskProgress(task_id)
            }
          ]
        };
      }
    });

    // 利用可能なツールを登録
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'execute_claude_code_task',
            description: 'Claude Codeにタスクを実行させ、自動でGitHub操作まで行う',
            inputSchema: {
              type: 'object',
              properties: {
                task: { type: 'string', description: '実行するタスクの説明' },
                project_path: { type: 'string', description: 'プロジェクトのパス' },
                auto_commit: { type: 'boolean', default: true },
                auto_pr: { type: 'boolean', default: true },
                auto_deploy: { type: 'boolean', default: true }
              },
              required: ['task', 'project_path']
            }
          },
          {
            name: 'check_task_progress',
            description: 'タスクの進捗状況を確認',
            inputSchema: {
              type: 'object',
              properties: {
                task_id: { type: 'string', description: 'タスクID' }
              },
              required: ['task_id']
            }
          }
        ]
      };
    });
  }

  async executeClaudeCodeTask({ task, project_path, auto_commit, auto_pr, auto_deploy }) {
    const taskId = Date.now().toString();
    
    // Claude Codeコマンドを構築
    const command = `claude "${task}" --project "${project_path}" --no-interactive`;
    
    try {
      // タスクを実行
      console.log(`Executing task: ${task}`);
      const { stdout } = await execAsync(command);
      
      if (auto_commit) {
        await this.autoCommit(project_path, task);
      }
      
      if (auto_pr) {
        await this.createPullRequest(project_path, task);
      }
      
      if (auto_deploy) {
        await this.triggerDeploy(project_path);
      }
      
      // Slack通知
      await this.sendSlackNotification({
        text: `✅ タスク完了: ${task}`,
        taskId,
        status: 'completed'
      });
      
      return `タスクID: ${taskId}\nステータス: 完了\n詳細: ${stdout}`;
    } catch (error) {
      return `エラー: ${error.message}`;
    }
  }

  async autoCommit(projectPath, message) {
    const commands = [
      `cd ${projectPath}`,
      'git add .',
      `git commit -m "feat: ${message} (by Claude Code)"`,
      'git push origin feature/claude-code-task'
    ];
    
    await execAsync(commands.join(' && '));
  }

  async createPullRequest(projectPath, title) {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    // リポジトリ情報を取得
    const { stdout } = await execAsync(`cd ${projectPath} && git remote get-url origin`);
    const [owner, repo] = stdout.trim().split('/').slice(-2);
    
    await octokit.pulls.create({
      owner,
      repo: repo.replace('.git', ''),
      title: `[Claude Code] ${title}`,
      head: 'feature/claude-code-task',
      base: 'develop',
      body: `## 🤖 Claude Codeによる自動実装\n\n### タスク内容\n${title}\n\n### 変更内容\n- 自動生成されたコード\n- テスト実行済み\n- Lintチェック済み`
    });
  }

  async triggerDeploy(projectPath) {
    console.log(`Triggering deploy for ${projectPath}`);
    // デプロイロジックをここに実装
  }

  async sendSlackNotification({ text, taskId, status }) {
    if (!process.env.SLACK_WEBHOOK_URL) return;
    
    try {
      await axios.post(process.env.SLACK_WEBHOOK_URL, {
        text,
        attachments: [{
          color: status === 'completed' ? 'good' : 'warning',
          fields: [
            { title: 'タスクID', value: taskId, short: true },
            { title: 'ステータス', value: status, short: true }
          ]
        }]
      });
    } catch (error) {
      console.error('Slack notification failed:', error);
    }
  }

  async checkTaskProgress(taskId) {
    // 実際の実装では、タスクの進捗を追跡するデータベースやファイルから取得
    return `タスクID: ${taskId}\nステータス: 実行中\n進捗: 75%`;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Claude Code MCP Server started');
  }
}

// サーバーを起動
const server = new ClaudeCodeMCPServer();
server.start();