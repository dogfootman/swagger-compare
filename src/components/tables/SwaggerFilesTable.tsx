'use client';

import { useState } from 'react';
import { SwaggerFileViewer } from '@/components/modals/SwaggerFileViewer';

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
  searchPaths?: string[];
}

interface SwaggerFilesTableProps {
  result: SwaggerDiscoveryResult | null;
  isLoading: boolean;
  error: string | null;
  owner: string;
  name: string;
}

export const SwaggerFilesTable: React.FC<SwaggerFilesTableProps> = ({ 
  result, 
  isLoading, 
  error, 
  owner, 
  name 
}) => {
  const [viewerFile, setViewerFile] = useState<{ 
    path: string; 
    content: string; 
    version: string; 
    commitHash: string; 
  } | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleViewFile = async (filePath: string, version: string, commitHash: string) => {
    try {
      console.log(`[SwaggerFilesTable] Fetching file content for: ${filePath} in version ${version}`);
      console.log(`[SwaggerFilesTable] File object structure:`, result?.swaggerFiles[version]?.[0]);
      
      const response = await fetch(`/api/github/swagger/content?owner=${encodeURIComponent(owner)}&name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          path: filePath, 
          version: version, 
          commitHash: commitHash 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[SwaggerFilesTable] File content fetched successfully: ${data.content.length} characters`);
        
        setViewerFile({
          path: filePath,
          content: data.content,
          version: version,
          commitHash: commitHash
        });
        setIsViewerOpen(true);
      } else {
        const errorData = await response.json();
        console.error(`[SwaggerFilesTable] Failed to fetch file content:`, errorData);
        alert(`파일 내용을 가져오는데 실패했습니다: ${errorData.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error(`[SwaggerFilesTable] Error fetching file content:`, error);
      alert('파일 내용을 가져오는 중 오류가 발생했습니다.');
    }
  };

  const closeViewer = () => {
    setIsViewerOpen(false);
    setViewerFile(null);
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Swagger 파일을 검색하는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">검색 오류</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  // 디버깅: 파일 객체 구조 확인
  console.log('[SwaggerFilesTable] Result structure:', result);
  console.log('[SwaggerFilesTable] Swagger files structure:', result.swaggerFiles);
  if (result.versions.length > 0) {
    const firstVersion = result.versions[0];
    const firstFiles = result.swaggerFiles[firstVersion.name] || [];
    console.log(`[SwaggerFilesTable] First version (${firstVersion.name}) files:`, firstFiles);
    if (firstFiles.length > 0) {
      console.log('[SwaggerFilesTable] First file object:', firstFiles[0]);
      console.log('[SwaggerFilesTable] First file keys:', Object.keys(firstFiles[0]));
    }
  }

  // Swagger 파일이 없는 경우 메시지 표시
  if (result.summary.totalSwaggerFiles === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center space-x-2">
            <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Swagger 파일을 찾을 수 없습니다</h3>
              <p className="text-sm text-yellow-700 mt-1">
                검색한 경로에서 Swagger/OpenAPI 파일을 찾을 수 없습니다.
                <br />
                검색 경로: {result.searchPaths?.join(', ') || '기본 경로'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 버전별 Swagger 파일 목록 */}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  버전
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  타입
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  파일 경로
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  커밋 해시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {result.versions.map((version) => {
                const files = result.swaggerFiles[version.name] || [];
                return files.map((file, fileIndex) => {
                  // GitHub API 응답 구조에 따라 안전하게 속성 접근
                  const fileSha = file.sha || file.commitHash || file.commit?.sha || 'N/A';
                  const filePath = file.path || file.name || 'Unknown';
                  const downloadUrl = file.download_url || file.html_url || file.url || null;
                  
                  return (
                    <tr key={`${version.name}-${fileIndex}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {version.name}
                          </span>
                          {version.isLatest && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              최신
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          version.type === 'branch' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {version.type === 'branch' ? '브랜치' : '태그'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 font-mono">{filePath}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 font-mono">
                          {fileSha !== 'N/A' ? fileSha.substring(0, 8) : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewFile(filePath, version.name, fileSha !== 'N/A' ? fileSha : '')}
                          className="text-indigo-600 hover:text-indigo-900 mr-3 px-3 py-1 border border-indigo-300 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          📄 보기
                        </button>
                        {downloadUrl && (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-900 px-3 py-1 border border-green-300 rounded-md hover:bg-green-50 transition-colors"
                          >
                            ⬇️ 다운로드
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

      {/* 향상된 Swagger 파일 뷰어 */}
      {viewerFile && (
        <SwaggerFileViewer
          isOpen={isViewerOpen}
          onClose={closeViewer}
          filePath={viewerFile.path}
          fileContent={viewerFile.content}
          version={viewerFile.version}
          commitHash={viewerFile.commitHash}
        />
      )}
    </div>
  );
};
