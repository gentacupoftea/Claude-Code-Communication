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
import { EnvironmentVariableCategory, EnvironmentVariableValueType, EnvironmentVariableImportPreview } from '../../types/environment';
import { environmentApi } from '../../api/environment';

interface EnvironmentVariableImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  categories: EnvironmentVariableCategory[];
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
  const [importPreview, setImportPreview] = useState<EnvironmentVariableImportPreview | null>(null);
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
      const preview = await environmentApi.previewImport(importContent, importFormat);
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
      const selectedItems = importPreview.items.filter(item => item.selected);
      await environmentApi.importVariables(selectedItems);
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
    
    const updatedItems = [...importPreview.items];
    updatedItems[index].selected = !updatedItems[index].selected;
    setImportPreview({ ...importPreview, items: updatedItems });
  };

  const toggleAllImportItems = (selected: boolean) => {
    if (!importPreview) return;
    
    const updatedItems = importPreview.items.map(item => ({ ...item, selected }));
    setImportPreview({ ...importPreview, items: updatedItems });
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
                      Found {importPreview.items.length} variables. 
                      {importPreview.items.filter(item => item.selected).length} selected for import.
                    </Typography>
                  </Box>

                  <List dense>
                    {importPreview.items.map((item, index) => (
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
                                label={item.value_type} 
                                size="small" 
                                color={getStatusColor(item.status)}
                              />
                              {getStatusIcon(item.status)}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                Value: {item.value_type === 'secret' ? '***' : String(item.value).substring(0, 50)}
                                {String(item.value).length > 50 ? '...' : ''}
                              </Typography>
                              {item.validation_errors && item.validation_errors.length > 0 && (
                                <Box sx={{ mt: 0.5 }}>
                                  {item.validation_errors.map((error, errorIndex) => (
                                    <Typography key={errorIndex} variant="caption" color="error">
                                      • {error}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
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
                    key={category.id}
                    label={`${category.name} (${category.description})`}
                    clickable
                    color={exportCategories.includes(category.id) ? 'primary' : 'default'}
                    onClick={() => {
                      setExportCategories(prev =>
                        prev.includes(category.id)
                          ? prev.filter(id => id !== category.id)
                          : [...prev, category.id]
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
            disabled={isLoading || !importPreview.items.some(item => item.selected)}
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