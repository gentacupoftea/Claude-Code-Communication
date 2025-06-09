/**
 * Chat History Component
 * チャット履歴を表示するコンポーネント
 */

import React, { useEffect, useRef } from 'react';
import { useChat } from '../../store/llmStore';
import { ChatMessage } from './ChatMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ChatHistoryProps {
  className?: string;
  autoScroll?: boolean;
  showEmpty?: boolean;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  className = '',
  autoScroll = true,
  showEmpty = true,
}) => {
  const { chatHistory, isGenerating } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが追加されたときに自動スクロール
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, autoScroll]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className={`chat-history flex flex-col h-full ${className}`}>
      {/* チャット履歴コンテナ */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 ? (
          showEmpty && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-lg font-medium mb-2">会話を開始しましょう</h3>
              <p className="text-sm text-center">
                下のメッセージボックスに質問やリクエストを入力してください
              </p>
            </div>
          )
        ) : (
          <>
            {chatHistory.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
              />
            ))}
            
            {/* 生成中のインジケーター */}
            {isGenerating && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-200 text-gray-900 rounded-lg rounded-bl-none px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner size="small" />
                    <span className="text-sm text-gray-600">
                      AIが応答を生成中...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* 自動スクロール用の要素 */}
        <div ref={messagesEndRef} />
      </div>

      {/* スクロールトゥボトムボタン（メッセージが多い場合） */}
      {chatHistory.length > 5 && (
        <div className="flex justify-center p-2">
          <button
            onClick={scrollToBottom}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-full shadow-md transition-colors duration-200 flex items-center space-x-1"
            aria-label="最新のメッセージまでスクロール"
          >
            <span>最新</span>
            <svg 
              className="w-3 h-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

// 便利なプリセット
export const CompactChatHistory: React.FC<{ className?: string }> = ({ className }) => (
  <ChatHistory 
    className={`h-64 ${className}`} 
    autoScroll={true} 
    showEmpty={false} 
  />
);

export const FullChatHistory: React.FC<{ className?: string }> = ({ className }) => (
  <ChatHistory 
    className={`h-full ${className}`} 
    autoScroll={true} 
    showEmpty={true} 
  />
);

export default ChatHistory;