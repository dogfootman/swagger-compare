import { SwaggerFile, Version } from '@/types';
import { GitHubService } from './github';

export interface SwaggerFileInfo {
  path: string;
  name: string;
  size: number;
  sha: string;
  url: string;
  downloadUrl: string | null;
}

export class SwaggerDiscoveryService {
  private githubService: GitHubService;
  private searchPaths: string[];
  
  // 일반적인 Swagger 파일 경로 패턴
  private readonly defaultPaths = [
    'swagger.yaml',
    'swagger.yml',
    'openapi.yaml',
    'openapi.yml',
    'api.yaml',
    'api.yml',
    'swagger/swagger.yaml',
    'swagger/swagger.yml',
    'docs/swagger.yaml',
    'docs/swagger.yml',
    'docs/openapi.yaml',
    'docs/openapi.yml',
    'openapi/openapi.yaml',
    'openapi/openapi.yml',
    'api/swagger.yaml',
    'api/swagger.yml',
    'api/openapi.yaml',
    'api/openapi.yml'
  ];
  
  constructor(githubService: GitHubService, customPaths?: string[]) {
    this.githubService = githubService;
    this.searchPaths = customPaths ? [...customPaths] : [...this.defaultPaths];
  }
  
  /**
   * 검색 경로 설정
   */
  setSearchPaths(paths: string[]): void {
    this.searchPaths = [...paths];
    console.log(`[SwaggerDiscovery] Search paths updated to:`, this.searchPaths);
  }
  
  /**
   * 검색 경로 추가
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
      console.log(`[SwaggerDiscovery] Added search path: ${path}`);
    }
  }
  
  /**
   * 검색 경로 제거
   */
  removeSearchPath(path: string): void {
    const index = this.searchPaths.indexOf(path);
    if (index > -1) {
      this.searchPaths.splice(index, 1);
      console.log(`[SwaggerDiscovery] Removed search path: ${path}`);
    }
  }
  
  /**
   * 현재 검색 경로 조회
   */
  getSearchPaths(): string[] {
    return [...this.searchPaths];
  }
  
  /**
   * 기본 경로로 초기화
   */
  resetToDefaultPaths(): void {
    this.searchPaths = [...this.defaultPaths];
    console.log(`[SwaggerDiscovery] Reset to default paths`);
  }
  
  /**
   * Repository에서 Swagger 파일들을 검색
   */
  async discoverSwaggerFiles(
    owner: string,
    name: string,
    versions: Version[],
    customPaths?: string[]
  ): Promise<Map<string, SwaggerFile[]>> {
    console.log(`[SwaggerDiscovery] Starting discovery for ${owner}/${name} with ${versions.length} versions`);
    
    // customPaths가 제공되면 사용, 아니면 기본 경로 사용
    const searchPaths = customPaths || this.searchPaths;
    console.log(`[SwaggerDiscovery] Using search paths:`, searchPaths);
    
    const versionFiles = new Map<string, SwaggerFile[]>();
    
    for (const version of versions) {
      console.log(`[SwaggerDiscovery] Searching in version: ${version.name} (${version.type})`);
      const files = await this.findSwaggerFilesInVersion(owner, name, version, searchPaths);
      console.log(`[SwaggerDiscovery] Found ${files.length} files in version ${version.name}`);
      if (files.length > 0) {
        versionFiles.set(version.name, files);
      }
    }
    
    console.log(`[SwaggerDiscovery] Total versions with files: ${versionFiles.size}`);
    return versionFiles;
  }
  
  /**
   * 특정 버전에서 Swagger 파일 검색
   */
  private async findSwaggerFilesInVersion(
    owner: string,
    name: string,
    version: Version,
    customPaths?: string[]
  ): Promise<SwaggerFile[]> {
    const files: SwaggerFile[] = [];
    const searchPaths = customPaths || this.searchPaths;
    
    for (const path of searchPaths) {
      try {
        console.log(`[SwaggerDiscovery] Trying path: ${path} in version ${version.name}`);
        const fileInfo = await this.githubService.getFileContent(owner, name, path, version.ref);
        
        if (fileInfo.type === 'file' && fileInfo.download_url) {
          console.log(`[SwaggerDiscovery] Found file: ${path} in version ${version.name}`);
          const content = await this.downloadFileContent(fileInfo.download_url);
          const swaggerFile: SwaggerFile = {
            path: fileInfo.path,
            content,
            version: version.name,
            commitHash: fileInfo.sha,
            commitDate: new Date()
          };
          
          files.push(swaggerFile);
        }
      } catch (error) {
        // 파일이 존재하지 않으면 무시하고 계속 진행
        console.log(`[SwaggerDiscovery] Path ${path} not found in version ${version.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }
    
    return files;
  }
  
  /**
   * 파일 내용 다운로드
   */
  private async downloadFileContent(downloadUrl: string): Promise<string> {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to download file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Swagger 파일 유효성 검증
   */
  async validateSwaggerFile(content: string): Promise<boolean> {
    try {
      // YAML 파일인지 확인
      if (content.includes('openapi:') || content.includes('swagger:')) {
        return true;
      }
      
      // JSON 파일인지 확인
      if (content.trim().startsWith('{')) {
        const json = JSON.parse(content);
        return json.openapi || json.swagger;
      }
      
      return false;
    } catch {
      return false;
    }
  }
  
  /**
   * Repository의 모든 버전 정보 가져오기
   */
  async getRepositoryVersions(owner: string, name: string): Promise<Version[]> {
    try {
      const [branches, tags] = await Promise.all([
        this.githubService.getBranches(owner, name),
        this.githubService.getTags(owner, name)
      ]);
      
      const versions: Version[] = [];
      
      // main/master 브랜치를 최신으로
      const mainBranch = branches.find(b => ['main', 'master'].includes(b.name));
      if (mainBranch) {
        versions.push({
          name: mainBranch.name,
          type: 'branch',
          ref: mainBranch.name,
          commitHash: mainBranch.commit.sha,
          isLatest: true
        });
      }
      
      // develop 브랜치 추가
      const developBranch = branches.find(b => b.name === 'develop');
      if (developBranch) {
        versions.push({
          name: developBranch.name,
          type: 'branch',
          ref: developBranch.name,
          commitHash: developBranch.commit.sha,
          isLatest: false
        });
      }
      
      // 태그들을 날짜순으로 정렬 (최근 10개)
      const sortedTags = tags
        .slice(0, 10); // 임시로 날짜 정렬 제거
      
      sortedTags.forEach(tag => {
        versions.push({
          name: tag.name,
          type: 'tag',
          ref: tag.name,
          commitHash: tag.commit.sha,
          isLatest: false
        });
      });
      
      return versions;
    } catch (error) {
      throw new Error(`Failed to get repository versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Swagger 파일 경로 패턴 추가
   */
  addCustomPath(pattern: string): void {
    if (!this.defaultPaths.includes(pattern)) {
      this.defaultPaths.push(pattern);
    }
  }
  
  /**
   * 현재 등록된 경로 패턴 조회
   */
  getRegisteredPaths(): string[] {
    return [...this.defaultPaths];
  }
}
