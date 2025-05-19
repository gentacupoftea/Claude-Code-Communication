import React from 'react';
import { Box, Typography, Button, Paper, LinearProgress } from '@mui/material';
import { Sync, CheckCircle, Error } from '@mui/icons-material';
import { ECPlatform } from '../../../types';

interface PlatformStatus {
  platform: ECPlatform;
  lastSync: Date;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  progress?: number;
}

interface PlatformSyncProps {
  platforms: PlatformStatus[];
  onSync: (platform: ECPlatform) => void;
}

export const PlatformSync: React.FC<PlatformSyncProps> = ({ platforms, onSync }) => {
  const platformLabels: Record<ECPlatform, string> = {
    shopify: 'Shopify',
    rakuten: '楽天',
    yahoo: 'Yahoo!',
    amazon: 'Amazon',
    base: 'BASE',
    mercari: 'メルカリ',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'syncing':
        return <Sync className="animate-spin" />;
      default:
        return <Sync color="disabled" />;
    }
  };

  return (
    <Box>
      {platforms.map((platform) => (
        <Paper
          key={platform.platform}
          sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center' }}
        >
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1" fontWeight="medium">
                {platformLabels[platform.platform]}
              </Typography>
              {getStatusIcon(platform.status)}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Last sync: {new Date(platform.lastSync).toLocaleString()}
            </Typography>
            {platform.status === 'syncing' && platform.progress && (
              <LinearProgress
                variant="determinate"
                value={platform.progress}
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Sync />}
            onClick={() => onSync(platform.platform)}
            disabled={platform.status === 'syncing'}
          >
            Sync
          </Button>
        </Paper>
      ))}
    </Box>
  );
};