import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    llmProvider?: string;
    tokensUsed?: number;
    referencedFiles?: string[];
    thinking?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  projectId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    systemPrompt?: string;
    apiSettings?: Record<string, any>;
    tags?: string[];
  };
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  projectId: string;
  url?: string;
  processingStatus?: 'uploading' | 'processing' | 'completed' | 'error';
  progress?: number;
  metadata?: {
    rows?: number;
    columns?: string[];
    summary?: string;
    indexed?: boolean;
  };
}

export interface ProjectFolder {
  id: string;
  name: string;
  parentId: string | null;
  children: ProjectFolder[];
  systemPrompt?: string;
  apiSettings?: {
    shopify?: {
      enabled: boolean;
      apiKey: string;
      storeUrl: string;
      accessToken: string;
    };
    amazon?: {
      enabled: boolean;
      sellerId: string;
      authToken: string;
      marketplaceId: string;
    };
    rakuten?: {
      enabled: boolean;
      serviceSecret: string;
      licenseKey: string;
    };
    nextengine?: {
      enabled: boolean;
      uid: string;
      pwd: string;
    };
    custom?: {
      [name: string]: {
        enabled: boolean;
        url: string;
        headers: { [key: string]: string };
      };
    };
  };
  promptVariables?: { [key: string]: string };
  files?: ProjectFile[];
  chats?: ChatSession[];
  isExpanded?: boolean;
  color?: string;
  icon?: string;
}

interface ProjectStore {
  // State
  folders: ProjectFolder[];
  currentProjectId: string | null;
  currentChatId: string | null;
  chatSessions: ChatSession[];
  files: ProjectFile[];
  sidebarOpen: boolean;
  
  // Actions - Folders
  createFolder: (parentId: string, name: string) => void;
  updateFolder: (folderId: string, updates: Partial<ProjectFolder>) => void;
  deleteFolder: (folderId: string) => void;
  selectProject: (projectId: string) => void;
  
  // Actions - Chat Sessions
  createChatSession: (projectId: string, title?: string) => string;
  updateChatSession: (chatId: string, updates: Partial<ChatSession>) => void;
  deleteChatSession: (chatId: string) => void;
  selectChat: (chatId: string) => void;
  
  // Actions - Messages
  addMessage: (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  
  // Actions - Files
  addFile: (projectId: string, file: Omit<ProjectFile, 'id' | 'uploadedAt' | 'projectId'>) => void;
  updateFile: (fileId: string, updates: Partial<ProjectFile>) => void;
  deleteFile: (fileId: string) => void;
  
  // Actions - UI
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Getters
  getCurrentProject: () => ProjectFolder | null;
  getCurrentChat: () => ChatSession | null;
  getProjectFiles: (projectId: string) => ProjectFile[];
  getProjectChats: (projectId: string) => ChatSession[];
  searchChats: (query: string) => ChatSession[];
  
  // Utilities
  generateChatTitle: (messages: ChatMessage[]) => string;
  exportProject: (projectId: string) => any;
  importProject: (data: any) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial State
      folders: [
        {
          id: 'root',
          name: 'プロジェクト',
          parentId: null,
          children: [],
        },
      ],
      currentProjectId: null,
      currentChatId: null,
      chatSessions: [],
      files: [],
      sidebarOpen: true,

      // Folder Actions
      createFolder: (parentId: string, name: string) => {
        const newFolder: ProjectFolder = {
          id: `folder-${Date.now()}`,
          name,
          parentId,
          children: [],
          systemPrompt: '',
          apiSettings: {},
          promptVariables: {},
        };

        set((state) => ({
          folders: addFolderToParent(state.folders, parentId, newFolder),
        }));
      },

      updateFolder: (folderId: string, updates: Partial<ProjectFolder>) => {
        set((state) => ({
          folders: updateFolderById(state.folders, folderId, updates),
        }));
      },

      deleteFolder: (folderId: string) => {
        set((state) => ({
          folders: deleteFolderById(state.folders, folderId),
          currentProjectId: state.currentProjectId === folderId ? null : state.currentProjectId,
        }));
      },

      selectProject: (projectId: string) => {
        set({ currentProjectId: projectId, currentChatId: null });
      },

      // Chat Session Actions
      createChatSession: (projectId: string, title?: string) => {
        const chatId = `chat-${Date.now()}`;
        const newChat: ChatSession = {
          id: chatId,
          title: title || '新しいチャット',
          projectId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          chatSessions: [...state.chatSessions, newChat],
          currentChatId: chatId,
        }));

