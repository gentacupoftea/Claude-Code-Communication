'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileAudio, 
  FileVideo,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Mic,
  Clock,
  Users
} from 'lucide-react';
import { meetingAPI, MeetingStatus, MeetingResult } from '@/src/lib/meeting-api';

interface MeetingUploadPanelProps {
  onUploadComplete?: (result: MeetingResult) => void;
}

export const MeetingUploadPanel: React.FC<MeetingUploadPanelProps> = ({ onUploadComplete }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [status, setStatus] = useState<MeetingStatus | null>(null);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    // ファイルタイプチェック
    const supportedTypes = ['audio/', 'video/'];
    if (!supportedTypes.some(type => file.type.startsWith(type))) {
      setError('音声または動画ファイルを選択してください');
      return;
    }

    setUploadedFile(file);
    setError(null);
    
    // 自動アップロード開始
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      // ファイルアップロード
      const uploadResponse = await meetingAPI.uploadMeeting(file, {
        language: 'ja',
        generateSummary: true,
        analyzeContent: true
      });

      setMeetingId(uploadResponse.id);

      // 処理完了を待つ
      const result = await meetingAPI.waitForCompletion(uploadResponse.id, {
        pollingInterval: 3000,
        onProgress: (status) => {
          setStatus(status);
        }
      });

      setResult(result);
      onUploadComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const exportResult = async (format: 'txt' | 'pdf' | 'docx') => {
    if (!meetingId || !result) return;

    try {
      const blob = await meetingAPI.exportMeeting(meetingId, {
        format,
        includeTimestamps: true,
        includeSpeakers: true,
        includeSummary: true,
        includeAnalysis: true
      });

      // ダウンロード
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${meetingId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_err) {
      setError('エクスポートに失敗しました');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
          <Mic className="w-5 h-5 text-[#1ABC9C]" />
          <h3 className="text-lg font-semibold text-white">会議録アップロード</h3>
        </div>
        <p className="text-sm text-gray-400">
          音声・動画ファイルをアップロードして、自動文字起こし・要約・分析を行います
        </p>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">
        {!result ? (
          <>
            {/* アップロードエリア */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isUploading ? 'border-gray-600 bg-gray-800/50' : 'border-white/20 hover:border-[#1ABC9C]'
              }`}
            >
              {isUploading ? (
                <div className="space-y-4">
                  <Loader2 className="w-12 h-12 text-[#1ABC9C] mx-auto animate-spin" />
                  <p className="text-white font-medium">
                    {status?.status === 'processing' ? '処理中...' : 'アップロード中...'}
                  </p>
                  {status?.progress && (
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div 
                        className="bg-[#1ABC9C] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${status.progress}%` }}
                      />
                    </div>
                  )}
                  {status?.message && (
                    <p className="text-sm text-gray-400">{status.message}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-center space-x-4 mb-4">
                    <FileAudio className="w-10 h-10 text-gray-400" />
                    <FileVideo className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-white font-medium mb-2">
                    ファイルをドラッグ&ドロップ、または
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#1ABC9C] hover:bg-[#16A085] text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    ファイルを選択
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    対応形式: MP3, WAV, M4A, MP4, MOV, AVI (最大100MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    accept="audio/*,video/*"
                  />
                </>
              )}
            </div>

            {/* エラー表示 */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-red-600/20 border border-red-600/50 rounded-lg flex items-center space-x-2"
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}
          </>
        ) : (
          /* 結果表示 */
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* 成功メッセージ */}
              <div className="p-4 bg-green-600/20 border border-green-600/50 rounded-lg flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">処理が完了しました</p>
                  <p className="text-sm text-green-300">{uploadedFile?.name}</p>
                </div>
              </div>

              {/* メタデータ */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <Clock className="w-4 h-4 text-[#1ABC9C]" />
                    <span className="text-xs text-gray-400">録音時間</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {formatDuration(result.metadata.duration)}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <Users className="w-4 h-4 text-[#1ABC9C]" />
                    <span className="text-xs text-gray-400">話者数</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {result.metadata.speakers}人
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <FileAudio className="w-4 h-4 text-[#1ABC9C]" />
                    <span className="text-xs text-gray-400">言語</span>
                  </div>
                  <p className="text-lg font-medium text-white">
                    {result.metadata.language === 'ja' ? '日本語' : result.metadata.language}
                  </p>
                </div>
              </div>

              {/* 要約 */}
              {result.summary && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-md font-medium text-white mb-3">要約</h4>
                  <h5 className="text-lg font-semibold text-[#1ABC9C] mb-2">{result.summary.title}</h5>
                  <p className="text-sm text-gray-300 mb-4">{result.summary.overview}</p>
                  
                  {result.summary.keyPoints.length > 0 && (
                    <div className="mb-4">
                      <h6 className="text-sm font-medium text-white mb-2">主要ポイント</h6>
                      <ul className="space-y-1">
                        {result.summary.keyPoints.map((point, index) => (
                          <li key={index} className="text-sm text-gray-400 flex items-start">
                            <span className="text-[#1ABC9C] mr-2">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.summary.actionItems && result.summary.actionItems.length > 0 && (
                    <div>
                      <h6 className="text-sm font-medium text-white mb-2">アクションアイテム</h6>
                      <ul className="space-y-1">
                        {result.summary.actionItems.map((item, index) => (
                          <li key={index} className="text-sm text-gray-400 flex items-start">
                            <span className="text-[#1ABC9C] mr-2">□</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* エクスポートボタン */}
              <div className="flex space-x-3">
                <button
                  onClick={() => exportResult('txt')}
                  className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">テキスト</span>
                </button>
                <button
                  onClick={() => exportResult('pdf')}
                  className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">PDF</span>
                </button>
                <button
                  onClick={() => exportResult('docx')}
                  className="flex-1 flex items-center justify-center space-x-2 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Word</span>
                </button>
              </div>

              {/* 新規アップロードボタン */}
              <button
                onClick={() => {
                  setResult(null);
                  setUploadedFile(null);
                  setMeetingId(null);
                  setStatus(null);
                }}
                className="w-full py-2 px-4 bg-[#1ABC9C] hover:bg-[#16A085] rounded-lg transition-colors"
              >
                新しいファイルをアップロード
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};