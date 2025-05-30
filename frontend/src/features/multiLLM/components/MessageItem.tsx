import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { ChartVisualization } from './ChartVisualization';
import ReactMarkdown from 'react-markdown';

interface MessageItemProps {
  message: ChatMessage;
  showThinking: boolean;
}

export function MessageItem({ message, showThinking }: MessageItemProps) {
  const [expandThinking, setExpandThinking] = useState(false);
  const [expandDetails, setExpandDetails] = useState(false);

  const isUser = message.role === 'user';
  const hasVisualization = message.metadata?.visualization;
  const hasThinking = message.metadata?.thinking?.length > 0;
  const hasDetails = message.metadata?.responses?.[0]?.data?.details;
  const aggregatedData = message.metadata?.responses?.find((r: any) => r.workerId === 'aggregated')?.data;

  return (
    <div className={`message-item ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-header">
        <span className="message-role">
          {isUser ? 'あなた' : 'AI アシスタント'}
        </span>
        <span className="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="message-content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      {hasVisualization && (
        <div className="message-visualization">
          <ChartVisualization data={message.metadata.visualization} />
        </div>
      )}

      {aggregatedData && (
        <div className="aggregated-details">
          {aggregatedData.mainInsights && aggregatedData.mainInsights.length > 0 && (
            <div className="insights-section">
              <h4>主要な洞察</h4>
              <ul>
                {aggregatedData.mainInsights.map((insight: string, index: number) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
          
          {aggregatedData.recommendations && aggregatedData.recommendations.length > 0 && (
            <div className="recommendations-section">
              <h4>推奨事項</h4>
              <ul>
                {aggregatedData.recommendations.map((rec: string, index: number) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
          
          {aggregatedData.keyFindings && Object.keys(aggregatedData.keyFindings).length > 0 && (
            <div className="findings-section">
              <button
                className="details-toggle"
                onClick={() => setExpandDetails(!expandDetails)}
              >
                詳細情報 {expandDetails ? '▼' : '▶'}
              </button>
              {expandDetails && (
                <div className="key-findings">
                  {Object.entries(aggregatedData.keyFindings).map(([key, value]: [string, any], index) => (
                    <div key={index} className="finding-item">
                      <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showThinking && hasThinking && (
        <div className="thinking-section">
          <button
            className="thinking-toggle"
            onClick={() => setExpandThinking(!expandThinking)}
          >
            思考過程 {expandThinking ? '▼' : '▶'}
          </button>
          {expandThinking && (
            <ul className="thinking-list">
              {message.metadata.thinking.map((thought: string, index: number) => (
                <li key={index}>{thought}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}