FROM node:18-alpine AS base

# 빌드 인수 설정
ARG OASDIFF_VERSION=1.11.7
ARG NEXT_PUBLIC_APP_NAME=API Compare Tool
ARG NEXT_PUBLIC_APP_VERSION=1.0.0

# 의존성 설치 단계
FROM base AS deps
RUN apk add --no-cache libc6-compat wget

# oasdiff 도구 설치 (특정 버전 및 오류 처리 개선)
RUN OASDIFF_VERSION=1.11.7 && \
    wget -O /tmp/oasdiff.tar.gz "https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz" \
    && tar -xzf /tmp/oasdiff.tar.gz -C /tmp \
    && mv /tmp/oasdiff /usr/local/bin/ \
    && chmod +x /usr/local/bin/oasdiff \
    && rm /tmp/oasdiff.tar.gz \
    && oasdiff --version

WORKDIR /app

# 패키지 매니저를 사용한 의존성 설치
COPY package.json package-lock.json* ./
RUN npm ci

# 소스 코드 빌드 단계
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시점 환경변수 설정
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

RUN npm run build

# 프로덕션 이미지 - 모든 파일을 복사하고 Next.js 실행
FROM base AS runner
WORKDIR /app

# 런타임 환경변수 설정
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOST=0.0.0.0

# GitHub API 설정
ENV GITHUB_API_URL=https://api.github.com
ENV GITHUB_USER_AGENT=API-Compare-Tool

# 애플리케이션 설정
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

# 시스템 사용자 및 그룹 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# deps 단계에서 oasdiff 복사
COPY --from=deps /usr/local/bin/oasdiff /usr/local/bin/oasdiff

# public 폴더 복사
COPY --from=builder /app/public ./public

# prerender 캐시 및 캐시 디렉토리 생성 및 권한 설정
RUN mkdir -p .next /app/swagger-cache /app/temp-files \
    && chown -R nextjs:nodejs .next /app/swagger-cache /app/temp-files

# 이미지 크기 최적화를 위한 output traces 활용
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# nextjs 사용자로 전환
USER nextjs

# 포트 노출 (환경변수 설정 후)
EXPOSE ${PORT}

# 애플리케이션 실행
CMD ["node", "server.js"]
