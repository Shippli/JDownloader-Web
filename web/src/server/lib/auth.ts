import process from 'node:process';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db';
import * as schema from '../db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    // Signed cookie cache: skips the SQLite session lookup on most requests.
    // Trade-off: a revoked session may remain usable for up to maxAge seconds.
    cookieCache: {
      enabled: true,
      maxAge: 300,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET ?? (() => {
    throw new Error('BETTER_AUTH_SECRET environment variable is required');
  })(),
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  trustedOrigins: [
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',') : []),
  ],
});
