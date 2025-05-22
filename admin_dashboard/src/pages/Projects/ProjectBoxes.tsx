import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
  AvatarGroup,
  LinearProgress,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Tooltip,
  Badge,
  Menu,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  CardActions,
  Alert,
  Fab,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Sort as SortIcon,
  MoreVert as MoreVertIcon,
  GitHub as GitHubIcon,
  BugReport as BugReportIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
  Analytics as AnalyticsIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  SmartToy as SmartToyIcon,
  Code as CodeIcon,
  PullRequest as PullRequestIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarToday as CalendarIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Types and Interfaces
interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

interface GitHubPR {
  id: number;
  title: string;
  status: 'open' | 'closed' | 'merged' | 'draft';
  author: string;
  reviewers: string[];
  branch: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Issue {
  id: number;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'closed';
  assignee: string;
  labels: string[];
  createdAt: Date;
}

interface AITask {
  id: string;
  agent: 'claude' | 'openai' | 'gemini';
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  cost: number;
  duration: number;
  createdAt: Date;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold' | 'planning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  team: TeamMember[];
  tags: string[];
  repository: string;
  prs: GitHubPR[];
  issues: Issue[];
  aiTasks: AITask[];
  cost: number;
  estimatedCompletion: Date;
  createdAt: Date;
  updatedAt: Date;
  milestones: {
    id: string;
    title: string;
    completed: boolean;
    dueDate: Date;
  }[];
}

interface FilterOptions {
  search: string;
  status: string[];
  priority: string[];
  tags: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sortBy: 'recent' | 'priority' | 'progress' | 'cost' | 'name';
  sortOrder: 'asc' | 'desc';
}

// Mock Data
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'E-commerce Platform v2.0',
    description: 'Next-generation e-commerce platform with AI-powered recommendations',
    status: 'active',
    priority: 'high',
    progress: 75,
    team: [
      { id: '1', name: 'John Doe', avatar: '/avatars/john.jpg', role: 'Lead Developer' },
      { id: '2', name: 'Jane Smith', avatar: '/avatars/jane.jpg', role: 'UI/UX Designer' },
      { id: '3', name: 'Mike Johnson', avatar: '/avatars/mike.jpg', role: 'Backend Developer' }
    ],
    tags: ['React', 'Node.js', 'AI', 'E-commerce'],
    repository: 'company/ecommerce-v2',
    prs: [
      {
        id: 123,
        title: 'Implement AI recommendation engine',
        status: 'open',
        author: 'john-doe',
        reviewers: ['jane-smith'],
        branch: 'feature/ai-recommendations',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-16')
      }
    ],
    issues: [
      {
        id: 456,
        title: 'Fix checkout flow bug',
        priority: 'high',
        status: 'in-progress',
        assignee: 'mike-johnson',
        labels: ['bug', 'checkout'],
        createdAt: new Date('2024-01-14')
      }
    ],
    aiTasks: [
      {
        id: 'ai-1',
        agent: 'claude',
        task: 'Code review and optimization suggestions',
        status: 'completed',
        cost: 12.50,
        duration: 300,
        createdAt: new Date('2024-01-15')
      }
    ],
    cost: 45000,
    estimatedCompletion: new Date('2024-03-15'),
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-01-16'),
    milestones: [
      { id: 'm1', title: 'MVP Release', completed: true, dueDate: new Date('2024-01-01') },
      { id: 'm2', title: 'Beta Testing', completed: false, dueDate: new Date('2024-02-15') }
    ]
  },
  {
    id: '2',
    name: 'Mobile App Redesign',
    description: 'Complete redesign of mobile application with new branding',
    status: 'planning',
    priority: 'medium',
    progress: 25,
    team: [
      { id: '2', name: 'Jane Smith', avatar: '/avatars/jane.jpg', role: 'UI/UX Designer' },
      { id: '4', name: 'Sarah Wilson', avatar: '/avatars/sarah.jpg', role: 'Mobile Developer' }
    ],
    tags: ['Mobile', 'React Native', 'Design'],
    repository: 'company/mobile-app',
    prs: [],
    issues: [
      {
        id: 789,
        title: 'Design new onboarding flow',
        priority: 'medium',
        status: 'open',
        assignee: 'jane-smith',
        labels: ['design', 'ux'],
        createdAt: new Date('2024-01-10')
      }
    ],
    aiTasks: [
      {
        id: 'ai-2',
        agent: 'openai',
        task: 'Generate UI component variations',
        status: 'running',
        cost: 8.75,
        duration: 180,
        createdAt: new Date('2024-01-16')
      }
    ],
    cost: 28000,
    estimatedCompletion: new Date('2024-04-01'),
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-16'),
    milestones: [
      { id: 'm3', title: 'Design System', completed: false, dueDate: new Date('2024-02-01') },
      { id: 'm4', title: 'Prototype', completed: false, dueDate: new Date('2024-03-01') }
    ]
  },
  {
    id: '3',
    name: 'Data Analytics Dashboard',
    description: 'Real-time analytics dashboard for business intelligence',
    status: 'completed',
    priority: 'high',
    progress: 100,
    team: [
      { id: '3', name: 'Mike Johnson', avatar: '/avatars/mike.jpg', role: 'Backend Developer' },
      { id: '5', name: 'Alex Chen', avatar: '/avatars/alex.jpg', role: 'Data Scientist' }
    ],
    tags: ['Analytics', 'Python', 'React', 'D3.js'],
    repository: 'company/analytics-dashboard',
    prs: [
      {
        id: 321,
        title: 'Final performance optimizations',
        status: 'merged',
        author: 'mike-johnson',
        reviewers: ['alex-chen'],
        branch: 'feature/performance',
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-12')
      }
    ],
    issues: [],
    aiTasks: [
      {
        id: 'ai-3',
        agent: 'gemini',
        task: 'Data visualization recommendations',
        status: 'completed',
        cost: 15.25,
        duration: 420,
        createdAt: new Date('2024-01-08')
      }
    ],
    cost: 38000,
    estimatedCompletion: new Date('2024-01-15'),
    createdAt: new Date('2023-11-01'),
    updatedAt: new Date('2024-01-15'),
    milestones: [
      { id: 'm5', title: 'Core Features', completed: true, dueDate: new Date('2023-12-15') },
      { id: 'm6', title: 'Testing & Launch', completed: true, dueDate: new Date('2024-01-15') }
    ]
  }
];

