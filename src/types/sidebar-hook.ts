// useSidebar hook専用の型定義
import { ProjectFolder } from './sidebar';

// フォルダ構造の拡張型
export interface SidebarFolder {
  id: string;
  name: string;
  projects: ProjectFolder[];
  isExpanded: boolean;
  isCollapsible: boolean;
  order: number;
  color: string;
}

// セクション構造の拡張型
export interface SidebarSectionState {
  id: string;
  title: string;
  folders: SidebarFolder[];
  isCollapsed: boolean;
  order: number;
  maxRecentItems?: number;
  showCreateButton?: boolean;
}

// サイドバー全体の状態型
export interface SidebarState {
  isCollapsed: boolean;
  selectedProjectId?: string;
  searchQuery: string;
  activeFilter: 'all'; // 現状の実装では'all'のみ使用。将来的に 'starred' | 'recent' | 'archived' を追加予定
  sections: SidebarSectionState[];
  recentProjects: ProjectFolder[];
  starredProjects: ProjectFolder[];
}

// サイドバーアクション型
export interface SidebarActions {
  toggleSidebar: () => void;
  toggleSection: (sectionId: string) => void;
  toggleFolder: (folderId: string) => void;
  selectProject: (projectId: string) => void;
  createProject: (type: ProjectFolder['type'], folderId?: string) => void;
  starProject: (projectId: string) => void;
  unstarProject: (projectId: string) => void;
  moveProject: (projectId: string, targetFolderId: string) => void;
  deleteProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<ProjectFolder>) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: SidebarState['activeFilter']) => void;
  createFolder: (sectionId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  renameFolder: (folderId: string, newName: string) => void;
}

// useSidebarフックの戻り値型
export type UseSidebarReturn = SidebarState & SidebarActions;