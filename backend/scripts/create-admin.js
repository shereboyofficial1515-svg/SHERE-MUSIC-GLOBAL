/**
 * Create the first administrator, or promote an existing account.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *
 * The password is read from the ADMIN_PASSWORD environment variable or prompted
 * for interactively, so it never appears in shell history.
 */
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { supabase } from '../src/config/supabase.js';
import { password as passwordRule } from '../src/validators/common.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, [])
);

const email = String(args.email || '').trim().toLowerCase();
const name = String(args.name || 'Administrator').trim();
if (!email || !email.includes('@')) {
  console.error('Usage: npm run create-admin -- --email you@example.com --name "Your Name"');
  process.exit(1);
}

const { data: existing, error: findError } = await supabase.from('users').select('id,role').eq('email', email).maybeSingle();
if (findError) {
  console.error('Database error:', findError.message);
  process.exit(1);
}

if (existing) {
  const { error } = await supabase.from('users').update({ role: 'admin', email_verified: true, status: 'active' }).eq('id', existing.id);
  if (error) {
    console.error('Could not promote user:', error.message);
    process.exit(1);
  }
  console.log(`✓ ${email} is now an administrator.`);
  process.exit(0);
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = createInterface({ input: stdin, output: stdout });
  password = await rl.question('Password for the new admin (min 8 chars, letters + numbers): ');
  rl.close();
}
const check = passwordRule.safeParse(password);
if (!check.success) {
  console.error(check.error.issues[0].message);
  process.exit(1);
}

const { error } = await supabase.from('users').insert({
  name,
  email,
  password_hash: await bcrypt.hash(password, 12),
  role: 'admin',
  email_verified: true,
});
if (error) {
  console.error('Could not create admin:', error.message);
  process.exit(1);
}
console.log(`✓ Administrator ${email} created. Sign in at your frontend's /login page.`);
