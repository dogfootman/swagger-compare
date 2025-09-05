'use client';

import { useState } from 'react';

interface GitHubTokenFormProps {
  onTokenSaved: () => void;
  onSkip?: () => void;
}

export const GitHubTokenForm: React.FC<GitHubTokenFormProps> = ({ 
  onTokenSaved, 
  onSkip 
}) => {
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
    username?: string;
  } | null>(null);
  
  const validateToken = async () => {
    if (!token.trim()) return;
    
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const response = await fetch('/api/github/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const result = await response.json();
      
      if (result.isValid) {
        setValidationResult({
          isValid: true,
          message: `✅ ${result.username}님의 토큰이 유효합니다`,
          username: result.username
        });
      } else {
        setValidationResult({
          isValid: false,
          message: '❌ 토큰이 유효하지 않습니다. 다시 확인해주세요.'
        });
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: '❌ 토큰 검증 중 오류가 발생했습니다.'
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  const handleSaveToken = async () => {
    if (!validationResult?.isValid) return;
    
    try {
      // 서버에 토큰 저장
      await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      onTokenSaved();
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: '❌ 토큰 저장에 실패했습니다.'
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="token" className="block text-sm font-medium text-gray-700">
          Personal Access Token
        </label>
        <div className="mt-1 relative">
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          <a 
            href="https://github.com/settings/tokens" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-500"
          >
            GitHub에서 토큰 생성하기
          </a>
        </p>
      </div>
      
      <div className="flex space-x-3">
        <button
          onClick={validateToken}
          disabled={!token.trim() || isValidating}
          className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating ? '검증 중...' : '토큰 검증'}
        </button>
        
        {onSkip && (
          <button
            onClick={onSkip}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            나중에
          </button>
        )}
      </div>
      
      {validationResult && (
        <div className={`p-3 rounded-md ${
          validationResult.isValid 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          <p className="text-sm">{validationResult.message}</p>
        </div>
      )}
      
      {validationResult?.isValid && (
        <button
          onClick={handleSaveToken}
          className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          토큰 저장하고 시작하기
        </button>
      )}
      
      <div className="bg-blue-50 p-4 rounded-md">
        <h4 className="text-sm font-medium text-blue-800">토큰이 필요한 이유</h4>
        <ul className="mt-2 text-sm text-blue-700 space-y-1">
          <li>• GitHub 저장소의 Swagger 파일에 접근</li>
          <li>• API 버전별 변경사항 분석</li>
          <li>• Rate limiting 우회 (인증된 요청)</li>
        </ul>
      </div>
    </div>
  );
};
