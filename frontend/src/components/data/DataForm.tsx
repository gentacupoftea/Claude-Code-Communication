import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'select' 
  | 'multiselect' 
  | 'checkbox' 
  | 'date' 
  | 'password'
  | 'email'
  | 'tel'
  | 'url'
  | 'color'
  | 'custom';

export type ValidationRule = 
  | 'required' 
  | 'email' 
  | 'minLength' 
  | 'maxLength' 
  | 'min' 
  | 'max' 
  | 'pattern'
  | 'custom';

export interface FieldValidation {
  rule: ValidationRule;
  value?: any;
  message: string;
  validateFn?: (value: any, formData: Record<string, any>) => boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: any;
  options?: Array<{ value: any; label: string }>;
  validation?: FieldValidation[];
  fullWidth?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  hidden?: boolean | ((values: Record<string, any>) => boolean);
  multiple?: boolean;
  gridSize?: { xs?: number; sm?: number; md?: number; lg?: number };
  render?: (props: {
    field: FormField;
    value: any;
    onChange: (value: any) => void;
    error: string | null;
    touched: boolean;
  }) => React.ReactNode;
}

export interface FormSection {
  title?: string;
  description?: string;
  fields: FormField[];
  columns?: number;
}

interface DataFormProps {
  sections: FormSection[];
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  onCancel?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  submitLabel?: string;
  cancelLabel?: string;
  title?: string;
  subtitle?: string;
  hideToolbar?: boolean;
  className?: string;
}

/**
 * Generic data form component for creating and editing data
 */
