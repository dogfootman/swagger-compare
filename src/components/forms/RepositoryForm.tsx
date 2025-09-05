'use client';

import { useState } from 'react';
import { useToken } from '@/components/TokenProvider';
import { parseGitHubUrl, testGitHubUrlParsing } from '@/utils/githubUrlParser';
// SwaggerPathConfig 제거됨 - URL에서 자동으로 경로 추출
import { VersionComparisonForm } from './VersionComparisonForm';
import { ComparisonDetailViewer } from '@/components/modals/ComparisonDetailViewer';

interface SwaggerDiscoveryResult {
  repository: string;
  versions: Array<{
    name: string;
    type: 'branch' | 'tag';
    isLatest: boolean;
    commitHash: string;
  }>;
  swaggerFiles: Record<string, any[]>;
  summary: {
    totalVersions: number;
    versionsWithSwagger: number;
    totalSwaggerFiles: number;
  };
}

interface ComparisonResult {
  repository: string;
  comparison: {
    baseVersion: string;
    targetVersion: string;
    baseFile: any;
    targetFile: any;
  };
  changes: any[];
  summary: {
    total: number;
    new: number;
    changed: number;
    deprecated: number;
  };
  metadata: any;
  details?: {
    baseEndpoints: number;
    baseModels: number;
    targetEndpoints: number;
    targetModels: number;
  };
}

