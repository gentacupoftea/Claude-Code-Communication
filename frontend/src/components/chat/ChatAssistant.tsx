import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Divider,
  useTheme,
  Chip,
} from '@mui/material';
import { 
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatAssistantProps {
  title?: string;
  initialMessage?: string;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({
  title = 'MCPアシスタント',
  initialMessage = 'こんにちは！MCPアシスタントです。ダッシュボードデータや操作方法についてご質問がありましたらお気軽にどうぞ。'
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: initialMessage,
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // チャットを一番下にスクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSendMessage = () => {
    if (input.trim() === '') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // ボットの応答を遅延させてシミュレーション
    setTimeout(() => {
      const botResponse = getBotResponse(input);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponse,
        isBot: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 簡易応答ロジック
  const getBotResponse = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.includes('売上') || lowerMsg.includes('セールス')) {
      return '今月の売上は前月比12.5%増加しています。特にShopifyチャネルでの成長が顕著です。';
    } else if (lowerMsg.includes('注文') || lowerMsg.includes('オーダー')) {
      return '今月の注文数は364件で、前月比8.2%増加しています。週末の注文が特に増加傾向にあります。';
    } else if (lowerMsg.includes('顧客') || lowerMsg.includes('カスタマー')) {
      return '新規顧客数は128人で、リピート率は前月から5%向上しています。';
    } else if (lowerMsg.includes('api') || lowerMsg.includes('接続')) {
      return 'API接続を設定するには、設定ページからプラットフォームを選択し、認証情報を入力してください。詳細はヘルプドキュメントをご参照ください。';
    } else if (lowerMsg.includes('mcp')) {
      return 'MCPサーバーは現在正常に動作しています。最終確認は10分前で、すべてのサービスは利用可能です。';
    } else {
      return 'ご質問ありがとうございます。具体的なデータや詳細情報が必要でしたら、お知らせください。';
    }
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* ヘッダー */}
      <Box 
        sx={{ 
          p: 2, 
          backgroundColor: theme.palette.primary.main,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <BotIcon sx={{ mr: 1 }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Chip 
          label="オンライン" 
          size="small" 
          sx={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            '& .MuiChip-label': { px: 1 }
          }} 
        />
      </Box>
      
      <Divider />
      
      {/* メッセージ一覧 */}
      <Box 
        sx={{ 
          p: 2, 
          flexGrow: 1, 
          overflow: 'auto',
          backgroundColor: theme.palette.grey[50]
        }}
      >
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              display: 'flex',
              flexDirection: msg.isBot ? 'row' : 'row-reverse',
              mb: 2
            }}
          >
            <Avatar
              sx={{
                bgcolor: msg.isBot ? theme.palette.primary.main : theme.palette.secondary.main,
                width: 32,
                height: 32
              }}
            >
              {msg.isBot ? <BotIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
            </Avatar>
            
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                ml: msg.isBot ? 1 : 0,
                mr: msg.isBot ? 0 : 1,
                backgroundColor: msg.isBot ? 'white' : theme.palette.primary.light,
                color: msg.isBot ? 'inherit' : 'white',
                borderRadius: 2,
                maxWidth: '80%'
              }}
            >
              <Typography variant="body2">
                {msg.content}
              </Typography>
              <Typography 
                variant="caption" 
                color={msg.isBot ? 'text.secondary' : 'rgba(255,255,255,0.7)'}
                sx={{ display: 'block', textAlign: 'right', mt: 0.5 }}
              >
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Paper>
          </Box>
        ))}
        
        {isTyping && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main,
                width: 32,
                height: 32
              }}
            >
              <BotIcon fontSize="small" />
            </Avatar>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                ml: 1,
                backgroundColor: 'white',
                borderRadius: 2
              }}
            >
              <Typography variant="body2">...</Typography>
            </Paper>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>
      
      <Divider />
      
      {/* 入力エリア */}
      <Box 
        sx={{ 
          p: 2, 
          backgroundColor: 'white',
          display: 'flex'
        }}
      >
        <TextField
          fullWidth
          placeholder={t('chat.inputPlaceholder') || 'メッセージを入力...'}
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          variant="outlined"
          size="small"
          InputProps={{
            endAdornment: (
              <IconButton 
                onClick={handleSendMessage}
                color="primary"
                disabled={input.trim() === ''}
              >
                <SendIcon />
              </IconButton>
            )
          }}
        />
      </Box>
    </Paper>
  );
};

export default ChatAssistant;