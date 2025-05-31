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
import ConnectionHistory from './ConnectionHistory';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  connections?: MCPConnection[];
  interrupted?: boolean;
}

interface MCPConnection {
  id: string;
  service: string;
  action: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp?: string;
}

interface LLMResponse {
  id: string;
  provider: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration: number;
  timestamp?: string;
}

interface ConversationLog {
  conversation_id: string;
  messages: Message[];
  llm_responses: LLMResponse[];
  mcp_connections: MCPConnection[];
  total_tokens: number;
  start_time: string;
  end_time?: string;
}

const RealtimeChatSSE: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [conversationId, setConversationId] = useState<string>('');
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([]);
  const [llmResponses, setLlmResponses] = useState<LLMResponse[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [showHistory, setShowHistory] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const interruptRef = useRef<boolean>(false);

  // 自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // メッセージ送信
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);
    setStreamingContent('');
    interruptRef.current = false;

    try {
      // SSE接続を確立
      const response = await fetch('http://localhost:8000/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          conversation_id: conversationId || undefined,
          user_id: 'user_default',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done || interruptRef.current) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(data);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        role: 'system',
        content: `エラーが発生しました: ${error}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [inputValue, isStreaming, conversationId]);

  // SSEイベントハンドラー
  const handleSSEEvent = (data: any) => {
    switch (data.type) {
      case 'start':
        setConversationId(data.conversation_id);
        break;
        
      case 'chunk':
        setStreamingContent(prev => prev + data.content);
        break;
        
      case 'complete':
        const result = data.result;
        if (result.response) {
          const assistantMessage: Message = {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: result.response,
            timestamp: new Date(),
            provider: 'claude-4.0',
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        setStreamingContent('');
        break;
        
      case 'log':
        const log: ConversationLog = data.conversation_log;
        if (log) {
          setMcpConnections(log.mcp_connections || []);
          setLlmResponses(log.llm_responses || []);
          setTotalTokens(log.total_tokens || 0);
        }
        break;
        
      case 'error':
        console.error('SSE Error:', data.error);
        break;
    }
  };

  // 中断処理
  const handleInterrupt = () => {
    interruptRef.current = true;
    setIsStreaming(false);
    
    if (streamingContent) {
      const interruptedMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: streamingContent + '\n\n*[中断されました]*',
        timestamp: new Date(),
        interrupted: true,
      };
      setMessages(prev => [...prev, interruptedMessage]);
      setStreamingContent('');
    }
  };

  // マークダウンのカスタムレンダラー
  const renderMarkdown = (content: string) => {
    try {
      const html = marked(content) as string;
      return { __html: html };
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return { __html: content };
    }
  };

  // コードブロックとReactプレビューの処理
  useEffect(() => {
    // コードブロックの処理
    const codeBlocks = document.querySelectorAll('.code-block-container');
    codeBlocks.forEach((block) => {
      const code = decodeURIComponent(block.getAttribute('data-code') || '');
      const language = block.getAttribute('data-language') || '';
      
      const container = document.createElement('div');
      container.innerHTML = `<div id="code-${Date.now()}"></div>`;
      block.replaceWith(container.firstChild!);
    });

    // Reactプレビューの処理
    const reactPreviews = document.querySelectorAll('.react-preview-container');
    reactPreviews.forEach((preview) => {
      const code = decodeURIComponent(preview.getAttribute('data-code') || '');
      const language = preview.getAttribute('data-language') || '';
      
      const container = document.createElement('div');
      container.innerHTML = `<div id="preview-${Date.now()}"></div>`;
      preview.replaceWith(container.firstChild!);
    });
  }, [messages]);

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      backgroundColor: theme.palette.background.default,
    }}>
      {/* メインチャットエリア */}
      <Box sx={{ 
        flex: 1,
        display: 'flex', 
        flexDirection: 'column',
      }}>
        {/* ヘッダー */}
        <Box sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.palette.background.paper,
        }}>
          <Typography variant="h6">MultiLLM Chat</Typography>
          <IconButton onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* メッセージエリア */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 3,
        }}>
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Box
                  sx={{
                    mb: 3,
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '70%',
                      backgroundColor: message.role === 'user' 
                        ? theme.palette.primary.main 
                        : theme.palette.background.paper,
                      color: message.role === 'user' 
                        ? theme.palette.primary.contrastText 
                        : theme.palette.text.primary,
                      boxShadow: 2,
                    }}
                  >
                    {message.provider && (
                      <Chip 
                        label={message.provider} 
                        size="small" 
                        sx={{ mb: 1 }}
                        color="secondary"
                      />
                    )}
                    
                    <div dangerouslySetInnerHTML={renderMarkdown(message.content)} />
                    
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        mt: 1, 
                        display: 'block', 
                        opacity: 0.7 
                      }}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </Typography>
                  </Paper>
                </Box>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ストリーミング中の表示 */}
          {isStreaming && streamingContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Box sx={{ mb: 3 }}>
                <Paper sx={{ 
                  p: 2, 
                  backgroundColor: theme.palette.background.paper,
                  boxShadow: 2,
                }}>
                  <Chip 
                    label="Claude 4.0 タイピング中..." 
                    size="small" 
                    color="primary" 
                    sx={{ mb: 1 }}
                    icon={<ThinkingIcon />}
                  />
                  <div dangerouslySetInnerHTML={renderMarkdown(streamingContent)} />
                </Paper>
              </Box>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* 入力エリア */}
        <Box sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: theme.palette.background.paper,
        }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="メッセージを入力..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              multiline
              maxRows={4}
              disabled={isStreaming}
            />
            <IconButton 
              color={isStreaming ? 'error' : 'primary'}
              onClick={isStreaming ? handleInterrupt : sendMessage}
              disabled={!inputValue.trim() && !isStreaming}
            >
              {isStreaming ? <StopIcon /> : <SendIcon />}
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* 接続履歴サイドパネル */}
      <Collapse in={showHistory} orientation="horizontal">
        <ConnectionHistory 
          mcpConnections={mcpConnections}
          llmResponses={llmResponses}
          totalTokens={totalTokens}
        />
      </Collapse>
    </Box>
  );
};

export default RealtimeChatSSE;