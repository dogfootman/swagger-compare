# Docker 사용 가이드

API Compare Tool의 Docker 이미지 빌드 및 실행에 대한 상세한 가이드입니다.

## 📋 목차

- [환경 요구사항](#환경-요구사항)
- [Dockerfile 구조](#dockerfile-구조)
- [이미지 빌드](#이미지-빌드)
- [컨테이너 실행](#컨테이너-실행)
- [Docker Compose 사용](#docker-compose-사용)
- [환경변수 설정](#환경변수-설정)
- [문제 해결](#문제-해결)
- [고급 사용법](#고급-사용법)

## 🔧 환경 요구사항

### 필수 요구사항
- **Docker**: 20.10.0 이상
- **Docker Compose**: 2.0.0 이상 (선택사항)
- **메모리**: 최소 2GB RAM
- **디스크 공간**: 최소 1GB 여유 공간

### 권장 사양
- **Docker**: 24.0.0 이상
- **메모리**: 4GB RAM 이상
- **디스크 공간**: 2GB 이상

## 🏗️ Dockerfile 구조

이 프로젝트는 **Multi-stage build**를 사용하여 최적화된 이미지를 생성합니다.

### 빌드 단계

#### 1. Base Stage
```dockerfile
FROM node:18-alpine AS base
```
- Node.js 18 Alpine Linux 기반
- 모든 단계의 기본 이미지

#### 2. Dependencies Stage (`deps`)
```dockerfile
FROM base AS deps
```
- 시스템 패키지 설치 (`libc6-compat`, `wget`)
- oasdiff 도구 설치
- Node.js 의존성 설치

#### 3. Builder Stage (`builder`)
```dockerfile
FROM base AS builder
```
- 소스 코드 복사
- Next.js 애플리케이션 빌드
- 빌드 시점 환경변수 설정

#### 4. Runner Stage (`runner`)
```dockerfile
FROM base AS runner
```
- 프로덕션 실행 환경
- 최소한의 파일만 포함
- 보안 강화 (non-root 사용자)

## 🚀 이미지 빌드

### 기본 빌드
```bash
# 현재 디렉토리에서 빌드
docker build -t apicompare .

# 빌드 진행 상황 확인
docker build --progress=plain -t apicompare .
```

### 커스텀 빌드 인수 사용
```bash
# oasdiff 버전 지정
docker build \
  --build-arg OASDIFF_VERSION=1.8.0 \
  -t apicompare .

# 앱 정보 커스터마이징
docker build \
  --build-arg NEXT_PUBLIC_APP_NAME="My API Compare" \
  --build-arg NEXT_PUBLIC_APP_VERSION="2.0.0" \
  -t apicompare .
```

### 빌드 캐시 활용
```bash
# 캐시 사용하여 빠른 빌드
docker build --cache-from apicompare:latest -t apicompare .

# 캐시 없이 완전 새로 빌드
docker build --no-cache -t apicompare .
```

## 🐳 컨테이너 실행

### 기본 실행
```bash
# 포트 3000으로 실행
docker run -p 3000:3000 apicompare

# 백그라운드 실행
docker run -d -p 3000:3000 --name apicompare-container apicompare
```

### 환경변수와 함께 실행
```bash
# GitHub 토큰 설정
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=your_github_token_here \
  apicompare

# 포트 변경
docker run -p 8080:8080 \
  -e PORT=8080 \
  apicompare

# 모든 환경변수 설정
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  -e GITHUB_API_URL=https://api.github.com \
  -e GITHUB_USER_AGENT="My-API-Compare-Tool" \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  apicompare
```

### 볼륨 마운트
```bash
# 로그 디렉토리 마운트
docker run -p 3000:3000 \
  -v /host/logs:/app/logs \
  apicompare

# 설정 파일 마운트
docker run -p 3000:3000 \
  -v /host/config:/app/config \
  apicompare
```

## 🐙 Docker Compose 사용

### 기본 실행
```bash
# 백그라운드에서 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 환경변수 파일 사용
```bash
# .env 파일 생성
cat > .env << EOF
GITHUB_TOKEN=your_github_token_here
PORT=3000
GITHUB_API_URL=https://api.github.com
EOF

# 환경변수 파일과 함께 실행
docker-compose --env-file .env up -d
```

### 개발 환경 설정
```bash
# 개발용 docker-compose 실행
docker-compose -f docker-compose.dev.yml up -d
```

## ⚙️ 환경변수 설정

### 필수 환경변수
| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `GITHUB_TOKEN` | - | GitHub Personal Access Token |

### 선택적 환경변수
| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `PORT` | `3000` | 애플리케이션 포트 |
| `HOST` | `0.0.0.0` | 바인딩 호스트 |
| `NODE_ENV` | `production` | Node.js 환경 |
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API URL |
| `GITHUB_USER_AGENT` | `API-Compare-Tool` | GitHub API User Agent |

### 빌드 시점 환경변수
| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `OASDIFF_VERSION` | `1.7.0` | oasdiff 도구 버전 |
| `NEXT_PUBLIC_APP_NAME` | `API Compare Tool` | 애플리케이션 이름 |
| `NEXT_PUBLIC_APP_VERSION` | `1.0.0` | 애플리케이션 버전 |

## 🔍 문제 해결

### 일반적인 문제들

#### 1. 빌드 실패
```bash
# 빌드 로그 확인
docker build --progress=plain -t apicompare . 2>&1 | tee build.log

# 캐시 문제 해결
docker system prune -a
docker build --no-cache -t apicompare .
```

#### 2. oasdiff 설치 실패
```bash
# 네트워크 연결 확인
docker run --rm alpine wget -O- https://github.com

# 수동으로 oasdiff 버전 확인
curl -s https://api.github.com/repos/Tufin/oasdiff/releases/latest
```

#### 3. 포트 충돌
```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :3000

# 다른 포트 사용
docker run -p 8080:8080 -e PORT=8080 apicompare
```

#### 4. 권한 문제
```bash
# 컨테이너 내부 확인
docker exec -it apicompare-container sh

# 파일 권한 확인
ls -la /app/
```

### 로그 확인
```bash
# 컨테이너 로그 확인
docker logs apicompare-container

# 실시간 로그 모니터링
docker logs -f apicompare-container

# 마지막 100줄 로그
docker logs --tail 100 apicompare-container
```

### 컨테이너 상태 확인
```bash
# 실행 중인 컨테이너 목록
docker ps

# 모든 컨테이너 목록
docker ps -a

# 컨테이너 상세 정보
docker inspect apicompare-container
```

## 🚀 고급 사용법

### 프로덕션 배포

#### 1. 이미지 태깅
```bash
# 버전 태그 추가
docker tag apicompare:latest apicompare:v1.0.0

# 레지스트리에 푸시
docker tag apicompare:latest your-registry.com/apicompare:latest
docker push your-registry.com/apicompare:latest
```

#### 2. 헬스체크 설정
```bash
# 헬스체크와 함께 실행
docker run -p 3000:3000 \
  --health-cmd="wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  apicompare
```

#### 3. 리소스 제한
```bash
# 메모리 및 CPU 제한
docker run -p 3000:3000 \
  --memory="1g" \
  --cpus="1.0" \
  apicompare
```

### 개발 환경

#### 1. 개발용 이미지 빌드
```bash
# 개발용 Dockerfile 사용
docker build -f Dockerfile.dev -t apicompare:dev .
```

#### 2. 볼륨 마운트로 개발
```bash
# 소스 코드 마운트
docker run -p 3000:3000 \
  -v $(pwd)/src:/app/src \
  -v $(pwd)/public:/app/public \
  apicompare:dev
```

#### 3. 디버깅
```bash
# 디버그 모드로 실행
docker run -p 3000:3000 \
  -e NODE_ENV=development \
  -e DEBUG=* \
  apicompare
```

### 모니터링

#### 1. 메트릭 수집
```bash
# Prometheus 메트릭 노출
docker run -p 3000:3000 \
  -p 9090:9090 \
  -e ENABLE_METRICS=true \
  apicompare
```

#### 2. 로그 수집
```bash
# 로그 드라이버 설정
docker run -p 3000:3000 \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  apicompare
```

## 📚 추가 리소스

### 유용한 명령어
```bash
# 이미지 크기 확인
docker images apicompare

# 이미지 히스토리 확인
docker history apicompare

# 컨테이너 내부 접속
docker exec -it apicompare-container sh

# 컨테이너 중지 및 제거
docker stop apicompare-container
docker rm apicompare-container

# 이미지 제거
docker rmi apicompare
```

### Docker Compose 명령어
```bash
# 서비스 재시작
docker-compose restart

# 특정 서비스만 재시작
docker-compose restart app

# 서비스 스케일링
docker-compose up -d --scale app=3

# 서비스 상태 확인
docker-compose ps
```

### 성능 최적화
```bash
# 멀티 스테이지 빌드 최적화
docker build --target builder -t apicompare:builder .
docker build --target runner -t apicompare:runner .

# 빌드 캐시 최적화
docker build --cache-from apicompare:builder --target builder -t apicompare:builder .
```

---

## 🆘 지원

문제가 발생하거나 추가 도움이 필요한 경우:

1. **GitHub Issues**: 프로젝트 저장소에 이슈 생성
2. **문서 확인**: README.md 및 기타 문서 참조
3. **로그 분석**: 위의 문제 해결 섹션 참조

---

**API Compare Tool Docker 가이드** - 효율적인 컨테이너 배포를 위한 완벽한 가이드! 🐳
