'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Clock, 
  DollarSign, 
  Zap, 
  Star,
  BarChart3,
  Target,
  Sparkles,
  Brain,
  Gauge
} from 'lucide-react';
import { ModelComparison as IModelComparison, MultiLLMResponse } from '@/src/types/multillm-new';

interface ModelComparisonProps {
  comparison: IModelComparison;
  responses: MultiLLMResponse['responses'];
  onSelectWinner?: (modelId: string) => void;
}

export const ModelComparison: React.FC<ModelComparisonProps> = ({
  comparison,
  responses,
  onSelectWinner
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'quality' | 'relevance' | 'creativity' | 'speed' | 'cost'>('quality');
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);

  const getProviderIcon = (provider: string) => {
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

  const getMetricColor = (score: number) => {
    if (score >= 90) return 'text-green-400 bg-green-500/20';
    if (score >= 80) return 'text-blue-400 bg-blue-500/20';
    if (score >= 70) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'quality':
        return Star;
      case 'relevance':
        return Target;
      case 'creativity':
        return Sparkles;
      case 'speed':
        return Zap;
      case 'cost':
        return DollarSign;
      default:
        return Brain;
    }
  };

  const getMetricValue = (response: any, metric: string) => {
    switch (metric) {
      case 'quality':
        return response.metadata.quality || 0;
      case 'relevance':
        return response.metadata.relevance || 0;
      case 'creativity':
        return response.metadata.creativity || 0;
      case 'speed':
        return Math.max(0, 100 - (response.metadata.responseTime / 50)); // 速度スコア
      case 'cost':
        return Math.max(0, 100 - (response.metadata.cost * 1000)); // コストスコア
      default:
        return 0;
    }
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (time: number) => {
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const getSortedResponses = () => {
    return [...comparison.responses].sort((a, b) => {
      const scoreA = getMetricValue(a, selectedMetric);
      const scoreB = getMetricValue(b, selectedMetric);
      return scoreB - scoreA;
    });
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">モデル比較結果</h2>
        <p className="text-gray-400">各モデルの応答を品質・速度・コストで比較分析</p>
      </div>

      {/* 勝者の発表 */}
      {comparison.analysis.winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 
                   border border-yellow-500/30 rounded-xl p-6 text-center"
        >
          <div className="flex items-center justify-center space-x-3 mb-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h3 className="text-2xl font-bold text-white">
              優勝: {comparison.responses.find(r => r.model === comparison.analysis.winner)?.model}
            </h3>
          </div>
          <p className="text-gray-300">{comparison.analysis.reasoning}</p>
        </motion.div>
      )}

      {/* メトリクス選択 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(['quality', 'relevance', 'creativity', 'speed', 'cost'] as const).map((metric) => {
          const IconComponent = getMetricIcon(metric);
          return (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                selectedMetric === metric
                  ? 'bg-[#1ABC9C] text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span className="capitalize">
                {metric === 'quality' ? '品質' :
                 metric === 'relevance' ? '関連性' :
                 metric === 'creativity' ? '創造性' :
                 metric === 'speed' ? '速度' : 'コスト'}
              </span>
            </button>
          );
        })}
      </div>

      {/* スコア比較チャート */}
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          {selectedMetric === 'quality' ? '品質' :
           selectedMetric === 'relevance' ? '関連性' :
           selectedMetric === 'creativity' ? '創造性' :
           selectedMetric === 'speed' ? '速度' : 'コスト'} スコア
        </h3>
        
        <div className="space-y-4">
          {getSortedResponses().map((response, index) => {
            const score = getMetricValue(response, selectedMetric);
            const isWinner = response.model === comparison.analysis.winner;
            
            return (
              <div key={response.model} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getProviderIcon(response.provider)}</span>
                    <span className="text-white font-medium">{response.model}</span>
                    {isWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
                    {index === 0 && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">#1</span>}
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${getMetricColor(score)}`}>
                    {score.toFixed(1)}
                  </span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className={`h-2 rounded-full ${
                      isWinner ? 'bg-yellow-400' : 'bg-[#1ABC9C]'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 詳細メトリクス */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {responses.map((response) => {
          const isWinner = response.model === comparison.analysis.winner;
          
          return (
            <motion.div
              key={response.model}
              whileHover={{ scale: 1.02 }}
              className={`bg-gray-900/50 backdrop-blur-lg rounded-xl border p-4 ${
                isWinner ? 'border-yellow-500/50' : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getProviderIcon(response.provider)}</span>
                  <span className="text-white font-medium">{response.model}</span>
                </div>
                {isWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">応答時間</span>
                  <span className="text-white">{formatTime(response.metadata.responseTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">トークン数</span>
                  <span className="text-white">{response.metadata.tokenCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">コスト</span>
                  <span className="text-white">{formatCost(response.metadata.cost)}</span>
                </div>
                {response.metadata.confidence && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">信頼度</span>
                    <span className="text-white">{(response.metadata.confidence * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setExpandedResponse(
                  expandedResponse === response.model ? null : response.model
                )}
                className="w-full mt-3 px-3 py-2 bg-white/5 hover:bg-white/10 
                         rounded-lg transition-colors text-sm text-gray-400"
              >
                応答を{expandedResponse === response.model ? '閉じる' : '表示'}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* 応答内容の詳細表示 */}
      <AnimatePresence>
        {expandedResponse && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6"
          >
            {responses.map((response) => {
              if (response.model !== expandedResponse) return null;
              
              return (
                <div key={response.model}>
                  <div className="flex items-center space-x-3 mb-4">
                    <span className="text-xl">{getProviderIcon(response.provider)}</span>
                    <h3 className="text-lg font-semibold text-white">{response.model}の応答</h3>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <pre className="text-gray-300 whitespace-pre-wrap font-sans">
                      {response.response}
                    </pre>
                  </div>

                  {onSelectWinner && (
                    <button
                      onClick={() => onSelectWinner(response.model)}
                      className="mt-4 px-4 py-2 bg-[#1ABC9C] hover:bg-[#16A085] 
                               text-white rounded-lg transition-colors"
                    >
                      このモデルを優先に設定
                    </button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 総合統計 */}
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">比較統計</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-[#1ABC9C]">
              {formatTime(Math.max(...responses.map(r => r.metadata.responseTime)))}
            </div>
            <div className="text-sm text-gray-400">最長応答時間</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-[#3498DB]">
              {formatTime(Math.min(...responses.map(r => r.metadata.responseTime)))}
            </div>
            <div className="text-sm text-gray-400">最短応答時間</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-[#F39C12]">
              {formatCost(Math.max(...responses.map(r => r.metadata.cost)))}
            </div>
            <div className="text-sm text-gray-400">最高コスト</div>
          </div>
          
          <div>
            <div className="text-2xl font-bold text-[#27AE60]">
              {formatCost(Math.min(...responses.map(r => r.metadata.cost)))}
            </div>
            <div className="text-sm text-gray-400">最低コスト</div>
          </div>
        </div>
      </div>

      {/* 分析基準 */}
      <div className="bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">評価基準</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {comparison.analysis.criteria.map((criterion, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-[#1ABC9C] rounded-full" />
              <span className="text-gray-300">{criterion}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};