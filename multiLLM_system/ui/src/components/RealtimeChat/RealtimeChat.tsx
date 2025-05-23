import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
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

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  context?: ChatContext;
  interrupted?: boolean;
}

interface ChatContext {
  projectId?: string;
  taskId?: string;
  projectName?: string;
  taskName?: string;
}

interface ThinkingProcess {
  type: {
    icon: string;
    label: string;
  };
  stage: string;
  steps: ThinkingStep[];
}

interface ThinkingStep {
  description: string;
  detail?: string;
  timestamp: Date;
}

interface MessageChunk {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface RealtimeChatProps {
  projectId?: string;
  taskId?: string;
  userId: string;
  apiEndpoint: string;
}

// Configure marked
marked.setOptions({
  breaks: true,
});

export const RealtimeChat: React.FC<RealtimeChatProps> = ({
  projectId,
  taskId,
  userId,
  apiEndpoint = 'ws://localhost:3001',
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingProcess, setThinkingProcess] = useState<ThinkingProcess | null>(null);
  const [currentContext, setCurrentContext] = useState<ChatContext>({
    projectId,
    taskId,
    projectName: projectId ? `Project ${projectId}` : undefined,
    taskName: taskId ? `Task ${taskId}` : undefined,
  });

  const socketRef = useRef<Socket | null>(null);
  const streamBufferRef = useRef<string>('');
  const interruptRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    socketRef.current = io(apiEndpoint, {
      auth: { userId },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to chat server');
      socketRef.current?.emit('join_context', currentContext);
    });

    socketRef.current.on('message_chunk', handleMessageChunk);
    socketRef.current.on('thinking_update', handleThinkingUpdate);
    socketRef.current.on('history_loaded', (history: Message[]) => {
      setMessages(history);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [apiEndpoint, userId, currentContext]);

  // Handle message chunks
  const handleMessageChunk = useCallback((chunk: MessageChunk) => {
    if (interruptRef.current) return;

    streamBufferRef.current += chunk.content;

    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      
      if (lastMessage && lastMessage.id === chunk.messageId) {
        lastMessage.content = streamBufferRef.current;
      } else {
        newMessages.push({
          id: chunk.messageId,
          role: 'assistant',
          content: streamBufferRef.current,
          timestamp: new Date(),
        });
      }
      
      if (chunk.isComplete) {
        streamBufferRef.current = '';
        setIsStreaming(false);
        setThinkingProcess(null);
      }
      
      return newMessages;
    });
  }, []);

