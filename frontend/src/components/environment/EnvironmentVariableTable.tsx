/**
 * Environment Variable Table Component
 */
import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import { 
  EnvironmentVariable, 
  VALUE_TYPE_OPTIONS,
  ENVIRONMENT_CATEGORIES,
  EnvironmentCategory 
} from '../../types/environment';
import { environmentUtils } from '../../api/environment';

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  marginTop: theme.spacing(2),
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'center',
}));

const ValueCell = styled(TableCell)(({ theme }) => ({
  maxWidth: 200,
  wordBreak: 'break-word',
  fontFamily: 'monospace',
  fontSize: '0.875rem',
}));

const TypeChip = styled(Chip)(({ theme }) => ({
  fontSize: '0.75rem',
  height: 24,
}));

interface EnvironmentVariableTableProps {
  variables: EnvironmentVariable[];
  loading?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onEdit: (variable: EnvironmentVariable) => void;
  onDelete: (variable: EnvironmentVariable) => void;
  onShowHistory: (variable: EnvironmentVariable) => void;
  category?: string;
}

const EnvironmentVariableTable: React.FC<EnvironmentVariableTableProps> = ({
  variables,
  loading = false,
  searchTerm = '',
  onSearchChange,
  onEdit,
  onDelete,
  onShowHistory,
  category
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedVariable, setSelectedVariable] = useState<EnvironmentVariable | null>(null);
  const [hiddenValues, setHiddenValues] = useState<Set<string>>(new Set());

  // Filter and paginate variables
  const filteredVariables = useMemo(() => {
    return environmentUtils.filterVariables(variables, {
      search: searchTerm,
      category: category
    });
  }, [variables, searchTerm, category]);

  const paginatedVariables = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredVariables.slice(start, start + rowsPerPage);
  }, [filteredVariables, page, rowsPerPage]);

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, variable: EnvironmentVariable) => {
    setAnchorEl(event.currentTarget);
    setSelectedVariable(variable);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedVariable(null);
  };

  const handleEdit = () => {
    if (selectedVariable) {
      onEdit(selectedVariable);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedVariable) {
      onDelete(selectedVariable);
    }
    handleMenuClose();
  };

  const handleShowHistory = () => {
    if (selectedVariable) {
      onShowHistory(selectedVariable);
    }
    handleMenuClose();
  };

  // Handle value visibility toggle
  const toggleValueVisibility = (variableId: string) => {
    const newHiddenValues = new Set(hiddenValues);
    if (newHiddenValues.has(variableId)) {
      newHiddenValues.delete(variableId);
    } else {
      newHiddenValues.add(variableId);
    }
    setHiddenValues(newHiddenValues);
  };

  // Handle copy to clipboard
  const handleCopyValue = async (value: any) => {
    try {
      await navigator.clipboard.writeText(String(value));
      // Could show a success toast here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get value type label
  const getValueTypeLabel = (type: string) => {
    const option = VALUE_TYPE_OPTIONS.find(opt => opt.value === type);
    return option?.label || type;
  };

  // Get category label
  const getCategoryLabel = (categoryKey: string) => {
    const categoryInfo = ENVIRONMENT_CATEGORIES[categoryKey as EnvironmentCategory];
    return categoryInfo?.label || categoryKey;
  };

  // Format value for display
  const formatValueForDisplay = (variable: EnvironmentVariable) => {
    if (variable.value_type === 'secret') {
      return hiddenValues.has(variable.id) ? String(variable.value) : '••••••••';
    }
    
    if (variable.value_type === 'json' && typeof variable.value === 'object') {
      return JSON.stringify(variable.value, null, 2);
    }
    
    return String(variable.value ?? '');
  };

  if (loading) {
    return (
      <Box>
        <SearchContainer>
          <Skeleton variant="rectangular" width={300} height={56} />
        </SearchContainer>
        <Paper>
        <StyledTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {['カテゴリ', 'キー', '値', 'タイプ', '説明', '操作'].map((header) => (
                  <TableCell key={header}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[...Array(5)].map((_, index) => (
                <TableRow key={index}>
                  {[...Array(6)].map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
        </Paper>
      </Box>
    );
  }

  if (filteredVariables.length === 0) {
    return (
      <Box>
        {onSearchChange && (
          <SearchContainer>
            <TextField
              placeholder="環境変数を検索..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />
          </SearchContainer>
        )}
        <Alert severity="info">
          {searchTerm ? '検索条件に一致する環境変数がありません' : '環境変数がありません'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {onSearchChange && (
        <SearchContainer>
          <TextField
            placeholder="環境変数を検索..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />
          <Typography variant="body2" color="text.secondary">
            {filteredVariables.length} 件の環境変数
          </Typography>
        </SearchContainer>
      )}

      <Paper>
      <StyledTableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {!category && <TableCell>カテゴリ</TableCell>}
              <TableCell>キー</TableCell>
              <TableCell>値</TableCell>
              <TableCell>タイプ</TableCell>
              <TableCell>説明</TableCell>
              <TableCell>最終更新</TableCell>
              <TableCell width={120}>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedVariables.map((variable) => (
              <TableRow key={variable.id} hover>
                {!category && (
                  <TableCell>
                    <Chip
                      label={getCategoryLabel(variable.category)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                )}
                
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {variable.key}
                  </Typography>
                </TableCell>
                
                <ValueCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-word',
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: variable.value_type === 'json' ? 'pre-wrap' : 'nowrap'
                      }}
                    >
                      {formatValueForDisplay(variable)}
                    </Typography>
                    
                    {variable.value_type === 'secret' && (
                      <Tooltip title={hiddenValues.has(variable.id) ? '値を隠す' : '値を表示'}>
                        <IconButton
                          size="small"
                          onClick={() => toggleValueVisibility(variable.id)}
                        >
                          {hiddenValues.has(variable.id) ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="クリップボードにコピー">
                      <IconButton
                        size="small"
                        onClick={() => handleCopyValue(variable.value)}
                      >
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ValueCell>
                
                <TableCell>
                  <TypeChip
                    label={getValueTypeLabel(variable.value_type)}
                    size="small"
                    color={variable.value_type === 'secret' ? 'error' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {variable.description || '-'}
                  </Typography>
                </TableCell>
                
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {variable.updated_at 
                      ? new Date(variable.updated_at).toLocaleString('ja-JP')
                      : '-'
                    }
                  </Typography>
                  {variable.last_modified_by && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      by {variable.last_modified_by}
                    </Typography>
                  )}
                </TableCell>
                
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <Tooltip title="編集">
                      <IconButton
                        size="small"
                        onClick={() => onEdit(variable)}
                        disabled={!variable.is_editable}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="その他の操作">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, variable)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredVariables.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="1ページあたりの行数:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} / ${count}`
          }
        />
      </StyledTableContainer>
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit} disabled={!selectedVariable?.is_editable}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText>編集</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleShowHistory}>
          <ListItemIcon>
            <HistoryIcon />
          </ListItemIcon>
          <ListItemText>変更履歴</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleDelete} disabled={!selectedVariable?.is_editable}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <ListItemText>削除</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default EnvironmentVariableTable;