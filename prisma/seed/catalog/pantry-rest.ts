import { PRODUCT_IMAGES } from '../categories';
import { counted, dry, liquid, protein } from './factory';
import { gramPacks, nairaToKobo } from '../pack-pricing';
import type { SeedProductDef } from '../types';

export const DAIRY: SeedProductDef[] = [
  counted('eggs-layer', 'Fresh Eggs', 'eggs-dairy', 'eggs', 'Ogun, Nigeria', 150, 'CHI Farms', ['eggs'], 'Farm-fresh layer eggs.', [
    { each: 6, label: 'Half dozen' },
    { each: 12, label: '1 dozen' },
    { each: 30, label: '1 crate' },
  ], PRODUCT_IMAGES.dairy),
  liquid('peak-milk', 'Peak Evaporated Milk', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 2200, 'Peak', ['milk', 'evaporated'], 'Full cream evaporated milk.', [0.16, 0.41], PRODUCT_IMAGES.dairy),
  liquid('cowbell-milk', 'Cowbell Milk', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 1800, 'Cowbell', ['milk', 'powdered'], 'Instant filled milk drink — liquid pack sizes.', [0.5, 1], PRODUCT_IMAGES.dairy),
  dry('peak-powder', 'Peak Powdered Milk', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 8500, 'Peak', ['milk', 'powder'], 'Full cream milk powder.', PRODUCT_IMAGES.dairy, [1, 2, 5]),
  liquid('yoghurt-plain', 'Plain Yoghurt', 'eggs-dairy', 'yoghurt', 'Lagos, Nigeria', 1600, 'Fan Milk', ['yoghurt'], 'Plain unsweetened yoghurt.', [0.5, 1], PRODUCT_IMAGES.dairy),
  protein('cheese-wara', 'Wara Cheese', 'eggs-dairy', 'cheese', 'Kwara, Nigeria', 4000, 'Ilorin Foods', ['cheese', 'wara'], 'Fresh West African wara cheese.', [1, 2], PRODUCT_IMAGES.dairy),
];

export const CANNED: SeedProductDef[] = [
  {
    slug: 'geisha-mackerel',
    name: 'Geisha Mackerel in Tomato',
    categorySlug: 'canned-bottled',
    subcategorySlug: 'canned-fish',
    familySlug: 'protein-mass',
    origin: 'China',
    description: 'Classic Geisha mackerel in tomato sauce.',
    tags: ['geisha', 'mackerel', 'canned'],
    imageUrl: PRODUCT_IMAGES.canned,
    packs: gramPacks('Geisha', nairaToKobo(4500), [155, 425]),
    isVerified: true,
  },
  {
    slug: 'sardine-titus',
    name: 'Titus Sardines',
    categorySlug: 'canned-bottled',
    subcategorySlug: 'canned-fish',
    familySlug: 'protein-mass',
    origin: 'Morocco',
    description: 'Titus sardines in vegetable oil.',
    tags: ['sardine', 'titus', 'canned'],
    imageUrl: PRODUCT_IMAGES.canned,
    packs: gramPacks('Titus', nairaToKobo(4200), [125, 215]),
    isVerified: true,
  },
  {
    slug: 'corned-beef',
    name: 'Corned Beef',
    categorySlug: 'canned-bottled',
    subcategorySlug: 'corned-beef',
    familySlug: 'protein-mass',
    origin: 'Brazil',
    description: 'Canned corned beef for stews and sandwiches.',
    tags: ['corned-beef', 'canned'],
    imageUrl: PRODUCT_IMAGES.canned,
    packs: gramPacks('Exeter', nairaToKobo(5000), [200, 340]),
    isVerified: true,
  },
  {
    slug: 'baked-beans-canned',
    name: 'Baked Beans',
    categorySlug: 'canned-bottled',
    subcategorySlug: 'baked-beans',
    familySlug: 'dry-staple',
    origin: 'Italy',
    description: 'Baked beans in tomato sauce.',
    tags: ['baked-beans', 'canned'],
    imageUrl: PRODUCT_IMAGES.canned,
    packs: gramPacks('Heinz', nairaToKobo(2800), [415, 800]),
    isVerified: true,
  },
  {
    slug: 'canned-tomato-plum',
    name: 'Canned Plum Tomatoes',
    categorySlug: 'canned-bottled',
    subcategorySlug: 'canned-tomato',
    familySlug: 'paste',
    origin: 'Italy',
    description: 'Peeled plum tomatoes in juice.',
    tags: ['tomato', 'canned'],
    imageUrl: PRODUCT_IMAGES.canned,
    packs: gramPacks('Gino', nairaToKobo(1800), [400, 800]),
    isVerified: true,
  },
];

