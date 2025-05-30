import React from 'react';
import { LLMResponse } from '../types';

interface WorkerResponsesProps {
  responses: LLMResponse[];
}

export function WorkerResponses({ responses }: WorkerResponsesProps) {
  const workerResponses = responses.filter(r => r.workerId !== 'aggregated');

  if (workerResponses.length === 0) return null;

  return (
    <div className="worker-responses">
      <h3>Worker LLM レスポンス詳細</h3>
      {workerResponses.map((response, index) => (
        <div key={index} className="worker-response-item">
          <div className="worker-response-header">
            {response.workerId} (信頼度: {(response.confidence * 100).toFixed(0)}%)
          </div>
          <div className="worker-response-content">
            {response.content.substring(0, 200)}...
          </div>
        </div>
      ))}
    </div>
  );
}