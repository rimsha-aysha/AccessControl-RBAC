import 'dotenv/config';

/**
 * Central place for reading environment variables.
 * Every other file imports `env` from here instead of touching process.env directly.
 */
const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  dbName: process.env.MONGODB_DB_NAME || 'rbac_access_control',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  jwtIssuer: 'rbac-access-control',
  // Comma separated list, e.g. "http://localhost:5180,https://rbac.example.com"
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5180')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

/** Fail fast on configuration that would make the app insecure. */
export function assertRuntimeConfig() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short (minimum 32 characters). Set it in backend/.env - see .env.example.'
    );
  }
  assertSafeDatabaseName(env.dbName);
}

/**
 * Guard against accidentally pointing this assignment at another project's database.
 */
export function assertSafeDatabaseName(dbName) {
  if (!dbName || /bookmyhall/i.test(dbName)) {
    throw new Error(`Refusing to use database "${dbName}". Configure a database dedicated to this assignment.`);
  }
}
