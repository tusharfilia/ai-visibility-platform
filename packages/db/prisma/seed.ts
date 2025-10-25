import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@ai-visibility.com' },
    update: {},
    create: {
      email: 'demo@ai-visibility.com',
      externalId: 'demo-user-123',
    },
  });

  console.log('✅ Created demo user:', user.email);

  // Create demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'demo-workspace-123' },
    update: {},
    create: {
      id: 'demo-workspace-123',
      name: 'Demo Workspace',
    },
  });

  console.log('✅ Created demo workspace:', workspace.name);

  // Create workspace member
  await prisma.workspaceMember.upsert({
    where: { 
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      }
    },
    update: {},
    create: {
      userId: user.id,
      workspaceId: workspace.id,
    },
  });

  console.log('✅ Created workspace member');

  // Create 3 engines
  const engines = [
    {
      id: 'engine-perplexity-123',
      key: 'PERPLEXITY',
      enabled: true,
      dailyBudgetCents: 1000, // $10
      concurrency: 2,
      config: { model: 'llama-3.1-sonar-large-128k-online' },
    },
    {
      id: 'engine-aio-123',
      key: 'AIO',
      enabled: true,
      dailyBudgetCents: 500, // $5
      concurrency: 1,
      config: { region: 'us-east-1' },
    },
    {
      id: 'engine-brave-123',
      key: 'BRAVE',
      enabled: true,
      dailyBudgetCents: 200, // $2
      concurrency: 3,
      config: { searchType: 'web' },
    },
  ];

  for (const engineData of engines) {
    await prisma.engine.upsert({
      where: { id: engineData.id },
      update: {},
      create: {
        ...engineData,
        workspaceId: workspace.id,
      },
    });
  }

  console.log('✅ Created 3 engines');

  // Create 3 prompts covering different intents
  const prompts = [
    {
      id: 'prompt-best-123',
      text: 'What are the best project management tools for small teams?',
      canonicalText: 'best project management tools small teams',
      intent: 'BEST',
      vertical: 'software',
      tags: ['project-management', 'small-teams', 'tools'],
    },
    {
      id: 'prompt-alternatives-123',
      text: 'What are alternatives to Asana for task management?',
      canonicalText: 'alternatives to Asana task management',
      intent: 'ALTERNATIVES',
      vertical: 'software',
      tags: ['asana', 'alternatives', 'task-management'],
    },
    {
      id: 'prompt-howto-123',
      text: 'How to implement agile methodology in remote teams?',
      canonicalText: 'how to implement agile methodology remote teams',
      intent: 'HOWTO',
      vertical: 'management',
      tags: ['agile', 'remote-teams', 'methodology'],
    },
  ];

  for (const promptData of prompts) {
    await prisma.prompt.upsert({
      where: { id: promptData.id },
      update: {},
      create: {
        ...promptData,
        workspaceId: workspace.id,
      },
    });
  }

  console.log('✅ Created 3 prompts');

  // Create sample CopilotRule
  await prisma.copilotRule.upsert({
    where: { id: 'copilot-rule-123' },
    update: {},
    create: {
      id: 'copilot-rule-123',
      workspaceId: workspace.id,
      fullAuto: true,
      requireApproval: false,
      maxPagesPerWeek: 10,
      enabledActions: ['ADD_FAQ', 'ADD_TLDR', 'ADD_CITATIONS'],
      intensity: 2,
      config: {
        targetDomains: ['example.com'],
        contentTypes: ['blog', 'landing-page'],
      },
    },
  });

  console.log('✅ Created CopilotRule');

  // Create sample MetricDaily entries for the last 7 days
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    for (const engineKey of ['PERPLEXITY', 'AIO', 'BRAVE']) {
      await prisma.metricDaily.upsert({
        where: {
          workspaceId_engineKey_date: {
            workspaceId: workspace.id,
            engineKey: engineKey as any,
            date: date,
          },
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          engineKey: engineKey as any,
          date: date,
          promptSOV: Math.random() * 100,
          coverage: Math.random() * 100,
          citationCount: Math.floor(Math.random() * 50),
          aioImpressions: Math.floor(Math.random() * 1000),
        },
      });
    }
  }

  console.log('✅ Created sample metrics');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
