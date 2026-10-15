/**
 * Seeds sample data:  npm run seed
 *
 * Safe to run many times - existing records are left untouched.
 *   SEED_DEMO_USERS=false     skip the demo staff users
 *   DEMO_USER_PASSWORD=...    optional; lets the demo staff users sign in (for testing non-admin access)
 */
import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedBaseData, seedDemoUsers } from '../seed/seedData.js';
import { passwordRule } from '../validators/schemas.js';

async function main() {
  await connectDatabase();
  console.log(`[seed] database: ${env.dbName}`);

  const { branchesCreated, rolesCreated } = await seedBaseData();
  console.log(`[seed] permissions synced, ${branchesCreated} branch(es) and ${rolesCreated} role(s) created`);

  if (process.env.SEED_DEMO_USERS !== 'false') {
    const demoPassword = process.env.DEMO_USER_PASSWORD || '';
    if (demoPassword) passwordRule.parse(demoPassword);
    const usersCreated = await seedDemoUsers(demoPassword);
    console.log(
      `[seed] ${usersCreated} demo user(s) created` +
        (demoPassword ? ' (they can sign in with DEMO_USER_PASSWORD)' : ' (sign-in disabled: DEMO_USER_PASSWORD not set)')
    );
  }
  console.log('[seed] done. Next: npm run setup:admin');
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error.errors?.[0]?.message || error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
