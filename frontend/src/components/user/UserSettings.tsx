import React, { useState, useEffect } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  Save as SaveIcon,
  PhotoCamera as PhotoCameraIcon,
  VpnKey as PasswordIcon,
  Palette as ThemeIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { useAuth, User } from '../../contexts/AuthContext';

interface UserSettingsProps {
  className?: string;
  onSaved?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const UserSettings: React.FC<UserSettingsProps> = ({ className, onSaved }) => {
  const { user, updateUser, error, clearError } = useAuth();
  const theme = useTheme();
  
  // State
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  // Load user data into form
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email,
      });
    }
  }, [user]);
  
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
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
  };
  
  const handleProfileSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // In a real app, you'd call an API to update the user info
      // For now, we'll just update the local state
      updateUser({ ...user, ...formData });
      setSuccess(true);
      
      if (onSaved) {
        onSaved();
      }
    } catch (err) {
      console.error('Failed to update profile', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangePassword = async () => {
    if (!user) return;
    
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      // Set error manually for password mismatch
      alert('New passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      // In a real app, you'd call an API to change the password
      // authService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      console.log('Password change would be submitted here');
      setSuccess(true);
      
      // Reset password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Failed to change password', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCloseSnackbar = () => {
    setSuccess(false);
  };
  
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
  
  return (
    <Card className={className} elevation={0} variant="outlined">
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="settings tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              icon={<Avatar sx={{ width: 20, height: 20 }} />} 
              iconPosition="start" 
              label="プロフィール" 
            />
            <Tab
              icon={<PasswordIcon />}
              iconPosition="start"
              label="パスワード"
            />
            <Tab
              icon={<ThemeIcon />}
              iconPosition="start"
              label="外観設定"
            />
            <Tab
              icon={<NotificationsIcon />}
              iconPosition="start"
              label="通知設定"
            />
          </Tabs>
        </Box>
        
        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
              >
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    mb: 2,
                    bgcolor: theme.palette.primary.main,
                    fontSize: '3rem',
                  }}
                  src={user.avatar}
                >
                  {getInitials()}
                </Avatar>
                
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="avatar-upload"
                  type="file"
                />
                <label htmlFor="avatar-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<PhotoCameraIcon />}
                    size="small"
                  >
                    アバターを変更
                  </Button>
                </label>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="名前"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                margin="normal"
                variant="outlined"
                autoComplete="name"
              />
              
              <TextField
                fullWidth
                label="メールアドレス"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                margin="normal"
                variant="outlined"
                type="email"
                autoComplete="email"
                disabled  // Email is typically not changed directly
              />
              
              <Box mt={3} display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={handleProfileSave}
                  disabled={loading}
                >
                  変更を保存
                </Button>
              </Box>
            </Grid>
          </Grid>
        </TabPanel>
        
        {/* Password Tab */}
        <TabPanel value={tabValue} index={1}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              パスワード変更
            </Typography>
            
            <TextField
              fullWidth
              label="現在のパスワード"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handlePasswordChange}
              margin="normal"
              variant="outlined"
              type="password"
              required
            />
            
            <TextField
              fullWidth
              label="新しいパスワード"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handlePasswordChange}
              margin="normal"
              variant="outlined"
              type="password"
              required
              helperText="8文字以上で、文字、数字、特殊文字を含めてください"
            />
            
            <TextField
              fullWidth
              label="新しいパスワード（確認）"
              name="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={handlePasswordChange}
              margin="normal"
              variant="outlined"
              type="password"
              required
              error={
                passwordData.newPassword !== '' &&
                passwordData.confirmPassword !== '' &&
                passwordData.newPassword !== passwordData.confirmPassword
              }
              helperText={
                passwordData.newPassword !== '' &&
                passwordData.confirmPassword !== '' &&
                passwordData.newPassword !== passwordData.confirmPassword
                  ? 'パスワードが一致しません'
                  : ' '
              }
            />
            
            <Box mt={3} display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                color="primary"
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleChangePassword}
                disabled={
                  loading ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword ||
                  passwordData.newPassword !== passwordData.confirmPassword
                }
              >
                パスワードを変更
              </Button>
            </Box>
          </Paper>
        </TabPanel>
        
        {/* Theme Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography>外観設定の内容がここに表示されます</Typography>
        </TabPanel>
        
        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography>通知設定の内容がここに表示されます</Typography>
        </TabPanel>
      </CardContent>
      
      {/* Success message */}
      <Snackbar
        open={success}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          設定が保存されました
        </Alert>
      </Snackbar>
      
      {/* Error message */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={clearError}
      >
        <Alert onClose={clearError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default UserSettings;