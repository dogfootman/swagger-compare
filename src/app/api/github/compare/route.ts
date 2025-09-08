import { GitHubService, GitHubError } from '@/lib/github';
import { SwaggerCompareService } from '@/lib/swaggerCompareService';
import { SwaggerDiscoveryService } from '@/lib/swaggerDiscovery';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { owner, name, baseVersion, targetVersion, searchPaths } = await request.json();

    if (!owner || !name || !baseVersion || !targetVersion) {
      return NextResponse.json(
        { error: 'Owner, name, baseVersion, and targetVersion are required' },
        { status: 400 }
      );
    }

    console.log(`[API] Comparison request: ${owner}/${name} ${baseVersion} -> ${targetVersion}`);
    console.log(`[API] Received searchPaths:`, searchPaths);

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

    // GitHub 서비스 및 Swagger 검색 서비스 초기화
    const githubService = new GitHubService(token);
    const swaggerDiscovery = new SwaggerDiscoveryService(githubService);

    try {
      // 두 버전의 Swagger 파일 가져오기
      console.log(`[API] Fetching Swagger files for comparison`);

      // 각 버전에 대한 Version 객체 생성
      const baseVersionObj = { name: baseVersion, type: 'tag' as const, isLatest: false, commitHash: '', ref: baseVersion };
      const targetVersionObj = { name: targetVersion, type: 'tag' as const, isLatest: false, commitHash: '', ref: targetVersion };

      // SwaggerDiscoveryService를 사용하여 각 버전에서 Swagger 파일 찾기
      console.log(`[API] 🔍 Searching for Swagger files with paths:`, searchPaths);

      const [baseFiles, targetFiles] = await Promise.all([
        swaggerDiscovery.discoverSwaggerFiles(owner, name, [baseVersionObj], searchPaths),
        swaggerDiscovery.discoverSwaggerFiles(owner, name, [targetVersionObj], searchPaths)
      ]);

      console.log(`[API] 📊 Discovery results:`, {
        baseFiles: baseFiles.size,
        targetFiles: targetFiles.size,
        baseVersions: Array.from(baseFiles.keys()),
        targetVersions: Array.from(targetFiles.keys())
      });

      // 각 버전에서 첫 번째 Swagger 파일 선택
      const baseFile = baseFiles.get(baseVersion)?.[0];
      const targetFile = targetFiles.get(targetVersion)?.[0];

      if (!baseFile || !targetFile) {
        console.error(`[API] Swagger files not found: base=${baseVersion}, target=${targetVersion}`);
        return NextResponse.json(
          { error: 'Failed to fetch one or both Swagger files' },
          { status: 404 }
        );
      }

      // 파일 내용 가져오기
      const [baseContent, targetContent] = await Promise.all([
        githubService.getFileContent(owner, name, baseFile.path, baseVersion),
        githubService.getFileContent(owner, name, targetFile.path, targetVersion)
      ]);

      if (!baseContent || !targetContent || baseContent.type !== 'file' || targetContent.type !== 'file') {
        return NextResponse.json(
          { error: 'Failed to fetch file content' },
          { status: 404 }
        );
      }

      // 파일 내용 다운로드
      const [baseResponse, targetResponse] = await Promise.all([
        fetch(baseContent.download_url!),
        fetch(targetContent.download_url!)
      ]);

      if (!baseResponse.ok || !targetResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to download file content' },
          { status: 404 }
        );
      }

      const [baseText, targetText] = await Promise.all([
        baseResponse.text(),
        targetResponse.text()
      ]);

      const baseFileData = {
        path: baseFile.path,
        content: baseText,
        version: baseVersion,
        commitHash: baseFile.commitHash,
        commitDate: new Date()
      };

      const targetFileData = {
        path: targetFile.path,
        content: targetText,
        version: targetVersion,
        commitHash: targetFile.commitHash,
        commitDate: new Date()
      };

      // Swagger 비교 서비스로 비교 실행
      console.log(`[API] Starting Swagger comparison`);
      const swaggerCompareService = new SwaggerCompareService();

      const comparisonResult = await swaggerCompareService.compareFiles(baseFileData, targetFileData);

      if (!comparisonResult.success) {
        return NextResponse.json(
          {
            error: comparisonResult.error || 'Comparison failed',
            details: 'Check if both files are valid Swagger/OpenAPI specifications'
          },
          { status: 500 }
        );
      }

      // 결과 정리
      const result = {
        repository: `${owner}/${name}`,
        comparison: {
          baseVersion,
          targetVersion,
          baseFile: {
            path: baseFileData.path,
            version: baseFileData.version,
            commitHash: baseFileData.commitHash,
            size: baseFileData.content.length
          },
          targetFile: {
            path: targetFileData.path,
            version: targetFileData.version,
            commitHash: targetFileData.commitHash,
            size: targetFileData.content.length
          }
        },
        changes: comparisonResult.changes,
        summary: comparisonResult.summary,
        details: comparisonResult.details,
        metadata: {
          comparedAt: new Date().toISOString(),
          tool: 'SwaggerCompareService',
          format: 'json'
        }
      };

      console.log(`[API] Comparison completed: ${comparisonResult.summary.total} changes found`);

      return NextResponse.json(result);

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Not Found')) {
          return NextResponse.json(
            { error: 'One or both versions not found' },
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
    console.error('Version comparison error:', error);

    // 더 구체적인 오류 메시지 제공
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error instanceof GitHubError && error.status === 401) {
        errorMessage = 'GitHub token not found';
        statusCode = 401;
      } else if (error.message.includes('Not Found')) {
        errorMessage = 'One or both versions not found';
        statusCode = 404;
      } else if (error.message.includes('Access denied')) {
        errorMessage = 'Access denied - insufficient permissions';
        statusCode = 403;
      } else if (error.message.includes('Rate limit')) {
        errorMessage = 'API rate limit exceeded';
        statusCode = 429;
      } else {
        errorMessage = `Comparison failed: ${error.message}`;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}
