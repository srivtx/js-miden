import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function registerUser(email: string, password: string, tenantId: string) {
  const hash = await bcrypt.hash(password, 10);
  const schema = `tenant_${tenantId}`;
  await pool.query(`INSERT INTO ${schema}.users (email, password_hash) VALUES ($1, $2)`, [email, hash]);
  return { email, tenantId };
}

export async function loginUser(email: string, password: string, tenantId: string): Promise<string> {
  const schema = `tenant_${tenantId}`;
  const result = await pool.query(`SELECT * FROM ${schema}.users WHERE email = $1`, [email]);
  const user = result.rows[0];
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id, tenantId }, JWT_SECRET, { expiresIn: '1h' });
  return token;
}

export async function getUserProfile(userId: string) {
  // In a real app, look up per tenant
  return { userId };
}
