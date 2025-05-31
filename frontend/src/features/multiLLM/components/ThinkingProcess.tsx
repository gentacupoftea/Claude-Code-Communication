import React from 'react';

interface ThinkingProcessProps {
  thinking: string[];
}

export function ThinkingProcess({ thinking }: ThinkingProcessProps) {
  if (!thinking || thinking.length === 0) return null;

  return (
    <div className="thinking-process">
      <h4>思考過程</h4>
      <ul>
        {thinking.map((thought, index) => (
          <li key={index}>{thought}</li>
        ))}
      </ul>
    </div>
  );
}