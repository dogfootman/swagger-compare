export interface RepositoryInfo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  default_branch: string;
  branches_url: string;
  tags_url: string;
  contents_url: string;
  private: boolean;
  permissions?: {
    pull: boolean;
    push: boolean;
    admin: boolean;
  };
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface Tag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  zipball_url: string;
  tarball_url: string;
}

export interface SwaggerFile {
  path: string;
  content: string;
  version: string;
  commitHash: string;
  commitDate: Date;
}

export interface ApiChange {
  operationId: string;
  type: 'new' | 'changed_path' | 'changed_param' | 'changed_model' | 'deprecated';
  oldPath?: string;
  newPath?: string;
  oldParams?: Record<string, any>;
  newParams?: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
  description: string;
  method?: string; // HTTP 메서드 (GET, POST, PUT, DELETE 등)
  path?: string; // 현재 경로
  details?: {
    modelName?: string;
    changes?: string[];
    baseSchema?: any;
    targetSchema?: any;
  };
}

export interface VersionComparison {
  baseVersion: string;
  targetVersion: string;
  changes: ApiChange[];
  summary: {
    total: number;
    new: number;
    changed: number;
    deprecated: number;
  };
}

export interface Version {
  name: string;
  type: 'branch' | 'tag';
  ref: string;
  commitHash: string;
  isLatest: boolean;
}

export interface RepositoryAnalysis {
  repository: RepositoryInfo;
  versions: Version[];
  swaggerFiles: SwaggerFile[];
  lastUpdated: Date;
}
