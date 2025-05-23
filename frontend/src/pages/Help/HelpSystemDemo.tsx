/**
 * ヘルプシステムデモページ
 * ヘルプとドキュメント機能のデモを表示
 */
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  Divider,
  Alert,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton
} from '@mui/material';
import {
  Help as HelpIcon,
  LiveHelp as LiveHelpIcon,
  QuestionAnswer as FaqIcon,
  PlayCircleOutline as TourIcon,
  Menu as MenuIcon,
  ViewCarousel as CarouselIcon,
  Article as ArticleIcon,
  Search as SearchIcon,
  Lightbulb as TipIcon
} from '@mui/icons-material';
import { mainLayout } from '../../layouts/MainLayout';
import { ContextualHelp, HelpCenter, ProductTour } from '../../components/help';
import helpService, { Tour } from '../../services/helpService';
import { useHelp } from '../../hooks/useHelp';

const HelpSystemDemoComponent: React.FC = () => {
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [demoTour, setDemoTour] = useState<Tour | null>(null);
  
  // ヘルプシステムの初期化
  useEffect(() => {
    const initHelp = async () => {
      try {
        await helpService.initialize();
        setIsInitialized(true);
        
        // デモ用のツアーを作成
        const tour: Tour = {
          id: 'help-demo-tour',
          name: 'ヘルプシステムデモツアー',
          description: 'このツアーでは、ヘルプシステムの主要機能を紹介します。',
          isEnabled: true,
          steps: [
            {
              id: 'step-1',
              targetElement: '#help-demo-welcome',
              title: 'ヘルプシステムへようこそ',
              content: 'このツアーでは、Conea アプリケーションのヘルプシステムの主な機能を紹介します。',
              position: 'bottom',
              order: 1
            },
            {
              id: 'step-2',
              targetElement: '#contextual-help-section',
              title: 'コンテキストヘルプ',
              content: 'コンテキストヘルプは、特定の画面や機能に関連するヘルプを提供します。ヘルプアイコンをクリックして試してみましょう。',
              position: 'bottom',
              order: 2
            },
            {
              id: 'step-3',
              targetElement: '#help-center-section',
              title: 'ヘルプセンター',
              content: 'ヘルプセンターでは、すべてのヘルプドキュメントを参照できます。カテゴリー別に整理されていて、検索も可能です。',
              position: 'right',
              order: 3
            },
            {
              id: 'step-4',
              targetElement: '#product-tour-section',
              title: 'プロダクトツアー',
              content: 'プロダクトツアーは、アプリケーションの主要機能を対話形式で紹介します。初めてのユーザーや新機能の紹介に最適です。',
              position: 'left',
              order: 4
            }
          ]
        };
        
        setDemoTour(tour);
      } catch (error) {
        console.error('Failed to initialize help system:', error);
      }
    };
    
    initHelp();
  }, []);
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box id="help-demo-welcome" sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <HelpIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">
            ヘルプシステムデモ
          </Typography>
        </Box>
        <Typography variant="body1" paragraph>
          このページでは、Coneaアプリケーションのヘルプと情報システムの主要な機能をデモンストレーションします。
          以下のセクションで、さまざまなヘルプ機能を試すことができます。
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            variant="contained"
            startIcon={<TourIcon />}
            onClick={() => setTourOpen(true)}
          >
            ツアーを開始
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<HelpIcon />}
            onClick={() => setHelpCenterOpen(true)}
          >
            ヘルプセンターを開く
          </Button>
        </Box>
      </Box>
      
      <Grid container spacing={4}>
        {/* コンテキストヘルプ */}
        <Grid item xs={12} md={6} id="contextual-help-section">
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LiveHelpIcon sx={{ color: 'primary.main', mr: 1 }} />
              <Typography variant="h5">
                コンテキストヘルプ
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              コンテキストヘルプは、アプリケーションの特定の部分や機能に関連する情報を提供します。
              ユーザーが必要なときに必要な情報だけを表示するため、効率的で邪魔になりません。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              コンテキストヘルプの例：
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  アイコンタイプ:
                </Typography>
                <ContextualHelp
                  title="ダッシュボードについて"
                  description="ダッシュボードの使い方に関するヘルプ"
                  categoryId="dashboard"
                  articleIds={['dashboard-1']}
                  variant="icon"
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  ボタンタイプ:
                </Typography>
                <ContextualHelp
                  title="オフラインモード"
                  description="オフラインモードの使い方に関するヘルプ"
                  categoryId="offline"
                  articleIds={['offline-1']}
                  variant="button"
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  テキストタイプ:
                </Typography>
                <ContextualHelp
                  title="接続の問題を解決"
                  description="接続の問題を解決するためのヘルプ"
                  categoryId="troubleshooting"
                  articleIds={['troubleshooting-1']}
                  variant="text"
                />
              </Box>
            </Box>
            
            <Typography variant="subtitle1" gutterBottom>
              カード形式の例：
            </Typography>
            
            <ContextualHelp
              title="はじめてのガイド"
              description="Coneaを初めて使う方のための基本ガイド"
              categoryId="getting-started"
              articleIds={['getting-started-1', 'getting-started-2']}
              tourId={demoTour?.id}
              variant="card"
            />
          </Paper>
        </Grid>
        
        {/* ヘルプセンター */}
        <Grid item xs={12} md={6} id="help-center-section">
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ArticleIcon sx={{ color: 'primary.main', mr: 1 }} />
              <Typography variant="h5">
                ヘルプセンター
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              ヘルプセンターは、アプリケーションの使い方に関するすべての文書を集めた中央リポジトリです。
              カテゴリー別に整理され、検索機能も備えています。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                カテゴリー:
              </Typography>
              
              <Grid container spacing={1}>
                {isInitialized && helpService.getCategories().map(category => (
                  <Grid item xs={6} key={category.id}>
                    <Chip 
                      label={category.name}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setHelpCenterOpen(true);
                      }}
                      sx={{ width: '100%' }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                おすすめの記事:
              </Typography>
              
              <List>
                {isInitialized && [
                  helpService.getArticle('getting-started-1'),
                  helpService.getArticle('dashboard-1'),
                  helpService.getArticle('offline-1')
                ].map(article => (
                  article && (
                    <ListItem key={article.id} disablePadding>
                      <ListItemButton
                        onClick={() => {
                          setSelectedArticle(article.id);
                          setHelpCenterOpen(true);
                        }}
                      >
                        <ListItemIcon>
                          <ArticleIcon />
                        </ListItemIcon>
                        <ListItemText primary={article.title} />
                      </ListItemButton>
                    </ListItem>
                  )
                ))}
              </List>
            </Box>
            
            <Button
              fullWidth
              variant="outlined"
              startIcon={<HelpIcon />}
              onClick={() => setHelpCenterOpen(true)}
            >
              ヘルプセンターを開く
            </Button>
          </Paper>
        </Grid>
        
        {/* プロダクトツアー */}
        <Grid item xs={12} id="product-tour-section">
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CarouselIcon sx={{ color: 'primary.main', mr: 1 }} />
              <Typography variant="h5">
                プロダクトツアー
              </Typography>
            </Box>
            
            <Typography variant="body1" paragraph>
              プロダクトツアーは、ユーザーをアプリケーション内の重要な機能やセクションに順番に案内するインタラクティブなガイドです。
              新規ユーザーのオンボーディングや、新機能の紹介に最適です。
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TourIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">
                        ヘルプシステムツアー
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      ヘルプシステムの主要機能を順番に案内します。このデモ専用のツアーです。
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      onClick={() => setTourOpen(true)}
                    >
                      ツアーを開始
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TourIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">
                        はじめてのツアー
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Coneaアプリケーションの基本的な使い方を順番に案内します。
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      disabled={!isInitialized}
                      onClick={() => {
                        // 実際のアプリケーションでは、実際のツアーIDを使用
                        alert('この機能はデモです。実際のアプリケーションではツアーが表示されます。');
                      }}
                    >
                      ツアーを開始
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TipIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">
                        カスタムツアーを作成
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      特定の機能やワークフローに特化したカスタムツアーを作成できます。
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      disabled={true}
                    >
                      ツアーを作成（デモのみ）
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
      
      {/* ヘルプセンター */}
      <HelpCenter
        open={helpCenterOpen}
        onClose={() => setHelpCenterOpen(false)}
        initialCategory={selectedCategory as any || undefined}
        initialArticleId={selectedArticle || undefined}
      />
      
      {/* プロダクトツアー */}
      {demoTour && (
        <ProductTour
          tour={demoTour}
          isOpen={tourOpen}
          onClose={() => setTourOpen(false)}
          onComplete={() => console.log('Demo tour completed')}
          onSkip={() => console.log('Demo tour skipped')}
        />
      )}
    </Container>
  );
};

export const HelpSystemDemo = mainLayout(HelpSystemDemoComponent);