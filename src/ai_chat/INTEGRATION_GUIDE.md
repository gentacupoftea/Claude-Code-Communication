# Conea AIチャット機能：統合ガイド

このドキュメントでは、Conea AIチャット機能をメインアプリケーションに統合する方法について説明します。

## 1. 概要

Conea AIチャット機能は以下の主要コンポーネントで構成されています：

1. **マルチAIプロバイダー対応**
   - OpenAI, Claude, Geminiの中からユーザーが選択可能
   - 共通アダプターレイヤーでAPI間の差異を吸収
   
2. **データ可視化**
   - チャートコマンド検出とレンダリング
   - さまざまなチャートタイプ（棒グラフ、線グラフ、円グラフなど）に対応
   
3. **コンテキスト管理**
   - 長いチャットの自動要約
   - AI切替時のコンテキスト転送
   - トークン使用量の監視

## 2. 依存関係のインストール

以下のコマンドで必要なパッケージをインストールします：

```bash
npm install @anthropic-ai/sdk @google/generative-ai openai chart.js chartjs-node-canvas chartjs-plugin-datalabels
```

## 3. バックエンド統合手順

### 3.1 Express アプリケーションへの統合

```typescript
// src/main.ts or similar main entry file
import express from 'express';
import { initializeAIChat } from './ai_chat';

const app = express();
app.use(express.json());

// AIチャット機能を初期化（デフォルトパス: /api/ai）
initializeAIChat(app);

// または、カスタムパスを指定
// initializeAIChat(app, '/custom/path/ai');

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 3.2 環境変数の設定

各AIプロバイダーのAPIキーを`.env`ファイルに設定します：

```
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

## 4. フロントエンド統合手順

### 4.1 チャットコンポーネント

以下はReactでのチャットコンポーネントの実装例です：

```jsx
// ChatComponent.jsx
import React, { useState, useEffect, useRef } from 'react';
import './ChatComponent.css';

const ChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // プロバイダー一覧を取得
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch('/api/ai/providers');
        const data = await response.json();
        setProviders(data.providers);
        setActiveProvider(data.activeProvider);
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      }
    };

    fetchProviders();
  }, []);

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // メッセージ送信処理
  const sendMessage = async () => {
    if (!input.trim()) return;

    // ユーザーメッセージをUI上に追加
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // サーバーにメッセージを送信
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: input,
          providerId: activeProvider
        })
      });

      const data = await response.json();

      // AI応答をUI上に追加
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // プロバイダー変更処理
  const handleProviderChange = (e) => {
    setActiveProvider(e.target.value);
  };

  // 会話クリア処理
  const clearConversation = async () => {
    try {
      await fetch('/api/ai/clear', { method: 'POST' });
      setMessages([]);
    } catch (error) {
      console.error('Error clearing conversation:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Conea AIチャット</h2>
        <div className="provider-selector">
          <select value={activeProvider} onChange={handleProviderChange}>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <button onClick={clearConversation}>会話をクリア</button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-content" dangerouslySetInnerHTML={{ __html: message.content }} />
          </div>
        ))}
        {isLoading && (
          <div className="message assistant-message">
            <div className="loading-indicator">...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="メッセージを入力..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading}>
          送信
        </button>
      </div>
    </div>
  );
};

export default ChatComponent;
```

### 4.2 CSSの例

```css
/* ChatComponent.css */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  width: 800px;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #eee;
}

.chat-header h2 {
  margin: 0;
  font-size: 18px;
}

.provider-selector {
  display: flex;
  gap: 10px;
}

.chat-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f9f9f9;
}

.message {
  margin-bottom: 15px;
  padding: 10px 15px;
  border-radius: 18px;
  max-width: 80%;
}

.user-message {
  align-self: flex-end;
  margin-left: auto;
  background-color: #0084ff;
  color: white;
}

.assistant-message {
  align-self: flex-start;
  background-color: #e5e5ea;
  color: black;
}

.message-content {
  word-break: break-word;
}

.message-content img {
  max-width: 100%;
  border-radius: 4px;
  margin: 10px 0;
}

.chat-input {
  display: flex;
  padding: 10px;
  background-color: #f5f5f5;
  border-top: 1px solid #eee;
}

.chat-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  outline: none;
}

.chat-input button {
  margin-left: 10px;
  padding: 10px 20px;
  background-color: #0084ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.chat-input button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.loading-indicator {
  font-size: 24px;
  text-align: center;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; }
  100% { opacity: 0.5; }
}
```

