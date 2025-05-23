import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Chip,
  Paper,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  Send as SendIcon,
  Stop as StopIcon,
  Folder as ProjectIcon,
  Task as TaskIcon,
  Psychology as ThinkingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import firebaseChatService, { ChatMessage, ThinkingUpdate } from '../../services/firebaseChatServiceDebug';

// Types
interface Message extends ChatMessage {
  streaming?: boolean;
  context?: ChatContext;
  interrupted?: boolean;
}

interface ChatContext {
  projectId?: string;
  taskId?: string;
  projectName?: string;
  taskName?: string;
}

interface ThinkingStep {
  description: string;
  detail?: string;
  timestamp: Date;
}

interface RealtimeChatProps {
  userId: string;
  initialContext?: ChatContext;
}

// marked設定（シンプルな設定）
marked.setOptions({
  breaks: true,
  gfm: true,
});

const RealtimeChatFirebase: React.FC<RealtimeChatProps> = ({ userId, initialContext }) => {
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showThinkingProcess, setShowThinkingProcess] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [currentContext, setCurrentContext] = useState<ChatContext>(initialContext || {});
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [isComposing, setIsComposing] = useState(false);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const thinkingUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // 履歴を取得
    const loadHistory = async () => {
      const history = await firebaseChatService.getChatHistory(currentContext);
      setMessages(history.map(msg => ({ ...msg, streaming: false })));
    };

    loadHistory();

    // メッセージの監視を開始
    unsubscribeRef.current = firebaseChatService.subscribeToMessages(
      currentContext,
      (message: ChatMessage) => {
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.id === message.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = { 
              ...message, 
              streaming: message.status === 'sending',
              context: currentContext 
            };
            return updated;
          }
          return [...prev, { 
            ...message, 
            streaming: message.status === 'sending',
            context: currentContext 
          }];
        });
        
        // ストリーミング完了時
        if (message.status === 'sent' && message.role === 'assistant') {
          setIsStreaming(false);
          setThinkingSteps([]);
          thinkingUnsubscribeRef.current?.();
        }
      }
    );

    return () => {
      unsubscribeRef.current?.();
      thinkingUnsubscribeRef.current?.();
    };
  }, [currentContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingSteps]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const content = input.trim();
    setInput('');
    setIsStreaming(true);

    try {
      const messageId = await firebaseChatService.sendMessage(content, currentContext);
      
      if (showThinkingProcess) {
        // 思考プロセスの監視を開始
        thinkingUnsubscribeRef.current = firebaseChatService.subscribeToThinking(
          messageId,
          (update: ThinkingUpdate) => {
            setThinkingSteps(update.steps || []);
          }
        );
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
    }
  };

  const handleInterrupt = () => {
    if (isStreaming) {
      // Firebase版では中断機能は現在未実装
      setIsStreaming(false);
      thinkingUnsubscribeRef.current?.();
      setThinkingSteps([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // IME変換中の場合は何もしない
    if (isComposing) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape' && isStreaming) {
      handleInterrupt();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';
    const content = message.streaming ? message.content + '▊' : message.content;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            mb: 2,
          }}
        >
          <Box
            sx={{
              maxWidth: '70%',
              display: 'flex',
              flexDirection: isUser ? 'row-reverse' : 'row',
              gap: 2,
            }}
          >
            <Avatar
              sx={{
                bgcolor: isUser ? theme.palette.primary.main : theme.palette.secondary.main,
                width: 32,
                height: 32,
              }}
            >
              {isUser ? 'U' : 'A'}
            </Avatar>
            
            <Paper
              elevation={1}
              sx={{
                p: 2,
                bgcolor: isUser 
                  ? theme.palette.primary.light 
                  : theme.palette.background.paper,
                borderRadius: 2,
                position: 'relative',
              }}
            >
              {message.context && (
                <Box sx={{ mb: 1 }}>
                  {message.context.projectName && (
                    <Chip
                      icon={<ProjectIcon />}
                      label={message.context.projectName}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  )}
                  {message.context.taskName && (
                    <Chip
                      icon={<TaskIcon />}
                      label={message.context.taskName}
                      size="small"
                    />
                  )}
                </Box>
              )}
              
              <Box
                dangerouslySetInnerHTML={{ 
                  __html: marked(content) as string 
                }}
                sx={{
                  '& pre': {
                    bgcolor: theme.palette.grey[100],
                    p: 1,
                    borderRadius: 1,
                    overflow: 'auto',
                  },
                  '& code': {
                    bgcolor: theme.palette.grey[100],
                    px: 0.5,
                    borderRadius: 0.5,
                    fontFamily: 'monospace',
                  },
                  '& p': {
                    margin: 0,
                    '& + p': {
                      mt: 1,
                    },
                  },
                }}
              />
              
              {message.interrupted && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 1,
                    color: theme.palette.warning.main,
                  }}
                >
                  (中断されました)
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      </motion.div>
    );
  };

  const renderThinkingProcess = () => {
    if (!showThinkingProcess || thinkingSteps.length === 0) return null;

    return (
      <Box
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 100,
          width: 300,
          maxHeight: 400,
          bgcolor: theme.palette.background.paper,
          borderRadius: 2,
          boxShadow: 3,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: theme.palette.divider,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ThinkingIcon />
            <Typography variant="subtitle2">思考プロセス</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
          >
            {thinkingExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Collapse in={thinkingExpanded}>
          <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
            <AnimatePresence>
              {thinkingSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {step.description}
                    </Typography>
                    {step.detail && (
                      <Typography variant="caption" color="text.secondary">
                        {step.detail}
                      </Typography>
                    )}
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Context Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: theme.palette.divider,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {currentContext.projectName && (
            <Chip
              icon={<ProjectIcon />}
              label={`プロジェクト: ${currentContext.projectName}`}
              color="primary"
              variant="outlined"
            />
          )}
          {currentContext.taskName && (
            <Chip
              icon={<TaskIcon />}
              label={`タスク: ${currentContext.taskName}`}
              color="secondary"
              variant="outlined"
            />
          )}
          {!currentContext.projectName && !currentContext.taskName && (
            <Typography variant="body2" color="text.secondary">
              一般的なチャット
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          pt: 4, // 上部のパディングを増やす
          bgcolor: theme.palette.grey[50],
        }}
      >
        <Box sx={{ maxWidth: 768, mx: 'auto' }}>
          {messages.map((message) => (
            <Box key={message.id}>
              {renderMessage(message)}
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* Input Area */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: theme.palette.divider,
        }}
      >
        <Box sx={{ maxWidth: 768, mx: 'auto', display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="メッセージを入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            disabled={isStreaming}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={isStreaming ? handleInterrupt : handleSendMessage}
            disabled={!input.trim() && !isStreaming}
            sx={{
              bgcolor: theme.palette.primary.main,
              color: 'white',
              '&:hover': {
                bgcolor: theme.palette.primary.dark,
              },
              '&:disabled': {
                bgcolor: theme.palette.grey[300],
              },
            }}
          >
            {isStreaming ? <StopIcon /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>

      {/* Thinking Process Sidebar */}
      {renderThinkingProcess()}
    </Box>
  );
};

export default RealtimeChatFirebase;