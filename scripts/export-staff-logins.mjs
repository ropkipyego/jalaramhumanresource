#!/usr/bin/env node
/**
 * Go-live staff login export helper.
 *
 * Usage (from project root):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-staff-logins.mjs
 *
 * Or put SERVICE ROLE key in env and run:
 *   node scripts/export-staff-logins.mjs --reset
 *
 * --reset  Generates new temporary passwords and writes CSV with passwords.
 * Without --reset: exports Staff ID, Name, Email, Role only (no passwords —
 * passwords cannot be recovered from the database).
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { resolve } from "path";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const doReset = process.argv.includes("--reset");

if (!url || !key) {
  console.error(`
Missing credentials.

Set these environment variables (from Supabase Dashboard → Project Settings → API):
  SUPABASE_URL=https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...   (service_role secret — NOT the anon key)

Then run:
  node scripts/export-staff-logins.mjs          # emails only
  node scripts/export-staff-logins.mjs --reset  # new passwords + CSV
`);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const randomPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!";
};

const { data: profiles, error: pErr } = await supabase
  .from("profiles")
  .select("id, staff_id, full_name, email, is_active, hr_status")
  .order("full_name");
if (pErr) throw pErr;

const { data: roles } = await supabase.from("user_roles").select("user_id, role");
const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

const authMap = new Map();
let page = 1;
for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  for (const u of data.users) authMap.set(u.id, u);
  if (data.users.length < 200) break;
  page += 1;
}

const rows = [];
for (const p of profiles || []) {
  const auth = authMap.get(p.id);
  const role = roleMap.get(p.id) || "STAFF";
  let password = "";
  let status = auth ? "HAS_LOGIN" : "NO_AUTH_ACCOUNT";

  if (doReset && auth) {
    password = randomPassword();
    const { error } = await supabase.auth.admin.updateUserById(p.id, {
      password,
      email_confirm: true,
    });
    status = error ? `ERROR: ${error.message}` : "PASSWORD_RESET";
    if (error) password = "";
  }

  rows.push({
    staff_id: p.staff_id,
    full_name: p.full_name,
    login_email: auth?.email || p.email,
    role,
    hr_status: p.hr_status,
    is_active: p.is_active,
    last_sign_in: auth?.last_sign_in_at || "",
    temporary_password: password,
    status,
  });
}

const header = Object.keys(rows[0] || {
  staff_id: "", full_name: "", login_email: "", role: "", hr_status: "",
  is_active: "", last_sign_in: "", temporary_password: "", status: "",
});
const csv = [
  header.join(","),
  ...rows.map((r) =>
    header.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
  ),
].join("\n");

const out = resolve(
  process.cwd(),
  doReset
    ? `staff-credentials-WITH-PASSWORDS-${new Date().toISOString().slice(0, 10)}.csv`
    : `staff-login-emails-${new Date().toISOString().slice(0, 10)}.csv`
);
writeFileSync(out, csv, "utf8");

console.log(`Wrote ${rows.length} staff rows → ${out}`);
console.log(`  With auth account: ${rows.filter((r) => r.status !== "NO_AUTH_ACCOUNT" && !String(r.status).startsWith("ERROR")).length}`);
console.log(`  No auth account:   ${rows.filter((r) => r.status === "NO_AUTH_ACCOUNT").length}`);
if (doReset) {
  console.log(`  Passwords reset:   ${rows.filter((r) => r.status === "PASSWORD_RESET").length}`);
  console.log("\n⚠ Keep this CSV private. Passwords cannot be retrieved again from the database.");
}
