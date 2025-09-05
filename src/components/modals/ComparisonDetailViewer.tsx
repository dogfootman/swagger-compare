'use client';

import { useState, useEffect } from 'react';
import { ApiChange } from '@/types';

interface ComparisonResult {
  repository: string;
  comparison: {
    baseVersion: string;
    targetVersion: string;
    baseFile: any;
    targetFile: any;
  };
  changes: ApiChange[];
  summary: {
    total: number;
    new: number;
    changed: number;
    deprecated: number;
    operations?: {
      total: number;
      new: number;
      changed: number;
      deprecated: number;
    };
    models?: {
      total: number;
      new: number;
      changed: number;
      deprecated: number;
    };
  };
  metadata: any;
  details?: {
    baseEndpoints: number;
    baseModels: number;
    targetEndpoints: number;
    targetModels: number;
  };
}

interface ComparisonDetailViewerProps {
  isOpen: boolean;
  onClose: () => void;
  comparisonResult: ComparisonResult;
  isEmbedded?: boolean; // 메인화면에 임베드됨을 표시
}

export const ComparisonDetailViewer: React.FC<ComparisonDetailViewerProps> = ({
  isOpen,
  onClose,
  comparisonResult,
  isEmbedded = false
}) => {
  const [selectedChange, setSelectedChange] = useState<ApiChange | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'changes' | 'side-by-side' | 'file-compare'>('changes');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFileContent, setBaseFileContent] = useState<string>('');
  const [targetFileContent, setTargetFileContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<{ operationId: string; baseContent: any; targetContent: any } | null>(null);
  const [isLoadingOperation, setIsLoadingOperation] = useState(false);
  const [viewCategory, setViewCategory] = useState<'all' | 'operations' | 'models'>('all');

  // isEmbedded가 true이면 viewMode를 'changes'로 설정하고 파일 내용 비교는 숨김
  useEffect(() => {
    if (isEmbedded) {
      setViewMode('changes');
    }
  }, [isEmbedded]);

  // 파일 내용 비교는 isEmbedded가 false일 때만 로드
  // 하지만 isEmbedded 모드에서도 Operation 상세 비교를 위해 파일 내용 로드 허용
  useEffect(() => {
    if (viewMode === 'file-compare' && !isEmbedded) {
      loadFileContents();
    }
  }, [viewMode, isEmbedded]);

  const filteredChanges = comparisonResult.changes.filter(change => {
    const matchesType = filterType === 'all' || (change.type && change.type === filterType);
    const matchesSearch = searchTerm === '' || 
      (change.operationId && change.operationId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (change.path && change.path.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (change.description && change.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // 카테고리 필터 추가
    const matchesCategory = viewCategory === 'all' || 
      (viewCategory === 'operations' && (change.type === 'new' || change.type === 'deprecated' || change.type === 'changed_path')) ||
      (viewCategory === 'models' && (change.type === 'changed_param' || change.type === 'changed_model'));
    
    return matchesType && matchesSearch && matchesCategory;
  });

  const getChangeTypeColor = (type: string) => {
    if (!type) return 'bg-gray-100 text-gray-800';
    
    switch (type) {
      case 'new': return 'bg-green-100 text-green-800';
      case 'changed_path': return 'bg-blue-100 text-blue-800';
      case 'changed_param': return 'bg-yellow-100 text-yellow-800';
      case 'changed_model': return 'bg-purple-100 text-purple-800';
      case 'deprecated': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getChangeTypeLabel = (type: string) => {
    if (!type) return '알 수 없음';
    
    switch (type) {
      case 'new': return '신규';
      case 'changed_path': return '경로 변경';
      case 'changed_param': return '파라미터 변경';
      case 'changed_model': return '모델 변경';
      case 'deprecated': return '사용 중단';
      default: return '알 수 없음';
    }
  };

  const getChangeIcon = (type: string) => {
    if (!type) return '❓';
    
    switch (type) {
      case 'new': return '🆕';
      case 'changed_path': return '🔄';
      case 'changed_param': return '⚙️';
      case 'changed_model': return '🏗️';
      case 'deprecated': return '⚠️';
      default: return '❓';
    }
  };

  const loadFileContents = async () => {
    // isEmbedded 모드에서는 Operation 상세 비교를 위해 파일 내용 로드 허용
    if (viewMode !== 'file-compare' && !isEmbedded) return;
    
    setIsLoadingFiles(true);
    try {
      // 기준 버전과 대상 버전의 파일 내용을 가져오기
      const [baseResponse, targetResponse] = await Promise.all([
        fetch(`/api/github/swagger/content?owner=${comparisonResult.repository.split('/')[0]}&name=${comparisonResult.repository.split('/')[1]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: comparisonResult.comparison.baseFile.path,
            version: comparisonResult.comparison.baseVersion,
            commitHash: comparisonResult.comparison.baseFile.sha
          })
        }),
        fetch(`/api/github/swagger/content?owner=${comparisonResult.repository.split('/')[0]}&name=${comparisonResult.repository.split('/')[1]}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: comparisonResult.comparison.targetFile.path,
            version: comparisonResult.comparison.targetVersion,
            commitHash: comparisonResult.comparison.targetFile.sha
          })
        })
      ]);

      if (baseResponse.ok && targetResponse.ok) {
        const [baseData, targetData] = await Promise.all([
          baseResponse.json(),
          targetResponse.json()
        ]);
        setBaseFileContent(baseData.content);
        setTargetFileContent(targetData.content);
      }
    } catch (error) {
      console.error('파일 내용 로드 오류:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadOperationDetails = async (operationId: string) => {
    setIsLoadingOperation(true);
    try {
      // 두 버전의 Swagger 파일에서 해당 operation의 상세 내용 추출
      const baseSpec = await parseSwaggerContent(baseFileContent);
      const targetSpec = await parseSwaggerContent(targetFileContent);
      
      if (baseSpec && targetSpec) {
        const baseOperation = findOperationInSpec(baseSpec, operationId);
        const targetOperation = findOperationInSpec(targetSpec, operationId);
        
        setSelectedOperation({
          operationId,
          baseContent: baseOperation,
          targetContent: targetOperation
        });
      }
    } catch (error) {
      console.error('Operation 상세 내용 로드 오류:', error);
    } finally {
      setIsLoadingOperation(false);
    }
  };

  const parseSwaggerContent = async (content: string) => {
    try {
      if (content.includes('openapi:') || content.includes('swagger:')) {
        // @ts-ignore
        const yaml = await import('js-yaml');
        return yaml.load(content);
      } else if (content.trim().startsWith('{')) {
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      console.error('Swagger 파싱 오류:', error);
      return null;
    }
  };

  const findOperationInSpec = (spec: any, operationId: string) => {
    if (!spec.paths) return null;
    
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (typeof pathItem === 'object' && pathItem !== null) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (method === 'get' || method === 'post' || method === 'put' || method === 'delete' || method === 'patch') {
            if (operation && typeof operation === 'object' && operation.operationId === operationId) {
              return {
                path,
                method,
                ...operation
              };
            }
          }
        }
      }
    }
    return null;
  };

  // JSON 객체의 차이점을 하이라이트하는 함수
  const highlightJsonDifferences = (baseObj: any, targetObj: any) => {
    const baseStr = JSON.stringify(baseObj, null, 2);
    const targetStr = JSON.stringify(targetObj, null, 2);
    
    // 라인별로 비교하여 차이점 찾기
    const baseLines = baseStr.split('\n');
    const targetLines = targetStr.split('\n');
    
    const maxLines = Math.max(baseLines.length, targetLines.length);
    const highlightedBase: string[] = [];
    const highlightedTarget: string[] = [];
    
    for (let i = 0; i < maxLines; i++) {
      const baseLine = baseLines[i] || '';
      const targetLine = targetLines[i] || '';
      
      if (baseLine !== targetLine) {
        // 라인이 다르면 단어별로 비교하여 차이점 하이라이트
        const highlightedBaseLine = highlightLineDifferences(baseLine, targetLine);
        const highlightedTargetLine = highlightLineDifferences(targetLine, baseLine);
        
        highlightedBase.push(highlightedBaseLine);
        highlightedTarget.push(highlightedTargetLine);
      } else {
        // 같은 라인은 기본 색상
        highlightedBase.push(escapeHtml(baseLine));
        highlightedTarget.push(escapeHtml(targetLine));
      }
    }
    
    return {
      base: highlightedBase.join('\n'),
      target: highlightedTarget.join('\n')
    };
  };

  // HTML 이스케이프 함수
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // 라인 내에서 차이점을 하이라이트하는 함수
  const highlightLineDifferences = (line1: string, line2: string) => {
    // 공백으로 단어 분리
    const words1 = line1.split(/(\s+)/);
    const words2 = line2.split(/(\s+)/);
    
    const result: string[] = [];
    const maxWords = Math.max(words1.length, words2.length);
    
    for (let i = 0; i < maxWords; i++) {
      const word1 = words1[i] || '';
      const word2 = words2[i] || '';
      
      if (word1 !== word2) {
        // 다른 단어는 빨간색으로 하이라이트
        result.push(`<span class="text-red-600 bg-red-100 px-1 rounded font-bold">${escapeHtml(word1)}</span>`);
      } else {
        // 같은 단어는 기본 색상
        result.push(escapeHtml(word1));
      }
    }
    
    return result.join('');
  };

  // 디버깅: change 객체 구조 확인
  useEffect(() => {
    if (comparisonResult && comparisonResult.changes.length > 0) {
      console.log('[ComparisonDetailViewer] First change object:', comparisonResult.changes[0]);
      console.log('[ComparisonDetailViewer] First change keys:', Object.keys(comparisonResult.changes[0]));
      console.log('[ComparisonDetailViewer] All changes:', comparisonResult.changes);
    }
  }, [comparisonResult]);

  if (!isOpen) return null;

  // isEmbedded가 true이면 일반 컴포넌트로 렌더링
  if (isEmbedded) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              변경사항 상세 분석
            </h2>
            <div className="text-sm text-gray-600">
              {comparisonResult.comparison.baseVersion} → {comparisonResult.comparison.targetVersion}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">보기 모드:</label>
              <select
                value={viewMode}
                onChange={(e) => {
                  const newViewMode = e.target.value as any;
                  setViewMode(newViewMode);
                  if (newViewMode === 'file-compare') {
                    setSearchTerm('');
                    setFilterType('all');
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="summary">요약 보기</option>
                <option value="changes">변경사항 목록</option>
                <option value="side-by-side">병렬 비교</option>
                {!isEmbedded && <option value="file-compare">파일 내용 비교</option>}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">카테고리:</label>
              <select
                value={viewCategory}
                onChange={(e) => setViewCategory(e.target.value as 'all' | 'operations' | 'models')}
                disabled={viewMode === 'file-compare'}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  viewMode === 'file-compare' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              >
                <option value="all">전체</option>
                <option value="operations">API 엔드포인트</option>
                <option value="models">데이터 모델</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">필터:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                disabled={viewMode === 'file-compare'}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  viewMode === 'file-compare' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              >
                <option value="all">전체</option>
                <option value="new">신규</option>
                <option value="changed_path">경로 변경</option>
                <option value="changed_param">파라미터 변경</option>
                <option value="changed_model">모델 변경</option>
                <option value="deprecated">사용 중단</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">검색:</label>
              <input
                type="text"
                placeholder="operationId, 경로, 설명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={viewMode === 'file-compare'}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  viewMode === 'file-compare' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {viewMode === 'file-compare' ? 
                '파일 내용 비교 모드' : 
                `${filteredChanges.length} / ${comparisonResult.changes.length} 항목`
              }
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* 요약 보기 */}
          {viewMode === 'summary' && (
            <div className="space-y-6">
              {/* 전체 요약 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">전체 변경사항 요약</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.total}</div>
                    <div className="text-sm text-gray-800">총 변경사항</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.new}</div>
                    <div className="text-sm text-green-800">새로운 항목</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.changed}</div>
                    <div className="text-sm text-yellow-800">변경된 항목</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.deprecated}</div>
                    <div className="text-sm text-red-800">삭제된 항목</div>
                  </div>
                </div>
              </div>

              {/* Operation 요약 */}
              {comparisonResult.summary.operations && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">API 엔드포인트 변경사항</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.operations.total}</div>
                      <div className="text-sm text-gray-800">총 변경사항</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.operations.new}</div>
                      <div className="text-sm text-green-800">새로운 기능</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.operations.changed}</div>
                      <div className="text-sm text-yellow-800">변경된 기능</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.operations.deprecated}</div>
                      <div className="text-sm text-red-800">삭제된 기능</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Model 요약 */}
              {comparisonResult.summary.models && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">데이터 모델 변경사항</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.models.total}</div>
                      <div className="text-sm text-gray-800">총 변경사항</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.models.new}</div>
                      <div className="text-sm text-green-800">새로운 모델</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.models.changed}</div>
                      <div className="text-sm text-yellow-800">변경된 모델</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.models.deprecated}</div>
                      <div className="text-sm text-red-800">삭제된 모델</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 변경사항 목록 */}
          {viewMode === 'changes' && (
            <div className="space-y-4">
              {filteredChanges.map((change, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedChange(selectedChange === change ? null : change)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedChange === change 
                      ? 'ring-2 ring-blue-500 shadow-lg' 
                      : 'hover:shadow-md'
                  } ${
                    // 변경 타입에 따른 배경색 적용
                    change.type === 'new' 
                      ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                      : change.type === 'deprecated' 
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' // changed path, changed param, changed model
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        change.type === 'new' 
                          ? 'bg-green-100 text-green-600' 
                          : change.type === 'deprecated' 
                          ? 'bg-red-100 text-red-600'
                          : 'bg-yellow-100 text-yellow-600' // changed path, changed param, changed model
                      }`}>
                        {getChangeIcon(change.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            change.type === 'new' 
                              ? 'bg-green-100 text-green-800' 
                              : change.type === 'deprecated' 
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800' // changed path, changed param, changed model
                          }`}>
                            {getChangeTypeLabel(change.type)}
                          </span>
                          {change.type && change.type !== 'new' && change.type !== 'deprecated' && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              변경된 기능
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{change.method?.toUpperCase() || 'N/A'}</span>
                        <span className="text-sm text-gray-600 font-mono">{change.path || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {change.severity?.toUpperCase() || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-700 mb-2">
                    <strong>{change.path ? 'Operation ID:' : 'Model:'}</strong> 
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        
                        // 신규 항목인 경우
                        if (change.type === 'new') {
                          setSelectedOperation({
                            operationId: change.operationId || '',
                            baseContent: null, // 신규이므로 기준 버전에 없음
                            targetContent: {
                              path: change.newPath || change.path || 'N/A',
                              method: change.method || 'N/A',
                              summary: change.description || 'N/A',
                              description: change.description || 'N/A'
                            }
                          });
                          return;
                        }
                        
                        // 사용 중단 항목인 경우
                        if (change.type === 'deprecated') {
                          setSelectedOperation({
                            operationId: change.operationId || '',
                            baseContent: {
                              path: change.oldPath || change.path || 'N/A',
                              method: change.method || 'N/A',
                              summary: change.description || 'N/A',
                              description: change.description || 'N/A'
                            },
                            targetContent: null // 사용 중단이므로 대상 버전에 없음
                          });
                          return;
                        }
                        
                        // isEmbedded 모드에서도 실제 Swagger 파일 내용 로드
                        if (isEmbedded) {
                          // isEmbedded 모드에서도 파일 내용을 로드하여 실제 Operation 상세 내용 표시
                          if (baseFileContent && targetFileContent) {
                            loadOperationDetails(change.operationId || '');
                          } else {
                            // 파일 내용이 없으면 먼저 로드
                            loadFileContents().then(() => {
                              if (baseFileContent && targetFileContent) {
                                loadOperationDetails(change.operationId || '');
                              }
                            });
                          }
                        } else {
                          // 기존 모달 모드에서는 파일 내용 로드
                          if (baseFileContent && targetFileContent) {
                            loadOperationDetails(change.operationId || '');
                          } else {
                            alert('파일 내용을 먼저 로드해주세요. "파일 내용 비교" 모드를 먼저 선택하세요.');
                          }
                        }
                      }}
                      className="ml-2 text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      title={isEmbedded ? "클릭하여 Operation 상세 내용 보기" : "클릭하여 두 버전의 operation 상세 내용 비교"}
                    >
                      {change.operationId || 'N/A'}
                    </button>
                  </div>
                  <div className={`text-sm mb-2 ${
                    change.type === 'new' 
                      ? 'text-green-700' 
                      : change.type === 'deprecated' 
                      ? 'text-red-700'
                      : 'text-yellow-700' // changed path, changed param, changed model
                  }`}>
                    {change.description || '설명 없음'}
                  </div>

                  {/* 선택된 변경사항의 상세 정보 */}
                  {selectedChange === change && change.details && (
                    <div className={`mt-4 pt-4 border-t ${
                      change.type === 'new' 
                        ? 'border-green-200' 
                        : change.type === 'deprecated' 
                        ? 'border-red-200'
                        : 'border-yellow-200' // changed path, changed param, changed model
                    }`}>
                      <h5 className="font-medium text-gray-900 mb-2">상세 변경사항</h5>
                      
                      {/* 모델 변경 상세 내용 */}
                      {change.type === 'changed_model' && change.details.changes && change.details.changes.length > 0 ? (
                        <div className="space-y-3">
                          <div className="p-3 rounded bg-yellow-50">
                            <h6 className="font-medium text-gray-800 mb-2">변경 내용:</h6>
                            <ul className="space-y-1 text-sm">
                              {change.details.changes.map((changeItem: string, index: number) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-blue-600 mr-2">•</span>
                                  <span className="text-gray-700">{changeItem}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* 기준 스키마와 대상 스키마 비교 */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h6 className="font-medium text-blue-700 text-sm mb-2">기준 버전 스키마</h6>
                              <div 
                                className="bg-blue-50 border border-blue-200 rounded p-3 text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ 
                                  __html: highlightJsonDifferences(change.details.baseSchema, change.details.targetSchema).base 
                                }}
                              />
                            </div>
                            <div>
                              <h6 className="font-medium text-green-700 text-sm mb-2">대상 버전 스키마</h6>
                              <div 
                                className="bg-green-50 border border-green-200 rounded p-3 text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ 
                                  __html: highlightJsonDifferences(change.details.baseSchema, change.details.targetSchema).target 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <pre className={`p-3 rounded text-xs overflow-auto ${
                          change.type === 'new' 
                            ? 'bg-green-50' 
                            : change.type === 'deprecated' 
                            ? 'bg-red-50'
                            : 'bg-yellow-50'
                        }`}>
                          <code>{JSON.stringify(change.details, null, 2)}</code>
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Operation 상세 비교 */}
                  {selectedOperation && selectedOperation.operationId === change.operationId && (
                    <div className={`mt-4 pt-4 border-t ${
                      change.type === 'new' 
                        ? 'border-green-200' 
                        : change.type === 'deprecated' 
                        ? 'border-red-200'
                        : 'border-yellow-200' // changed path, changed param, changed model
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900">Operation 상세 비교: {selectedOperation.operationId}</h5>
                        <button
                          onClick={() => setSelectedOperation(null)}
                          className="text-gray-400 hover:text-gray-600 text-sm"
                        >
                          ✕ 닫기
                        </button>
                      </div>
                      
                      {isLoadingOperation ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-600">Operation 내용을 분석하는 중...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {/* 기준 버전 Operation */}
                          <div className="space-y-2">
                            <h6 className="font-medium text-blue-700 text-sm">기준 버전 ({comparisonResult.comparison.baseVersion})</h6>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              {selectedOperation.baseContent ? (
                                <div className="space-y-2 text-xs">
                                  <div><strong>경로:</strong> <span className="font-mono">{selectedOperation.baseContent.path}</span></div>
                                  <div><strong>메소드:</strong> <span className="uppercase">{selectedOperation.baseContent.method}</span></div>
                                  <div><strong>요약:</strong> {selectedOperation.baseContent.summary || 'N/A'}</div>
                                  <div><strong>설명:</strong> {selectedOperation.baseContent.description || 'N/A'}</div>
                                  {selectedOperation.baseContent.parameters && (
                                    <div>
                                      <strong>파라미터:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.baseContent.parameters, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {selectedOperation.baseContent.responses && (
                                    <div>
                                      <strong>응답:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.baseContent.responses, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-500 text-center py-4">
                                  <div className="text-sm font-medium text-gray-600 mb-2">신규 기능</div>
                                  <div className="text-xs text-gray-500">기준 버전에는 존재하지 않는 새로운 기능입니다.</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 대상 버전 Operation */}
                          <div className="space-y-2">
                            <h6 className="font-medium text-green-700 text-sm">대상 버전 ({comparisonResult.comparison.targetVersion})</h6>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              {selectedOperation.targetContent ? (
                                <div className="space-y-2 text-xs">
                                  <div><strong>경로:</strong> <span className="font-mono">{selectedOperation.targetContent.path}</span></div>
                                  <div><strong>메소드:</strong> <span className="uppercase">{selectedOperation.targetContent.method}</span></div>
                                  <div><strong>요약:</strong> {selectedOperation.targetContent.summary || 'N/A'}</div>
                                  <div><strong>설명:</strong> {selectedOperation.targetContent.description || 'N/A'}</div>
                                  {selectedOperation.targetContent.parameters && (
                                    <div>
                                      <strong>파라미터:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.targetContent.parameters, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {selectedOperation.targetContent.responses && (
                                    <div>
                                      <strong>응답:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.targetContent.responses, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-500 text-center py-4">
                                  <div className="text-sm font-medium text-gray-600 mb-2">사용 중단</div>
                                  <div className="text-xs text-gray-500">대상 버전에서는 제거된 기능입니다.</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 병렬 비교 */}
          {viewMode === 'side-by-side' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">병렬 비교</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-blue-700 mb-3">기준 버전 ({comparisonResult.comparison.baseVersion})</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <pre className="text-xs overflow-auto">{JSON.stringify(comparisonResult.comparison.baseFile, null, 2)}</pre>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-green-700 mb-3">대상 버전 ({comparisonResult.comparison.targetVersion})</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <pre className="text-xs overflow-auto">{JSON.stringify(comparisonResult.comparison.targetFile, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 기존 모달 렌더링 (isEmbedded가 false일 때)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">버전 비교 상세 결과</h2>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span><strong>Repository:</strong> {comparisonResult.repository}</span>
                <span><strong>기준 버전:</strong> {comparisonResult.comparison.baseVersion}</span>
                <span><strong>대상 버전:</strong> {comparisonResult.comparison.targetVersion}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span><strong>총 변경사항:</strong> {comparisonResult.summary.total}개</span>
                <span><strong>신규:</strong> {comparisonResult.summary.new}개</span>
                <span><strong>변경:</strong> {comparisonResult.summary.changed}개</span>
                <span><strong>사용 중단:</strong> {comparisonResult.summary.deprecated}개</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">보기 모드:</label>
              <select
                value={viewMode}
                onChange={(e) => {
                  const newViewMode = e.target.value as any;
                  setViewMode(newViewMode);
                  // 파일 내용 비교 모드로 변경 시 검색어와 필터 초기화
                  if (newViewMode === 'file-compare') {
                    setSearchTerm('');
                    setFilterType('all');
                  }
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="summary">요약 보기</option>
                <option value="changes">변경사항 목록</option>
                <option value="side-by-side">병렬 비교</option>
                <option value="file-compare">파일 내용 비교</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">카테고리:</label>
              <select
                value={viewCategory}
                onChange={(e) => setViewCategory(e.target.value as 'all' | 'operations' | 'models')}
                disabled={viewMode === 'file-compare'}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  viewMode === 'file-compare' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              >
                <option value="all">전체</option>
                <option value="operations">API 엔드포인트</option>
                <option value="models">데이터 모델</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">필터:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                disabled={viewMode === 'file-compare'}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  viewMode === 'file-compare' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              >
                <option value="all">전체</option>
                <option value="new">신규</option>
                <option value="changed_path">경로 변경</option>
                <option value="changed_param">파라미터 변경</option>
                <option value="changed_model">모델 변경</option>
                <option value="deprecated">사용 중단</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">검색:</label>
              <input
                type="text"
                placeholder="operationId, 경로, 설명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={viewMode === 'file-compare'}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  viewMode === 'file-compare' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {viewMode === 'file-compare' ? 
                '파일 내용 비교 모드' : 
                `${filteredChanges.length} / ${comparisonResult.changes.length} 항목`
              }
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'summary' && (
            <div className="space-y-6">
              {/* 전체 요약 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">전체 변경사항 요약</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.total}</div>
                    <div className="text-sm text-gray-800">총 변경사항</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.new}</div>
                    <div className="text-sm text-green-800">새로운 항목</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.changed}</div>
                    <div className="text-sm text-yellow-800">변경된 항목</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.deprecated}</div>
                    <div className="text-sm text-red-800">삭제된 항목</div>
                  </div>
                </div>
              </div>

              {/* Operation 요약 */}
              {comparisonResult.summary.operations && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">API 엔드포인트 변경사항</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.operations.total}</div>
                      <div className="text-sm text-gray-800">총 변경사항</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.operations.new}</div>
                      <div className="text-sm text-green-800">새로운 기능</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.operations.changed}</div>
                      <div className="text-sm text-yellow-800">변경된 기능</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.operations.deprecated}</div>
                      <div className="text-sm text-red-800">삭제된 기능</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Model 요약 */}
              {comparisonResult.summary.models && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">데이터 모델 변경사항</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{comparisonResult.summary.models.total}</div>
                      <div className="text-sm text-gray-800">총 변경사항</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{comparisonResult.summary.models.new}</div>
                      <div className="text-sm text-green-800">새로운 모델</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{comparisonResult.summary.models.changed}</div>
                      <div className="text-sm text-yellow-800">변경된 모델</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{comparisonResult.summary.models.deprecated}</div>
                      <div className="text-sm text-red-800">삭제된 모델</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 상세 통계 */}
              {comparisonResult.details && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
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

              {/* 변경 유형별 분포 */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">변경 유형별 분포</h4>
                <div className="space-y-2">
                  {Object.entries(comparisonResult.changes.reduce((acc, change) => {
                    acc[change.type] = (acc[change.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span>{getChangeIcon(type)}</span>
                        <span className="text-sm font-medium text-gray-700">{getChangeTypeLabel(type)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full" 
                            style={{ 
                              width: `${(count / comparisonResult.summary.total) * 100}%`,
                              backgroundColor: type === 'new' ? '#10b981' : 
                                            type === 'changed_path' ? '#3b82f6' : 
                                            type === 'changed_param' ? '#f59e0b' : 
                                            type === 'changed_model' ? '#8b5cf6' : '#ef4444'
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'changes' && (
            <div className="space-y-4">
              {filteredChanges.map((change, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedChange(selectedChange === change ? null : change)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedChange === change 
                      ? 'ring-2 ring-blue-500 shadow-lg' 
                      : 'hover:shadow-md'
                  } ${
                    // 변경 타입에 따른 배경색 적용
                    change.type === 'new' 
                      ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                      : change.type === 'deprecated' 
                      ? 'bg-red-50 border-red-200 hover:bg-red-100'
                      : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' // changed path, changed param, changed model
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          change.type === 'new' 
                            ? 'bg-green-100 text-green-600' 
                            : change.type === 'deprecated' 
                            ? 'bg-red-100 text-red-600'
                            : 'bg-yellow-100 text-yellow-600' // changed path, changed param, changed model
                        }`}>
                          {getChangeIcon(change.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              change.type === 'new' 
                                ? 'bg-green-100 text-green-800' 
                                : change.type === 'deprecated' 
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800' // changed path, changed param, changed model
                            }`}>
                              {getChangeTypeLabel(change.type)}
                            </span>
                            {change.type && change.type !== 'new' && change.type !== 'deprecated' && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                변경된 기능
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{change.method?.toUpperCase() || 'N/A'}</span>
                          <span className="text-sm text-gray-600 font-mono">{change.path || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <strong>{change.path ? 'Operation ID:' : 'Model:'}</strong> 
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            
                            // 신규 항목인 경우
                            if (change.type === 'new') {
                              setSelectedOperation({
                                operationId: change.operationId || '',
                                baseContent: null, // 신규이므로 기준 버전에 없음
                                targetContent: {
                                  path: change.newPath || change.path || 'N/A',
                                  method: change.method || 'N/A',
                                  summary: change.description || 'N/A',
                                  description: change.description || 'N/A'
                                }
                              });
                              return;
                            }
                            
                            // 사용 중단 항목인 경우
                            if (change.type === 'deprecated') {
                              setSelectedOperation({
                                operationId: change.operationId || '',
                                baseContent: {
                                  path: change.oldPath || change.path || 'N/A',
                                  method: change.method || 'N/A',
                                  summary: change.description || 'N/A',
                                  description: change.description || 'N/A'
                                },
                                targetContent: null // 사용 중단이므로 대상 버전에 없음
                              });
                              return;
                            }
                            
                            // isEmbedded 모드에서는 파일 내용 로드 없이 바로 Operation 상세 내용 표시
                            if (isEmbedded) {
                              // 간단한 Operation 정보로 상세 내용 구성
                              setSelectedOperation({
                                operationId: change.operationId || '',
                                baseContent: {
                                  path: change.oldPath || change.path || 'N/A',
                                  method: change.method || 'N/A',
                                  summary: change.description || 'N/A',
                                  description: change.description || 'N/A'
                                },
                                targetContent: {
                                  path: change.newPath || change.path || 'N/A',
                                  method: change.method || 'N/A',
                                  summary: change.description || 'N/A',
                                  description: change.description || 'N/A'
                                }
                              });
                            } else {
                              // 기존 모달 모드에서는 파일 내용 로드
                              if (baseFileContent && targetFileContent) {
                                loadOperationDetails(change.operationId || '');
                              } else {
                                alert('파일 내용을 먼저 로드해주세요. "파일 내용 비교" 모드를 먼저 선택하세요.');
                              }
                            }
                          }}
                          className="ml-2 text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          title={isEmbedded ? "클릭하여 Operation 상세 내용 보기" : "클릭하여 두 버전의 operation 상세 내용 비교"}
                        >
                          {change.operationId || 'N/A'}
                        </button>
                      </div>
                      <div className={`text-sm mb-2 ${
                        change.type === 'new' 
                          ? 'text-green-700' 
                          : change.type === 'deprecated' 
                          ? 'text-red-700'
                          : 'text-yellow-700' // changed path, changed param, changed model
                      }`}>
                        {change.description || '설명 없음'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {index + 1}
                    </div>
                  </div>
                  
                  {/* 선택된 변경사항의 상세 정보 */}
                  {selectedChange === change && change.details && (
                    <div className={`mt-4 pt-4 border-t ${
                      change.type === 'new' 
                        ? 'border-green-200' 
                        : change.type === 'deprecated' 
                        ? 'border-red-200'
                        : 'border-yellow-200' // changed path, changed param, changed model
                    }`}>
                      <h5 className="font-medium text-gray-900 mb-2">상세 변경사항</h5>
                      
                      {/* 모델 변경 상세 내용 */}
                      {change.type === 'changed_model' && change.details.changes && change.details.changes.length > 0 ? (
                        <div className="space-y-3">
                          <div className="p-3 rounded bg-yellow-50">
                            <h6 className="font-medium text-gray-800 mb-2">변경 내용:</h6>
                            <ul className="space-y-1 text-sm">
                              {change.details.changes.map((changeItem: string, index: number) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-blue-600 mr-2">•</span>
                                  <span className="text-gray-700">{changeItem}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* 기준 스키마와 대상 스키마 비교 */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h6 className="font-medium text-blue-700 text-sm mb-2">기준 버전 스키마</h6>
                              <div 
                                className="bg-blue-50 border border-blue-200 rounded p-3 text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ 
                                  __html: highlightJsonDifferences(change.details.baseSchema, change.details.targetSchema).base 
                                }}
                              />
                            </div>
                            <div>
                              <h6 className="font-medium text-green-700 text-sm mb-2">대상 버전 스키마</h6>
                              <div 
                                className="bg-green-50 border border-green-200 rounded p-3 text-xs overflow-auto max-h-40 font-mono whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ 
                                  __html: highlightJsonDifferences(change.details.baseSchema, change.details.targetSchema).target 
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <pre className={`p-3 rounded text-xs overflow-auto ${
                          change.type === 'new' 
                            ? 'bg-green-50' 
                            : change.type === 'deprecated' 
                            ? 'bg-red-50'
                            : 'bg-yellow-50'
                        }`}>
                          <code>{JSON.stringify(change.details, null, 2)}</code>
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Operation 상세 비교 */}
                  {selectedOperation && selectedOperation.operationId === change.operationId && (
                    <div className={`mt-4 pt-4 border-t ${
                      change.type === 'new' 
                        ? 'border-green-200' 
                        : change.type === 'deprecated' 
                        ? 'border-red-200'
                        : 'border-yellow-200' // changed path, changed param, changed model
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900">Operation 상세 비교: {selectedOperation.operationId}</h5>
                        <button
                          onClick={() => setSelectedOperation(null)}
                          className="text-gray-400 hover:text-gray-600 text-sm"
                        >
                          ✕ 닫기
                        </button>
                      </div>
                      
                      {isLoadingOperation ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-600">Operation 내용을 분석하는 중...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {/* 기준 버전 Operation */}
                          <div className="space-y-2">
                            <h6 className="font-medium text-blue-700 text-sm">기준 버전 ({comparisonResult.comparison.baseVersion})</h6>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              {selectedOperation.baseContent ? (
                                <div className="space-y-2 text-xs">
                                  <div><strong>경로:</strong> <span className="font-mono">{selectedOperation.baseContent.path}</span></div>
                                  <div><strong>메소드:</strong> <span className="uppercase">{selectedOperation.baseContent.method}</span></div>
                                  <div><strong>요약:</strong> {selectedOperation.baseContent.summary || 'N/A'}</div>
                                  <div><strong>설명:</strong> {selectedOperation.baseContent.description || 'N/A'}</div>
                                  {selectedOperation.baseContent.parameters && (
                                    <div>
                                      <strong>파라미터:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.baseContent.parameters, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {selectedOperation.baseContent.responses && (
                                    <div>
                                      <strong>응답:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.baseContent.responses, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-500 text-center py-4">
                                  <div className="text-sm font-medium text-gray-600 mb-2">신규 기능</div>
                                  <div className="text-xs text-gray-500">기준 버전에는 존재하지 않는 새로운 기능입니다.</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 대상 버전 Operation */}
                          <div className="space-y-2">
                            <h6 className="font-medium text-green-700 text-sm">대상 버전 ({comparisonResult.comparison.targetVersion})</h6>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              {selectedOperation.targetContent ? (
                                <div className="space-y-2 text-xs">
                                  <div><strong>경로:</strong> <span className="font-mono">{selectedOperation.targetContent.path}</span></div>
                                  <div><strong>메소드:</strong> <span className="uppercase">{selectedOperation.targetContent.method}</span></div>
                                  <div><strong>요약:</strong> {selectedOperation.targetContent.summary || 'N/A'}</div>
                                  <div><strong>설명:</strong> {selectedOperation.targetContent.description || 'N/A'}</div>
                                  {selectedOperation.targetContent.parameters && (
                                    <div>
                                      <strong>파라미터:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.targetContent.parameters, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {selectedOperation.targetContent.responses && (
                                    <div>
                                      <strong>응답:</strong>
                                      <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto">
                                        {JSON.stringify(selectedOperation.targetContent.responses, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-gray-500 text-center py-4">
                                  <div className="text-sm font-medium text-gray-600 mb-2">사용 중단</div>
                                  <div className="text-xs text-gray-500">대상 버전에서는 제거된 기능입니다.</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {viewMode === 'side-by-side' && (
            <div className="grid grid-cols-2 gap-6">
              {/* 기준 버전 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-center">기준 버전: {comparisonResult.comparison.baseVersion}</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-700 mb-2">파일 정보</h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><strong>경로:</strong> {comparisonResult.comparison.baseFile?.path || 'N/A'}</div>
                    <div><strong>크기:</strong> {comparisonResult.comparison.baseFile?.size ? `${(comparisonResult.comparison.baseFile.size / 1024).toFixed(1)} KB` : 'N/A'}</div>
                    <div><strong>SHA:</strong> {comparisonResult.comparison.baseFile?.sha?.substring(0, 8) || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* 대상 버전 */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 text-center">대상 버전: {comparisonResult.comparison.targetVersion}</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-700 mb-2">파일 정보</h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><strong>경로:</strong> {comparisonResult.comparison.targetFile?.path || 'N/A'}</div>
                    <div><strong>크기:</strong> {comparisonResult.comparison.targetFile?.size ? `${(comparisonResult.comparison.targetFile.size / 1024).toFixed(1)} KB` : 'N/A'}</div>
                    <div><strong>SHA:</strong> {comparisonResult.comparison.targetFile?.sha?.substring(0, 8) || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* 변경사항 요약 */}
              <div className="col-span-2">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3">주요 변경사항 요약</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">{comparisonResult.summary.new}</div>
                      <div className="text-sm text-green-700">신규 추가</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{comparisonResult.summary.changed}</div>
                      <div className="text-sm text-blue-700">변경됨</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-lg font-bold text-red-600">{comparisonResult.summary.deprecated}</div>
                      <div className="text-sm text-red-700">사용 중단</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-lg font-bold text-purple-600">{comparisonResult.summary.total}</div>
                      <div className="text-sm text-purple-700">총 변경</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'file-compare' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h4 className="text-lg font-medium text-gray-900">파일 내용 직접 비교</h4>
                <p className="text-sm text-gray-600">두 버전의 Swagger 파일 내용을 나란히 비교합니다</p>
              </div>
              
              {isLoadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">파일 내용을 로드하는 중...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {/* 기준 버전 파일 내용 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">기준 버전: {comparisonResult.comparison.baseVersion}</h5>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {comparisonResult.comparison.baseFile?.path}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                        <span className="text-xs font-medium text-gray-700">파일 내용</span>
                      </div>
                      <pre className="p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                        <code className="text-gray-800">{baseFileContent || '파일 내용을 불러올 수 없습니다.'}</code>
                      </pre>
                    </div>
                  </div>

                  {/* 대상 버전 파일 내용 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-gray-900">대상 버전: {comparisonResult.comparison.targetVersion}</h5>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {comparisonResult.comparison.targetFile?.path}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                        <span className="text-xs font-medium text-gray-700">파일 내용</span>
                      </div>
                      <pre className="p-4 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                        <code className="text-gray-800">{targetFileContent || '파일 내용을 불러올 수 없습니다.'}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-medium">선택된 변경사항:</span>
              <span className="ml-2 font-mono bg-gray-200 px-2 py-1 rounded">
                {selectedChange ? `${selectedChange.type} - ${selectedChange.operationId}` : '없음'}
              </span>
            </div>
            <div>
              <span className="font-medium">비교 도구:</span>
              <span className="ml-2">{comparisonResult.metadata?.tool || 'SwaggerCompareService'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
