'use client';

import React from 'react';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';
import { DashboardLayout } from '@/src/components/layout/DashboardLayout';
import { ChatInterface } from '@/src/components/dashboard/ChatInterface';
import { motion } from 'framer-motion';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="h-screen flex flex-col">
          {/* ヘッダー */}
          <header className="bg-gray-900/50 backdrop-blur-lg border-b border-white/10 px-6 py-4">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-white"
            >
              ダッシュボード
            </motion.h1>
          </header>

          {/* チャットインターフェース */}
          <div className="flex-1 p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <ChatInterface />
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}