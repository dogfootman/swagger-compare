'use client';

import { useState } from 'react';

interface Version {
  name: string;
  type: 'branch' | 'tag';
  isLatest: boolean;
  commitHash: string;
}

interface VersionComparisonFormProps {
  versions: Version[];
  repository: string;
  owner: string;
  name: string;
  onCompare: (baseVersion: string, targetVersion: string, owner: string, name: string, swaggerPath?: string) => void;
  isComparing: boolean;
  swaggerPath?: string;
}

export const VersionComparisonForm: React.FC<VersionComparisonFormProps> = ({
  versions,
  repository,
  owner,
  name,
  onCompare,
  isComparing,
  swaggerPath
}) => {
  // 버전 정렬 (최신 -> 오래된 순)
  const sortedVersions = [...versions].sort((a, b) => {
    if (a.isLatest) return -1;
    if (b.isLatest) return 1;
    
    // 태그 버전인 경우 숫자로 정렬
    if (a.type === 'tag' && b.type === 'tag') {
      const aNum = a.name.replace(/^v/, '');
      const bNum = b.name.replace(/^v/, '');
      return parseFloat(bNum) - parseFloat(aNum);
    }
    
    // 브랜치가 태그보다 앞에
    if (a.type === 'branch' && b.type === 'tag') return -1;
    if (a.type === 'tag' && b.type === 'branch') return 1;
    
    return 0;
  });

  // 기본값 설정: 최신 버전과 이전 버전
  const getDefaultVersions = () => {
    if (sortedVersions.length >= 2) {
      return {
        base: sortedVersions[1].name, // 이전 버전
        target: sortedVersions[0].name // 최신 버전
      };
    }
    return { base: '', target: '' };
  };

  const defaultVersions = getDefaultVersions();
  const [baseVersion, setBaseVersion] = useState<string>(defaultVersions.base);
  const [targetVersion, setTargetVersion] = useState<string>(defaultVersions.target);

  const handleCompare = () => {
    if (!baseVersion || !targetVersion) return;
    console.log('[VersionComparisonForm] 🚀 Starting comparison with swaggerPath:', swaggerPath);
    console.log('[VersionComparisonForm] 📋 Props received:', {
      swaggerPath,
      owner,
      name,
      baseVersion,
      targetVersion
    });
    onCompare(baseVersion, targetVersion, owner, name, swaggerPath);
  };

  const canCompare = () => {
    return baseVersion && targetVersion && baseVersion !== targetVersion;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        버전 비교 설정
      </h3>
      
      <div className="space-y-4">
        {/* 기본값 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-sm text-blue-800">
            <strong>기본 설정:</strong> 최신 버전과 이전 버전이 자동으로 선택됩니다.
            <br />
            필요에 따라 다른 버전을 선택하여 비교할 수 있습니다.
          </p>
        </div>

        {/* 버전 선택 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기준 버전 (이전)
            </label>
            <select
              value={baseVersion}
              onChange={(e) => setBaseVersion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">기준 버전 선택</option>
              {sortedVersions.map((version) => (
                <option key={version.name} value={version.name}>
                  {version.name} {version.isLatest ? '(최신)' : ''} ({version.type})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대상 버전 (이후)
            </label>
            <select
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">대상 버전 선택</option>
              {sortedVersions.map((version) => (
                <option key={version.name} value={version.name}>
                  {version.name} {version.isLatest ? '(최신)' : ''} ({version.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 비교 버튼 */}
        <div className="pt-4">
          <button
            onClick={handleCompare}
            disabled={!canCompare() || isComparing}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isComparing ? '비교 중...' : '버전 비교 시작'}
          </button>
        </div>

      </div>
    </div>
  );
};
