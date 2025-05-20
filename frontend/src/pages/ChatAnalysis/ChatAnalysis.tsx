import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Grid,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  useTheme,
  alpha,
  CircularProgress,
} from '@mui/material';
import {
  ChatBubbleLeftRightIcon,
  UserIcon,
  CpuChipIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  BookmarkIcon,
  ArrowUturnLeftIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { mainLayout } from '../../layouts/MainLayout';
import { SalesChart } from '../Dashboard/components/SalesChart';
import { DataTable } from '../../molecules/DataTable/DataTable';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  data?: any;
  visualization?: 'chart' | 'table' | 'metrics';
}

interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: React.ElementType;
}

const quickPrompts: QuickPrompt[] = [
  {
    id: '1',
    label: '売上推移',
    prompt: '過去30日間の売上推移を見せて',
    icon: ChartBarIcon,
  },
  {
    id: '2',
    label: 'トップ商品',
    prompt: '売れ筋商品トップ10を教えて',
    icon: SparklesIcon,
  },
  {
    id: '3',
    label: 'プラットフォーム比較',
    prompt: '各プラットフォームの売上を比較して',
    icon: DocumentTextIcon,
  },
];

const ChatAnalysisComponent: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [aiModel, setAiModel] = useState('claude');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // モックデータを初期化
  useEffect(() => {
    const loadMockData = async () => {
      try {
        const mockData = await import('../../utils/mockData');
        const mockMessages = mockData.mockChatMessages;
        
        const convertedMessages: ChatMessage[] = mockMessages.map(msg => ({
          id: msg.id,
          type: msg.type === 'assistant' ? 'ai' : 'user',
          content: msg.message,
          timestamp: msg.timestamp,
          data: msg.attachments?.[0]?.data,
          visualization: msg.attachments?.[0]?.type as any,
        }));
        
        setMessages(convertedMessages);
      } catch (error) {
        console.error('Failed to load mock data:', error);
      }
    };
    loadMockData();
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // AI応答のシミュレーション
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '過去30日間の売上データを分析しました。',
        timestamp: new Date(),
        visualization: 'chart',
        data: [
          { date: '2024-01-01', amount: 45000 },
          { date: '2024-01-02', amount: 52000 },
          { date: '2024-01-03', amount: 48000 },
          { date: '2024-01-04', amount: 56000 },
          { date: '2024-01-05', amount: 61000 },
        ],
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderVisualization = (message: ChatMessage) => {
    if (!message.visualization) return null;

    switch (message.visualization) {
      case 'chart':
        return (
          <Box sx={{ mt: 2, height: 300 }}>
            <SalesChart data={message.data || []} />
          </Box>
        );
      case 'table':
        return (
          <Box sx={{ mt: 2 }}>
            <DataTable
              data={message.data?.items || []}
              columns={[
                { id: 'name', label: '商品名' },
                { id: 'sales', label: '売上' },
                { id: 'quantity', label: '数量' },
              ]}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Grid container spacing={3} sx={{ height: 'calc(100vh - 64px)' }}>
      {/* チャット履歴サイドバー */}
      {showHistory && (
        <Grid item xs={12} md={3}>
          <Paper
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
            }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6">{t('chatAnalysis.history.title')}</Typography>
            </Box>
            <List sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              <ListItem sx={{ cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
                <ListItemText
                  primary="売上分析 - 2024年1月"
                  secondary="1時間前"
                />
              </ListItem>
              <ListItem sx={{ cursor: 'pointer', borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
                <ListItemText
                  primary="在庫レポート"
                  secondary="昨日"
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      )}

      {/* メインチャットエリア */}
      <Grid item xs={12} md={showHistory ? 9 : 12}>
        <Paper
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
          }}
        >
          {/* ヘッダー */}
          <Box
            sx={{
              p: 2,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={() => setShowHistory(!showHistory)}>
                <ArrowUturnLeftIcon style={{ width: 20, height: 20 }} />
              </IconButton>
              <Typography variant="h6">{t('chatAnalysis.title')}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('chatAnalysis.aiModel')}</InputLabel>
              <Select
                value={aiModel}
                label={t('chatAnalysis.aiModel')}
                onChange={(e) => setAiModel(e.target.value)}
              >
                <MenuItem value="claude">Claude</MenuItem>
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="gemini">Gemini</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* メッセージエリア */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            {messages.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <ChatBubbleLeftRightIcon
                  style={{
                    width: 64,
                    height: 64,
                    color: theme.palette.text.secondary,
                    marginBottom: 16,
                  }}
                />
                <Typography variant="h5" color="text.secondary" sx={{ mb: 3 }}>
                  {t('chatAnalysis.emptyState.title')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  {t('chatAnalysis.emptyState.description')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {quickPrompts.map((prompt) => (
                    <Chip
                      key={prompt.id}
                      label={prompt.label}
                      icon={<prompt.icon style={{ width: 16, height: 16 }} />}
                      variant="outlined"
                      onClick={() => handleQuickPrompt(prompt.prompt)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              <List>
                {messages.map((message) => (
                  <ListItem
                    key={message.id}
                    sx={{
                      flexDirection: 'column',
                      alignItems: message.type === 'user' ? 'flex-end' : 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2, width: '100%', maxWidth: 600 }}>
                      {message.type === 'ai' && (
                        <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                          <CpuChipIcon style={{ width: 20, height: 20 }} />
                        </Avatar>
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: message.type === 'user'
                              ? alpha(theme.palette.primary.main, 0.1)
                              : theme.palette.background.paper,
                            borderRadius: 2,
                          }}
                        >
                          <Typography>{message.content}</Typography>
                          {renderVisualization(message)}
                        </Paper>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 1, display: 'block' }}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </Typography>
                      </Box>
                      {message.type === 'user' && (
                        <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>
                          <UserIcon style={{ width: 20, height: 20 }} />
                        </Avatar>
                      )}
                    </Box>
                  </ListItem>
                ))}
                {isLoading && (
                  <ListItem>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <CircularProgress size={20} />
                      <Typography color="text.secondary">
                        {t('chatAnalysis.loading')}
                      </Typography>
                    </Box>
                  </ListItem>
                )}
              </List>
            )}
          </Box>

          {/* 入力エリア */}
          <Box sx={{ p: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('chatAnalysis.input.placeholder')}
                variant="outlined"
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isLoading}
                      color="primary"
                    >
                      <PaperAirplaneIcon style={{ width: 20, height: 20 }} />
                    </IconButton>
                  ),
                }}
              />
              <IconButton
                color="primary"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.2),
                  },
                }}
              >
                <BookmarkIcon style={{ width: 20, height: 20 }} />
              </IconButton>
            </Box>
            {/* クイックプロンプト */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {quickPrompts.map((prompt) => (
                <Chip
                  key={prompt.id}
                  label={prompt.label}
                  size="small"
                  icon={<prompt.icon style={{ width: 16, height: 16 }} />}
                  onClick={() => handleQuickPrompt(prompt.prompt)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export const ChatAnalysis = mainLayout(ChatAnalysisComponent);