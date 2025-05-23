import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tab,
  Tabs,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Chip
} from '@mui/material';
import {
  Upload as UploadIcon,
  Download as DownloadIcon,
  FileUpload as FileUploadIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import type { EnvironmentVariableCategoryInfo, EnvironmentVariableImport } from '../../types/environment';
import { environmentApi } from '../../api/environment';

interface EnvironmentVariableImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  categories: EnvironmentVariableCategoryInfo[];
  onImportComplete: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
  </div>
);

const EnvironmentVariableImportExport: React.FC<EnvironmentVariableImportExportProps> = ({
  isOpen,
  onClose,
  categories,
  onImportComplete
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [importContent, setImportContent] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'yaml' | 'env'>('json');
  const [exportFormat, setExportFormat] = useState<'json' | 'yaml' | 'env'>('json');
  const [exportCategories, setExportCategories] = useState<string[]>([]);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    variables: Array<{ key: string; value: any; category: string; selected: boolean }>;
    conflicts: string[];
    warnings: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportContent(content);
      
      // Auto-detect format based on file extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'json') setImportFormat('json');
      else if (extension === 'yaml' || extension === 'yml') setImportFormat('yaml');
      else if (extension === 'env') setImportFormat('env');
    };
    reader.readAsText(file);
  };

  const handlePreviewImport = async () => {
    if (!importContent.trim()) {
      setError('Please provide content to import');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Simple preview generation - just parse the content
      let parsedData: any;
      
      if (importFormat === 'json') {
        parsedData = JSON.parse(importContent);
      } else if (importFormat === 'yaml') {
        // For now, show raw content as YAML parsing would need additional library
        setError('YAML preview not implemented yet');
        return;
      } else if (importFormat === 'env') {
        // Parse .env format
        const variables: any = {};
        importContent.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            variables[key.trim()] = valueParts.join('=').trim();
          }
        });
        parsedData = variables;
      }
      
      // Create preview object
      const preview = {
        variables: Array.isArray(parsedData) ? 
          parsedData.map(item => ({ ...item, selected: true })) : 
          Object.entries(parsedData || {}).map(([key, value]) => ({
            key,
            value,
            category: 'general',
            selected: true
          })),
        conflicts: [],
        warnings: []
      };
      
      setImportPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;

    setIsLoading(true);
    setError(null);

    try {
      const importConfig: EnvironmentVariableImport = {
        data: importPreview.variables,
        format: importFormat,
        merge_strategy: 'update',
        dry_run: false
      };
      await environmentApi.importVariables(importConfig);
      onImportComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import variables');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (exportCategories.length === 0) {
      setError('Please select at least one category to export');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const blob = await environmentApi.exportVariables({
        categories: exportCategories,
        format: exportFormat,
        include_secrets: includeSecrets
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `environment-variables.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export variables');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleImportItemSelection = (index: number) => {
    if (!importPreview) return;
    
    const updatedVariables = [...importPreview.variables];
    updatedVariables[index].selected = !updatedVariables[index].selected;
    setImportPreview({ ...importPreview, variables: updatedVariables });
  };

  const toggleAllImportItems = (selected: boolean) => {
    if (!importPreview) return;
    
    const updatedVariables = importPreview.variables.map(item => ({ ...item, selected }));
    setImportPreview({ ...importPreview, variables: updatedVariables });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case 'valid': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import/Export Environment Variables</DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Import" icon={<UploadIcon />} />
            <Tab label="Export" icon={<DownloadIcon />} />
          </Tabs>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Import Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Format</InputLabel>
                <Select
                  value={importFormat}
                  label="Format"
                  onChange={(e) => setImportFormat(e.target.value as any)}
                >
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="yaml">YAML</MenuItem>
                  <MenuItem value="env">ENV</MenuItem>
                </Select>
              </FormControl>
              
              <input
                type="file"
                accept=".json,.yaml,.yml,.env"
                onChange={handleFileUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<FileUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload File
              </Button>
            </Box>

            <TextField
              multiline
              rows={8}
              fullWidth
              label="Content to Import"
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              placeholder={`Enter ${importFormat.toUpperCase()} content here...`}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                onClick={handlePreviewImport}
                disabled={isLoading || !importContent.trim()}
              >
                {isLoading ? <CircularProgress size={20} /> : 'Preview Import'}
              </Button>
            </Box>

            {importPreview && (
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Import Preview</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" onClick={() => toggleAllImportItems(true)}>
                        Select All
                      </Button>
                      <Button size="small" onClick={() => toggleAllImportItems(false)}>
                        Deselect All
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Found {importPreview.variables.length} variables. 
                      {importPreview.variables.filter(item => item.selected).length} selected for import.
                    </Typography>
                  </Box>

                  <List dense>
                    {importPreview.variables.map((item, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          <Checkbox
                            checked={item.selected}
                            onChange={() => toggleImportItemSelection(index)}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight="bold">
                                {item.key}
                              </Typography>
                              <Chip 
                                label={item.category} 
                                size="small" 
                                variant="outlined" 
                              />
                              <Chip 
                                label={typeof item.value} 
                                size="small" 
                                color="default"
                              />
                              {/* Status icon not available for preview */}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Value: {String(item.value).substring(0, 50)}
                                {String(item.value).length > 50 ? '...' : ''}
                              </Typography>
                              {/* Validation errors not available in preview */}
                            </Box>
                          }
                        />
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(JSON.stringify(item, null, 2))}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}
          </Box>
        </TabPanel>

        {/* Export Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={exportFormat}
                label="Export Format"
                onChange={(e) => setExportFormat(e.target.value as any)}
              >
                <MenuItem value="json">JSON</MenuItem>
                <MenuItem value="yaml">YAML</MenuItem>
                <MenuItem value="env">ENV</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Select Categories to Export:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {categories.map((category) => (
                  <Chip
                    key={category.category}
                    label={`${category.category} (${category.description || 'No description'})`}
                    clickable
                    color={exportCategories.includes(category.category) ? 'primary' : 'default'}
                    onClick={() => {
                      setExportCategories(prev =>
                        prev.includes(category.category)
                          ? prev.filter(id => id !== category.category)
                          : [...prev, category.category]
                      );
                    }}
                  />
                ))}
              </Box>
            </Box>

            <Box>
              <Checkbox
                checked={includeSecrets}
                onChange={(e) => setIncludeSecrets(e.target.checked)}
              />
              <Typography variant="body2" component="span">
                Include secret values (Warning: This will export sensitive data in plain text)
              </Typography>
            </Box>

            {exportCategories.length > 0 && (
              <Alert severity="info">
                This will export {exportCategories.length} categories in {exportFormat.toUpperCase()} format.
                {includeSecrets && (
                  <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                    ⚠️ Secret values will be included in plain text!
                  </Typography>
                )}
              </Alert>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        
        {tabValue === 0 && importPreview && (
          <Button
            variant="contained"
            onClick={handleConfirmImport}
            disabled={isLoading || !importPreview.variables.some(item => item.selected)}
            startIcon={isLoading ? <CircularProgress size={16} /> : <UploadIcon />}
          >
            Import Selected
          </Button>
        )}
        
        {tabValue === 1 && (
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={isLoading || exportCategories.length === 0}
            startIcon={isLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
          >
            Export Variables
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EnvironmentVariableImportExport;