import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
}

interface ChatHistory {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  category: 'today' | 'yesterday' | 'week' | 'older';
}

interface SidebarState {
  isCollapsed: boolean;
  projects: Project[];
  chatHistory: ChatHistory[];
  activeProjectId: string | null;
  
  // アクション
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveProject: (projectId: string) => void;
  addProject: (project: Omit<Project, 'isActive'>) => void;
  removeProject: (projectId: string) => void;
  addChatHistory: (chat: Omit<ChatHistory, 'category'>) => void;
  removeChatHistory: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
}

// チャット履歴のカテゴリ分類
const categorizeChat = (timestamp: Date): ChatHistory['category'] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (timestamp >= today) return 'today';
  if (timestamp >= yesterday) return 'yesterday';
  if (timestamp >= weekAgo) return 'week';
  return 'older';
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, _get) => ({
      isCollapsed: false,
      projects: [
        {
          id: '1',
          name: 'チャットボット',
          icon: '🤖',
          isActive: true
        },
        {
          id: '2',
          name: '予測分析',
          icon: '📊',
          isActive: false
        },
        {
          id: '3',
          name: 'アナリティクス',
          icon: '📈',
          isActive: false
        }
      ],
      chatHistory: [],
      activeProjectId: '1',

      toggleSidebar: () => {
        set((state) => ({ isCollapsed: !state.isCollapsed }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ isCollapsed: collapsed });
      },

      setActiveProject: (projectId: string) => {
        set((state) => ({
          activeProjectId: projectId,
          projects: state.projects.map(project => ({
            ...project,
            isActive: project.id === projectId
          }))
        }));
      },

      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects, { ...project, isActive: false }]
        }));
      },

      removeProject: (projectId: string) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== projectId),
          activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId
        }));
      },

      addChatHistory: (chat) => {
        const category = categorizeChat(chat.timestamp);
        const newChat: ChatHistory = { ...chat, category };
        
        set((state) => ({
          chatHistory: [newChat, ...state.chatHistory].slice(0, 50) // 最新50件まで保持
        }));
      },

      removeChatHistory: (chatId: string) => {
        set((state) => ({
          chatHistory: state.chatHistory.filter(chat => chat.id !== chatId)
        }));
      },

      updateChatTitle: (chatId: string, title: string) => {
        set((state) => ({
          chatHistory: state.chatHistory.map(chat =>
            chat.id === chatId 
              ? { ...chat, title, preview: title.slice(0, 30) + (title.length > 30 ? '...' : '') }
              : chat
          )
        }));
      }
    }),
    {
      name: 'conea-sidebar-storage',
      partialize: (state) => ({ 
        isCollapsed: state.isCollapsed,
        projects: state.projects,
        activeProjectId: state.activeProjectId
      })
    }
  )
);