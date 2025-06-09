/**
 * Chat Message Component
 * チャットメッセージを表示するコンポーネント
 */

import React from 'react';
import { ChatMessage as ChatMessageType } from '../../store/llmStore';

interface ChatMessageProps {
  message: ChatMessageType;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  className = '',
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(timestamp);
  };

  return (
    <div className={`chat-message flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 ${className}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser 
          ? 'bg-blue-600 text-white rounded-br-none' 
          : 'bg-gray-200 text-gray-900 rounded-bl-none'
      }`}>
        {/* メッセージヘッダー */}
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-medium ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}>
            {isUser ? 'You' : 'AI'}
          </span>
          <span className={`text-xs ${
            isUser ? 'text-blue-100' : 'text-gray-400'
          }`}>
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* メッセージ本文 */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>

        {/* アシスタントメッセージの場合、ワーカーとモデル情報を表示 */}
        {isAssistant && (message.worker || message.model) && (
          <div className={`mt-2 pt-2 border-t border-gray-300 text-xs text-gray-500`}>
            {message.worker && (
              <span className="mr-2">
                ⚡ {message.worker}
              </span>
            )}
            {message.model && (
              <span>
                🤖 {message.model}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// メッセージタイプ別のコンポーネント
export const UserMessage: React.FC<{ message: ChatMessageType; className?: string }> = ({
  message,
  className,
}) => {
  if (message.role !== 'user') return null;
  return <ChatMessage message={message} className={className} />;
};

export const AssistantMessage: React.FC<{ message: ChatMessageType; className?: string }> = ({
  message,
  className,
}) => {
  if (message.role !== 'assistant') return null;
  return <ChatMessage message={message} className={className} />;
};

export default ChatMessage;