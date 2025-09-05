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
    
    // GitHub API로 토큰 유효성 검증
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'API-Compare-Tool'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return NextResponse.json({
        isValid: true,
        username: userData.login,
        message: 'Token is valid'
      });
    } else {
      return NextResponse.json({
        isValid: false,
        message: 'Invalid token'
      });
    }
    
  } catch (error) {
    return NextResponse.json(
      { 
        isValid: false,
        error: 'Failed to validate token',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
