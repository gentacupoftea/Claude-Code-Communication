'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Settings, 
  Compare,
  Sparkles,
  MessageSquare,
  Plus,
  X,
  RotateCcw
} from 'lucide-react';
import { MultiLLMService } from '@/src/services/multillm.service';
import { ModelSelector } from './ModelSelector';
import { ModelComparison } from './ModelComparison';
import { 
  ChatMessage, 
  MultiLLMRequest, 
  MultiLLMResponse, 
  ModelComparison as IModelComparison 
} from '@/src/types/multillm-new';

interface MultiLLMChatProps {
  onGenerateWidget?: (widgetData: any) => void;
}

export const MultiLLMChat: React.FC<MultiLLMChatProps> = ({ onGenerateWidget }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['gpt-4o']);
  const [isLoading, setIsLoading] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [currentComparison, setCurrentComparison] = useState<IModelComparison | null>(null);
  const [currentResponses, setCurrentResponses] = useState<MultiLLMResponse['responses']>([]);
  const [settings, setSettings] = useState({
    temperature: 0.7,
    maxTokens: 1000,
    compareResponses: true,
    systemPrompt: 'あなたは有能なAIアシスタントです。ユーザーの質問に正確で有用な回答を提供してください。'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const multiLLMService = MultiLLMService.getInstance();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getProviderIcon = (provider?: string) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🎭';
      case 'google':
        return '🔍';
      default:
        return '🧠';
    }
  };

  const handleModelToggle = (modelId: string, selected: boolean) => {
    if (selected && !selectedModels.includes(modelId)) {
      setSelectedModels(prev => [...prev, modelId]);
    } else if (!selected) {
      setSelectedModels(prev => prev.filter(id => id !== modelId));
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || selectedModels.length === 0) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      if (selectedModels.length === 1) {
        // 単一モデルの場合
        const response = await multiLLMService.sendMessage(
          [userMessage],
          selectedModels[0],
          {
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            systemPrompt: settings.systemPrompt
          }
        );

        setMessages(prev => [...prev, response]);
      } else {
        // 複数モデルの場合
        const request: MultiLLMRequest = {
          prompt: currentInput,
          models: selectedModels,
          settings: {
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            stream: false,
            compareResponses: settings.compareResponses
          },
          context: messages.slice(-5), // 最新5件のコンテキスト
          systemPrompt: settings.systemPrompt
        };

        const multiResponse = await multiLLMService.sendMultiModelRequest(request);
        
        // 各モデルの応答をメッセージとして追加
        const aiMessages: ChatMessage[] = multiResponse.responses.map(response => ({
          id: `msg-${Date.now()}-${response.model}`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          model: response.model,
          provider: response.provider,
          metadata: {
            tokenCount: response.metadata.tokenCount,
            responseTime: response.metadata.responseTime,
            cost: response.metadata.cost
          }
        }));

        setMessages(prev => [...prev, ...aiMessages]);

        // 比較結果を保存
        if (multiResponse.comparison) {
          setCurrentComparison(multiResponse.comparison);
          setCurrentResponses(multiResponse.responses);
          if (settings.compareResponses) {
            setShowComparison(true);
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'メッセージの送信に失敗しました。もう一度お試しください。',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCompareModels = async (models: string[]) => {
    if (models.length < 2) return;

    const prompt = "簡単な自己紹介と、あなたの特徴について教えてください。";
    
    const request: MultiLLMRequest = {
      prompt,
      models,
      settings: {
        temperature: 0.7,
        maxTokens: 200,
        stream: false,
        compareResponses: true
      }
    };

    try {
      const response = await multiLLMService.sendMultiModelRequest(request);
      if (response.comparison) {
        setCurrentComparison(response.comparison);
        setCurrentResponses(response.responses);
        setShowComparison(true);
      }
    } catch (error) {
      console.error('Failed to compare models:', error);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentComparison(null);
    setCurrentResponses([]);
    setShowComparison(false);
  };

  const generateSampleChart = () => {
    const chartData = {
      type: 'chart',
      title: 'Multi-LLM使用状況',
      data: {
        chartType: 'bar',
        datasets: [{
          label: '応答時間比較',
          data: currentResponses.map(r => r.metadata.responseTime),
          backgroundColor: ['#1ABC9C', '#3498DB', '#F39C12'],
          borderColor: ['#16A085', '#2980B9', '#E67E22']
        }],
        labels: currentResponses.map(r => r.model)
      },
      defaultSize: { width: 6, height: 4 }
    };
    
    onGenerateWidget?.(chartData);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10">
      {/* チャットヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Multi-LLM Chat</h3>
            <p className="text-sm text-gray-400">
              {selectedModels.length}個のモデルを使用中
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {currentResponses.length > 0 && (
            <button
              onClick={generateSampleChart}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400"
              title="チャート生成"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          
          {currentComparison && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`p-2 rounded-lg transition-colors ${
                showComparison ? 'bg-[#1ABC9C] text-white' : 'text-gray-400 hover:bg-white/10'
              }`}
              title="比較結果"
            >
              <Compare className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className={`p-2 rounded-lg transition-colors ${
              showModelSelector ? 'bg-[#1ABC9C] text-white' : 'text-gray-400 hover:bg-white/10'
            }`}
            title="モデル選択"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={clearChat}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400"
            title="チャットクリア"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* モデルセレクター */}
      <AnimatePresence>
        {showModelSelector && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 p-4 max-h-96 overflow-y-auto"
          >
            <ModelSelector
              selectedModels={selectedModels}
              onModelToggle={handleModelToggle}
              maxSelections={3}
              showComparison={true}
              onCompareModels={handleCompareModels}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 比較結果 */}
      <AnimatePresence>
        {showComparison && currentComparison && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 p-4 max-h-96 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">比較結果</h3>
              <button
                onClick={() => setShowComparison(false)}
                className="p-1 hover:bg-white/10 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ModelComparison
              comparison={currentComparison}
              responses={currentResponses}
              onSelectWinner={(modelId) => {
                setSelectedModels([modelId]);
                setShowComparison(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 選択されたモデル表示 */}
      {selectedModels.length > 0 && (
        <div className="p-3 border-b border-white/10 bg-white/5">
          <div className="flex flex-wrap gap-2">
            {selectedModels.map((modelId) => {
              const allModels = multiLLMService.getAvailableModels();
              const model = allModels.find(m => m.id === modelId);
              if (!model) return null;

              return (
                <div
                  key={modelId}
                  className="flex items-center space-x-2 px-3 py-1 bg-[#1ABC9C]/20 rounded-full text-sm"
                >
                  <span>{getProviderIcon(model.provider)}</span>
                  <span className="text-white">{model.displayName}</span>
                  {selectedModels.length > 1 && (
                    <button
                      onClick={() => handleModelToggle(modelId, false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                  message.role === 'user' 
                    ? 'bg-[#3498DB]' 
                    : 'bg-gray-700'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <span>{getProviderIcon(message.provider)}</span>
                  )}
                </div>
                
                <div className={`p-4 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-[#3498DB] text-white'
                    : 'bg-white/10 text-white backdrop-blur-lg'
                }`}>
                  {message.role === 'assistant' && message.model && (
                    <div className="text-xs opacity-70 mb-2">
                      {multiLLMService.getAvailableModels().find(m => m.id === message.model)?.displayName || message.model}
                    </div>
                  )}
                  
                  <pre className="text-sm whitespace-pre-wrap font-sans">{message.content}</pre>
                  
                  <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                    <span>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {message.metadata && (
                      <div className="flex items-center space-x-2">
                        {message.metadata.responseTime && (
                          <span>{message.metadata.responseTime}ms</span>
                        )}
                        {message.metadata.cost && (
                          <span>${message.metadata.cost.toFixed(4)}</span>
                        )}
                      </div>
                    )}
                  </div>
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
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-white/10 text-white backdrop-blur-lg p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {selectedModels.length > 1 ? 
                      `${selectedModels.length}個のモデルが考えています...` : 
                      'AIが考えています...'
                    }
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`${selectedModels.length > 1 ? '複数のモデル' : '選択されたモデル'}にメッセージを送信...`}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white 
                       placeholder-gray-400 resize-none focus:outline-none focus:ring-2 
                       focus:ring-[#1ABC9C] backdrop-blur-lg"
              rows={3}
              disabled={selectedModels.length === 0}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading || selectedModels.length === 0}
            className="bg-[#1ABC9C] hover:bg-[#16A085] disabled:bg-gray-600 
                     disabled:cursor-not-allowed p-3 rounded-lg transition-colors"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {selectedModels.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-2">
            少なくとも1つのモデルを選択してください
          </p>
        )}
      </div>
    </div>
  );
};