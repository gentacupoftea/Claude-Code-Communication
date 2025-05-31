import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Box,
  Button,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Public as PublicIcon,
  Lock as LockIcon,
  Group as GroupIcon,
} from '@mui/icons-material';

interface DashboardSaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: DashboardSaveData) => Promise<void>;
  initialData?: Partial<DashboardSaveData>;
  isLoading?: boolean;
}

export interface DashboardSaveData {
  name: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'private' | 'limited';
  password?: string;
  templateCategory?: string;
}

const PREDEFINED_TAGS = [
  '売上分析',
  '在庫管理', 
  '顧客分析',
  'KPI',
  'レポート',
  'リアルタイム',
  'EC',
  '小売',
  '製造',
  'CRM',
  'マーケティング',
  'ファイナンス',
];

const TEMPLATE_CATEGORIES = [
  'EC',
  '小売',
  '製造',
  'CRM',
  'マーケティング',
  'ファイナンス',
  'カスタム',
];

export const DashboardSaveDialog: React.FC<DashboardSaveDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<DashboardSaveData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    tags: initialData?.tags || [],
    visibility: initialData?.visibility || 'private',
    password: initialData?.password || '',
    templateCategory: initialData?.templateCategory || '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newTag, setNewTag] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'ダッシュボード名は必須です';
    } else if (formData.name.length > 255) {
      newErrors.name = 'ダッシュボード名は255文字以内で入力してください';
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = '説明は1000文字以内で入力してください';
    }

    if (formData.visibility === 'limited' && !formData.password) {
      newErrors.password = '限定公開の場合はパスワードが必要です';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('ダッシュボードの保存に失敗しました:', error);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagSelect = (event: any, value: string | null) => {
    if (value && !formData.tags.includes(value)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, value]
      }));
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <PublicIcon fontSize="small" />;
      case 'limited':
        return <GroupIcon fontSize="small" />;
      default:
        return <LockIcon fontSize="small" />;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            ダッシュボードを保存
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box display="flex" flexDirection="column" gap={3}>
          {/* ダッシュボード名 */}
          <TextField
            label="ダッシュボード名"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            error={!!errors.name}
            helperText={errors.name}
            fullWidth
            required
            placeholder="例: 月次売上分析ダッシュボード"
          />

          {/* 説明 */}
          <TextField
            label="説明"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            error={!!errors.description}
            helperText={errors.description}
            fullWidth
            multiline
            rows={3}
            placeholder="ダッシュボードの目的や内容を簡潔に説明してください"
          />

          {/* タグ */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              タグ
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {formData.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => handleRemoveTag(tag)}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
            <Autocomplete
              options={PREDEFINED_TAGS.filter(tag => !formData.tags.includes(tag))}
              value={null}
              onChange={handleTagSelect}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="タグを選択または追加"
                  size="small"
                />
              )}
              freeSolo
              disableClearable
            />
          </Box>

          {/* 公開設定 */}
          <FormControl component="fieldset">
            <FormLabel component="legend">公開設定</FormLabel>
            <RadioGroup
              value={formData.visibility}
              onChange={(e) => setFormData(prev => ({ ...prev, visibility: e.target.value as any }))}
            >
              <FormControlLabel
                value="private"
                control={<Radio />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <LockIcon fontSize="small" />
                    非公開（自分のみ）
                  </Box>
                }
              />
              <FormControlLabel
                value="limited"
                control={<Radio />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <GroupIcon fontSize="small" />
                    限定公開（リンクを知っている人のみ）
                  </Box>
                }
              />
              <FormControlLabel
                value="public"
                control={<Radio />}
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <PublicIcon fontSize="small" />
                    公開（誰でも閲覧可能）
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {/* パスワード設定（限定公開時のみ） */}
          {formData.visibility === 'limited' && (
            <TextField
              label="パスワード"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              error={!!errors.password}
              helperText={errors.password || '共有リンクにアクセス時に必要なパスワード'}
              fullWidth
              required
            />
          )}

          {/* テンプレートカテゴリ */}
          <Autocomplete
            options={TEMPLATE_CATEGORIES}
            value={formData.templateCategory || null}
            onChange={(event, value) => setFormData(prev => ({ ...prev, templateCategory: value || '' }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="カテゴリ（オプション）"
                placeholder="ダッシュボードのカテゴリを選択"
              />
            )}
          />

          {/* 公開設定の説明 */}
          {formData.visibility === 'public' && (
            <Alert severity="info">
              公開ダッシュボードは、Coneaの公開ギャラリーに表示され、すべてのユーザーが閲覧できます。
            </Alert>
          )}
          
          {formData.visibility === 'limited' && (
            <Alert severity="warning">
              限定公開ダッシュボードは、共有リンクとパスワードを知っている人のみ閲覧できます。
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={isLoading}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
          disabled={isLoading}
        >
          {isLoading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};