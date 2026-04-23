import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@flowlet.dev';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Demo user already exists:', email);
    return;
  }
  const passwordHash = await argon2.hash('demo1234');
  const user = await prisma.user.create({
    data: { email, passwordHash, name: 'Demo User' },
  });
  console.log('Demo user created:', user.email);

  await prisma.flow.create({
    data: {
      userId: user.id,
      name: 'Fetch & Notify',
      description: 'Fetch data from an API and log the result',
      status: 'active',
      blocks: [
        {
          id: 'b1', definitionId: 'manual-trigger', category: 'trigger',
          label: 'Manual Trigger', icon: 'cursor-click', color: '#10b981',
          position: { x: 80, y: 160 },
          properties: [{ key: 'payload', label: 'Input Payload (JSON)', type: 'textarea', value: '{"userId":1}' }],
        },
        {
          id: 'b2', definitionId: 'http-request', category: 'action',
          label: 'Fetch User', icon: 'link', color: '#4f46e5',
          position: { x: 400, y: 160 },
          properties: [
            { key: 'method', label: 'Method', type: 'select', value: 'GET', options: ['GET','POST','PUT','PATCH','DELETE'] },
            { key: 'url', label: 'URL', type: 'text', value: 'https://jsonplaceholder.typicode.com/users/1' },
            { key: 'headers', label: 'Headers (JSON)', type: 'textarea', value: '{}' },
            { key: 'body', label: 'Body (JSON)', type: 'textarea', value: '' },
          ],
        },
        {
          id: 'b3', definitionId: 'console-log', category: 'output',
          label: 'Log Result', icon: 'terminal', color: '#8b5cf6',
          position: { x: 720, y: 160 },
          properties: [
            { key: 'label', label: 'Log label', type: 'text', value: 'API Response' },
            { key: 'logData', label: 'What to log', type: 'select', value: 'previous_output', options: ['full_context','previous_output','variables_only'] },
          ],
        },
      ],
      connections: [
        { id: 'c1', sourceId: 'b1', targetId: 'b2' },
        { id: 'c2', sourceId: 'b2', targetId: 'b3' },
      ],
    },
  });
  console.log('Demo flow created');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
