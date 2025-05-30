import { useEffect, useRef, useCallback } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

interface UseRealtimeDataOptions {
  widgetId: string;
  updateInterval?: number;
  onUpdate?: (data: any) => void;
}

export function useRealtimeData(options: UseRealtimeDataOptions) {
  const { widgetId, updateInterval = 5000, onUpdate } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { updateWidget } = useDashboardStore();

  const updateData = useCallback(async () => {
    try {
      // 実際の実装では、WebSocketまたはServer-Sent Eventsを使用
      // ここでは、定期的なポーリングをシミュレート
      const mockData = generateMockUpdate(widgetId);
      
      updateWidget(widgetId, { data: mockData });
      onUpdate?.(mockData);
    } catch (error) {
      console.error('Failed to update realtime data:', error);
    }
  }, [widgetId, updateWidget, onUpdate]);

  useEffect(() => {
    // 初回データ取得
    updateData();

    // 定期更新の設定
    intervalRef.current = setInterval(updateData, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateData, updateInterval]);

  return {
    refresh: updateData,
  };
}

// モックデータ生成（実際の実装では削除）
function generateMockUpdate(widgetId: string): any {
  const baseValue = 50000000;
  const variation = Math.random() * 0.1 - 0.05; // ±5%の変動
  
  if (widgetId.includes('metric')) {
    return {
      value: Math.floor(baseValue * (1 + variation)),
      currency: 'JPY',
      change: parseFloat((variation * 100).toFixed(2)),
    };
  }
  
  if (widgetId.includes('chart')) {
    return {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
      datasets: [{
        label: '売上',
        data: Array.from({ length: 6 }, () => 
          Math.floor(baseValue * (0.8 + Math.random() * 0.4))
        ),
      }],
    };
  }
  
  return {};
}