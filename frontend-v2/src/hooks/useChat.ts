/**
 * Chat Management Hook
 * Sprint 2 AI-1号機の成果物 - チャット機能専用カスタムフック
 */

import { useCallback } from 'react';
import { useLLMStore, ChatMessage } from '../store/llmStore';

/**
 * チャット機能を管理するカスタムフック
 * チャット履歴、メッセージ送信、生成状態を統合管理
 */
export const useChat = () => {
  const {
    chatHistory,
    isGenerating,
    selectedWorker,
    selectedModel,
    sendMessage: _sendMessage,
    clearChatHistory: _clearChatHistory,
    error,
  } = useLLMStore();

  // メッセージ送信（バリデーション付き）
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;
    if (!selectedWorker || !selectedModel) {
      throw new Error('ワーカーとモデルを選択してください');
    }
    if (isGenerating) {
      throw new Error('AI応答生成中です。しばらくお待ちください');
    }

    await _sendMessage(message);
  }, [_sendMessage, selectedWorker, selectedModel, isGenerating]);

  // チャット履歴クリア（確認付き）
  const clearChatHistory = useCallback(() => {
    if (chatHistory.length > 0) {
      _clearChatHistory();
    }
  }, [_clearChatHistory, chatHistory.length]);

  // 最新メッセージの取得
  const getLatestMessage = useCallback((): ChatMessage | null => {
    return chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
  }, [chatHistory]);

  // ユーザーメッセージ数の取得
  const getUserMessageCount = useCallback((): number => {
    return chatHistory.filter(msg => msg.role === 'user').length;
  }, [chatHistory]);

  // AIメッセージ数の取得
  const getAssistantMessageCount = useCallback((): number => {
    return chatHistory.filter(msg => msg.role === 'assistant').length;
  }, [chatHistory]);

  // チャット可能状態の判定
  const canSendMessage = useCallback((): boolean => {
    return !!(selectedWorker && selectedModel && !isGenerating);
  }, [selectedWorker, selectedModel, isGenerating]);

  // チャット状態の要約
  const getChatStatus = useCallback(() => {
    return {
      totalMessages: chatHistory.length,
      userMessages: getUserMessageCount(),
      assistantMessages: getAssistantMessageCount(),
      isActive: canSendMessage(),
      hasHistory: chatHistory.length > 0,
      currentWorker: selectedWorker,
      currentModel: selectedModel,
      isGenerating,
      hasError: !!error,
    };
  }, [
    chatHistory.length,
    getUserMessageCount,
    getAssistantMessageCount,
    canSendMessage,
    selectedWorker,
    selectedModel,
    isGenerating,
    error,
  ]);

  return {
    // 基本状態
    chatHistory,
    isGenerating,
    error,
    
    // アクション
    sendMessage,
    clearChatHistory,
    
    // ユーティリティ
    getLatestMessage,
    getUserMessageCount,
    getAssistantMessageCount,
    canSendMessage,
    getChatStatus,
    
    // 便利なフラグ
    hasMessages: chatHistory.length > 0,
    canChat: canSendMessage(),
    isEmpty: chatHistory.length === 0,
  };
};

export default useChat;