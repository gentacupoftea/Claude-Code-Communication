import React, { useState } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, Paper } from '@mui/material';
import RealtimeChatFirebase from '../components/RealtimeChat/RealtimeChatFirebase';
import RealtimeChatOrchestrator from '../components/RealtimeChat/RealtimeChatOrchestrator';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';

const Chat: React.FC = () => {
  // Mock user ID (実際の実装では認証から取得)
  const userId = 'user_123';
  
  // Toggle between demo and orchestrator - デフォルトをorchestratorに
  const [chatMode, setChatMode] = useState<'demo' | 'orchestrator'>('orchestrator');
  
  // Redux stateから現在のプロジェクト/タスクを取得可能
  // const currentProject = useSelector((state: RootState) => state.projects.current);
  // const currentTask = useSelector((state: RootState) => state.tasks.current);
  
  const handleModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: 'demo' | 'orchestrator' | null,
  ) => {
    if (newMode !== null) {
      setChatMode(newMode);
    }
  };
  
  return (
    <Box sx={{ 
      height: 'calc(100vh - 64px)', // TopBarの高さを引く
      overflow: 'hidden',
      margin: -3, // 親コンポーネントのpaddingを相殀
      mt: 0, // マージントップをリセット
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Paper sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">チャットモード</Typography>
          <ToggleButtonGroup
            value={chatMode}
            exclusive
            onChange={handleModeChange}
            size="small"
          >
            <ToggleButton value="demo">
              デモ (Firebase)
            </ToggleButton>
            <ToggleButton value="orchestrator">
              AI (Orchestrator)
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>
      
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {chatMode === 'demo' ? (
          <RealtimeChatFirebase
            userId={userId}
            initialContext={{
              projectId: "proj_001",
              projectName: "MultiLLM Demo",
              taskId: "task_001",
              taskName: "チャット機能テスト"
            }}
          />
        ) : (
          <RealtimeChatOrchestrator
            userId={userId}
            initialContext={{
              projectId: "proj_001",
              projectName: "MultiLLM Demo",
              taskId: "task_001",
              taskName: "チャット機能テスト"
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default Chat;