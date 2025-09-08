import { GitHubService, GitHubError } from '@/lib/github';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { path, version, commitHash } = await request.json();

    if (!path || !version) {
      return NextResponse.json(
        { error: 'Path and version are required' },
        { status: 400 }
      );
    }

    // 1. 환경변수에서 토큰 확인 (우선순위)
    let token = process.env.GITHUB_TOKEN;

    // 2. 환경변수에 토큰이 없으면 쿠키에서 확인
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('github_token')?.value;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not found' },
        { status: 401 }
      );
    }

    // URL에서 owner와 name 추출
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const name = url.searchParams.get('name');

    if (!owner || !name) {
      return NextResponse.json(
        { error: 'Owner and name are required as query parameters' },
        { status: 400 }
      );
    }

    // GitHub 서비스 초기화
    const githubService = new GitHubService(token);

    try {
      // 파일 내용 가져오기
      const fileInfo = await githubService.getFileContent(owner, name, path, version);

      if (fileInfo.type !== 'file' || !fileInfo.download_url) {
        return NextResponse.json(
          { error: 'File not found or not accessible' },
          { status: 404 }
        );
      }

      // 파일 내용 다운로드
      const response = await fetch(fileInfo.download_url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      const content = await response.text();

      // 파일 유효성 검증
      if (!isValidSwaggerContent(content)) {
        return NextResponse.json(
          { error: 'Invalid Swagger/OpenAPI file content' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        path: fileInfo.path,
        content: content,
        size: fileInfo.size,
        sha: fileInfo.sha,
        version: version,
        commitHash: commitHash
      });

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Not Found')) {
          return NextResponse.json(
            { error: 'File not found in the specified version' },
            { status: 404 }
          );
        }

        if (error.message.includes('Access denied')) {
          return NextResponse.json(
            { error: 'Access denied - insufficient permissions' },
            { status: 403 }
          );
        }
      }

      throw error;
    }

  } catch (error) {
    console.error('Swagger content fetch error:', error);

    if (error instanceof GitHubError && error.status === 401) {
      return NextResponse.json(
        { error: 'GitHub token not found' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Swagger/OpenAPI 파일 내용 유효성 검증
 */
function isValidSwaggerContent(content: string): boolean {
  const trimmed = content.trim();

  // YAML 형식 확인
  if (trimmed.includes('openapi:') || trimmed.includes('swagger:')) {
    return true;
  }

  // JSON 형식 확인
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(content);
      return !!(json.openapi || json.swagger);
    } catch {
      return false;
    }
  }

  return false;
}
