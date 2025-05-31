import { apiClient, API_CONFIG } from '@/src/lib/api-config';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived' | 'draft';
  settings?: Record<string, any>;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  settings?: Record<string, any>;
}

export class ProjectService {
  private static instance: ProjectService;

  private constructor() {}

  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  public async getProjects(): Promise<Project[]> {
    return apiClient.get<Project[]>(API_CONFIG.ENDPOINTS.PROJECTS.LIST);
  }

  public async getProject(id: string): Promise<Project> {
    return apiClient.get<Project>(API_CONFIG.ENDPOINTS.PROJECTS.GET(id));
  }

  public async createProject(data: CreateProjectRequest): Promise<Project> {
    return apiClient.post<Project>(API_CONFIG.ENDPOINTS.PROJECTS.CREATE, data);
  }

  public async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return apiClient.put<Project>(API_CONFIG.ENDPOINTS.PROJECTS.UPDATE(id), data);
  }

  public async deleteProject(id: string): Promise<void> {
    return apiClient.delete<void>(API_CONFIG.ENDPOINTS.PROJECTS.DELETE(id));
  }
}

export const projectService = ProjectService.getInstance();