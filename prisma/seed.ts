import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  CreditAccountStatus,
  EmployeeVerificationStatus,
  EmployeeInviteStatus,
  Employer,
  LedgerEntryType,
  OrderCreditStatus,
  OrderFulfillmentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';
import { seedMeasures } from './seed/measure-catalog';
import { seedCategories, seedProducts } from './seed/upsert-catalog';

function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

const DEMO_INVITE_CODE = 'DEMO01';

function computeCreditLimitKobo(salaryKobo: number): number {
  return Math.floor((salaryKobo * 15_000) / 10_000);
}

async function ensureDemoEmployer(prisma: PrismaClient): Promise<Employer> {
  const existing = await prisma.employer.findFirst({
    where: { inviteCode: DEMO_INVITE_CODE },
  });
  if (existing) {
    return prisma.employer.update({
      where: { id: existing.id },
      data: { payrollDayOfMonth: 15 },
    });
  }

  const employer = await prisma.employer.create({
    data: {
      name: 'Demo Corp',
      inviteCode: DEMO_INVITE_CODE,
      payrollDayOfMonth: 15,
    },
  });
  await prisma.creditPolicy.create({ data: { employerId: employer.id } });
  return employer;
}

async function ensureDemoEmployeeUser(prisma: PrismaClient, employer: Employer) {
  const email = 'jane.doe@demo.pantri';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash('Employee123!', 12);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.EMPLOYEE,
        status: UserStatus.ACTIVE,
        employerId: employer.id,
      },
    });
  } else if (user.employerId !== employer.id) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { employerId: employer.id },
    });
  }
  return user;
}

