import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
} from '@mui/lab';
import {
  ExpandMore as ExpandMoreIcon,
  CloudQueue as MCPIcon,
  Psychology as LLMIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Memory as MemoryIcon,
  Code as CodeIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

interface MCPConnection {
  id: string;
  service: string;
  action: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp?: string;
}

interface LLMResponse {
  id: string;
  provider: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration: number;
  timestamp?: string;
}

interface ConnectionHistoryProps {
  mcpConnections: MCPConnection[];
  llmResponses: LLMResponse[];
  totalTokens: number;
}

const ConnectionHistory: React.FC<ConnectionHistoryProps> = ({
  mcpConnections,
  llmResponses,
  totalTokens,
}) => {
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case 'openmemory':
        return <MemoryIcon />;
      case 'shopify':
        return <CodeIcon />;
      case 'github':
        return <CodeIcon />;
      default:
        return <MCPIcon />;
    }
  };

  const getServiceColor = (service: string): 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (service.toLowerCase()) {
      case 'openmemory':
        return 'secondary';
      case 'shopify':
        return 'primary';
      case 'github':
        return 'info';
      default:
        return 'primary';
    }
  };

  return (
    <Box sx={{ 
      width: 400, 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: 1,
      borderColor: 'divider',
      backgroundColor: 'background.paper',
    }}>
      {/* ヘッダー */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Typography variant="h6">接続履歴</Typography>
        <Chip 
          label={`${totalTokens} tokens`} 
          size="small" 
          color="primary"
          variant="outlined"
        />
      </Box>
      
      {/* コンテンツ */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* LLM応答履歴 */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LLMIcon color="primary" />
              <Typography>LLM応答 ({llmResponses.length})</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Timeline position="right">
              {llmResponses.map((response, index) => (
                <TimelineItem key={response.id}>
                  <TimelineSeparator>
                    <TimelineDot color="primary">
                      <LLMIcon />
                    </TimelineDot>
                    {index < llmResponses.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper sx={{ p: 1.5, mb: 1 }}>
                      <Typography variant="subtitle2">
                        {response.provider} - {response.model}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Tokens: {response.tokens.total}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        時間: {formatDuration(response.duration)}
                      </Typography>
                      {response.tokens.total > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={(response.tokens.prompt / response.tokens.total) * 100}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                            <Typography variant="caption">
                              Prompt: {response.tokens.prompt}
                            </Typography>
                            <Typography variant="caption">
                              Completion: {response.tokens.completion}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </AccordionDetails>
        </Accordion>

        {/* MCP接続履歴 */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MCPIcon color="secondary" />
              <Typography>MCP接続 ({mcpConnections.length})</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Timeline position="right">
              {mcpConnections.map((connection, index) => (
                <TimelineItem key={connection.id}>
                  <TimelineSeparator>
                    <TimelineDot color={connection.success ? 'success' : 'error'}>
                      {connection.success ? <SuccessIcon /> : <ErrorIcon />}
                    </TimelineDot>
                    {index < mcpConnections.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper sx={{ p: 1.5, mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {getServiceIcon(connection.service)}
                        <Typography variant="subtitle2">
                          {connection.service}.{connection.action}
                        </Typography>
                      </Box>
                      <Chip
                        label={connection.service}
                        size="small"
                        color={getServiceColor(connection.service)}
                        sx={{ mb: 0.5 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        実行時間: {formatDuration(connection.duration)}
                      </Typography>
                      {connection.error && (
                        <Typography 
                          variant="caption" 
                          color="error" 
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          エラー: {connection.error}
                        </Typography>
                      )}
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  );
};

export default ConnectionHistory;