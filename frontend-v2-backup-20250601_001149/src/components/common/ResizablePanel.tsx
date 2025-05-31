'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizablePanelProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number; // パーセンテージ
  minLeftWidth?: number; // パーセンテージ
  maxLeftWidth?: number; // パーセンテージ
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 60,
  minLeftWidth = 30,
  maxLeftWidth = 80,
  className = ""
}) => {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // 最小・最大幅の制限
    const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));
    setLeftWidth(clampedWidth);
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // マウスイベントのグローバル監視
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // キーボードショートカット（オプション）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '[':
            e.preventDefault();
            setLeftWidth(prev => Math.max(minLeftWidth, prev - 5));
            break;
          case ']':
            e.preventDefault();
            setLeftWidth(prev => Math.min(maxLeftWidth, prev + 5));
            break;
          case '\\':
            e.preventDefault();
            setLeftWidth(defaultLeftWidth);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [minLeftWidth, maxLeftWidth, defaultLeftWidth]);

  return (
    <div 
      ref={containerRef}
      className={`flex h-full relative ${className}`}
    >
      {/* 左パネル */}
      <div 
        className="flex-shrink-0 overflow-hidden"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* リサイザー */}
      <div
        ref={resizerRef}
        onMouseDown={handleMouseDown}
        className={`
          relative w-1 bg-white/10 hover:bg-white/20 cursor-col-resize transition-colors group
          ${isDragging ? 'bg-[#1ABC9C]' : ''}
        `}
      >
        {/* リサイザーハンドル */}
        <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
          <div className={`
            w-6 h-12 bg-white/10 hover:bg-white/20 rounded-full 
            flex items-center justify-center opacity-0 group-hover:opacity-100 
            transition-opacity duration-200
            ${isDragging ? 'opacity-100 bg-[#1ABC9C]' : ''}
          `}>
            <GripVertical className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* ドラッグ中のビジュアルフィードバック */}
        {isDragging && (
          <div className="absolute top-4 left-2 bg-[#1ABC9C] text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
            {Math.round(leftWidth)}% | {Math.round(100 - leftWidth)}%
          </div>
        )}
      </div>

      {/* 右パネル */}
      <div 
        className="flex-1 overflow-hidden"
        style={{ width: `${100 - leftWidth}%` }}
      >
        {rightPanel}
      </div>

      {/* ヘルプツールチップ（オプション） */}
      {!isDragging && (
        <div className="absolute top-4 right-4 opacity-0 hover:opacity-100 transition-opacity duration-200 z-10">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded shadow-lg">
            <div>ドラッグでリサイズ</div>
            <div className="text-gray-400">
              ⌘[ ⌘] でサイズ調整 | ⌘\ でリセット
            </div>
          </div>
        </div>
      )}
    </div>
  );
};