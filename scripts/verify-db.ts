import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.$queryRawUnsafe(`
      SELECT uuid, "fullName" AS name, email, role, status, "emailVerified"
      FROM users;
    `);
    console.log('--- User Verification ---');
    console.log(JSON.stringify(user, null, 2));

    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = t.table_name) AS column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE' 
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);
    console.log('\n--- Table Integrity Verification ---');
    console.log(JSON.stringify(tables, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
