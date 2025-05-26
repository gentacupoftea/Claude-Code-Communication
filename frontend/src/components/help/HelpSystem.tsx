import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Rating,
  Divider,
  Paper,
  InputAdornment,
  useTheme,
  alpha
} from '@mui/material';
import {
  Help as HelpIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Article as ArticleIcon,
  VideoLibrary as VideoIcon,
  Quiz as QuizIcon,
  Chat as ChatIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Lightbulb as TipIcon,
  Star as StarIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Share as ShareIcon,
  Print as PrintIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Launch as LaunchIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Category as CategoryIcon,
  TrendingUp as PopularIcon,
  FiberNew as NewIcon,
  Update as UpdateIcon
} from '@mui/icons-material';

interface HelpArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  views: number;
  likes: number;
  dislikes: number;
  bookmarked: boolean;
  author: string;
  lastUpdated: Date;
  isNew: boolean;
  isPopular: boolean;
  relatedArticles: string[];
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful: number;
  notHelpful: number;
  lastUpdated: Date;
}

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number; // seconds
  url: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  views: number;
  rating: number;
  transcript?: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  responses: TicketResponse[];
}

interface TicketResponse {
  id: string;
  message: string;
  sender: string;
  senderType: 'user' | 'support';
  timestamp: Date;
  attachments?: string[];
}

