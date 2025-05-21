/**
 * セキュリティ設定コンポーネント
 * 
 * パスワード、2段階認証、セッション設定などのセキュリティオプション
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  InputAdornment,
  IconButton,
  Stack,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Paper,
} from '@mui/material';
import {
  VpnKey,
  Security,
  Timeline,
  Computer,
  VerifiedUser,
  Visibility,
  VisibilityOff,
  KeyboardArrowRight,
  History,
  Lock,
  AccessTime,
  CreditCard,
  Delete,
  SyncAlt,
  SaveAlt,
  ContentCopy,
  Check,
  Error as ErrorIcon,
  QrCode2,
  PhoneAndroid,
  Email,
} from '@mui/icons-material';

const SecuritySettings: React.FC = () => {
  // パスワード変更
  const [passwordValues, setPasswordValues] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);
  
  // 2段階認証
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const [twoFactorActiveStep, setTwoFactorActiveStep] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodesVisible, setRecoverCodesVisible] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState('app');
  
  // セッション設定
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [rememberMe, setRememberMe] = useState(true);
  const [sessionHistory, setSessionHistory] = useState([
    {
      id: '1',
      device: 'Chrome on macOS',
      location: '東京, 日本',
      ip: '192.168.1.1',
      time: '2023/12/03 14:30',
      current: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone',
      location: '大阪, 日本',
      ip: '192.168.1.2',
      time: '2023/12/01 10:15',
      current: false,
    },
    {
      id: '3',
      device: 'Firefox on Windows',
      location: '京都, 日本',
      ip: '192.168.1.3',
      time: '2023/11/28 09:45',
      current: false,
    },
  ]);
  
  // APIキー
  const [apiKeys, setApiKeys] = useState([
    {
      id: 'api_key_1',
      name: 'デスクトップアプリ',
      created: '2023/10/15',
      lastUsed: '2023/12/03',
      scopes: ['read', 'write'],
    },
    {
      id: 'api_key_2',
      name: 'モバイルアプリ',
      created: '2023/09/22',
      lastUsed: '2023/11/30',
      scopes: ['read'],
    },
  ]);
  
  // メソッド
  const handlePasswordChange = (prop: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordValues({ ...passwordValues, [prop]: event.target.value });
    setPasswordError(null);
  };
  
  const handleClickShowPassword = (field: 'current' | 'new' | 'confirm') => {
    setShowPassword({ ...showPassword, [field]: !showPassword[field] });
  };
  
  const handleSubmitPasswordChange = async () => {
    // バリデーション
    if (
      !passwordValues.currentPassword ||
      !passwordValues.newPassword ||
      !passwordValues.confirmPassword
    ) {
      setPasswordError('すべてのフィールドを入力してください');
      return;
    }
    
    if (passwordValues.newPassword !== passwordValues.confirmPassword) {
      setPasswordError('新しいパスワードと確認用パスワードが一致しません');
      return;
    }
    
    if (passwordValues.newPassword.length < 8) {
      setPasswordError('新しいパスワードは8文字以上である必要があります');
      return;
    }
    
    // パスワード変更処理
    setChangingPassword(true);
    
    try {
      // シミュレーション
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 成功
      setPasswordSuccess(true);
      setPasswordValues({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 5000);
    } catch (error) {
      setPasswordError('パスワードの変更に失敗しました');
    } finally {
      setChangingPassword(false);
    }
  };
  
  // 2段階認証設定ステップ
  const handleNextStep = () => {
    setTwoFactorActiveStep(prev => prev + 1);
  };
  
  const handlePrevStep = () => {
    setTwoFactorActiveStep(prev => prev - 1);
  };
  
  const handleCompleteTwoFactorSetup = () => {
    if (verificationCode === '123456') { // デモ用コード
      setTwoFactorEnabled(true);
      setTwoFactorSetupOpen(false);
      setTwoFactorActiveStep(0);
      setVerificationCode('');
    } else {
      // エラー処理
    }
  };
  
  // セッション終了
  const handleEndSession = (sessionId: string) => {
    setSessionHistory(prevSessions => 
      prevSessions.filter(session => session.id !== sessionId)
    );
  };
  
  // すべてのセッション終了
  const handleLogoutAllSessions = () => {
    const currentSession = sessionHistory.find(s => s.current);
    setSessionHistory(currentSession ? [currentSession] : []);
  };
  
  // APIキー生成
  const handleCreateApiKey = () => {
    // 新しいAPIキーの作成処理
  };
  
  // APIキー削除
  const handleDeleteApiKey = (keyId: string) => {
    setApiKeys(prevKeys => prevKeys.filter(key => key.id !== keyId));
  };
  
  // 2段階認証のリカバリーコード
  const recoveryCodes = [
    'ABCD-EFGH-1234',
    'IJKL-MNOP-5678',
    'QRST-UVWX-9012',
    'YZAB-CDEF-3456',
    'GHIJ-KLMN-7890',
  ];
  
  // コードのコピー
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };
  
  return (
    <Box>
      {/* パスワード変更 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <VpnKey />
        パスワード設定
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              パスワードが正常に変更されました
            </Alert>
          )}
          
          {passwordError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {passwordError}
            </Alert>
          )}
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="現在のパスワード"
                variant="outlined"
                type={showPassword.current ? 'text' : 'password'}
                value={passwordValues.currentPassword}
                onChange={handlePasswordChange('currentPassword')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => handleClickShowPassword('current')}
                        edge="end"
                      >
                        {showPassword.current ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="新しいパスワード"
                variant="outlined"
                type={showPassword.new ? 'text' : 'password'}
                value={passwordValues.newPassword}
                onChange={handlePasswordChange('newPassword')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => handleClickShowPassword('new')}
                        edge="end"
                      >
                        {showPassword.new ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="新しいパスワード（確認）"
                variant="outlined"
                type={showPassword.confirm ? 'text' : 'password'}
                value={passwordValues.confirmPassword}
                onChange={handlePasswordChange('confirmPassword')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => handleClickShowPassword('confirm')}
                        edge="end"
                      >
                        {showPassword.confirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleSubmitPasswordChange}
              disabled={changingPassword}
              startIcon={changingPassword ? <CircularProgress size={20} /> : <Lock />}
            >
              {changingPassword ? 'パスワード変更中...' : 'パスワードを変更'}
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* 2段階認証 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Security />
        2段階認証
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="subtitle1">
                2段階認証を有効にする
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ログイン時に追加の認証コードを要求し、セキュリティを向上させます
              </Typography>
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={twoFactorEnabled}
                  onChange={() => {
                    if (!twoFactorEnabled) {
                      setTwoFactorSetupOpen(true);
                    } else {
                      setTwoFactorEnabled(false);
                    }
                  }}
                />
              }
              label=""
            />
          </Box>
          
          {twoFactorEnabled && (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                2段階認証が有効になっています。
              </Alert>
              
              <Divider sx={{ my: 3 }} />
              
              <Typography variant="subtitle1" gutterBottom>
                認証方法
              </Typography>
              
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>優先認証方法</InputLabel>
                  <Select
                    value={twoFactorMethod}
                    onChange={(e) => setTwoFactorMethod(e.target.value as string)}
                    label="優先認証方法"
                  >
                    <MenuItem value="app">認証アプリ</MenuItem>
                    <MenuItem value="sms">SMS</MenuItem>
                    <MenuItem value="email">メール</MenuItem>
                  </Select>
                </FormControl>
                
                <Button variant="outlined" startIcon={<SyncAlt />}>
                  認証方法を変更
                </Button>
              </Stack>
              
              <Divider sx={{ my: 3 }} />
              
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  リカバリーコード
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  認証デバイスを紛失した場合に備えて、以下のリカバリーコードを安全な場所に保管してください。
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ mb: 1 }}>
                    <Button
                      size="small"
                      onClick={() => setRecoverCodesVisible(!recoveryCodesVisible)}
                      sx={{ mb: 1 }}
                    >
                      {recoveryCodesVisible ? 'コードを隠す' : 'コードを表示'}
                    </Button>
                  </Box>
                  
                  {recoveryCodesVisible && (
                    <Grid container spacing={1}>
                      {recoveryCodes.map((code) => (
                        <Grid item xs={12} sm={6} key={code}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            fontFamily: 'monospace',
                            p: 1,
                            border: '1px dashed',
                            borderColor: 'divider',
                            borderRadius: 1,
                          }}>
                            {code}
                            <IconButton 
                              size="small" 
                              onClick={() => handleCopyCode(code)}
                              title="コードをコピー"
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
                
                <Button variant="outlined" startIcon={<SaveAlt />}>
                  新しいリカバリーコードを生成
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* セッション設定 */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Timeline />
        セッション管理
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            セッション設定
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>セッションタイムアウト</InputLabel>
                <Select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(Number(e.target.value))}
                  label="セッションタイムアウト"
                >
                  <MenuItem value={5}>5分</MenuItem>
                  <MenuItem value={15}>15分</MenuItem>
                  <MenuItem value={30}>30分</MenuItem>
                  <MenuItem value={60}>1時間</MenuItem>
                  <MenuItem value={120}>2時間</MenuItem>
                  <MenuItem value={0}>タイムアウトなし</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">ログイン状態を保持</Typography>
                    <Typography variant="body2" color="text.secondary">
                      30日間ログイン状態を維持します
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">
              アクティブセッション
            </Typography>
            
            <Button 
              variant="outlined" 
              color="error" 
              startIcon={<Delete />}
              size="small"
              onClick={handleLogoutAllSessions}
            >
              すべてのセッションを終了
            </Button>
          </Box>
          
          <List sx={{ width: '100%' }}>
            {sessionHistory.map((session) => (
              <ListItem
                key={session.id}
                sx={{ 
                  mb: 1, 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: session.current ? 'action.selected' : 'transparent'
                }}
                secondaryAction={
                  session.current ? (
                    <Chip color="primary" size="small" label="現在のセッション" />
                  ) : (
                    <Button 
                      variant="outlined" 
                      size="small"
                      color="error"
                      onClick={() => handleEndSession(session.id)}
                    >
                      終了
                    </Button>
                  )
                }
              >
                <ListItemIcon>
                  <Computer />
                </ListItemIcon>
                <ListItemText
                  primary={session.device}
                  secondary={
                    <Box>
                      <Typography variant="body2" component="span">
                        {session.location} • {session.ip}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <AccessTime fontSize="small" sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        {session.time}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
      
      {/* APIキー */}
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <VerifiedUser />
        APIキー
      </Typography>
      
      <Card>
        <CardContent>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1">
              アプリケーションAPIキー
            </Typography>
            
            <Button 
              variant="outlined" 
              onClick={handleCreateApiKey}
              size="small"
            >
              新しいAPIキーを作成
            </Button>
          </Box>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            APIキーには機密情報へのアクセス権があります。安全に管理してください。
          </Alert>
          
          <List sx={{ width: '100%' }}>
            {apiKeys.map((key) => (
              <ListItem
                key={key.id}
                sx={{ 
                  mb: 1, 
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
                secondaryAction={
                  <Button 
                    variant="outlined" 
                    size="small"
                    color="error"
                    onClick={() => handleDeleteApiKey(key.id)}
                  >
                    削除
                  </Button>
                }
              >
                <ListItemIcon>
                  <CreditCard />
                </ListItemIcon>
                <ListItemText
                  primary={key.name}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        作成日: {key.created} • 最終利用: {key.lastUsed}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {key.scopes.map(scope => (
                          <Chip 
                            key={scope} 
                            label={scope} 
                            size="small" 
                            sx={{ mr: 0.5 }} 
                          />
                        ))}
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
      
      {/* 2段階認証セットアップダイアログ */}
      <Dialog
        open={twoFactorSetupOpen}
        onClose={() => setTwoFactorSetupOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          2段階認証の設定
        </DialogTitle>
        
        <DialogContent>
          <Stepper activeStep={twoFactorActiveStep} sx={{ mb: 4 }}>
            <Step>
              <StepLabel>認証方法の選択</StepLabel>
            </Step>
            <Step>
              <StepLabel>認証アプリの設定</StepLabel>
            </Step>
            <Step>
              <StepLabel>認証の完了</StepLabel>
            </Step>
          </Stepper>
          
          {twoFactorActiveStep === 0 && (
            <Box>
              <DialogContentText sx={{ mb: 3 }}>
                使用する2段階認証の方法を選択してください。
              </DialogContentText>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      border: twoFactorMethod === 'app' ? '2px solid' : '1px solid',
                      borderColor: twoFactorMethod === 'app' ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setTwoFactorMethod('app')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <QrCode2 sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="subtitle1">認証アプリ</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Google認証システム、Microsoft Authenticatorなどの認証アプリを使用します。
                        </Typography>
                      </Box>
                      {twoFactorMethod === 'app' && (
                        <Check color="primary" sx={{ ml: 'auto' }} />
                      )}
                    </Box>
                  </Paper>
                </Grid>
                
                <Grid item xs={12}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      border: twoFactorMethod === 'sms' ? '2px solid' : '1px solid',
                      borderColor: twoFactorMethod === 'sms' ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setTwoFactorMethod('sms')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PhoneAndroid sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="subtitle1">SMSメッセージ</Typography>
                        <Typography variant="body2" color="text.secondary">
                          登録した電話番号にSMSでコードを送信します。
                        </Typography>
                      </Box>
                      {twoFactorMethod === 'sms' && (
                        <Check color="primary" sx={{ ml: 'auto' }} />
                      )}
                    </Box>
                  </Paper>
                </Grid>
                
                <Grid item xs={12}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      border: twoFactorMethod === 'email' ? '2px solid' : '1px solid',
                      borderColor: twoFactorMethod === 'email' ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setTwoFactorMethod('email')}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Email sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                      <Box>
                        <Typography variant="subtitle1">メール</Typography>
                        <Typography variant="body2" color="text.secondary">
                          登録したメールアドレスにコードを送信します。
                        </Typography>
                      </Box>
                      {twoFactorMethod === 'email' && (
                        <Check color="primary" sx={{ ml: 'auto' }} />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {twoFactorActiveStep === 1 && (
            <Box>
              <DialogContentText sx={{ mb: 3 }}>
                以下のQRコードをGoogle認証システムなどの認証アプリでスキャンしてください。
              </DialogContentText>
              
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box
                  sx={{
                    width: 200,
                    height: 200,
                    bgcolor: 'grey.200',
                    mx: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  QRコード
                </Box>
                
                <Typography variant="body2" color="text.secondary">
                  または、このコードを手動で入力:
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                  ABCD EFGH IJKL MNOP
                </Typography>
              </Box>
              
              <Alert severity="warning" sx={{ mb: 2 }}>
                このQRコードは1回のみ表示されます。必ず認証アプリに追加してください。
              </Alert>
            </Box>
          )}
          
          {twoFactorActiveStep === 2 && (
            <Box>
              <DialogContentText sx={{ mb: 3 }}>
                認証アプリに表示された6桁のコードを入力して、設定を完了してください。
              </DialogContentText>
              
              <TextField
                fullWidth
                label="認証コード"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                sx={{ mb: 3 }}
                inputProps={{
                  maxLength: 6,
                  sx: { textAlign: 'center', letterSpacing: 2, fontWeight: 'bold' }
                }}
              />
              
              {verificationCode && verificationCode.length === 6 && verificationCode !== '123456' && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <strong>デモ用の正しいコード: 123456</strong><br />
                  実際のアプリでは、認証アプリで生成されたコードを入力します。
                </Alert>
              )}
              
              <Alert severity="info">
                設定を完了した後、リカバリーコードが表示されます。これらのコードは安全な場所に保管してください。
              </Alert>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          {twoFactorActiveStep > 0 && (
            <Button onClick={handlePrevStep}>
              戻る
            </Button>
          )}
          
          <Button onClick={() => setTwoFactorSetupOpen(false)}>
            キャンセル
          </Button>
          
          {twoFactorActiveStep < 2 ? (
            <Button 
              variant="contained" 
              onClick={handleNextStep}
              endIcon={<KeyboardArrowRight />}
            >
              次へ
            </Button>
          ) : (
            <Button 
              variant="contained" 
              onClick={handleCompleteTwoFactorSetup}
              disabled={verificationCode.length !== 6}
            >
              完了
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SecuritySettings;