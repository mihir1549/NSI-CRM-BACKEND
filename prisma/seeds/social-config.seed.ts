import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const configs = [
  { key: 'POSTS_PER_DAY', value: '2' },
  { key: 'BATCH_SIZE', value: '10' },
  { key: 'RETRY_ATTEMPTS', value: '3' },
  { key: 'RETRY_DELAY_MS', value: '30000' },
  { key: 'CRON_TIME', value: '0 7 * * *' },
  { key: 'DROPOFF_CHECK_HOURS', value: '2' },
  { key: 'MAX_LANGUAGES', value: '2' },
  { key: 'DROPOFF_SEQUENCE_DAYS', value: '0,3' },
  { key: 'FOLLOWUP_SEQUENCE_DAYS', value: '1,3,7' },
];

const languages = [
  { code: 'hi', label: 'Hindi', order: 1 },
  { code: 'en', label: 'English', order: 2 },
  { code: 'hinglish', label: 'Hinglish', order: 3 },
];

const topics = [
  {
    code: 'HEALTH',
    label: 'Health & Wellness',
    geminiPromptHint:
      'alkaline ionized water health benefits, energy, hydration, wellness lifestyle',
    order: 1,
  },
  {
    code: 'BUSINESS',
    label: 'Business & Income',
    geminiPromptHint:
      'side income, network marketing success, financial freedom, work from home',
    order: 2,
  },
];

async function main() {
  for (const config of configs) {
    await prisma.socialConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }

  for (const lang of languages) {
    await prisma.socialLanguage.upsert({
      where: { code: lang.code },
      update: { label: lang.label, order: lang.order },
      create: lang,
    });
  }

  for (const topic of topics) {
    await prisma.socialTopic.upsert({
      where: { code: topic.code },
      update: {
        label: topic.label,
        geminiPromptHint: topic.geminiPromptHint,
        order: topic.order,
      },
      create: topic,
    });
  }

  console.log('Social automation seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
