// frontend-v2/src/components/sidebar/StatusSidebar.tsx
import React from 'react';
import { useLLMStore } from '../../store/llmStore';
import { ThinkingStep } from '../../types/api';

export const StatusSidebar: React.FC = () => {
  const thinkingSteps = useLLMStore((state) => state.thinkingSteps);
  const isThinking = useLLMStore((state) => state.isThinking);

  const getStepIcon = (type: ThinkingStep['type']) => {
    switch (type) {
      case 'thinking':
        return '🤔';
      case 'analysis':
        return '🔍';
      case 'task_planning':
        return '📋';
      case 'tool_use':
        return '🛠️';
      case 'response':
        return '💭';
      case 'error':
        return '❌';
      case 'complete':
        return '✅';
      default:
        return '📝';
    }
  };

  const getStepColor = (type: ThinkingStep['type']) => {
    switch (type) {
      case 'thinking':
        return '#3B82F6'; // blue
      case 'analysis':
        return '#8B5CF6'; // purple
      case 'task_planning':
        return '#10B981'; // green
      case 'tool_use':
        return '#F59E0B'; // yellow
      case 'response':
        return '#06B6D4'; // cyan
      case 'error':
        return '#EF4444'; // red
      case 'complete':
        return '#22C55E'; // green
      default:
        return '#6B7280'; // gray
    }
  };

  return (
    <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
      <h3 style={{ marginBottom: '16px', color: '#1F2937' }}>AIステータス</h3>
      
      {/* 現在の状態表示 */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px', 
        backgroundColor: isThinking ? '#FEF3C7' : '#F3F4F6',
        borderRadius: '8px',
        border: `2px solid ${isThinking ? '#F59E0B' : '#E5E7EB'}`
      }}>
        <p style={{ 
          margin: 0, 
          color: isThinking ? '#92400E' : '#6B7280',
          fontWeight: '500'
        }}>
          {isThinking ? '🧠 思考中...' : '⏸️ 待機中...'}
        </p>
      </div>

      {/* 思考ステップ一覧 */}
      {thinkingSteps.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '12px', color: '#374151' }}>思考プロセス</h4>
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {thinkingSteps.map((step, index) => (
              <div
                key={step.id}
                style={{
                  marginBottom: '8px',
                  padding: '10px',
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${getStepColor(step.type)}20`,
                  borderLeft: `4px solid ${getStepColor(step.type)}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '4px' 
                }}>
                  <span style={{ marginRight: '6px' }}>
                    {getStepIcon(step.type)}
                  </span>
                  <span style={{ 
                    fontWeight: '500', 
                    color: getStepColor(step.type),
                    textTransform: 'capitalize'
                  }}>
                    {step.type.replace('_', ' ')}
                  </span>
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontSize: '12px', 
                    color: '#9CA3AF' 
                  }}>
                    #{index + 1}
                  </span>
                </div>
                <div style={{ 
                  color: '#374151', 
                  lineHeight: '1.4',
                  wordBreak: 'break-word'
                }}>
                  {step.content}
                </div>
                {step.metadata?.duration && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#9CA3AF', 
                    marginTop: '4px' 
                  }}>
                    処理時間: {step.metadata.duration}ms
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 思考ステップがない場合のメッセージ */}
      {thinkingSteps.length === 0 && !isThinking && (
        <div style={{ 
          textAlign: 'center', 
          color: '#9CA3AF', 
          fontStyle: 'italic',
          marginTop: '32px'
        }}>
          メッセージを送信すると、AIの思考プロセスがここに表示されます
        </div>
      )}
    </div>
  );
};