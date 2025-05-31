'use client';

import React, { useState } from 'react';
import { ProjectSidebar } from './ProjectSidebar';
import { CyberGrid, FloatingParticles } from '@/src/components/common';
import { motion } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-hidden relative flex">
      {/* 背景エフェクト */}
      <CyberGrid />
      <FloatingParticles count={30} />

      {/* サイドバー */}
      <ProjectSidebar 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* メインコンテンツ */}
      <motion.main
        animate={{ marginLeft: isSidebarCollapsed ? 0 : 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 relative z-10"
      >
        {children}
      </motion.main>
    </div>
  );
};