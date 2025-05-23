import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Card,
  CardContent,
  useTheme,
  alpha,
  CircularProgress,
  Tooltip,
  Fab,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  Mic as MicIcon,
  Image as ImageIcon,
  AttachFile as AttachFileIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  TrendingUp,
  BarChart,
  PieChart,
  TableChart,
  Code,
  Analytics,
  Search,
  Lightbulb,
  AutoAwesome,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  visualization?: 'chart' | 'metrics' | 'table' | 'code';
  data?: any;
}

interface QuickPrompt {
  id: string;
  category: string;
  label: string;
  prompt: string;
  icon: React.ReactElement;
  color: string;
}

const quickPrompts: QuickPrompt[] = [
  {
    id: '1',
    category: 'Analytics',
    label: '売上推移分析',
    prompt: '過去30日間の売上推移を詳しく分析してください',
    icon: <TrendingUp />,
    color: '#1976d2',
  },
  {
    id: '2',
    category: 'Analytics',
    label: 'トップ商品',
    prompt: '売れ筋商品トップ10とその売上データを表示してください',
    icon: <BarChart />,
    color: '#388e3c',
  },
  {
    id: '3',
    category: 'Reports',
    label: 'プラットフォーム比較',
    prompt: 'Shopify、楽天、Amazonの売上パフォーマンスを比較してください',
    icon: <PieChart />,
    color: '#f57c00',
  },
  {
    id: '4',
    category: 'Insights',
    label: 'パフォーマンス改善',
    prompt: 'コンバージョン率向上のための具体的な提案をしてください',
    icon: <Lightbulb />,
    color: '#7b1fa2',
  },
  {
    id: '5',
    category: 'Data',
    label: 'データエクスポート',
    prompt: '月次レポート用のデータをCSV形式で準備してください',
    icon: <TableChart />,
    color: '#d32f2f',
  },
  {
    id: '6',
    category: 'Automation',
    label: 'API連携設定',
    prompt: 'MCPサーバーとShopify APIの連携状況を確認してください',
    icon: <Code />,
    color: '#303f9f',
  },
];

