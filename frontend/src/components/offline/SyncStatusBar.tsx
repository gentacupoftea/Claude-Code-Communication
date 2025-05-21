import React from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  LinearProgress,
  Paper,
  Typography,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import { useOffline } from '../../contexts/OfflineContext';

interface SyncStatusBarProps {
  showWhenOnline?: boolean;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  showWhenOnline = false
}) => {
  const {
    isOffline,
    pendingActionsCount,
    isSyncing,
    syncNow
  } = useOffline();
  
  const [open, setOpen] = React.useState(true);
  
  // Don't show when there's nothing to sync and we're online (unless overridden)
  if (!isOffline && pendingActionsCount === 0 && !showWhenOnline) {
    return null;
  }
  
  // Message based on current status
  let severity: 'warning' | 'error' | 'info' | 'success' = 'info';
  let message = 'You have pending changes that will be synchronized.';
  
  if (isOffline) {
    severity = 'error';
    message = 'You are currently offline. Changes will be synchronized when your connection is restored.';
  } else if (pendingActionsCount > 0) {
    severity = 'warning';
    message = `You have ${pendingActionsCount} pending ${
      pendingActionsCount === 1 ? 'change' : 'changes'
    } to synchronize.`;
  } else {
    severity = 'success';
    message = 'All data is synchronized.';
  }
  
  return (
    <Collapse in={open}>
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: 0, 
          borderBottom: 1, 
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Alert
          severity={severity}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {!isOffline && pendingActionsCount > 0 && (
                <Button
                  size="small"
                  startIcon={<SyncIcon />}
                  disabled={isSyncing}
                  onClick={syncNow}
                  sx={{ mr: 1 }}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => setOpen(false)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
        >
          <Typography variant="body2">{message}</Typography>
        </Alert>
        {isSyncing && (
          <LinearProgress color="primary" />
        )}
      </Paper>
    </Collapse>
  );
};

export default SyncStatusBar;