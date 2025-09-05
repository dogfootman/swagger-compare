import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }
    
    // 토큰 유효성 검증
    const isValid = await validateGitHubToken(token);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid GitHub token' },
        { status: 400 }
      );
    }
    
    // HttpOnly 쿠키로 저장 (보안 강화)
    const response = NextResponse.json({ success: true });
    response.cookies.set('github_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7일
    });
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save token' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('github_token')?.value;
    
    if (!token) {
      return NextResponse.json({ hasToken: false });
    }
    
    // 토큰 유효성 재검증
    const isValid = await validateGitHubToken(token);
    
    return NextResponse.json({
      hasToken: true,
      isValid
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get token' },
      { status: 500 }
    );
  }
}

async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'API-Compare-Tool'
      }
    });
    
    return response.ok;
  } catch {
    return false;
  }
}
