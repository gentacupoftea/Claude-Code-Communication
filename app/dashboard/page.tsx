'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CyberGrid, FloatingParticles, GlassmorphicCard } from '@/src/components/common';
import { Bot, Plus, Home, BarChart, Settings, LogOut, Menu, X, MessageSquare, Sliders, Minimize2 } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';
import { useAppNavigation } from '@/src/hooks/useAppNavigation';
import { ChatInterface } from '@/src/components/dashboard/ChatInterface';
import { EditPanel } from '@/src/components/dashboard/EditPanel';
import { AgentConfig, defaultAgentConfig } from '@/src/lib/api';
import { APISettings, defaultAPISettings } from '@/src/types/api-settings';
import { Dashboard, Widget, DraggableItem } from '@/src/types/widgets';
import { ResizablePanel } from '@/src/components/common/ResizablePanel';

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [agentConfig, setAgentConfig] = useState<Partial<AgentConfig>>(defaultAgentConfig);
  const [apiSettings, setApiSettings] = useState<APISettings>(defaultAPISettings);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | undefined>(undefined);
  const [generatedWidgets, setGeneratedWidgets] = useState<DraggableItem[]>([]);
  const [isFullscreenEditor, setIsFullscreenEditor] = useState(false);
  const { logout } = useAuth();
  const {
    navigateToNewProject,
    navigateToChatbotSettings,
    navigateToAnalyticsSettings,
    navigateToPredictionSettings
  } = useAppNavigation();

  // 設定ドロップダウンのクリック外しで閉じる処理
  useEffect(() => {
    const handleClickOutside = () => {
      setSettingsMenuOpen(false);
    };

    if (settingsMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [settingsMenuOpen]);

  // ダッシュボード保存処理
  const handleDashboardSave = (dashboard: Dashboard) => {
    setCurrentDashboard(dashboard);
    console.log('Dashboard saved:', dashboard);
    // ここで実際の保存処理（API呼び出し等）を実装
  };

  // AI生成ウィジェット処理
  const handleWidgetGeneration = (widgetData: any) => {
    const newWidget: DraggableItem = {
      id: `ai-widget-${Date.now()}`,
      type: widgetData.type,
      title: widgetData.title,
      icon: 'BarChart3',
      preview: widgetData.data,
      defaultSize: widgetData.defaultSize
    };
    setGeneratedWidgets(prev => [...prev, newWidget]);
  };

  // フルスクリーンエディター切り替え
  const toggleFullscreenEditor = () => {
    setIsFullscreenEditor(!isFullscreenEditor);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white overflow-hidden relative">
      {/* 背景エフェクト */}
      <CyberGrid />
      <FloatingParticles count={30} />

      {/* ナビゲーションバー */}
      <nav className="relative z-20 bg-gray-900/50 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <Bot className="w-8 h-8 text-[#1ABC9C]" />
                <span className="text-xl font-bold bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
                  Conea AI
                </span>
              </Link>
            </div>

            {/* デスクトップメニュー */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center space-x-2 text-[#1ABC9C]">
                <MessageSquare className="w-5 h-5" />
                <span>エージェント</span>
              </Link>
              <Link href="/analytics" className="flex items-center space-x-2 hover:text-[#1ABC9C] transition-colors">
                <BarChart className="w-5 h-5" />
                <span>分析</span>
              </Link>
              
              {/* 設定ドロップダウン */}
              <div className="relative">
                <button 
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                  className="flex items-center space-x-2 hover:text-[#1ABC9C] transition-colors"
                >
                  <Sliders className="w-5 h-5" />
                  <span>設定</span>
                </button>
                
                {settingsMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl z-50"
                  >
                    <div className="py-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigateToChatbotSettings(); setSettingsMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 hover:bg-white/10 transition-colors"
                      >
                        AIチャットボット
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigateToAnalyticsSettings(); setSettingsMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 hover:bg-white/10 transition-colors"
                      >
                        データ分析
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigateToPredictionSettings(); setSettingsMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 hover:bg-white/10 transition-colors"
                      >
                        予測モデル
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
              
              <button onClick={logout} className="flex items-center space-x-2 hover:text-red-400 transition-colors">
                <LogOut className="w-5 h-5" />
                <span>ログアウト</span>
              </button>
            </div>

            {/* モバイルメニューボタン */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* モバイルメニュー */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-gray-900/95 backdrop-blur-lg border-t border-white/10"
          >
            <div className="px-4 py-4 space-y-2">
              <Link href="/dashboard" className="block py-2 text-[#1ABC9C]">
                エージェント
              </Link>
              <Link href="/analytics" className="block py-2 hover:text-[#1ABC9C]">
                分析
              </Link>
              <div className="border-t border-white/10 pt-2 mt-2">
                <p className="text-xs text-gray-400 mb-2">設定メニュー</p>
                <button onClick={(e) => { e.stopPropagation(); navigateToChatbotSettings(); setMobileMenuOpen(false); }} className="block w-full text-left py-2 hover:text-[#1ABC9C]">
                  AIチャットボット
                </button>
                <button onClick={(e) => { e.stopPropagation(); navigateToAnalyticsSettings(); setMobileMenuOpen(false); }} className="block w-full text-left py-2 hover:text-[#1ABC9C]">
                  データ分析
                </button>
                <button onClick={(e) => { e.stopPropagation(); navigateToPredictionSettings(); setMobileMenuOpen(false); }} className="block w-full text-left py-2 hover:text-[#1ABC9C]">
                  予測モデル
                </button>
              </div>
              <button onClick={logout} className="block py-2 text-red-400 border-t border-white/10 pt-2 mt-2">
                ログアウト
              </button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* メインコンテンツ */}
      <div className="relative z-10 h-[calc(100vh-4rem)]">
        {/* デスクトップ版: リサイザブルレイアウト */}
        <div className="hidden lg:block h-full">
          <ResizablePanel
            defaultLeftWidth={65}
            minLeftWidth={40}
            maxLeftWidth={85}
            leftPanel={
              <div className="h-full p-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="h-full"
                >
                  <ChatInterface 
                    agentConfig={agentConfig}
                    onConfigChange={setAgentConfig}
                    onGenerateWidget={handleWidgetGeneration}
                  />
                </motion.div>
              </div>
            }
            rightPanel={
              <div className="h-full p-4">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="h-full bg-gray-900/50 backdrop-blur-lg rounded-xl border border-white/10"
                >
                  <EditPanel 
                    agentConfig={agentConfig}
                    onConfigChange={setAgentConfig}
                    apiSettings={apiSettings}
                    onAPISettingsChange={setApiSettings}
                    dashboard={currentDashboard}
                    onDashboardSave={handleDashboardSave}
                    generatedWidgets={generatedWidgets}
                    onFullscreenToggle={toggleFullscreenEditor}
                    isFullscreen={isFullscreenEditor}
                  />
                </motion.div>
              </div>
            }
          />
        </div>

        {/* モバイル版: 従来のレイアウト */}
        <div className="lg:hidden h-full flex flex-col">
          <div className="flex-1 p-4">
            <ChatInterface 
              agentConfig={agentConfig}
              onConfigChange={setAgentConfig}
              onGenerateWidget={handleWidgetGeneration}
            />
          </div>
        </div>

        {/* モバイル用フローティング設定ボタン */}
        <button
          onClick={() => setSettingsMenuOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#1ABC9C] rounded-full flex items-center justify-center shadow-xl hover:bg-[#16A085] transition-colors z-50"
        >
          <Sliders className="w-6 h-6 text-white" />
        </button>

        {/* モバイル用設定パネル - フルスクリーンオーバーレイ */}
        {settingsMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setSettingsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 h-full w-full max-w-sm bg-gray-900 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">設定</h2>
                <button
                  onClick={() => setSettingsMenuOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              <div className="h-[calc(100%-4rem)]">
                <EditPanel 
                  agentConfig={agentConfig}
                  onConfigChange={setAgentConfig}
                  apiSettings={apiSettings}
                  onAPISettingsChange={setApiSettings}
                  dashboard={currentDashboard}
                  onDashboardSave={handleDashboardSave}
                  generatedWidgets={generatedWidgets}
                  onFullscreenToggle={toggleFullscreenEditor}
                  isFullscreen={isFullscreenEditor}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>

        {/* フルスクリーンエディターオーバーレイ */}
        {isFullscreenEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900 z-50 flex flex-col"
          >
            {/* フルスクリーンヘッダー */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/50 backdrop-blur-lg">
              <div className="flex items-center space-x-2">
                <Bot className="w-6 h-6 text-[#1ABC9C]" />
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#1ABC9C] to-[#3498DB] bg-clip-text text-transparent">
                  Conea AI - ダッシュボードエディター
                </h1>
              </div>
              <button
                onClick={toggleFullscreenEditor}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Minimize2 className="w-4 h-4" />
                <span>終了</span>
              </button>
            </div>

            {/* フルスクリーンコンテンツ */}
            <div className="flex-1 overflow-hidden">
              <EditPanel 
                agentConfig={agentConfig}
                onConfigChange={setAgentConfig}
                apiSettings={apiSettings}
                onAPISettingsChange={setApiSettings}
                dashboard={currentDashboard}
                onDashboardSave={handleDashboardSave}
                generatedWidgets={generatedWidgets}
                onFullscreenToggle={toggleFullscreenEditor}
                isFullscreen={isFullscreenEditor}
              />
            </div>
          </motion.div>
        )}
    </div>
    </ProtectedRoute>
  );
}