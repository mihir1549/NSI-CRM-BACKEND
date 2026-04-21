import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const prisma = new PrismaClient();
  const hash = '$2b$10$BN6l/d1lbKX3W8VsD4BYbeDcrXgal.L8.fAZOODRRTcPNq37XDIfC';
  
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO users (
        uuid,
        "fullName",
        email,
        "passwordHash",
        role,
        status,
        country,
        "emailVerified",
        join_link_active,
        "createdAt",
        "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5::"UserRole", $6::"UserStatus", $7, $8, $9, NOW(), NOW()
      )
    `, 
    uuidv4(),
    'Patel Rudra',
    'rsdp9999@gmail.com',
    hash,
    'SUPER_ADMIN',
    'ACTIVE',
    'IN',
    true,
    false
    );
    console.log('Super Admin created successfully');
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