const AiChatSpace: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'こんにちは！AI分析アシスタントです。🤖\n\nShopifyのデータ分析、売上レポート、マーケティング戦略など、何でもお手伝いします。下のクイックプロンプトを使って始めてみてください！',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiModel, setAiModel] = useState('claude-3');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
      const aiResponse = generateAiResponse(input);
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateAiResponse = (userInput: string): ChatMessage => {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('売上') || lowerInput.includes('推移')) {
      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '📊 過去30日間の売上推移を分析しました。\n\n✅ 総売上: ¥2,640,000 (前月比 +15.2%)\n✅ 成長トレンド: 安定的な上昇傾向\n✅ ピーク: 週末に売上が集中\n\n詳細なチャートを表示します：',
        timestamp: new Date(),
        visualization: 'chart',
        data: [
          { date: '1/1', sales: 45000 },
          { date: '1/8', sales: 52000 },
          { date: '1/15', sales: 48000 },
          { date: '1/22', sales: 58000 },
          { date: '1/29', sales: 61000 },
        ],
      };
    } else if (lowerInput.includes('商品') || lowerInput.includes('トップ')) {
      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '🏆 売れ筋商品トップ5を分析しました：\n\n1. Product A - ¥850,000 (230注文)\n2. Product B - ¥720,000 (195注文)\n3. Product C - ¥650,000 (175注文)\n4. Product D - ¥580,000 (156注文)\n5. Product E - ¥520,000 (142注文)\n\n💡 Product Aが圧倒的な人気を誇っています。在庫確保をお勧めします。',
        timestamp: new Date(),
        visualization: 'metrics',
      };
    } else if (lowerInput.includes('プラットフォーム') || lowerInput.includes('比較')) {
      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '📈 プラットフォーム別パフォーマンス比較：\n\n🛒 Shopify: ¥1,584,000 (60%)\n   - 高コンバージョン率: 3.2%\n   - リピート率: 45%\n\n🏪 楽天: ¥660,000 (25%)\n   - 新規顧客獲得が強み\n   - 季節商品の売上好調\n\n📦 Amazon: ¥396,000 (15%)\n   - 参入したばかり\n   - 成長ポテンシャル大\n\n💡 Shopifyが主力チャネルとして安定。楽天での新規顧客をShopifyに誘導する戦略を検討してみてください。',
        timestamp: new Date(),
      };
    } else if (lowerInput.includes('改善') || lowerInput.includes('提案')) {
      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '💡 パフォーマンス改善のための戦略提案：\n\n🎯 コンバージョン率向上 (現在2.8% → 目標3.5%)\n1. 商品ページの画像品質向上\n2. レビュー数増加キャンペーン\n3. 配送オプション多様化\n\n📧 リピート率向上 (現在45% → 目標55%)\n1. メール自動化フロー構築\n2. ロイヤルティプログラム導入\n3. パーソナライズドオファー\n\n📱 モバイル最適化\n- ページ読み込み速度改善\n- ワンクリック決済導入\n\n実装優先度の高い順に取り組むことをお勧めします！',
        timestamp: new Date(),
      };
    } else {
      return {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `ご質問ありがとうございます！\n\n「${userInput}」について詳しく分析いたします。具体的にどのような観点から分析をご希望でしょうか？\n\n📊 データ分析\n📈 トレンド予測\n💰 収益改善\n🎯 マーケティング戦略\n\nなど、お気軽にお聞かせください。`,
        timestamp: new Date(),
      };
    }
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
          <Box sx={{ mt: 2, height: 250, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={message.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke={theme.palette.primary.main} 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        );
      case 'metrics':
        return (
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {[1, 2, 3].map((i) => (
              <Grid item xs={4} key={i}>
                <Card variant="outlined" sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h6" color="primary">
                    ¥{(850000 - (i-1) * 130000).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Product {String.fromCharCode(64 + i)}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        );
      default:
        return null;
    }
  };

  const groupedPrompts = quickPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) acc[prompt.category] = [];
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, QuickPrompt[]>);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Grid container spacing={3} sx={{ height: 'calc(100vh - 150px)' }}>
        {/* メインチャットエリア */}
        <Grid item xs={12} lg={showHistory ? 8 : 12}>
          <Paper
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {/* ヘッダー */}
            <Box
              sx={{
                p: 2,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                  <AutoAwesome />
                </Avatar>
                <Box>
                  <Typography variant="h6">🤖 AI Chat Space</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    高度な分析とインサイトを提供
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ color: 'white' }}>AIモデル</InputLabel>
                  <Select
                    value={aiModel}
                    label="AIモデル"
                    onChange={(e) => setAiModel(e.target.value)}
                    sx={{ 
                      color: 'white',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                    }}
                  >
                    <MenuItem value="claude-3">Claude 3</MenuItem>
                    <MenuItem value="gpt-4">GPT-4</MenuItem>
                    <MenuItem value="gemini">Gemini Pro</MenuItem>
                  </Select>
                </FormControl>
                
                <Tooltip title="履歴を表示">
                  <IconButton 
                    sx={{ color: 'white' }}
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <HistoryIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* メッセージエリア */}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
              }}
            >
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
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        maxWidth: '80%',
                        width: message.type === 'ai' && message.visualization ? '100%' : 'auto',
                      }}
                    >
                      {message.type === 'ai' && (
                        <Avatar sx={{ bgcolor: theme.palette.primary.main, mt: 0.5 }}>
                          <BotIcon />
                        </Avatar>
                      )}
                      
                      <Box sx={{ flex: 1 }}>
                        <Paper
                          sx={{
                            p: 2,
                            bgcolor: message.type === 'user' 
                              ? theme.palette.primary.light 
                              : theme.palette.background.paper,
                            color: message.type === 'user' ? 'white' : 'inherit',
                            borderRadius: 2,
                            boxShadow: 1,
                          }}
                        >
                          <Typography
                            variant="body1"
                            sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}
                          >
                            {message.content}
                          </Typography>
                          {renderVisualization(message)}
                        </Paper>
                        
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ 
                            mt: 0.5, 
                            display: 'block',
                            textAlign: message.type === 'user' ? 'right' : 'left',
                          }}
                        >
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Typography>
                      </Box>
                      
                      {message.type === 'user' && (
                        <Avatar sx={{ bgcolor: theme.palette.secondary.main, mt: 0.5 }}>
                          <PersonIcon />
                        </Avatar>
                      )}
                    </Box>
                  </ListItem>
                ))}
                
                {isLoading && (
                  <ListItem sx={{ justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CircularProgress size={20} />
                      <Typography color="text.secondary">
                        AI が分析中...
                      </Typography>
                    </Box>
                  </ListItem>
                )}
              </List>
              <div ref={messagesEndRef} />
            </Box>

            {/* 入力エリア */}
            <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="AIアシスタントに質問してください..."
                  variant="outlined"
                  size="small"
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    sx={{ minWidth: 48, height: 40 }}
                  >
                    <SendIcon />
                  </Button>
                  <Tooltip title="音声入力">
                    <IconButton size="small" color="primary">
                      <MicIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {/* クイックプロンプト */}
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  💡 クイックプロンプト:
                </Typography>
                {Object.entries(groupedPrompts).map(([category, prompts]) => (
                  <Box key={category} sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                      {category}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {prompts.map((prompt) => (
                        <Chip
                          key={prompt.id}
                          label={prompt.label}
                          size="small"
                          icon={prompt.icon}
                          onClick={() => handleQuickPrompt(prompt.prompt)}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: alpha(prompt.color, 0.1) },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* サイドパネル（履歴・設定） */}
        {showHistory && (
          <Grid item xs={12} lg={4}>
            <Paper sx={{ height: '100%', p: 2, borderRadius: 2 }}>
              <Typography variant="h6" gutterBottom>
                💬 チャット履歴
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <List>
                <ListItem button sx={{ borderRadius: 1, mb: 1 }}>
                  <ListItemText
                    primary="売上分析セッション"
                    secondary="2時間前 • 15メッセージ"
                  />
                </ListItem>
                <ListItem button sx={{ borderRadius: 1, mb: 1 }}>
                  <ListItemText
                    primary="在庫レポート作成"
                    secondary="昨日 • 8メッセージ"
                  />
                </ListItem>
                <ListItem button sx={{ borderRadius: 1, mb: 1 }}>
                  <ListItemText
                    primary="マーケティング戦略"
                    secondary="3日前 • 12メッセージ"
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AiChatSpace;