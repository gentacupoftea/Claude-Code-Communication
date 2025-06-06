'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Star,
  StarOff,
  MessageSquare,
  BarChart3,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Folder,
  Hash,
  Clock,
  Filter,
  Edit3,
  Trash2
} from 'lucide-react';
import { useSidebar } from '@/src/hooks/useSidebar';
import { SidebarProject } from '@/src/types/sidebar';
import { SidebarSectionState, SidebarFolder } from '@/src/types/sidebar-hook';

interface ClaudeSidebarProps {
  onProjectSelect?: (project: SidebarProject) => void;
}

export const ClaudeSidebar: React.FC<ClaudeSidebarProps> = ({ onProjectSelect }) => {
  const sidebar = useSidebar();
  const [contextMenu, setContextMenu] = useState<{
    type: 'project' | 'folder';
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const getProjectIcon = (type: SidebarProject['type']) => {
    switch (type) {
      case 'chat':
        return MessageSquare;
      case 'analytics':
        return BarChart3;
      case 'dashboard':
        return LayoutDashboard;
      case 'notebook':
        return FileText;
      default:
        return FileText;
    }
  };

  const handleProjectClick = (project: SidebarProject) => {
    sidebar.selectProject(project.id);
    onProjectSelect?.(project);
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'project' | 'folder', id: string) => {
    e.preventDefault();
    setContextMenu({
      type,
      id,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
    setContextMenu(null);
  };

  const handleRenameSubmit = () => {
    if (editingId && editingName.trim()) {
      if (contextMenu?.type === 'folder') {
        sidebar.renameFolder(editingId, editingName);
      } else {
        sidebar.updateProject(editingId, { name: editingName });
      }
    }
    setEditingId(null);
    setEditingName('');
  };

  const filteredProjects = (projects: SidebarProject[]) => {
    return projects.filter(project => {
      const matchesSearch = sidebar.searchQuery === '' || 
        project.name.toLowerCase().includes(sidebar.searchQuery.toLowerCase()) ||
        (project.metadata?.tags && project.metadata.tags.some((tag: string) => tag.toLowerCase().includes(sidebar.searchQuery.toLowerCase())));
      
      switch (sidebar.activeFilter) {
        case 'starred':
          return matchesSearch && project.isStarred;
        case 'recent':
          return matchesSearch && sidebar.recentProjects.some((rp: unknown) => (rp as { id: string }).id === project.id);
        case 'chat':
          return matchesSearch && project.type === 'chat';
        case 'analytics':
          return matchesSearch && (project.type === 'analytics' || project.type === 'dashboard');
        default:
          return matchesSearch;
      }
    });
  };

  const formatLastAccessed = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (hours < 1) return '今';
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex">
      {/* サイドバー */}
      <motion.div
        initial={false}
        animate={{
          width: sidebar.isCollapsed ? '60px' : '320px'
        }}
        className="bg-gray-900/95 backdrop-blur-lg border-r border-white/10 h-screen 
                   flex flex-col overflow-hidden relative"
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            {!sidebar.isCollapsed && (
              <h1 className="text-xl font-bold text-white">Conea AI</h1>
            )}
            <button
              onClick={sidebar.toggleSidebar}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {sidebar.isCollapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* 検索・フィルター */}
        {!sidebar.isCollapsed && (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="プロジェクトを検索..."
                value={sidebar.searchQuery}
                onChange={(e) => sidebar.setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2
                         text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                         focus:ring-[#1ABC9C] focus:border-transparent"
              />
            </div>
            
            <div className="flex space-x-2">
              {(['all', 'recent', 'starred', 'chat', 'analytics'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => sidebar.setFilter(filter)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    sidebar.activeFilter === filter
                      ? 'bg-[#1ABC9C] border-[#1ABC9C] text-white'
                      : 'border-white/20 text-gray-400 hover:border-white/30'
                  }`}
                >
                  {filter === 'all' ? '全て' : 
                   filter === 'recent' ? '最近' :
                   filter === 'starred' ? 'スター' :
                   filter === 'chat' ? 'チャット' : '分析'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* プロジェクトリスト */}
        <div className="flex-1 overflow-y-auto">
          {sidebar.sections.map((section: SidebarSectionState) => (
            <div key={section.id} className="mb-2">
              {!sidebar.isCollapsed && (
                <div className="px-4 py-2">
                  <button
                    onClick={() => sidebar.toggleSection(section.id)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                      {section.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {section.showCreateButton && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sidebar.createProject(
                              section.id === 'analytics' ? 'analytics' : 'chat'
                            );
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <Plus className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                      <ChevronDown 
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          section.isCollapsed ? '-rotate-90' : ''
                        }`} 
                      />
                    </div>
                  </button>
                </div>
              )}

              <AnimatePresence>
                {!section.isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* 最近のプロジェクト (special handling) */}
                    {section.id === 'recent' && sidebar.recentProjects.length > 0 && (
                      <div className="space-y-1 px-4">
                        {filteredProjects(sidebar.recentProjects).slice(0, section.maxRecentItems || 5).map((project) => {
                          const IconComponent = getProjectIcon(project.type);
                          const isSelected = sidebar.selectedProjectId === project.id;
                          
                          return (
                            <motion.div
                              key={project.id}
                              whileHover={{ x: 2 }}
                              className={`group relative`}
                            >
                              <button
                                onClick={() => handleProjectClick(project)}
                                onContextMenu={(e) => handleContextMenu(e, 'project', project.id)}
                                className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                                  isSelected
                                    ? 'bg-[#1ABC9C] text-white'
                                    : 'text-gray-300 hover:bg-white/5'
                                } ${sidebar.isCollapsed ? 'justify-center' : ''}`}
                              >
                                <div className="relative">
                                  <IconComponent className="w-4 h-4" />
                                  {project.isActive && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
                                  )}
                                </div>
                                
                                {!sidebar.isCollapsed && (
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium truncate">
                                        {project.name}
                                      </span>
                                      <div className="flex items-center space-x-1">
                                        <span className="text-xs opacity-60">
                                          {project.lastAccessed && formatLastAccessed(new Date(project.lastAccessed))}
                                        </span>
                                        {project.isStarred && (
                                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                        )}
                                      </div>
                                    </div>
                                    {project.lastMessage && (
                                      <p className="text-xs opacity-60 truncate mt-1">
                                        {project.lastMessage}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* スター付きプロジェクト */}
                    {section.id === 'starred' && sidebar.starredProjects.length > 0 && (
                      <div className="space-y-1 px-4">
                        {filteredProjects(sidebar.starredProjects).map((project) => {
                          const IconComponent = getProjectIcon(project.type);
                          const isSelected = sidebar.selectedProjectId === project.id;
                          
                          return (
                            <motion.div
                              key={project.id}
                              whileHover={{ x: 2 }}
                              className="group relative"
                            >
                              <button
                                onClick={() => handleProjectClick(project)}
                                onContextMenu={(e) => handleContextMenu(e, 'project', project.id)}
                                className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                                  isSelected
                                    ? 'bg-[#1ABC9C] text-white'
                                    : 'text-gray-300 hover:bg-white/5'
                                } ${sidebar.isCollapsed ? 'justify-center' : ''}`}
                              >
                                <IconComponent className="w-4 h-4" />
                                {!sidebar.isCollapsed && (
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium truncate">
                                        {project.name}
                                      </span>
                                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* フォルダ */}
                    {section.folders.map((folder: SidebarFolder) => (
                      <div key={folder.id} className="mb-2">
                        {!sidebar.isCollapsed && folder.isCollapsible && (
                          <div className="px-4">
                            <button
                              onClick={() => sidebar.toggleFolder(folder.id)}
                              onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                              className="flex items-center justify-between w-full text-left py-1"
                            >
                              <div className="flex items-center space-x-2">
                                <Folder className="w-4 h-4 text-gray-400" />
                                {editingId === folder.id ? (
                                  <input
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={handleRenameSubmit}
                                    onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
                                    className="bg-transparent text-sm text-gray-300 border-b border-white/20 
                                             focus:outline-none focus:border-[#1ABC9C]"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="text-sm text-gray-300">{folder.name}</span>
                                )}
                              </div>
                              <ChevronDown 
                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                  !folder.isExpanded ? '-rotate-90' : ''
                                }`} 
                              />
                            </button>
                          </div>
                        )}

                        <AnimatePresence>
                          {folder.isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="space-y-1 px-4"
                            >
                              {filteredProjects(folder.projects).map((project) => {
                                const IconComponent = getProjectIcon(project.type);
                                const isSelected = sidebar.selectedProjectId === project.id;
                                
                                return (
                                  <motion.div
                                    key={project.id}
                                    whileHover={{ x: 2 }}
                                    className="group relative"
                                  >
                                    <button
                                      onClick={() => handleProjectClick(project)}
                                      onContextMenu={(e) => handleContextMenu(e, 'project', project.id)}
                                      className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                                        isSelected
                                          ? 'bg-[#1ABC9C] text-white'
                                          : 'text-gray-300 hover:bg-white/5'
                                      } ${sidebar.isCollapsed ? 'justify-center' : ''}`}
                                    >
                                      <div className="relative">
                                        <IconComponent className="w-4 h-4" />
                                        {project.isActive && (
                                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
                                        )}
                                      </div>
                                      
                                      {!sidebar.isCollapsed && (
                                        <div className="flex-1 min-w-0">
                                          {editingId === project.id ? (
                                            <input
                                              value={editingName}
                                              onChange={(e) => setEditingName(e.target.value)}
                                              onBlur={handleRenameSubmit}
                                              onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
                                              className="bg-transparent text-sm font-medium border-b border-white/20 
                                                       focus:outline-none focus:border-[#1ABC9C] w-full"
                                              autoFocus
                                            />
                                          ) : (
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-medium truncate">
                                                {project.name}
                                              </span>
                                              <div className="flex items-center space-x-1">
                                                {project.chatCount !== undefined && project.chatCount > 0 && (
                                                  <span className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
                                                    {project.chatCount}
                                                  </span>
                                                )}
                                                {project.isStarred && (
                                                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          {!editingId && project.lastMessage && (
                                            <p className="text-xs opacity-60 truncate mt-1">
                                              {project.lastMessage}
                                            </p>
                                          )}
                                          {!editingId && project.metadata?.tags && project.metadata.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {project.metadata.tags.slice(0, 2).map((tag: string) => (
                                                <span
                                                  key={tag}
                                                  className="text-xs bg-white/5 px-1.5 py-0.5 rounded"
                                                >
                                                  #{tag}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </button>

                                    {/* ホバー時のアクション */}
                                    {!sidebar.isCollapsed && (
                                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 
                                                    opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (project.isStarred) {
                                              sidebar.unstarProject(project.id);
                                            } else {
                                              sidebar.starProject(project.id);
                                            }
                                          }}
                                          className="p-1 hover:bg-white/10 rounded"
                                        >
                                          {project.isStarred ? (
                                            <StarOff className="w-3 h-3 text-gray-400" />
                                          ) : (
                                            <Star className="w-3 h-3 text-gray-400" />
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </motion.div>

      {/* コンテキストメニュー */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bg-gray-800 border border-white/10 rounded-lg shadow-xl z-50 py-1"
            style={{
              left: contextMenu.x,
              top: contextMenu.y
            }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button
              onClick={() => handleRename(contextMenu.id, 
                contextMenu.type === 'folder' 
                  ? sidebar.sections.flatMap((s: SidebarSectionState) => s.folders).find((f: SidebarFolder) => f.id === contextMenu.id)?.name || ''
                  : sidebar.sections.flatMap((s: SidebarSectionState) => s.folders.flatMap((f: SidebarFolder) => f.projects)).find((p: SidebarProject) => p.id === contextMenu.id)?.name || ''
              )}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center space-x-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>名前を変更</span>
            </button>
            <button
              onClick={() => {
                if (contextMenu.type === 'folder') {
                  sidebar.deleteFolder(contextMenu.id);
                } else {
                  sidebar.deleteProject(contextMenu.id);
                }
                setContextMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>削除</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay for context menu */}
      {contextMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};