import React, { useState, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Box,
  IconButton,
  useTheme,
  LinearProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  Stop as StopIcon,
} from '@mui/icons-material';

// Types
interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  intermediate?: boolean;
  isError?: boolean;
}

interface Process {
  id: number;
  type: 'thinking' | 'tool';
  content?: string;
  tool?: string;
  action?: string;
}

// Styled Components
const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
  scroll-behavior: smooth;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
`;

const MessageGroup = styled.div`
  padding: 24px 0;
  border-bottom: 1px solid #f3f4f6;
  
  &:last-child {
    border-bottom: none;
  }
`;

const MessageWrapper = styled.div<{ isUser: boolean }>`
  max-width: 768px;
  margin: 0 auto;
  padding: 0 24px;
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-weight: 600;
  color: #111827;
`;

const Avatar = styled.div<{ isUser: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: ${props => props.isUser ? '#6366f1' : '#10b981'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: 600;
`;

const MessageContent = styled.div`
  color: #374151;
  line-height: 1.6;
  
  p {
    margin: 0 0 16px 0;
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  h1, h2, h3, h4, h5, h6 {
    margin: 24px 0 16px 0;
    font-weight: 600;
    &:first-child {
      margin-top: 0;
    }
  }
  
  ul, ol {
    margin: 0 0 16px 0;
    padding-left: 24px;
  }
  
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 14px;
  }
  
  pre {
    margin: 16px 0;
    border-radius: 8px;
    overflow: hidden;
  }
  
  blockquote {
    border-left: 4px solid #e5e7eb;
    padding-left: 16px;
    margin: 16px 0;
    color: #6b7280;
  }
`;

const ThinkingIndicator = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin: 8px 0;
  color: #6b7280;
  font-size: 14px;
`;

const ToolIndicator = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #ede9fe;
  border-radius: 6px;
  margin: 8px 0;
  color: #7c3aed;
  font-size: 13px;
  font-weight: 500;
`;

const InputContainer = styled.div`
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 16px;
`;

const InputWrapper = styled.div`
  max-width: 768px;
  margin: 0 auto;
  position: relative;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 24px;
  max-height: 200px;
  padding: 12px 48px 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.5;
  resize: none;
  outline: none;
  font-family: inherit;
  
  &:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const SendButton = styled(IconButton)`
  position: absolute;
  right: 8px;
  bottom: 8px;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: 4px;
  
  span {
    width: 8px;
    height: 8px;
    background: #6b7280;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
    
    &:nth-of-type(1) {
      animation-delay: -0.32s;
    }
    
    &:nth-of-type(2) {
      animation-delay: -0.16s;
    }
  }
  
  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
`;

const IntermediateMessage = styled(motion.div)`
  opacity: 0.7;
  font-style: italic;
  margin-bottom: 12px;
