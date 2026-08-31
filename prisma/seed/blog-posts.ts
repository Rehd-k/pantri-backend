import {
  BlogPostCategory,
  BlogPostStatus,
  PrismaClient,
} from '../../generated/prisma/client';

type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogPostCategory;
  date: string;
  readTimeMinutes: number;
  coverGradient: string;
  bodyParagraphs: string[];
};

const SEED_POSTS: SeedPost[] = [
  {
    slug: 'build-100k-monthly-food-budget',
    title: 'How to Build a ₦100,000 Monthly Food Budget',
    excerpt:
      'A practical way to split staples, proteins, and extras so a mid-range Nigerian household can plan the month without guesswork.',
    category: BlogPostCategory.BUDGETING,
    date: '2026-07-12',
    readTimeMinutes: 6,
    coverGradient: 'from-emerald-400/40 to-teal-600/30',
    bodyParagraphs: [
      'A ₦100,000 monthly food budget is not a luxury figure for many urban households  it is a working target when rice, oil, protein, and market vegetables all need to fit one envelope.',
      'Start by naming your non-negotiables: the staples you buy every month (rice, beans, garri, oil, seasoning) and the proteins your household actually finishes. Put those on paper before anything “nice to have.”',
      'Next, split the envelope into three buckets: staples (often 40–50%), proteins and perishables (30–40%), and flexibility (snacks, drinks, small treats). Adjust the percentages to your family’s taste, but keep the buckets visible.',
      'Bulk buys help when storage is safe and you will use the stock. Pantri packages and marketplace prices can make a larger basket manageable when your employer offers payroll payment plans  so the cash hit today is smaller even if the monthly food plan stays the same.',
      'Review mid-month. If protein ran hot, trim snacks before cutting the staples that keep dinner on the table. A budget that survives two weeks of reality is better than a perfect spreadsheet that fails on day ten.',
    ],
  },
  {
    slug: 'ten-nigerian-meals-one-basket',
    title: '10 Nigerian Meals You Can Make From One Shopping Basket',
    excerpt:
      'Stretch one well-chosen grocery haul into a week of familiar plates  from jollof to beans and plantain.',
    category: BlogPostCategory.RECIPES,
    date: '2026-07-28',
    readTimeMinutes: 7,
    coverGradient: 'from-orange-400/40 to-red-500/30',
    bodyParagraphs: [
      'One shopping basket does more work when you buy ingredients that appear in more than one dish: rice, tomatoes, pepper, oil, onions, beans, eggs, and a protein that can be stewed or fried.',
      'From that base you can rotate jollof or fried rice, tomato stew with yam or rice, beans and plantain, moi moi, pasta nights, vegetable soup, omelette mornings, and leftover-protein fried rice.',
      'The trick is cooking once, eating twice. A large stew can cover rice midweek and swallow over the weekend. Parboiled beans become both a main and the filling for moi moi.',
      'Pantri’s recipe centre is built around this idea: groceries become a meal plan. Browse recipes on the site, then shop matching ingredients in the app when you are ready to order.',
      'Keep a short “always on hand” list on your phone. When those items are stocked, ten meals stop feeling ambitious and start feeling normal.',
    ],
  },
  {
    slug: 'buy-food-bulk-without-waste',
    title: 'How to Buy Food in Bulk Without Wasting It',
    excerpt:
      'Bulk is only a win if storage, rotation, and realistic portions keep food from spoiling on the shelf.',
    category: BlogPostCategory.FOOD,
    date: '2026-08-05',
    readTimeMinutes: 5,
    coverGradient: 'from-amber-400/40 to-yellow-600/20',
    bodyParagraphs: [
      'Buying in bulk lowers the per-unit price  until unused stock goes stale, rancid, or forgotten. The fix is not “buy less forever”; it is “buy the right bulk.”',
      'Dry goods (rice, beans, flour, seasoning) reward airtight containers and a first-in, first-out habit. Label open dates with masking tape so the oldest bag gets used first.',
      'Oil and spices have limits. Large oil containers are fine if you decant into a smaller bottle for daily use and keep the rest sealed and cool.',
      'Perishables should rarely be bulked beyond a few days unless you have freezer space and a clear cook plan. Freezing portions of stew or cooked beans turns bulk protein into easy weeknights.',
      'If you shop with Pantri packages, treat the item list as a pantry map: note what you already have before you reorder, and use the app to avoid duplicate bags of the same staple.',
    ],
  },
  {
    slug: 'planning-food-nigerian-wedding',
    title: 'Planning Food for a Nigerian Wedding',
    excerpt:
      'Guest counts, rice maths, and staging dry goods early  a calm approach to celebration catering lists.',
    category: BlogPostCategory.EVENTS,
    date: '2026-08-14',
    readTimeMinutes: 8,
    coverGradient: 'from-rose-400/40 to-purple-500/20',
    bodyParagraphs: [
      'Wedding food planning starts with a guest number you believe  not the hopeful RSVP maximum. Build your estimate on confirmed plus a modest buffer, then scale rice, oil, protein, and drinks from there.',
      'Dry goods can often be staged days ahead. Fresh items and fried snacks need tighter windows. Separate your list into “early delivery” and “near-day” so nothing wilts in the store room.',
      'Agree the menu once with the couple or family lead. Scope creep (extra soups, more small chops) is where budgets break. Write substitutions down before the market run.',
      'Pantri’s event planner can give an illustrative shopping estimate for Nigerian celebrations. Use it as a starting point, then talk to Pantri or your caterer for a real quote.',
      'On the day, assign one person to food logistics. Clear ownership beats three relatives “helping” with the same crate of drinks.',
    ],
  },
  {
    slug: 'building-better-family-pantry',
    title: 'Building a Better Family Pantry',
    excerpt:
      'A calm pantry is not a Pinterest shelf  it is staples you rotate, see at a glance, and restock on purpose.',
    category: BlogPostCategory.FAMILY,
    date: '2026-08-22',
    readTimeMinutes: 5,
    coverGradient: 'from-sky-400/40 to-indigo-500/30',
    bodyParagraphs: [
      'A better family pantry starts with visibility. If you cannot see the rice, you will buy rice again. Clear jars or labelled bags beat opaque sacks at the back of a cupboard.',
      'Group by use: grains, oils and sauces, proteins that keep, breakfast items, and “weekend cooking.” Children and helpers find things faster when zones are consistent.',
      'Set a restock ritual  for example, every other Saturday  instead of emergency runs after every empty bottle of oil. A short checklist on the fridge works better than memory.',
      'Match pantry depth to how you cook. A household that eats beans weekly should keep beans; a household that never opens flour should not warehouse flour “just in case.”',
      'When your employer participates in Pantri, family packages can refill the pantry in one go while payroll plans spread the cost. Pair that with the nutrition and recipe tools so stock turns into meals, not clutter.',
    ],
  },
];

export async function seedBlogPosts(prisma: PrismaClient): Promise<void> {
  for (const post of SEED_POSTS) {
    const publishedAt = new Date(`${post.date}T12:00:00.000Z`);
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        bodyParagraphs: post.bodyParagraphs,
        coverGradient: post.coverGradient,
        readTimeMinutes: post.readTimeMinutes,
        status: BlogPostStatus.PUBLISHED,
        publishedAt,
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        bodyParagraphs: post.bodyParagraphs,
        coverGradient: post.coverGradient,
        readTimeMinutes: post.readTimeMinutes,
        status: BlogPostStatus.PUBLISHED,
        publishedAt,
      },
    });
  }
  console.log(`Seeded ${SEED_POSTS.length} blog posts`);
}
