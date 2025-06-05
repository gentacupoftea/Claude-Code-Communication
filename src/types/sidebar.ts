export interface ProjectFolder {
  id: string;
  name: string;
  type: 'project' | 'chat' | 'folder';
  icon?: string;
  children?: ProjectFolder[];
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    description?: string;
    tags?: string[];
    color?: string;
  };
}

// 互換性のためのエイリアス
export type SidebarProject = ProjectFolder;

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  path?: string;
  action?: () => void;
  children?: SidebarItem[];
  badge?: number | string;
  isActive?: boolean;
}

export interface SidebarSection {
  id: string;
  title: string;
  items: SidebarItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}