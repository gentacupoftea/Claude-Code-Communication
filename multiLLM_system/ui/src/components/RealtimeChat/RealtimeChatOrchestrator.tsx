import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Avatar,
  CircularProgress,
  Chip,
  Collapse,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { keyframes } from '@mui/system';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import orchestratorChatService, { ChatMessage, ThinkingUpdate } from '../../services/orchestratorChatService';

interface RealtimeChatOrchestratorProps {
  userId: string;
  initialContext?: {
    projectId?: string;
    projectName?: string;
    taskId?: string;
    taskName?: string;
  };
}

// アニメーション定義
const pulse = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
`;

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const RealtimeChatOrchestrator: React.FC<RealtimeChatOrchestratorProps> = ({
  userId,
  initialContext = {}
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinking, setThinking] = useState<ThinkingUpdate | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orchestratorStatus, setOrchestratorStatus] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  // スクロール制御
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  // Orchestratorのステータスを定期的に取得
  useEffect(() => {
    const checkStatus = async () => {
      const status = await orchestratorChatService.getStatus();
      setOrchestratorStatus(status);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // 30秒ごと

    return () => clearInterval(interval);
  }, []);

  // メッセージ購読の初期化
  useEffect(() => {
    const unsubscribeMessages = orchestratorChatService.subscribeToMessages(
      initialContext,
      (message) => {
        setMessages(prev => {
          const existing = prev.find(m => m.id === message.id);
          if (existing) {
            // 既存メッセージを更新
            return prev.map(m => m.id === message.id ? message : m);
          } else {
            // 新規メッセージを追加
            return [...prev, message];
          }
        });
        
        // 送信完了時にローディングを解除
        if (message.role === 'assistant' && message.status === 'sent') {
          setIsLoading(false);
          setThinking(null);
        }
      },
      (initialMessages) => {
        setMessages(initialMessages);
      }
    );

    const unsubscribeThinking = orchestratorChatService.subscribeToThinking(
      initialContext,
      (update) => {
        setThinking(update);
      }
    );

    return () => {
      unsubscribeMessages();
      unsubscribeThinking();
    };
  }, [initialContext]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setThinking(null);
    
    const messageContent = inputValue;
    setInputValue('');

    try {
      const messageId = await orchestratorChatService.sendMessage(
        messageContent,
        initialContext
      );
      setCurrentMessageId(messageId);
    } catch (err) {
      setError('メッセージの送信に失敗しました');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const isSending = message.status === 'sending';
    const isError = message.status === 'error';

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
          opacity: isSending ? 0.7 : 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            maxWidth: '70%',
          }}
        >
          <Avatar
            sx={{
              bgcolor: isUser ? 'primary.main' : 'secondary.main',
              width: 36,
              height: 36,
              mx: 1,
            }}
          >
            {isUser ? <PersonIcon /> : <BotIcon />}
          </Avatar>
          
          <Paper
            elevation={1}
            sx={{
              p: 2,
              backgroundColor: isUser
                ? 'primary.main'
                : isError
                ? 'error.light'
                : 'background.paper',
              color: isUser ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
              position: 'relative',
              ...(isSending && {
                animation: `${pulse} 1.5s ease-in-out infinite`,
              }),
            }}
          >
            {!isUser && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 1 }}>
                  AI Assistant
                </Typography>
                {isSending && (
                  <CircularProgress size={12} thickness={4} sx={{ ml: 1 }} />
                )}
                {message.status === 'sent' && (
                  <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', ml: 1 }} />
                )}
                {isError && (
                  <ErrorIcon sx={{ fontSize: 14, color: 'error.main', ml: 1 }} />
                )}
              </Box>
            )}
            
            {isUser ? (
              <Typography variant="body1">{message.content}</Typography>
            ) : (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !className;
                    return !isInline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
            
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 1,
                opacity: 0.7,
                fontSize: '0.7rem',
              }}
            >
              {new Date(message.timestamp).toLocaleTimeString()}
            </Typography>
          </Paper>
        </Box>
      </Box>
    );
  };

  const renderThinking = () => {
    if (!thinking) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Paper
          elevation={2}
          sx={{
            p: 2,
            backgroundColor: 'background.default',
            borderLeft: '4px solid',
            borderColor: 'info.main',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                sx={{
                  animation: `${rotate} 2s linear infinite`,
                  display: 'flex',
                  alignItems: 'center',
                  mr: 1,
                }}
              >
                <PsychologyIcon sx={{ color: 'info.main' }} />
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {thinking.type.icon} {thinking.type.label}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setShowThinking(!showThinking)}
            >
              {showThinking ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {thinking.stage}
          </Typography>

          <Collapse in={showThinking}>
            {thinking.steps && thinking.steps.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {thinking.steps.map((step, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      mb: 0.5,
                      pl: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        minWidth: 20,
                        mr: 1,
                      }}
                    >
                      {index + 1}.
                    </Typography>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption">
                        {step.description}
                      </Typography>
                      {step.detail && (
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            color: 'text.secondary',
                            fontSize: '0.7rem',
                            mt: 0.5,
                          }}
                        >
                          {step.detail}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Collapse>
        </Paper>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {/* ヘッダー */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">AI Chat (Orchestrator)</Typography>
            {initialContext.projectName && (
              <Typography variant="caption" color="text.secondary">
                {initialContext.projectName}
                {initialContext.taskName && ` / ${initialContext.taskName}`}
              </Typography>
            )}
          </Box>
          {orchestratorStatus && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="small"
                label={orchestratorStatus.status === 'healthy' ? 'Connected' : 'Disconnected'}
                color={orchestratorStatus.status === 'healthy' ? 'success' : 'error'}
                variant="outlined"
              />
              {orchestratorStatus.orchestrator && (
                <Typography variant="caption" color="text.secondary">
                  Workers: {Object.keys(orchestratorStatus.orchestrator.workers).length}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* メッセージエリア */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.50',
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary',
            }}
          >
            <BotIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6" gutterBottom>
              AI Orchestratorチャット
            </Typography>
            <Typography variant="body2" align="center">
              質問を入力すると、最適なAI Workerが回答を生成します
            </Typography>
          </Box>
        )}

        {messages.map(renderMessage)}
        {thinking && renderThinking()}
        <div ref={messagesEndRef} />
      </Box>

      {/* 入力エリア */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          borderRadius: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            sx={{ ml: 1 }}
          >
            {isLoading ? (
              <CircularProgress size={24} />
            ) : (
              <SendIcon />
            )}
          </IconButton>
        </Box>
      </Paper>

      {/* エラー通知 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RealtimeChatOrchestrator;