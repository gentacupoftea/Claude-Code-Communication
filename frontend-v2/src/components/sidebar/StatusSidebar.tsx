// frontend-v2/src/components/sidebar/StatusSidebar.tsx
import React from 'react';

export const StatusSidebar: React.FC = () => {
  return (
    <div style={{ padding: '16px' }}>
      <h3>ジョブステータス</h3>
      <p>現在、エージェントは待機中です...</p>
      {/* フェーズ2でここにリアルタイムのステータスが表示されます */}
    </div>
  );
};