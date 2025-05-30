'use client';

import React from 'react';
import { 
  BarChart3, 
  Calendar as CalendarIcon, 
  Table as TableIcon, 
  TrendingUp, 
  Type, 
  Image as ImageIcon
} from 'lucide-react';
import { Widget } from '@/src/types/widgets';

interface WidgetRendererProps {
  widget: Widget;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget }) => {
  switch (widget.type) {
    case 'chart':
      return <ChartWidgetRenderer widget={widget} />;
    case 'calendar':
      return <CalendarWidgetRenderer widget={widget} />;
    case 'table':
      return <TableWidgetRenderer widget={widget} />;
    case 'metric':
      return <MetricWidgetRenderer widget={widget} />;
    case 'text':
      return <TextWidgetRenderer widget={widget} />;
    case 'image':
      return <ImageWidgetRenderer widget={widget} />;
    default:
      return <div className="text-gray-400 text-center">未対応のウィジェット</div>;
  }
};

// 各ウィジェットのレンダラー
const ChartWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  if (widget.type !== 'chart') return null;
  
  const { data } = widget;
  const maxValue = Math.max(...data.datasets[0].data);
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-end space-x-2 px-2 pb-2">
        {data.datasets[0].data.map((value: number, index: number) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-[#1ABC9C] rounded-t"
              style={{ 
                height: `${(value / maxValue) * 100}%`,
                minHeight: '4px'
              }}
            />
            <span className="text-xs text-gray-400 mt-1 truncate">
              {data.labels[index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CalendarWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  if (widget.type !== 'calendar') return null;
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  
  return (
    <div className="h-full">
      <div className="text-center text-sm font-medium text-white mb-2">
        {today.getFullYear()}年{today.getMonth() + 1}月
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['日', '月', '火', '水', '木', '金', '土'].map(day => (
          <div key={day} className="text-center text-gray-400 font-medium">{day}</div>
        ))}
        {days.map((day, index) => (
          <div 
            key={index} 
            className={`text-center p-1 rounded ${
              day === today.getDate() 
                ? 'bg-[#1ABC9C] text-white' 
                : day 
                  ? 'text-gray-300 hover:bg-white/10' 
                  : ''
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  );
};

const TableWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  if (widget.type !== 'table') return null;
  
  const { data } = widget;
  
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            {data.headers.map((header, index) => (
              <th key={index} className="text-left p-1 font-medium text-gray-300">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white/5' : ''}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="p-1 text-gray-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MetricWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  if (widget.type !== 'metric') return null;
  
  const { data } = widget;
  
  return (
    <div className="h-full flex flex-col justify-center items-center text-center">
      <div className="text-2xl font-bold text-white mb-1">
        {data.value.toLocaleString()}{data.unit}
      </div>
      <div className="text-sm text-gray-400 mb-2">{data.label}</div>
      {data.change && (
        <div className={`text-xs flex items-center ${
          data.changeType === 'increase' ? 'text-green-400' : 'text-red-400'
        }`}>
          <TrendingUp className="w-3 h-3 mr-1" />
          {data.changeType === 'increase' ? '+' : '-'}{Math.abs(data.change)}%
        </div>
      )}
    </div>
  );
};

const TextWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  if (widget.type !== 'text') return null;
  
  const { data, config } = widget;
  
  return (
    <div 
      className={`h-full overflow-auto ${
        config?.alignment === 'center' ? 'text-center' : 
        config?.alignment === 'right' ? 'text-right' : 'text-left'
      }`}
      style={{ 
        fontSize: config?.fontSize === 'large' ? '16px' : 
                 config?.fontSize === 'small' ? '12px' : '14px',
        color: config?.color || '#ffffff'
      }}
    >
      {data.markdown ? (
        <div dangerouslySetInnerHTML={{ __html: data.content }} />
      ) : (
        <p>{data.content}</p>
      )}
    </div>
  );
};

const ImageWidgetRenderer: React.FC<{ widget: Widget }> = ({ widget }) => {
  if (widget.type !== 'image') return null;
  
  const { data, config } = widget;
  
  return (
    <div className="h-full flex items-center justify-center">
      <div 
        className="w-full h-full bg-gray-700 rounded flex items-center justify-center"
        style={{ borderRadius: config?.borderRadius || 8 }}
      >
        <ImageIcon className="w-8 h-8 text-gray-400" />
        <span className="text-gray-400 text-xs ml-2">画像プレビュー</span>
      </div>
    </div>
  );
};