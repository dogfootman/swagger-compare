import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // Docker 빌드 시 ESLint 오류 무시
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Docker 빌드 시 TypeScript 오류 무시
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  env: {
    PORT: process.env.PORT || '3000',
    HOST: process.env.HOST || '0.0.0.0',
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