export const FROZEN: SeedProductDef[] = [
  protein('frozen-croaker', 'Frozen Croaker', 'frozen', 'frozen-fish', 'Lagos, Nigeria', 3800, 'Frozen Seas', ['frozen', 'croaker'], 'IQF croaker steaks.', [1, 2, 5], PRODUCT_IMAGES.frozen),
  protein('frozen-prawn', 'Frozen Prawns', 'frozen', 'frozen-protein', 'Akwa Ibom, Nigeria', 8200, 'Niger Delta Foods', ['frozen', 'prawn'], 'Peeled frozen prawns.', [1, 2], PRODUCT_IMAGES.frozen),
  dry('frozen-spinach', 'Frozen Spinach', 'frozen', 'frozen-veg', 'Plateau, Nigeria', 2200, 'Jos Farms', ['frozen', 'spinach'], 'Blanched frozen spinach.', PRODUCT_IMAGES.frozen, [1, 2]),
  dry('frozen-mixed-veg', 'Frozen Mixed Vegetables', 'frozen', 'frozen-veg', 'Netherlands', 2800, 'Tropical Sun', ['frozen', 'vegetables'], 'Peas, carrots and sweetcorn mix.', PRODUCT_IMAGES.frozen, [1, 2]),
];

export const BREAKFAST: SeedProductDef[] = [
  counted('agege-bread', 'Agege Bread', 'breakfast-bakery', 'bread', 'Lagos, Nigeria', 800, 'Local Bakery', ['bread', 'agege'], 'Soft Agege loaf.', [
    { each: 1, label: '1 loaf' },
    { each: 3, label: '3 loaves' },
  ], PRODUCT_IMAGES.breakfast),
  counted('sliced-bread', 'Sliced White Bread', 'breakfast-bakery', 'bread', 'Lagos, Nigeria', 1200, 'UAC', ['bread', 'sliced'], 'Soft sliced sandwich bread.', [
    { each: 1, label: '1 loaf' },
    { each: 2, label: '2 loaves' },
  ], PRODUCT_IMAGES.breakfast),
  dry('golden-morn', 'Golden Morn', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 3200, 'Nestle', ['cereal', 'golden-morn'], 'Maize and soya breakfast cereal.', PRODUCT_IMAGES.breakfast, [1, 2]),
  dry('cornflakes', 'Cornflakes', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 3800, 'Kellogg', ['cereal', 'cornflakes'], 'Crisp cornflakes.', PRODUCT_IMAGES.breakfast, [1, 2]),
  dry('oats-rolled', 'Rolled Oats', 'breakfast-bakery', 'oats', 'Lagos, Nigeria', 2600, 'Quaker', ['oats'], 'Rolled oats for porridge.', PRODUCT_IMAGES.breakfast, [1, 2, 5]),
];

export const DRINKS: SeedProductDef[] = [
  liquid('bottled-water', 'Bottled Water', 'drinks', 'water', 'Lagos, Nigeria', 200, 'Eva', ['water'], 'Still bottled water.', [0.75, 1.5, 5], PRODUCT_IMAGES.drink),
  liquid('maltina', 'Maltina', 'drinks', 'malt-soda', 'Lagos, Nigeria', 900, 'Maltina', ['malt'], 'Non-alcoholic malt drink.', [0.33, 1], PRODUCT_IMAGES.drink),
  liquid('coca-cola', 'Coca-Cola', 'drinks', 'malt-soda', 'Lagos, Nigeria', 700, 'Coca-Cola', ['soda'], 'Coca-Cola soft drink.', [0.35, 0.5, 1.5], PRODUCT_IMAGES.drink),
  liquid('chivita', 'Chivita Juice', 'drinks', 'juice', 'Lagos, Nigeria', 1400, 'Chivita', ['juice'], 'Mixed fruit juice.', [1, 2], PRODUCT_IMAGES.drink),
  dry('lipton-tea', 'Lipton Yellow Label Tea', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 12000, 'Lipton', ['tea'], 'Black tea bags counted by pack weight.', PRODUCT_IMAGES.drink, [1, 2]),
  dry('nescafe', 'Nescafe Classic', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 18000, 'Nescafe', ['coffee'], 'Instant coffee granules.', PRODUCT_IMAGES.drink, [1, 2]),
  dry('bournvita', 'Bournvita', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 6500, 'Cadbury', ['cocoa', 'bournvita'], 'Malted chocolate drink powder.', PRODUCT_IMAGES.drink, [1, 2, 5]),
  dry('milo', 'Milo', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 6200, 'Nestle', ['cocoa', 'milo'], 'Chocolate malt beverage powder.', PRODUCT_IMAGES.drink, [1, 2, 5]),
];