const HelpSystem: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [articleDialog, setArticleDialog] = useState(false);
  const [supportDialog, setSupportDialog] = useState(false);
  const [feedbackDialog, setFeedbackDialog] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium' as const
  });

  useEffect(() => {
    generateMockData();
  }, []);

  const generateMockData = () => {
    const mockArticles: HelpArticle[] = [
      {
        id: '1',
        title: 'ダッシュボードの基本操作',
        content: `
# ダッシュボードの基本操作

Coneaダッシュボードは、ビジネスの重要な指標を一目で確認できる統合プラットフォームです。

## 基本的な機能

### KPIカードの確認
- 売上、注文数、顧客数などの主要指標が表示されます
- 前期比較や目標達成率も確認できます

### チャートの操作
- グラフにマウスをホバーすると詳細データが表示されます
- 期間フィルターで表示期間を変更できます
- グラフの種類を変更することも可能です

### フィルター機能
- 左サイドバーから期間、プラットフォーム、カテゴリなどでフィルターできます
- 複数条件での絞り込みも可能です

## 高度な機能

### カスタマイズ
- ウィジェットの配置を変更できます
- 表示項目の追加・削除が可能です
- 独自のKPIを設定することもできます
        `,
        summary: 'ダッシュボードの基本的な使い方から高度な機能まで解説',
        category: 'dashboard',
        tags: ['ダッシュボード', '基本操作', '初心者'],
        difficulty: 'beginner',
        estimatedTime: 5,
        views: 1523,
        likes: 89,
        dislikes: 3,
        bookmarked: false,
        author: 'サポートチーム',
        lastUpdated: new Date('2024-03-15'),
        isNew: false,
        isPopular: true,
        relatedArticles: ['2', '3']
      },
      {
        id: '2',
        title: '高度な分析機能の活用',
        content: `
# 高度な分析機能の活用

Coneaの分析機能を使って、ビジネスの深い洞察を得る方法を説明します。

## セグメント分析
- 顧客セグメントごとの行動パターンを分析
- RFM分析による顧客価値の把握
- コホート分析で顧客のライフタイムバリューを測定

## トレンド分析
- 季節性の把握
- 成長トレンドの特定
- 予測モデルの活用

## A/Bテスト
- キャンペーンの効果測定
- UIの改善効果の検証
- 価格戦略の最適化
        `,
        summary: 'セグメント分析、トレンド分析、A/Bテストなど高度な分析手法',
        category: 'analytics',
        tags: ['分析', 'セグメント', 'A/Bテスト', '上級者'],
        difficulty: 'advanced',
        estimatedTime: 15,
        views: 756,
        likes: 67,
        dislikes: 5,
        bookmarked: true,
        author: 'データサイエンスチーム',
        lastUpdated: new Date('2024-03-10'),
        isNew: true,
        isPopular: false,
        relatedArticles: ['1', '4']
      },
      {
        id: '3',
        title: '在庫管理の最適化',
        content: `
# 在庫管理の最適化

効率的な在庫管理でコストを削減し、売上機会を最大化する方法を解説します。

## 在庫レベルの設定
- 安全在庫の計算方法
- 再注文ポイントの設定
- 季節性を考慮した在庫計画

## 予測モデル
- 需要予測の活用
- トレンド分析による在庫調整
- 機械学習を使った自動化

## アラート設定
- 在庫不足の早期警告
- 過剰在庫の検出
- 期限切れ商品の管理
        `,
        summary: '在庫レベル設定、予測モデル、アラート機能による在庫最適化',
        category: 'inventory',
        tags: ['在庫', '最適化', '予測', '中級者'],
        difficulty: 'intermediate',
        estimatedTime: 10,
        views: 892,
        likes: 45,
        dislikes: 2,
        bookmarked: false,
        author: '在庫管理専門家',
        lastUpdated: new Date('2024-03-12'),
        isNew: false,
        isPopular: true,
        relatedArticles: ['5']
      }
    ];

    const mockFAQs: FAQ[] = [
      {
        id: '1',
        question: 'パスワードを忘れた場合はどうすればいいですか？',
        answer: 'ログイン画面の「パスワードを忘れた方」リンクをクリックして、登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。',
        category: 'account',
        helpful: 156,
        notHelpful: 8,
        lastUpdated: new Date('2024-03-01')
      },
      {
        id: '2',
        question: 'データの同期はどのくらいの頻度で行われますか？',
        answer: 'プラットフォーム連携によるデータ同期は、リアルタイムまたは5分間隔で実行されます。設定画面から同期頻度を変更することも可能です。',
        category: 'data',
        helpful: 89,
        notHelpful: 12,
        lastUpdated: new Date('2024-02-28')
      },
      {
        id: '3',
        question: 'レポートをPDFで出力できますか？',
        answer: 'はい、すべてのレポートはPDF、Excel、CSV形式で出力可能です。レポート画面右上の「エクスポート」ボタンから選択してください。',
        category: 'reports',
        helpful: 234,
        notHelpful: 5,
        lastUpdated: new Date('2024-03-05')
      }
    ];

    const mockVideos: VideoTutorial[] = [
      {
        id: '1',
        title: 'Conea 入門ガイド',
        description: '初心者向けのConea基本操作チュートリアル',
        thumbnail: '/videos/intro-guide.jpg',
        duration: 480, // 8分
        url: 'https://example.com/video1',
        category: 'getting-started',
        difficulty: 'beginner',
        views: 5432,
        rating: 4.8
      },
      {
        id: '2',
        title: 'ダッシュボードカスタマイズ',
        description: 'ダッシュボードを自分好みにカスタマイズする方法',
        thumbnail: '/videos/dashboard-custom.jpg',
        duration: 720, // 12分
        url: 'https://example.com/video2',
        category: 'dashboard',
        difficulty: 'intermediate',
        views: 2341,
        rating: 4.6
      }
    ];

    const mockTickets: SupportTicket[] = [
      {
        id: '1',
        subject: 'データ同期エラーについて',
        description: 'Shopifyからのデータ同期が3日前から停止しています。',
        status: 'open',
        priority: 'high',
        category: 'technical',
        createdAt: new Date('2024-03-15'),
        updatedAt: new Date('2024-03-15'),
        assignedTo: '田中サポート',
        responses: [
          {
            id: '1',
            message: 'お問い合わせありがとうございます。調査いたします。',
            sender: '田中サポート',
            senderType: 'support',
            timestamp: new Date('2024-03-15T10:30:00')
          }
        ]
      }
    ];

    setArticles(mockArticles);
    setFaqs(mockFAQs);
    setVideos(mockVideos);
    setTickets(mockTickets);
  };

  const toggleBookmark = (articleId: string) => {
    setArticles(prev =>
      prev.map(article =>
        article.id === articleId
          ? { ...article, bookmarked: !article.bookmarked }
          : article
      )
    );
  };

  const rateArticle = (articleId: string, isLike: boolean) => {
    setArticles(prev =>
      prev.map(article =>
        article.id === articleId
          ? {
              ...article,
              likes: isLike ? article.likes + 1 : article.likes,
              dislikes: !isLike ? article.dislikes + 1 : article.dislikes
            }
          : article
      )
    );
  };

  const submitTicket = () => {
    const ticket: SupportTicket = {
      id: Date.now().toString(),
      ...newTicket,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      responses: []
    };

    setTickets(prev => [ticket, ...prev]);
    setNewTicket({
      subject: '',
      description: '',
      category: 'general',
      priority: 'medium'
    });
    setSupportDialog(false);
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderArticles = () => (
    <Box>
      {/* Categories */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label="すべて"
          onClick={() => setSelectedCategory('all')}
          color={selectedCategory === 'all' ? 'primary' : 'default'}
          variant={selectedCategory === 'all' ? 'filled' : 'outlined'}
        />
        <Chip
          label="ダッシュボード"
          onClick={() => setSelectedCategory('dashboard')}
          color={selectedCategory === 'dashboard' ? 'primary' : 'default'}
          variant={selectedCategory === 'dashboard' ? 'filled' : 'outlined'}
        />
        <Chip
          label="分析"
          onClick={() => setSelectedCategory('analytics')}
          color={selectedCategory === 'analytics' ? 'primary' : 'default'}
          variant={selectedCategory === 'analytics' ? 'filled' : 'outlined'}
        />
        <Chip
          label="在庫"
          onClick={() => setSelectedCategory('inventory')}
          color={selectedCategory === 'inventory' ? 'primary' : 'default'}
          variant={selectedCategory === 'inventory' ? 'filled' : 'outlined'}
        />
      </Box>

      <Grid container spacing={3}>
        {filteredArticles.map(article => (
          <Grid item xs={12} md={6} lg={4} key={article.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {article.title}
                  </Typography>
                  {article.isNew && <Chip label="NEW" size="small" color="primary" />}
                  {article.isPopular && <Chip label="人気" size="small" color="warning" />}
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {article.summary}
                </Typography>

                <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
                  {article.tags.slice(0, 3).map(tag => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  <Chip
                    label={article.difficulty}
                    size="small"
                    color={article.difficulty === 'beginner' ? 'success' : 
                           article.difficulty === 'intermediate' ? 'warning' : 'error'}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimeIcon fontSize="small" color="action" />
                    <Typography variant="caption">{article.estimatedTime}分</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon fontSize="small" color="action" />
                    <Typography variant="caption">{article.views}</Typography>
                  </Box>
                </Box>

                <Typography variant="caption" color="text.secondary">
                  {article.author} • {article.lastUpdated.toLocaleDateString()}
                </Typography>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => toggleBookmark(article.id)}
                    color={article.bookmarked ? 'primary' : 'default'}
                  >
                    {article.bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => rateArticle(article.id, true)}
                  >
                    <ThumbUpIcon />
                  </IconButton>
                  <Typography variant="caption" sx={{ mx: 0.5 }}>
                    {article.likes}
                  </Typography>
                </Box>

                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    setSelectedArticle(article);
                    setArticleDialog(true);
                  }}
                >
                  読む
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const renderFAQs = () => (
    <Box>
      {faqs.map(faq => (
        <Accordion key={faq.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" gutterBottom>
              {faq.answer}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                この回答は役に立ちましたか？
              </Typography>
              <Button size="small" startIcon={<ThumbUpIcon />}>
                はい ({faq.helpful})
              </Button>
              <Button size="small" startIcon={<ThumbDownIcon />}>
                いいえ ({faq.notHelpful})
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  const renderVideos = () => (
    <Grid container spacing={3}>
      {videos.map(video => (
        <Grid item xs={12} md={6} lg={4} key={video.id}>
          <Card>
            <Box
              sx={{
                height: 200,
                backgroundImage: `url(${video.thumbnail})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <VideoIcon sx={{ fontSize: 60, color: alpha(theme.palette.primary.main, 0.7) }} />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1
                }}
              >
                <Typography variant="caption">
                  {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                </Typography>
              </Box>
            </Box>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {video.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {video.description}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <Chip
                  label={video.difficulty}
                  size="small"
                  color={video.difficulty === 'beginner' ? 'success' : 
                         video.difficulty === 'intermediate' ? 'warning' : 'error'}
                />
                <Rating value={video.rating} precision={0.1} size="small" readOnly />
                <Typography variant="caption">({video.views}回視聴)</Typography>
              </Box>
            </CardContent>
            <CardActions>
              <Button variant="contained" fullWidth startIcon={<LaunchIcon />}>
                動画を見る
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderSupport = () => (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">サポートチケット</Typography>
        <Button
          variant="contained"
          startIcon={<ChatIcon />}
          onClick={() => setSupportDialog(true)}
        >
          新規チケット作成
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Contact Options */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ChatIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>ライブチャット</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                リアルタイムでサポートチームとチャット
              </Typography>
              <Typography variant="caption" color="success.main">
                営業時間内: 平日 9:00-18:00
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="contained" fullWidth>
                チャットを開始
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <EmailIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>メールサポート</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                詳細な問い合わせやファイル添付が必要な場合
              </Typography>
              <Typography variant="caption" color="text.secondary">
                回答時間: 24時間以内
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="outlined" fullWidth>
                メールを送信
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PhoneIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>電話サポート</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                緊急度の高い問題や複雑な技術的問題
              </Typography>
              <Typography variant="caption" color="text.secondary">
                03-1234-5678
              </Typography>
            </CardContent>
            <CardActions>
              <Button variant="outlined" fullWidth>
                電話をかける
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Ticket List */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>あなたのチケット</Typography>
              <List>
                {tickets.map(ticket => (
                  <ListItem key={ticket.id} divider>
                    <ListItemText
                      primary={ticket.subject}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {ticket.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Chip
                              label={ticket.status}
                              size="small"
                              color={ticket.status === 'open' ? 'primary' : 'default'}
                            />
                            <Chip
                              label={ticket.priority}
                              size="small"
                              color={ticket.priority === 'urgent' ? 'error' : 
                                     ticket.priority === 'high' ? 'warning' : 'default'}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {ticket.createdAt.toLocaleDateString()}
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <HelpIcon color="primary" sx={{ fontSize: 40 }} />
        ヘルプ・サポート
      </Typography>

      {/* Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="ヘルプ記事、FAQ、機能名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
        </CardContent>
      </Card>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="ヘルプ記事" icon={<ArticleIcon />} />
          <Tab label="よくある質問" icon={<QuizIcon />} />
          <Tab label="動画チュートリアル" icon={<VideoIcon />} />
          <Tab label="サポート" icon={<ChatIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && renderArticles()}
      {activeTab === 1 && renderFAQs()}
      {activeTab === 2 && renderVideos()}
      {activeTab === 3 && renderSupport()}

      {/* Article Detail Dialog */}
      <Dialog
        open={articleDialog}
        onClose={() => setArticleDialog(false)}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {selectedArticle?.title}
            <Box>
              <IconButton onClick={() => selectedArticle && toggleBookmark(selectedArticle.id)}>
                {selectedArticle?.bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
              </IconButton>
              <IconButton>
                <ShareIcon />
              </IconButton>
              <IconButton>
                <PrintIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedArticle?.author} • {selectedArticle?.lastUpdated.toLocaleDateString()} • 
              推定読了時間: {selectedArticle?.estimatedTime}分
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {selectedArticle?.content}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
            <Typography variant="body2">この記事は役に立ちましたか？</Typography>
            <Button
              startIcon={<ThumbUpIcon />}
              onClick={() => selectedArticle && rateArticle(selectedArticle.id, true)}
            >
              はい
            </Button>
            <Button
              startIcon={<ThumbDownIcon />}
              onClick={() => selectedArticle && rateArticle(selectedArticle.id, false)}
            >
              いいえ
            </Button>
          </Box>
          <Button onClick={() => setArticleDialog(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* Support Ticket Dialog */}
      <Dialog
        open={supportDialog}
        onClose={() => setSupportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新規サポートチケット</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="件名"
            value={newTicket.subject}
            onChange={(e) => setNewTicket(prev => ({ ...prev, subject: e.target.value }))}
            margin="normal"
          />
          <TextField
            fullWidth
            label="詳細"
            value={newTicket.description}
            onChange={(e) => setNewTicket(prev => ({ ...prev, description: e.target.value }))}
            margin="normal"
            multiline
            rows={4}
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="カテゴリ"
                value={newTicket.category}
                onChange={(e) => setNewTicket(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="general">一般</MenuItem>
                <MenuItem value="technical">技術的問題</MenuItem>
                <MenuItem value="billing">請求</MenuItem>
                <MenuItem value="feature">機能要望</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                select
                label="優先度"
                value={newTicket.priority}
                onChange={(e) => setNewTicket(prev => ({ ...prev, priority: e.target.value as any }))}
              >
                <MenuItem value="low">低</MenuItem>
                <MenuItem value="medium">中</MenuItem>
                <MenuItem value="high">高</MenuItem>
                <MenuItem value="urgent">緊急</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSupportDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={submitTicket}>送信</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HelpSystem;