/**
 * Environment Variable Editor Component
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import {
  EnvironmentVariable,
  EnvironmentVariableFormData,
  VALUE_TYPE_OPTIONS,
  ENVIRONMENT_CATEGORIES,
  EnvironmentCategory
} from '../../types/environment';
import { environmentApi, environmentUtils } from '../../api/environment';

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingRight: theme.spacing(1),
}));

const FormGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(2),
  gridTemplateColumns: '1fr 1fr',
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: '1fr',
  },
}));

const FullWidthFormControl = styled(FormControl)(({ theme }) => ({
  gridColumn: '1 / -1',
}));

const OptionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

interface EnvironmentVariableEditorProps {
  variable?: EnvironmentVariable;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const EnvironmentVariableEditor: React.FC<EnvironmentVariableEditorProps> = ({
  variable,
  isOpen,
  onClose,
  onSave
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<EnvironmentVariableFormData>({
    category: '',
    key: '',
    value: '',
    value_type: 'string',
    description: '',
    is_editable: true,
    validation_regex: '',
    options: []
  });

  const [newOption, setNewOption] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isEditing = Boolean(variable);

  // Initialize form data
  useEffect(() => {
    if (variable) {
      setFormData({
        category: variable.category,
        key: variable.key,
        value: variable.value_type === 'secret' ? '' : variable.value,
        value_type: variable.value_type,
        description: variable.description || '',
        is_editable: variable.is_editable,
        validation_regex: variable.validation_regex || '',
        options: variable.options || []
      });
    } else {
      setFormData({
        category: '',
        key: '',
        value: '',
        value_type: 'string',
        description: '',
        is_editable: true,
        validation_regex: '',
        options: []
      });
    }
    setValidationErrors({});
    setError(null);
  }, [variable, isOpen]);

  // Validate form
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.category.trim()) {
      errors.category = 'カテゴリは必須です';
    }

    if (!formData.key.trim()) {
      errors.key = 'キーは必須です';
    } else if (!/^[A-Z0-9_]+$/.test(formData.key)) {
      errors.key = 'キーは大文字、数字、アンダースコアのみ使用できます';
    }

    // Value validation
    const valueValidation = environmentUtils.validateValue(formData.value, formData);
    if (!valueValidation.isValid) {
      errors.value = valueValidation.error || '無効な値です';
    }

    // Regex validation
    if (formData.validation_regex) {
      try {
        new RegExp(formData.validation_regex);
      } catch {
        errors.validation_regex = '無効な正規表現です';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle input changes
  const handleInputChange = (field: keyof EnvironmentVariableFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle value type change
  const handleValueTypeChange = (newType: string) => {
    let newValue = formData.value;
    
    // Convert value to appropriate type
    if (newType === 'boolean') {
      newValue = formData.value === 'true' || formData.value === true;
    } else if (newType === 'number') {
      const num = Number(formData.value);
      newValue = isNaN(num) ? 0 : num;
    } else if (newType === 'json') {
      if (typeof formData.value === 'object') {
        newValue = JSON.stringify(formData.value, null, 2);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      value_type: newType as any,
      value: newValue
    }));
  };

  // Handle options
  const handleAddOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()]
      }));
      setNewOption('');
    }
  };

  const handleRemoveOption = (option: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt !== option)
    }));
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await environmentApi.updateVariable(
          variable!.category,
          variable!.key,
          {
            value: formData.value,
            notes: `Updated via UI`
          }
        );
      } else {
        await environmentApi.createVariable({
          category: formData.category,
          key: formData.key,
          value: formData.value,
          value_type: formData.value_type,
          description: formData.description,
          is_editable: formData.is_editable,
          validation_regex: formData.validation_regex || undefined,
          options: formData.options.length > 0 ? formData.options : undefined
        });
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Get category options
  const categoryOptions = Object.entries(ENVIRONMENT_CATEGORIES).map(([key, info]) => ({
    value: key,
    label: info.label
  }));

  // Render value input based on type
  const renderValueInput = () => {
    switch (formData.value_type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(formData.value)}
                onChange={(e) => handleInputChange('value', e.target.checked)}
              />
            }
            label={formData.value ? 'True' : 'False'}
          />
        );

      case 'number':
        return (
          <TextField
            type="number"
            value={formData.value}
            onChange={(e) => handleInputChange('value', e.target.value)}
            error={!!validationErrors.value}
            helperText={validationErrors.value}
            fullWidth
          />
        );

      case 'json':
        return (
          <TextField
            multiline
            rows={4}
            value={typeof formData.value === 'object' 
              ? JSON.stringify(formData.value, null, 2) 
              : formData.value
            }
            onChange={(e) => handleInputChange('value', e.target.value)}
            error={!!validationErrors.value}
            helperText={validationErrors.value || 'JSON形式で入力してください'}
            fullWidth
            sx={{ fontFamily: 'monospace' }}
          />
        );

      case 'secret':
        return (
          <TextField
            type="password"
            value={formData.value}
            onChange={(e) => handleInputChange('value', e.target.value)}
            error={!!validationErrors.value}
            helperText={validationErrors.value || (isEditing ? '変更する場合のみ入力してください' : '')}
            fullWidth
            placeholder={isEditing ? '変更しない場合は空のままにしてください' : ''}
          />
        );

      default:
        return (
          <TextField
            value={formData.value}
            onChange={(e) => handleInputChange('value', e.target.value)}
            error={!!validationErrors.value}
            helperText={validationErrors.value}
            fullWidth
          />
        );
    }
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
        <Typography variant="h6">
          {isEditing ? '環境変数を編集' : '新しい環境変数を作成'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <FormGrid>
          <FormControl error={!!validationErrors.category}>
            <InputLabel>カテゴリ</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              label="カテゴリ"
              disabled={isEditing}
            >
              {categoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {validationErrors.category && (
              <Typography variant="caption" color="error">
                {validationErrors.category}
              </Typography>
            )}
          </FormControl>

          <TextField
            label="キー"
            value={formData.key}
            onChange={(e) => handleInputChange('key', e.target.value.toUpperCase())}
            error={!!validationErrors.key}
            helperText={validationErrors.key || '大文字、数字、アンダースコアのみ'}
            disabled={isEditing}
            required
          />

          <FormControl>
            <InputLabel>値のタイプ</InputLabel>
            <Select
              value={formData.value_type}
              onChange={(e) => handleValueTypeChange(e.target.value)}
              label="値のタイプ"
              disabled={isEditing}
            >
              {VALUE_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box>
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FullWidthFormControl>
            <Typography variant="subtitle2" gutterBottom>
              値
              <Tooltip title={`${formData.value_type}型の値を入力してください`}>
                <HelpIcon fontSize="small" sx={{ ml: 1 }} />
              </Tooltip>
            </Typography>
            {renderValueInput()}
          </FullWidthFormControl>

          <FullWidthFormControl>
            <TextField
              label="説明"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={2}
              fullWidth
              helperText="この環境変数の用途や意味を説明してください"
            />
          </FullWidthFormControl>
        </FormGrid>

        {/* Advanced Settings */}
        <Accordion 
          expanded={showAdvanced} 
          onChange={() => setShowAdvanced(!showAdvanced)}
          sx={{ mt: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">高度な設定</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="バリデーション正規表現"
                value={formData.validation_regex}
                onChange={(e) => handleInputChange('validation_regex', e.target.value)}
                error={!!validationErrors.validation_regex}
                helperText={validationErrors.validation_regex || '値の検証に使用する正規表現パターン'}
                fullWidth
                sx={{ fontFamily: 'monospace' }}
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  選択肢（列挙型の場合）
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="選択肢を入力"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddOption();
                      }
                    }}
                  />
                  <Button
                    size="small"
                    onClick={handleAddOption}
                    disabled={!newOption.trim()}
                    startIcon={<AddIcon />}
                  >
                    追加
                  </Button>
                </Box>
                <OptionsContainer>
                  {formData.options.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      onDelete={() => handleRemoveOption(option)}
                      deleteIcon={<DeleteIcon />}
                      size="small"
                    />
                  ))}
                </OptionsContainer>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_editable}
                    onChange={(e) => handleInputChange('is_editable', e.target.checked)}
                  />
                }
                label="編集可能"
                disabled={isEditing}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnvironmentVariableEditor;