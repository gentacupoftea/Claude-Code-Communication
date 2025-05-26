import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  FilterList as FilterIcon,
  Pattern as PatternIcon,
  ExpandMore as ExpandMoreIcon,
  AutoMode as AutoModeIcon,
  Lightbulb as LightbulbIcon
} from '@mui/icons-material';

interface AutomationManagerProps {
  apiEndpoint?: string;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: any;
  actions: any[];
  enabled: boolean;
  created_at: string;
  last_triggered?: string;
  execution_count: number;
}

interface Suggestion {
  task_type: string;
  frequency: number;
  suggestion: string;
  confidence: number;
}

const triggerTypeIcons: { [key: string]: React.ReactElement } = {
  time_based: <ScheduleIcon />,
  event_based: <EventIcon />,
  condition_based: <FilterIcon />,
  pattern_based: <PatternIcon />
};

const triggerTypeLabels: { [key: string]: string } = {
  time_based: '時間ベース',
  event_based: 'イベントベース',
  condition_based: '条件ベース',
  pattern_based: 'パターンベース'
};

export const AutomationManager: React.FC<AutomationManagerProps> = ({
  apiEndpoint = 'http://localhost:9001'
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  
  // 新規ルールのフォーム状態
  const [newRule, setNewRule] = useState<{
    name: string;
    description: string;
    trigger_type: string;
    trigger_config: any;
    actions: Array<{ type: string; config: any }>;
    active: boolean;
  }>({
    name: '',
    description: '',
    trigger_type: 'time_based',
    trigger_config: {},
    actions: [],
    active: true
  });

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiEndpoint}/api/automation/rules`);
      if (!response.ok) throw new Error('ルールの取得に失敗しました');
      
      const data = await response.json();
      setRules(data.rules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/automation/suggest`);
      if (!response.ok) throw new Error('提案の取得に失敗しました');
      
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('提案の取得エラー:', err);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchSuggestions();
  }, []);

  const handleCreateRule = async () => {
    try {
      const response = await fetch(`${apiEndpoint}/api/automation/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      
      if (!response.ok) throw new Error('ルールの作成に失敗しました');
      
      setOpenDialog(false);
      setNewRule({
        name: '',
        description: '',
        trigger_type: 'time_based',
        trigger_config: {},
        actions: [],
        active: true
      });
      
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('このルールを削除しますか？')) return;
    
    try {
      const response = await fetch(`${apiEndpoint}/api/automation/rules/${ruleId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('ルールの削除に失敗しました');
      
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    }
  };

  const handleExecuteRule = async (ruleId: string) => {
    setExecuting(ruleId);
    
    try {
      const response = await fetch(`${apiEndpoint}/api/automation/execute/${ruleId}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('ルールの実行に失敗しました');
      
      const result = await response.json();
      
      // 成功メッセージを表示
      alert(`ルールが実行されました。実行されたアクション: ${result.executed_actions.join(', ')}`);
      
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラー');
    } finally {
      setExecuting(null);
    }
  };

  const renderTriggerConfig = (type: string, config: any) => {
    switch (type) {
      case 'time_based':
        return `${config.interval_minutes || 0}分ごと`;
      case 'event_based':
        return `イベント: ${config.event_type || '未設定'}`;
      case 'condition_based':
        return `条件: ${config.condition || '未設定'}`;
      case 'pattern_based':
        return `パターン: ${config.pattern || '未設定'}`;
      default:
        return JSON.stringify(config);
    }
  };

  const renderCreateRuleDialog = () => (
    <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle>新規自動化ルール</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="ルール名"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="説明"
              value={newRule.description}
              onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>トリガータイプ</InputLabel>
              <Select
                value={newRule.trigger_type}
                label="トリガータイプ"
                onChange={(e) => setNewRule({ ...newRule, trigger_type: e.target.value })}
              >
                <MenuItem value="time_based">時間ベース</MenuItem>
                <MenuItem value="event_based">イベントベース</MenuItem>
                <MenuItem value="condition_based">条件ベース</MenuItem>
                <MenuItem value="pattern_based">パターンベース</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {newRule.trigger_type === 'time_based' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="実行間隔（分）"
                value={newRule.trigger_config.interval_minutes || ''}
                onChange={(e) => setNewRule({
                  ...newRule,
                  trigger_config: { ...newRule.trigger_config, interval_minutes: parseInt(e.target.value) }
                })}
              />
            </Grid>
          )}
          
          {newRule.trigger_type === 'condition_based' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="条件式"
                placeholder="例: queue_size > 10"
                value={newRule.trigger_config.condition || ''}
                onChange={(e) => setNewRule({
                  ...newRule,
                  trigger_config: { ...newRule.trigger_config, condition: e.target.value }
                })}
              />
            </Grid>
          )}
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              アクション
            </Typography>
            <FormControl fullWidth>
              <Select
                value=""
                onChange={(e) => {
                  const actionType = e.target.value;
                  setNewRule({
                    ...newRule,
                    actions: [...newRule.actions, { type: actionType, config: {} }]
                  });
                }}
                displayEmpty
              >
                <MenuItem value="" disabled>アクションを追加</MenuItem>
                <MenuItem value="memory_sync">メモリ同期</MenuItem>
                <MenuItem value="scale_workers">ワーカースケーリング</MenuItem>
                <MenuItem value="generate_report">レポート生成</MenuItem>
                <MenuItem value="send_notification">通知送信</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ mt: 1 }}>
              {newRule.actions.map((action, index) => (
                <Chip
                  key={index}
                  label={action.type}
                  onDelete={() => {
                    setNewRule({
                      ...newRule,
                      actions: newRule.actions.filter((_, i) => i !== index)
                    });
                  }}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={newRule.active}
                  onChange={(e) => setNewRule({ ...newRule, active: e.target.checked })}
                />
              }
              label="有効"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenDialog(false)}>キャンセル</Button>
        <Button
          onClick={handleCreateRule}
          variant="contained"
          disabled={!newRule.name || newRule.actions.length === 0}
        >
          作成
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          自動化管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          新規ルール
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 自動化の提案 */}
      {suggestions.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LightbulbIcon sx={{ mr: 1, color: 'warning.main' }} />
              <Typography variant="h6">自動化の提案</Typography>
            </Box>
            <Grid container spacing={2}>
              {suggestions.map((suggestion, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {suggestion.suggestion}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Chip
                        label={`実行回数: ${suggestion.frequency}`}
                        size="small"
                        color="primary"
                      />
                      <Chip
                        label={`信頼度: ${(suggestion.confidence * 100).toFixed(0)}%`}
                        size="small"
                        color={suggestion.confidence > 0.7 ? 'success' : 'default'}
                      />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* ルール一覧 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <List>
          {rules.map((rule) => (
            <Accordion key={rule.id} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                  <Box sx={{ mr: 2 }}>
                    {triggerTypeIcons[rule.trigger_type]}
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{rule.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {rule.description}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={rule.enabled ? '有効' : '無効'}
                      color={rule.enabled ? 'success' : 'default'}
                      size="small"
                    />
                    <Chip
                      label={`実行回数: ${rule.execution_count}`}
                      size="small"
                    />
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      トリガー設定
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2">
                        タイプ: {triggerTypeLabels[rule.trigger_type]}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        設定: {renderTriggerConfig(rule.trigger_type, rule.trigger_config)}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      アクション
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      {rule.actions.map((action, index) => (
                        <Chip
                          key={index}
                          label={action.type}
                          sx={{ mr: 1, mb: 1 }}
                          icon={<AutoModeIcon />}
                        />
                      ))}
                    </Paper>
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        {rule.last_triggered && (
                          <Typography variant="caption" color="text.secondary">
                            最終実行: {new Date(rule.last_triggered).toLocaleString('ja-JP')}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <Tooltip title="手動実行">
                          <IconButton
                            onClick={() => handleExecuteRule(rule.id)}
                            disabled={executing === rule.id}
                            color="primary"
                          >
                            {executing === rule.id ? <CircularProgress size={24} /> : <PlayIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="削除">
                          <IconButton
                            onClick={() => handleDeleteRule(rule.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </List>
      )}

      {renderCreateRuleDialog()}
    </Box>
  );
};

export default AutomationManager;