`;

// Main Component
export const ImprovedChatInterface: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState(`conv_${Date.now()}`);
  const [currentProcesses, setCurrentProcesses] = useState<Process[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [lastEnterTime, setLastEnterTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Auto-scroll
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentProcesses]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentProcesses([]);
    
    try {
      // SSE接続
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:9001';
      const response = await fetch(`${apiUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversation_id: conversationId,
          user_id: 'default_user',
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
      let currentMessageId: string | null = null;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(data, currentMessageId);
              
              // メッセージIDを追跡
              if (data.type === 'response' && !data.intermediate) {
                currentMessageId = `msg_${Date.now()}`;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'system',
        content: 'エラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      setCurrentProcesses([]);
    }
  };

  const handleSSEEvent = (data: any, currentMessageId: string | null) => {
    switch (data.type) {
      case 'thinking':
        setCurrentProcesses(prev => [...prev, {
          id: Date.now(),
          type: 'thinking',
          content: data.content
        }]);
        break;
        
      case 'tool_use':
        setCurrentProcesses(prev => [...prev, {
          id: Date.now(),
          type: 'tool',
          tool: data.tool,
          action: data.action
        }]);
        break;
        
      case 'response':
        if (data.intermediate) {
          // 中間応答
          setMessages(prev => [...prev, {
            id: Date.now(),
            role: 'assistant',
            content: data.content,
            timestamp: data.timestamp,
            intermediate: true
          }]);
        } else {
          // 最終応答（中間応答を削除）
          setMessages(prev => {
            const filtered = prev.filter(m => !m.intermediate);
            return [...filtered, {
              id: currentMessageId || Date.now(),
              role: 'assistant',
              content: data.content,
              timestamp: data.timestamp
            }];
          });
          setCurrentProcesses([]);
        }
        break;
        
      case 'chunk':
        // ストリーミングチャンク
        if (currentMessageId) {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg && lastMsg.id === currentMessageId) {
              lastMsg.content += data.content;
            }
            return msgs;
          });
        }
        break;
        
      case 'error':
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'system',
          content: data.content,
          timestamp: data.timestamp,
          isError: true
        }]);
        setCurrentProcesses([]);
        setIsLoading(false);
        break;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      const currentTime = Date.now();
      
      // 日本語入力中の場合は必ず2回エンターが必要
      if (isComposing) {
        if (currentTime - lastEnterTime < 500) { // 500ms以内の2回目のエンター
          sendMessage();
          setLastEnterTime(0);
        } else {
          setLastEnterTime(currentTime);
        }
      } else {
        // 英語入力時は1回で送信
        sendMessage();
      }
    }
  };

  // メッセージのグループ化
  const messageGroups = messages.reduce((groups: any[], message) => {
    const lastGroup = groups[groups.length - 1];
    
    if (!lastGroup || lastGroup.role !== message.role) {
      groups.push({
        role: message.role,
        messages: [message]
      });
    } else {
      lastGroup.messages.push(message);
    }
    
    return groups;
  }, []);

  return (
    <ChatContainer>
      <MessagesContainer>
        {messageGroups.map((group, groupIndex) => (
          <MessageGroup key={groupIndex}>
            <MessageWrapper isUser={group.role === 'user'}>
              <MessageHeader>
                <Avatar isUser={group.role === 'user'}>
                  {group.role === 'user' ? 'あ' : 'A'}
                </Avatar>
                <span>{group.role === 'user' ? 'あなた' : 'アシスタント'}</span>
              </MessageHeader>
              
              {group.messages.map((message: Message) => (
                <MessageContent key={message.id}>
                  {message.intermediate ? (
                    <IntermediateMessage
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 0.7 }}
                    >
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </IntermediateMessage>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ReactMarkdown
                        components={{
                          code({className, children, ...props}: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isCodeBlock = match;
                            return isCodeBlock ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus as any}
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
                          }
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </motion.div>
                  )}
                </MessageContent>
              ))}
              
              {/* 現在の処理表示 */}
              {groupIndex === messageGroups.length - 1 && currentProcesses.length > 0 && (
                <AnimatePresence>
                  {currentProcesses.map((process) => (
                    <motion.div
                      key={process.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {process.type === 'thinking' && (
                        <ThinkingIndicator>
                          <LoadingDots>
                            <span />
                            <span />
                            <span />
                          </LoadingDots>
                          {process.content}
                        </ThinkingIndicator>
                      )}
                      
                      {process.type === 'tool' && (
                        <ToolIndicator>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {process.tool}を使用中...
                        </ToolIndicator>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </MessageWrapper>
          </MessageGroup>
        ))}
        
        {isLoading && messages.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <LinearProgress sx={{ width: 200 }} />
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>
      
      <InputContainer>
        <InputWrapper>
          <TextArea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder="メッセージを入力... (日本語入力時は2回Enter)"
            disabled={isLoading}
            rows={1}
          />
          <SendButton
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            color={isLoading ? 'error' : 'primary'}
          >
            {isLoading ? <StopIcon /> : <SendIcon />}
          </SendButton>
        </InputWrapper>
      </InputContainer>
    </ChatContainer>
  );
};