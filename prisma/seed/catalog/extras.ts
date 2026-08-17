import { PRODUCT_IMAGES } from '../categories';
import { counted, dry, liquid, protein, spice } from './factory';
import type { SeedProductDef } from '../types';

const extraDry: Array<Parameters<typeof dry>> = [
  ['gboko-rice', 'Gboko Rice', 'rice-grains', 'local', 'Benue, Nigeria', 1320, 'Benue Mills', ['rice', 'gboko'], 'Local rice milled around Gboko.'],
  ['ada-rice', 'Ada Rice', 'rice-grains', 'local', 'Enugu, Nigeria', 1380, 'Eastern Harvest', ['rice', 'ada'], 'South-east local rice with a firm grain.'],
  ['wild-rice-mix', 'Wild Rice Mix', 'rice-grains', 'long-grain', 'USA', 4200, 'Harvest Gold', ['rice', 'wild'], 'Imported wild rice blend for special meals.'],
  ['barley-grain', 'Pearl Barley', 'rice-grains', 'maize', 'Ukraine', 1800, 'Harvest Gold', ['barley'], 'Pearl barley for soups and drinks.'],
  ['fonio-white', 'White Fonio', 'rice-grains', 'acha', 'Plateau, Nigeria', 2400, 'Jos Mills', ['fonio', 'acha'], 'Pale fonio grains, quicker cooking than brown acha.'],
  ['cowpea-black', 'Black Cowpeas', 'beans-legumes', 'black-eyed', 'Kano, Nigeria', 1480, 'Sahel Grains', ['cowpea', 'beans'], 'Black-skinned cowpeas.', PRODUCT_IMAGES.beans],
  ['pigeon-peas', 'Pigeon Peas', 'beans-legumes', 'lentils', 'Enugu, Nigeria', 1700, 'Eastern Harvest', ['pigeon-pea'], 'Pigeon peas for soups and rice.', PRODUCT_IMAGES.beans],
  ['locust-bean-seeds', 'Raw Locust Bean Seeds', 'beans-legumes', 'ukwa', 'Niger, Nigeria', 2100, 'Northern Harvest', ['locust-bean'], 'Raw dawadawa seeds before fermentation.', PRODUCT_IMAGES.beans],
  ['garri-ijebu-coarse', 'Coarse Ijebu Garri', 'swallows-flours', 'garri', 'Ogun, Nigeria', 1000, 'Ijebu Mills', ['garri', 'coarse'], 'Coarse garri for eba.', PRODUCT_IMAGES.flour],
  ['lafun', 'Lafun (White Amala)', 'swallows-flours', 'cassava-flour', 'Oyo, Nigeria', 1300, 'Ibadan Foods', ['lafun', 'amala', 'cassava'], 'Cassava lafun for white amala.', PRODUCT_IMAGES.flour],
  ['tapioca', 'Tapioca Pearls', 'swallows-flours', 'starch', 'Ogun, Nigeria', 1900, 'Ijebu Mills', ['tapioca', 'cassava'], 'Cassava tapioca for breakfast pudding.', PRODUCT_IMAGES.flour],
  ['plantain-chips-cooking', 'Raw Plantain Chips Cut', 'swallows-flours', 'plantain-flour', 'Ondo, Nigeria', 2100, 'Sunshine Foods', ['plantain'], 'Dried plantain slices for grinding.', PRODUCT_IMAGES.flour],
  ['semo-gold', 'Golden Penny Semo', 'swallows-flours', 'semo', 'Lagos, Nigeria', 1650, 'Golden Penny', ['semo'], 'Golden Penny semolina swallow.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]],
  ['honeywell-wheat', 'Honeywell Wheat Meal', 'swallows-flours', 'semo', 'Lagos, Nigeria', 1520, 'Honeywell', ['wheat', 'swallow'], 'Honeywell wheat meal.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]],
];

export const EXTRAS: SeedProductDef[] = [
  ...extraDry.map((args) => dry(...args)),
  liquid('kings-oil', 'Kings Vegetable Oil', 'oils-fats', 'vegetable-oil', 'Lagos, Nigeria', 1580, 'Kings', ['vegetable-oil'], 'Kings brand vegetable oil.', [0.75, 1, 2, 5, 25]),
  liquid('power-oil', 'Power Oil', 'oils-fats', 'vegetable-oil', 'Lagos, Nigeria', 1620, 'Power Oil', ['vegetable-oil'], 'Power Oil for frying.', [0.75, 1, 2, 5]),
  liquid('mamador-oil', 'Mamador Vegetable Oil', 'oils-fats', 'vegetable-oil', 'Lagos, Nigeria', 1650, 'Mamador', ['vegetable-oil'], 'Mamador cooking oil.', [1, 2, 5, 25]),
  liquid('shea-oil', 'Shea Oil', 'oils-fats', 'shea', 'Niger, Nigeria', 4200, 'Northern Harvest', ['shea'], 'Liquid shea oil for cooking.', [0.5, 1]),
  dry('shea-butter', 'Shea Butter', 'oils-fats', 'shea', 'Niger, Nigeria', 3800, 'Northern Harvest', ['shea', 'butter'], 'Unrefined shea butter blocks.', PRODUCT_IMAGES.oil, [1, 2, 5]),
  dry('margarine-blue-band', 'Blue Band Margarine', 'oils-fats', 'margarine', 'Lagos, Nigeria', 3200, 'Blue Band', ['margarine'], 'Blue Band margarine.', PRODUCT_IMAGES.oil, [1, 2]),
  spice('cloves', 'Cloves', 'local-spices', 'India', 14000, 'Tropical Sun', ['cloves'], 'Whole cloves.'),
  spice('bay-leaf', 'Bay Leaves', 'local-spices', 'Turkey', 9000, 'Tropical Sun', ['bay-leaf'], 'Dried bay leaves.'),
  spice('nutmeg-ground', 'Ground Nutmeg', 'local-spices', 'India', 13000, 'Tropical Sun', ['nutmeg'], 'Ground nutmeg.'),
  spice('white-pepper', 'White Pepper', 'pepper-dry', 'India', 10000, 'Tropical Sun', ['pepper', 'white'], 'Ground white pepper.'),
  spice('black-pepper', 'Black Pepper', 'pepper-dry', 'India', 9500, 'Tropical Sun', ['pepper', 'black'], 'Cracked black pepper.'),
  spice('locust-bean-seasoning', 'Dawadawa Powder', 'local-spices', 'Niger, Nigeria', 7000, 'Sahel Spices', ['dawadawa', 'iru'], 'Dried fermented locust bean powder.'),
  counted('afang-leaves', 'Afang Leaves', 'fresh-produce', 'leafy', 'Akwa Ibom, Nigeria', 450, 'Niger Delta Foods', ['afang', 'leafy'], 'Afang (okazi) leaves.', [
    { each: 1, label: '1 wrap' },
    { each: 3, label: '3 wraps' },
  ]),
  counted('edikang-leaves', 'Edikang Ikong Leaves', 'fresh-produce', 'leafy', 'Cross River, Nigeria', 420, 'Niger Delta Foods', ['edikang', 'leafy'], 'Waterleaf and ugu mix packs sold as edikang greens.', [
    { each: 1, label: '1 wrap' },
    { each: 3, label: '3 wraps' },
  ]),
  counted('oha-leaves', 'Oha Leaves', 'fresh-produce', 'leafy', 'Imo, Nigeria', 480, 'Eastern Harvest', ['oha', 'leafy'], 'Fresh oha leaves.', [
    { each: 1, label: '1 wrap' },
    { each: 3, label: '3 wraps' },
  ]),
  counted('uziza-leaf-fresh', 'Fresh Uziza Leaves', 'fresh-produce', 'leafy', 'Rivers, Nigeria', 400, 'Niger Delta Foods', ['uziza', 'leaf'], 'Fresh uziza leaves.', [
    { each: 1, label: '1 wrap' },
    { each: 3, label: '3 wraps' },
  ]),
  counted('cucumber', 'Cucumber', 'fresh-produce', 'garden-egg', 'Plateau, Nigeria', 250, 'Jos Farms', ['cucumber'], 'Fresh cucumbers.', [
    { each: 3, label: '3 pcs' },
    { each: 8, label: '8 pcs' },
  ]),
  counted('cabbage', 'Cabbage', 'fresh-produce', 'leafy', 'Plateau, Nigeria', 900, 'Jos Farms', ['cabbage'], 'Green cabbage heads.', [
    { each: 1, label: '1 head' },
    { each: 3, label: '3 heads' },
  ]),
  counted('carrot', 'Carrots', 'fresh-produce', 'garden-egg', 'Plateau, Nigeria', 80, 'Jos Farms', ['carrot'], 'Fresh carrots.', [
    { each: 6, label: '6 pcs' },
    { each: 15, label: '15 pcs' },
  ]),
  counted('green-beans', 'Green Beans', 'fresh-produce', 'okra', 'Plateau, Nigeria', 30, 'Jos Farms', ['green-beans'], 'French beans.', [
    { each: 20, label: 'small bunch' },
    { each: 40, label: 'large bunch' },
  ]),
  counted('ginger-fresh', 'Fresh Ginger', 'fresh-produce', 'onion', 'Kaduna, Nigeria', 200, 'Sahel Produce', ['ginger', 'fresh'], 'Fresh ginger rhizomes.', [
    { each: 3, label: '3 knobs' },
    { each: 10, label: '10 knobs' },
  ]),
  counted('garlic-fresh', 'Fresh Garlic', 'fresh-produce', 'onion', 'Kano, Nigeria', 150, 'Sahel Produce', ['garlic', 'fresh'], 'Fresh garlic bulbs.', [
    { each: 4, label: '4 bulbs' },
    { each: 12, label: '12 bulbs' },
  ]),
  protein('cow-leg', 'Cow Leg', 'meat-offals', 'beef', 'Kaduna, Nigeria', 3200, 'Northern Meats', ['cowleg', 'beef'], 'Meaty cow leg for pepper soup and stews.'),
  protein('cow-tail', 'Cow Tail', 'meat-offals', 'beef', 'Kaduna, Nigeria', 3600, 'Northern Meats', ['cowtail', 'beef'], 'Cow tail pieces with gelatinous joints.'),
  protein('assorted-meat', 'Assorted Meat Mix', 'meat-offals', 'offals', 'Lagos, Nigeria', 3000, 'City Meats', ['assorted', 'offal'], 'Mixed offals for native soups.'),
  protein('ram-meat', 'Ram Meat', 'meat-offals', 'goat', 'Sokoto, Nigeria', 5600, 'Sahel Meats', ['ram', 'sallah'], 'Ram meat cuts for festive cooking.'),
  protein('turkey-gizzard', 'Turkey Gizzard', 'meat-offals', 'turkey', 'Ogun, Nigeria', 3400, 'CHI Farms', ['gizzard', 'turkey'], 'Cleaned turkey gizzards.'),
  protein('chicken-gizzard', 'Chicken Gizzard', 'meat-offals', 'chicken', 'Ogun, Nigeria', 3000, 'CHI Farms', ['gizzard', 'chicken'], 'Cleaned chicken gizzards.'),
  protein('smoked-fish-bonga', 'Bonga Fish (Smoked)', 'fish-seafood', 'dried-fish', 'Rivers, Nigeria', 4800, 'Niger Delta Foods', ['bonga', 'smoked-fish'], 'Smoked bonga.', [1, 2], PRODUCT_IMAGES.fish),
  protein('dry-prawn', 'Dried Prawns', 'fish-seafood', 'shrimp', 'Akwa Ibom, Nigeria', 9800, 'Niger Delta Foods', ['prawn', 'dried'], 'Sun-dried prawns.', [1, 2], PRODUCT_IMAGES.fish),
  liquid('hollandia-yoghurt', 'Hollandia Yoghurt', 'eggs-dairy', 'yoghurt', 'Lagos, Nigeria', 1800, 'Hollandia', ['yoghurt'], 'Hollandia yoghurt drink.', [0.5, 1], PRODUCT_IMAGES.dairy),
  liquid('vita-milk', 'Vita Milk', 'eggs-dairy', 'milk', 'Lagos, Nigeria', 1400, 'Vita', ['milk'], 'Flavoured milk drink.', [0.5, 1], PRODUCT_IMAGES.dairy),
  liquid('amstel-malt', 'Amstel Malta', 'drinks', 'malt-soda', 'Lagos, Nigeria', 950, 'Amstel', ['malt'], 'Amstel Malta.', [0.33, 1], PRODUCT_IMAGES.drink),
  liquid('fanta', 'Fanta Orange', 'drinks', 'malt-soda', 'Lagos, Nigeria', 700, 'Coca-Cola', ['soda', 'fanta'], 'Fanta orange.', [0.35, 0.5, 1.5], PRODUCT_IMAGES.drink),
  liquid('sprite', 'Sprite', 'drinks', 'malt-soda', 'Lagos, Nigeria', 700, 'Coca-Cola', ['soda', 'sprite'], 'Sprite lemon-lime.', [0.35, 0.5, 1.5], PRODUCT_IMAGES.drink),
  liquid('zobo-concentrate', 'Zobo Concentrate', 'drinks', 'juice', 'Kano, Nigeria', 1600, 'Sahel Drinks', ['zobo', 'hibiscus'], 'Hibiscus zobo concentrate.', [0.5, 1], PRODUCT_IMAGES.drink),
  dry('zobo-leaves', 'Dried Zobo Leaves', 'drinks', 'tea-coffee', 'Kano, Nigeria', 2200, 'Sahel Grains', ['zobo', 'hibiscus'], 'Dried hibiscus calyces.', PRODUCT_IMAGES.drink, [1, 2, 5]),
  dry('top-tea', 'Top Tea', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 11000, 'Top Tea', ['tea'], 'Top Tea bags by weight.', PRODUCT_IMAGES.drink, [1, 2]),
  dry('ovaltine', 'Ovaltine', 'drinks', 'tea-coffee', 'Lagos, Nigeria', 6400, 'Ovaltine', ['cocoa', 'ovaltine'], 'Malted chocolate drink.', PRODUCT_IMAGES.drink, [1, 2, 5]),
  counted('indomie-packs', 'Indomie Noodles', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 250, 'Indomie', ['noodles', 'indomie'], 'Indomie chicken noodles.', [
    { each: 5, label: '5 packs' },
    { each: 40, label: '1 carton (40)' },
  ], PRODUCT_IMAGES.breakfast),
  dry('spaghetti', 'Spaghetti', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 1400, 'Golden Penny', ['spaghetti', 'pasta'], 'Golden Penny spaghetti.', PRODUCT_IMAGES.breakfast, [1, 2, 5]),
  dry('macaroni', 'Macaroni', 'breakfast-bakery', 'cereal', 'Lagos, Nigeria', 1450, 'Golden Penny', ['macaroni', 'pasta'], 'Elbow macaroni.', PRODUCT_IMAGES.breakfast, [1, 2, 5]),
  counted('moi-moi-leaves', 'Uma / Moi-moi Leaves', 'fresh-produce', 'leafy', 'Ogun, Nigeria', 20, 'Ijebu Mills', ['uma', 'leaves'], 'Wrap leaves for moi-moi.', [
    { each: 20, label: '20 leaves' },
    { each: 50, label: '50 leaves' },
  ]),
];
