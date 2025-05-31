/**
 * Dashboard Context - ダッシュボード状態管理
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: Date;
}

interface DashboardStats {
  totalUsers: number;
  activeProjects: number;
  apiCalls: number;
  revenue: number;
  activeAgents?: number;
  alertCount?: number;
  slackConnected?: boolean;
  uptime?: string;
}

interface DashboardContextType {
  notifications: Notification[];
  stats: DashboardStats;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateStats: (stats: Partial<DashboardStats>) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'API Key Limit Warning',
      message: 'Claude API key is approaching monthly limit (85% used)',
      type: 'warning',
      read: false,
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: '2',
      title: 'New User Registration',
      message: 'New user registered: developer@example.com',
      type: 'info',
      read: false,
      timestamp: new Date(Date.now() - 7200000),
    },
    {
      id: '3',
      title: 'System Update Complete',
      message: 'Dashboard system update completed successfully',
      type: 'success',
      read: true,
      timestamp: new Date(Date.now() - 86400000),
    },
  ]);

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 156,
    activeProjects: 12,
    apiCalls: 24567,
    revenue: 15420,
    activeAgents: 3,
    alertCount: 2,
    slackConnected: true,
    uptime: '24h 15m',
  });

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const updateStats = (newStats: Partial<DashboardStats>) => {
    setStats(prev => ({ ...prev, ...newStats }));
  };

  const value: DashboardContextType = {
    notifications,
    stats,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    updateStats,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};