import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET() {
  try {
    // oasdiff 실행 가능 여부 확인 (개발 환경에서는 스킵)
    if (config.app.environment === 'production') {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      await execAsync('oasdiff --version');
    }
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      port: config.server.port,
      host: config.server.host,
      services: {
        app: 'healthy',
        oasdiff: config.app.environment === 'production' ? 'healthy' : 'skipped'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      port: config.server.port,
      host: config.server.host,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
