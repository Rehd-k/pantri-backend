import { PRODUCT_IMAGES } from '../categories';
import { counted, protein } from './factory';
import type { SeedProductDef } from '../types';

const bunch = [
  { each: 1, label: '1 bunch' },
  { each: 3, label: '3 bunches' },
  { each: 5, label: '5 bunches' },
];
const pieces = [
  { each: 1, label: '1 piece' },
  { each: 5, label: '5 pieces' },
  { each: 10, label: '10 pieces' },
];

export const PRODUCE: SeedProductDef[] = [
  counted('tomato-fresh', 'Fresh Tomatoes', 'fresh-produce', 'tomato', 'Kano, Nigeria', 150, 'Jos Farms', ['tomato', 'fresh'], 'Firm cooking tomatoes for stew and jollof.', [
    { each: 6, label: '6 pcs' },
    { each: 12, label: 'Derica bowl' },
    { each: 25, label: 'Paint bucket' },
  ]),
  counted('tatase', 'Tatase (Sweet Pepper)', 'fresh-produce', 'pepper-fresh', 'Kaduna, Nigeria', 200, 'Jos Farms', ['tatase', 'pepper'], 'Red sweet peppers for stew colour.', pieces),
  counted('shombo', 'Shombo (Long Pepper)', 'fresh-produce', 'pepper-fresh', 'Kano, Nigeria', 80, 'Jos Farms', ['shombo', 'pepper'], 'Long cayenne peppers for heat.', [
    { each: 10, label: '10 pcs' },
    { each: 25, label: '25 pcs' },
    { each: 50, label: '50 pcs' },
  ]),
  counted('ata-rodo', 'Ata Rodo (Scotch Bonnet)', 'fresh-produce', 'pepper-fresh', 'Oyo, Nigeria', 50, 'Ibadan Foods', ['atarodo', 'pepper', 'hot'], 'Fresh scotch bonnet peppers.', [
    { each: 10, label: '10 pcs' },
    { each: 25, label: '25 pcs' },
    { each: 50, label: '50 pcs' },
  ]),
  counted('onion-red', 'Red Onions', 'fresh-produce', 'onion', 'Sokoto, Nigeria', 180, 'Sahel Produce', ['onion'], 'Pungent red onions.', [
    { each: 4, label: '4 pcs' },
    { each: 10, label: '10 pcs' },
    { each: 25, label: 'Paint bucket' },
  ]),
  counted('onion-white', 'White Onions', 'fresh-produce', 'onion', 'Sokoto, Nigeria', 170, 'Sahel Produce', ['onion', 'white'], 'Milder white onions.', [
    { each: 4, label: '4 pcs' },
    { each: 10, label: '10 pcs' },
  ]),
  counted('ugu-leaves', 'Ugu (Fluted Pumpkin)', 'fresh-produce', 'leafy', 'Delta, Nigeria', 400, 'Delta Foods', ['ugu', 'leafy'], 'Fresh ugu bunches for egusi and vegetable soup.', bunch),
  counted('waterleaf', 'Waterleaf', 'fresh-produce', 'leafy', 'Rivers, Nigeria', 300, 'Niger Delta Foods', ['waterleaf'], 'Tender waterleaf for soups.', bunch),
  counted('bitterleaf', 'Bitterleaf', 'fresh-produce', 'leafy', 'Anambra, Nigeria', 350, 'Eastern Harvest', ['bitterleaf', 'onugbu'], 'Washed bitterleaf for ofe onugbu.', bunch),
  counted('scent-leaf-fresh', 'Scent Leaf (Nchuanwu)', 'fresh-produce', 'leafy', 'Edo, Nigeria', 250, 'Edo Foods', ['scent-leaf'], 'Fresh scent leaf bunches.', bunch),
  counted('spinach', 'Spinach', 'fresh-produce', 'leafy', 'Plateau, Nigeria', 350, 'Jos Farms', ['spinach', 'leafy'], 'Fresh spinach bunches.', bunch),
  counted('okra-fresh', 'Fresh Okra', 'fresh-produce', 'okra', 'Kano, Nigeria', 40, 'Sahel Produce', ['okra'], 'Tender okra pods.', [
    { each: 10, label: '10 pods' },
    { each: 25, label: '25 pods' },
    { each: 50, label: '50 pods' },
  ]),
  counted('garden-egg', 'Garden Eggs', 'fresh-produce', 'garden-egg', 'Anambra, Nigeria', 60, 'Eastern Harvest', ['garden-egg'], 'African garden eggs for sauce and boiling.', [
    { each: 6, label: '6 pcs' },
    { each: 12, label: '12 pcs' },
    { each: 24, label: '24 pcs' },
  ]),
];

