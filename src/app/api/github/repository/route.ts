import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { owner, name } = await request.json();
    
    if (!owner || !name) {
      return NextResponse.json(
        { error: 'Owner and name are required' },
        { status: 400 }
      );
    }
    
    const cookieStore = await cookies();
    const token = cookieStore.get('github_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token not found' },
        { status: 401 }
      );
    }
    
    // GitHub API 호출
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'API-Compare-Tool'
        }
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Repository not found' },
          { status: 404 }
        );
      }
      
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Access denied - insufficient permissions' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: `GitHub API error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
