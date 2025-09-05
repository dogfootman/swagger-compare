import { SwaggerFile, ApiChange, VersionComparison } from '@/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface OasdiffResult {
  success: boolean;
  changes: ApiChange[];
  summary: {
    total: number;
    new: number;
    changed: number;
    deprecated: number;
  };
  error?: string;
  rawOutput?: string;
}

export class OasdiffService {
  private tempDir: string;
  
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'apicompare');
    this.ensureTempDir();
  }
  
  /**
   * 임시 디렉토리 생성
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  /**
   * oasdiff 설치 확인
   */
  async checkOasdiffInstallation(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('oasdiff --version');
      console.log('[OasdiffService] oasdiff version:', stdout.trim());
      return true;
    } catch (error) {
      console.error('[OasdiffService] oasdiff not found:', error);
      return false;
    }
  }
  
  /**
   * 두 Swagger 파일 비교
   */
  async compareFiles(
    baseFile: SwaggerFile,
    targetFile: SwaggerFile
  ): Promise<OasdiffResult> {
    try {
      console.log(`[OasdiffService] Comparing ${baseFile.version} -> ${targetFile.version}`);
      
      // oasdiff 설치 확인
      const isInstalled = await this.checkOasdiffInstallation();
      if (!isInstalled) {
        return {
          success: false,
          changes: [],
          summary: { total: 0, new: 0, changed: 0, deprecated: 0 },
          error: 'oasdiff is not installed. Please install it first.'
        };
      }
      
      // 임시 파일 생성
      const baseFilePath = await this.createTempFile(baseFile);
      const targetFilePath = await this.createTempFile(targetFile);
      
      try {
        // oasdiff 실행
        const result = await this.runOasdiff(baseFilePath, targetFilePath);
        
        // 결과 파싱
        const parsedResult = this.parseOasdiffOutput(result);
        
        console.log(`[OasdiffService] Comparison completed: ${parsedResult.summary.total} changes found`);
        
        return {
          success: true,
          changes: parsedResult.changes,
          summary: parsedResult.summary,
          rawOutput: result
        };
        
      } finally {
        // 임시 파일 정리
        this.cleanupTempFiles([baseFilePath, targetFilePath]);
      }
      
    } catch (error) {
      console.error('[OasdiffService] Comparison failed:', error);
      return {
        success: false,
        changes: [],
        summary: { total: 0, new: 0, changed: 0, deprecated: 0 },
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  /**
   * 임시 파일 생성
   */
  private async createTempFile(swaggerFile: SwaggerFile): Promise<string> {
    const fileName = `${swaggerFile.version}_${Date.now()}.json`;
    const filePath = path.join(this.tempDir, fileName);
    
    await fs.promises.writeFile(filePath, swaggerFile.content, 'utf8');
    console.log(`[OasdiffService] Created temp file: ${filePath}`);
    
    return filePath;
  }
  
  /**
   * oasdiff 명령어 실행
   */
  private async runOasdiff(basePath: string, targetPath: string): Promise<string> {
    const command = `oasdiff --format json --fail-on-diff ${basePath} ${targetPath}`;
    
    console.log(`[OasdiffService] Running command: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.log(`[OasdiffService] stderr: ${stderr}`);
      }
      
      return stdout;
    } catch (error: any) {
      // oasdiff는 차이가 있을 때 exit code 1을 반환하므로, 이것은 정상적인 동작입니다
      if (error.code === 1 && error.stdout) {
        return error.stdout;
      }
      throw error;
    }
  }
  
  /**
   * oasdiff 출력 파싱
   */
  private parseOasdiffOutput(output: string): {
    changes: ApiChange[];
    summary: { total: number; new: number; changed: number; deprecated: number };
  } {
    try {
      const parsed = JSON.parse(output);
      const changes: ApiChange[] = [];
      
      let newCount = 0;
      let changedCount = 0;
      let deprecatedCount = 0;
      
      // oasdiff 출력 구조에 따라 파싱
      if (parsed.changes) {
        for (const change of parsed.changes) {
          const apiChange = this.parseChange(change);
          if (apiChange) {
            changes.push(apiChange);
            
            // 카운트 업데이트
            switch (apiChange.type) {
              case 'new':
                newCount++;
                break;
              case 'changed_path':
              case 'changed_param':
              case 'changed_model':
                changedCount++;
                break;
              case 'deprecated':
                deprecatedCount++;
                break;
            }
          }
        }
      }
      
      return {
        changes,
        summary: {
          total: changes.length,
          new: newCount,
          changed: changedCount,
          deprecated: deprecatedCount
        }
      };
      
    } catch (error) {
      console.error('[OasdiffService] Failed to parse output:', error);
      
      // 파싱 실패 시 텍스트 기반 파싱 시도
      return this.parseTextOutput(output);
    }
  }
  
  /**
   * 텍스트 기반 출력 파싱 (JSON 파싱 실패 시 대안)
   */
  private parseTextOutput(output: string): {
    changes: ApiChange[];
    summary: { total: number; new: number; changed: number; deprecated: number };
  } {
    const changes: ApiChange[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // 간단한 패턴 매칭으로 변경사항 추출
      if (trimmed.includes('added') || trimmed.includes('new')) {
        changes.push({
          operationId: this.extractOperationId(trimmed),
          type: 'new',
          severity: 'medium',
          description: trimmed
        });
      } else if (trimmed.includes('removed') || trimmed.includes('deleted')) {
        changes.push({
          operationId: this.extractOperationId(trimmed),
          type: 'deprecated',
          severity: 'high',
          description: trimmed
        });
      } else if (trimmed.includes('changed') || trimmed.includes('modified')) {
        changes.push({
          operationId: this.extractOperationId(trimmed),
          type: 'changed_param',
          severity: 'medium',
          description: trimmed
        });
      }
    }
    
    return {
      changes,
      summary: {
        total: changes.length,
        new: changes.filter(c => c.type === 'new').length,
        changed: changes.filter(c => c.type !== 'new' && c.type !== 'deprecated').length,
        deprecated: changes.filter(c => c.type === 'deprecated').length
      }
    };
  }
  
  /**
   * 변경사항 파싱
   */
  private parseChange(change: any): ApiChange | null {
    try {
      // oasdiff 출력 구조에 맞게 파싱
      const operationId = change.operationId || change.path || 'unknown';
      const type = this.determineChangeType(change);
      const severity = this.determineSeverity(change);
      const description = change.description || change.message || JSON.stringify(change);
      
      return {
        operationId,
        type,
        severity,
        description,
        oldPath: change.oldPath,
        newPath: change.newPath,
        oldParams: change.oldParams,
        newParams: change.newParams
      };
    } catch (error) {
      console.error('[OasdiffService] Failed to parse change:', error);
      return null;
    }
  }
  
  /**
   * 변경 타입 결정
   */
  private determineChangeType(change: any): ApiChange['type'] {
    if (change.type) {
      switch (change.type.toLowerCase()) {
        case 'added':
        case 'new':
          return 'new';
        case 'removed':
        case 'deleted':
          return 'deprecated';
        case 'modified':
        case 'changed':
          if (change.pathChanged) return 'changed_path';
          if (change.paramChanged) return 'changed_param';
          return 'changed_model';
        default:
          return 'changed_param';
      }
    }
    
    // 기본값
    return 'changed_param';
  }
  
  /**
   * 심각도 결정
   */
  private determineSeverity(change: any): ApiChange['severity'] {
    if (change.severity) {
      switch (change.severity.toLowerCase()) {
        case 'high':
          return 'high';
        case 'medium':
          return 'medium';
        case 'low':
          return 'low';
      }
    }
    
    // 타입에 따른 기본 심각도
    switch (change.type?.toLowerCase()) {
      case 'removed':
      case 'deleted':
        return 'high';
      case 'added':
      case 'new':
        return 'low';
      default:
        return 'medium';
    }
  }
  
  /**
   * operationId 추출
   */
  private extractOperationId(text: string): string {
    // 간단한 패턴 매칭으로 operationId 추출
    const match = text.match(/([a-zA-Z0-9_]+)/);
    return match ? match[1] : 'unknown';
  }
  
  /**
   * 임시 파일 정리
   */
  private cleanupTempFiles(filePaths: string[]): void {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[OasdiffService] Cleaned up: ${filePath}`);
        }
      } catch (error) {
        console.error(`[OasdiffService] Failed to cleanup: ${filePath}`, error);
      }
    }
  }
  
  /**
   * 서비스 정리
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
        console.log(`[OasdiffService] Cleaned up temp directory: ${this.tempDir}`);
      }
    } catch (error) {
      console.error('[OasdiffService] Cleanup failed:', error);
    }
  }
}
