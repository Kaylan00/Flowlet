import { config } from 'dotenv';
import { execSync } from 'node:child_process';
import { beforeAll } from 'vitest';

config({ path: '.env.test', override: true });

beforeAll(() => {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}, 60000);
