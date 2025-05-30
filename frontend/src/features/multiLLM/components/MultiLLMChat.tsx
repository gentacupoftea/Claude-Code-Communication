import React, { useState, useRef, useEffect } from 'react';
import { useMultiLLM } from './MultiLLMProvider';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ThinkingProcess } from './ThinkingProcess';
import { WorkerResponses } from './WorkerResponses';
import './MultiLLMChat.css';

export function MultiLLMChat() {
  const { 
    messages, 
    responses, 
    isLoading, 
    error, 
    sendMessage,
    clearChat 
  } = useMultiLLM();
  
  const [showThinking, setShowThinking] = useState(true);
  const [showWorkerDetails, setShowWorkerDetails] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 新しいメッセージが追加されたらスクロール
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="multi-llm-chat">
      <div className="chat-header">
        <h2>Conea AI アシスタント</h2>
        <div className="chat-controls">
          <label>
            <input
              type="checkbox"
              checked={showThinking}
              onChange={(e) => setShowThinking(e.target.checked)}
            />
            思考過程を表示
          </label>
          <label>
            <input
              type="checkbox"
              checked={showWorkerDetails}
              onChange={(e) => setShowWorkerDetails(e.target.checked)}
            />
            Worker詳細を表示
          </label>
          <button onClick={clearChat} className="clear-button">
            チャットをクリア
          </button>
        </div>
      </div>

      <div className="chat-container" ref={chatContainerRef}>
        <MessageList 
          messages={messages} 
          showThinking={showThinking}
        />
        
        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>AI が分析中...</span>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            エラー: {error}
          </div>
        )}
      </div>

      {showWorkerDetails && responses.length > 0 && (
        <WorkerResponses responses={responses} />
      )}

      <MessageInput 
        onSendMessage={sendMessage}
        disabled={isLoading}
      />
    </div>
  );
}