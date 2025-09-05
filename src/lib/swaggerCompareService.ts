import { SwaggerFile, ApiChange } from '@/types';
// @ts-ignore
import * as yaml from 'js-yaml';

export interface SwaggerCompareResult {
  success: boolean;
  changes: ApiChange[];
  operationChanges: ApiChange[];  // API 엔드포인트 관련 변경사항
  modelChanges: ApiChange[];      // 데이터 모델 관련 변경사항
  summary: {
    total: number;
    new: number;
    changed: number;
    deprecated: number;
    operations: {
      total: number;
      new: number;
      changed: number;
      deprecated: number;
    };
    models: {
      total: number;
      new: number;
      changed: number;
      deprecated: number;
    };
  };
  error?: string;
  details?: {
    baseEndpoints: number;
    targetEndpoints: number;
    baseModels: number;
    targetModels: number;
  };
}

export class SwaggerCompareService {
  
  /**
   * 두 Swagger 파일 비교
   */
  async compareFiles(
    baseFile: SwaggerFile,
    targetFile: SwaggerFile
  ): Promise<SwaggerCompareResult> {
    try {
      console.log(`[SwaggerCompareService] Comparing ${baseFile.version} -> ${targetFile.version}`);
      
      // 파일 내용 파싱
      const baseSpec = await this.parseSwaggerFile(baseFile.content);
      const targetSpec = await this.parseSwaggerFile(targetFile.content);
      
      if (!baseSpec || !targetSpec) {
        return {
          success: false,
          changes: [],
          operationChanges: [],
          modelChanges: [],
          summary: { 
            total: 0, 
            new: 0, 
            changed: 0, 
            deprecated: 0,
            operations: { total: 0, new: 0, changed: 0, deprecated: 0 },
            models: { total: 0, new: 0, changed: 0, deprecated: 0 }
          },
          error: 'Failed to parse one or both Swagger files'
        };
      }
      
      // 비교 실행
      const changes = await this.compareSpecifications(baseSpec, targetSpec);
      
      // Operation과 Model 변경사항 분리
      const operationChanges = changes.filter(change => 
        change.path && (change.type === 'new' || change.type === 'deprecated' || change.type === 'changed_path')
      );
      
      const modelChanges = changes.filter(change => 
        !change.path && (change.type === 'new' || change.type === 'deprecated' || change.type === 'changed_model')
      );
      
      // 요약 통계
      const summary = this.calculateSummary(changes);
      const operationSummary = this.calculateSummary(operationChanges);
      const modelSummary = this.calculateSummary(modelChanges);
      
      // 상세 정보
      const details = {
        baseEndpoints: this.countEndpoints(baseSpec),
        targetEndpoints: this.countEndpoints(targetSpec),
        baseModels: this.countModels(baseSpec),
        targetModels: this.countModels(targetSpec)
      };
      
      console.log(`[SwaggerCompareService] Comparison completed: ${summary.total} changes found (Operations: ${operationSummary.total}, Models: ${modelSummary.total})`);
      
      return {
        success: true,
        changes,
        operationChanges,
        modelChanges,
        summary: {
          ...summary,
          operations: operationSummary,
          models: modelSummary
        },
        details
      };
      
    } catch (error) {
      console.error('[SwaggerCompareService] Comparison failed:', error);
      return {
        success: false,
        changes: [],
        operationChanges: [],
        modelChanges: [],
        summary: { 
          total: 0, 
          new: 0, 
          changed: 0, 
          deprecated: 0,
          operations: { total: 0, new: 0, changed: 0, deprecated: 0 },
          models: { total: 0, new: 0, changed: 0, deprecated: 0 }
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Swagger 파일 파싱
   */
  private async parseSwaggerFile(content: string): Promise<any> {
    try {
      // YAML 파일인지 확인
      if (content.includes('openapi:') || content.includes('swagger:')) {
        return yaml.load(content);
      }
      
      // JSON 파일인지 확인
      if (content.trim().startsWith('{')) {
        return JSON.parse(content);
      }
      
      throw new Error('Unsupported file format');
    } catch (error) {
      console.error('[SwaggerCompareService] Parse error:', error);
      return null;
    }
  }
  
  /**
   * 스펙 비교
   */
  private async compareSpecifications(baseSpec: any, targetSpec: any): Promise<ApiChange[]> {
    const changes: ApiChange[] = [];
    
    // 1. 경로 비교
    const pathChanges = this.comparePaths(baseSpec, targetSpec);
    changes.push(...pathChanges);
    
    // 2. 모델 비교
    const modelChanges = this.compareModels(baseSpec, targetSpec);
    changes.push(...modelChanges);
    
    // 3. 파라미터 비교
    const paramChanges = this.compareParameters(baseSpec, targetSpec);
    changes.push(...paramChanges);
    
    return changes;
  }
  
  /**
   * 경로 비교
   */
  private comparePaths(baseSpec: any, targetSpec: any): ApiChange[] {
    const changes: ApiChange[] = [];
    const basePaths = this.extractPaths(baseSpec);
    const targetPaths = this.extractPaths(targetSpec);
    
    // 새로운 경로 찾기
    for (const [path, methods] of Object.entries(targetPaths)) {
      if (!basePaths[path]) {
        for (const [method, operation] of Object.entries(methods as any)) {
          if (this.isValidHttpMethod(method)) {
            const op = operation as any;
            changes.push({
              operationId: op.operationId || `${method.toUpperCase()} ${path}`,
              type: 'new',
              severity: 'low',
              description: `New endpoint: ${method.toUpperCase()} ${path}`,
              newPath: path,
              method: method.toUpperCase(),
              path: path
            });
          }
        }
      }
    }
    
    // 제거된 경로 찾기
    for (const [path, methods] of Object.entries(basePaths)) {
      if (!targetPaths[path]) {
        for (const [method, operation] of Object.entries(methods as any)) {
          if (this.isValidHttpMethod(method)) {
            const op = operation as any;
            changes.push({
              operationId: op.operationId || `${method.toUpperCase()} ${path}`,
              type: 'deprecated',
              severity: 'high',
              description: `Deprecated endpoint: ${method.toUpperCase()} ${path}`,
              oldPath: path,
              method: method.toUpperCase(),
              path: path
            });
          }
        }
      }
    }
    
    // 변경된 경로 찾기
    for (const [path, baseMethods] of Object.entries(basePaths)) {
      const targetMethods = targetPaths[path];
      if (targetMethods) {
        for (const [method, baseOperation] of Object.entries(baseMethods as any)) {
          const targetOperation = targetMethods[method];
          if (targetOperation && this.isValidHttpMethod(method)) {
            const operationChanges = this.compareOperation(
              baseOperation,
              targetOperation,
              path,
              method
            );
            changes.push(...operationChanges);
          }
        }
      }
    }
    
    return changes;
  }
  
  /**
   * HTTP 메서드 유효성 검사
   */
  private isValidHttpMethod(method: string): boolean {
    const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
    return validMethods.includes(method.toLowerCase());
  }
  
  /**
   * 경로 추출
   */
  private extractPaths(spec: any): Record<string, any> {
    if (spec.paths) {
      return spec.paths;
    }
    
    return {};
  }
  
  /**
   * 작업 비교
   */
  private compareOperation(baseOp: any, targetOp: any, path: string, method: string): ApiChange[] {
    const changes: ApiChange[] = [];
    const operationId = baseOp.operationId || `${method.toUpperCase()} ${path}`;
    
    // 요청 파라미터 비교
    if (baseOp.parameters && targetOp.parameters) {
      const paramChanges = this.compareParameterArrays(
        baseOp.parameters,
        targetOp.parameters,
        operationId
      );
      changes.push(...paramChanges);
    }
    
    // 응답 스키마 비교
    if (baseOp.responses && targetOp.responses) {
      const responseChanges = this.compareResponses(
        baseOp.responses,
        targetOp.responses,
        operationId,
        path,
        method
      );
      changes.push(...responseChanges);
    }
    
    // 요청 본문 비교
    if (baseOp.requestBody && targetOp.requestBody) {
      const bodyChanges = this.compareRequestBody(
        baseOp.requestBody,
        targetOp.requestBody,
        operationId,
        path,
        method
      );
      changes.push(...bodyChanges);
    }
    
    return changes;
  }
  
  /**
   * 파라미터 배열 비교
   */
  private compareParameterArrays(baseParams: any[], targetParams: any[], operationId: string): ApiChange[] {
    const changes: ApiChange[] = [];
    
    // 새로운 파라미터
    for (const targetParam of targetParams) {
      const baseParam = baseParams.find(p => 
        p.name === targetParam.name && p.in === targetParam.in
      );
      
      if (!baseParam) {
        changes.push({
          operationId,
          type: 'changed_param',
          severity: 'medium',
          description: `New parameter: ${targetParam.in}.${targetParam.name}`,
          newParams: { [targetParam.name]: targetParam },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    // 제거된 파라미터
    for (const baseParam of baseParams) {
      const targetParam = targetParams.find(p => 
        p.name === baseParam.name && p.in === baseParam.in
      );
      
      if (!targetParam) {
        changes.push({
          operationId,
          type: 'changed_param',
          severity: 'high',
          description: `Removed parameter: ${baseParam.in}.${baseParam.name}`,
          oldParams: { [baseParam.name]: baseParam },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    // 변경된 파라미터
    for (const baseParam of baseParams) {
      const targetParam = targetParams.find(p => 
        p.name === baseParam.name && p.in === baseParam.in
      );
      
      if (targetParam && JSON.stringify(baseParam) !== JSON.stringify(targetParam)) {
        changes.push({
          operationId,
          type: 'changed_param',
          severity: 'medium',
          description: `Modified parameter: ${baseParam.in}.${baseParam.name}`,
          oldParams: { [baseParam.name]: baseParam },
          newParams: { [targetParam.name]: targetParam },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    return changes;
  }
  
  /**
   * 응답 비교
   */
  private compareResponses(baseResponses: any, targetResponses: any, operationId: string, path: string, method: string): ApiChange[] {
    const changes: ApiChange[] = [];
    
    // 새로운 응답 코드
    for (const [code, targetResponse] of Object.entries(targetResponses)) {
      if (!baseResponses[code]) {
        changes.push({
          operationId,
          type: 'changed_param',
          severity: 'low',
          description: `New response code: ${code}`,
          newParams: { [code]: targetResponse },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    // 제거된 응답 코드
    for (const [code, baseResponse] of Object.entries(baseResponses)) {
      if (!targetResponses[code]) {
        changes.push({
          operationId,
          type: 'changed_param',
          severity: 'medium',
          description: `Removed response code: ${code}`,
          oldParams: { [code]: baseResponse },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    return changes;
  }
  
  /**
   * 요청 본문 비교
   */
  private compareRequestBody(baseBody: any, targetBody: any, operationId: string, path: string, method: string): ApiChange[] {
    const changes: ApiChange[] = [];
    
    if (JSON.stringify(baseBody) !== JSON.stringify(targetBody)) {
      changes.push({
        operationId,
        type: 'changed_model',
        severity: 'medium',
        description: 'Request body schema changed',
        oldParams: { requestBody: baseBody },
        newParams: { requestBody: targetBody },
        method: 'N/A',
        path: 'N/A'
      });
    }
    
    return changes;
  }
  
  /**
   * 모델 비교
   */
  private compareModels(baseSpec: any, targetSpec: any): ApiChange[] {
    const changes: ApiChange[] = [];
    
    const baseModels = this.extractModels(baseSpec);
    const targetModels = this.extractModels(targetSpec);
    
    // 새로운 모델
    for (const [name, schema] of Object.entries(targetModels)) {
      if (!baseModels[name]) {
        changes.push({
          operationId: `model:${name}`,
          type: 'new',
          severity: 'low',
          description: `New model: ${name}`,
          newParams: { [name]: schema },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    // 제거된 모델
    for (const [name, schema] of Object.entries(baseModels)) {
      if (!targetModels[name]) {
        changes.push({
          operationId: `model:${name}`,
          type: 'deprecated',
          severity: 'medium',
          description: `Removed model: ${name}`,
          oldParams: { [name]: schema },
          method: 'N/A',
          path: 'N/A'
        });
      }
    }
    
    // 변경된 모델
    for (const [name, baseSchema] of Object.entries(baseModels)) {
      const targetSchema = targetModels[name];
      if (targetSchema && JSON.stringify(baseSchema) !== JSON.stringify(targetSchema)) {
        // 상세한 변경 내용 분석
        const modelChanges = this.analyzeModelChanges(baseSchema, targetSchema);
        
        changes.push({
          operationId: `model:${name}`,
          type: 'changed_model',
          severity: 'medium',
          description: `Model schema changed: ${name}${modelChanges.length > 0 ? ` (${modelChanges.length} changes)` : ''}`,
          oldParams: { [name]: baseSchema },
          newParams: { [name]: targetSchema },
          method: 'N/A',
          path: 'N/A',
          details: {
            modelName: name,
            changes: modelChanges,
            baseSchema: baseSchema,
            targetSchema: targetSchema
          }
        });
      }
    }
    
    return changes;
  }
  
  /**
   * 모델 변경 내용 분석
   */
  private analyzeModelChanges(baseSchema: any, targetSchema: any): string[] {
    const changes: string[] = [];
    
    // 타입 변경
    if (baseSchema.type !== targetSchema.type) {
      changes.push(`Type changed: ${baseSchema.type || 'undefined'} → ${targetSchema.type || 'undefined'}`);
    }
    
    // 필수 필드 변경
    const baseRequired = baseSchema.required || [];
    const targetRequired = targetSchema.required || [];
    const addedRequired = targetRequired.filter((field: string) => !baseRequired.includes(field));
    const removedRequired = baseRequired.filter((field: string) => !targetRequired.includes(field));
    
    if (addedRequired.length > 0) {
      changes.push(`Added required fields: ${addedRequired.join(', ')}`);
    }
    if (removedRequired.length > 0) {
      changes.push(`Removed required fields: ${removedRequired.join(', ')}`);
    }
    
    // 속성 변경
    const baseProperties = baseSchema.properties || {};
    const targetProperties = targetSchema.properties || {};
    
    // 새로운 속성
    const addedProperties = Object.keys(targetProperties).filter(key => !baseProperties[key]);
    if (addedProperties.length > 0) {
      changes.push(`Added properties: ${addedProperties.join(', ')}`);
    }
    
    // 제거된 속성
    const removedProperties = Object.keys(baseProperties).filter(key => !targetProperties[key]);
    if (removedProperties.length > 0) {
      changes.push(`Removed properties: ${removedProperties.join(', ')}`);
    }
    
    // 변경된 속성
    const changedProperties = Object.keys(baseProperties).filter(key => 
      targetProperties[key] && JSON.stringify(baseProperties[key]) !== JSON.stringify(targetProperties[key])
    );
    if (changedProperties.length > 0) {
      changes.push(`Modified properties: ${changedProperties.join(', ')}`);
    }
    
    // 설명 변경
    if (baseSchema.description !== targetSchema.description) {
      changes.push('Description changed');
    }
    
    // 제목 변경
    if (baseSchema.title !== targetSchema.title) {
      changes.push('Title changed');
    }
    
    return changes;
  }

  /**
   * 모델 추출
   */
  private extractModels(spec: any): Record<string, any> {
    const models: Record<string, any> = {};
    
    // Swagger 2.x
    if (spec.definitions) {
      Object.assign(models, spec.definitions);
    }
    
    // OpenAPI 3.x
    if (spec.components && spec.components.schemas) {
      Object.assign(models, spec.components.schemas);
    }
    
    return models;
  }
  
  /**
   * 파라미터 비교 (전체 스펙 레벨)
   */
  private compareParameters(baseSpec: any, targetSpec: any): ApiChange[] {
    // 이미 경로 비교에서 처리됨
    return [];
  }
  
  /**
   * 요약 통계 계산
   */
  private calculateSummary(changes: ApiChange[]): { total: number; new: number; changed: number; deprecated: number } {
    let newCount = 0;
    let changedCount = 0;
    let deprecatedCount = 0;
    
    for (const change of changes) {
      switch (change.type) {
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
    
    return {
      total: changes.length,
      new: newCount,
      changed: changedCount,
      deprecated: deprecatedCount
    };
  }
  
  /**
   * 엔드포인트 수 계산
   */
  private countEndpoints(spec: any): number {
    let count = 0;
    const paths = this.extractPaths(spec);
    
    for (const path of Object.values(paths)) {
      if (typeof path === 'object') {
        count += Object.keys(path).filter(key => this.isValidHttpMethod(key)).length;
      }
    }
    
    return count;
  }
  
  /**
   * 모델 수 계산
   */
  private countModels(spec: any): number {
    const models = this.extractModels(spec);
    return Object.keys(models).length;
  }
}
