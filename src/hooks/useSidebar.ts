import { useState, useCallback, useEffect } from 'react';
import { SidebarState, SidebarActions, SidebarProject, SidebarFolder } from '@/src/types/sidebar';

const STORAGE_KEY = 'conea-sidebar-state';

const initialState: SidebarState = {
  isCollapsed: false,
  selectedProjectId: undefined,
  searchQuery: '',
  activeFilter: 'all',
  sections: [
    {
      id: 'recent',
      title: '最近のプロジェクト',
      folders: [],
      isCollapsed: false,
      order: 0,
      maxRecentItems: 5
    },
    {
      id: 'starred',
      title: 'スター付き',
      folders: [],
      isCollapsed: false,
      order: 1
    },
    {
      id: 'projects',
      title: 'プロジェクト',
      folders: [
        {
          id: 'default',
          name: 'マイプロジェクト',
          projects: [],
          isExpanded: true,
          isCollapsible: false,
          order: 0,
          color: '#1ABC9C'
        }
      ],
      isCollapsed: false,
      order: 2,
      showCreateButton: true
    },
    {
      id: 'analytics',
      title: 'アナリティクス',
      folders: [
        {
          id: 'analytics-default',
          name: 'データ分析',
          projects: [],
          isExpanded: true,
          isCollapsible: false,
          order: 0,
          color: '#3498DB'
        }
      ],
      isCollapsed: false,
      order: 3,
      showCreateButton: true
    }
  ],
  recentProjects: [],
  starredProjects: []
};

// デモ用のサンプルプロジェクト
const sampleProjects: SidebarProject[] = [
  {
    id: '1',
    name: 'AI チャットボット開発',
    description: 'カスタマーサポート用のAIチャットボット',
    lastAccessed: new Date(Date.now() - 3600000),
    isStarred: true,
    tags: ['AI', 'チャット', 'カスタマーサポート'],
    type: 'chat',
    icon: '🤖',
    color: '#1ABC9C',
    chatCount: 24,
    lastMessage: 'エラーハンドリングについて質問があります',
    isActive: true
  },
  {
    id: '2',
    name: '売上データ分析',
    description: '四半期売上の詳細分析とレポート作成',
    lastAccessed: new Date(Date.now() - 7200000),
    isStarred: false,
    tags: ['分析', '売上', 'レポート'],
    type: 'analytics',
    icon: '📊',
    color: '#3498DB',
    chatCount: 12,
    lastMessage: 'グラフの形式を変更しましょう'
  },
  {
    id: '3',
    name: 'マーケティング戦略',
    description: '新商品のマーケティング戦略立案',
    lastAccessed: new Date(Date.now() - 86400000),
    isStarred: true,
    tags: ['マーケティング', '戦略', '新商品'],
    type: 'notebook',
    icon: '📝',
    color: '#E74C3C',
    chatCount: 8,
    lastMessage: 'ターゲット層の分析結果は？'
  },
  {
    id: '4',
    name: 'システムダッシュボード',
    description: 'リアルタイムシステム監視ダッシュボード',
    lastAccessed: new Date(Date.now() - 172800000),
    isStarred: false,
    tags: ['ダッシュボード', '監視', 'システム'],
    type: 'dashboard',
    icon: '📈',
    color: '#F39C12',
    chatCount: 5,
    lastMessage: 'アラート設定を追加しました'
  }
];

