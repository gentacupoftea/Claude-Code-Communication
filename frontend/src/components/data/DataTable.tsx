import React, { useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  Paper,
  Typography,
  Toolbar,
  IconButton,
  Tooltip,
  TablePagination,
  Chip,
  Skeleton,
  Alert,
  useTheme,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';
import { SortParams } from '../../hooks/data';

export interface Column<T> {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  format?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  isLoading?: boolean;
  error?: Error | null;
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (event: unknown, newPage: number) => void;
    onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  };
  sorting?: {
    sortParams: SortParams | null;
    onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  };
  selection?: {
    selected: string[];
    onSelectAll: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
    onSelectOne: (id: string) => void;
  };
  actions?: {
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onRefresh?: () => void;
    additionalActions?: Array<{
      icon: React.ReactNode;
      tooltip: string;
      onClick: (id: string) => void;
      disabled?: (row: T) => boolean;
      hidden?: (row: T) => boolean;
    }>;
  };
  emptyStateMessage?: string;
  title?: string;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  maxHeight?: number | string;
  dense?: boolean;
}

/**
 * Reusable data table component with sorting, pagination, and selection
 */
function DataTable<T>({
  columns,
  data,
  keyField,
  isLoading = false,
  error = null,
  pagination,
  sorting,
  selection,
  actions,
  emptyStateMessage = 'No data available',
  title,
  toolbar: customToolbar,
  onRowClick,
  className,
  maxHeight,
  dense = false,
}: DataTableProps<T>) {
  const theme = useTheme();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [rowForMenu, setRowForMenu] = useState<string | null>(null);
  
  // Calculate if any row is selected
  const hasSelected = selection && selection.selected.length > 0;
  
  // Generate a unique row ID based on keyField
  const getRowId = (row: T): string => {
    const key = row[keyField];
    return typeof key === 'string' || typeof key === 'number' ? String(key) : '';
  };
  
  // Open context menu for a row
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setRowForMenu(id);
  };
  
  // Close context menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setRowForMenu(null);
  };
  
  // Create action buttons for a row
  const createActionButtons = (row: T) => {
    if (!actions) return null;
    
    const id = getRowId(row);
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {actions.onEdit && (
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                actions.onEdit?.(id);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        
        {actions.onDelete && (
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                actions.onDelete?.(id);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        
        {actions.additionalActions && actions.additionalActions.length > 0 && (
          <Tooltip title="More actions">
            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, id)}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };
  
  // Handle sort column click
  const handleSortRequest = (property: string) => {
    if (!sorting) return;
    
    const { sortParams, onSortChange } = sorting;
    const isAsc = sortParams?.field === property && sortParams.direction === 'asc';
    onSortChange(property, isAsc ? 'desc' : 'asc');
  };
  
  // Create table toolbar
  const renderToolbar = () => {
    if (customToolbar) {
      return customToolbar;
    }
    
    const selectedCount = selection?.selected.length || 0;
    
    return (
      <Toolbar
        sx={{
          pl: { sm: 2 },
          pr: { xs: 1, sm: 1 },
          ...(hasSelected && {
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.primary.light
                : theme.palette.primary.dark,
            color: (theme) =>
              theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light,
          }),
        }}
      >
        {hasSelected ? (
          <Typography
            sx={{ flex: '1 1 100%' }}
            color="inherit"
            variant="subtitle1"
            component="div"
          >
            {selectedCount} selected
          </Typography>
        ) : (
          <Typography
            sx={{ flex: '1 1 100%' }}
            variant="h6"
            id="tableTitle"
            component="div"
          >
            {title}
          </Typography>
        )}

        {hasSelected && actions?.onDelete ? (
          <Tooltip title="Delete selected">
            <IconButton>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            {actions?.onRefresh && (
              <Tooltip title="Refresh">
                <IconButton onClick={actions.onRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Filter list">
              <IconButton>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Toolbar>
    );
  };
  
  // Render loading skeleton
  const renderSkeleton = () => {
    return Array.from(new Array(pagination?.rowsPerPage || 5)).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {selection && <TableCell padding="checkbox"><Skeleton variant="rectangular" width={24} height={24} /></TableCell>}
        
        {columns.map((column, colIndex) => (
          <TableCell key={`skeleton-cell-${colIndex}`} align={column.align}>
            <Skeleton variant="text" width="80%" />
          </TableCell>
        ))}
        
        {actions && <TableCell align="right"><Skeleton variant="rectangular" width={100} height={24} /></TableCell>}
      </TableRow>
    ));
  };
  
  // Render empty state
  const renderEmptyState = () => (
    <TableRow>
      <TableCell
        colSpan={columns.length + (selection ? 1 : 0) + (actions ? 1 : 0)}
        align="center"
        sx={{ py: 4 }}
      >
        <Typography variant="body1" color="text.secondary">
          {emptyStateMessage}
        </Typography>
      </TableCell>
    </TableRow>
  );
  
  // Render error state
  const renderError = () => (
    <TableRow>
      <TableCell
        colSpan={columns.length + (selection ? 1 : 0) + (actions ? 1 : 0)}
        align="center"
        sx={{ py: 3 }}
      >
        <Alert severity="error" sx={{ justifyContent: 'center' }}>
          {error?.message || 'An error occurred while loading data'}
        </Alert>
      </TableCell>
    </TableRow>
  );
  
  return (
    <Paper
      sx={{
        width: '100%',
        overflow: 'hidden',
        border: `1px solid ${theme.palette.divider}`,
      }}
      elevation={0}
      className={className}
    >
      {/* Table Toolbar */}
      {(title || selection || actions) && renderToolbar()}
      
      {/* Table */}
      <TableContainer sx={{ maxHeight }}>
        <Table
          stickyHeader
          aria-label={title || 'data-table'}
          size={dense ? 'small' : 'medium'}
        >
          <TableHead>
            <TableRow>
              {/* Selection column */}
              {selection && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={hasSelected && selection.selected.length < data.length}
                    checked={data.length > 0 && selection.selected.length === data.length}
                    onChange={selection.onSelectAll}
                    inputProps={{
                      'aria-label': 'select all',
                    }}
                  />
                </TableCell>
              )}
              
              {/* Data columns */}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={
                    sorting && sorting.sortParams?.field === column.id
                      ? sorting.sortParams.direction
                      : false
                  }
                >
                  {column.sortable && sorting ? (
                    <TableSortLabel
                      active={sorting.sortParams?.field === column.id}
                      direction={
                        sorting.sortParams?.field === column.id
                          ? sorting.sortParams.direction
                          : 'asc'
                      }
                      onClick={() => handleSortRequest(column.id)}
                    >
                      {column.label}
                      {sorting.sortParams?.field === column.id ? (
                        <Box component="span" sx={visuallyHidden}>
                          {sorting.sortParams.direction === 'desc'
                            ? 'sorted descending'
                            : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              
              {/* Actions column */}
              {actions && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          
          <TableBody>
            {/* Loading, error, or empty states */}
            {isLoading && renderSkeleton()}
            {!isLoading && error && renderError()}
            {!isLoading && !error && data.length === 0 && renderEmptyState()}
            
            {/* Data rows */}
            {!isLoading && !error && data.length > 0 && data.map((row) => {
              const id = getRowId(row);
              const isSelected = selection ? selection.selected.includes(id) : false;
              
              return (
                <TableRow
                  hover
                  role="checkbox"
                  tabIndex={-1}
                  key={id}
                  selected={isSelected}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {/* Selection checkbox */}
                  {selection && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => selection.onSelectOne(id)}
                      />
                    </TableCell>
                  )}
                  
                  {/* Data cells */}
                  {columns.map((column) => {
                    const value = (row as any)[column.id];
                    return (
                      <TableCell key={`${id}-${column.id}`} align={column.align}>
                        {column.format ? column.format(value, row) : value}
                      </TableCell>
                    );
                  })}
                  
                  {/* Actions cell */}
                  {actions && (
                    <TableCell align="right">
                      {createActionButtons(row)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination */}
      {pagination && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          component="div"
          count={pagination.count}
          rowsPerPage={pagination.rowsPerPage}
          page={pagination.page}
          onPageChange={pagination.onPageChange}
          onRowsPerPageChange={pagination.onRowsPerPageChange}
        />
      )}
      
      {/* Actions Menu */}
      {actions?.additionalActions && (
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
        >
          {actions.additionalActions.map((action, index) => {
            const currentRow = data.find((row) => getRowId(row) === rowForMenu);
            if (!currentRow) return null;
            
            // Check if action should be hidden
            if (action.hidden && action.hidden(currentRow)) {
              return null;
            }
            
            return (
              <MenuItem
                key={`action-${index}`}
                onClick={() => {
                  handleMenuClose();
                  if (rowForMenu) {
                    action.onClick(rowForMenu);
                  }
                }}
                disabled={action.disabled ? action.disabled(currentRow) : false}
              >
                <Box component="span" sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                  {action.icon}
                </Box>
                {action.tooltip}
              </MenuItem>
            );
          })}
        </Menu>
      )}
    </Paper>
  );
}

export default DataTable;