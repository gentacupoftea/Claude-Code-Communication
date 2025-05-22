import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  Collapse,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Paper,
  Divider,
  Typography,
  Chip,
  Tooltip,
  Switch,
  FormControlLabel,
  FormGroup,
  Badge,
  Autocomplete,
  useTheme,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { FilterParams } from '../../hooks/data';

export interface FilterFieldOption {
  value: string | number | boolean;
  label: string;
}

export interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'boolean' | 'number';
  options?: FilterFieldOption[];
  defaultValue?: any;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  helperText?: string;
  hidden?: boolean;
  placeholder?: string;
  minWidth?: number | string;
}

interface FilterBarProps {
  fields: FilterField[];
  onFilterChange: (filters: FilterParams) => void;
  initialFilters?: FilterParams;
  onAddNew?: () => void;
  addNewLabel?: string;
  searchPlaceholder?: string;
  className?: string;
  showToggle?: boolean;
  expanded?: boolean;
  persistKey?: string;
  showActiveFilters?: boolean;
}

/**
 * Component for filtering data with various field types
 */
const FilterBar: React.FC<FilterBarProps> = ({
  fields,
  onFilterChange,
  initialFilters = {},
  onAddNew,
  addNewLabel = 'Add New',
  searchPlaceholder = 'Search...',
  className,
  showToggle = true,
  expanded: initialExpanded = false,
  persistKey,
  showActiveFilters = true,
}) => {
  const theme = useTheme();
  
  // Attempt to load persisted filters if persistKey is provided
  const loadPersistedFilters = (): FilterParams => {
    if (!persistKey) return initialFilters;
    
    try {
      const saved = localStorage.getItem(`filters_${persistKey}`);
      return saved ? JSON.parse(saved) : initialFilters;
    } catch (error) {
      console.error('Failed to load persisted filters:', error);
      return initialFilters;
    }
  };
  
  // State management
  const [filters, setFilters] = useState<FilterParams>(loadPersistedFilters());
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (!persistKey) return initialExpanded;
    
    try {
      const savedExpanded = localStorage.getItem(`filters_expanded_${persistKey}`);
      return savedExpanded ? JSON.parse(savedExpanded) : initialExpanded;
    } catch (error) {
      return initialExpanded;
    }
  });
  
  // Update parent component when filters change
  useEffect(() => {
    onFilterChange(filters);
    
    // Persist filters if persistKey is provided
    if (persistKey) {
      localStorage.setItem(`filters_${persistKey}`, JSON.stringify(filters));
    }
  }, [filters, onFilterChange, persistKey]);
  
  // Persist expanded state
  useEffect(() => {
    if (persistKey) {
      localStorage.setItem(`filters_expanded_${persistKey}`, JSON.stringify(expanded));
    }
  }, [expanded, persistKey]);
  
  // Handle filter changes
  const handleFilterChange = (id: string, value: any) => {
    setFilters({ ...filters, [id]: value });
  };
  
  // Handle clearing all filters
  const handleClearFilters = () => {
    // Create new filters object with default values
    const defaultFilters: FilterParams = {};
    
    // Set default values if provided in field config
    fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaultFilters[field.id] = field.defaultValue;
      }
    });
    
    setFilters(defaultFilters);
  };
  
  // Handle search field change
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilterChange('search', e.target.value);
  };
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  // Get count of active filters (excluding search)
  const getActiveFilterCount = (): number => {
    return Object.entries(filters)
      .filter(([key, value]) => {
        // Skip search field
        if (key === 'search') return false;
        
        // Skip empty values
        if (value === undefined || value === null || value === '') return false;
        
        // Skip default values
        const field = fields.find((f) => f.id === key);
        if (field && field.defaultValue === value) return false;
        
        // Skip empty arrays
        if (Array.isArray(value) && value.length === 0) return false;
        
        return true;
      })
      .length;
  };
  
  // Render text for active filter chip
  const getFilterChipText = (key: string, value: any): string => {
    const field = fields.find((f) => f.id === key);
    if (!field) return `${key}: ${value}`;
    
    switch (field.type) {
      case 'select':
        const option = field.options?.find((o) => o.value === value);
        return `${field.label}: ${option?.label || value}`;
      
      case 'multiselect':
        if (!Array.isArray(value) || value.length === 0) return '';
        
        const labels = value.map((v: any) => {
          const opt = field.options?.find((o) => o.value === v);
          return opt?.label || v;
        });
        
        return `${field.label}: ${labels.join(', ')}`;
      
      case 'boolean':
        return `${field.label}: ${value ? 'Yes' : 'No'}`;
      
      case 'date':
        if (!value) return '';
        try {
          return `${field.label}: ${new Date(value).toLocaleDateString()}`;
        } catch (e) {
          return `${field.label}: ${value}`;
        }
      
      case 'daterange':
        if (!value || !value.start || !value.end) return '';
        try {
          return `${field.label}: ${new Date(value.start).toLocaleDateString()} - ${new Date(value.end).toLocaleDateString()}`;
        } catch (e) {
          return `${field.label}: ${JSON.stringify(value)}`;
        }
      
      default:
        return `${field.label}: ${value}`;
    }
  };
  
  // Remove a single filter
  const handleRemoveFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
  };
  
  // Render filter fields based on their type
  const renderFilterField = (field: FilterField) => {
    if (field.hidden) return null;
    
    const value = filters[field.id] !== undefined ? filters[field.id] : field.defaultValue;
    
    switch (field.type) {
      case 'text':
        return (
          <TextField
            label={field.label}
            value={value || ''}
            onChange={(e) => handleFilterChange(field.id, e.target.value)}
            variant="outlined"
            fullWidth={field.fullWidth}
            size={field.size || 'small'}
            helperText={field.helperText}
            placeholder={field.placeholder}
            sx={{ minWidth: field.minWidth }}
          />
        );
      
      case 'select':
        return (
          <FormControl 
            fullWidth={field.fullWidth} 
            size={field.size || 'small'}
            sx={{ minWidth: field.minWidth }}
          >
            <InputLabel id={`filter-select-${field.id}`}>{field.label}</InputLabel>
            <Select
              labelId={`filter-select-${field.id}`}
              value={value || ''}
              onChange={(e) => handleFilterChange(field.id, e.target.value)}
              label={field.label}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {field.options?.map((option) => (
                <MenuItem key={option.value.toString()} value={option.value.toString()}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      
      case 'multiselect':
        return (
          <Autocomplete
            multiple
            options={field.options || []}
            getOptionLabel={(option) => 
              typeof option === 'string' 
                ? option 
                : (option as FilterFieldOption).label
            }
            value={value || []}
            onChange={(_, newValue) => {
              handleFilterChange(
                field.id, 
                newValue.map((v) => typeof v === 'string' ? v : v.value)
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={field.label}
                size={field.size || 'small'}
                helperText={field.helperText}
                placeholder={field.placeholder}
              />
            )}
            size={field.size || 'small'}
            sx={{ minWidth: field.minWidth }}
          />
        );
      
      case 'boolean':
        return (
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={!!value}
                  onChange={(e) => handleFilterChange(field.id, e.target.checked)}
                  size={field.size || 'small'}
                />
              }
              label={field.label}
            />
          </FormGroup>
        );
      
      case 'number':
        return (
          <TextField
            label={field.label}
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || !isNaN(Number(val))) {
                handleFilterChange(field.id, val === '' ? '' : Number(val));
              }
            }}
            variant="outlined"
            fullWidth={field.fullWidth}
            size={field.size || 'small'}
            helperText={field.helperText}
            placeholder={field.placeholder}
            type="number"
            sx={{ minWidth: field.minWidth }}
          />
        );
      
      case 'date':
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label={field.label}
              value={value ? new Date(value) : null}
              onChange={(date) => handleFilterChange(field.id, date)}
              slotProps={{
                textField: {
                  helperText: field.helperText,
                  size: field.size || 'small',
                  fullWidth: field.fullWidth,
                  sx: { minWidth: field.minWidth },
                }
              }}
            />
          </LocalizationProvider>
        );
      
      case 'daterange':
        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={`${field.label} (From)`}
                value={value?.start ? new Date(value.start) : null}
                onChange={(date) => 
                  handleFilterChange(field.id, { 
                    ...value, 
                    start: date 
                  })
                }
                slotProps={{
                  textField: {
                    size: field.size || 'small',
                  }
                }}
              />
              <DatePicker
                label={`${field.label} (To)`}
                value={value?.end ? new Date(value.end) : null}
                onChange={(date) => 
                  handleFilterChange(field.id, { 
                    ...value, 
                    end: date 
                  })
                }
                slotProps={{
                  textField: {
                    size: field.size || 'small',
                  }
                }}
              />
            </LocalizationProvider>
          </Box>
        );
      
      default:
        return null;
    }
  };
  
  // Get active filters excluding search
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => 
      key !== 'search' && 
      value !== undefined && 
      value !== null && 
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
  );
  
  return (
    <Paper 
      className={className} 
      elevation={0} 
      variant="outlined"
      sx={{ mb: 2 }}
    >
      {/* Main search bar */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          placeholder={searchPlaceholder}
          variant="outlined"
          size="small"
          fullWidth
          value={filters.search || ''}
          onChange={handleSearch}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
            endAdornment: filters.search ? (
              <IconButton
                size="small"
                onClick={() => handleFilterChange('search', '')}
                edge="end"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            ) : null,
          }}
        />
        
        {onAddNew && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAddNew}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {addNewLabel}
          </Button>
        )}
        
        {showToggle && (
          <Tooltip title={expanded ? 'Hide filters' : 'Show filters'}>
            <IconButton
              onClick={toggleExpanded}
              color={getActiveFilterCount() > 0 ? 'primary' : 'default'}
              size="small"
            >
              <Badge color="primary" badgeContent={getActiveFilterCount()}>
                <FilterIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
      </Box>
      
      {/* Active filters */}
      {showActiveFilters && activeFilters.length > 0 && (
        <Box sx={{ px: 2, pb: expanded ? 0 : 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {activeFilters.map(([key, value]) => (
            <Chip
              key={key}
              label={getFilterChipText(key, value)}
              onDelete={() => handleRemoveFilter(key)}
              size="small"
              variant="outlined"
            />
          ))}
          
          <Chip
            label="Clear all"
            onClick={handleClearFilters}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      )}
      
      {/* Advanced filters */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Filters
            </Typography>
            
            <Button
              size="small"
              onClick={handleClearFilters}
              startIcon={<ClearIcon />}
              variant="text"
            >
              Clear all
            </Button>
          </Box>
          
          <Grid container spacing={2}>
            {fields.map((field) => (
              <Grid 
                item 
                key={field.id}
                xs={12}
                sm={field.fullWidth ? 12 : 6}
                md={field.fullWidth ? 12 : 4}
                lg={field.fullWidth ? 12 : 3}
              >
                {renderFilterField(field)}
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default FilterBar;