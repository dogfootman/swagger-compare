'use client';

import { useState, useEffect } from 'react';

interface SwaggerFileViewerProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  fileContent: string;
  version: string;
  commitHash: string;
}

export const SwaggerFileViewer: React.FC<SwaggerFileViewerProps> = ({ 
  isOpen, 
  onClose, 
  filePath, 
  fileContent, 
  version, 
  commitHash 
}) => {
  const [parsedContent, setParsedContent] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'raw' | 'parsed' | 'yaml' | 'tree'>('parsed');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fileContent) {
      parseFileContent();
    }
  }, [isOpen, fileContent]);

  const parseFileContent = async () => {
    setIsLoading(true);
    setParseError(null);
    
    try {
      if (fileContent.includes('openapi:') || fileContent.includes('swagger:')) {
        // YAML 파일인 경우
        // @ts-ignore
        const yaml = await import('js-yaml');
        const parsed = yaml.load(fileContent);
        setParsedContent(parsed);
      } else if (fileContent.trim().startsWith('{')) {
        // JSON 파일인 경우
        const parsed = JSON.parse(fileContent);
        setParsedContent(parsed);
      } else {
        throw new Error('지원되지 않는 파일 형식입니다.');
      }
    } catch (error) {
      console.error('파일 파싱 오류:', error);
      setParseError(error instanceof Error ? error.message : '파싱 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = (nodePath: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodePath)) {
      newExpanded.delete(nodePath);
    } else {
      newExpanded.add(nodePath);
    }
    setExpandedNodes(newExpanded);
  };

  const renderTreeView = (obj: any, path: string[] = []): React.ReactElement[] => {
    const elements: React.ReactElement[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      const nodePath = currentPath.join('.');
      const isExpanded = expandedNodes.has(nodePath);
      const isSelected = selectedNode === nodePath;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // 객체인 경우
        elements.push(
          <div key={nodePath} className="ml-4">
            <div 
              className={`flex items-center cursor-pointer hover:bg-gray-100 p-1 rounded ${
                isSelected ? 'bg-blue-100' : ''
              }`}
              onClick={() => {
                toggleNode(nodePath);
                setSelectedNode(nodePath);
              }}
            >
              <span className="mr-2 text-gray-500">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="font-medium text-gray-700">{key}</span>
              <span className="ml-2 text-xs text-gray-500">object</span>
            </div>
            {isExpanded && (
              <div className="ml-4">
                {renderTreeView(value, currentPath)}
              </div>
            )}
          </div>
        );
      } else if (Array.isArray(value)) {
        // 배열인 경우
        elements.push(
          <div key={nodePath} className="ml-4">
            <div 
              className={`flex items-center cursor-pointer hover:bg-gray-100 p-1 rounded ${
                isSelected ? 'bg-blue-100' : ''
              }`}
              onClick={() => {
                toggleNode(nodePath);
                setSelectedNode(nodePath);
              }}
            >
              <span className="mr-2 text-gray-500">
                {isExpanded ? '▼' : '▶'}
              </span>
              <span className="font-medium text-gray-700">{key}</span>
              <span className="ml-2 text-xs text-gray-500">array[{value.length}]</span>
            </div>
            {isExpanded && (
              <div className="ml-4">
                {value.map((item, index) => (
                  <div key={`${nodePath}[${index}]`} className="ml-4">
                    <span className="text-gray-600">[{index}]: </span>
                    {typeof item === 'object' && item !== null ? (
                      renderTreeView(item, [...currentPath, index.toString()])
                    ) : (
                      <span className="text-gray-800">{String(item)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      } else {
        // 기본 값인 경우
        elements.push(
          <div 
            key={nodePath} 
            className={`ml-4 p-1 rounded cursor-pointer ${
              selectedNode === nodePath ? 'bg-blue-100' : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedNode(nodePath)}
          >
            <span className="font-medium text-gray-700">{key}: </span>
            <span className="text-gray-800">
              {value === null ? 'null' : 
               value === undefined ? 'undefined' : 
               typeof value === 'string' ? `"${value}"` : String(value)}
            </span>
            <span className="ml-2 text-xs text-gray-500">({typeof value})</span>
          </div>
        );
      }
    }
    
    return elements;
  };

  const renderParsedContent = (obj: any): React.ReactElement => {
    if (!obj) return <div className="text-gray-500">파싱된 내용이 없습니다.</div>;
    
    return (
      <div className="space-y-2">
        {renderTreeView(obj)}
      </div>
    );
  };

  const renderYamlContent = (): React.ReactElement => {
    if (!parsedContent) return <div className="text-gray-500">YAML 내용이 없습니다.</div>;
    
    return (
      <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
        <code>{JSON.stringify(parsedContent, null, 2)}</code>
      </pre>
    );
  };

  const renderRawContent = (): React.ReactElement => {
    return (
      <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
        <code>{fileContent}</code>
      </pre>
    );
  };

  const downloadFile = () => {
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filePath.split('/').pop() || 'swagger'}_${version}.${filePath.endsWith('.json') ? 'json' : 'yaml'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFileStats = () => {
    const lines = fileContent.split('\n').length;
    const size = new Blob([fileContent]).size;
    const format = filePath.endsWith('.json') ? 'JSON' : 'YAML';
    
    return { lines, size, format };
  };

  const stats = getFileStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Swagger 파일 내용</h2>
            <div className="mt-2 space-y-1 text-sm text-gray-600">
              <div className="flex items-center space-x-4">
                <span><strong>파일:</strong> {filePath}</span>
                <span><strong>버전:</strong> {version}</span>
                <span><strong>커밋:</strong> {commitHash.substring(0, 8)}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span><strong>형식:</strong> {stats.format}</span>
                <span><strong>라인:</strong> {stats.lines.toLocaleString()}</span>
                <span><strong>크기:</strong> {(stats.size / 1024).toFixed(1)} KB</span>
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
                onChange={(e) => setViewMode(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="parsed">구조화된 보기</option>
                <option value="tree">트리 보기</option>
                <option value="yaml">YAML/JSON</option>
                <option value="raw">원본 텍스트</option>
              </select>
            </div>
            
            {viewMode === 'parsed' && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">검색:</label>
                <input
                  type="text"
                  placeholder="키워드 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadFile}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              다운로드
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">파일을 파싱하는 중...</span>
            </div>
          ) : parseError ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">파싱 오류</h3>
                  <div className="mt-2 text-sm text-red-700">{parseError}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {viewMode === 'parsed' && renderParsedContent(parsedContent)}
              {viewMode === 'tree' && renderTreeView(parsedContent)}
              {viewMode === 'yaml' && renderYamlContent()}
              {viewMode === 'raw' && renderRawContent()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-medium">선택된 노드:</span>
              <span className="ml-2 font-mono bg-gray-200 px-2 py-1 rounded">
                {selectedNode || '없음'}
              </span>
            </div>
            <div>
              <span className="font-medium">확장된 노드:</span>
              <span className="ml-2">{expandedNodes.size}개</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
