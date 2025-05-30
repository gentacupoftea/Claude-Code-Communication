import { create } from 'zustand';
import { FileService, FileData } from '../services/fileService';

interface FileStore {
  files: FileData[];
  currentPath: string;
  isLoading: boolean;
  error: string | null;
  
  // アクション
  uploadFile: (file: File, parentPath: string) => Promise<void>;
  createFolder: (name: string, parentPath: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  getFilesInPath: (path: string) => FileData[];
  searchFiles: (query: string) => Promise<FileData[]>;
  setCurrentPath: (path: string) => void;
  loadFiles: () => Promise<void>;
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  currentPath: '/',
  isLoading: false,
  error: null,

  uploadFile: async (file: File, parentPath: string) => {
    set({ isLoading: true, error: null });
    try {
      const fileData = await FileService.uploadFile(file, parentPath);
      set((state) => ({
        files: [...state.files, fileData],
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'アップロードに失敗しました',
        isLoading: false,
      });
    }
  },

  createFolder: async (name: string, parentPath: string) => {
    set({ isLoading: true, error: null });
    try {
      const folderData = await FileService.createFolder(name, parentPath);
      set((state) => ({
        files: [...state.files, folderData],
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'フォルダの作成に失敗しました',
        isLoading: false,
      });
    }
  },

  deleteFile: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await FileService.deleteFile(id);
      const file = get().files.find((f) => f.id === id);
      
      if (file?.type === 'folder') {
        // フォルダの場合は配下のファイルも削除
        set((state) => ({
          files: state.files.filter(
            (f) => f.id !== id && !f.path.startsWith(file.path + '/')
          ),
          isLoading: false,
        }));
      } else {
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
          isLoading: false,
        }));
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '削除に失敗しました',
        isLoading: false,
      });
    }
  },

  getFilesInPath: (path: string) => {
    const files = get().files;
    
    // 指定されたパス直下のファイル・フォルダのみを取得
    return files.filter((file) => {
      const filePath = file.path;
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      return parentPath === path;
    });
  },

  searchFiles: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const results = await FileService.searchFiles(query);
      set({ isLoading: false });
      return results;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '検索に失敗しました',
        isLoading: false,
      });
      return [];
    }
  },

  setCurrentPath: (path: string) => {
    set({ currentPath: path });
  },

  loadFiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const files = await FileService.getFilesInPath('/');
      set({ files, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'ファイルの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },
}));