import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  TextField,
  InputAdornment,
  Typography,
  Fab,
  Divider,
  Paper,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useChatStore } from '../../store/chatStore';
import { MultiLLMChat } from '../MultiLLMChat/MultiLLMChat';

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

export const ChatPanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const { chats, createChat, deleteChat, updateChatTitle } = useChatStore();

  // ダミーデータ（実際の実装では削除）
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'データ分析の相談',
      lastMessage: '売上データの傾向を分析してください',
      timestamp: new Date(),
      messageCount: 5,
    },
    {
      id: '2',
      title: 'グラフ作成について',
      lastMessage: '相関行列を作成する方法を教えて',
      timestamp: new Date(Date.now() - 86400000),
      messageCount: 12,
    },
  ]);

  const filteredChats = chatSessions.filter(
    (chat) =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: '新しいチャット',
      lastMessage: '',
      timestamp: new Date(),
      messageCount: 0,
    };
    setChatSessions([newChat, ...chatSessions]);
    setSelectedChatId(newChat.id);
    setShowChat(true);
    createChat(newChat.id);
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setShowChat(true);
  };

  const handleDeleteChat = (chatId: string) => {
    setChatSessions(chatSessions.filter((chat) => chat.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
      setShowChat(false);
    }
    deleteChat(chatId);
  };

  const handleEditTitle = (chatId: string, newTitle: string) => {
    setChatSessions(
      chatSessions.map((chat) =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      )
    );
    updateChatTitle(chatId, newTitle);
  };

  if (showChat && selectedChatId) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <IconButton
            onClick={() => setShowChat(false)}
            size="small"
            sx={{ mb: 1 }}
          >
            ← 戻る
          </IconButton>
          <Typography variant="h6">
            {chatSessions.find((c) => c.id === selectedChatId)?.title}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <MultiLLMChat chatId={selectedChatId} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 検索バー */}
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="チャットを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              '&.Mui-focused fieldset': {
                borderColor: '#34d399',
              },
            },
          }}
        />
      </Box>

      <Divider />

      {/* チャットリスト */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <List sx={{ p: 0 }}>
          {filteredChats.map((chat) => (
            <ListItem
              key={chat.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChat(chat.id);
                  }}
                  size="small"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                onClick={() => handleSelectChat(chat.id)}
                selected={selectedChatId === chat.id}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(52, 211, 153, 0.08)',
                    '&:hover': {
                      backgroundColor: 'rgba(52, 211, 153, 0.12)',
                    },
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">{chat.title}</Typography>
                      <Chip
                        label={chat.messageCount}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.75rem',
                          bgcolor: 'rgba(52, 211, 153, 0.1)',
                          color: '#34d399',
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {chat.lastMessage || 'メッセージなし'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(chat.timestamp, 'MM/dd HH:mm', { locale: ja })}
                      </Typography>
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {filteredChats.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
            }}
          >
            <Typography color="text.secondary" variant="body2">
              {searchQuery
                ? '検索結果が見つかりませんでした'
                : 'チャットがありません'}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 新規チャット作成ボタン */}
      <Box sx={{ p: 2 }}>
        <Fab
          color="primary"
          variant="extended"
          onClick={handleNewChat}
          sx={{
            width: '100%',
            bgcolor: '#34d399',
            '&:hover': {
              bgcolor: '#2dc08a',
            },
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          新しいチャット
        </Fab>
      </Box>
    </Box>
  );
};