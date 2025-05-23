/**
 * Slack統合サービス - スレッド追跡機能付き
 * @coneaメンションを検出し、スレッド内で継続的な会話を管理
 */

const { WebClient } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const EventEmitter = require('events');

class SlackThreadManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.client = new WebClient(config.botToken);
    this.activeThreads = new Map();
    this.orchestrator = null; // 後で注入
    
    // Conea Bot ID（実際は環境変数から取得）
    this.CONEA_BOT_ID = process.env.SLACK_BOT_ID || 'U123456789';
    
    // イベントアダプター初期化
    this.events = createEventAdapter(config.signingSecret);
    this.setupEventHandlers();
  }

  /**
   * Orchestratorを設定
   */
  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * イベントハンドラーのセットアップ
   */
  setupEventHandlers() {
    // メッセージイベント
    this.events.on('message', async (event) => {
      await this.handleMessage(event);
    });

    // アプリメンション
    this.events.on('app_mention', async (event) => {
      await this.handleAppMention(event);
    });

    // スラッシュコマンド
    this.events.on('slash_command', async (event) => {
      await this.handleSlashCommand(event);
    });
  }

  /**
   * メッセージハンドリング
   */
  async handleMessage(event) {
    try {
      // ボット自身のメッセージは無視
      if (event.bot_id) return;

      // @coneaメンションの検出
      if (this.isConeaMention(event.text)) {
        await this.startThread(event);
      }
      
      // 既存スレッドの返信を検出
      else if (event.thread_ts && this.activeThreads.has(event.thread_ts)) {
        await this.continueConversation(event);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      await this.sendErrorMessage(event.channel, event.thread_ts);
    }
  }

  /**
   * アプリメンションハンドリング
   */
  async handleAppMention(event) {
    await this.startThread(event);
  }

  /**
   * @coneaメンションの検出
   */
  isConeaMention(text) {
    return text && (
      text.includes(`<@${this.CONEA_BOT_ID}>`) || 
      text.toLowerCase().includes('@conea')
    );
  }

  /**
   * 新しいスレッドを開始
   */
  async startThread(event) {
    const threadTs = event.thread_ts || event.ts;
    
    // スレッドコンテキストを作成
    const context = {
      channel: event.channel,
      user: event.user,
      startedAt: new Date(),
      messages: [],
      metadata: {}
    };
    
    this.activeThreads.set(threadTs, context);
    
    // 初回メッセージを処理
    await this.processMessage(event, context, true);
  }

  /**
   * 既存スレッドでの会話を継続
   */
  async continueConversation(event) {
    const context = this.activeThreads.get(event.thread_ts);
    if (!context) return;
    
    // メッセージ履歴に追加
    context.messages.push({
      user: event.user,
      text: event.text,
      timestamp: event.ts
    });
    
    await this.processMessage(event, context, false);
  }

  /**
   * メッセージを処理してOrchestratorに送信
   */
  async processMessage(event, context, isFirstMessage = false) {
    // タイピングインジケーターを表示
    await this.showTypingIndicator(event.channel);
    
    // ユーザー情報を取得
    const userInfo = await this.getUserInfo(event.user);
    
    // Orchestratorに処理を依頼
    const response = await this.orchestrator.process_user_request(
      event.text,
      event.user,
      {
        channel: event.channel,
        thread_ts: event.thread_ts || event.ts,
        user_name: userInfo.real_name || userInfo.name,
        is_first_message: isFirstMessage,
        conversation_history: context.messages
      }
    );
    
    // 応答を送信
    await this.sendResponse(event, response);
  }

  /**
   * 応答をSlackに送信
   */
  async sendResponse(event, response) {
    const threadTs = event.thread_ts || event.ts;
    
    try {
      // テキスト応答
      if (response.text) {
        await this.client.chat.postMessage({
          channel: event.channel,
          thread_ts: threadTs,
          text: response.text,
          blocks: this.createResponseBlocks(response)
        });
      }
      
      // 画像がある場合
      if (response.images && response.images.length > 0) {
        for (const image of response.images) {
          await this.uploadImage(event.channel, threadTs, image);
        }
      }
      
      // ファイルがある場合
      if (response.files && response.files.length > 0) {
        for (const file of response.files) {
          await this.uploadFile(event.channel, threadTs, file);
        }
      }
      
      // Artifactsがある場合
      if (response.artifacts && response.artifacts.length > 0) {
        await this.handleArtifacts(event.channel, threadTs, response.artifacts);
      }
      
    } catch (error) {
      console.error('Failed to send response:', error);
      await this.sendErrorMessage(event.channel, threadTs);
    }
  }

  /**
   * レスポンスブロックを作成
   */
  createResponseBlocks(response) {
    const blocks = [];
    
    // メインテキスト
    if (response.text) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: response.text
        }
      });
    }
    
    // タスク情報
    if (response.task_info) {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*処理時間:* ${response.task_info.duration}ms | *使用LLM:* ${response.task_info.llm_used}`
          }
        ]
      });
    }
    
    // アクションボタン
    if (response.actions) {
      blocks.push({
        type: "actions",
        elements: response.actions.map(action => ({
          type: "button",
          text: {
            type: "plain_text",
            text: action.label
          },
          action_id: action.id,
          value: action.value
        }))
      });
    }
    
    return blocks;
  }

  /**
   * 画像をアップロード
   */
  async uploadImage(channel, threadTs, image) {
    try {
      await this.client.files.upload({
        channels: channel,
        thread_ts: threadTs,
        file: image.buffer || image.url,
        filename: image.filename || `generated_${Date.now()}.png`,
        title: image.title || 'Generated Image',
        initial_comment: image.description
      });
    } catch (error) {
      console.error('Image upload failed:', error);
    }
  }

  /**
   * ファイルをアップロード
   */
  async uploadFile(channel, threadTs, file) {
    try {
      await this.client.files.upload({
        channels: channel,
        thread_ts: threadTs,
        content: file.content,
        filename: file.filename,
        filetype: file.type || 'text',
        title: file.title
      });
    } catch (error) {
      console.error('File upload failed:', error);
    }
  }

  /**
   * Artifactsの処理
   */
  async handleArtifacts(channel, threadTs, artifacts) {
    for (const artifact of artifacts) {
      if (artifact.type === 'markdown') {
        await this.uploadFile(channel, threadTs, {
          content: artifact.content,
          filename: `${artifact.name || 'artifact'}.md`,
          title: artifact.title || 'Markdown Document'
        });
      } else if (artifact.type === 'html') {
        await this.uploadFile(channel, threadTs, {
          content: artifact.content,
          filename: `${artifact.name || 'artifact'}.html`,
          title: artifact.title || 'HTML Document',
          type: 'html'
        });
      }
    }
  }

  /**
   * タイピングインジケーターを表示
   */
  async showTypingIndicator(channel) {
    // Slack APIにはタイピングインジケーターがないため、
    // リアクションで代替
    return true;
  }

  /**
   * ユーザー情報を取得
   */
  async getUserInfo(userId) {
    try {
      const result = await this.client.users.info({ user: userId });
      return result.user;
    } catch (error) {
      console.error('Failed to get user info:', error);
      return { name: 'Unknown User' };
    }
  }

  /**
   * エラーメッセージを送信
   */
  async sendErrorMessage(channel, threadTs) {
    try {
      await this.client.chat.postMessage({
        channel: channel,
        thread_ts: threadTs,
        text: "申し訳ございません。エラーが発生しました。もう一度お試しください。",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "⚠️ *エラーが発生しました*\n処理中にエラーが発生しました。もう一度お試しください。"
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send error message:', error);
    }
  }

  /**
   * スレッドのクリーンアップ（古いスレッドを削除）
   */
  cleanupOldThreads() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24時間
    
    for (const [threadTs, context] of this.activeThreads) {
      if (now - context.startedAt > maxAge) {
        this.activeThreads.delete(threadTs);
      }
    }
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return {
      activeThreads: this.activeThreads.size,
      totalMessages: Array.from(this.activeThreads.values())
        .reduce((sum, ctx) => sum + ctx.messages.length, 0)
    };
  }

  /**
   * サービスを開始
   */
  async start() {
    // イベントリスナーを開始
    await this.events.start(this.config.port || 3000);
    
    // 定期的なクリーンアップ
    setInterval(() => this.cleanupOldThreads(), 60 * 60 * 1000); // 1時間ごと
    
    console.log('✅ Slack integration started');
  }
}

module.exports = SlackThreadManager;