import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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
    // 1. 환경변수에서 토큰 확인 (우선순위)
    const envToken = process.env.GITHUB_TOKEN;
    if (envToken) {
      // 환경변수 토큰 유효성 검증
      const isValid = await validateGitHubToken(envToken);
      return NextResponse.json({
        hasToken: true,
        isValid,
        source: 'environment'
      });
    }

    // 2. 쿠키에서 토큰 확인
    const cookieStore = await cookies();
    const token = cookieStore.get('github_token')?.value;

    if (!token) {
      return NextResponse.json({ 
        hasToken: false,
        source: 'none'
      });
    }

    // 토큰 유효성 재검증
    const isValid = await validateGitHubToken(token);

    return NextResponse.json({
      hasToken: true,
      isValid,
      source: 'cookie'
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
