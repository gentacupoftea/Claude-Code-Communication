'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, 
  RotateCcw, 
  Play, 
  Share2, 
  Settings,
  Grid,
  Eye,
  Plus,
  Trash2
} from 'lucide-react';
import { Widget, Dashboard, DraggableItem } from '@/src/types/widgets';
import { WidgetRenderer } from './WidgetRenderer';
import { backendAPI } from '@/src/lib/backend-api';

interface DashboardEditorProps {
  dashboard?: Dashboard;
  onSave?: (dashboard: Dashboard) => void;
  onPreview?: () => void;
  onShare?: () => void;
}

export const DashboardEditor: React.FC<DashboardEditorProps> = ({
  dashboard,
  onSave,
  onPreview,
  onShare
}) => {
  const [widgets, setWidgets] = useState<Widget[]>(dashboard?.widgets || []);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [gridColumns, setGridColumns] = useState(12);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ドロップハンドリング
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const itemData = e.dataTransfer.getData('application/json');
      const droppedItem: DraggableItem = JSON.parse(itemData);
      
      // マウス位置からグリッド位置を計算
      const rect = dropZoneRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cellWidth = rect.width / gridColumns;
      const cellHeight = 60; // 基準の高さ
      const x = Math.floor((e.clientX - rect.left) / cellWidth);
      const y = Math.floor((e.clientY - rect.top) / cellHeight);

      // 新しいウィジェットを作成
      const newWidget: Widget = {
        id: `widget-${Date.now()}`,
        type: droppedItem.type,
        title: droppedItem.title,
        position: { x, y },
        size: droppedItem.defaultSize,
        data: getDefaultWidgetData(droppedItem.type),
        config: getDefaultWidgetConfig(droppedItem.type)
      } as Widget;

      setWidgets(prev => [...prev, newWidget]);
      setSelectedWidget(newWidget.id);
    } catch (error) {
      console.error('Drop handling error:', error);
    }
  };

  // デフォルトデータ生成
  const getDefaultWidgetData = (type: string) => {
    switch (type) {
      case 'chart':
        return {
          chartType: 'line',
          datasets: [{
            label: 'データセット1',
            data: [10, 20, 30, 25, 40],
            backgroundColor: '#1ABC9C',
            borderColor: '#1ABC9C'
          }],
          labels: ['1月', '2月', '3月', '4月', '5月']
        };
      case 'calendar':
        return {
          events: [{
            id: '1',
            title: 'サンプルイベント',
            date: new Date().toISOString().split('T')[0],
            color: '#1ABC9C'
          }]
        };
      case 'table':
        return {
          headers: ['項目', '値', '変化率'],
          rows: [
            ['売上', '1,000,000', '+5%'],
            ['注文数', '150', '+8%'],
            ['顧客数', '80', '+3%']
          ]
        };
      case 'metric':
        return {
          value: 1234,
          label: 'メトリクス',
          unit: '件',
          change: 5.2,
          changeType: 'increase'
        };
      case 'text':
        return {
          content: 'テキストコンテンツ',
          markdown: false
        };
      case 'image':
        return {
          src: '/placeholder-image.jpg',
          alt: '画像の説明'
        };
      default:
        return {};
    }
  };

  const getDefaultWidgetConfig = (type: string) => {
    switch (type) {
      case 'chart':
        return {
          responsive: true,
          legend: true,
          grid: true,
          animation: true
        };
      case 'calendar':
        return {
          view: 'month',
          locale: 'ja'
        };
      case 'table':
        return {
          sortable: true,
          filterable: false,
          pagination: false,
          striped: true
        };
      case 'metric':
        return {
          format: 'number',
          showTrend: true,
          color: '#1ABC9C'
        };
      case 'text':
        return {
          fontSize: 'medium',
          alignment: 'left',
          color: '#ffffff'
        };
      case 'image':
        return {
          fit: 'cover',
          borderRadius: 8
        };
      default:
        return {};
    }
  };

  // ウィジェット削除
  const deleteWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setSelectedWidget(null);
  };

  // ダッシュボード保存
  const saveDashboard = async () => {
    const dashboardData: Dashboard = {
      id: dashboard?.id || `dashboard-${Date.now()}`,
      name: dashboard?.name || '新しいダッシュボード',
      widgets,
      layout: {
        columns: gridColumns,
        gap: 16
      },
      settings: {
        isPublic: dashboard?.settings?.isPublic || false,
        theme: 'dark'
      },
      createdAt: dashboard?.createdAt || new Date(),
      updatedAt: new Date()
    };

    try {
      await backendAPI.saveDashboard(dashboardData);
      onSave?.(dashboardData);
    } catch (error) {
      console.error('Failed to save dashboard:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ツールバー */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white">ダッシュボードエディター</h3>
          <div className="flex items-center space-x-1">
            <Grid className="w-4 h-4 text-gray-400" />
            <select 
              value={gridColumns}
              onChange={(e) => setGridColumns(Number(e.target.value))}
              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white"
            >
              <option value={8}>8列</option>
              <option value={12}>12列</option>
              <option value={16}>16列</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onPreview}
            className="flex items-center space-x-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-colors"
          >
            <Eye className="w-3 h-3" />
            <span>プレビュー</span>
          </button>
          <button
            onClick={onShare}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs transition-colors"
          >
            <Share2 className="w-3 h-3" />
            <span>シェア</span>
          </button>
          <button
            onClick={saveDashboard}
            className="flex items-center space-x-1 px-3 py-1 bg-[#1ABC9C] hover:bg-[#16A085] rounded-lg text-xs transition-colors"
          >
            <Save className="w-3 h-3" />
            <span>保存</span>
          </button>
        </div>
      </div>

      {/* エディターエリア */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`h-full p-4 transition-colors relative ${
            isDragOver ? 'bg-[#1ABC9C]/10' : 'bg-gray-800/30'
          }`}
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${100 / gridColumns}% 60px`
          }}
        >
          {/* ドロップゾーンヒント */}
          {widgets.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Plus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">ウィジェットをここにドラッグしてください</p>
                <p className="text-gray-500 text-sm">
                  左側のライブラリからウィジェットを選んで、ここにドロップしてダッシュボードを作成
                </p>
              </div>
            </div>
          )}

          {/* ウィジェット描画 */}
          <AnimatePresence>
            {widgets.map((widget) => (
              <motion.div
                key={widget.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`absolute border-2 rounded-lg transition-colors ${
                  selectedWidget === widget.id
                    ? 'border-[#1ABC9C] bg-white/5'
                    : 'border-white/20 hover:border-white/40'
                }`}
                style={{
                  left: `${(widget.position.x / gridColumns) * 100}%`,
                  top: `${widget.position.y * 60}px`,
                  width: `${(widget.size.width / gridColumns) * 100}%`,
                  height: `${widget.size.height * 60}px`,
                  minHeight: '120px'
                }}
                onClick={() => setSelectedWidget(widget.id)}
              >
                {/* ウィジェットヘッダー */}
                <div className="flex items-center justify-between p-2 border-b border-white/10">
                  <h4 className="text-sm font-medium text-white truncate">{widget.title}</h4>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // ウィジェット設定を開く
                      }}
                      className="p-1 hover:bg-white/10 rounded"
                    >
                      <Settings className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWidget(widget.id);
                      }}
                      className="p-1 hover:bg-red-600/20 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* ウィジェットコンテンツ */}
                <div className="p-2 h-[calc(100%-40px)] overflow-hidden">
                  <WidgetRenderer widget={widget} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ドラッグオーバーレイ */}
          {isDragOver && (
            <div className="absolute inset-0 bg-[#1ABC9C]/20 border-2 border-dashed border-[#1ABC9C] rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Plus className="w-8 h-8 text-[#1ABC9C] mx-auto mb-2" />
                <p className="text-[#1ABC9C] font-medium">ここにドロップ</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};