/**
 * scripts/reset-db.ts
 *
 * Deletes all per-user / user-generated data from the database.
 * Preserves:
 *   - The Super Admin user (role = SUPER_ADMIN)
 *   - Audit logs belonging to the Super Admin
 *   - All funnel CMS content (funnel_sections, funnel_steps, and related configs)
 *   - All LMS content (courses, sections, lessons)
 *   - All distributor plans
 *   - All coupons
 *
 * Run with:  npm run db:reset
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== NSI Database Reset ===\n');

  // ─── Safety check: find Super Admin first ─────────────────────────────────
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { uuid: true, email: true, fullName: true },
  });

  if (!superAdmin) {
    console.error('❌  ERROR: No SUPER_ADMIN user found. Aborting — nothing was deleted.');
    process.exit(1);
  }

  console.log(`✅  Super Admin found: ${superAdmin.email} (${superAdmin.uuid})`);
  console.log('   Starting deletion of user-generated data...\n');

  // ─── Delete in FK-safe order ───────────────────────────────────────────────

  const r1 = await prisma.lessonProgress.deleteMany();
  console.log(`   lesson_progress          — deleted ${r1.count} row(s)`);

  const r2 = await prisma.courseEnrollment.deleteMany();
  console.log(`   course_enrollment        — deleted ${r2.count} row(s)`);

  const r3 = await prisma.stepProgress.deleteMany();
  console.log(`   step_progress            — deleted ${r3.count} row(s)`);

  const r4 = await prisma.funnelProgress.deleteMany();
  console.log(`   funnel_progress          — deleted ${r4.count} row(s)`);

  const r5 = await prisma.leadActivity.deleteMany();
  console.log(`   lead_activity            — deleted ${r5.count} row(s)`);

  const r6 = await prisma.nurtureEnrollment.deleteMany();
  console.log(`   nurture_enrollment       — deleted ${r6.count} row(s)`);

  const r7 = await prisma.distributorTask.deleteMany();
  console.log(`   distributor_task         — deleted ${r7.count} row(s)`);

  const r8 = await prisma.distributorCalendarNote.deleteMany();
  console.log(`   distributor_calendar_note — deleted ${r8.count} row(s)`);

  const r9 = await prisma.distributorSubscription.deleteMany();
  console.log(`   distributor_subscription — deleted ${r9.count} row(s)`);

  // CouponUse must go before Payment due to FK on coupon_uses → coupons
  const r10 = await prisma.couponUse.deleteMany();
  console.log(`   coupon_use               — deleted ${r10.count} row(s)`);

  const r11 = await prisma.payment.deleteMany();
  console.log(`   payment                  — deleted ${r11.count} row(s)`);

  const r12 = await prisma.lead.deleteMany();
  console.log(`   leads                    — deleted ${r12.count} row(s)`);

  const r13 = await prisma.userAcquisition.deleteMany();
  console.log(`   user_acquisition         — deleted ${r13.count} row(s)`);

  const r14 = await prisma.authSession.deleteMany({
    where: { userUuid: { not: superAdmin.uuid } },
  });
  console.log(`   auth_session             — deleted ${r14.count} row(s)`);

  const r15 = await prisma.userProfile.deleteMany({
    where: { userUuid: { not: superAdmin.uuid } },
  });
  console.log(`   user_profile             — deleted ${r15.count} row(s)`);

  // Also delete OTPs for non-super-admin users
  const r16 = await prisma.emailOTP.deleteMany({
    where: { userUuid: { not: superAdmin.uuid } },
  });
  console.log(`   email_otp                — deleted ${r16.count} row(s)`);

  const r17 = await prisma.auditLog.deleteMany({
    where: { actorUuid: { not: superAdmin.uuid } },
  });
  console.log(`   audit_log                — deleted ${r17.count} row(s)`);

  const r18 = await prisma.user.deleteMany({
    where: { role: { not: 'SUPER_ADMIN' } },
  });
  console.log(`   users                    — deleted ${r18.count} row(s)`);

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Reset Complete ===');
  console.log(`✅  Database reset complete. Super Admin preserved: ${superAdmin.email}`);
  console.log('✅  Preserved: funnel steps, courses, distributor plans, coupons');
}

main()
  .catch((err) => {
    console.error('❌  Reset script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
