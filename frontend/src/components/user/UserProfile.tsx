import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import {
  Email as EmailIcon,
  Person as PersonIcon,
  SecurityOutlined as SecurityIcon,
  Badge as BadgeIcon,
  Edit as EditIcon,
  Apartment as OrganizationIcon,
  Key as PermissionIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface UserProfileProps {
  className?: string;
  showActions?: boolean;
  onEdit?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  className, 
  showActions = true,
  onEdit 
}) => {
  const { user, hasPermission, hasRole } = useAuth();
  const theme = useTheme();
  
  if (!user) {
    return (
      <Card className={className}>
        <CardContent>
          <Typography color="error">
            User not authenticated
          </Typography>
        </CardContent>
      </Card>
    );
  }
  
  // Get initials for avatar when no image is available
  const getInitials = () => {
    if (!user.name) return 'U';
    return user.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Format date
  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get role display name
  const getRoleDisplay = () => {
    if (!user.role) return 'No role assigned';
    
    const roleMap: Record<string, string> = {
      'admin': '管理者',
      'editor': '編集者',
      'viewer': '閲覧者',
      'user': '一般ユーザー'
    };
    
    return roleMap[user.role] || user.role;
  };
  
  // Get role color
  const getRoleColor = () => {
    if (!user.role) return 'default';
    
    const roleColorMap: Record<string, string> = {
      'admin': 'error',
      'editor': 'primary',
      'viewer': 'info',
      'user': 'default'
    };
    
    return roleColorMap[user.role] || 'default';
  };
  
  return (
    <Card className={className} elevation={0} variant="outlined">
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80,
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              fontSize: '2rem'
            }}
            src={user.avatar}
          >
            {getInitials()}
          </Avatar>
          
          <Box ml={3}>
            <Typography variant="h5" gutterBottom>
              {user.name || 'User'}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center">
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body2" color="textSecondary">
                {user.email}
              </Typography>
            </Stack>
            
            <Stack direction="row" spacing={1} alignItems="center" mt={1}>
              <Chip 
                label={getRoleDisplay()} 
                size="small" 
                color={getRoleColor() as any}
                icon={<BadgeIcon />} 
              />
            </Stack>
          </Box>
          
          {showActions && onEdit && (
            <Box ml="auto">
              <Button
                startIcon={<EditIcon />}
                onClick={onEdit}
                variant="outlined"
                size="small"
              >
                編集
              </Button>
            </Box>
          )}
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{ p: 2, height: '100%', bgcolor: 'background.default' }}
            >
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="primary">
                  <PersonIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  ユーザー情報
                </Typography>
                
                <Divider />
                
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    ユーザーID
                  </Typography>
                  <Typography variant="body1">
                    {user.id}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    最終ログイン
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(user.lastLogin)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper
              variant="outlined"
              sx={{ p: 2, height: '100%', bgcolor: 'background.default' }}
            >
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="primary">
                  <SecurityIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                  権限情報
                </Typography>
                
                <Divider />
                
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    権限リスト
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {user.permissions && user.permissions.length > 0 ? (
                      user.permissions.map((permission) => (
                        <Chip
                          key={permission}
                          label={permission}
                          size="small"
                          variant="outlined"
                          icon={<PermissionIcon fontSize="small" />}
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        権限が設定されていません
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default UserProfile;