/**
 * 簡易版 Firebase Chat Service（デバッグ用）
 * ローカルストレージを使用してメッセージを保存
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  userId?: string;
  status?: 'sending' | 'sent' | 'error';
}

export interface ThinkingUpdate {
  type: { icon: string; label: string };
  stage: string;
  steps?: Array<{
    description: string;
    detail?: string;
    timestamp: Date;
  }>;
}

class SimpleChatService {
  private messageCallbacks: Map<string, (message: ChatMessage) => void> = new Map();
  private thinkingCallbacks: Map<string, (update: ThinkingUpdate) => void> = new Map();
  private userId: string;

  constructor() {
    this.userId = localStorage.getItem('userId') || this.generateId();
    localStorage.setItem('userId', this.userId);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * メッセージを送信
   */
  async sendMessage(content: string, context: any = {}): Promise<string> {
    const messageId = this.generateId();
    const roomId = this.getRoomId(context);
    
    // ユーザーメッセージを保存
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      userId: this.userId,
      timestamp: new Date(),
      status: 'sent'
    };
    
    this.saveMessage(roomId, userMessage);
    
    // AI応答をシミュレート
    setTimeout(() => {
      this.simulateAIResponse(roomId, messageId, content);
    }, 500);

    return messageId;
  }

  /**
   * メッセージの監視を開始
   */
  subscribeToMessages(
    context: any,
    onMessage: (message: ChatMessage) => void,
    onInitialLoad?: (messages: ChatMessage[]) => void,
    limit: number = 50
  ): () => void {
    const roomId = this.getRoomId(context);
    const callbackId = this.generateId();
    
    // 初回ロード
    if (onInitialLoad) {
      const messages = this.getMessages(roomId, limit);
      onInitialLoad(messages);
    }
    
    // コールバックを登録
    this.messageCallbacks.set(callbackId, onMessage);
    
    return () => {
      this.messageCallbacks.delete(callbackId);
    };
  }

  /**
   * 思考プロセスの監視
   */
  subscribeToThinking(
    messageId: string,
    onUpdate: (update: ThinkingUpdate) => void
  ): () => void {
    const callbackId = this.generateId();
    this.thinkingCallbacks.set(callbackId, onUpdate);
    
    return () => {
      this.thinkingCallbacks.delete(callbackId);
    };
  }

  /**
   * チャット履歴を取得
   */
  async getChatHistory(context: any, limit: number = 50): Promise<ChatMessage[]> {
    const roomId = this.getRoomId(context);
    return this.getMessages(roomId, limit);
  }

  /**
   * AI応答のシミュレーション
   */
  private async simulateAIResponse(roomId: string, originalMessageId: string, userContent: string) {
    const responseId = this.generateId();
    
    // 思考プロセスを更新
    this.notifyThinking({
      type: { icon: '🤔', label: '分析中' },
      stage: 'リクエストを理解しています',
      steps: [{
        description: 'ユーザーの質問を分析中...',
        detail: `入力: ${userContent.slice(0, 50)}...`,
        timestamp: new Date()
      }]
    });

    // デモ用の応答を生成
    const responses: { [key: string]: string } = {
      'hello': 'こんにちは！MultiLLM Systemのリアルタイムチャットへようこそ。何かお手伝いできることがありますか？',
      'help': '以下のようなことができます：\n\n1. **タスク管理**: プロジェクトやタスクの進捗管理\n2. **コード生成**: 様々なプログラミング言語でのコード作成\n3. **分析**: データ分析やパフォーマンス評価\n4. **質問応答**: 技術的な質問への回答\n\n何について知りたいですか？',
      'code': '```javascript\n// サンプルコード\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10)); // 55\n```',
      'test': 'これはテストメッセージです。チャット機能が正常に動作しています！',
      'default': `「${userContent}」についてお答えします。\n\nこれはデモ応答です。実際のシステムでは、MultiLLM Orchestratorが適切なWorkerを選択し、より詳細で有用な回答を生成します。`
    };

    const responseKey = Object.keys(responses).find(key => 
      userContent.toLowerCase().includes(key)
    ) || 'default';

    const response = responses[responseKey];

    // 段階的に応答を生成（ストリーミング効果）
    const chunks = this.splitIntoChunks(response, 20);
    let accumulatedContent = '';

    for (let i = 0; i < chunks.length; i++) {
      accumulatedContent += chunks[i];
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // メッセージを保存・通知
      const message: ChatMessage = {
        id: responseId,
        role: 'assistant',
        content: accumulatedContent,
        timestamp: new Date(),
        status: i === chunks.length - 1 ? 'sent' : 'sending'
      };
      
      this.saveMessage(roomId, message);
      this.notifyNewMessage(message);
      
      // 思考プロセスを更新
      if (i % 5 === 0) {
        this.notifyThinking({
          type: { icon: '🔍', label: '処理中' },
          stage: '応答生成',
          steps: [{
            description: `生成中... ${Math.round((i / chunks.length) * 100)}%`,
            timestamp: new Date()
          }]
        });
      }
    }
    
    // 完了
    this.notifyThinking({
      type: { icon: '✅', label: '完了' },
      stage: '応答完了',
      steps: []
    });
  }

  /**
   * メッセージを保存
   */
  private saveMessage(roomId: string, message: ChatMessage) {
    const key = `chat_${roomId}`;
    const messages = this.getMessages(roomId);
    
    // 既存のメッセージがある場合は更新
    const existingIndex = messages.findIndex(m => m.id === message.id);
    if (existingIndex >= 0) {
      messages[existingIndex] = message;
    } else {
      messages.push(message);
    }
    
    // 最新100件のみ保持
    const recentMessages = messages.slice(-100);
    localStorage.setItem(key, JSON.stringify(recentMessages));
  }

  /**
   * メッセージを取得
   */
  private getMessages(roomId: string, limit?: number): ChatMessage[] {
    const key = `chat_${roomId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return [];
    
    try {
      const messages = JSON.parse(stored) as ChatMessage[];
      // timestampをDateオブジェクトに変換
      const parsed = messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      
      return limit ? parsed.slice(-limit) : parsed;
    } catch (error) {
      console.error('Failed to parse messages:', error);
      return [];
    }
  }

  /**
   * ルームIDを生成
   */
  private getRoomId(context: any): string {
    if (context.taskId) {
      return `task-${context.taskId}`;
    } else if (context.projectId) {
      return `project-${context.projectId}`;
    }
    return 'general';
  }

  /**
   * テキストをチャンクに分割
   */
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (let i = 0; i < text.length; i++) {
      currentChunk += text[i];
      
      if (currentChunk.length >= chunkSize || i === text.length - 1) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
    
    return chunks;
  }

  /**
   * 新しいメッセージを通知
   */
  private notifyNewMessage(message: ChatMessage) {
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Message callback error:', error);
      }
    });
  }

  /**
   * 思考プロセスを通知
   */
  private notifyThinking(update: ThinkingUpdate) {
    this.thinkingCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Thinking callback error:', error);
      }
    });
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    this.messageCallbacks.clear();
    this.thinkingCallbacks.clear();
  }
}

export default new SimpleChatService();