export interface ParsedGitHubUrl {
  owner: string;
  name: string;
  isValid: boolean;
  error?: string;
  swaggerPath?: string; // Swagger 파일 경로 (선택사항)
}

/**
 * GitHub URL을 파싱하여 owner와 repository name을 추출
 * 지원하는 URL 형식:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo
 * - https://github.com/owner/repo/path/to/swagger.yaml (Swagger 파일 경로 포함)
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  if (!url.trim()) {
    return {
      owner: '',
      name: '',
      isValid: false,
      error: 'URL을 입력해주세요.'
    };
  }

  // owner/repo 형식 처리
  if (!url.includes('github.com') && !url.includes('@') && !url.includes('://')) {
    const parts = url.split('/');
    if (parts.length === 2) {
      const [owner, name] = parts;
      if (owner && name) {
        return {
          owner: owner.trim(),
          name: name.trim().replace('.git', ''),
          isValid: true
        };
      }
    }
  }

  try {
    // HTTPS URL 처리
    if (url.startsWith('https://github.com/')) {
      const path = url.replace('https://github.com/', '');
      const parts = path.split('/');
      
      if (parts.length >= 2) {
        const [owner, name, ...swaggerPathParts] = parts;
        const result: ParsedGitHubUrl = {
          owner: owner.trim(),
          name: name.trim().replace('.git', ''),
          isValid: true
        };
        
        // Swagger 파일 경로가 있는 경우
        if (swaggerPathParts.length > 0) {
          let swaggerPath = swaggerPathParts.join('/');
          
          // GitHub blob URL에서 실제 파일 경로 추출
          // blob/branch/path/to/file -> path/to/file
          if (swaggerPath.startsWith('blob/')) {
            const blobParts = swaggerPath.split('/');
            if (blobParts.length >= 3) {
              // blob/branch/path/to/file -> path/to/file
              swaggerPath = blobParts.slice(2).join('/');
            }
          }
          
          result.swaggerPath = swaggerPath;
        }
        
        return result;
      }
    }
    
    // SSH URL 처리
    if (url.startsWith('git@github.com:')) {
      const path = url.replace('git@github.com:', '');
      const parts = path.split('/');
      
      if (parts.length >= 2) {
        const [owner, name] = parts;
        return {
          owner: owner.trim(),
          name: name.trim().replace('.git', ''),
          isValid: true
        };
      }
    }

    // 일반적인 GitHub URL 패턴 처리 (Swagger 경로 포함)
    const githubPattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/(.+))?$/;
    const match = url.match(githubPattern);
    
    if (match) {
      const [, owner, name, swaggerPath] = match;
      const result: ParsedGitHubUrl = {
        owner: owner.trim(),
        name: name.trim(),
        isValid: true
      };
      
      // Swagger 파일 경로가 있는 경우
      if (swaggerPath) {
        let path = swaggerPath;
        
        // GitHub blob URL에서 실제 파일 경로 추출
        // blob/branch/path/to/file -> path/to/file
        if (path.startsWith('blob/')) {
          const blobParts = path.split('/');
          if (blobParts.length >= 3) {
            // blob/branch/path/to/file -> path/to/file
            path = blobParts.slice(2).join('/');
          }
        }
        
        result.swaggerPath = path;
      }
      
      return result;
    }

    return {
      owner: '',
      name: '',
      isValid: false,
      error: '올바른 GitHub URL 형식이 아닙니다.'
    };

  } catch (error) {
    return {
      owner: '',
      name: '',
      isValid: false,
      error: 'URL 파싱 중 오류가 발생했습니다.'
    };
  }
}

/**
 * URL이 GitHub URL인지 확인
 */
export function isGitHubUrl(url: string): boolean {
  return url.includes('github.com') || 
         url.includes('@github.com') || 
         (!url.includes('://') && url.includes('/') && !url.includes('@'));
}

/**
 * 입력값이 URL인지 owner/name 형식인지 판단
 */
export function getInputType(input: string): 'url' | 'owner-name' | 'unknown' {
  if (isGitHubUrl(input)) {
    return 'url';
  }
  
  if (input.includes('/') && input.split('/').length === 2) {
    return 'owner-name';
  }
  
  return 'unknown';
}

/**
 * GitHub URL 파싱 테스트 함수 (개발용)
 */
export function testGitHubUrlParsing(url: string): void {
  console.log(`[URL Parser Test] Input: ${url}`);
  const result = parseGitHubUrl(url);
  console.log(`[URL Parser Test] Result:`, result);
}
