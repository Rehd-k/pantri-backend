import { PRODUCT_IMAGES } from '../categories';
import { dry, liquid, spice, paste } from './factory';
import type { SeedProductDef } from '../types';

export const SWALLOWS: SeedProductDef[] = [
  dry('garri-white', 'White Garri', 'swallows-flours', 'garri', 'Ogun, Nigeria', 900, 'Ijebu Mills', ['garri', 'cassava', 'swallow'], 'Crisp white garri for eba, soaking and snacks.', PRODUCT_IMAGES.flour),
  dry('garri-yellow', 'Yellow Garri', 'swallows-flours', 'garri', 'Delta, Nigeria', 950, 'Delta Foods', ['garri', 'yellow'], 'Palm-oil tinted yellow garri with a slightly sour note.', PRODUCT_IMAGES.flour),
  dry('garri-ijebu', 'Ijebu Garri', 'swallows-flours', 'garri', 'Ogun, Nigeria', 1100, 'Ijebu Mills', ['garri', 'ijebu'], 'Fine, extra-sour Ijebu garri prized for soaking.', PRODUCT_IMAGES.flour),
  dry('fufu-flour', 'Fufu Flour (Akpu)', 'swallows-flours', 'fufu', 'Anambra, Nigeria', 1400, 'Eastern Harvest', ['fufu', 'akpu', 'cassava'], 'Fermented cassava fufu mix that stirs smooth.', PRODUCT_IMAGES.flour),
  dry('semovita', 'Semovita', 'swallows-flours', 'semo', 'Lagos, Nigeria', 1600, 'Golden Penny', ['semo', 'semovita', 'swallow'], 'Popular wheat-based swallow that sets firm.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]),
  dry('semolina', 'Semolina', 'swallows-flours', 'semo', 'Lagos, Nigeria', 1550, 'Dangote', ['semolina', 'swallow'], 'Fine semolina for swallows and puddings.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]),
  dry('poundo-yam', 'Poundo Yam', 'swallows-flours', 'poundo', 'Oyo, Nigeria', 2400, 'Ayoola', ['poundo', 'yam', 'swallow'], 'Instant pounded-yam mix with a stretchy finish.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]),
  dry('elubo-amala', 'Elubo (Yam Flour)', 'swallows-flours', 'elubo', 'Oyo, Nigeria', 1800, 'Ibadan Foods', ['elubo', 'amala', 'yam-flour'], 'Fermented yam flour for amala.', PRODUCT_IMAGES.flour),
  dry('cassava-flour', 'Cassava Flour', 'swallows-flours', 'cassava-flour', 'Ogun, Nigeria', 1200, 'Ijebu Mills', ['cassava', 'flour', 'gluten-free'], 'Sun-dried cassava flour for baking and swallows.', PRODUCT_IMAGES.flour),
  dry('plantain-flour', 'Plantain Flour', 'swallows-flours', 'plantain-flour', 'Ondo, Nigeria', 2000, 'Sunshine Foods', ['plantain', 'flour'], 'Unripe plantain flour for swallows and weaning meals.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('okpa-flour', 'Okpa Flour', 'swallows-flours', 'okpa', 'Enugu, Nigeria', 2200, 'Eastern Harvest', ['okpa', 'bambara'], 'Milled bambara flour ready for steamed okpa.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('starch-delta', 'Delta Starch', 'swallows-flours', 'starch', 'Delta, Nigeria', 1700, 'Delta Foods', ['starch', 'banga'], 'Cassava starch for native starch swallow with banga soup.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('ogi-white', 'White Ogi / Pap', 'swallows-flours', 'ogi', 'Oyo, Nigeria', 1000, 'Ibadan Foods', ['ogi', 'pap', 'akamu'], 'Fermented maize ogi for breakfast pap.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('ogi-yellow', 'Yellow Ogi', 'swallows-flours', 'ogi', 'Kwara, Nigeria', 1050, 'Ilorin Foods', ['ogi', 'yellow'], 'Yellow maize ogi with a sweeter porridge flavour.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('custard-powder', 'Custard Powder', 'swallows-flours', 'ogi', 'Lagos, Nigeria', 2100, 'Checkers', ['custard', 'breakfast'], 'Vanilla custard powder for breakfast and weaning.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('corn-flour', 'Corn Flour', 'swallows-flours', 'cassava-flour', 'Kaduna, Nigeria', 1100, 'Northern Harvest', ['corn', 'flour'], 'Fine corn flour for pap, baking and coating.', PRODUCT_IMAGES.flour),
  dry('wheat-meal', 'Wheat Meal', 'swallows-flours', 'semo', 'Lagos, Nigeria', 1500, 'Honeywell', ['wheat', 'swallow'], 'Whole wheat meal swallow with a slightly nutty taste.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]),
];

export const OILS: SeedProductDef[] = [
  liquid('palm-oil-red', 'Red Palm Oil', 'oils-fats', 'palm-oil', 'Edo, Nigeria', 1800, 'Mamador', ['palm-oil', 'red-oil'], 'Deep red unrefined palm oil for stews and banga.', [1, 2, 5, 25]),
  liquid('palm-oil-refined', 'Refined Palm Oil', 'oils-fats', 'palm-oil', 'Rivers, Nigeria', 1700, 'Power Oil', ['palm-oil', 'refined'], 'Lighter refined palm olein for frying.', [1, 2, 5, 25]),
  liquid('vegetable-oil', 'Vegetable Cooking Oil', 'oils-fats', 'vegetable-oil', 'Lagos, Nigeria', 1600, 'Devon King', ['vegetable-oil', 'frying'], 'Neutral vegetable oil for everyday frying.', [0.75, 1, 2, 5, 25]),
  liquid('groundnut-oil', 'Groundnut Oil', 'oils-fats', 'groundnut-oil', 'Kano, Nigeria', 2200, 'Grand', ['groundnut-oil'], 'Aromatic groundnut oil for frying and salads.', [0.75, 1, 2, 5]),
  liquid('coconut-oil', 'Coconut Oil', 'oils-fats', 'coconut-oil', 'Lagos, Nigeria', 3500, 'Tropical Sun', ['coconut-oil'], 'Virgin coconut oil for cooking and finishing.', [0.5, 1, 2]),
  liquid('olive-oil', 'Olive Oil', 'oils-fats', 'vegetable-oil', 'Spain', 6500, 'Bertolli', ['olive-oil', 'imported'], 'Extra virgin olive oil for dressings and light cooking.', [0.5, 1]),
];

export const THICKENERS: SeedProductDef[] = [
  dry('egusi-melon', 'Egusi (Melon Seeds)', 'soup-thickeners', 'egusi', 'Kogi, Nigeria', 2800, 'Middle Belt Foods', ['egusi', 'melon', 'soup'], 'Shelled egusi for thickened vegetable soups.', PRODUCT_IMAGES.seed, [1, 2, 5]),
  dry('egusi-ground', 'Ground Egusi', 'soup-thickeners', 'egusi', 'Kogi, Nigeria', 3000, 'Middle Belt Foods', ['egusi', 'ground'], 'Ready-milled egusi to stir straight into soup.', PRODUCT_IMAGES.seed, [1, 2, 5]),
  dry('ogbono', 'Ogbono Seeds', 'soup-thickeners', 'ogbono', 'Cross River, Nigeria', 4200, 'Eastern Harvest', ['ogbono', 'soup'], 'Dried ogbono that draws a classic mucilaginous soup.', PRODUCT_IMAGES.seed, [1, 2, 5]),
  dry('ogbono-ground', 'Ground Ogbono', 'soup-thickeners', 'ogbono', 'Cross River, Nigeria', 4500, 'Eastern Harvest', ['ogbono', 'ground'], 'Pre-ground ogbono for faster soup prep.', PRODUCT_IMAGES.seed, [1, 2]),
  dry('achi-seed', 'Achi Seeds', 'soup-thickeners', 'achi', 'Enugu, Nigeria', 3800, 'Eastern Harvest', ['achi', 'thickener'], 'Achi thickener for ofe nsala and onugbu.', PRODUCT_IMAGES.seed, [1, 2]),
  dry('ofor-seed', 'Ofor Seeds', 'soup-thickeners', 'ofor', 'Anambra, Nigeria', 4000, 'Eastern Harvest', ['ofor', 'thickener'], 'Ofor (thickener) used with bitterleaf soups.', PRODUCT_IMAGES.seed, [1, 2]),
  dry('uziza-seed', 'Uziza Seeds', 'soup-thickeners', 'uziza-seed', 'Rivers, Nigeria', 5000, 'Niger Delta Foods', ['uziza', 'spice'], 'Peppery uziza seeds for native soups.', PRODUCT_IMAGES.spice, [1, 2]),
  dry('sesame-beniseed', 'Beni-seed (Sesame)', 'soup-thickeners', 'melon', 'Benue, Nigeria', 2400, 'Benue Mills', ['sesame', 'beniseed'], 'Sesame seeds for soups, snacks and garnishes.', PRODUCT_IMAGES.seed, [1, 2, 5]),
];

export const SPICES: SeedProductDef[] = [
  spice('curry-powder', 'Curry Powder', 'curry-thyme', 'Lagos, Nigeria', 8000, 'Tasty Tom', ['curry', 'spice'], 'All-purpose Nigerian curry blend.'),
  spice('thyme-dried', 'Dried Thyme', 'curry-thyme', 'Lagos, Nigeria', 9000, 'Tasty Tom', ['thyme', 'herb'], 'Dried thyme leaves for stews and jollof.'),
  spice('ginger-powder', 'Ginger Powder', 'ginger-garlic', 'Kaduna, Nigeria', 7000, 'Sahel Spices', ['ginger'], 'Ground dried ginger.'),
  spice('garlic-powder', 'Garlic Powder', 'ginger-garlic', 'Kano, Nigeria', 7500, 'Sahel Spices', ['garlic'], 'Ground garlic for marinades and stews.'),
  spice('ginger-dried', 'Dried Ginger Whole', 'ginger-garlic', 'Kaduna, Nigeria', 4500, 'Sahel Spices', ['ginger', 'whole'], 'Whole dried ginger rhizomes.', [100, 250, 500, 1000]),
  spice('garlic-dried', 'Dried Garlic', 'ginger-garlic', 'Kano, Nigeria', 4800, 'Sahel Spices', ['garlic', 'whole'], 'Peeled dried garlic cloves.', [100, 250, 500, 1000]),
  spice('cameroon-pepper', 'Cameroon Pepper', 'pepper-dry', 'Cross River, Nigeria', 6000, 'Niger Delta Foods', ['pepper', 'cameroon'], 'Smoky hot Cameroon pepper powder.'),
  spice('cayenne-pepper', 'Cayenne Pepper', 'pepper-dry', 'Kano, Nigeria', 5500, 'Sahel Spices', ['pepper', 'cayenne'], 'Bright red cayenne for heat.'),
  spice('ata-gile', 'Ata Gile (Dried Atarodo)', 'pepper-dry', 'Oyo, Nigeria', 5000, 'Ibadan Foods', ['pepper', 'atarodo'], 'Sun-dried scotch bonnet flakes.'),
  spice('ehuru', 'Ehuru (Calabash Nutmeg)', 'local-spices', 'Anambra, Nigeria', 12000, 'Eastern Harvest', ['ehuru', 'nutmeg'], 'Toasted ehuru for pepper soup and native rice.'),
  spice('uda', 'Uda (Negro Pepper)', 'local-spices', 'Cross River, Nigeria', 11000, 'Eastern Harvest', ['uda', 'pepper-soup'], 'Uda pods for pepper soup spice mix.'),
  spice('uziza-leaf-dry', 'Dried Uziza Leaves', 'local-spices', 'Rivers, Nigeria', 8000, 'Niger Delta Foods', ['uziza', 'leaf'], 'Dried uziza leaves for ofe nsala.'),
  spice('scent-leaf-dry', 'Dried Scent Leaf', 'local-spices', 'Edo, Nigeria', 7000, 'Edo Foods', ['scent-leaf', 'nchuanwu'], 'Dried scent leaf for pepper soup.'),
  spice('turmeric-powder', 'Turmeric Powder', 'local-spices', 'Kaduna, Nigeria', 6500, 'Sahel Spices', ['turmeric'], 'Ground turmeric for colour and aroma.'),
  spice('crayfish-ground', 'Ground Crayfish', 'crayfish', 'Akwa Ibom, Nigeria', 9000, 'Niger Delta Foods', ['crayfish', 'seafood'], 'Sun-dried ground crayfish umami bomb.', [100, 250, 500, 1000]),
  spice('crayfish-whole', 'Whole Dried Crayfish', 'crayfish', 'Akwa Ibom, Nigeria', 8500, 'Niger Delta Foods', ['crayfish', 'whole'], 'Whole dried crayfish to pound fresh.', [100, 250, 500, 1000]),
  spice('iodized-salt', 'Iodized Table Salt', 'salt', 'Lagos, Nigeria', 400, 'Dangote', ['salt'], 'Fine iodized salt.', [250, 500, 1000, 2000]),
  spice('sea-salt', 'Sea Salt', 'salt', 'Lagos, Nigeria', 1200, 'Tropical Sun', ['salt', 'sea'], 'Coarse sea salt.', [250, 500, 1000]),
  spice('seasoning-powder', 'Seasoning Powder', 'stock-cubes', 'Lagos, Nigeria', 5000, 'Knorr', ['seasoning', 'powder'], 'All-purpose seasoning powder.', [100, 250, 400, 800]),
];

export const PASTES: SeedProductDef[] = [
  paste('tomato-paste-gini', 'Tomato Paste', 'tomato-paste', 'Lagos, Nigeria', 2800, 'Gino', ['tomato', 'paste'], 'Double-concentrated tomato paste.'),
  paste('tomato-paste-tasty', 'Tomato Mix', 'tomato-paste', 'Lagos, Nigeria', 2600, 'Tasty Tom', ['tomato', 'mix'], 'Ready tomato mix for jollof and stew.'),
  paste('pepper-mix-frozen-style', 'Bottled Pepper Mix', 'pepper-mix', 'Lagos, Nigeria', 2200, 'Mama Put', ['pepper', 'mix'], 'Blended tatashe, ata rodo and tomato.'),
  paste('iru-locust', 'Iru (Locust Beans)', 'iru-ogiri', 'Oyo, Nigeria', 6000, 'Ibadan Foods', ['iru', 'locust-bean'], 'Fermented locust beans for stews.', [50, 100, 250, 500]),
  paste('ogiri-okpei', 'Ogiri / Okpei', 'iru-ogiri', 'Anambra, Nigeria', 6500, 'Eastern Harvest', ['ogiri', 'okpei'], 'Fermented oil-bean paste for native soups.', [50, 100, 250]),
  paste('soy-sauce', 'Soy Sauce', 'sauces', 'China', 3500, 'Tropical Sun', ['soy-sauce'], 'Dark soy sauce for fried rice.', [150, 300, 500, 1000]),
  paste('vinegar-white', 'White Vinegar', 'sauces', 'Lagos, Nigeria', 1800, 'Dangote', ['vinegar'], 'White vinegar for pickling and cleaning produce.', [500, 1000, 2000]),
];
