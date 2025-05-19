/**
 * 検索バーコンポーネント
 * フィルターオプション付きの高度な検索UI
 */
import React, { useState } from 'react';
import { Box, IconButton, Menu, MenuItem, Chip, Popover, Fade, Typography, Checkbox } from '@mui/material';
import { Search, FilterList, Clear } from '@mui/icons-material';
import { Input, Button } from '../../atoms';
import { useDebounce } from '../../hooks';
import { ECPlatform } from '../../types';

export interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  filters?: {
    platforms?: ECPlatform[];
    status?: string[];
    dateRange?: { start: Date; end: Date };
  };
  onFilterChange?: (filters: any) => void;
  showFilters?: boolean;
}

const platformLabels: Record<ECPlatform, string> = {
  shopify: 'Shopify',
  rakuten: '楽天',
  amazon: 'Amazon',
  yahoo: 'Yahoo!',
  base: 'BASE',
  mercari: 'メルカリ',
};

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = '検索...',
  value: propValue = '',
  onChange,
  onSearch,
  filters = {},
  onFilterChange,
  showFilters = true,
}) => {
  const [localValue, setLocalValue] = useState(propValue);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const debouncedValue = useDebounce(localValue, 300);

  // 検索値が変更されたときの処理
  React.useEffect(() => {
    if (onChange && debouncedValue !== propValue) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, propValue]);

  const handleClear = () => {
    setLocalValue('');
    onChange?.('');
    onSearch?.('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(localValue);
    }
  };

  const activeFiltersCount = [
    filters.platforms?.length || 0,
    filters.status?.length || 0,
    filters.dateRange ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          startIcon={<Search />}
          endIcon={
            localValue && (
              <IconButton size="small" onClick={handleClear}>
                <Clear fontSize="small" />
              </IconButton>
            )
          }
          sx={{ width: '100%' }}
        />
      </Box>
      
      {showFilters && (
        <>
          <Button
            variant="text"
            startIcon={<FilterList />}
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            sx={{ minWidth: 100 }}
          >
            フィルター
            {activeFiltersCount > 0 && (
              <Chip
                size="small"
                label={activeFiltersCount}
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Button>
          
          <Menu
            anchorEl={filterAnchor}
            open={Boolean(filterAnchor)}
            onClose={() => setFilterAnchor(null)}
            TransitionComponent={Fade}
            PaperProps={{
              sx: { minWidth: 250, mt: 1 },
            }}
          >
            <MenuItem disabled>
              <Typography variant="subtitle2">プラットフォーム</Typography>
            </MenuItem>
            {Object.entries(platformLabels).map(([key, label]) => (
              <MenuItem
                key={key}
                onClick={() => {
                  const platforms = filters.platforms || [];
                  const newPlatforms = platforms.includes(key as ECPlatform)
                    ? platforms.filter(p => p !== key)
                    : [...platforms, key as ECPlatform];
                  onFilterChange?.({ ...filters, platforms: newPlatforms });
                }}
              >
                <Checkbox
                  checked={filters.platforms?.includes(key as ECPlatform) || false}
                  size="small"
                />
                {label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
};

export default SearchBar;