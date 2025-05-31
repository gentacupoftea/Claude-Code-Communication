'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, Plus, Settings, User } from 'lucide-react';

interface CollapsibleSidebarProps {
  className?: string;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ className = '' }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 60 }
  };

  return (
    <motion.div
      className={`bg-[#0a0e27]/90 backdrop-blur-md border-r border-[#34D399]/30 h-screen flex flex-col ${className}`}
      variants={sidebarVariants}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* ヘッダー */}
      <div className="p-4 border-b border-[#34D399]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#34D399] to-[#10B981] flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            {!isCollapsed && (
              <span className="font-bold bg-gradient-to-r from-[#34D399] to-[#10B981] bg-clip-text text-transparent text-xl">
                Conea
              </span>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-[#34D399]/10 transition-colors"
          >
            <Menu className="w-5 h-5 text-[#34D399]" />
          </button>
        </div>
      </div>

      {/* 新規チャットボタン */}
      <div className="p-4">
        <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#34D399] to-[#10B981] text-white font-medium hover:shadow-lg transition-all duration-300">
          <Plus className="w-5 h-5" />
          {!isCollapsed && <span>新規チャット</span>}
        </button>
      </div>

      {/* プロジェクトセクション */}
      <div className="px-4 mb-6">
        {!isCollapsed && <h3 className="text-[#34D399] font-medium mb-3 text-sm">プロジェクト</h3>}
        <div className="space-y-1">
          {[
            { id: '1', name: 'チャットボット', icon: '🤖', isActive: true },
            { id: '2', name: '予測分析', icon: '📊', isActive: false },
            { id: '3', name: 'アナリティクス', icon: '📈', isActive: false }
          ].map((project) => (
            <button
              key={project.id}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                project.isActive 
                  ? 'bg-[#34D399]/20 border border-[#34D399]/30' 
                  : 'hover:bg-[#34D399]/10'
              }`}
            >
              <span className="text-xl">{project.icon}</span>
              {!isCollapsed && (
                <span className={`text-sm font-medium ${
                  project.isActive ? 'text-[#34D399]' : 'text-gray-300'
                }`}>
                  {project.name}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 下部ユーザー設定 */}
      <div className="mt-auto p-4 border-t border-[#34D399]/20">
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#34D399]/10 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34D399] to-[#10B981] flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-300">ユーザー</div>
              <div className="text-xs text-gray-500">user@conea.ai</div>
            </div>
          )}
          {!isCollapsed && <Settings className="w-4 h-4 text-gray-400" />}
        </button>
      </div>
    </motion.div>
  );
};