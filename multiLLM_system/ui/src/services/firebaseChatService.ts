/**
 * Firebase Realtime Database を使用したチャットサービス
 * WebSocketの代替として使用
 */

import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  push, 
  set,
  onValue, 
  serverTimestamp,
  query,
  orderByChild,
  limitToLast,
  off,
  Database,
  DatabaseReference
} from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDfKoxGM8u9rwE8PHNTiwSogq_iYOWVjMQ",
  authDomain: "multillm-demo-2025.firebaseapp.com",
  projectId: "multillm-demo-2025",
  storageBucket: "multillm-demo-2025.firebasestorage.app",
  messagingSenderId: "990431574936",
  appId: "1:990431574936:web:0fa92fb2e8a693b037b6e5",
  databaseURL: "https://multillm-demo-2025-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
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

class FirebaseChatService {
  private messagesRef: DatabaseReference;
  private thinkingRef: DatabaseReference;
  private activeListeners: Map<string, any> = new Map();
  private userId: string;

  constructor() {
    this.messagesRef = ref(database, 'chats');
    this.thinkingRef = ref(database, 'thinking');
    this.userId = localStorage.getItem('userId') || uuidv4();
    localStorage.setItem('userId', this.userId);
  }

  /**
   * メッセージを送信
   */
  async sendMessage(content: string, context: any = {}): Promise<string> {
    const messageId = uuidv4();
    const roomId = this.getRoomId(context);
    const messageRef = ref(database, `chats/${roomId}/messages`);

    // ユーザーメッセージを保存
    await push(messageRef, {
      id: messageId,
      role: 'user',
      content,
      userId: this.userId,
      timestamp: serverTimestamp(),
      status: 'sent'
    });

    // AI応答をシミュレート（実際の実装では、Cloud Functionsを呼び出す）
    setTimeout(() => {
      this.simulateAIResponse(roomId, content);
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
    const messagesRef = ref(database, `chats/${roomId}/messages`);
    const messagesQuery = query(
      messagesRef,
      orderByChild('timestamp'),
      limitToLast(limit)
    );

    let isInitialLoad = true;
    const processedMessageIds = new Set<string>();

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const messages: ChatMessage[] = [];
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          if (data && data.id) {
            messages.push({
              ...data,
              timestamp: new Date(data.timestamp || Date.now())
            });
          }
        });
      }

      if (isInitialLoad) {
        // 初回ロード時は全メッセージを返す
        isInitialLoad = false;
        if (onInitialLoad) {
          onInitialLoad(messages);
        }
        messages.forEach(msg => processedMessageIds.add(msg.id));
      } else {
        // 以降は新しいメッセージのみを通知
        messages.forEach(msg => {
          if (!processedMessageIds.has(msg.id)) {
            processedMessageIds.add(msg.id);
            onMessage(msg);
          }
        });
      }
    });

    // リスナーを保存
    const listenerId = `messages-${roomId}`;
    this.activeListeners.set(listenerId, messagesRef);

    return () => {
      off(messagesRef);
      this.activeListeners.delete(listenerId);
    };
  }

  /**
   * 思考プロセスの監視
   */
  subscribeToThinking(
    messageId: string,
    onUpdate: (update: ThinkingUpdate) => void
  ): () => void {
    const thinkingRef = ref(database, `thinking/${messageId}`);

    const unsubscribe = onValue(thinkingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        onUpdate(data);
      }
    });

    const listenerId = `thinking-${messageId}`;
    this.activeListeners.set(listenerId, thinkingRef);

    return () => {
      off(thinkingRef);
      this.activeListeners.delete(listenerId);
    };
  }

  /**
   * チャット履歴を取得
   */
  async getChatHistory(context: any, limit: number = 50): Promise<ChatMessage[]> {
    const roomId = this.getRoomId(context);
    const messagesRef = ref(database, `chats/${roomId}/messages`);
    const messagesQuery = query(
      messagesRef,
      orderByChild('timestamp'),
      limitToLast(limit)
    );

    return new Promise((resolve) => {
      onValue(messagesQuery, (snapshot) => {
        const messages: ChatMessage[] = [];
        
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data && data.id) {
              messages.push({
                ...data,
                timestamp: new Date(data.timestamp || Date.now())
              });
            }
          });
        }
        
        resolve(messages);
      }, { onlyOnce: true });
    });
  }

  /**
   * AI応答のシミュレーション
   */
  private async simulateAIResponse(roomId: string, userContent: string) {
    const responseId = uuidv4();
    const messageRef = ref(database, `chats/${roomId}/messages`);
    const thinkingRef = ref(database, `thinking/${responseId}`);

    // 思考プロセスを更新
    await push(thinkingRef, {
      type: { icon: '🤔', label: '分析中' },
      stage: 'リクエストを理解しています',
      steps: [{
        description: 'ユーザーの質問を分析中...',
        timestamp: new Date().toISOString()
      }]
    });

    // デモ用の応答を生成
    const responses: { [key: string]: string } = {
      'hello': 'こんにちは！MultiLLM Systemのリアルタイムチャットへようこそ。何かお手伝いできることがありますか？',
      'help': '以下のようなことができます：\n\n1. **タスク管理**: プロジェクトやタスクの進捗管理\n2. **コード生成**: 様々なプログラミング言語でのコード作成\n3. **分析**: データ分析やパフォーマンス評価\n4. **質問応答**: 技術的な質問への回答\n\n何について知りたいですか？',
      'code': '```javascript\n// サンプルコード\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10)); // 55\n```',
      'default': `「${userContent}」についてお答えします。\n\nこれはデモ応答です。実際のシステムでは、MultiLLM Orchestratorが適切なWorkerを選択し、より詳細で有用な回答を生成します。`
    };

    const responseKey = Object.keys(responses).find(key => 
      userContent.toLowerCase().includes(key)
    ) || 'default';

    const response = responses[responseKey];

    // 最初にメッセージを作成
    const messageId = await push(messageRef, {
      id: responseId,
      role: 'assistant',
      content: '',
      timestamp: serverTimestamp(),
      status: 'sending'
    });

    // 段階的に応答を生成（ストリーミング効果）
    const chunks = this.splitIntoChunks(response, 20);
    let accumulatedContent = '';

    for (let i = 0; i < chunks.length; i++) {
      accumulatedContent += chunks[i];
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // メッセージを更新（setで上書き）
      const specificMessageRef = ref(database, `chats/${roomId}/messages/${messageId.key}`);
      await set(specificMessageRef, {
        id: responseId,
        role: 'assistant',
        content: accumulatedContent,
        timestamp: serverTimestamp(),
        status: i === chunks.length - 1 ? 'sent' : 'sending'
      });
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
   * クリーンアップ
   */
  cleanup() {
    this.activeListeners.forEach((ref) => {
      off(ref);
    });
    this.activeListeners.clear();
  }
}

export default new FirebaseChatService();