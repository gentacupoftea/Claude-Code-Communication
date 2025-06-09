/**
 * Chat Input Component
 * メッセージ入力用のコンポーネント
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useChat, useLLMStore } from '../../store/llmStore';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ChatInputProps {
  className?: string;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  className = '',
  placeholder = 'メッセージを入力してください...',
  maxLength = 2000,
  autoFocus = false,
  disabled = false,
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { sendMessage, isGenerating } = useChat();
  const selectedWorker = useLLMStore((state) => state.selectedWorker);
  const selectedModel = useLLMStore((state) => state.selectedModel);
  const error = useLLMStore((state) => state.error);

  // オートフォーカス
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // テキストエリアの高さを自動調整
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = async () => {
    if (!message.trim() || isGenerating || !selectedWorker || !selectedModel) {
      return;
    }

    const messageToSend = message.trim();
    setMessage('');
    
    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isSubmitDisabled = !message.trim() || isGenerating || !selectedWorker || !selectedModel || disabled;

  return (
    <div className={`chat-input border-t bg-white p-4 ${className}`}>
      {/* エラー表示 */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 必要な設定が未完了の場合の警告 */}
      {(!selectedWorker || !selectedModel) && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
          💡 チャットを開始するには、ワーカーとモデルを選択してください。
        </div>
      )}

      <div className="flex space-x-3">
        {/* メッセージ入力エリア */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled || isGenerating}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed min-h-[2.5rem] max-h-32"
            rows={1}
          />
          
          {/* 文字数カウンター */}
          <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
            <span>
              Shift+Enterで改行、Enterで送信
            </span>
            <span className={message.length > maxLength * 0.9 ? 'text-red-500' : ''}>
              {message.length}/{maxLength}
            </span>
          </div>
        </div>

        {/* 送信ボタン */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          className="self-end bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center space-x-2 disabled:cursor-not-allowed min-w-[80px] justify-center"
          aria-label="メッセージを送信"
        >
          {isGenerating ? (
            <LoadingSpinner size="small" color="white" />
          ) : (
            <>
              <span>送信</span>
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* ステータス表示 */}
      {selectedWorker && selectedModel && (
        <div className="mt-2 text-xs text-gray-500">
          使用中: {selectedWorker} / {selectedModel}
        </div>
      )}
    </div>
  );
};

// 便利なプリセット
export const SimpleChatInput: React.FC<{ className?: string }> = ({ className }) => (
  <ChatInput 
    className={className}
    autoFocus={true}
  />
);

export const CompactChatInput: React.FC<{ className?: string }> = ({ className }) => (
  <ChatInput 
    className={className}
    placeholder="質問を入力..."
    maxLength={500}
  />
);

export default ChatInput;