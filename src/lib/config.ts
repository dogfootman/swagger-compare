export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0'
  },
  github: {
    token: process.env.GITHUB_TOKEN || null,
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    userAgent: process.env.GITHUB_USER_AGENT || 'API-Compare-Tool'
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'API Compare Tool',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }
};

export const isProduction = config.app.environment === 'production';
export const hasEnvironmentToken = !!config.github.token;
