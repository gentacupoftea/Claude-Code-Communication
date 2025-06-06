'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Database, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Book,
  Loader2,
  Download
} from 'lucide-react';
import { backendAPI } from '@/src/lib/backend-api';

interface LearningDataFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  records?: number;
}

interface LearningDataPanelProps {
  onDataUpload?: (files: File[]) => void;
}

export const LearningDataPanel: React.FC<LearningDataPanelProps> = ({ onDataUpload }) => {
  const [uploadedFiles, setUploadedFiles] = useState<LearningDataFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // コンポーネントマウント時に学習データを読み込み
  useEffect(() => {
    const loadLearningData = async () => {
      try {
        const data = await backendAPI.getLearningData();
        const formattedData: LearningDataFile[] = (data as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          name: item.fileName as string,
          size: item.fileSize as number,
          type: item.fileType as string,
          uploadedAt: new Date(item.uploadedAt as string),
          status: item.status as 'uploading' | 'processing' | 'completed' | 'error',
          records: item.records as number
        }));
        setUploadedFiles(formattedData);
      } catch (error) {
        console.error('Failed to load learning data:', error);
      }
    };
    
    loadLearningData();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    onDataUpload?.(fileArray);

    // ファイルリストに追加
    const newFiles: LearningDataFile[] = fileArray.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.name.split('.').pop() || 'unknown',
      uploadedAt: new Date(),
      status: 'uploading',
      records: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // 実際のアップロード処理
    for (const [index, file] of fileArray.entries()) {
      const fileData = newFiles[index];
      
      try {
        // アップロード状態を処理中に更新
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileData.id 
              ? { ...f, status: 'processing' }
              : f
          )
        );
        
        // バックエンドにアップロード
        const result = await backendAPI.uploadLearningData(file);
        
        // 成功状態に更新
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileData.id 
              ? { ...f, status: 'completed' as const, records: (result as unknown as { file: { records: number } }).file.records }
              : f
          )
        );
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        
        // エラー状態に更新
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileData.id 
              ? { ...f, status: 'error' }
              : f
          )
        );
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const deleteFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getStatusIcon = (status: LearningDataFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: LearningDataFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'アップロード中...';
      case 'processing':
        return '処理中...';
      case 'completed':
        return '完了';
      case 'error':
        return 'エラー';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
    >
      {/* ヘッダー */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center space-x-2 mb-3">
          <Book className="w-5 h-5 text-[#1ABC9C]" />
          <h3 className="text-lg font-semibold text-white">学習データ管理</h3>
        </div>
        <p className="text-sm text-gray-400">
          CSVやJSONファイルをアップロードして、AIの学習データとして使用できます
        </p>
      </div>

      {/* アップロードエリア */}
      <div className="p-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver
              ? 'border-[#1ABC9C] bg-[#1ABC9C]/10'
              : 'border-white/20 hover:border-white/40'
          }`}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <p className="text-white font-medium mb-2">
            ファイルをドラッグ&ドロップ、または
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#1ABC9C] hover:bg-[#16A085] text-white px-4 py-2 rounded-lg transition-colors"
          >
            ファイルを選択
          </button>
          <p className="text-xs text-gray-400 mt-2">
            CSV, JSON, TXT形式をサポート (最大10MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            accept=".csv,.json,.txt"
          />
        </div>
      </div>

      {/* ファイルリスト */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-medium text-white">アップロード済みファイル</h4>
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-[#1ABC9C]" />
            <span className="text-sm text-gray-400">
              {uploadedFiles.filter(f => f.status === 'completed').length} ファイル
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {uploadedFiles.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 rounded-lg p-3 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-[#1ABC9C]" />
                  <div>
                    <p className="text-sm font-medium text-white">{file.name}</p>
                    <div className="flex items-center space-x-3 text-xs text-gray-400">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{file.type.toUpperCase()}</span>
                      {file.records && (
                        <span>{file.records.toLocaleString()} レコード</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(file.status)}
                    <span className="text-xs text-gray-400">
                      {getStatusText(file.status)}
                    </span>
                  </div>
                  
                  {file.status === 'completed' && (
                    <button
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="ダウンロード"
                    >
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => deleteFile(file.id)}
                    className="p-1 hover:bg-red-600/20 rounded transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* プログレスバー */}
              {(file.status === 'uploading' || file.status === 'processing') && (
                <div className="mt-2">
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div 
                      className="bg-[#1ABC9C] h-1 rounded-full transition-all duration-300"
                      style={{ 
                        width: file.status === 'uploading' ? '30%' : '70%' 
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {uploadedFiles.length === 0 && (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">アップロードされたファイルはありません</p>
            </div>
          )}
        </div>
      </div>

      {/* 統計情報 */}
      <div className="p-4 border-t border-white/10">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-white">
              {uploadedFiles.filter(f => f.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-400">完了ファイル</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">
              {uploadedFiles
                .filter(f => f.status === 'completed')
                .reduce((sum, f) => sum + (f.records || 0), 0)
                .toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">総レコード数</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">
              {formatFileSize(
                uploadedFiles
                  .filter(f => f.status === 'completed')
                  .reduce((sum, f) => sum + f.size, 0)
              )}
            </p>
            <p className="text-xs text-gray-400">総容量</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};