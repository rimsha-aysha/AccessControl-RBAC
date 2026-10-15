import { env, assertRuntimeConfig } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { syncPermissions } from './services/permissionService.js';
import { createApp } from './app.js';

async function start() {
  assertRuntimeConfig();
  await connectDatabase();
  await syncPermissions();
  console.log(`[db] connected to database "${env.dbName}"`);

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[startup] port ${env.port} is already used by another program. Set a different PORT in backend/.env.`);
    } else {
      console.error('[startup] server error:', error.message);
    }
    process.exit(1);
  });
}

start().catch((error) => {
  console.error('[startup] failed:', error.message);
  process.exit(1);
});
