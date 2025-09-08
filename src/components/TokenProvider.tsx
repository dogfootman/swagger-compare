'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { GitHubTokenForm } from './forms/GitHubTokenForm';

interface TokenContextType {
  hasToken: boolean;
  isLoading: boolean;
  refreshToken: () => void;
  showTokenFormForced: () => void;
  hideTokenForm: () => void;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export const TokenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showTokenForm, setShowTokenForm] = useState(false);

  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    setIsLoading(true);

    try {
      // 서버에서 토큰 상태 확인
      const response = await fetch('/api/github/token');
      const { hasToken: serverHasToken, source } = await response.json();

      if (serverHasToken) {
        setHasToken(true);
        setShowTokenForm(false);
        console.log(`[TokenProvider] Token found from: ${source}`);
      } else {
        // 환경변수나 저장된 토큰이 없는 경우
        setHasToken(false);
        // Docker 환경에서는 토큰 설정 화면을 즉시 표시하지 않음
        // repository 검색 실패 시에만 표시하도록 변경
        setShowTokenForm(false);
        console.log('[TokenProvider] No token found, will show form only when needed');
      }
    } catch (error) {
      console.error('[TokenProvider] Error checking token status:', error);
      setHasToken(false);
      setShowTokenForm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = () => {
    checkTokenStatus();
  };

  const handleTokenSaved = () => {
    // 토큰 저장 후 토큰 설정 화면을 닫고 서버에서 토큰 상태를 다시 확인
    setShowTokenForm(false);
    checkTokenStatus();
  };

  const handleSkip = () => {
    setShowTokenForm(false);
    // 토큰 없이도 기본 기능 사용 가능하도록 설정
    setHasToken(false);
  };

  // 토큰 설정 화면을 강제로 표시하는 함수 (repository 검색 실패 시 사용)
  const showTokenFormForced = () => {
    setShowTokenForm(true);
  };

  // 토큰 설정 화면을 닫는 함수
  const hideTokenForm = () => {
    setShowTokenForm(false);
    // 토큰 설정 화면을 닫을 때 토큰 상태를 다시 확인
    checkTokenStatus();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (showTokenForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              GitHub 토큰 설정
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              GitHub API에 접근하기 위한 Personal Access Token이 필요합니다.
            </p>
          </div>

          <GitHubTokenForm
            onTokenSaved={handleTokenSaved}
            onSkip={handleSkip}
          />
        </div>
      </div>
    );
  }

  return (
    <TokenContext.Provider value={{ hasToken, isLoading, refreshToken, showTokenFormForced, hideTokenForm }}>
      {children}
    </TokenContext.Provider>
  );
};

export const useToken = () => {
  const context = useContext(TokenContext);
  if (context === undefined) {
    throw new Error('useToken must be used within a TokenProvider');
  }
  return context;
};
