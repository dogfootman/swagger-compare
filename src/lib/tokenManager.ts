export class TokenManager {
  private static readonly TOKEN_KEY = 'github_token';
  
  /**
   * 토큰을 우선순위에 따라 로드
   * 1. 환경변수 (설치형)
   * 2. 브라우저 저장소 (서비스형)
   * 3. 사용자 입력 요청
   */
  static async getToken(): Promise<string | null> {
    // 1. 환경변수 확인 (서버사이드)
    if (typeof window === 'undefined') {
      return process.env.GITHUB_TOKEN || null;
    }
    
    // 2. 브라우저 저장소 확인
    const storedToken = this.getStoredToken();
    if (storedToken) {
      return storedToken;
    }
    
    // 3. 환경변수가 없는 경우 null 반환 (입력 요청)
    return null;
  }
  
  /**
   * 토큰 저장 (서비스형 사용자)
   */
  static saveToken(token: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.TOKEN_KEY, token);
    }
  }
  
  /**
   * 저장된 토큰 제거
   */
  static removeToken(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.TOKEN_KEY);
    }
  }
  
  /**
   * 토큰 존재 여부 확인
   */
  static hasToken(): boolean {
    return !!this.getStoredToken();
  }
  
  private static getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(this.TOKEN_KEY);
  }
}
