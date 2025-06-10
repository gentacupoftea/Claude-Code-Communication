'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, AlertCircle, RefreshCcw, Paperclip, Search, Settings as SettingsIcon } from 'lucide-react';
import { multiLLMService } from '@/src/services/multillm.service';
import { MultiLLMRequest, ChatMessage } from '@/src/types/multillm';
import { API_ENDPOINTS, createApiUrl } from '@/src/lib/api-config';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  model?: string;
  error?: boolean;
}

interface AgentConfig {
  name?: string;
  model?: string;
  system_prompt?: string;
  max_history?: number;
  temperature?: number;
  max_tokens?: number;
}

interface ChatInterfaceProps {
  agentConfig?: Partial<AgentConfig>;
  onConfigChange?: (config: Partial<AgentConfig>) => void;
  enableFileUpload?: boolean;
  enableSearch?: boolean;
  onGenerateWidget?: (widgetData: any) => void;
}

const defaultAgentConfig: AgentConfig = {
  name: 'Conea AI',
  model: 'gpt-4o',
  system_prompt: 'こんにちは！Conea AIです。何かお手伝いできることはありますか？',
  max_history: 20,
  temperature: 0.7,
  max_tokens: 1000,
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  agentConfig = defaultAgentConfig, 
  onConfigChange,
  enableFileUpload = true,
  enableSearch = true,
  onGenerateWidget
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: agentConfig.system_prompt || 'こんにちは！Conea AIです。何かお手伝いできることはありますか？',
      sender: 'ai',
      timestamp: new Date(),
      model: agentConfig.model
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [searchEnabled, setSearchEnabled] = useState(enableSearch);
  const [isMounted, setIsMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // クライアントサイドマウント検知
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // API接続テスト
  useEffect(() => {
    const testConnection = async () => {
      setConnectionStatus('checking');
      try {
        // multiLLMServiceは既にインポート済みのインスタンスを使用
        const models = await fetch(`${createApiUrl('')}/api/models`)
          .then(res => res.ok ? res.json() : [])
          .catch(() => []);
        setConnectionStatus(models.length > 0 ? 'connected' : 'disconnected');
      } catch (error) {
        setConnectionStatus('disconnected');
      }
    };
    
    testConnection();
  }, []);

  const handleSendMessage = async () => {
    if ((!inputText.trim() && attachedFiles.length === 0) || isLoading) return;

    // ファイルがある場合は、ファイル名をメッセージに追加
    let messageText = inputText;
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => f.name).join(', ');
      messageText = inputText + (inputText ? '\n' : '') + `[添付ファイル: ${fileNames}]`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    const currentFiles = [...attachedFiles];
    setInputText('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      // multiLLMServiceは既にインポート済みのインスタンスを使用
      
      // ChatMessage形式でリクエストを作成
      const chatMessages: ChatMessage[] = [
        ...(agentConfig.system_prompt ? [{ 
          id: 'system',
          role: 'system' as const, 
          content: agentConfig.system_prompt,
          timestamp: new Date()
        }] : []),
        ...messages.filter(m => m.sender !== 'ai' || m.error !== true).map(m => ({
          id: m.id,
          role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text,
          timestamp: m.timestamp
        })),
        { 
          id: Date.now().toString(),
          role: 'user' as const, 
          content: messageText,
          timestamp: new Date()
        }
      ];
      
      const request: MultiLLMRequest = {
        messages: chatMessages,
        model: agentConfig.model || 'gpt-4o',
        temperature: agentConfig.temperature || 0.7,
        maxTokens: agentConfig.max_tokens || 1000,
        stream: true
      };

      // ストリーミングAPI呼び出し
      let fullResponse = '';
      await multiLLMService.streamChat(
        request,
        (chunk) => {
          fullResponse += chunk;
          // 一時的なメッセージを更新
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages[newMessages.length - 1]?.sender === 'ai' && !newMessages[newMessages.length - 1]?.error) {
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                text: fullResponse
              };
            } else {
              newMessages.push({
                id: (Date.now() + 1).toString(),
                text: fullResponse,
                sender: 'ai',
                timestamp: new Date(),
                model: agentConfig.model
              });
            }
            return newMessages;
          });
        },
        () => {
          setConnectionStatus('connected');
        },
        (error) => {
          console.error('Streaming error:', error);
          setMessages(prev => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              text: `エラーが発生しました: ${error.message}`,
              sender: 'ai',
              timestamp: new Date(),
              error: true
            }
          ]);
          setConnectionStatus('disconnected');
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      
      let errorText = '申し訳ありませんが、メッセージの送信に失敗しました。';
      if (error instanceof Error) {
        errorText += ` (${error.message})`;
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'ai',
        timestamp: new Date(),
        error: true
      };

      setMessages(prev => [...prev, errorMessage]);
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    setConnectionStatus('checking');
    try {
      // multiLLMServiceは既にインポート済みのインスタンスを使用
      const models = await fetch(`${createApiUrl('')}/api/models`)
        .then(res => res.ok ? res.json() : [])
        .catch(() => []);
      setConnectionStatus(models.length > 0 ? 'connected' : 'disconnected');
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ファイルアップロード処理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // グラフ生成処理
  const generateSampleChart = () => {
    const chartData = {
      type: 'chart',
      title: 'AI生成グラフ',
      data: {
        chartType: 'line',
        datasets: [{
          label: '売上推移',
          data: [65, 59, 80, 81, 56, 55, 40],
          backgroundColor: '#1ABC9C',
          borderColor: '#1ABC9C'
        }],
        labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月']
      },
      defaultSize: { width: 6, height: 4 }
    };
    
    onGenerateWidget?.(chartData);
    
    // チャットにグラフ生成メッセージを追加
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: '売上推移のグラフを作成しました。右側のウィジェットライブラリにドラッグ可能なグラフが表示されています。',
      sender: 'ai',
      timestamp: new Date(),
      model: agentConfig.model
    };
    setMessages(prev => [...prev, aiMessage]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10">
      {/* チャットヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#1ABC9C] rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{agentConfig.name || 'Conea AI'}</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 
                connectionStatus === 'disconnected' ? 'bg-red-400' : 'bg-yellow-400'
              }`} />
              <p className="text-sm text-gray-400">
                {connectionStatus === 'connected' ? 'オンライン' : 
                 connectionStatus === 'disconnected' ? 'オフライン' : '接続中...'}
              </p>
              {agentConfig.model && (
                <span className="text-xs bg-white/10 px-2 py-1 rounded">
                  {agentConfig.model}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {connectionStatus === 'disconnected' && (
          <button
            onClick={handleRetryConnection}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="再接続"
          >
            <RefreshCcw className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-[80%] ${
                message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.sender === 'user' 
                    ? 'bg-[#3498DB]' 
                    : 'bg-[#1ABC9C]'
                }`}>
                  {message.sender === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`p-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-[#3498DB] text-white'
                    : 'bg-white/10 text-white backdrop-blur-lg'
                }`}>
                  <p className="text-sm">{message.text}</p>
                  {isMounted && (
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-[#1ABC9C] rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white/10 text-white backdrop-blur-lg p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AIが考えています...</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="p-4 border-t border-white/10">
        {/* 添付ファイル表示 */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center space-x-2 bg-white/10 rounded-lg px-3 py-1">
                <Paperclip className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* チャット機能ボタン */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {searchEnabled && (
              <button 
                className="flex items-center space-x-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                title="Search機能有効"
              >
                <Search className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Search ON</span>
              </button>
            )}
            <button 
              onClick={generateSampleChart}
              className="flex items-center space-x-1 px-2 py-1 bg-[#1ABC9C]/20 hover:bg-[#1ABC9C]/30 rounded text-xs transition-colors"
            >
              <SettingsIcon className="w-3 h-3 text-[#1ABC9C]" />
              <span className="text-[#1ABC9C]">グラフ作成</span>
            </button>
          </div>
          <button
            onClick={() => setSearchEnabled(!searchEnabled)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
              searchEnabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Search {searchEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力してください..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#1ABC9C] backdrop-blur-lg"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            {enableFileUpload && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.pdf,.doc,.docx,.csv,.xlsx,.json"
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className="bg-[#1ABC9C] hover:bg-[#16A085] disabled:bg-gray-600 disabled:cursor-not-allowed p-3 rounded-lg transition-colors"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};