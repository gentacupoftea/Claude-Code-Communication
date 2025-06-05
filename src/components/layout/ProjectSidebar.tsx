'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search, 
  Home,
  MessageSquare,
  FolderOpen,
  Settings,
  LogOut,
  MoreVertical,
  Edit2,
  Trash2,
  Star,
  Archive
} from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ProjectFolder, SidebarItem } from '@/src/types/sidebar';

interface ProjectSidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ 
  isCollapsed = false, 
  onToggleCollapse 
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    itemId: string;
  } | null>(null);

  // デモ用のプロジェクトデータ
  useEffect(() => {
    const demoProjects: ProjectFolder[] = [
      {
        id: '1',
        name: 'AIエージェントチーム作成プロジェクト',
        type: 'folder',
        createdAt: '2025-05-20',
        updatedAt: '2025-05-31',
        children: [
          {
            id: '1-1',
            name: '１週間の行動計画',
            type: 'chat',
            parentId: '1',
            createdAt: '2025-05-25',
            updatedAt: '2025-05-31',
          },
          {
            id: '1-2',
            name: 'BigQueryクレンジング',
            type: 'chat',
            parentId: '1',
            createdAt: '2025-05-28',
            updatedAt: '2025-05-30',
          },
        ],
      },
      {
        id: '2',
        name: 'Gmail自動返信BOT',
        type: 'project',
        createdAt: '2025-05-15',
        updatedAt: '2025-05-29',
      },
      {
        id: '3',
        name: 'Shopify Login Navigation Fix',
        type: 'chat',
        createdAt: '2025-05-31',
        updatedAt: '2025-05-31',
        metadata: {
          tags: ['urgent', 'bug-fix'],
        },
      },
    ];
    setProjects(demoProjects);
  }, []);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleItemClick = (item: ProjectFolder) => {
    setSelectedItem(item.id);
    if (item.type === 'chat' || item.type === 'project') {
      router.push(`/projects/${item.id}`);
    } else if (item.type === 'folder') {
      toggleFolder(item.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      itemId,
    });
  };

  const renderProjectItem = (item: ProjectFolder, depth = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const isSelected = selectedItem === item.id;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id}>
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`
            group flex items-center px-3 py-2 rounded-lg cursor-pointer
            transition-all duration-200
            ${isSelected 
              ? 'bg-[#1ABC9C]/20 text-[#1ABC9C]' 
              : 'hover:bg-white/5 text-gray-300 hover:text-white'
            }
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item.id)}
        >
          {/* アイコン */}
          <div className="flex items-center mr-2">
            {item.type === 'folder' && hasChildren && (
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
                className="mr-1"
              >
                <ChevronRight className="w-4 h-4" />
              </motion.div>
            )}
            {item.type === 'chat' && <MessageSquare className="w-4 h-4" />}
            {item.type === 'project' && <FolderOpen className="w-4 h-4" />}
            {item.type === 'folder' && !hasChildren && <FolderOpen className="w-4 h-4" />}
          </div>

          {/* 名前 */}
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-sm">{item.name}</span>
              
              {/* アクションボタン */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, item.id);
                  }}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* 子要素 */}
        {hasChildren && isExpanded && !isCollapsed && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {item.children!.map(child => renderProjectItem(child, depth + 1))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
  };

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <motion.aside
        animate={{ 
          width: isCollapsed ? 64 : 280,
          transform: window.innerWidth < 768 && !isCollapsed ? 'translateX(0)' : undefined
        }}
        transition={{ duration: 0.3 }}
        className="bg-gray-900/50 backdrop-blur-lg border-r border-white/10 h-full flex flex-col md:relative fixed md:translate-x-0 z-40"
        style={{
          transform: typeof window !== 'undefined' && window.innerWidth < 768 && !isCollapsed ? 'translateX(-100%)' : undefined
        }}
      >
        {/* ヘッダー */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <motion.h2 
              animate={{ opacity: isCollapsed ? 0 : 1 }}
              className="text-lg font-semibold text-white"
            >
              プロジェクト
            </motion.h2>
            <button
              onClick={onToggleCollapse}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <motion.div
                animate={{ rotate: isCollapsed ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </motion.div>
            </button>
          </div>
        </div>

        {/* 検索バー */}
        {!isCollapsed && (
          <div className="p-4 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg
                         text-sm text-white placeholder-gray-400
                         focus:outline-none focus:border-[#1ABC9C] transition-colors"
              />
            </div>
          </div>
        )}

        {/* プロジェクトリスト */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {!isCollapsed && (
            <>
              {/* 新規作成ボタン */}
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full flex items-center px-3 py-2 mb-4
                         bg-[#1ABC9C] hover:bg-[#16A085] rounded-lg
                         text-white font-medium transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                新規プロジェクト
              </button>

              {/* プロジェクト一覧 */}
              <div className="space-y-1">
                {filteredProjects.map(project => renderProjectItem(project))}
              </div>

              {filteredProjects.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-8">
                  プロジェクトが見つかりません
                </p>
              )}
            </>
          )}

          {/* 折りたたみ時のアイコン表示 */}
          {isCollapsed && (
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full p-3 hover:bg-white/10 rounded-lg transition-colors"
                title="新規プロジェクト"
              >
                <Plus className="w-5 h-5 text-[#1ABC9C] mx-auto" />
              </button>
              {projects.slice(0, 5).map(project => (
                <button
                  key={project.id}
                  onClick={() => handleItemClick(project)}
                  className="w-full p-3 hover:bg-white/10 rounded-lg transition-colors"
                  title={project.name}
                >
                  {project.type === 'chat' && <MessageSquare className="w-5 h-5 text-gray-400 mx-auto" />}
                  {project.type === 'project' && <FolderOpen className="w-5 h-5 text-gray-400 mx-auto" />}
                  {project.type === 'folder' && <FolderOpen className="w-5 h-5 text-gray-400 mx-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-white/10 p-4">
          {!isCollapsed ? (
            <div className="space-y-2">
              <button
                onClick={() => router.push('/settings')}
                className="w-full flex items-center px-3 py-2 text-gray-300 hover:text-white
                         hover:bg-white/5 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4 mr-2" />
                設定
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center px-3 py-2 text-gray-300 hover:text-white
                         hover:bg-white/5 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                ログアウト
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => router.push('/settings')}
                className="w-full p-3 hover:bg-white/10 rounded-lg transition-colors"
                title="設定"
              >
                <Settings className="w-5 h-5 text-gray-400 mx-auto" />
              </button>
              <button
                onClick={logout}
                className="w-full p-3 hover:bg-white/10 rounded-lg transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-5 h-5 text-gray-400 mx-auto" />
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* コンテキストメニュー */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 bg-gray-800 border border-white/10 rounded-lg shadow-xl p-1"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded">
                <Edit2 className="w-4 h-4 mr-2" />
                名前を変更
              </button>
              <button className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded">
                <Star className="w-4 h-4 mr-2" />
                お気に入りに追加
              </button>
              <button className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded">
                <Archive className="w-4 h-4 mr-2" />
                アーカイブ
              </button>
              <div className="my-1 border-t border-white/10" />
              <button className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/10 rounded">
                <Trash2 className="w-4 h-4 mr-2" />
                削除
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};