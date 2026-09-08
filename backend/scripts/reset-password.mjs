#!/usr/bin/env node
/**
 * Reset one user's password in hr.app_credentials (bcrypt).
 * NEVER deletes users, roles, or profiles.
 *
 * Usage (inside backend container or with POSTGRES_* env set):
 *   ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='...' node scripts/reset-password.mjs
 *
 * Optional: node scripts/reset-password.mjs admin@humasync.solutions
 * (password must still come from NEW_PASSWORD env — never pass on argv)
 */
import bcrypt from 'bcrypt';
import pg from 'pg';

const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase();
const newPassword = process.env.NEW_PASSWORD;

if (!email) {
  console.error('Set ADMIN_EMAIL or pass email as the first argument.');
  process.exit(1);
}
if (!newPassword || newPassword.length < 8) {
  console.error('Set NEW_PASSWORD (min 8 characters). Do not commit passwords to git.');
  process.exit(1);
}

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? 'postgres',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? 'jalaramhr',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB ?? 'jalaramhr',
});

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT p.id::text, p.email, p.is_active, p.hr_status::text
       FROM public.profiles p
       WHERE lower(p.email) = $1`,
      [email],
    );

    if (rows.length === 0) {
      throw new Error(`No profile found for email: ${email}`);
    }
    if (rows.length > 1) {
      throw new Error(`Multiple profiles match email: ${email} — aborting.`);
    }

    const user = rows[0];
    if (user.is_active === false || user.hr_status === 'TERMINATED') {
      throw new Error(`Account is inactive (${email}). Activate the profile first.`);
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await client.query(
      `INSERT INTO hr.app_credentials (user_id, password_hash, updated_at)
       VALUES ($1::uuid, $2, now())
       ON CONFLICT (user_id) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             updated_at = now()`,
      [user.id, hash],
    );

    console.log(`Password updated for ${user.email} (user_id ${user.id}).`);
    console.log('Existing roles and refresh tokens were not modified.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
