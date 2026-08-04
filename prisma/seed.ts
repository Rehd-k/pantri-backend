import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  CreditAccountStatus,
  Employer,
  LedgerEntryType,
  OrderCreditStatus,
  OrderFulfillmentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from '../generated/prisma/client';

function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

const DEMO_INVITE_CODE = 'DEMO01';
/** creditLimit = floor(salaryKobo * 15000 / 10000) — mirrors src/credit/domain/money.ts. */
function computeCreditLimitKobo(salaryKobo: number): number {
  return Math.floor((salaryKobo * 15_000) / 10_000);
}

/** Ensures the demo employer tenant (and its default credit policy) exist. */
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

/** Ensures the demo employee's `User` row exists and belongs to `employer`. */
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

  const categoryDefs = [
    {
      name: 'Rice & Grains',
      imageUrl:
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&h=200&fit=crop',
      accentColor: '#F5E6C8',
      sortOrder: 0,
      subs: ['Long Grain', 'Basmati', 'Local', 'Imported'],
    },
    {
      name: 'Proteins',
      imageUrl:
        'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=200&h=200&fit=crop',
      accentColor: '#F5D0D0',
      sortOrder: 1,
      subs: ['Beef', 'Chicken', 'Fish', 'Eggs'],
    },
    {
      name: 'Oils & Fats',
      imageUrl:
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&h=200&fit=crop',
      accentColor: '#F5DCC8',
      sortOrder: 2,
      subs: ['Vegetable Oil', 'Palm Oil', 'Olive Oil', 'Butter'],
    },
    {
      name: 'Seasonings',
      imageUrl:
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&h=200&fit=crop',
      accentColor: '#D4E8D4',
      sortOrder: 3,
      subs: ['Spices', 'Herbs', 'Stock Cubes', 'Salt'],
    },
    {
      name: 'Drinks',
      imageUrl:
        'https://images.unsplash.com/photo-1544145945-f9042533c7e6?w=200&h=200&fit=crop',
      accentColor: '#E0D4F0',
      sortOrder: 4,
      subs: ['Juice', 'Soft Drinks', 'Water', 'Tea'],
    },
    {
      name: 'Canned Goods',
      imageUrl:
        'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=200&h=200&fit=crop',
      accentColor: '#E0E0E0',
      sortOrder: 5,
      subs: ['Beans', 'Tomato', 'Fish', 'Vegetables'],
    },
  ] as const;

  let categoryCount = await prisma.marketplaceCategory.count();
  if (categoryCount === 0) {
    await prisma.marketplaceCategory.createMany({
      data: categoryDefs.map(({ name, imageUrl, accentColor, sortOrder }) => ({
        name,
        imageUrl,
        accentColor,
        sortOrder,
        isActive: true,
      })),
    });
    console.log('Seeded 6 marketplace categories');
  } else {
    console.log(`Marketplace categories already exist (${categoryCount})`);
  }

  const categories = await prisma.marketplaceCategory.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  const subcategoryCount = await prisma.marketplaceSubcategory.count();
  if (subcategoryCount === 0) {
    for (const cat of categories) {
      const def = categoryDefs.find((d) => d.name === cat.name);
      if (!def) continue;
      await prisma.marketplaceSubcategory.createMany({
        data: def.subs.map((name, index) => ({
          categoryId: cat.id,
          name,
          sortOrder: index,
          isActive: true,
        })),
      });
    }
    console.log('Seeded marketplace subcategories');
  } else {
    console.log(`Marketplace subcategories already exist (${subcategoryCount})`);
  }

  const productCount = await prisma.marketplaceProduct.count();
  if (productCount === 0) {
    const rice = categories.find((c) => c.name === 'Rice & Grains');
    if (rice) {
      const subs = await prisma.marketplaceSubcategory.findMany({
        where: { categoryId: rice.id },
        orderBy: { sortOrder: 'asc' },
      });
      const byName = Object.fromEntries(subs.map((s) => [s.name, s]));

      const riceImage =
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=400&fit=crop';

      const defaultNutrition = {
        Calories: '130 kcal',
        Carbohydrates: '28g',
        Protein: '2.7g',
        Fat: '0.3g',
      };
      const defaultPerfectFor = [
        {
          title: 'Party Jollof Rice',
          description: 'Holds firm grains during slow cooking.',
          imageUrl:
            'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=200&h=200&fit=crop',
        },
        {
          title: 'Classic Fried Rice',
          description: 'Non-sticky texture, absorbs flavors.',
          imageUrl:
            'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop',
        },
      ];

      const products = [
        {
          sub: 'Long Grain',
          name: 'Premium Long Grain Rice',
          brand: 'Royal Farms',
          packageLabel: '5kg',
          price: 5800,
          retail: 6500,
          tags: ['rice', 'long grain', 'grain', 'staple'],
          description:
            'Premium long grain rice sourced from trusted Nigerian mills. Parboiled, stone-free, and cooks fluffy without sticking.',
          origin: 'Benue, Nigeria',
          bulk: 62,
          verified: true,
        },
        {
          sub: 'Long Grain',
          name: 'Premium Long Grain Rice',
          brand: 'Harvest Gold',
          packageLabel: '10kg',
          price: 10500,
          retail: 12000,
          tags: ['rice', 'long grain', 'bulk'],
          description:
            'Bulk-friendly long grain rice ideal for households. Clean, aromatic, and consistent grain length.',
          origin: 'Kebbi, Nigeria',
          bulk: 71,
          verified: true,
        },
        {
          sub: 'Long Grain',
          name: 'Premium Long Grain Rice',
          brand: 'Ogun Farms',
          packageLabel: '25kg',
          price: 24500,
          retail: 28000,
          tags: ['rice', 'long grain', 'wholesale'],
          description:
            'Wholesale sack of premium long grain rice for canteens and large families. Reliable quality in every bag.',
          origin: 'Ogun, Nigeria',
          bulk: 54,
          verified: true,
        },
        {
          sub: 'Basmati',
          name: 'Aged Basmati Rice',
          brand: 'Royal Farms',
          packageLabel: '5kg',
          price: 7200,
          retail: 8500,
          tags: ['rice', 'basmati', 'aromatic'],
          description:
            'Aged basmati with a fragrant aroma and elongated grains that stay separate when cooked.',
          origin: 'Punjab, India',
          bulk: 40,
          verified: true,
        },
        {
          sub: 'Basmati',
          name: 'Fragrant Basmati Rice',
          brand: 'Harvest Gold',
          packageLabel: '10kg',
          price: 13800,
          retail: 16000,
          tags: ['rice', 'basmati', 'imported'],
          description:
            'Imported fragrant basmati for special meals. Light texture with classic nutty notes.',
          origin: 'India',
          bulk: 48,
          verified: false,
        },
        {
          sub: 'Local',
          name: 'Ofada Local Rice',
          brand: 'Ogun Farms',
          packageLabel: '5kg',
          price: 4500,
          retail: 5200,
          tags: ['rice', 'local', 'ofada'],
          description:
            'Authentic Ofada rice with a distinctive aroma, perfect for traditional Nigerian sauces.',
          origin: 'Ogun, Nigeria',
          bulk: 35,
          verified: true,
        },
        {
          sub: 'Local',
          name: 'Nigerian Local Rice',
          brand: 'Benue Mills',
          packageLabel: '10kg',
          price: 8200,
          retail: 9500,
          tags: ['rice', 'local', 'nigeria'],
          description:
            'Locally milled Nigerian rice with firm grains suited for everyday family cooking.',
          origin: 'Benue, Nigeria',
          bulk: 58,
          verified: true,
        },
        {
          sub: 'Imported',
          name: 'Thai Jasmine Rice',
          brand: 'Golden Gate',
          packageLabel: '5kg',
          price: 6800,
          retail: 7800,
          tags: ['rice', 'imported', 'jasmine'],
          description:
            'Soft, slightly sticky jasmine rice with a floral aroma — excellent for Thai-inspired dishes.',
          origin: 'Thailand',
          bulk: 44,
          verified: true,
        },
        {
          sub: 'Imported',
          name: 'Indian Parboiled Rice',
          brand: 'Royal Farms',
          packageLabel: '25kg',
          price: 26500,
          retail: 30000,
          tags: ['rice', 'imported', 'parboiled'],
          description:
            'Parboiled Indian rice that holds shape through long simmering — ideal for jollof and party trays.',
          origin: 'India',
          bulk: 66,
          verified: true,
        },
        {
          sub: 'Long Grain',
          name: 'Premium Long Grain Rice',
          brand: 'Aurora',
          packageLabel: '50kg',
          price: 45000,
          retail: 52000,
          tags: ['rice', 'long grain', 'family', 'bulk'],
          description:
            'Sourced from Benue State farms, this premium parboiled long grain rice is stone-free and cooks fluffy with a non-sticky finish — built for bulk household and catering use.',
          origin: 'Benue, Nigeria',
          bulk: 85,
          verified: true,
        },
      ];

      let order = 0;
      let showcaseProductId: string | null = null;
      const expiresAt = new Date('2025-12-31T00:00:00.000Z');
      for (const p of products) {
        const sub = byName[p.sub];
        if (!sub) continue;
        const created = await prisma.marketplaceProduct.create({
          data: {
            categoryId: rice.id,
            subcategoryId: sub.id,
            name: p.name,
            brand: p.brand,
            packageLabel: p.packageLabel,
            imageUrl: riceImage,
            priceKobo: nairaToKobo(p.price),
            retailPriceKobo: nairaToKobo(p.retail),
            description: p.description,
            origin: p.origin,
            expiresAt,
            isVerified: p.verified,
            bulkAllocationClaimedPercent: p.bulk,
            nutritionFacts: defaultNutrition,
            perfectFor: defaultPerfectFor,
            tags: p.tags,
            sortOrder: order++,
            isActive: true,
          },
        });
        if (p.packageLabel === '50kg' && p.brand === 'Aurora') {
          showcaseProductId = created.id;
        }
      }
      console.log(`Seeded ${order} rice products`);

      if (showcaseProductId) {
        const employer = await ensureDemoEmployer(prisma);
        const employeeUser = await ensureDemoEmployeeUser(prisma, employer);

        const reviewCount = await prisma.productReview.count({
          where: { productId: showcaseProductId },
        });
        if (reviewCount === 0) {
          await prisma.productReview.create({
            data: {
              productId: showcaseProductId,
              userId: employeeUser.id,
              rating: 5,
              body: 'Exceptional quality. Bought in bulk for a small café — packaging was secure and I will reorder through PantryPay.',
              helpfulCount: 12,
            },
          });
          console.log('Seeded sample product reviews');
        }
      }
    }
  } else {
    console.log(`Marketplace products already exist (${productCount})`);

    const blank = await prisma.marketplaceProduct.findMany({
      where: { description: '' },
      take: 50,
    });
    if (blank.length > 0) {
      const nutrition = {
        Calories: '130 kcal',
        Carbohydrates: '28g',
        Protein: '2.7g',
        Fat: '0.3g',
      };
      const perfectFor = [
        {
          title: 'Party Jollof Rice',
          description: 'Holds firm grains during slow cooking.',
          imageUrl:
            'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=200&h=200&fit=crop',
        },
        {
          title: 'Classic Fried Rice',
          description: 'Non-sticky texture, absorbs flavors.',
          imageUrl:
            'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop',
        },
      ];
      const expiresAt = new Date('2025-12-31T00:00:00.000Z');
      for (const product of blank) {
        await prisma.marketplaceProduct.update({
          where: { id: product.id },
          data: {
            description:
              product.description ||
              `Premium ${product.name} (${product.packageLabel}) from ${product.brand}. Clean, stone-free grains ideal for everyday and party cooking.`,
            origin: product.origin || 'Benue, Nigeria',
            expiresAt: product.expiresAt ?? expiresAt,
            isVerified: true,
            bulkAllocationClaimedPercent:
              product.bulkAllocationClaimedPercent || 75,
            nutritionFacts: nutrition,
            perfectFor,
          },
        });
      }
      console.log(`Backfilled detail fields on ${blank.length} products`);
    }
  }

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
    const products = await prisma.marketplaceProduct.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });

    const pick = (...indexes: number[]) =>
      indexes
        .map((i, sortOrder) => {
          const product = products[i % Math.max(products.length, 1)];
          if (!product) return null;
          return {
            productId: product.id,
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

    if (products.length > 0) {
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
      console.log('Skipped curated packages seed (no products)');
    }
  } else {
    console.log(`Curated packages already exist (${packageCount})`);
  }

  // --- Employee dashboard demo: revolving credit account + fulfilled order + ledger ---
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
        deductionPercent: 20,
        addressLine: '12 Admiralty Way',
        city: 'Lekki',
        state: 'Lagos',
        latitude: 6.4474,
        longitude: 3.4721,
      },
      update: {
        employerId: employer.id,
      },
    });

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

      // Post the purchase straight to the ledger for this demo (revolving
      // credit, no per-order installment plan — see PayrollModule for the
      // real payroll-cycle repayment flow).
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
