import React from 'react';
import { 
  Badge, 
  Box, 
  IconButton, 
  Tooltip, 
  Typography,
  Popover,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
  CircularProgress
} from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useOffline } from '../../contexts/OfflineContext';
import { format } from 'date-fns';

export const OfflineIndicator: React.FC = () => {
  const { 
    isOffline, 
    pendingActions, 
    pendingActionsCount,
    isSyncing,
    lastSyncTime,
    cachedEntities,
    syncNow
  } = useOffline();
  
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const open = Boolean(anchorEl);
  
  // Group pending actions by entity type
  const pendingByType: Record<string, number> = {};
  pendingActions.forEach(action => {
    pendingByType[action.entityType] = (pendingByType[action.entityType] || 0) + 1;
  });
  
  if (!isOffline && pendingActionsCount === 0) {
    return null;
  }
  
  return (
    <>
      <Tooltip title={isOffline ? "You are offline" : `${pendingActionsCount} pending actions to sync`}>
        <IconButton 
          color={isOffline ? "error" : "warning"} 
          onClick={handleClick}
          aria-label="Offline status"
        >
          <Badge badgeContent={pendingActionsCount} color="error" overlap="circular">
            {isOffline ? <CloudOffIcon /> : <SyncIcon />}
          </Badge>
        </IconButton>
      </Tooltip>
      
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 350 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {isOffline ? "You are currently offline" : "Connection Status"}
          </Typography>
          
          {!isOffline && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You're online, but have pending changes that need to be synchronized.
            </Typography>
          )}
          
          {isOffline && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Changes you make will be saved locally and synchronized when your connection is restored.
            </Typography>
          )}
          
          {pendingActionsCount > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Pending Changes
              </Typography>
              <List dense disablePadding>
                {Object.entries(pendingByType).map(([type, count]) => (
                  <ListItem key={type} disablePadding sx={{ py: 0.5 }}>
                    <ListItemText 
                      primary={`${type} (${count})`}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
          
          {cachedEntities.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Cached Data
              </Typography>
              <List dense disablePadding>
                {cachedEntities.map((entity) => (
                  <ListItem key={entity} disablePadding sx={{ py: 0.5 }}>
                    <ListItemText 
                      primary={entity}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
          
          {lastSyncTime && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Last synchronized: {format(lastSyncTime, 'MMM d, yyyy HH:mm:ss')}
            </Typography>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              onClick={syncNow}
              disabled={isOffline || isSyncing || pendingActionsCount === 0}
              color="primary"
              startIcon={isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
              size="small"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default OfflineIndicator;