export const RepositoryForm: React.FC = () => {
  const { hasToken } = useToken();
  const [githubUrl, setGithubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repository, setRepository] = useState<any>(null);
  const [swaggerPath, setSwaggerPath] = useState<string>('');
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!githubUrl.trim()) {
      setError('GitHub URL을 입력해주세요.');
      return;
    }
    
    // URL 파싱 테스트 (개발용)
    testGitHubUrlParsing(githubUrl);
    
    const parsed = parseGitHubUrl(githubUrl);
    console.log('[RepositoryForm] Final parsed result:', {
      input: githubUrl,
      owner: parsed.owner,
      name: parsed.name,
      isValid: parsed.isValid,
      swaggerPath: parsed.swaggerPath,
      error: parsed.error
    });
    
    if (!parsed.isValid) {
      setError(parsed.error || '올바른 GitHub URL 형식이 아닙니다.');
      return;
    }
    
    // Swagger 파일 경로가 URL에 포함된 경우 자동 설정
    if (parsed.swaggerPath) {
      console.log('[RepositoryForm] ✅ Swagger path found:', parsed.swaggerPath);
      setSwaggerPath(parsed.swaggerPath);
    } else {
      console.log('[RepositoryForm] ❌ No swagger path found in URL');
      setSwaggerPath('');
    }
    
    await searchRepository(parsed.owner, parsed.name, parsed.swaggerPath);
  };
  
  const searchRepository = async (repoOwner: string, repoName: string, swaggerPathParam?: string) => {
    setIsLoading(true);
    setError(null);
    setComparisonResult(null);
    
    try {
      const response = await fetch('/api/github/repository', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner: repoOwner, name: repoName }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setRepository(data);
        
        // Repository 검색 완료 후 버전 정보 가져오기
        await fetchVersions(repoOwner, repoName);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Repository를 찾을 수 없습니다.');
      }
    } catch (err) {
      setError('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchVersions = async (owner: string, name: string) => {
    setIsLoadingVersions(true);
    setVersions([]);
    
    try {
      const response = await fetch('/api/github/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, name }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions);
        console.log('[RepositoryForm] ✅ Versions loaded:', data.versions.length);
      } else {
        const errorData = await response.json();
        console.error('[RepositoryForm] Version fetch error:', errorData);
        setVersions([]);
      }
    } catch (err) {
      console.error('[RepositoryForm] Version fetch network error:', err);
      setVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };
  
  
  const handleVersionComparison = async (baseVersion: string, targetVersion: string, owner: string, name: string, swaggerPathParam?: string) => {
    if (!repository) return;
    
    console.log('[RepositoryForm] 🚀 handleVersionComparison called with:', {
      swaggerPathParam,
      currentSwaggerPath: swaggerPath,
      swaggerPathState: swaggerPath
    });
    
    setIsComparing(true);
    setComparisonError(null);
    
    // Swagger 경로가 있으면 해당 경로만, 없으면 기본 경로들 사용
    // 우선순위: 함수 매개변수 > 상태 swaggerPath > swaggerResult에서 실제 찾은 경로
    let currentSwaggerPath = swaggerPathParam || swaggerPath;
    
    // swaggerPath가 없으면 기본 경로들 사용 (swaggerResult 제거됨)
    if (!currentSwaggerPath) {
      console.log('[RepositoryForm] 🔍 No swagger path specified, using default search paths');
    }
    
    // 임시 해결책: cb-tumblebug의 경우 정확한 경로 사용
    if (!currentSwaggerPath && owner === 'cloud-barista' && name === 'cb-tumblebug') {
      currentSwaggerPath = 'src/interface/rest/docs/swagger.yaml';
      console.log('[RepositoryForm] 🔧 Fallback: Using hardcoded path for cb-tumblebug:', currentSwaggerPath);
    }
    
    const searchPaths = currentSwaggerPath ? [currentSwaggerPath] : [
      'swagger.yaml',
      'swagger.yml', 
      'openapi.yaml',
      'openapi.yml',
      'api.yaml',
      'api.yml',
      'swagger/swagger.yaml',
      'swagger/swagger.yml',
      'docs/swagger.yaml',
      'docs/swagger.yml',
      'docs/openapi.yaml',
      'docs/openapi.yml',
      'openapi/openapi.yaml',
      'openapi/openapi.yml',
      'api/swagger.yaml',
      'api/swagger.yml',
      'api/openapi.yaml',
      'api/openapi.yml'
    ];
    
    console.log('[RepositoryForm] 🔄 Starting version comparison:', {
      baseVersion,
      targetVersion,
      owner,
      name,
      repository: `${owner}/${name}`,
      swaggerPathParam: swaggerPathParam,
      swaggerPath: swaggerPath,
      currentSwaggerPath: currentSwaggerPath,
      searchPaths: searchPaths
    });
    
    try {
      const requestBody = {
        owner,
        name,
        baseVersion,
        targetVersion,
        searchPaths
      };
      
      console.log('[RepositoryForm] 📤 Sending API request:', requestBody);
      
      const response = await fetch('/api/github/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('[RepositoryForm] Comparison API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[RepositoryForm] Comparison result:', data);
        setComparisonResult(data);
      } else {
        let errorMessage = '버전 비교에 실패했습니다.';
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          console.error('[RepositoryForm] Comparison API error:', errorData);
          
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          if (errorData.details) {
            errorDetails = errorData.details;
          }
        } catch (parseError) {
          console.error('[RepositoryForm] Failed to parse error response:', parseError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        setComparisonError(errorDetails ? `${errorMessage} (${errorDetails})` : errorMessage);
      }
    } catch (err) {
      console.error('[RepositoryForm] Comparison network error:', err);
      
      let errorMessage = '버전 비교 중 오류가 발생했습니다.';
      if (err instanceof Error) {
        if (err.message.includes('fetch')) {
          errorMessage = '네트워크 연결을 확인해주세요.';
        } else if (err.message.includes('timeout')) {
          errorMessage = '요청 시간이 초과되었습니다.';
        } else {
          errorMessage = `오류: ${err.message}`;
        }
      }
      
      setComparisonError(errorMessage);
    } finally {
      setIsComparing(false);
    }
  };
  
  const handleReset = () => {
    setError(null);
    setRepository(null);
    setVersions([]);
    setComparisonResult(null);
    setGithubUrl('');
    setSwaggerPath('');
  };
  
  // SwaggerPathConfig 관련 함수들 제거됨

  if (!hasToken) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex items-center space-x-2">
          <span className="text-yellow-600">⚠️</span>
          <div>
            <p className="text-yellow-800 font-medium">
              GitHub 토큰이 필요합니다
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              Repository를 검색하려면 먼저 GitHub Personal Access Token을 설정해주세요.
            </p>
            <div className="mt-2">
              <button
                onClick={() => window.location.reload()}
                className="text-yellow-800 underline hover:no-underline text-sm"
              >
                토큰 설정으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      {/* GitHub URL 입력 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-3">
          <input
            id="githubUrl"
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/owner/repository 또는 https://github.com/owner/repository/api/swagger.yaml"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
          
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '검색 중...' : '검색'}
          </button>
          
          {(repository || comparisonResult) && (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              초기화
            </button>
          )}
        </div>
      </form>
      
      {/* 에러 메시지 */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      
      {/* Repository 정보 */}
      {repository && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-4 text-sm">
            <span className="font-medium text-gray-900">{repository.owner.login}/{repository.name}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-600">Default: {repository.default_branch}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-600">{repository.private ? 'Private' : 'Public'}</span>
            {swaggerPath && (
              <>
                <span className="text-gray-500">•</span>
                <span className="text-blue-600 font-mono text-xs">{swaggerPath}</span>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* 버전 비교 폼 - Repository 검색 완료 후 표시 */}
      {repository && (
        <div className="mt-6">
          {isLoadingVersions ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-gray-600">버전 정보를 가져오는 중...</p>
              </div>
            </div>
          ) : (
            <VersionComparisonForm
              versions={versions}
              repository={`${repository.owner.login}/${repository.name}`}
              owner={repository.owner.login}
              name={repository.name}
              onCompare={handleVersionComparison}
              isComparing={isComparing}
              swaggerPath={swaggerPath}
            />
          )}
        </div>
      )}
      
      {/* 버전 비교 결과 */}
      {comparisonResult && (
        <div className="mt-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">버전 비교 결과</h3>
            </div>
            
            {/* 비교 정보 */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <div className="flex items-center space-x-4">
                <div>
                  <span className="text-sm font-medium text-blue-800">기준 버전:</span>
                  <span className="ml-2 text-sm text-blue-600">{comparisonResult.comparison.baseVersion}</span>
                </div>
                <div className="text-blue-400">→</div>
                <div>
                  <span className="text-sm font-medium text-blue-800">대상 버전:</span>
                  <span className="ml-2 text-sm text-blue-600">{comparisonResult.comparison.targetVersion}</span>
                </div>
              </div>
            </div>
            
            {/* 변경사항이 없는 경우 */}
            {comparisonResult.summary.total === 0 ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-6 text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <h4 className="text-lg font-medium text-green-800">두 버전이 동일합니다</h4>
                </div>
                <p className="text-sm text-green-700">
                  {comparisonResult.comparison.baseVersion}과 {comparisonResult.comparison.targetVersion} 사이에 변경사항이 없습니다.
                </p>
              </div>
            ) : (
              <>
                {/* 요약 통계 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.total}</div>
                    <div className="text-sm text-gray-800">총 변경사항</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.new}</div>
                    <div className="text-sm text-green-800">새로운 기능</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.changed}</div>
                    <div className="text-sm text-yellow-800">변경된 기능</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.deprecated}</div>
                    <div className="text-sm text-red-800">제거된 기능</div>
                  </div>
                </div>
                
                {/* 상세 통계 */}
                {comparisonResult.details && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                    <h4 className="font-medium text-blue-900 mb-3">API 상세 정보</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-800">기준 버전 ({comparisonResult.comparison.baseVersion})</div>
                        <div className="text-sm text-blue-600">
                          엔드포인트: {comparisonResult.details.baseEndpoints}개 | 
                          모델: {comparisonResult.details.baseModels}개
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-800">대상 버전 ({comparisonResult.comparison.targetVersion})</div>
                        <div className="text-sm text-blue-600">
                          엔드포인트: {comparisonResult.details.targetEndpoints}개 | 
                          모델: {comparisonResult.details.targetModels}개
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 상세 비교 뷰어를 메인화면에 통합 */}
                <div className="mt-6">
                  <ComparisonDetailViewer
                    isOpen={true}
                    onClose={() => {}} // 메인화면에서는 닫기 기능 불필요
                    comparisonResult={comparisonResult}
                    isEmbedded={true} // 메인화면에 임베드됨을 표시
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* 비교 에러 */}
      {comparisonError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{comparisonError}</p>
        </div>
      )}
    </div>
  );
};