import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  Chip,
  IconButton,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  ThumbUp,
  ThumbDown,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  Lightbulb,
  Speed,
  Psychology,
  Close,
  Refresh
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import advancedAiService, { 
  AIRecommendation, 
  RecommendationFeedback,
  PredictionResult 
} from '../../services/advancedAiService';

interface SmartRecommendationPanelProps {
  context?: Record<string, any>;
  maxRecommendations?: number;
  showPredictions?: boolean;
}

const SmartRecommendationPanel: React.FC<SmartRecommendationPanelProps> = ({
  context,
  maxRecommendations = 5,
  showPredictions = true
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    recommendation: AIRecommendation | null;
  }>({ open: false, recommendation: null });
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [feedbackForm, setFeedbackForm] = useState<Partial<RecommendationFeedback>>({});

  useEffect(() => {
    if (user?.id) {
      loadRecommendations();
      if (showPredictions) {
        loadPredictions();
      }
    }
  }, [user?.id, context, showPredictions]);

  const loadRecommendations = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const recs = await advancedAiService.getRecommendations(user.id, context);
      setRecommendations(recs.slice(0, maxRecommendations));
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPredictions = async () => {
    if (!user?.id) return;
    
    try {
      const behaviorPredictions = await advancedAiService.predictUserBehavior(
        user.id, 
        '7d', 
        context
      );
      setPredictions(behaviorPredictions.slice(0, 3));
    } catch (error) {
      console.error('Failed to load predictions:', error);
    }
  };

  const handleFeedback = (recommendation: AIRecommendation, useful: boolean) => {
    if (useful) {
      setFeedbackDialog({ open: true, recommendation });
      setFeedbackForm({ useful: true, rating: 5 });
    } else {
      submitFeedback(recommendation, { useful: false, rating: 2, implemented: false });
    }
  };

  const submitFeedback = async (
    recommendation: AIRecommendation, 
    feedback: Partial<RecommendationFeedback>
  ) => {
    try {
      await advancedAiService.submitRecommendationFeedback(
        recommendation.id,
        feedback as Omit<RecommendationFeedback, 'timestamp'>
      );
      
      // Update local state
      setRecommendations(prev => 
        prev.map(rec => 
          rec.id === recommendation.id 
            ? { ...rec, feedback: { ...feedback, timestamp: new Date() } as RecommendationFeedback }
            : rec
        )
      );
      
      setFeedbackDialog({ open: false, recommendation: null });
      setFeedbackForm({});
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const toggleExpanded = (recommendationId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(recommendationId)) {
      newExpanded.delete(recommendationId);
    } else {
      newExpanded.add(recommendationId);
    }
    setExpandedCards(newExpanded);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'optimization': return <Speed />;
      case 'insight': return <Psychology />;
      case 'action': return <TrendingUp />;
      default: return <Lightbulb />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">AI Recommendations</Typography>
        <Button 
          startIcon={<Refresh />} 
          onClick={loadRecommendations}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Predictions Section */}
      {showPredictions && predictions.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: 'primary.50' }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
              Behavioral Predictions
            </Typography>
            <List dense>
              {predictions.map((prediction, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <TrendingUp color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={prediction.prediction}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" sx={{ mr: 1 }}>Confidence:</Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={prediction.confidence * 100}
                          sx={{ flexGrow: 1, mr: 1 }}
                        />
                        <Typography variant="caption">
                          {Math.round(prediction.confidence * 100)}%
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              No recommendations available at this time.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        recommendations.map((recommendation) => {
          const isExpanded = expandedCards.has(recommendation.id);
          const hasFeedback = !!recommendation.feedback;
          
          return (
            <Card key={recommendation.id} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                    {getTypeIcon(recommendation.type)}
                    <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                      {recommendation.title}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={recommendation.priority} 
                      size="small"
                      color={getPriorityColor(recommendation.priority) as any}
                    />
                    <Chip 
                      label={recommendation.type} 
                      size="small" 
                      variant="outlined"
                    />
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {recommendation.description}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ mr: 1 }}>Confidence:</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={recommendation.confidence * 100}
                    sx={{ flexGrow: 1, mr: 1 }}
                  />
                  <Typography variant="caption">
                    {Math.round(recommendation.confidence * 100)}%
                  </Typography>
                </Box>

                <Collapse in={isExpanded}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>Details:</Typography>
                    <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
                      {JSON.stringify(recommendation.data, null, 2)}
                    </pre>
                  </Box>
                </Collapse>
              </CardContent>

              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Box>
                  {!hasFeedback ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="This recommendation was helpful">
                        <IconButton 
                          color="success"
                          onClick={() => handleFeedback(recommendation, true)}
                        >
                          <ThumbUp />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="This recommendation was not helpful">
                        <IconButton 
                          color="error"
                          onClick={() => handleFeedback(recommendation, false)}
                        >
                          <ThumbDown />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rating 
                        value={recommendation.feedback?.rating} 
                        size="small" 
                        readOnly 
                      />
                      <Typography variant="caption" color="text.secondary">
                        Feedback submitted
                      </Typography>
                    </Box>
                  )}
                </Box>

                <IconButton onClick={() => toggleExpanded(recommendation.id)}>
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </CardActions>
            </Card>
          );
        })
      )}

      {/* Feedback Dialog */}
      <Dialog 
        open={feedbackDialog.open} 
        onClose={() => setFeedbackDialog({ open: false, recommendation: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Recommendation Feedback
          <IconButton
            sx={{ position: 'absolute', right: 8, top: 8 }}
            onClick={() => setFeedbackDialog({ open: false, recommendation: null })}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Help us improve our recommendations by providing feedback.
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography component="legend">How would you rate this recommendation?</Typography>
            <Rating
              value={feedbackForm.rating || 0}
              onChange={(_, value) => setFeedbackForm(prev => ({ ...prev, rating: value || 0 }))}
            />
          </Box>
          
          <FormControlLabel
            control={
              <Checkbox
                checked={feedbackForm.implemented || false}
                onChange={(e) => setFeedbackForm(prev => ({ 
                  ...prev, 
                  implemented: e.target.checked 
                }))}
              />
            }
            label="I implemented this recommendation"
          />
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Additional Comments (Optional)"
            value={feedbackForm.comment || ''}
            onChange={(e) => setFeedbackForm(prev => ({ 
              ...prev, 
              comment: e.target.value 
            }))}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setFeedbackDialog({ open: false, recommendation: null })}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (feedbackDialog.recommendation) {
                submitFeedback(feedbackDialog.recommendation, feedbackForm);
              }
            }}
            variant="contained"
          >
            Submit Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SmartRecommendationPanel;