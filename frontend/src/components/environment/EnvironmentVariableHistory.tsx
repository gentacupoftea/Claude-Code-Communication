/**
 * Environment Variable History Component
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Box,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import type { EnvironmentVariableHistory } from '../../types/environment';
import { environmentApi } from '../../api/environment';

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingRight: theme.spacing(1),
}));

const HistoryItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
}));

const ValueContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  marginTop: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
}));

const ChangeIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

interface EnvironmentVariableHistoryProps {
  category?: string;
  key?: string;
  isOpen: boolean;
  onClose: () => void;
}

const EnvironmentVariableHistory: React.FC<EnvironmentVariableHistoryProps> = ({
  category,
  key,
  isOpen,
  onClose
}) => {
  const [history, setHistory] = useState<EnvironmentVariableHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, category, key]);

  const loadHistory = async () => {
    if (!category && !key) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const historyData = await environmentApi.getVariableHistory({
        category,
        key,
        limit: 50
      });
      setHistory(historyData);
    } catch (err) {
      setError('履歴の読み込みに失敗しました');
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get change type icon and label
  const getChangeInfo = (entry: EnvironmentVariableHistory) => {
    if (!entry.previous_value && entry.new_value) {
      return {
        icon: <AddIcon color="success" />,
        label: '作成',
        color: 'success' as const
      };
    } else if (entry.previous_value && !entry.new_value) {
      return {
        icon: <DeleteIcon color="error" />,
        label: '削除',
        color: 'error' as const
      };
    } else {
      return {
        icon: <EditIcon color="primary" />,
        label: '更新',
        color: 'primary' as const
      };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('ja-JP'),
      time: date.toLocaleTimeString('ja-JP')
    };
  };

  // Render value diff
  const renderValueDiff = (entry: EnvironmentVariableHistory) => {
    const changeInfo = getChangeInfo(entry);

    if (changeInfo.label === '作成') {
      return (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            新しい値:
          </Typography>
          <ValueContainer>
            <Typography variant="body2">
              {entry.new_value || '(空)'}
            </Typography>
          </ValueContainer>
        </Box>
      );
    }

    if (changeInfo.label === '削除') {
      return (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            削除された値:
          </Typography>
          <ValueContainer>
            <Typography variant="body2">
              {entry.previous_value || '(空)'}
            </Typography>
          </ValueContainer>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          変更前:
        </Typography>
        <ValueContainer>
          <Typography variant="body2" color="text.secondary">
            {entry.previous_value || '(空)'}
          </Typography>
        </ValueContainer>

        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 1 }}>
          変更後:
        </Typography>
        <ValueContainer>
          <Typography variant="body2">
            {entry.new_value || '(空)'}
          </Typography>
        </ValueContainer>
      </Box>
    );
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: '60vh' } }}
    >
      <StyledDialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <HistoryIcon />
          <Typography variant="h6">
            変更履歴
            {category && key && (
              <Typography variant="subtitle2" color="text.secondary">
                {category}/{key}
              </Typography>
            )}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : history.length === 0 ? (
          <Alert severity="info">変更履歴がありません</Alert>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {history.length} 件の変更履歴
            </Typography>
            
            <List disablePadding>
              {history.map((entry, index) => {
                const changeInfo = getChangeInfo(entry);
                const timestamp = formatTimestamp(entry.changed_at);

                return (
                  <React.Fragment key={entry.id}>
                    <HistoryItem elevation={0}>
                      <ChangeIndicator>
                        {changeInfo.icon}
                        <Chip
                          label={changeInfo.label}
                          size="small"
                          color={changeInfo.color}
                          variant="outlined"
                        />
                        <Box display="flex" alignItems="center" gap={1} ml="auto">
                          <PersonIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {entry.changed_by}
                          </Typography>
                          <ScheduleIcon fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {timestamp.date} {timestamp.time}
                          </Typography>
                        </Box>
                      </ChangeIndicator>

                      {renderValueDiff(entry)}

                      {entry.notes && (
                        <Box mt={1}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            メモ:
                          </Typography>
                          <Typography variant="body2">
                            {entry.notes}
                          </Typography>
                        </Box>
                      )}
                    </HistoryItem>

                    {index < history.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                );
              })}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnvironmentVariableHistory;