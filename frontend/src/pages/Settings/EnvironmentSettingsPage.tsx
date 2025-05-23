/**
 * Environment Settings Page - Main page for managing environment variables
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Tabs, 
  Tab, 
  Alert, 
  Snackbar,
  Fab,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, Upload as UploadIcon, Download as DownloadIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import { 
  EnvironmentVariable, 
  EnvironmentVariableCategoryInfo,
  ENVIRONMENT_CATEGORIES,
  EnvironmentCategory 
} from '../../types/environment';
import { environmentApi } from '../../api/environment';
import EnvironmentVariableTable from '../../components/environment/EnvironmentVariableTable';
import EnvironmentVariableEditor from '../../components/environment/EnvironmentVariableEditor';
import EnvironmentVariableHistory from '../../components/environment/EnvironmentVariableHistory';
import EnvironmentVariableImportExport from '../../components/environment/EnvironmentVariableImportExport';

const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(3),
}));

const FabContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`environment-tabpanel-${index}`}
      aria-labelledby={`environment-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

const EnvironmentSettingsPage: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState<number>(0);
  const [categories, setCategories] = useState<EnvironmentVariableCategoryInfo[]>([]);
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [filteredVariables, setFilteredVariables] = useState<EnvironmentVariable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [importExportOpen, setImportExportOpen] = useState<boolean>(false);
  const [importExportMode, setImportExportMode] = useState<'import' | 'export'>('import');
  const [editingVariable, setEditingVariable] = useState<EnvironmentVariable | undefined>();
  const [historyVariable, setHistoryVariable] = useState<{ category: string; key: string } | undefined>();

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Get available categories (with variables)
  const availableCategories = categories.filter(cat => cat.count > 0);
  const categoryKeys = availableCategories.map(cat => cat.category as EnvironmentCategory);

  // Load categories and initial data
  const loadCategories = useCallback(async () => {
    try {
      const categoriesData = await environmentApi.getCategories();
      setCategories(categoriesData);
    } catch (err) {
      setError('カテゴリの読み込みに失敗しました');
      console.error('Failed to load categories:', err);
    }
  }, []);

  // Load variables for current category
  const loadVariables = useCallback(async (category?: string) => {
    setLoading(true);
    try {
      let variablesData: EnvironmentVariable[];
      
      if (category) {
        variablesData = await environmentApi.getVariablesByCategory(category);
      } else {
        variablesData = await environmentApi.getVariables();
      }
      
      setVariables(variablesData);
      setError(null);
    } catch (err) {
      setError('環境変数の読み込みに失敗しました');
      console.error('Failed to load variables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter variables based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredVariables(variables);
    } else {
      const filtered = variables.filter(variable =>
        variable.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        variable.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        variable.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredVariables(filtered);
    }
  }, [variables, searchTerm]);

  // Initial load
  useEffect(() => {
    loadCategories();
    loadVariables();
  }, [loadCategories, loadVariables]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const category = newValue === 0 ? undefined : categoryKeys[newValue - 1];
    loadVariables(category);
  };

  // Handle variable creation
  const handleCreateVariable = () => {
    setEditingVariable(undefined);
    setEditorOpen(true);
  };

  // Handle variable editing
  const handleEditVariable = (variable: EnvironmentVariable) => {
    setEditingVariable(variable);
    setEditorOpen(true);
  };

  // Handle variable deletion
  const handleDeleteVariable = async (variable: EnvironmentVariable) => {
    if (!window.confirm(`環境変数 ${variable.category}/${variable.key} を削除しますか？`)) {
      return;
    }

    try {
      await environmentApi.deleteVariable(variable.category, variable.key);
      setSuccess('環境変数を削除しました');
      
      // Reload data
      await loadCategories();
      const category = activeTab === 0 ? undefined : categoryKeys[activeTab - 1];
      await loadVariables(category);
    } catch (err) {
      setError('環境変数の削除に失敗しました');
      console.error('Failed to delete variable:', err);
    }
  };

  // Handle variable history
  const handleShowHistory = (variable: EnvironmentVariable) => {
    setHistoryVariable({ category: variable.category, key: variable.key });
    setHistoryOpen(true);
  };

  // Handle save from editor
  const handleSaveVariable = async () => {
    setEditorOpen(false);
    setSuccess(editingVariable ? '環境変数を更新しました' : '環境変数を作成しました');
    
    // Reload data
    await loadCategories();
    const category = activeTab === 0 ? undefined : categoryKeys[activeTab - 1];
    await loadVariables(category);
  };

  // Handle import
  const handleImport = () => {
    setImportExportMode('import');
    setImportExportOpen(true);
  };

  // Handle export
  const handleExport = () => {
    setImportExportMode('export');
    setImportExportOpen(true);
  };

  // Handle successful import/export
  const handleImportExportSuccess = async () => {
    setImportExportOpen(false);
    setSuccess(importExportMode === 'import' ? 'インポートが完了しました' : 'エクスポートが完了しました');
    
    // Reload data after import
    if (importExportMode === 'import') {
      await loadCategories();
      const category = activeTab === 0 ? undefined : categoryKeys[activeTab - 1];
      await loadVariables(category);
    }
  };

  return (
    <StyledContainer maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        環境変数設定
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        アプリケーションの動作を制御する環境変数を管理します。
        設定はカテゴリごとに整理され、リアルタイムでアプリケーションに反映されます。
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <StyledTabs
        value={activeTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="環境変数カテゴリ"
      >
        <Tab label="すべて" />
        {availableCategories.map((category) => {
          const categoryInfo = ENVIRONMENT_CATEGORIES[category.category as EnvironmentCategory];
          return (
            <Tab
              key={category.category}
              label={`${categoryInfo?.label || category.category} (${category.count})`}
            />
          );
        })}
      </StyledTabs>

      <TabPanel value={activeTab} index={0}>
        <EnvironmentVariableTable
          variables={filteredVariables}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onEdit={handleEditVariable}
          onDelete={handleDeleteVariable}
          onShowHistory={handleShowHistory}
        />
      </TabPanel>

      {availableCategories.map((category, index) => (
        <TabPanel key={category.category} value={activeTab} index={index + 1}>
          <EnvironmentVariableTable
            variables={filteredVariables}
            loading={loading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onEdit={handleEditVariable}
            onDelete={handleDeleteVariable}
            onShowHistory={handleShowHistory}
            category={category.category}
          />
        </TabPanel>
      ))}

      {/* Floating Action Buttons */}
      <FabContainer>
        <Tooltip title="エクスポート" placement="left">
          <Fab size="small" color="default" onClick={handleExport}>
            <DownloadIcon />
          </Fab>
        </Tooltip>
        
        <Tooltip title="インポート" placement="left">
          <Fab size="small" color="secondary" onClick={handleImport}>
            <UploadIcon />
          </Fab>
        </Tooltip>
        
        <Tooltip title="新しい環境変数を追加" placement="left">
          <Fab color="primary" onClick={handleCreateVariable}>
            <AddIcon />
          </Fab>
        </Tooltip>
      </FabContainer>

      {/* Modals */}
      <EnvironmentVariableEditor
        variable={editingVariable}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveVariable}
      />

      <EnvironmentVariableHistory
        category={historyVariable?.category}
        key={historyVariable?.key}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <EnvironmentVariableImportExport
        isOpen={importExportOpen}
        onClose={() => setImportExportOpen(false)}
        categories={categories}
        onImportComplete={handleImportExportSuccess}
      />

      {/* Success Snackbar */}
      <Snackbar 
        open={!!success} 
        autoHideDuration={6000} 
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </StyledContainer>
  );
};

export default EnvironmentSettingsPage;