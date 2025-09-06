'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { GitHubTokenForm } from './forms/GitHubTokenForm';

interface TokenContextType {
  hasToken: boolean;
  isLoading: boolean;
  refreshToken: () => void;
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
        setShowTokenForm(true);
        console.log('[TokenProvider] No token found, showing token form');
      }
    } catch (error) {
      console.error('[TokenProvider] Error checking token status:', error);
      setHasToken(false);
      setShowTokenForm(true);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = () => {
    checkTokenStatus();
  };

  const handleTokenSaved = () => {
    setHasToken(true);
    setShowTokenForm(false);
  };

  const handleSkip = () => {
    setShowTokenForm(false);
    // 토큰 없이도 기본 기능 사용 가능하도록 설정
    setHasToken(false);
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
    <TokenContext.Provider value={{ hasToken, isLoading, refreshToken }}>
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
