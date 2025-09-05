import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GitHubService } from '@/lib/github';

export async function POST(request: NextRequest) {
  try {
    const { owner, name } = await request.json();
    
    if (!owner || !name) {
      return NextResponse.json(
        { error: 'Owner and name are required' },
        { status: 400 }
      );
    }
    
    console.log(`[API] Fetching versions for ${owner}/${name}`);
    
    const cookieStore = await cookies();
    const token = cookieStore.get('github_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not found' },
        { status: 401 }
      );
    }
    
    const githubService = new GitHubService(token);
    
    try {
      // 브랜치와 태그 정보 가져오기
      const [branches, tags] = await Promise.all([
        githubService.getBranches(owner, name),
        githubService.getTags(owner, name)
      ]);
      
      console.log(`[API] Branches:`, branches.length, 'Tags:', tags.length);
      if (branches.length > 0) {
        console.log(`[API] First branch structure:`, JSON.stringify(branches[0], null, 2));
      }
      if (tags.length > 0) {
        console.log(`[API] First tag structure:`, JSON.stringify(tags[0], null, 2));
      }
      
      // 버전 정보 정리
      const versions = [
        // 브랜치들
        ...branches.map(branch => {
          const commitDate = branch.commit?.commit?.date || 
                           branch.commit?.date || 
                           new Date().toISOString();
          return {
            name: branch.name,
            type: 'branch' as const,
            isLatest: branch.name === 'main' || branch.name === 'master',
            commitHash: branch.commit?.sha || '',
            commitDate: commitDate
          };
        }),
        // 태그들
        ...tags.map(tag => {
          const commitDate = tag.commit?.commit?.date || 
                           tag.commit?.date || 
                           new Date().toISOString();
          return {
            name: tag.name,
            type: 'tag' as const,
            isLatest: false,
            commitHash: tag.commit?.sha || '',
            commitDate: commitDate
          };
        })
      ];
      
      // 최신 태그 찾기
      if (tags.length > 0) {
        const latestTag = tags[0]; // GitHub API는 이미 최신순으로 정렬됨
        const latestTagIndex = versions.findIndex(v => v.name === latestTag.name);
        if (latestTagIndex !== -1) {
          versions[latestTagIndex].isLatest = true;
        }
      }
      
      console.log(`[API] Found ${versions.length} versions: ${versions.length} total`);
      
      return NextResponse.json({
        versions,
        repository: `${owner}/${name}`,
        totalVersions: versions.length,
        branches: branches.length,
        tags: tags.length
      });
      
    } catch (error) {
      console.error('GitHub API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch repository versions' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Version fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
