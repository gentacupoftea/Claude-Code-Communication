/**
 * データテーブルコンポーネント
 * ソート、ページネーション、選択機能を持つ高機能テーブル
 */
import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Tooltip,
} from '@mui/material';
import { MoreVert, Download, Visibility } from '@mui/icons-material';
import { Card } from '../../atoms';

export interface Column<T = any> {
  id: string;
  label: string;
  numeric?: boolean;
  format?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (row: T) => void;
  }>;
  onExport?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  dense?: boolean;
  maxHeight?: number | string;
}

type Order = 'asc' | 'desc';

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  title,
  selectable = false,
  onSelectionChange,
  actions,
  onExport,
  loading = false,
  emptyMessage = 'データがありません',
  maxHeight = 600,
}: DataTableProps<T>) {
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<string>('');
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<{
    element: HTMLElement | null;
    row: T | null;
  }>({ element: null, row: null });

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelecteds = data.map((row) => row.id);
      setSelected(newSelecteds);
      onSelectionChange?.(data);
      return;
    }
    setSelected([]);
    onSelectionChange?.([]);
  };

  const handleClick = (event: React.MouseEvent<unknown>, id: string | number) => {
    const selectedIndex = selected.indexOf(id);
    let newSelected: (string | number)[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
    onSelectionChange?.(data.filter((row) => newSelected.includes(row.id)));
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const isSelected = (id: string | number) => selected.indexOf(id) !== -1;

  const stableSort = <T,>(array: T[], comparator: (a: T, b: T) => number) => {
    const stabilizedThis = array.map((el, index) => [el, index] as [T, number]);
    stabilizedThis.sort((a, b) => {
      const order = comparator(a[0], b[0]);
      if (order !== 0) return order;
      return a[1] - b[1];
    });
    return stabilizedThis.map((el) => el[0]);
  };

  const getComparator = <Key extends keyof T>(
    order: Order,
    orderBy: Key
  ): ((a: T, b: T) => number) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  const descendingComparator = <T,>(a: T, b: T, orderBy: keyof T) => {
    if (b[orderBy] < a[orderBy]) {
      return -1;
    }
    if (b[orderBy] > a[orderBy]) {
      return 1;
    }
    return 0;
  };

  const sortedData = orderBy
    ? stableSort(data, getComparator(order, orderBy as keyof T))
    : data;

  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Card
      title={title}
      actions={
        onExport && (
          <IconButton onClick={onExport}>
            <Download />
          </IconButton>
        )
      }
    >
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={selected.length > 0 && selected.length < data.length}
                    checked={data.length > 0 && selected.length === data.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || (column.numeric ? 'right' : 'left')}
                  style={{ width: column.width }}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {actions && <TableCell align="center">操作</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row) => {
              const isItemSelected = isSelected(row.id);
              return (
                <TableRow
                  hover
                  onClick={selectable ? (event) => handleClick(event, row.id) : undefined}
                  role="checkbox"
                  aria-checked={isItemSelected}
                  tabIndex={-1}
                  key={row.id}
                  selected={isItemSelected}
                  style={{ cursor: selectable ? 'pointer' : 'default' }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => {
                    const value = row[column.id as keyof T];
                    return (
                      <TableCell key={column.id} align={column.align}>
                        {column.format ? column.format(value, row) : value as React.ReactNode}
                      </TableCell>
                    );
                  })}
                  {actions && (
                    <TableCell align="center">
                      {actions.length === 1 ? (
                        <IconButton
                          size="small"
                          onClick={() => actions[0].onClick(row)}
                        >
                          {actions[0].icon || <Visibility />}
                        </IconButton>
                      ) : (
                        <>
                          <IconButton
                            size="small"
                            onClick={(e) =>
                              setActionMenuAnchor({ element: e.currentTarget, row })
                            }
                          >
                            <MoreVert />
                          </IconButton>
                          <Menu
                            anchorEl={actionMenuAnchor.element}
                            open={Boolean(actionMenuAnchor.element) && actionMenuAnchor.row?.id === row.id}
                            onClose={() =>
                              setActionMenuAnchor({ element: null, row: null })
                            }
                          >
                            {actions.map((action, index) => (
                              <MenuItem
                                key={index}
                                onClick={() => {
                                  action.onClick(row);
                                  setActionMenuAnchor({ element: null, row: null });
                                }}
                              >
                                {action.icon && (
                                  <Box sx={{ mr: 1, display: 'flex' }}>
                                    {action.icon}
                                  </Box>
                                )}
                                {action.label}
                              </MenuItem>
                            ))}
                          </Menu>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {paginatedData.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  align="center"
                  sx={{ py: 4 }}
                >
                  {loading ? 'データを読み込み中...' : emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} / ${count}件`
        }
        labelRowsPerPage="表示件数:"
      />
    </Card>
  );
}

export default DataTable;