export const TUBERS: SeedProductDef[] = [
  counted('white-yam', 'White Yam', 'tubers-roots', 'yam', 'Benue, Nigeria', 2500, 'Benue Farms', ['yam'], 'Firm white yam tubers.', [
    { each: 1, label: '1 tuber' },
    { each: 3, label: '3 tubers' },
    { each: 5, label: '5 tubers' },
  ], PRODUCT_IMAGES.tuber),
  counted('puna-yam', 'Puna Yam', 'tubers-roots', 'yam', 'Oyo, Nigeria', 2800, 'Ibadan Foods', ['yam', 'puna'], 'Sweeter puna yam for pounding.', [
    { each: 1, label: '1 tuber' },
    { each: 3, label: '3 tubers' },
  ], PRODUCT_IMAGES.tuber),
  counted('sweet-potato', 'Sweet Potato', 'tubers-roots', 'sweet-potato', 'Kwara, Nigeria', 400, 'Ilorin Foods', ['sweet-potato'], 'Orange-flesh sweet potatoes.', [
    { each: 4, label: '4 pcs' },
    { each: 10, label: '10 pcs' },
  ], PRODUCT_IMAGES.tuber),
  counted('irish-potato', 'Irish Potatoes', 'tubers-roots', 'irish-potato', 'Plateau, Nigeria', 200, 'Jos Farms', ['potato'], 'Jos Irish potatoes.', [
    { each: 6, label: '6 pcs' },
    { each: 12, label: '12 pcs' },
    { each: 25, label: 'Paint bucket' },
  ], PRODUCT_IMAGES.tuber),
  counted('cassava-tuber', 'Fresh Cassava', 'tubers-roots', 'cassava', 'Ogun, Nigeria', 800, 'Ijebu Mills', ['cassava'], 'Fresh cassava roots for fufu and frying.', [
    { each: 3, label: '3 roots' },
    { each: 8, label: '8 roots' },
  ], PRODUCT_IMAGES.tuber),
  counted('cocoyam', 'Cocoyam', 'tubers-roots', 'cocoyam', 'Imo, Nigeria', 350, 'Eastern Harvest', ['cocoyam'], 'Cocoyam corms for soups and boiling.', [
    { each: 5, label: '5 pcs' },
    { each: 12, label: '12 pcs' },
  ], PRODUCT_IMAGES.tuber),
  counted('unripe-plantain', 'Unripe Plantain', 'plantain-banana', 'unripe-plantain', 'Ondo, Nigeria', 350, 'Sunshine Foods', ['plantain', 'unripe'], 'Green plantains for dodo-free frying and porridge.', [
    { each: 5, label: '5 fingers' },
    { each: 12, label: '1 bunch' },
  ], PRODUCT_IMAGES.plantain),
  counted('ripe-plantain', 'Ripe Plantain', 'plantain-banana', 'ripe-plantain', 'Ondo, Nigeria', 400, 'Sunshine Foods', ['plantain', 'ripe', 'dodo'], 'Ripe plantains for dodo and porridge.', [
    { each: 5, label: '5 fingers' },
    { each: 12, label: '1 bunch' },
  ], PRODUCT_IMAGES.plantain),
  counted('banana-cavendish', 'Banana', 'plantain-banana', 'banana', 'Edo, Nigeria', 80, 'Edo Foods', ['banana'], 'Sweet dessert bananas.', [
    { each: 6, label: '6 fingers' },
    { each: 12, label: '1 bunch' },
  ], PRODUCT_IMAGES.plantain),
];

