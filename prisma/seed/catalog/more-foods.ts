import { PRODUCT_IMAGES } from '../categories';
import { counted, dry, liquid, protein, spice } from './factory';
import type { SeedProductDef } from '../types';

const wraps = [
  { each: 1, label: '1 wrap' },
  { each: 3, label: '3 wraps' },
];

export const MORE_FOODS: SeedProductDef[] = [
  dry('jollof-rice-mix', 'Jollof Rice Spice Mix', 'rice-grains', 'long-grain', 'Lagos, Nigeria', 4500, 'Tasty Tom', ['jollof', 'spice-mix'], 'Dry jollof seasoning mix to cook with long grain rice.', PRODUCT_IMAGES.spice, [1, 2]),
  dry('fried-rice-mix', 'Fried Rice Spice Mix', 'rice-grains', 'long-grain', 'Lagos, Nigeria', 4600, 'Tasty Tom', ['fried-rice', 'spice-mix'], 'Fried rice seasoning blend.', PRODUCT_IMAGES.spice, [1, 2]),
  dry('tuwo-masara-mix', 'Tuwo Masara Mix', 'swallows-flours', 'semo', 'Kano, Nigeria', 1200, 'Sahel Grains', ['tuwo', 'maize'], 'Ready maize flour for tuwo masara.', PRODUCT_IMAGES.flour),
  dry('tuwo-shinkafa-rice', 'Tuwo Shinkafa Rice', 'rice-grains', 'local', 'Kebbi, Nigeria', 1450, 'Kebbi Rice', ['tuwo', 'rice'], 'Soft local rice preferred for tuwo shinkafa.'),
  dry('masa-rice', 'Masa Rice', 'rice-grains', 'local', 'Kaduna, Nigeria', 1400, 'Northern Harvest', ['masa', 'rice'], 'Broken-leaning rice for masa cakes.'),
  dry('groundnut-paste', 'Groundnut Paste', 'beans-legumes', 'groundnuts', 'Kano, Nigeria', 2400, 'Sahel Grains', ['groundnut', 'paste'], 'Natural peanut paste for soups and snacks.', PRODUCT_IMAGES.seed, [1, 2, 5]),
  dry('kulikuli', 'Kulikuli', 'beans-legumes', 'groundnuts', 'Niger, Nigeria', 2600, 'Northern Harvest', ['kulikuli', 'groundnut'], 'Crunchy groundnut snack also used in soups.', PRODUCT_IMAGES.seed, [1, 2]),
  dry('cashew-nuts', 'Cashew Nuts', 'beans-legumes', 'groundnuts', 'Ondo, Nigeria', 8500, 'Sunshine Foods', ['cashew'], 'Raw cashew nuts.', PRODUCT_IMAGES.seed, [1, 2]),
  dry('tiger-nuts', 'Tiger Nuts (Aya)', 'beans-legumes', 'groundnuts', 'Kano, Nigeria', 2800, 'Sahel Grains', ['tiger-nut', 'aya'], 'Dried tiger nuts for kunu aya.', PRODUCT_IMAGES.seed, [1, 2, 5]),
  spice('shrimp-bouillon', 'Shrimp Bouillon Powder', 'stock-cubes', 'Lagos, Nigeria', 6200, 'Knorr', ['bouillon', 'shrimp'], 'Shrimp-flavoured seasoning powder.'),
  spice('chicken-bouillon', 'Chicken Bouillon Powder', 'stock-cubes', 'Lagos, Nigeria', 5800, 'Maggi', ['bouillon', 'chicken'], 'Chicken bouillon powder.'),
  spice('beef-bouillon', 'Beef Bouillon Powder', 'stock-cubes', 'Lagos, Nigeria', 5800, 'Maggi', ['bouillon', 'beef'], 'Beef bouillon powder.'),
  spice('pepper-soup-spice', 'Pepper Soup Spice Mix', 'local-spices', 'Rivers, Nigeria', 8500, 'Niger Delta Foods', ['pepper-soup', 'spice'], 'Blended uda, ehuru and chilli for pepper soup.'),
  spice('suya-spice', 'Suya Spice (Yaji)', 'local-spices', 'Kano, Nigeria', 7000, 'Sahel Spices', ['suya', 'yaji'], 'Roasted peanut-chilli yaji mix.'),
  spice('jollof-stew-spice', 'Stew Spice Mix', 'curry-thyme', 'Lagos, Nigeria', 6400, 'Tasty Tom', ['stew', 'spice'], 'Curry, thyme and chilli blend for Nigerian stew.'),
  counted('curry-leaf', 'Curry Leaves', 'fresh-produce', 'leafy', 'Lagos, Nigeria', 200, 'Jos Farms', ['curry-leaf'], 'Fresh curry leaf sprigs.', wraps),
  counted('basil-efirin', 'Efirin (Basil)', 'fresh-produce', 'leafy', 'Oyo, Nigeria', 250, 'Ibadan Foods', ['efirin', 'basil'], 'Nigerian basil / efirin.', wraps),
  counted('mint', 'Mint Leaves', 'fresh-produce', 'leafy', 'Plateau, Nigeria', 220, 'Jos Farms', ['mint'], 'Fresh mint bunches.', wraps),
  counted('parsley', 'Parsley', 'fresh-produce', 'leafy', 'Plateau, Nigeria', 250, 'Jos Farms', ['parsley'], 'Flat-leaf parsley.', wraps),
  counted('lettuce', 'Lettuce', 'fresh-produce', 'leafy', 'Plateau, Nigeria', 700, 'Jos Farms', ['lettuce'], 'Iceberg lettuce heads.', [
    { each: 1, label: '1 head' },
    { each: 3, label: '3 heads' },
  ]),
  counted('green-pepper', 'Green Bell Pepper', 'fresh-produce', 'pepper-fresh', 'Plateau, Nigeria', 180, 'Jos Farms', ['bell-pepper'], 'Green peppers for fried rice.', [
    { each: 3, label: '3 pcs' },
    { each: 8, label: '8 pcs' },
  ]),
  counted('spring-onion', 'Spring Onions', 'fresh-produce', 'onion', 'Plateau, Nigeria', 50, 'Jos Farms', ['spring-onion'], 'Spring onions.', [
    { each: 5, label: '5 stalks' },
    { each: 15, label: '15 stalks' },
  ]),
  counted('lime', 'Lime', 'fresh-produce', 'tomato', 'Edo, Nigeria', 80, 'Edo Foods', ['lime'], 'Fresh limes.', [
    { each: 6, label: '6 pcs' },
    { each: 12, label: '12 pcs' },
  ]),
  counted('lemon', 'Lemon', 'fresh-produce', 'tomato', 'Plateau, Nigeria', 100, 'Jos Farms', ['lemon'], 'Fresh lemons.', [
    { each: 4, label: '4 pcs' },
    { each: 10, label: '10 pcs' },
  ]),
  counted('avocado', 'Avocado Pear', 'plantain-banana', 'banana', 'Plateau, Nigeria', 400, 'Jos Farms', ['avocado'], 'Ripe avocado pears.', [
    { each: 2, label: '2 pcs' },
    { each: 6, label: '6 pcs' },
  ], PRODUCT_IMAGES.plantain),
  counted('coconut-fresh', 'Fresh Coconut', 'plantain-banana', 'banana', 'Lagos, Nigeria', 500, 'Tropical Sun', ['coconut'], 'Whole fresh coconuts.', [
    { each: 1, label: '1 nut' },
    { each: 4, label: '4 nuts' },
  ], PRODUCT_IMAGES.plantain),
  counted('water-yam', 'Water Yam', 'tubers-roots', 'yam', 'Anambra, Nigeria', 1800, 'Eastern Harvest', ['water-yam'], 'Water yam tubers for porridge.', [
    { each: 1, label: '1 tuber' },
    { each: 3, label: '3 tubers' },
  ], PRODUCT_IMAGES.tuber),
  counted('yellow-yam', 'Yellow Yam', 'tubers-roots', 'yam', 'Oyo, Nigeria', 2600, 'Ibadan Foods', ['yam', 'yellow'], 'Yellow yam for pounding.', [
    { each: 1, label: '1 tuber' },
    { each: 3, label: '3 tubers' },
  ], PRODUCT_IMAGES.tuber),
  protein('beef-bone', 'Beef Bones', 'meat-offals', 'beef', 'Kaduna, Nigeria', 1800, 'Northern Meats', ['beef', 'bones'], 'Marrow bones for stock.'),
  protein('goat-offal', 'Goat Offals', 'meat-offals', 'offals', 'Sokoto, Nigeria', 3400, 'Sahel Meats', ['goat', 'offal'], 'Goat offal mix.'),
  protein('turkey-wings', 'Turkey Wings', 'meat-offals', 'turkey', 'Ogun, Nigeria', 3600, 'CHI Farms', ['turkey', 'wings'], 'Turkey wings.'),
  protein('chicken-wings', 'Chicken Wings', 'meat-offals', 'chicken', 'Ogun, Nigeria', 3300, 'CHI Farms', ['chicken', 'wings'], 'Chicken wings.'),
  protein('chicken-laps', 'Chicken Laps', 'meat-offals', 'chicken', 'Ogun, Nigeria', 3500, 'CHI Farms', ['chicken', 'laps'], 'Chicken drumsticks and thighs.'),
  protein('smoked-turkey', 'Smoked Turkey', 'meat-offals', 'turkey', 'Ogun, Nigeria', 4800, 'CHI Farms', ['turkey', 'smoked'], 'Smoked turkey parts.'),
  protein('dried-prawn-crayfish-mix', 'Seafood Mix (Dried)', 'fish-seafood', 'shrimp', 'Akwa Ibom, Nigeria', 7200, 'Niger Delta Foods', ['seafood', 'dried'], 'Mixed dried shrimp and crayfish.', [1, 2], PRODUCT_IMAGES.fish),
  protein('stockfish-head', 'Stockfish Head', 'fish-seafood', 'stockfish', 'Norway', 7000, 'Frozen Seas', ['stockfish'], 'Stockfish heads for soups.', [1, 2], PRODUCT_IMAGES.fish),
  protein('panla-fresh', 'Fresh Panla', 'fish-seafood', 'fresh-fish', 'Lagos, Nigeria', 3000, 'Lagos Fish Market', ['panla', 'hake'], 'Fresh panla steaks.', [1, 2, 5], PRODUCT_IMAGES.fish),
  liquid('peak-uht', 'Peak UHT Milk', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 1600, 'Peak', ['milk', 'uht'], 'Peak long-life milk.', [1], PRODUCT_IMAGES.dairy),
  liquid('hollandia-evap', 'Hollandia Evaporated Milk', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 2100, 'Hollandia', ['milk', 'evaporated'], 'Hollandia evaporated milk.', [0.16, 0.41], PRODUCT_IMAGES.dairy),
  dry('cowbell-sachet', 'Cowbell Milk Powder', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 7200, 'Cowbell', ['milk', 'powder'], 'Cowbell instant milk powder.', PRODUCT_IMAGES.dairy, [1, 2, 5]),
  liquid('5-alive', '5 Alive Juice', 'drinks', 'juice', 'Lagos, Nigeria', 1300, 'Coca-Cola', ['juice'], '5 Alive citrus juice.', [1, 2], PRODUCT_IMAGES.drink),
  liquid('chivita-active', 'Chivita Active', 'drinks', 'juice', 'Lagos, Nigeria', 1500, 'Chivita', ['juice'], 'Chivita Active juice drink.', [1], PRODUCT_IMAGES.drink),
  liquid('lacasera', 'La Casera', 'drinks', 'malt-soda', 'Lagos, Nigeria', 650, 'La Casera', ['soda', 'apple'], 'Apple soda.', [0.35, 0.5], PRODUCT_IMAGES.drink),
  liquid('fearless', 'Fearless Energy', 'drinks', 'malt-soda', 'Lagos, Nigeria', 800, 'Fearless', ['energy-drink'], 'Fearless energy drink.', [0.4], PRODUCT_IMAGES.drink),
  dry('bournvita-refill', 'Bournvita Refill', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 6000, 'Cadbury', ['bournvita'], 'Bournvita refill pack.', PRODUCT_IMAGES.drink, [1, 2]),
  dry('custard-checkors', 'Checkers Custard', 'swallows-flours', 'ogi', 'Lagos, Nigeria', 2000, 'Checkers', ['custard'], 'Checkers vanilla custard.', PRODUCT_IMAGES.flour, [1, 2, 5]),
  dry('cerelac', 'Cerelac', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 5500, 'Nestle', ['cerelac', 'weaning'], 'Infant cereal (family pantry).', PRODUCT_IMAGES.breakfast, [1, 2]),
  dry('gold-morn-refill', 'Golden Morn Refill', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 3000, 'Nestle', ['golden-morn'], 'Golden Morn refill.', PRODUCT_IMAGES.breakfast, [1, 2]),
  dry('sugar-cube', 'Sugar Cubes', 'baking-staples', 'sugar', 'Lagos, Nigeria', 1600, 'Dangote', ['sugar', 'cubes'], 'White sugar cubes.', PRODUCT_IMAGES.baking, [1, 2]),
  dry('icing-sugar', 'Icing Sugar', 'baking-staples', 'sugar', 'Lagos, Nigeria', 1800, 'Dangote', ['sugar', 'icing'], 'Icing sugar.', PRODUCT_IMAGES.baking, [1, 2]),
  dry('self-raising-flour', 'Self-Raising Flour', 'baking-staples', 'flour-wheat', 'Lagos, Nigeria', 1250, 'Honeywell', ['flour', 'self-raising'], 'Self-raising wheat flour.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]),
  dry('corn-starch', 'Corn Starch', 'baking-staples', 'baking-aids', 'Lagos, Nigeria', 2200, 'Tropical Sun', ['corn-starch'], 'Corn starch thickener.', PRODUCT_IMAGES.baking, [1, 2]),
  dry('gelatin', 'Gelatin Powder', 'baking-staples', 'baking-aids', 'Lagos, Nigeria', 9000, 'Royal', ['gelatin'], 'Unflavoured gelatin.', PRODUCT_IMAGES.baking, [1]),
  counted('gino-sachets', 'Gino Tomato Sachets', 'condiments-pastes', 'tomato-paste', 'Lagos, Nigeria', 80, 'Gino', ['tomato', 'sachet'], 'Small tomato paste sachets.', [
    { each: 10, label: '10 sachets' },
    { each: 50, label: '50 sachets' },
  ], PRODUCT_IMAGES.canned),
  counted('maggi-crayfish', 'Maggi Crayfish Cubes', 'spices-seasonings', 'stock-cubes', 'Lagos, Nigeria', 55, 'Maggi', ['maggi', 'crayfish'], 'Crayfish Maggi cubes.', [
    { each: 10, label: '10 cubes' },
    { each: 50, label: '50 cubes' },
  ], PRODUCT_IMAGES.spice),
  counted('knorr-seasoning', 'Knorr Seasoning Cubes', 'spices-seasonings', 'stock-cubes', 'Lagos, Nigeria', 55, 'Knorr', ['knorr'], 'Knorr all-purpose cubes.', [
    { each: 8, label: '8 cubes' },
    { each: 50, label: '50 cubes' },
  ], PRODUCT_IMAGES.spice),
];
