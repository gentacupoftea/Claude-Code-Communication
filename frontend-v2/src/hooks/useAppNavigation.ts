'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * useAppNavigation - アプリケーション全体で統一されたナビゲーション管理
 * window.location.hrefの代わりにNext.jsのルーターを使用
 */
export const useAppNavigation = () => {
  const router = useRouter();

  const navigateTo = useCallback((path: string) => {
    console.log('[Navigation] Navigating to:', path);
    router.push(path);
  }, [router]);

  const navigateToNewProject = useCallback(() => {
    console.log('[Navigation] Creating new project');
    navigateTo('/create');
  }, [navigateTo]);

  const navigateToChatbotSettings = useCallback(() => {
    console.log('[Navigation] Opening chatbot settings');
    navigateTo('/projects/chatbot');
  }, [navigateTo]);

  const navigateToAnalyticsSettings = useCallback(() => {
    console.log('[Navigation] Opening analytics settings');
    navigateTo('/projects/analytics');
  }, [navigateTo]);

  const navigateToPredictionSettings = useCallback(() => {
    console.log('[Navigation] Opening prediction settings');
    navigateTo('/projects/prediction');
  }, [navigateTo]);

  const navigateToHome = useCallback(() => {
    console.log('[Navigation] Going to home');
    navigateTo('/');
  }, [navigateTo]);

  const navigateToDashboard = useCallback(() => {
    console.log('[Navigation] Going to dashboard');
    navigateTo('/dashboard');
  }, [navigateTo]);

  const navigateToLogin = useCallback(() => {
    console.log('[Navigation] Going to login');
    navigateTo('/login');
  }, [navigateTo]);

  const navigateToAnalytics = useCallback(() => {
    console.log('[Navigation] Going to analytics');
    navigateTo('/analytics');
  }, [navigateTo]);

  const navigateToSettings = useCallback(() => {
    console.log('[Navigation] Going to settings');
    navigateTo('/settings');
  }, [navigateTo]);

  return {
    navigateTo,
    navigateToNewProject,
    navigateToChatbotSettings,
    navigateToAnalyticsSettings,
    navigateToPredictionSettings,
    navigateToHome,
    navigateToDashboard,
    navigateToLogin,
    navigateToAnalytics,
    navigateToSettings,
  };
};