## 5. チャート機能の使用方法

AIに以下の形式でチャート生成を指示できます：

```
以下のデータを棒グラフにしてください：
カテゴリ: 食品, 衣類, 電化製品, 書籍, 家具
売上: 1200, 800, 1500, 400, 700
```

AIは以下のようなチャートコマンドを応答に含めます：

````
チャートを生成しました：

```chart
{
  "type": "bar",
  "title": "カテゴリ別売上",
  "data": {
    "labels": ["食品", "衣類", "電化製品", "書籍", "家具"],
    "datasets": [{
      "label": "売上",
      "data": [1200, 800, 1500, 400, 700],
      "backgroundColor": "rgba(54, 162, 235, 0.5)"
    }]
  }
}
```
````

このコマンドはフロントエンドで画像として表示されます。

## 6. トラブルシューティング

### 6.1 APIキーの問題

各AIプロバイダーのAPIキーが正しく設定されていることを確認してください。APIキーが無効な場合、対応するプロバイダーを選択するとエラーが発生します。

### 6.2 チャート生成の問題

チャート生成に問題がある場合は以下を確認してください：

- Node.jsサーバーに必要なCanvas依存関係がインストールされているか
- チャートデータが正しいJSON形式であるか

Ubuntuサーバーでは以下のライブラリが必要になることがあります：

```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### 6.3 メモリ使用量の問題

長時間の使用でメモリ使用量が増加する場合、以下を検討してください：

- 自動要約の閾値を下げる
- 定期的にチャートキャッシュをクリアする

## 7. カスタマイズ

### 7.1 新しいAIプロバイダーの追加

新しいAIプロバイダーを追加するには、`AIProvider`インターフェースを実装する新しいアダプタークラスを作成します：

```typescript
// src/ai_chat/services/ai/custom-adapter.ts
import { AIProvider, AIResponse, CompletionOptions } from './adapter';

export class CustomAdapter implements AIProvider {
  id = 'custom-provider';
  name = 'Custom AI Provider';
  
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse> {
    // カスタムAI APIの実装
    // ...
    
    return {
      text: 'AIからの応答',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }
  
  getTokenCount(text: string): number {
    // トークン数計算ロジック
    return text.length / 4;
  }
  
  getMaxTokens(): number {
    return 16000;
  }
}
```

そして、`AIProviderManager`クラスに新しいプロバイダーを登録します：

```typescript
// src/ai_chat/services/ai/provider-manager.ts
import { CustomAdapter } from './custom-adapter';

// コンストラクタ内
const customAdapter = new CustomAdapter();
this.providers.set(customAdapter.id, customAdapter);
```

### 7.2 チャート種類の拡張

新しいチャートタイプのサポートを追加するには、`ChartProcessor`クラスの`generateExampleChartCode`メソッドに例を追加します。

## 8. セキュリティ上の考慮事項

- APIキーは環境変数として管理し、ソースコードに直接記述しないでください
- フロントエンドからのユーザー入力は適切にバリデーションを行ってください
- チャート生成コマンドは悪意あるJSONを含む可能性があるため、適切に検証してください

## 9. パフォーマンス最適化

- チャート画像をキャッシュして、同一データの再生成を避ける
- 長い会話履歴を定期的に要約して、トークン使用量を削減する
- ページロード時に過去の会話履歴をAPIから一度に取得せず、必要に応じて取得する

---

この統合ガイドについてのご質問や問題がある場合は、開発チームにお問い合わせください。