// Main Component
const ProjectBoxes: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    status: [],
    priority: [],
    tags: [],
    dateRange: { start: null, end: null },
    sortBy: 'recent',
    sortOrder: 'desc'
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(project => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          project.name.toLowerCase().includes(searchLower) ||
          project.description.toLowerCase().includes(searchLower) ||
          project.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          project.team.some(member => member.name.toLowerCase().includes(searchLower)) ||
          project.prs.some(pr => pr.title.toLowerCase().includes(searchLower)) ||
          project.issues.some(issue => issue.title.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(project.status)) {
        return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(project.priority)) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0 && !filters.tags.some(tag => project.tags.includes(tag))) {
        return false;
      }

      // Date range filter
      if (filters.dateRange.start && project.createdAt < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && project.createdAt > filters.dateRange.end) {
        return false;
      }

      return true;
    });

    // Sort projects
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
        case 'cost':
          comparison = a.cost - b.cost;
          break;
        case 'recent':
        default:
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [projects, filters]);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach(project => {
      project.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [projects]);

  // Status colors and icons
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'primary';
      case 'on-hold': return 'warning';
      case 'planning': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayArrowIcon />;
      case 'completed': return <CheckCircleIcon />;
      case 'on-hold': return <PauseIcon />;
      case 'planning': return <ScheduleIcon />;
      default: return <ScheduleIcon />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Handlers
  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setDialogOpen(true);
  };

  const handleCreateProject = () => {
    setCreateDialogOpen(true);
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Project Card Component
  const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
      onClick={() => handleProjectClick(project)}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" component="h2" gutterBottom>
            {project.name}
          </Typography>
          <Box display="flex" gap={1}>
            <Chip
              icon={getStatusIcon(project.status)}
              label={project.status}
              color={getStatusColor(project.status) as any}
              size="small"
            />
            <Chip
              label={project.priority}
              color={getPriorityColor(project.priority) as any}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {project.description}
        </Typography>

        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2">Progress</Typography>
            <Typography variant="body2" fontWeight="medium">{project.progress}%</Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={project.progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <Box display="flex" flex-wrap="wrap" gap={0.5} mb={2}>
          {project.tags.slice(0, 3).map(tag => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
          {project.tags.length > 3 && (
            <Chip label={`+${project.tags.length - 3}`} size="small" variant="outlined" />
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}>
            {project.team.map(member => (
              <Tooltip key={member.id} title={`${member.name} - ${member.role}`}>
                <Avatar 
                  src={member.avatar} 
                  alt={member.name}
                  sx={{ width: 32, height: 32 }}
                >
                  {member.name.charAt(0)}
                </Avatar>
              </Tooltip>
            ))}
          </AvatarGroup>
          <Typography variant="h6" color="primary">
            ${project.cost.toLocaleString()}
          </Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={4}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Badge badgeContent={project.prs.filter(pr => pr.status === 'open').length} color="primary">
                <GitHubIcon fontSize="small" color="action" />
              </Badge>
              <Typography variant="caption">PRs</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Badge badgeContent={project.issues.filter(issue => issue.status === 'open').length} color="error">
                <BugReportIcon fontSize="small" color="action" />
              </Badge>
              <Typography variant="caption">Issues</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Badge badgeContent={project.aiTasks.filter(task => task.status === 'running').length} color="secondary">
                <SmartToyIcon fontSize="small" color="action" />
              </Badge>
              <Typography variant="caption">AI Tasks</Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>

      <CardActions>
        <Button size="small" startIcon={<VisibilityIcon />}>
          View Details
        </Button>
        <Button size="small" startIcon={<EditIcon />}>
          Edit
        </Button>
        <IconButton size="small">
          <MoreVertIcon />
        </IconButton>
      </CardActions>
    </Card>
  );

  // Project Detail Dialog Component
  const ProjectDetailDialog: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);

    if (!selectedProject) return null;

    return (
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5">{selectedProject.name}</Typography>
            <Box display="flex" gap={1}>
              <Chip
                icon={getStatusIcon(selectedProject.status)}
                label={selectedProject.status}
                color={getStatusColor(selectedProject.status) as any}
              />
              <Chip
                label={selectedProject.priority}
                color={getPriorityColor(selectedProject.priority) as any}
                variant="outlined"
              />
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Overview" icon={<TimelineIcon />} />
            <Tab label="PRs & Issues" icon={<GitHubIcon />} />
            <Tab label="AI Tasks" icon={<SmartToyIcon />} />
            <Tab label="Analytics" icon={<AnalyticsIcon />} />
          </Tabs>

          {tabValue === 0 && (
            <Box>
              <Typography variant="body1" paragraph>
                {selectedProject.description}
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Project Progress</Typography>
                    <Box mb={2}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography>Overall Progress</Typography>
                        <Typography fontWeight="medium">{selectedProject.progress}%</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={selectedProject.progress} 
                        sx={{ height: 10, borderRadius: 5 }}
                      />
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>Milestones</Typography>
                    <List dense>
                      {selectedProject.milestones.map(milestone => (
                        <ListItem key={milestone.id}>
                          <ListItemAvatar>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              {milestone.completed ? <CheckCircleIcon color="success" /> : <ScheduleIcon />}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={milestone.title}
                            secondary={`Due: ${milestone.dueDate.toLocaleDateString()}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Team Members</Typography>
                    <List>
                      {selectedProject.team.map(member => (
                        <ListItem key={member.id}>
                          <ListItemAvatar>
                            <Avatar src={member.avatar}>{member.name.charAt(0)}</Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={member.name}
                            secondary={member.role}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {tabValue === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>Pull Requests</Typography>
              {selectedProject.prs.map(pr => (
                <Paper key={pr.id} sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">#{pr.id} {pr.title}</Typography>
                    <Chip label={pr.status} color={pr.status === 'merged' ? 'success' : 'default'} size="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    by {pr.author} • {pr.branch} • {pr.createdAt.toLocaleDateString()}
                  </Typography>
                </Paper>
              ))}

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Issues</Typography>
              {selectedProject.issues.map(issue => (
                <Paper key={issue.id} sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">#{issue.id} {issue.title}</Typography>
                    <Box display="flex" gap={1}>
                      <Chip label={issue.priority} color={getPriorityColor(issue.priority) as any} size="small" />
                      <Chip label={issue.status} size="small" />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Assigned to {issue.assignee} • {issue.createdAt.toLocaleDateString()}
                  </Typography>
                  <Box mt={1}>
                    {issue.labels.map(label => (
                      <Chip key={label} label={label} size="small" variant="outlined" sx={{ mr: 0.5 }} />
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          {tabValue === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>AI Tasks</Typography>
              {selectedProject.aiTasks.map(task => (
                <Paper key={task.id} sx={{ p: 2, mb: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1">{task.task}</Typography>
                    <Box display="flex" gap={1} alignItems="center">
                      <Chip label={task.agent} size="small" />
                      <Chip 
                        label={task.status} 
                        color={task.status === 'completed' ? 'success' : task.status === 'running' ? 'warning' : 'default'} 
                        size="small" 
                      />
                      <Typography variant="body2">${task.cost}</Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Duration: {Math.floor(task.duration / 60)}m {task.duration % 60}s • {task.createdAt.toLocaleDateString()}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}

          {tabValue === 3 && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Cost Breakdown</Typography>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Total Budget</Typography>
                      <Typography fontWeight="medium">${selectedProject.cost.toLocaleString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>AI Tasks Cost</Typography>
                      <Typography>
                        ${selectedProject.aiTasks.reduce((sum, task) => sum + task.cost, 0).toFixed(2)}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" justifyContent="space-between">
                      <Typography fontWeight="medium">Remaining</Typography>
                      <Typography fontWeight="medium" color="success.main">
                        ${(selectedProject.cost - selectedProject.aiTasks.reduce((sum, task) => sum + task.cost, 0)).toLocaleString()}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Timeline</Typography>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Created</Typography>
                      <Typography>{selectedProject.createdAt.toLocaleDateString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography>Last Updated</Typography>
                      <Typography>{selectedProject.updatedAt.toLocaleDateString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Est. Completion</Typography>
                      <Typography color="primary">{selectedProject.estimatedCompletion.toLocaleDateString()}</Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<EditIcon />}>
            Edit Project
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Project Boxes
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateProject}
          >
            Create Project
          </Button>
        </Box>

        {/* Filters and Search */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search projects, PRs, issues, team members..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  renderValue={(selected) => selected.length > 0 ? `${selected.length} selected` : 'All'}
                >
                  {['active', 'completed', 'on-hold', 'planning'].map(status => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  multiple
                  value={filters.priority}
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                  renderValue={(selected) => selected.length > 0 ? `${selected.length} selected` : 'All'}
                >
                  {['critical', 'high', 'medium', 'low'].map(priority => (
                    <MenuItem key={priority} value={priority}>
                      {priority}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <MenuItem value="recent">Recent</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="priority">Priority</MenuItem>
                  <MenuItem value="progress">Progress</MenuItem>
                  <MenuItem value="cost">Cost</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <Box display="flex" gap={1}>
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newMode) => newMode && setViewMode(newMode)}
                  size="small"
                >
                  <ToggleButton value="grid">Grid</ToggleButton>
                  <ToggleButton value="list">List</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>
          </Grid>

          {/* Tag filters */}
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>Tags:</Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {allTags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  clickable
                  color={filters.tags.includes(tag) ? 'primary' : 'default'}
                  onClick={() => {
                    const newTags = filters.tags.includes(tag)
                      ? filters.tags.filter(t => t !== tag)
                      : [...filters.tags, tag];
                    handleFilterChange('tags', newTags);
                  }}
                />
              ))}
            </Box>
          </Box>
        </Paper>

        {/* Projects Grid */}
        <Grid container spacing={3}>
          {filteredProjects.map(project => (
            <Grid item xs={12} sm={6} lg={4} key={project.id}>
              <ProjectCard project={project} />
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            minHeight={400}
          >
            <AssignmentIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No projects found
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Try adjusting your search criteria or create a new project to get started.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateProject}>
              Create Your First Project
            </Button>
          </Box>
        )}

        {/* Project Detail Dialog */}
        <ProjectDetailDialog />

        {/* Floating Action Button */}
        <Fab
          color="primary"
          aria-label="add project"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleCreateProject}
        >
          <AddIcon />
        </Fab>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          <Alert 
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
            severity={snackbar.severity}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default ProjectBoxes;