        return chatId;
      },

      updateChatSession: (chatId: string, updates: Partial<ChatSession>) => {
        set((state) => ({
          chatSessions: state.chatSessions.map((chat) =>
            chat.id === chatId
              ? { ...chat, ...updates, updatedAt: new Date() }
              : chat
          ),
        }));
      },

      deleteChatSession: (chatId: string) => {
        set((state) => ({
          chatSessions: state.chatSessions.filter((chat) => chat.id !== chatId),
          currentChatId: state.currentChatId === chatId ? null : state.currentChatId,
        }));
      },

      selectChat: (chatId: string) => {
        set({ currentChatId: chatId });
      },

      // Message Actions
      addMessage: (chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg-${Date.now()}`,
          timestamp: new Date(),
        };

        set((state) => ({
          chatSessions: state.chatSessions.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                  updatedAt: new Date(),
                }
              : chat
          ),
        }));

        // Auto-generate title for new chats
        const chat = get().chatSessions.find((c) => c.id === chatId);
        if (chat && chat.messages.length === 2 && chat.title === '新しいチャット') {
          const generatedTitle = get().generateChatTitle(chat.messages);
          get().updateChatSession(chatId, { title: generatedTitle });
        }
      },

      updateMessage: (chatId: string, messageId: string, updates: Partial<ChatMessage>) => {
        set((state) => ({
          chatSessions: state.chatSessions.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }));
      },

      deleteMessage: (chatId: string, messageId: string) => {
        set((state) => ({
          chatSessions: state.chatSessions.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.filter((msg) => msg.id !== messageId),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }));
      },

      // File Actions
      addFile: (projectId: string, file: Omit<ProjectFile, 'id' | 'uploadedAt' | 'projectId'>) => {
        const newFile: ProjectFile = {
          ...file,
          id: `file-${Date.now()}`,
          projectId,
          uploadedAt: new Date(),
        };

        set((state) => ({
          files: [...state.files, newFile],
        }));
      },

      updateFile: (fileId: string, updates: Partial<ProjectFile>) => {
        set((state) => ({
          files: state.files.map((file) =>
            file.id === fileId ? { ...file, ...updates } : file
          ),
        }));
      },

      deleteFile: (fileId: string) => {
        set((state) => ({
          files: state.files.filter((file) => file.id !== fileId),
        }));
      },

      // UI Actions
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open: boolean) => {
        set({ sidebarOpen: open });
      },

      // Getters
      getCurrentProject: () => {
        const state = get();
        if (!state.currentProjectId) return null;
        return findFolderById(state.folders, state.currentProjectId);
      },

      getCurrentChat: () => {
        const state = get();
        if (!state.currentChatId) return null;
        return state.chatSessions.find((chat) => chat.id === state.currentChatId) || null;
      },

      getProjectFiles: (projectId: string) => {
        const state = get();
        return state.files.filter((file) => file.projectId === projectId);
      },

      getProjectChats: (projectId: string) => {
        const state = get();
        return state.chatSessions.filter((chat) => chat.projectId === projectId);
      },

      searchChats: (query: string) => {
        const state = get();
        const lowercaseQuery = query.toLowerCase();
        return state.chatSessions.filter(
          (chat) =>
            chat.title.toLowerCase().includes(lowercaseQuery) ||
            chat.messages.some((msg) =>
              msg.content.toLowerCase().includes(lowercaseQuery)
            )
        );
      },

      // Utilities
      generateChatTitle: (messages: ChatMessage[]) => {
        const userMessage = messages.find((msg) => msg.role === 'user');
        if (!userMessage) return '新しいチャット';
        
        const content = userMessage.content;
        if (content.length <= 30) return content;
        
        // Extract first sentence or first 30 characters
        const firstSentence = content.split(/[.!?。！？]/, 1)[0];
        if (firstSentence.length <= 30) return firstSentence;
        
        return content.substring(0, 27) + '...';
      },

      exportProject: (projectId: string) => {
        const state = get();
        const project = findFolderById(state.folders, projectId);
        const files = state.getProjectFiles(projectId);
        const chats = state.getProjectChats(projectId);
        
        return {
          project,
          files,
          chats,
          exportedAt: new Date().toISOString(),
        };
      },

      importProject: (data: any) => {
        if (data.project && data.files && data.chats) {
          set((state) => ({
            folders: [...state.folders, data.project],
            files: [...state.files, ...data.files],
            chatSessions: [...state.chatSessions, ...data.chats],
          }));
        }
      },
    }),
    {
      name: 'conea-project-store',
      partialize: (state) => ({
        folders: state.folders,
        chatSessions: state.chatSessions,
        files: state.files,
        currentProjectId: state.currentProjectId,
        currentChatId: state.currentChatId,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// Helper functions
function findFolderById(folders: ProjectFolder[], id: string): ProjectFolder | null {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const found = findFolderById(folder.children, id);
    if (found) return found;
  }
  return null;
}

function addFolderToParent(
  folders: ProjectFolder[],
  parentId: string,
  newFolder: ProjectFolder
): ProjectFolder[] {
  return folders.map((folder) => {
    if (folder.id === parentId) {
      return {
        ...folder,
        children: [...folder.children, newFolder],
      };
    }
    return {
      ...folder,
      children: addFolderToParent(folder.children, parentId, newFolder),
    };
  });
}

function updateFolderById(
  folders: ProjectFolder[],
  folderId: string,
  updates: Partial<ProjectFolder>
): ProjectFolder[] {
  return folders.map((folder) => {
    if (folder.id === folderId) {
      return { ...folder, ...updates };
    }
    return {
      ...folder,
      children: updateFolderById(folder.children, folderId, updates),
    };
  });
}

function deleteFolderById(folders: ProjectFolder[], folderId: string): ProjectFolder[] {
  return folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) => ({
      ...folder,
      children: deleteFolderById(folder.children, folderId),
    }));
}