export const MEAT: SeedProductDef[] = [
  protein('beef-stewing', 'Stewing Beef', 'meat-offals', 'beef', 'Kaduna, Nigeria', 4500, 'Northern Meats', ['beef'], 'Boneless stewing beef.'),
  protein('beef-mince', 'Minced Beef', 'meat-offals', 'beef', 'Lagos, Nigeria', 4800, 'City Meats', ['beef', 'mince'], 'Fresh minced beef.'),
  protein('goat-meat', 'Goat Meat', 'meat-offals', 'goat', 'Sokoto, Nigeria', 5200, 'Sahel Meats', ['goat'], 'Cut goat meat for pepper soup and stews.'),
  protein('chicken-whole', 'Whole Chicken', 'meat-offals', 'chicken', 'Ogun, Nigeria', 3200, 'CHI Farms', ['chicken'], 'Dressed whole chicken.', [1, 2]),
  protein('chicken-parts', 'Chicken Parts', 'meat-offals', 'chicken', 'Ogun, Nigeria', 3400, 'CHI Farms', ['chicken', 'parts'], 'Mixed chicken parts.'),
  protein('turkey-parts', 'Turkey Parts', 'meat-offals', 'turkey', 'Ogun, Nigeria', 3800, 'CHI Farms', ['turkey'], 'Frozen turkey wings and parts.'),
  protein('ponmo-cowskin', 'Ponmo (Cow Skin)', 'meat-offals', 'ponmo', 'Oyo, Nigeria', 1800, 'Ibadan Foods', ['ponmo', 'kpomo'], 'Cleaned cow skin for stews.'),
  protein('shaki-tripe', 'Shaki (Tripe)', 'meat-offals', 'offals', 'Lagos, Nigeria', 2800, 'City Meats', ['shaki', 'offal'], 'Washed tripe.'),
  protein('liver-beef', 'Beef Liver', 'meat-offals', 'offals', 'Lagos, Nigeria', 3000, 'City Meats', ['liver', 'offal'], 'Fresh beef liver.'),
  protein('roundabout-intestine', 'Roundabout (Intestine)', 'meat-offals', 'offals', 'Lagos, Nigeria', 2600, 'City Meats', ['intestine', 'offal'], 'Cleaned intestines.'),
];

export const FISH: SeedProductDef[] = [
  protein('croaker-fresh', 'Fresh Croaker', 'fish-seafood', 'fresh-fish', 'Lagos, Nigeria', 4200, 'Lagos Fish Market', ['croaker', 'fish'], 'Fresh croaker steaks.', [1, 2, 5], PRODUCT_IMAGES.fish),
  protein('tilapia-fresh', 'Fresh Tilapia', 'fish-seafood', 'fresh-fish', 'Ogun, Nigeria', 2800, 'CHI Farms', ['tilapia', 'fish'], 'Farm-raised tilapia.', [1, 2, 5], PRODUCT_IMAGES.fish),
  protein('catfish-fresh', 'Fresh Catfish', 'fish-seafood', 'fresh-fish', 'Delta, Nigeria', 3600, 'Delta Foods', ['catfish', 'fish'], 'Live-weight catfish for pepper soup.', [1, 2, 5], PRODUCT_IMAGES.fish),
  protein('mackerel-frozen', 'Frozen Mackerel (Titus)', 'fish-seafood', 'fresh-fish', 'Morocco', 2400, 'Frozen Seas', ['mackerel', 'titus', 'fish'], 'Imported frozen Titus.', [1, 2, 5], PRODUCT_IMAGES.fish),
  protein('dried-catfish', 'Dried Catfish', 'fish-seafood', 'dried-fish', 'Kogi, Nigeria', 6500, 'Middle Belt Foods', ['dried-fish', 'catfish'], 'Smoked dried catfish.', [1, 2], PRODUCT_IMAGES.fish),
  protein('stockfish-panla', 'Stockfish (Panla)', 'fish-seafood', 'stockfish', 'Norway', 9000, 'Frozen Seas', ['stockfish', 'panla'], 'Dried stockfish for native soups.', [1, 2], PRODUCT_IMAGES.fish),
  protein('shrimp-fresh', 'Shrimp', 'fish-seafood', 'shrimp', 'Akwa Ibom, Nigeria', 7500, 'Niger Delta Foods', ['shrimp', 'prawn'], 'Peeled shrimp.', [1, 2], PRODUCT_IMAGES.fish),
  protein('snail-fresh', 'Fresh Snail', 'fish-seafood', 'snail', 'Ondo, Nigeria', 5500, 'Sunshine Foods', ['snail'], 'Cleaned giant African snails.', [1, 2], PRODUCT_IMAGES.fish),
];
