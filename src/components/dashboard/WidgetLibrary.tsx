'use client';

import React from 'react';
// import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Calendar, 
  Table, 
  TrendingUp, 
  Type, 
  Image,
  GripVertical,
  Sparkles
} from 'lucide-react';
import { DraggableItem, WidgetType } from '@/src/types/widgets';

interface WidgetLibraryProps {
  onDragStart?: (item: DraggableItem) => void;
  generatedWidgets?: DraggableItem[];
}

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({ onDragStart, generatedWidgets = [] }) => {
  const widgetTemplates: DraggableItem[] = [
    {
      id: 'chart-template',
      type: 'chart',
      title: 'グラフ',
      icon: 'BarChart3',
      defaultSize: { width: 6, height: 4 }
    },
    {
      id: 'calendar-template',
      type: 'calendar',
      title: 'カレンダー',
      icon: 'Calendar',
      defaultSize: { width: 6, height: 4 }
    },
    {
      id: 'table-template',
      type: 'table',
      title: 'テーブル',
      icon: 'Table',
      defaultSize: { width: 8, height: 4 }
    },
    {
      id: 'metric-template',
      type: 'metric',
      title: 'メトリクス',
      icon: 'TrendingUp',
      defaultSize: { width: 3, height: 2 }
    },
    {
      id: 'text-template',
      type: 'text',
      title: 'テキスト',
      icon: 'Type',
      defaultSize: { width: 4, height: 2 }
    },
    {
      id: 'image-template',
      type: 'image',
      title: '画像',
      icon: 'Image',
      defaultSize: { width: 4, height: 3 }
    }
  ];

  const getIcon = (iconName: string) => {
    const icons = {
      BarChart3,
      Calendar,
      Table,
      TrendingUp,
      Type,
      Image
    };
    const Icon = icons[iconName as keyof typeof icons];
    return Icon ? <Icon className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />;
  };

  const handleDragStart = (e: React.DragEvent, item: DraggableItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(item);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#1ABC9C]" />
        <h3 className="text-lg font-semibold text-white">ウィジェットライブラリ</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {widgetTemplates.map((template) => (
          <div
            key={template.id}
            draggable
            onDragStart={(e) => handleDragStart(e, template)}
            className="group cursor-grab active:cursor-grabbing bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-3 transition-all duration-200 hover:scale-105 hover:animate-pulse"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="text-[#1ABC9C]">
                {getIcon(template.icon)}
              </div>
              <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm font-medium text-white">{template.title}</p>
            <p className="text-xs text-gray-400">
              {template.defaultSize.width}×{template.defaultSize.height}
            </p>
          </div>
        ))}
      </div>

      {/* AI生成ウィジェット */}
      {generatedWidgets.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#1ABC9C]" />
            <h3 className="text-md font-semibold text-white">AI生成ウィジェット</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {generatedWidgets.map((widget) => (
              <div
                key={widget.id}
                draggable
                onDragStart={(e) => handleDragStart(e, widget)}
                className="group cursor-grab active:cursor-grabbing bg-gradient-to-r from-[#1ABC9C]/20 to-[#3498DB]/20 border border-[#1ABC9C]/30 rounded-lg p-3 transition-all duration-200 hover:scale-105 hover:animate-pulse"
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#1ABC9C]" />
                  <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm font-medium text-white">{widget.title}</p>
                <p className="text-xs text-[#1ABC9C]">
                  AI生成 • {widget.defaultSize.width}×{widget.defaultSize.height}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-gradient-to-r from-[#1ABC9C]/20 to-[#3498DB]/20 rounded-lg border border-[#1ABC9C]/30">
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#1ABC9C]" />
          <p className="text-sm font-medium text-white">AI生成コンテンツ</p>
        </div>
        <p className="text-xs text-gray-300">
          チャットでAIに「グラフを作成して」と依頼すると、
          上にドラッグ可能なグラフが表示されます
        </p>
      </div>
    </div>
  );
};