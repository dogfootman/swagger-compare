'use client';

import { TokenProvider } from '@/components/TokenProvider';
import { RepositoryForm } from '@/components/forms/RepositoryForm';

export default function HomePage() {
  return (
    <TokenProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              API Compare Tool
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              GitHub repository의 Swagger 파일들을 비교하여 API 버전별 변경사항을 분석합니다
            </p>
          </div>
          
          <RepositoryForm />
        </div>
      </div>
    </TokenProvider>
  );
}
