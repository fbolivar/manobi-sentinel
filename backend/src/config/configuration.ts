export default () => ({
  node_env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigins: (process.env.CORS_ORIGIN ?? '').split(',').filter(Boolean),
  db: {
    host: process.env.POSTGRES_HOST ?? 'postgres',
    port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    user: process.env.POSTGRES_USER ?? 'manobi',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DB ?? 'manobi',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'redis',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? '',
    url: process.env.REDIS_URL ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  login: {
    maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? '5', 10),
    lockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES ?? '15', 10),
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'minio',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? '',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? '',
    bucketReportes: process.env.MINIO_BUCKET_REPORTES ?? 'reportes',
    bucketUploads: process.env.MINIO_BUCKET_UPLOADS ?? 'uploads',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'postfix',
    port: parseInt(process.env.SMTP_PORT ?? '25', 10),
    from: process.env.SMTP_FROM ?? 'no-reply@manobi.local',
  },
  ai: {
    url: process.env.AI_SERVICE_URL ?? 'http://ai-service:8000',
  },
  ideam: {
    mode: (process.env.IDEAM_MODE ?? 'simulado') as 'simulado' | 'real',
    url: process.env.IDEAM_API_URL ?? '',
    pollIntervalMin: parseInt(process.env.IDEAM_POLL_INTERVAL_MIN ?? '30', 10),
  },
  notify: {
    emailOperadores: (process.env.NOTIFY_EMAIL_OPERADORES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
});