export function useSidebar(): SidebarState & SidebarActions {
  const [state, setState] = useState<SidebarState>(() => {
    // ローカルストレージから状態を復元
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...initialState,
            ...parsed,
            // サンプルプロジェクトを追加
            sections: initialState.sections.map((section: any) => {
              if (section.id === 'projects') {
                return {
                  ...section,
                  folders: section.folders.map((folder: any) => ({
                    ...folder,
                    projects: sampleProjects.filter(p => p.type === 'chat' || p.type === 'notebook')
                  }))
                };
              }
              if (section.id === 'analytics') {
                return {
                  ...section,
                  folders: section.folders.map((folder: any) => ({
                    ...folder,
                    projects: sampleProjects.filter(p => p.type === 'analytics' || p.type === 'dashboard')
                  }))
                };
              }
              return section;
            }),
            recentProjects: sampleProjects.slice(0, 3),
            starredProjects: sampleProjects.filter(p => p.isStarred)
          };
        }
      } catch (error) {
        console.error('Failed to load sidebar state:', error);
      }
    }
    
    // 初期状態にサンプルプロジェクトを追加
    return {
      ...initialState,
      sections: initialState.sections.map((section: any) => {
        if (section.id === 'projects') {
          return {
            ...section,
            folders: section.folders.map((folder: any) => ({
              ...folder,
              projects: sampleProjects.filter(p => p.type === 'chat' || p.type === 'notebook')
            }))
          };
        }
        if (section.id === 'analytics') {
          return {
            ...section,
            folders: section.folders.map(folder => ({
              ...folder,
              projects: sampleProjects.filter(p => p.type === 'analytics' || p.type === 'dashboard')
            }))
          };
        }
        return section;
      }),
      recentProjects: sampleProjects.slice(0, 3),
      starredProjects: sampleProjects.filter(p => p.isStarred)
    };
  });

  // 状態をローカルストレージに保存
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save sidebar state:', error);
      }
    }
  }, [state]);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? { ...section, isCollapsed: !section.isCollapsed }
          : section
      )
    }));
  }, []);

  const toggleFolder = useCallback((folderId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        folders: section.folders.map(folder =>
          folder.id === folderId
            ? { ...folder, isExpanded: !folder.isExpanded }
            : folder
        )
      }))
    }));
  }, []);

  const selectProject = useCallback((projectId: string) => {
    setState(prev => {
      // 最近のプロジェクトリストを更新
      const allProjects = prev.sections.flatMap(s => s.folders.flatMap(f => f.projects));
      const selectedProject = allProjects.find(p => p.id === projectId);
      
      if (selectedProject) {
        const updatedRecent = [
          { ...selectedProject, lastAccessed: new Date() },
          ...prev.recentProjects.filter(p => p.id !== projectId)
        ].slice(0, 5);

        return {
          ...prev,
          selectedProjectId: projectId,
          recentProjects: updatedRecent
        };
      }

      return { ...prev, selectedProjectId: projectId };
    });
  }, []);

  const createProject = useCallback((type: SidebarProject['type'], folderId?: string) => {
    const newProject: SidebarProject = {
      id: `project-${Date.now()}`,
      name: `新しい${type === 'chat' ? 'チャット' : type === 'analytics' ? '分析' : type === 'dashboard' ? 'ダッシュボード' : 'ノートブック'}`,
      description: '',
      lastAccessed: new Date(),
      isStarred: false,
      tags: [],
      type,
      chatCount: 0,
      color: type === 'chat' ? '#1ABC9C' : type === 'analytics' ? '#3498DB' : type === 'dashboard' ? '#F39C12' : '#E74C3C'
    };

    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        folders: section.folders.map(folder => {
          if (folderId && folder.id === folderId) {
            return { ...folder, projects: [...folder.projects, newProject] };
          }
          if (!folderId && folder.id === 'default' && (type === 'chat' || type === 'notebook')) {
            return { ...folder, projects: [...folder.projects, newProject] };
          }
          if (!folderId && folder.id === 'analytics-default' && (type === 'analytics' || type === 'dashboard')) {
            return { ...folder, projects: [...folder.projects, newProject] };
          }
          return folder;
        })
      })),
      selectedProjectId: newProject.id,
      recentProjects: [newProject, ...prev.recentProjects.slice(0, 4)]
    }));
  }, []);

  const starProject = useCallback((projectId: string) => {
    setState(prev => {
      const allProjects = prev.sections.flatMap(s => s.folders.flatMap(f => f.projects));
      const project = allProjects.find(p => p.id === projectId);
      
      return {
        ...prev,
        sections: prev.sections.map(section => ({
          ...section,
          folders: section.folders.map(folder => ({
            ...folder,
            projects: folder.projects.map(p =>
              p.id === projectId ? { ...p, isStarred: true } : p
            )
          }))
        })),
        starredProjects: project && !project.isStarred 
          ? [...prev.starredProjects, { ...project, isStarred: true }]
          : prev.starredProjects
      };
    });
  }, []);

  const unstarProject = useCallback((projectId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        folders: section.folders.map(folder => ({
          ...folder,
          projects: folder.projects.map(p =>
            p.id === projectId ? { ...p, isStarred: false } : p
          )
        }))
      })),
      starredProjects: prev.starredProjects.filter(p => p.id !== projectId)
    }));
  }, []);

  const moveProject = useCallback((projectId: string, targetFolderId: string) => {
    setState(prev => {
      const allProjects = prev.sections.flatMap(s => s.folders.flatMap(f => f.projects));
      const project = allProjects.find(p => p.id === projectId);
      
      if (!project) return prev;

      return {
        ...prev,
        sections: prev.sections.map(section => ({
          ...section,
          folders: section.folders.map(folder => {
            if (folder.id === targetFolderId) {
              return { ...folder, projects: [...folder.projects, project] };
            }
            return { ...folder, projects: folder.projects.filter(p => p.id !== projectId) };
          })
        }))
      };
    });
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        folders: section.folders.map(folder => ({
          ...folder,
          projects: folder.projects.filter(p => p.id !== projectId)
        }))
      })),
      recentProjects: prev.recentProjects.filter(p => p.id !== projectId),
      starredProjects: prev.starredProjects.filter(p => p.id !== projectId),
      selectedProjectId: prev.selectedProjectId === projectId ? undefined : prev.selectedProjectId
    }));
  }, []);

  const updateProject = useCallback((projectId: string, updates: Partial<SidebarProject>) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        folders: section.folders.map(folder => ({
          ...folder,
          projects: folder.projects.map(p =>
            p.id === projectId ? { ...p, ...updates } : p
          )
        }))
      })),
      recentProjects: prev.recentProjects.map(p =>
        p.id === projectId ? { ...p, ...updates } : p
      ),
      starredProjects: prev.starredProjects.map(p =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setFilter = useCallback((filter: SidebarState['activeFilter']) => {
    setState(prev => ({ ...prev, activeFilter: filter }));
  }, []);

  const createFolder = useCallback((sectionId: string, name: string) => {
    const newFolder: SidebarFolder = {
      id: `folder-${Date.now()}`,
      name,
      projects: [],
      isExpanded: true,
      isCollapsible: true,
      order: 999,
      color: '#6B7280'
    };

    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section =>
        section.id === sectionId
          ? { ...section, folders: [...section.folders, newFolder] }
          : section
      )
    }));
  }, []);

  const deleteFolder = useCallback((folderId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => ({
        ...section,
        folders: section.folders.filter(f => f.id !== folderId)
      }))
    }));
  }, []);

  const renameFolder = useCallback((folderId: string, newName: string) => {
    setState((prev: SidebarState) => ({
      ...prev,
      sections: prev.sections.map((section: any) => ({
        ...section,
        folders: section.folders.map((folder: any) =>
          folder.id === folderId ? { ...folder, name: newName } : folder
        )
      }))
    }));
  }, []);

  return {
    ...state,
    toggleSidebar,
    toggleSection,
    toggleFolder,
    selectProject,
    createProject,
    starProject,
    unstarProject,
    moveProject,
    deleteProject,
    updateProject,
    setSearchQuery,
    setFilter,
    createFolder,
    deleteFolder,
    renameFolder
  };
}