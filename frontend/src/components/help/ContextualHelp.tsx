/**
 * コンテキストヘルプコンポーネント
 * 特定の画面やコンポーネントのコンテキストに応じたヘルプを表示
 */
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Collapse,
  Divider
} from '@mui/material';
import {
  HelpOutline as HelpIcon,
  Article as ArticleIcon,
  PlayCircleOutline as TourIcon,
  QuestionAnswer as FaqIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  VideoLibrary as VideoIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { HelpCategoryId } from '../../services/helpService';
import HelpCenter from './HelpCenter';
import ProductTour from './ProductTour';
import { useHelp } from '../../hooks/useHelp';

interface HelpArticleReference {
  title: string;
  id: string;
  type: 'article' | 'faq' | 'video';
  videoUrl?: string;
}

interface ContextualHelpProps {
  title?: string;
  description?: string;
  categoryId?: HelpCategoryId;
  articleIds?: string[];
  tourId?: string;
  placement?: 'right' | 'left' | 'top' | 'bottom';
  iconOnly?: boolean;
  variant?: 'icon' | 'button' | 'text' | 'card';
}

const ContextualHelp: React.FC<ContextualHelpProps> = ({
  title = 'ヘルプ',
  description,
  categoryId,
  articleIds = [],
  tourId,
  placement = 'bottom',
  iconOnly = false,
  variant = 'icon'
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['articles']));
  const [helpCenterOpen, setHelpCenterOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  
  const { articles, getTour } = useHelp({ initialCategory: categoryId });
  
  // 記事リファレンスの作成
  const helpReferences: HelpArticleReference[] = articleIds
    .map(id => {
      const article = articles.find(a => a.id === id);
      if (!article) return null;
      
      return {
        id: article.id,
        title: article.title,
        type: article.videoUrl ? 'video' : 'article',
        videoUrl: article.videoUrl
      };
    })
    .filter(Boolean) as HelpArticleReference[];
  
  // 記事の種類別グループ化
  const groupedReferences = helpReferences.reduce(
    (acc, ref) => {
      acc[ref.type].push(ref);
      return acc;
    },
    { article: [] as HelpArticleReference[], video: [] as HelpArticleReference[], faq: [] as HelpArticleReference[] }
  );
  
  // ポップオーバーの開閉
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  // セクションの展開/折りたたみ
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  // ヘルプセンターを開く
  const openHelpCenter = (articleId?: string) => {
    if (articleId) {
      setSelectedArticleId(articleId);
    }
    setHelpCenterOpen(true);
    handleClose();
  };
  
  // ツアーを開始
  const startTour = () => {
    setTourOpen(true);
    handleClose();
  };
  
  // 表示するヘルプアイコンまたはボタン
  const renderHelpTrigger = () => {
    switch (variant) {
      case 'button':
        return (
          <Button
            startIcon={<HelpIcon />}
            variant="outlined"
            onClick={handleClick}
            size="small"
          >
            {iconOnly ? null : title}
          </Button>
        );
      case 'text':
        return (
          <Button
            startIcon={<HelpIcon />}
            variant="text"
            onClick={handleClick}
            size="small"
          >
            {title}
          </Button>
        );
      case 'card':
        return (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: theme => theme.palette.action.hover
              }
            }}
            onClick={handleClick}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <HelpIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">{title}</Typography>
            </Box>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Paper>
        );
      case 'icon':
      default:
        return (
          <Tooltip title={iconOnly ? title : "ヘルプを表示"}>
            <IconButton onClick={handleClick} size="small">
              <HelpIcon />
            </IconButton>
          </Tooltip>
        );
    }
  };
  
  const open = Boolean(anchorEl);
  const tour = tourId ? getTour(tourId) : undefined;
  
  return (
    <>
      {renderHelpTrigger()}
      
      {/* ヘルプポップオーバー */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: placement === 'top' ? 'top' : placement === 'bottom' ? 'bottom' : 'center',
          horizontal: placement === 'left' ? 'left' : placement === 'right' ? 'right' : 'center',
        }}
        transformOrigin={{
          vertical: placement === 'top' ? 'bottom' : placement === 'bottom' ? 'top' : 'center',
          horizontal: placement === 'left' ? 'right' : placement === 'right' ? 'left' : 'center',
        }}
      >
        <Box sx={{ width: 320, maxHeight: '80vh', overflow: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, pb: 1 }}>
            <Typography variant="subtitle1" fontWeight="medium">
              {title}
            </Typography>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
              {description}
            </Typography>
          )}
          
          {/* ツアーボタン */}
          {tourId && tour && (
            <Box sx={{ p: 2, pb: 1 }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<TourIcon />}
                onClick={startTour}
              >
                {tour.name}を開始
              </Button>
            </Box>
          )}
          
          {/* 記事セクション */}
          {groupedReferences.article.length > 0 && (
            <Box sx={{ px: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1,
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection('articles')}
              >
                <Typography variant="subtitle2">関連記事</Typography>
                {expandedSections.has('articles') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              
              <Collapse in={expandedSections.has('articles')}>
                <List dense disablePadding>
                  {groupedReferences.article.map((ref) => (
                    <ListItem
                      key={ref.id}
                      button
                      onClick={() => openHelpCenter(ref.id)}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <ArticleIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={ref.title}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          )}
          
          {/* ビデオセクション */}
          {groupedReferences.video.length > 0 && (
            <Box sx={{ px: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1,
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection('videos')}
              >
                <Typography variant="subtitle2">チュートリアル動画</Typography>
                {expandedSections.has('videos') ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              
              <Collapse in={expandedSections.has('videos')}>
                <List dense disablePadding>
                  {groupedReferences.video.map((ref) => (
                    <ListItem
                      key={ref.id}
                      button
                      onClick={() => {
                        if (ref.videoUrl) {
                          window.open(ref.videoUrl, '_blank');
                        } else {
                          openHelpCenter(ref.id);
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <VideoIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={ref.title}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          )}
          
          <Divider sx={{ my: 1 }} />
          
          {/* ヘルプセンターリンク */}
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="text"
              startIcon={<SearchIcon />}
              onClick={() => openHelpCenter()}
            >
              ヘルプセンターを開く
            </Button>
          </Box>
        </Box>
      </Popover>
      
      {/* ヘルプセンター */}
      <HelpCenter
        open={helpCenterOpen}
        onClose={() => setHelpCenterOpen(false)}
        initialCategory={categoryId}
        initialArticleId={selectedArticleId || undefined}
      />
      
      {/* プロダクトツアー */}
      {tourId && tour && (
        <ProductTour
          tour={tour}
          isOpen={tourOpen}
          onClose={() => setTourOpen(false)}
          onComplete={() => console.log('Tour completed')}
          onSkip={() => console.log('Tour skipped')}
        />
      )}
    </>
  );
};

export default ContextualHelp;