export const BAKING: SeedProductDef[] = [
  dry('sugar-white', 'White Granulated Sugar', 'baking-staples', 'sugar', 'Lagos, Nigeria', 1400, 'Dangote', ['sugar'], 'Fine white sugar.', PRODUCT_IMAGES.baking, [1, 2, 5, 10, 25]),
  dry('sugar-brown', 'Brown Sugar', 'baking-staples', 'sugar', 'Lagos, Nigeria', 1600, 'Dangote', ['sugar', 'brown'], 'Soft brown sugar.', PRODUCT_IMAGES.baking, [1, 2, 5]),
  dry('wheat-flour-all-purpose', 'All-Purpose Wheat Flour', 'baking-staples', 'flour-wheat', 'Lagos, Nigeria', 1100, 'Honeywell', ['flour', 'wheat'], 'All-purpose wheat flour.', PRODUCT_IMAGES.flour, [1, 2, 5, 10, 25]),
  dry('yeast-instant', 'Instant Yeast', 'baking-staples', 'yeast', 'Lagos, Nigeria', 8000, 'Angel', ['yeast'], 'Instant dry yeast.', PRODUCT_IMAGES.baking, [1, 2]),
  dry('baking-powder', 'Baking Powder', 'baking-staples', 'baking-aids', 'Lagos, Nigeria', 3500, 'Royal', ['baking-powder'], 'Double-acting baking powder.', PRODUCT_IMAGES.baking, [1, 2]),
  dry('baking-soda', 'Baking Soda', 'baking-staples', 'baking-aids', 'Lagos, Nigeria', 2800, 'Royal', ['baking-soda'], 'Bicarbonate of soda.', PRODUCT_IMAGES.baking, [1, 2]),
];

export const MORE_STAPLES: SeedProductDef[] = [
  dry('honey-beans-small', 'Small Honey Beans', 'beans-legumes', 'oloyin', 'Osun, Nigeria', 1550, 'Ibadan Foods', ['beans', 'honey-beans'], 'Smaller-grain honey beans.', PRODUCT_IMAGES.beans),
  dry('drum-beans', 'Drum Beans', 'beans-legumes', 'white-beans', 'Kano, Nigeria', 1300, 'Sahel Grains', ['beans', 'drum'], 'Large white drum beans.', PRODUCT_IMAGES.beans),
  dry('garri-ijebu-premium', 'Premium Ijebu Garri (Fine)', 'swallows-flours', 'garri', 'Ogun, Nigeria', 1250, 'Ijebu Mills', ['garri', 'ijebu', 'fine'], 'Extra-fine Ijebu garri.', PRODUCT_IMAGES.flour),
  dry('tuwo-rice-flour', 'Rice Flour (Tuwo Shinkafa)', 'swallows-flours', 'semo', 'Kebbi, Nigeria', 1600, 'Kebbi Rice', ['rice-flour', 'tuwo'], 'Rice flour for tuwo shinkafa.', PRODUCT_IMAGES.flour),
  dry('coconut-dried', 'Dried Coconut Flakes', 'soup-thickeners', 'melon', 'Lagos, Nigeria', 2600, 'Tropical Sun', ['coconut'], 'Dried coconut flakes.', PRODUCT_IMAGES.seed, [1, 2]),
  counted('maggi-star', 'Maggi Star Cubes', 'spices-seasonings', 'stock-cubes', 'Lagos, Nigeria', 50, 'Maggi', ['maggi', 'stock-cube'], 'Classic Maggi seasoning cubes.', [
    { each: 10, label: '10 cubes' },
    { each: 50, label: '50 cubes' },
    { each: 100, label: '100 cubes' },
  ], PRODUCT_IMAGES.spice),
  counted('knorr-cubes', 'Knorr Chicken Cubes', 'spices-seasonings', 'stock-cubes', 'Lagos, Nigeria', 55, 'Knorr', ['knorr', 'stock-cube'], 'Knorr chicken seasoning cubes.', [
    { each: 8, label: '8 cubes' },
    { each: 50, label: '50 cubes' },
    { each: 100, label: '100 cubes' },
  ], PRODUCT_IMAGES.spice),
  counted('onions-shallot', 'Shallots (Alubosa Elewe)', 'fresh-produce', 'onion', 'Oyo, Nigeria', 40, 'Ibadan Foods', ['shallot', 'onion'], 'Spring onions / shallots.', [
    { each: 10, label: '10 stalks' },
    { each: 25, label: '25 stalks' },
  ]),
  protein('icefish', 'Ice Fish', 'fish-seafood', 'fresh-fish', 'Namibia', 2200, 'Frozen Seas', ['icefish', 'fish'], 'Imported ice fish.', [1, 2, 5], PRODUCT_IMAGES.fish),
  protein('hake-fish', 'Hake', 'fish-seafood', 'fresh-fish', 'Namibia', 2600, 'Frozen Seas', ['hake', 'fish'], 'Frozen hake fillets.', [1, 2, 5], PRODUCT_IMAGES.fish),
  protein('kpomo-smoked', 'Smoked Ponmo', 'meat-offals', 'ponmo', 'Oyo, Nigeria', 2200, 'Ibadan Foods', ['ponmo', 'smoked'], 'Smoked cow skin.'),
];
