import { RepositoryInfo, Branch, Tag } from '@/types';

export class GitHubService {
  private token: string;
  private baseUrl: string;
  
  constructor(token: string) {
    this.token = token;
    this.baseUrl = 'https://api.github.com';
  }
  
  private getHeaders() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'API-Compare-Tool'
    };
  }
  
  async getRepository(owner: string, name: string): Promise<RepositoryInfo> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${name}`,
      { headers: this.getHeaders() }
    );
    
    if (!response.ok) {
      throw new GitHubError(`Repository not found: ${owner}/${name}`, response.status);
    }
    
    return response.json();
  }
  
  async getBranches(owner: string, name: string): Promise<Branch[]> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${name}/branches`,
      { headers: this.getHeaders() }
    );
    
    if (!response.ok) {
      throw new GitHubError('Failed to fetch branches', response.status);
    }
    
    return response.json();
  }
  
  async getTags(owner: string, name: string): Promise<Tag[]> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${name}/tags`,
      { headers: this.getHeaders() }
    );
    
    if (!response.ok) {
      throw new GitHubError('Failed to fetch tags', response.status);
    }
    
    return response.json();
  }
  
  async getFileContent(
    owner: string, 
    name: string, 
    path: string, 
    ref?: string
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}/repos/${owner}/${name}/contents/${path}`);
    if (ref) {
      url.searchParams.append('ref', ref);
    }
    
    const response = await fetch(url.toString(), { headers: this.getHeaders() });
    
    if (!response.ok) {
      throw new GitHubError(`File not found: ${path}`, response.status);
    }
    
    return response.json();
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}
