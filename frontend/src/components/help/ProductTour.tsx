/**
 * プロダクトツアーコンポーネント
 * インタラクティブなガイドツアーを提供
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  Fade,
  Zoom,
  useTheme,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MobileStepper,
  Stepper,
  Step,
  StepLabel,
  Hidden,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  KeyboardArrowRight as NextIcon,
  KeyboardArrowLeft as PrevIcon,
  Lightbulb as TipIcon,
  PlayCircleOutline as StartIcon,
  CheckCircleOutline as CompleteIcon,
  Help as HelpIcon,
  SkipNext as SkipIcon
} from '@mui/icons-material';
import { Tour, TourStep } from '../../services/helpService';

// ツールチップの位置タイプ
type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

// 位置オフセット
const POSITION_OFFSET = 12;

interface ProductTourProps {
  tour: Tour;
  onComplete?: () => void;
  onSkip?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const ProductTour: React.FC<ProductTourProps> = ({
  tour,
  onComplete,
  onSkip,
  isOpen,
  onClose
}) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [stepElements, setStepElements] = useState<(Element | null)[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  
  // 現在のステップ
  const currentStep = tour.steps.sort((a, b) => a.order - b.order)[activeStep];
  
  // ツアーの初期化
  useEffect(() => {
    if (isOpen && tour.steps.length > 0) {
      setIsLoading(true);
      setActiveStep(0);
      setShowWelcomeDialog(true);
      setShowCompletionDialog(false);
      
      // ターゲット要素を取得
      const elements = tour.steps
        .sort((a, b) => a.order - b.order)
        .map(step => document.querySelector(step.targetElement));
      
      setStepElements(elements);
      setIsLoading(false);
    }
  }, [isOpen, tour]);
  
  // ステップが変更されたときにターゲット要素にスクロール
  useEffect(() => {
    if (!isOpen || !currentStep || showWelcomeDialog || showCompletionDialog) {
      return;
    }
    
    const targetElement = stepElements[activeStep];
    if (targetElement) {
      // ターゲット要素の位置を取得
      const rect = targetElement.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      // ターゲット要素が画面内に収まるようにスクロール
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
      
      // ターゲット要素をハイライト
      targetElement.classList.add('tour-highlight');
      
      // ツールチップ位置の計算
      calculateTooltipPosition(targetElement, currentStep.position);
      
      // アニメーション効果のためにタイマーを設定
      setTimeout(() => {
        setShowTooltip(true);
      }, 300);
    }
    
    // クリーンアップ関数
    return () => {
      const targetElement = stepElements[activeStep];
      if (targetElement) {
        targetElement.classList.remove('tour-highlight');
      }
      setShowTooltip(false);
    };
  }, [activeStep, isOpen, currentStep, showWelcomeDialog, showCompletionDialog, stepElements]);
  
  // ツールチップの位置を計算
  const calculateTooltipPosition = (targetElement: Element, position: TooltipPosition = 'bottom') => {
    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect() || { width: 300, height: 150 };
    
    let top = 0;
    let left = 0;
    
    // ウィンドウのサイズを取得
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - POSITION_OFFSET + window.scrollY;
        left = rect.left + (rect.width - tooltipRect.width) / 2 + window.scrollX;
        break;
      case 'bottom':
        top = rect.bottom + POSITION_OFFSET + window.scrollY;
        left = rect.left + (rect.width - tooltipRect.width) / 2 + window.scrollX;
        break;
      case 'left':
        top = rect.top + (rect.height - tooltipRect.height) / 2 + window.scrollY;
        left = rect.left - tooltipRect.width - POSITION_OFFSET + window.scrollX;
        break;
      case 'right':
        top = rect.top + (rect.height - tooltipRect.height) / 2 + window.scrollY;
        left = rect.right + POSITION_OFFSET + window.scrollX;
        break;
    }
    
    // 画面からはみ出る場合は調整
    if (left < 0) left = POSITION_OFFSET;
    if (top < 0) top = POSITION_OFFSET;
    if (left + tooltipRect.width > windowWidth) {
      left = windowWidth - tooltipRect.width - POSITION_OFFSET;
    }
    if (top + tooltipRect.height > windowHeight + window.scrollY) {
      top = windowHeight - tooltipRect.height - POSITION_OFFSET + window.scrollY;
    }
    
    setTooltipPosition({ top, left });
  };
  
  // 次のステップへ
  const handleNext = () => {
    if (activeStep === tour.steps.length - 1) {
      setShowCompletionDialog(true);
      setShowTooltip(false);
    } else {
      setActiveStep(activeStep + 1);
    }
  };
  
  // 前のステップへ
  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };
  
  // ツアーをスキップ
  const handleSkip = () => {
    setShowTooltip(false);
    if (onSkip) onSkip();
    onClose();
  };
  
  // ツアーを完了
  const handleComplete = () => {
    if (onComplete) onComplete();
    onClose();
  };
  
  // ウェルカムダイアログを閉じてツアーを開始
  const handleStartTour = () => {
    setShowWelcomeDialog(false);
  };
  
  // オーバーレイスタイル
  const overlayStyle = {
    position: 'fixed' as 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1500,
    pointerEvents: 'none',
  };
  
  // ウェルカムダイアログの表示
  if (showWelcomeDialog) {
    return (
      <Dialog
        open={isOpen}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <TipIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
          {tour.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            {tour.description}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            このツアーでは、{tour.steps.length}ステップで主要機能を紹介します。いつでも途中でスキップできます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>
            スキップ
          </Button>
          <Button 
            onClick={handleStartTour} 
            variant="contained" 
            startIcon={<StartIcon />}
          >
            ツアーを開始
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  // 完了ダイアログの表示
  if (showCompletionDialog) {
    return (
      <Dialog
        open={isOpen}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <CompleteIcon sx={{ mr: 1, color: theme.palette.success.main }} />
          ツアー完了
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            おめでとうございます！「{tour.name}」ツアーを完了しました。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            より詳しい情報はヘルプセンターで確認できます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleComplete} 
            variant="contained"
          >
            完了
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  if (isLoading) {
    return (
      <Box sx={overlayStyle} display="flex" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <>
      {/* 半透明オーバーレイ */}
      <Box sx={overlayStyle} />
      
      {/* ツールチップ */}
      <Zoom in={showTooltip}>
        <Paper
          ref={tooltipRef}
          sx={{
            position: 'absolute',
            zIndex: 1600,
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: 300,
            p: 2,
            boxShadow: 5,
            borderRadius: 2,
            border: `1px solid ${theme.palette.primary.main}`,
            transition: 'top 0.3s ease, left 0.3s ease',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              {currentStep?.title}
            </Typography>
            <IconButton size="small" onClick={handleSkip}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            {currentStep?.content}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {activeStep + 1} / {tour.steps.length}
              </Typography>
              <Tooltip title="ツアーをスキップ">
                <IconButton size="small" onClick={handleSkip} sx={{ ml: 1 }}>
                  <SkipIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Box>
              <Button
                size="small"
                onClick={handleBack}
                disabled={activeStep === 0}
                sx={{ mr: 1 }}
              >
                戻る
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleNext}
                endIcon={<NextIcon />}
              >
                {activeStep === tour.steps.length - 1 ? '完了' : '次へ'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Zoom>
    </>
  );
};

export default ProductTour;