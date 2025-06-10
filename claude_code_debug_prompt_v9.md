# 【レイアウト最終修正】プロンプト (v9)

**最終目標:**
`DashboardEditor`にデータを渡し、右パネルを完全に表示させる。

**修正指示:**
`frontend-v2/app/dashboard/page.tsx`を修正し、`DashboardEditor`に初期データを渡すようにします。

```typescript:frontend-v2/app/dashboard/page.tsx
'use client';

import dynamic from 'next/dynamic';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Dashboard } from '@/src/types/widgets'; // Dashboard型をインポート

// 各パネルを動的にインポート
const ChatInterface = dynamic(
  () => import('@/components/dashboard/ChatInterface'),
  { ssr: false, loading: () => <LoadingSpinner /> }
);
const DashboardEditor = dynamic(
  () => import('@/components/dashboard/DashboardEditor'),
  { ssr: false, loading: () => <LoadingSpinner /> }
);

// DashboardEditorに渡すための仮の初期データを作成
const initialDashboardData: Dashboard = {
  id: 'temp-dashboard',
  name: 'マイダッシュボード',
  widgets: [
    // 最初からテキストウィジェットを一つ表示させておく
    {
      id: 'widget-welcome',
      type: 'text',
      title: 'ようこそ！',
      position: { x: 0, y: 0 },
      size: { width: 4, height: 2 },
      data: { content: '右側のパネルが表示されました！', markdown: false },
      config: { fontSize: 'large', alignment: 'center', color: '#ffffff' }
    }
  ],
  layout: { columns: 12, gap: 16 },
  settings: { isPublic: false, theme: 'dark' },
  createdAt: new Date(),
  updatedAt: new Date()
};


export default function DashboardPage() {
  return (
    <DashboardLayout>
      <ChatInterface />
      {/* DashboardEditorにdashboard propを渡す */}
      <DashboardEditor dashboard={initialDashboardData} />
    </DashboardLayout>
  );
}
```
**補足:**
-   `@/src/types/widgets`から`Dashboard`型をインポートする必要があります。
-   今回はまず表示させることを優先し、仮のデータ(`initialDashboardData`)を直接定義していますが、将来的にはこれをAPIから取得する形に進化させることになります。 