  // Handle thinking updates
  const handleThinkingUpdate = useCallback((update: any) => {
    setThinkingProcess(prev => ({
      ...prev,
      ...update,
      steps: [...(prev?.steps || []), update.newStep].filter(Boolean),
    }));
  }, []);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      context: currentContext,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);
    interruptRef.current = false;
    streamBufferRef.current = '';

    socketRef.current?.emit('send_message', {
      content: inputValue,
      context: currentContext,
      includeThinking: true,
    });
  }, [inputValue, isStreaming, currentContext]);

  // Handle interrupt
  const handleInterrupt = useCallback(() => {
    if (!isStreaming) return;

    interruptRef.current = true;
    socketRef.current?.emit('interrupt_stream');
    setIsStreaming(false);

    if (streamBufferRef.current) {
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content += '\n\n*[中断されました]*';
          lastMessage.interrupted = true;
        }
        return newMessages;
      });
      streamBufferRef.current = '';
    }
  }, [isStreaming]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        handleInterrupt();
      }
      // Cmd/Ctrl + Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        sendMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, handleInterrupt, sendMessage]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      maxWidth: 768,
      margin: '0 auto',
      backgroundColor: theme.palette.background.default,
    }}>
      {/* Context Bar */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5,
        p: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}>
        {currentContext.projectName && (
          <Chip
            icon={<ProjectIcon />}
            label={currentContext.projectName}
            size="small"
            sx={{ 
              backgroundColor: '#E3F2FD',
              color: '#1976D2',
              '& .MuiChip-icon': { color: '#1976D2' },
            }}
          />
        )}
        {currentContext.taskName && (
          <Chip
            icon={<TaskIcon />}
            label={currentContext.taskName}
            size="small"
            sx={{ 
              backgroundColor: '#F3E5F5',
              color: '#7B1FA2',
              '& .MuiChip-icon': { color: '#7B1FA2' },
            }}
          />
        )}
      </Box>

      {/* Messages Container */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 3,
        '&::-webkit-scrollbar': {
          width: 8,
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: theme.palette.action.hover,
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.action.disabled,
          borderRadius: 4,
        },
      }}>
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <MessageComponent
              key={message.id}
              message={message}
              theme={theme}
            />
          ))}
          
          {/* AI Thinking Process */}
          {thinkingProcess && (
            <ThinkingProcessDisplay
              process={thinkingProcess}
              theme={theme}
            />
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box sx={{ 
        p: 3, 
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}>
        <Box sx={{ position: 'relative' }}>
          <TextField
            fullWidth
            multiline
            maxRows={6}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={currentContext.taskName 
              ? `${currentContext.taskName}について質問してください...` 
              : 'メッセージを入力...'}
            disabled={isStreaming}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: theme.palette.action.hover,
                '& fieldset': {
                  borderColor: 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.primary.main,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                  borderWidth: 2,
                },
              },
            }}
          />
          <IconButton
            onClick={isStreaming ? handleInterrupt : sendMessage}
            disabled={!inputValue.trim() && !isStreaming}
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              backgroundColor: isStreaming 
                ? theme.palette.error.main 
                : theme.palette.primary.main,
              color: 'white',
              '&:hover': {
                backgroundColor: isStreaming 
                  ? theme.palette.error.dark 
                  : theme.palette.primary.dark,
              },
              '&:disabled': {
                backgroundColor: theme.palette.action.disabledBackground,
              },
            }}
          >
            {isStreaming ? <StopIcon /> : <SendIcon />}
          </IconButton>
        </Box>
        
        {/* Input Hints */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2, 
          mt: 1,
          fontSize: '0.75rem',
          color: theme.palette.text.secondary,
        }}>
          <Typography variant="caption">
            <kbd style={{ 
              padding: '2px 4px',
              backgroundColor: theme.palette.action.hover,
              borderRadius: 3,
              fontFamily: 'monospace',
            }}>⌘</kbd> + <kbd style={{ 
              padding: '2px 4px',
              backgroundColor: theme.palette.action.hover,
              borderRadius: 3,
              fontFamily: 'monospace',
            }}>Enter</kbd> で送信
          </Typography>
          {isStreaming && (
            <Typography variant="caption">
              <kbd style={{ 
                padding: '2px 4px',
                backgroundColor: theme.palette.action.hover,
                borderRadius: 3,
                fontFamily: 'monospace',
              }}>Esc</kbd> で中断
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Message Component
const MessageComponent: React.FC<{ message: Message; theme: any }> = ({ message, theme }) => {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      <Avatar
        sx={{
          width: 32,
          height: 32,
          backgroundColor: isUser ? theme.palette.primary.main : theme.palette.grey[300],
        }}
      >
        {isUser ? 'U' : 'AI'}
      </Avatar>
      
      <Box
        sx={{
          flex: 1,
          maxWidth: '80%',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            backgroundColor: isUser 
              ? theme.palette.primary.light 
              : theme.palette.background.paper,
            color: isUser 
              ? theme.palette.primary.contrastText 
              : theme.palette.text.primary,
            border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
            '& pre': {
              backgroundColor: theme.palette.action.hover,
              padding: theme.spacing(2),
              borderRadius: 1,
              overflow: 'auto',
              margin: theme.spacing(1, 0),
            },
            '& code': {
              backgroundColor: theme.palette.action.hover,
              padding: '2px 6px',
              borderRadius: 1,
              fontFamily: 'Monaco, monospace',
              fontSize: '0.875rem',
            },
            '& p': {
              margin: theme.spacing(1, 0),
            },
          }}
        >
          <Box 
            dangerouslySetInnerHTML={{ 
              __html: marked(message.content) as string 
            }} 
          />
          {message.interrupted && (
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block',
                mt: 1,
                fontStyle: 'italic',
                opacity: 0.7,
              }}
            >
              [中断されました]
            </Typography>
          )}
        </Paper>
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block',
            mt: 0.5,
            color: theme.palette.text.secondary,
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </Typography>
      </Box>
    </motion.div>
  );
};

// Thinking Process Display
const ThinkingProcessDisplay: React.FC<{ process: ThinkingProcess; theme: any }> = ({ process, theme }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{ marginLeft: 48, marginBottom: 24 }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          backgroundColor: '#FFF8E1',
          border: '1px solid #FFE082',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            mb: isExpanded ? 2 : 0,
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <ThinkingIcon sx={{ color: '#F57C00' }} />
          <Typography 
            variant="subtitle2" 
            sx={{ 
              flex: 1,
              fontWeight: 600,
              color: '#E65100',
            }}
          >
            {process.type.icon} {process.type.label} - {process.stage}
          </Typography>
          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
        
        <Collapse in={isExpanded}>
          <Box sx={{ pl: 4 }}>
            {process.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#FFB300',
                      mt: 0.75,
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#424242' }}>
                      {step.description}
                    </Typography>
                    {step.detail && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: '#757575',
                          display: 'block',
                        }}
                      >
                        {step.detail}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </motion.div>
            ))}
          </Box>
        </Collapse>
      </Paper>
    </motion.div>
  );
};

export default RealtimeChat;