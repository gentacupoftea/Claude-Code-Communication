import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

export interface DetailField<T> {
  label: string;
  value: keyof T | ((item: T) => React.ReactNode);
  variant?: 'text' | 'chip' | 'html' | 'date' | 'boolean' | 'number';
  format?: (value: any) => string;
  chipColor?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'default';
  hidden?: boolean | ((item: T) => boolean);
  gridSize?: { xs?: number; sm?: number; md?: number; lg?: number };
}

export interface DetailSection<T> {
  title?: string;
  fields: DetailField<T>[];
  gridColumns?: number;
}

interface DetailViewProps<T> {
  item: T | null;
  sections: DetailSection<T>[];
  title?: string | ((item: T) => string);
  subtitle?: string | ((item: T) => string);
  isLoading?: boolean;
  error?: Error | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  actions?: React.ReactNode;
  avatar?: React.ReactNode;
  className?: string;
}

/**
 * Component for displaying detailed information about an item
 */
function DetailView<T>({
  item,
  sections,
  title,
  subtitle,
  isLoading = false,
  error = null,
  onEdit,
  onDelete,
  onBack,
  actions,
  avatar,
  className,
}: DetailViewProps<T>) {
  const theme = useTheme();
  
  // Format a value based on its field type
  const formatValue = (field: DetailField<T>, item: T): React.ReactNode => {
    // Get the raw value
    let value: any;
    if (typeof field.value === 'function') {
      value = (field.value as Function)(item);
    } else {
      value = item[field.value as keyof T];
    }
    
    // Return null if value is undefined or null
    if (value === undefined || value === null) {
      return <Typography color="text.secondary" variant="body2">—</Typography>;
    }
    
    // Format based on field variant
    switch (field.variant) {
      case 'chip':
        return (
          <Chip
            label={field.format ? field.format(value) : String(value)}
            color={field.chipColor || 'default'}
            size="small"
          />
        );
      
      case 'html':
        return (
          <div dangerouslySetInnerHTML={{ __html: value }} />
        );
      
      case 'date':
        if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
          const date = new Date(value);
          return field.format 
            ? field.format(date) 
            : date.toLocaleString();
        }
        return String(value);
      
      case 'boolean':
        return value 
          ? <Chip label="Yes" color="success" size="small" /> 
          : <Chip label="No" color="error" size="small" />;
      
      case 'number':
        return field.format 
          ? field.format(value) 
          : value.toLocaleString();
      
      default:
        return field.format ? field.format(value) : String(value);
    }
  };
  
  // Render loading skeleton
  const renderSkeleton = () => {
    return (
      <Box>
        <Skeleton variant="rectangular" width="60%" height={28} sx={{ mb: 1 }} />
        
        {sections.map((section, sectionIndex) => (
          <Box key={`skeleton-section-${sectionIndex}`} sx={{ mt: 3 }}>
            {section.title && (
              <Skeleton variant="rectangular" width="40%" height={24} sx={{ mb: 2 }} />
            )}
            
            <Grid container spacing={2}>
              {Array.from(
                new Array(section.fields.length > 3 ? section.fields.length : 3)
              ).map((_, fieldIndex) => (
                <Grid 
                  item 
                  key={`skeleton-field-${sectionIndex}-${fieldIndex}`}
                  xs={12}
                  sm={6}
                  md={4}
                >
                  <Skeleton variant="text" width="30%" sx={{ mb: 0.5 }} />
                  <Skeleton variant="rectangular" width="90%" height={20} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Box>
    );
  };
  
  // Render error state
  const renderError = () => (
    <Box p={2} textAlign="center">
      <Typography color="error" variant="body1">
        {error?.message || 'An error occurred while loading data'}
      </Typography>
    </Box>
  );
  
  // Render empty state
  const renderEmpty = () => (
    <Box p={2} textAlign="center">
      <Typography color="text.secondary" variant="body1">
        No data available
      </Typography>
    </Box>
  );
  
  // Render actual content
  const renderContent = () => {
    if (!item) return renderEmpty();
    
    return (
      <Box>
        {sections.map((section, sectionIndex) => {
          // Filter out hidden fields
          const visibleFields = section.fields.filter(
            (field) => !field.hidden
          );
          
          // Skip section if no visible fields
          if (visibleFields.length === 0) return null;
          
          return (
            <Box key={`section-${sectionIndex}`} sx={{ mt: sectionIndex > 0 ? 4 : 0 }}>
              {section.title && (
                <>
                  <Typography 
                    variant="h6" 
                    color="primary" 
                    gutterBottom 
                    sx={{ 
                      fontSize: '1rem',
                      fontWeight: 600,
                    }}
                  >
                    {section.title}
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                </>
              )}
              
              <Grid container spacing={2}>
                {visibleFields.map((field, fieldIndex) => {
                  // Calculate grid size
                  const gridSize = field.gridSize || { 
                    xs: 12, 
                    sm: 6, 
                    md: section.gridColumns ? 12 / section.gridColumns : 4 
                  };
                  
                  return (
                    <Grid 
                      item 
                      key={`field-${sectionIndex}-${fieldIndex}`}
                      xs={gridSize.xs}
                      sm={gridSize.sm}
                      md={gridSize.md}
                      lg={gridSize.lg}
                    >
                      <Box>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          component="div"
                          sx={{ mb: 0.5 }}
                        >
                          {field.label}
                        </Typography>
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            minHeight: 24,
                          }}
                        >
                          {formatValue(field, item)}
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          );
        })}
      </Box>
    );
  };
  
  // Generate title text
  const getTitleText = (): string => {
    if (!title) return 'Details';
    if (typeof title === 'function' && item) {
      return title(item);
    }
    return title as string;
  };
  
  // Generate subtitle text
  const getSubtitleText = (): string | undefined => {
    if (!subtitle) return undefined;
    if (typeof subtitle === 'function' && item) {
      return subtitle(item);
    }
    return subtitle as string;
  };
  
  return (
    <Card className={className} elevation={0} variant="outlined">
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
            <Typography variant="h5" component="h1">
              {isLoading ? <Skeleton width={200} /> : getTitleText()}
            </Typography>
          </Box>
        }
        subheader={
          isLoading ? (
            <Skeleton width={300} />
          ) : getSubtitleText() ? (
            <Typography variant="body2" color="text.secondary">
              {getSubtitleText()}
            </Typography>
          ) : null
        }
        action={
          actions || (
            <Box>
              {onEdit && (
                <IconButton 
                  onClick={onEdit} 
                  color="primary" 
                  aria-label="edit"
                  disabled={isLoading || !item}
                >
                  <EditIcon />
                </IconButton>
              )}
              {onDelete && (
                <IconButton 
                  onClick={onDelete} 
                  color="error" 
                  aria-label="delete"
                  disabled={isLoading || !item}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          )
        }
        avatar={avatar}
      />
      
      <Divider />
      
      <CardContent>
        {isLoading && renderSkeleton()}
        {!isLoading && error && renderError()}
        {!isLoading && !error && renderContent()}
      </CardContent>
    </Card>
  );
}

export default DetailView;