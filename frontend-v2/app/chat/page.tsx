/**
 * Chat Page Component
 * Sprint 1 AI-4号機の成果物 - メインチャットページ
 */

'use client';

import React, { useEffect } from 'react';
import { useLLMStore } from '../../src/store/llmStore';
import { WorkerSelector, ModelSelector, ErrorMessage } from '../../src/components/common';
import { ChatHistory, ChatInput } from '../../src/components/chat';

export default function ChatPage() {
  const {
    workers,
    selectedWorker,
    selectedModel,
    apiHealthy,
    error,
    loadWorkers,
    checkHealth,
    clearError,
  } = useLLMStore();

  // ページ初期化時にワーカー一覧とヘルスチェックを実行
  useEffect(() => {
    const initializePage = async () => {
      await Promise.all([
        loadWorkers(),
        checkHealth(),
      ]);
    };

    initializePage();
  }, [loadWorkers, checkHealth]);

  // 定期的なヘルスチェック（30秒間隔）
  useEffect(() => {
    const interval = setInterval(() => {
      checkHealth();
    }, 30000);

    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                MultiLLM Chat
              </h1>
              <p className="text-sm text-gray-600">
                複数のAIモデルとチャットできるインターフェース
              </p>
            </div>
            
            {/* 接続ステータス */}
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                apiHealthy ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`text-sm ${
                apiHealthy ? 'text-green-600' : 'text-red-600'
              }`}>
                {apiHealthy ? 'API接続中' : 'API切断'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          
          {/* サイドバー - 設定パネル */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                AI設定
              </h2>
              
              {/* エラー表示 */}
              {error && (
                <ErrorMessage
                  message={error}
                  onClose={clearError}
                  closable={true}
                  className="mb-4"
                />
              )}

              {/* ワーカー選択 */}
              <div className="mb-4">
                <WorkerSelector />
              </div>

              {/* モデル選択 */}
              <div className="mb-4">
                <ModelSelector />
              </div>

              {/* 選択状況の表示 */}
              <div className="mt-6 p-3 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  現在の設定
                </h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>
                    <span className="font-medium">ワーカー:</span>{' '}
                    {selectedWorker || '未選択'}
                  </div>
                  <div>
                    <span className="font-medium">モデル:</span>{' '}
                    {selectedModel || '未選択'}
                  </div>
                  <div>
                    <span className="font-medium">利用可能ワーカー:</span>{' '}
                    {workers.length}個
                  </div>
                </div>
              </div>

              {/* ヘルプ情報 */}
              <div className="mt-6 p-3 bg-blue-50 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 mb-2">
                  💡 使い方
                </h3>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• まずワーカーを選択</li>
                  <li>• 次にモデルを選択</li>
                  <li>• メッセージを入力して送信</li>
                  <li>• Shift+Enterで改行</li>
                </ul>
              </div>
            </div>
          </div>

          {/* メインチャットエリア */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="bg-white rounded-lg shadow flex-1 flex flex-col overflow-hidden">
              
              {/* チャット履歴エリア */}
              <div className="flex-1 overflow-hidden">
                <ChatHistory className="h-full" />
              </div>

              {/* メッセージ入力エリア */}
              <ChatInput
                className="border-t"
                autoFocus={true}
                placeholder={
                  !selectedWorker || !selectedModel 
                    ? "まずワーカーとモデルを選択してください..." 
                    : "AIに質問やリクエストを入力してください..."
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>
              MultiLLM Chat Interface - Powered by OpenAI, Anthropic & Local Models
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}