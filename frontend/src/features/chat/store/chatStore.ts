import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatStore {
  chats: Record<string, Chat>;
  activeChats: string[];
  createChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  getChat: (chatId: string) => Chat | undefined;
  clearAllChats: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: {},
      activeChats: [],

      createChat: (chatId: string) => {
        set((state) => ({
          chats: {
            ...state.chats,
            [chatId]: {
              id: chatId,
              title: '新しいチャット',
              messages: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          activeChats: [chatId, ...state.activeChats.filter(id => id !== chatId)],
        }));
      },

      deleteChat: (chatId: string) => {
        set((state) => {
          const { [chatId]: _, ...restChats } = state.chats;
          return {
            chats: restChats,
            activeChats: state.activeChats.filter(id => id !== chatId),
          };
        });
      },

      updateChatTitle: (chatId: string, title: string) => {
        set((state) => ({
          chats: {
            ...state.chats,
            [chatId]: state.chats[chatId]
              ? {
                  ...state.chats[chatId],
                  title,
                  updatedAt: new Date(),
                }
              : state.chats[chatId],
          },
        }));
      },

      addMessage: (chatId: string, message: ChatMessage) => {
        set((state) => ({
          chats: {
            ...state.chats,
            [chatId]: state.chats[chatId]
              ? {
                  ...state.chats[chatId],
                  messages: [...state.chats[chatId].messages, message],
                  updatedAt: new Date(),
                }
              : state.chats[chatId],
          },
        }));
      },

      getChat: (chatId: string) => {
        return get().chats[chatId];
      },

      clearAllChats: () => {
        set({ chats: {}, activeChats: [] });
      },
    }),
    {
      name: 'conea-chat-store',
      partialize: (state) => ({
        chats: state.chats,
        activeChats: state.activeChats,
      }),
    }
  )
);