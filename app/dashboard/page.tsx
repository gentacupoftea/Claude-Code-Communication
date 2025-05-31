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
        <div className="min-h-screen bg-gray-900">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="container mx-auto px-4 py-8"
          >
            <h1 className="text-3xl font-bold text-white mb-8">
              Conea Dashboard
            </h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Chat Interface
                </h2>
                <ChatInterface />
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Analytics
                </h2>
                <div className="text-gray-300">
                  Analytics dashboard coming soon...
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}