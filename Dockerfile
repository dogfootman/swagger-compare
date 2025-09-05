FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat

# Install oasdiff
RUN wget -O /tmp/oasdiff.tar.gz https://github.com/Tufin/oasdiff/releases/latest/download/oasdiff_linux_amd64.tar.gz \
    && tar -xzf /tmp/oasdiff.tar.gz -C /tmp \
    && mv /tmp/oasdiff /usr/local/bin/ \
    && chmod +x /usr/local/bin/oasdiff \
    && rm /tmp/oasdiff.tar.gz

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy oasdiff from deps stage
COPY --from=deps /usr/local/bin/oasdiff /usr/local/bin/oasdiff

# Copy the public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create cache directories
RUN mkdir -p /app/swagger-cache /app/temp-files
RUN chown nextjs:nodejs /app/swagger-cache /app/temp-files

USER nextjs

# 포트를 환경변수로 설정
EXPOSE ${PORT:-3000}

# 환경변수 기본값 설정
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", "server.js"]