async function main() {
  const connectionString =
    process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const email = (process.env.ADMIN_EMAIL ?? 'admin@pantri.app').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Admin123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Pantri',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`Seeded ADMIN user: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  await seedMeasures(prisma);
  await seedCategories(prisma);
  await seedProducts(prisma);

  const bannerCount = await prisma.marketplaceBanner.count();
  if (bannerCount === 0) {
    await prisma.marketplaceBanner.create({
      data: {
        badgeLabel: 'Bulk Savings',
        title: 'Stock up & Save',
        subtitle: 'Get 15% off when you buy 5 or more pantry staples.',
        ctaLabel: 'Shop Deals',
        ctaRoute: null,
        gradientStart: '#1A3A5C',
        gradientEnd: '#2D6A8F',
        sortOrder: 0,
        isActive: true,
      },
    });
    console.log('Seeded marketplace banner');
  } else {
    console.log(`Marketplace banners already exist (${bannerCount})`);
  }

  const tierCount = await prisma.packageDiscountTier.count();
  if (tierCount === 0) {
    await prisma.packageDiscountTier.createMany({
      data: [
        {
          label: 'TIER 1',
          minSpendKobo: nairaToKobo(50_000),
          discountPercent: 5,
          sortOrder: 0,
          isActive: true,
        },
        {
          label: 'TIER 2',
          minSpendKobo: nairaToKobo(150_000),
          discountPercent: 12,
          sortOrder: 1,
          isActive: true,
        },
        {
          label: 'TIER 3',
          minSpendKobo: nairaToKobo(300_000),
          discountPercent: 20,
          sortOrder: 2,
          isActive: true,
        },
      ],
    });
    console.log('Seeded package discount tiers');
  } else {
    console.log(`Package discount tiers already exist (${tierCount})`);
  }

  await prisma.platformDeliverySettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      freeDeliveryMinKobo: nairaToKobo(50_000),
      deliveryFeeKobo: nairaToKobo(2_000),
    },
    update: {},
  });
  console.log('Ensured platform delivery settings');

  const packageCount = await prisma.pantryPackage.count({
    where: { kind: 'CURATED' },
  });
  if (packageCount === 0) {
    const packs = await prisma.productPack.findMany({
      where: { isActive: true, product: { isActive: true } },
      orderBy: { sortOrder: 'asc' },
      take: 12,
    });

    const pick = (...indexes: number[]) =>
      indexes
        .map((i, sortOrder) => {
          const pack = packs[i % Math.max(packs.length, 1)];
          if (!pack) return null;
          return {
            packId: pack.id,
            quantity: 1 + (sortOrder % 2),
            sortOrder,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

    const cover =
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=500&fit=crop';

    const curated = [
      {
        name: 'Bachelor Package',
        description:
          'Essentials for one — rice, oil basics, and everyday staples.',
        isPopular: false,
        sortOrder: 0,
        slug: 'bachelor-package',
        itemIndexes: [0, 1, 2],
      },
      {
        name: 'Couple Package',
        description:
          'Balanced monthly restock sized for two with popular pantry staples.',
        isPopular: true,
        sortOrder: 1,
        slug: 'couple-package',
        itemIndexes: [0, 1, 2, 3],
      },
      {
        name: 'Family of 3',
        description:
          'Monthly provisions designed to sustain a household of three.',
        isPopular: false,
        sortOrder: 2,
        slug: 'family-of-3',
        itemIndexes: [0, 2, 3, 4],
      },
      {
        name: 'Family of 5 Package',
        description:
          'Essential monthly provisions designed to sustain a household of five.',
        isPopular: true,
        sortOrder: 3,
        slug: 'family-of-5',
        itemIndexes: [0, 1, 2, 3, 4, 5],
      },
      {
        name: 'Student Package',
        description: 'Compact, budget-friendly staples for campus living.',
        isPopular: false,
        sortOrder: 4,
        slug: 'student-package',
        itemIndexes: [1, 5, 6],
      },
      {
        name: 'Senior Citizen Package',
        description:
          'Thoughtfully sized staples with easy-to-cook pantry essentials.',
        isPopular: false,
        sortOrder: 5,
        slug: 'senior-citizen-package',
        itemIndexes: [2, 4, 6, 7],
      },
    ] as const;

    if (packs.length > 0) {
      for (const pkg of curated) {
        await prisma.pantryPackage.create({
          data: {
            kind: 'CURATED',
            name: pkg.name,
            description: pkg.description,
            coverImageUrl: cover,
            isPopular: pkg.isPopular,
            sortOrder: pkg.sortOrder,
            isActive: true,
            visibility: 'PUBLIC',
            shareSlug: pkg.slug,
            items: { create: pick(...pkg.itemIndexes) },
          },
        });
      }
      console.log(`Seeded ${curated.length} curated packages`);
    } else {
      console.log('Skipped curated packages seed (no packs)');
    }
  } else {
    console.log(`Curated packages already exist (${packageCount})`);
  }

  {
    const allergies = [
      { name: 'Peanuts', slug: 'peanuts', sortOrder: 1 },
      { name: 'Gluten', slug: 'gluten', sortOrder: 2 },
      { name: 'Dairy', slug: 'dairy', sortOrder: 3 },
      { name: 'Shellfish', slug: 'shellfish', sortOrder: 4 },
      { name: 'Soy', slug: 'soy', sortOrder: 5 },
    ] as const;

    for (const allergy of allergies) {
      await prisma.allergy.upsert({
        where: { slug: allergy.slug },
        create: {
          name: allergy.name,
          slug: allergy.slug,
          sortOrder: allergy.sortOrder,
          isActive: true,
        },
        update: {
          name: allergy.name,
          sortOrder: allergy.sortOrder,
          isActive: true,
        },
      });
    }
    console.log(`Seeded ${allergies.length} allergies`);

    const goals = [
      {
        name: 'Weight Loss',
        slug: 'weight-loss',
        description: 'Burn fat and maintain lean muscle.',
        iconKey: 'monitoring',
        sortOrder: 1,
      },
      {
        name: 'Muscle Gain',
        slug: 'muscle-gain',
        description: 'High protein intake to build strength.',
        iconKey: 'exercise',
        sortOrder: 2,
      },
      {
        name: 'More Energy',
        slug: 'more-energy',
        description: 'Focus on sustained release nutrients.',
        iconKey: 'bolt',
        sortOrder: 3,
      },
      {
        name: 'Gut Health',
        slug: 'gut-health',
        description: 'Focus on digestion and microbiome.',
        iconKey: 'verified',
        sortOrder: 4,
      },
    ] as const;

    for (const goal of goals) {
      await prisma.primaryGoal.upsert({
        where: { slug: goal.slug },
        create: {
          name: goal.name,
          slug: goal.slug,
          description: goal.description,
          iconKey: goal.iconKey,
          sortOrder: goal.sortOrder,
          isActive: true,
        },
        update: {
          name: goal.name,
          description: goal.description,
          iconKey: goal.iconKey,
          sortOrder: goal.sortOrder,
          isActive: true,
        },
      });
    }
    console.log(`Seeded ${goals.length} primary goals`);
  }

  {
    const employer = await ensureDemoEmployer(prisma);
    const employeeUser = await ensureDemoEmployeeUser(prisma, employer);
    const defaultSalaryKobo = nairaToKobo(500_000);

    const employee = await prisma.employee.upsert({
      where: { userId: employeeUser.id },
      create: {
        userId: employeeUser.id,
        employerId: employer.id,
        salaryKobo: defaultSalaryKobo,
        creditMultiplierBps: 15_000,
        deductionPercent: 20,
        verificationStatus: EmployeeVerificationStatus.APPROVED,
        verifiedAt: new Date(),
        addressLine: '12 Admiralty Way',
        city: 'Lekki',
        state: 'Lagos',
        latitude: 6.4474,
        longitude: 3.4721,
      },
      update: {
        employerId: employer.id,
        verificationStatus: EmployeeVerificationStatus.APPROVED,
        salaryKobo: defaultSalaryKobo,
        creditMultiplierBps: 15_000,
      },
    });

    // Per-person demo invite for onboarding walkthroughs (single-use when consumed).
    const demoPersonInvite = await prisma.employeeInvite.findFirst({
      where: { employerId: employer.id, code: 'JOINME01' },
    });
    if (!demoPersonInvite) {
      await prisma.employeeInvite.create({
        data: {
          employerId: employer.id,
          code: 'JOINME01',
          email: 'new.hire@demo.pantri',
          phone: '08030000000',
          status: EmployeeInviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      console.log('Seeded per-person invite JOINME01 → new.hire@demo.pantri');
    }

    // Nutritionist account (meal-plan review/activate).
    const nutritionistEmail = 'nutritionist@pantri.app';
    const nutritionistPasswordHash = await bcrypt.hash('Nutrition123!', 12);
    await prisma.user.upsert({
      where: { email: nutritionistEmail },
      create: {
        email: nutritionistEmail,
        passwordHash: nutritionistPasswordHash,
        firstName: 'Ngozi',
        lastName: 'Adeyemi',
        role: UserRole.NUTRITIONIST,
        status: UserStatus.ACTIVE,
        platformRole: 'NUTRITIONIST',
      },
      update: {
        passwordHash: nutritionistPasswordHash,
        firstName: 'Ngozi',
        lastName: 'Adeyemi',
        role: UserRole.NUTRITIONIST,
        status: UserStatus.ACTIVE,
        platformRole: 'NUTRITIONIST',
      },
    });
    console.log(`Seeded NUTRITIONIST user: ${nutritionistEmail}`);

    const salaryHistoryCount = await prisma.salaryHistory.count({
      where: { employeeId: employee.id },
    });
    if (salaryHistoryCount === 0) {
      await prisma.salaryHistory.create({
        data: {
          employeeId: employee.id,
          salaryKobo: employee.salaryKobo,
          reason: 'Initial salary on onboarding',
        },
      });
    }

    const creditLimitKobo = computeCreditLimitKobo(employee.salaryKobo);
    let creditAccount = await prisma.creditAccount.findUnique({
      where: { employeeId: employee.id },
    });
    if (!creditAccount) {
      creditAccount = await prisma.creditAccount.create({
        data: {
          employeeId: employee.id,
          creditLimitKobo,
          availableKobo: creditLimitKobo,
          status: CreditAccountStatus.ACTIVE,
        },
      });
    }

    let pickupPoint = await prisma.employerPickupPoint.findFirst({
      where: { employerId: employer.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!pickupPoint) {
      pickupPoint = await prisma.employerPickupPoint.create({
        data: {
          employerId: employer.id,
          label: 'Demo Corp HQ Pickup',
          addressLine: '1 Marina Road',
          city: 'Lagos Island',
          state: 'Lagos',
          latitude: 6.4541,
          longitude: 3.3947,
          isActive: true,
        },
      });
      console.log('Seeded demo employer pickup point');
    }

    const existingOrders = await prisma.order.count({
      where: { employeeId: employee.id },
    });
    if (existingOrders === 0) {
      const spentKobo = nairaToKobo(12400);
      const now = new Date();

      const order = await prisma.order.create({
        data: {
          employeeId: employee.id,
          employerId: employer.id,
          pickupPointId: pickupPoint.id,
          subtotalKobo: spentKobo,
          deliveryFeeKobo: 0,
          totalKobo: spentKobo,
          fulfillmentStatus: OrderFulfillmentStatus.FULFILLED,
          creditStatus: OrderCreditStatus.CAPTURED,
          createdAt: new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 3),
          ),
        },
      });

      await prisma.creditAccount.update({
        where: { id: creditAccount.id },
        data: {
          principalOutstandingKobo: { increment: spentKobo },
          availableKobo: { decrement: spentKobo },
          version: { increment: 1 },
        },
      });

      await prisma.ledgerEntry.create({
        data: {
          creditAccountId: creditAccount.id,
          sequence: 1,
          entryType: LedgerEntryType.PURCHASE_POSTED,
          amountKobo: spentKobo,
          balanceAfterKobo: spentKobo,
          reservedAfterKobo: 0,
          referenceType: 'Order',
          referenceId: order.id,
        },
      });

      console.log(
        `Seeded revolving-credit demo order + ledger entry for ${employeeUser.email}`,
      );
    } else {
      console.log('Dashboard demo order already exists');
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
