/**
 * Creates the first System Administrator:  npm run setup:admin
 *
 * Reads ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD from the environment (backend/.env).
 * - Never hard-codes a password.
 * - If the user already exists, nothing is changed (the password is NOT reset).
 * After the admin is created you can delete ADMIN_PASSWORD from .env.
 */
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { seedBaseData, createInitialAdmin } from '../seed/seedData.js';
import { passwordRule } from '../validators/schemas.js';

const adminEnv = z.object({
  ADMIN_NAME: z.string().trim().min(1, 'ADMIN_NAME is required').max(100),
  ADMIN_EMAIL: z.string({ required_error: 'ADMIN_EMAIL is required' }).trim().email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD: passwordRule,
});

async function main() {
  const parsed = adminEnv.safeParse({
    ADMIN_NAME: process.env.ADMIN_NAME || 'System Administrator',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error(`Invalid admin settings in .env: ${parsed.error.errors.map((e) => `${e.path[0]}: ${e.message}`).join('; ')}`);
  }

  await connectDatabase();
  await seedBaseData(); // make sure the System Administrator role exists
  const { created, user } = await createInitialAdmin({
    name: parsed.data.ADMIN_NAME,
    email: parsed.data.ADMIN_EMAIL,
    password: parsed.data.ADMIN_PASSWORD,
  });
  if (created) {
    console.log(`[setup] System Administrator created: ${user.email}`);
    console.log('[setup] You can now remove ADMIN_PASSWORD from backend/.env');
  } else {
    console.log(`[setup] A user with email ${user.email} already exists - nothing changed (password was NOT reset).`);
  }
}

main()
  .catch((error) => {
    console.error('[setup] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
