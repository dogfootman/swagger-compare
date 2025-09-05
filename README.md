# API Compare Tool

GitHub repository의 Swagger 파일들을 비교하여 API 버전별 변경사항을 분석하는 Next.js 웹 애플리케이션입니다.

## 🚀 주요 기능

### 1. GitHub Repository 연동
- **Personal Access Token 기반 인증**
- **하이브리드 토큰 관리**: 환경변수 또는 웹 입력
- **Repository 정보 조회**: 소유자, 이름, 기본 브랜치, 공개/비공개 여부

### 2. 유연한 Repository 입력 방식
- **GitHub URL 입력**: 자동 파싱으로 owner/name 추출
  - `https://github.com/owner/repo`
  - `git@github.com:owner/repo.git`
  - `owner/repo` (간단한 형식)
- **Owner/Name 별도 입력**: 기존 방식 유지

### 3. 보안 및 인증
- **HttpOnly 쿠키**: 토큰을 안전하게 저장
- **토큰 유효성 검증**: GitHub API를 통한 실시간 검증
- **권한 관리**: Private/Public repository 접근 제어

## 🏗️ 기술 스택

### Frontend
- **Next.js 14** (App Router)
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 스타일링
- **React Hooks** - 상태 관리

### Backend
- **Next.js API Routes** - 서버 사이드 로직
- **GitHub API** - Repository 정보 조회
- **oasdiff** - Swagger 파일 비교 (예정)

### 배포
- **Docker** - 컨테이너화
- **Docker Compose** - 로컬 개발 환경
- **Kubernetes** - 프로덕션 배포 (예정)

## 📁 프로젝트 구조

```
apicompare/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 엔드포인트
│   │   │   ├── health/        # Health Check
│   │   │   └── github/        # GitHub API 연동
│   │   │       ├── token/     # 토큰 관리
│   │   │       ├── validate-token/ # 토큰 검증
│   │   │       └── repository/ # Repository 조회
│   │   └── page.tsx           # 메인 페이지
│   ├── components/             # React 컴포넌트
│   │   ├── forms/             # 폼 컴포넌트
│   │   │   ├── GitHubTokenForm.tsx    # GitHub 토큰 입력
│   │   │   └── RepositoryForm.tsx     # Repository 검색
│   │   └── TokenProvider.tsx  # 토큰 상태 관리
│   ├── lib/                   # 핵심 로직
│   │   ├── config.ts          # 설정 관리
│   │   ├── github.ts          # GitHub API 서비스
│   │   └── tokenManager.ts    # 토큰 관리
│   ├── types/                 # TypeScript 타입 정의
│   │   └── index.ts           # 핵심 인터페이스
│   └── utils/                 # 유틸리티 함수
│       └── githubUrlParser.ts # GitHub URL 파싱
├── Dockerfile                 # Docker 이미지
├── docker-compose.yml         # Docker Compose 설정
└── k8s/                      # Kubernetes 설정 (예정)
```

## 🔧 설치 및 실행

### 1. 환경 요구사항
- Node.js 18.17.0 이상
- npm 또는 yarn
- Docker (선택사항)

### 2. 프로젝트 설정
```bash
# 저장소 클론
git clone <repository-url>
cd apicompare

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local에서 GITHUB_TOKEN 설정 (선택사항)

# 개발 서버 실행
npm run dev
```

### 3. 환경 변수
```bash
# .env.local
GITHUB_TOKEN=your_github_token_here  # 선택사항
GITHUB_API_URL=https://api.github.com
NEXT_PUBLIC_APP_NAME=API Compare Tool
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## 🐳 Docker 실행

### 1. 이미지 빌드
```bash
docker build -t apicompare .
```

### 2. 컨테이너 실행
```bash
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  apicompare
```

### 3. Docker Compose
```bash
docker-compose up -d
```

## 📖 사용 방법

### 1. GitHub 토큰 설정
- **환경변수**: `GITHUB_TOKEN` 설정
- **웹 입력**: Personal Access Token 직접 입력
- **토큰 생성**: [GitHub Settings](https://github.com/settings/tokens)

### 2. Repository 검색
- **GitHub URL 모드**: URL을 입력하면 자동 파싱
- **Owner/Name 별도 모드**: 각각 따로 입력

### 3. API 변경사항 분석 (예정)
- Swagger 파일 자동 검색
- 버전별 비교 분석
- 변경사항 시각화

## 🔒 보안

### 1. 토큰 관리
- HttpOnly 쿠키로 클라이언트 접근 차단
- 서버 사이드에서만 토큰 사용
- 정기적인 토큰 갱신 권장

### 2. 권한 제어
- Repository 접근 권한 확인
- Private repository 접근 제어
- Rate limiting 고려

## 🧪 API 엔드포인트

### Health Check
- `GET /api/health` - 서비스 상태 확인

### GitHub 연동
- `GET /api/github/token` - 토큰 상태 확인
- `POST /api/github/token` - 토큰 저장
- `POST /api/github/validate-token` - 토큰 유효성 검증
- `POST /api/github/repository` - Repository 정보 조회

## 🚧 개발 진행 상황

### ✅ 완료된 기능
- [x] Next.js 프로젝트 설정
- [x] GitHub API 연동
- [x] 토큰 관리 시스템
- [x] Repository 검색 폼
- [x] GitHub URL 파싱
- [x] Docker 설정
- [x] 기본 UI 컴포넌트

### 🔄 진행 중인 기능
- [ ] Swagger 파일 검색 로직
- [ ] oasdiff 연동
- [ ] API 변경사항 분석

### 📋 예정된 기능
- [ ] 버전별 Swagger 파일 비교
- [ ] 변경사항 시각화 (차트, 테이블)
- [ ] 버전 타임라인
- [ ] Kubernetes 배포 설정
- [ ] 모니터링 및 로깅

## 🤝 기여하기

### 1. 개발 환경 설정
```bash
npm install
npm run dev
```

### 2. 코드 스타일
- TypeScript 사용
- ESLint 규칙 준수
- Prettier 포맷팅

### 3. 테스트
```bash
npm run test
npm run test:coverage
```

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 지원

문제가 발생하거나 기능 요청이 있으시면 이슈를 생성해주세요.

---

**API Compare Tool** - GitHub API 변경사항을 쉽게 분석하세요! 🚀