const DataForm: React.FC<DataFormProps> = ({
  sections,
  initialValues = {},
  onSubmit,
  onCancel,
  onBack,
  isLoading = false,
  isSubmitting = false,
  error = null,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  title = 'Form',
  subtitle,
  hideToolbar = false,
  className,
}) => {
  const theme = useTheme();
  
  // Form state
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  
  // Update values when initialValues change
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);
  
  // Handle form field change
  const handleChange = (name: string, value: any) => {
    setValues({ ...values, [name]: value });
    
    // Mark field as touched
    if (!touched[name]) {
      setTouched({ ...touched, [name]: true });
    }
    
    // Validate field
    validateField(name, value);
  };
  
  // Toggle password visibility
  const togglePasswordVisibility = (field: string) => {
    setPasswordVisibility({
      ...passwordVisibility,
      [field]: !passwordVisibility[field],
    });
  };
  
  // Validate a single field
  const validateField = (name: string, value: any): string | null => {
    const field = sections
      .flatMap((section) => section.fields)
      .find((field) => field.name === name);
    
    if (!field || !field.validation) {
      setErrors({ ...errors, [name]: null });
      return null;
    }
    
    for (const rule of field.validation) {
      let isValid = true;
      
      switch (rule.rule) {
        case 'required':
          isValid = value !== undefined && value !== null && value !== '';
          if (Array.isArray(value)) {
            isValid = value.length > 0;
          }
          break;
        
        case 'email':
          isValid = !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          break;
        
        case 'minLength':
          isValid = !value || value.length >= rule.value;
          break;
        
        case 'maxLength':
          isValid = !value || value.length <= rule.value;
          break;
        
        case 'min':
          isValid = value === '' || value === null || value >= rule.value;
          break;
        
        case 'max':
          isValid = value === '' || value === null || value <= rule.value;
          break;
        
        case 'pattern':
          isValid = !value || new RegExp(rule.value).test(value);
          break;
        
        case 'custom':
          if (rule.validateFn) {
            isValid = rule.validateFn(value, values);
          }
          break;
      }
      
      if (!isValid) {
        setErrors({ ...errors, [name]: rule.message });
        return rule.message;
      }
    }
    
    setErrors({ ...errors, [name]: null });
    return null;
  };
  
  // Validate all fields
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string | null> = {};
    const newTouched: Record<string, boolean> = { ...touched };
    
    // Get all visible fields
    const visibleFields = sections
      .flatMap((section) => section.fields)
      .filter((field) => {
        if (typeof field.hidden === 'function') {
          return !field.hidden(values);
        }
        return !field.hidden;
      });
    
    // Validate each field
    visibleFields.forEach((field) => {
      const error = validateField(field.name, values[field.name]);
      newErrors[field.name] = error;
      newTouched[field.name] = true;
      
      if (error) {
        isValid = false;
      }
    });
    
    setErrors(newErrors);
    setTouched(newTouched);
    
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(values);
    }
  };
  
  // Check if field is hidden
  const isFieldHidden = (field: FormField): boolean => {
    if (typeof field.hidden === 'function') {
      return field.hidden(values);
    }
    return !!field.hidden;
  };
  
  // Render form field based on type
  const renderField = (field: FormField) => {
    if (isFieldHidden(field)) return null;
    
    const value = values[field.name] !== undefined ? values[field.name] : field.defaultValue;
    const fieldError = touched[field.name] ? errors[field.name] : null;
    
    // If field has custom renderer, use it
    if (field.render) {
      return field.render({
        field,
        value,
        onChange: (newValue) => handleChange(field.name, newValue),
        error: fieldError,
        touched: !!touched[field.name],
      });
    }
    
    // Calculate grid size
    const gridSize = field.gridSize || {
      xs: 12,
      sm: field.fullWidth ? 12 : 6,
      md: field.fullWidth ? 12 : 4,
    };
    
    // Render field based on type
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'color':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <TextField
              fullWidth
              label={field.label}
              name={field.name}
              value={value || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              helperText={fieldError || field.helperText}
              error={!!fieldError}
              required={field.required}
              disabled={field.disabled || isLoading || isSubmitting}
              type={field.type}
              InputProps={
                field.type === 'color'
                  ? {
                      startAdornment: value ? (
                        <InputAdornment position="start">
                          <Box
                            sx={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              bgcolor: value,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          />
                        </InputAdornment>
                      ) : undefined,
                    }
                  : undefined
              }
            />
          </Grid>
        );
      
      case 'textarea':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <TextField
              fullWidth
              label={field.label}
              name={field.name}
              value={value || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              helperText={fieldError || field.helperText}
              error={!!fieldError}
              required={field.required}
              disabled={field.disabled || isLoading || isSubmitting}
              multiline
              rows={field.rows || 4}
            />
          </Grid>
        );
      
      case 'number':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <TextField
              fullWidth
              label={field.label}
              name={field.name}
              value={value ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                handleChange(field.name, val === '' ? '' : Number(val));
              }}
              placeholder={field.placeholder}
              helperText={fieldError || field.helperText}
              error={!!fieldError}
              required={field.required}
              disabled={field.disabled || isLoading || isSubmitting}
              type="number"
              InputProps={{
                inputProps: {
                  min: field.min,
                  max: field.max,
                  step: field.step,
                },
              }}
            />
          </Grid>
        );
      
      case 'password':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <TextField
              fullWidth
              label={field.label}
              name={field.name}
              value={value || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              helperText={fieldError || field.helperText}
              error={!!fieldError}
              required={field.required}
              disabled={field.disabled || isLoading || isSubmitting}
              type={passwordVisibility[field.name] ? 'text' : 'password'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility(field.name)}
                      edge="end"
                    >
                      {passwordVisibility[field.name] ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        );
      
      case 'select':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <FormControl
              fullWidth
              error={!!fieldError}
              required={field.required}
              disabled={field.disabled || isLoading || isSubmitting}
            >
              <InputLabel id={`select-label-${field.name}`}>{field.label}</InputLabel>
              <Select
                labelId={`select-label-${field.name}`}
                name={field.name}
                value={value || (field.multiple ? [] : '')}
                onChange={(e) => handleChange(field.name, e.target.value)}
                label={field.label}
                multiple={field.multiple}
                renderValue={(selected) => {
                  if (field.multiple && Array.isArray(selected)) {
                    return (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const option = field.options?.find((opt) => opt.value === value);
                          return (
                            <Chip key={value} label={option?.label || value} size="small" />
                          );
                        })}
                      </Box>
                    );
                  }
                  const option = field.options?.find((opt) => opt.value === selected);
                  return option?.label || selected;
                }}
              >
                {!field.multiple && !field.required && (
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                )}
                {field.options?.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {(fieldError || field.helperText) && (
                <FormHelperText>{fieldError || field.helperText}</FormHelperText>
              )}
            </FormControl>
          </Grid>
        );
      
      case 'checkbox':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <FormControl
              error={!!fieldError}
              required={field.required}
              disabled={field.disabled || isLoading || isSubmitting}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    name={field.name}
                    checked={!!value}
                    onChange={(e) => handleChange(field.name, e.target.checked)}
                  />
                }
                label={field.label}
              />
              {(fieldError || field.helperText) && (
                <FormHelperText>{fieldError || field.helperText}</FormHelperText>
              )}
            </FormControl>
          </Grid>
        );
      
      case 'date':
        return (
          <Grid item xs={gridSize.xs} sm={gridSize.sm} md={gridSize.md} lg={gridSize.lg}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={field.label}
                value={value ? new Date(value) : null}
                onChange={(date) => handleChange(field.name, date)}
                disabled={field.disabled || isLoading || isSubmitting}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    helperText: fieldError || field.helperText,
                    error: !!fieldError,
                    required: field.required,
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <Card className={className}>
      {!hideToolbar && (
        <>
          <CardHeader
            title={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {onBack && (
                  <IconButton
                    onClick={onBack}
                    size="small"
                    sx={{ mr: 1 }}
                    aria-label="back"
                  >
                    <ArrowBackIcon />
                  </IconButton>
                )}
                <Typography variant="h5">{title}</Typography>
              </Box>
            }
            subheader={subtitle}
          />
          <Divider />
        </>
      )}
      
      <CardContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <Box sx={{ mb: 3 }}>
                <Typography color="error">{error}</Typography>
              </Box>
            )}
            
            {sections.map((section, index) => (
              <Box key={index} sx={{ mb: index < sections.length - 1 ? 4 : 0 }}>
                {section.title && (
                  <>
                    <Typography variant="h6" gutterBottom>
                      {section.title}
                    </Typography>
                    {section.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        paragraph
                      >
                        {section.description}
                      </Typography>
                    )}
                    <Divider sx={{ mb: 2 }} />
                  </>
                )}
                
                <Grid container spacing={2}>
                  {section.fields.map((field) => renderField(field))}
                </Grid>
              </Box>
            ))}
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              {onCancel && (
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  startIcon={<CancelIcon />}
                >
                  {cancelLabel}
                </Button>
              )}
              
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            </Box>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default DataForm;