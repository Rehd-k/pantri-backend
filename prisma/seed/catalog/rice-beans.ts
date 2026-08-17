import { PRODUCT_IMAGES } from '../categories';
import { dry } from './factory';
import type { SeedProductDef } from '../types';

export const RICE_GRAINS: SeedProductDef[] = [
  dry('long-grain-rice', 'Long Grain Parboiled Rice', 'rice-grains', 'long-grain', 'Kebbi, Nigeria', 1400, 'Royal Farms', ['rice', 'staple', 'jollof'], 'Stone-free parboiled long grain that stays separate in jollof and fried rice.'),
  dry('ofada-rice', 'Ofada Rice', 'rice-grains', 'ofada', 'Ogun, Nigeria', 1800, 'Ogun Farms', ['rice', 'ofada', 'local'], 'Aromatic unpolished Ofada with the distinctive flavour of ayamashe sauce.'),
  dry('abakaliki-rice', 'Abakaliki Rice', 'rice-grains', 'local', 'Ebonyi, Nigeria', 1350, 'Ebonyi Mills', ['rice', 'local', 'abakaliki'], 'Short-grain local rice from Ebonyi paddies, firm after long simmering.'),
  dry('lautai-rice', 'Lautai Local Rice', 'rice-grains', 'local', 'Kebbi, Nigeria', 1300, 'Kebbi Rice', ['rice', 'local'], 'Northern local rice with a nutty bite, excellent for tuwo and everyday stews.'),
  dry('broken-rice', 'Broken Rice', 'rice-grains', 'local', 'Niger, Nigeria', 1100, 'Niger Mills', ['rice', 'broken', 'budget'], 'Affordable broken grains for swallows, porridge and large-family cooking.'),
  dry('basmati-rice', 'Aged Basmati Rice', 'rice-grains', 'basmati', 'Punjab, India', 2800, 'Royal Farms', ['rice', 'basmati', 'aromatic'], 'Aged basmati with elongated grains that stay separate when steamed.'),
  dry('jasmine-rice', 'Thai Jasmine Rice', 'rice-grains', 'jasmine', 'Thailand', 2600, 'Golden Gate', ['rice', 'jasmine', 'imported'], 'Soft, slightly sticky jasmine with a floral aroma.'),
  dry('indian-parboiled-rice', 'Indian Parboiled Rice', 'rice-grains', 'parboiled', 'India', 1500, 'Harvest Gold', ['rice', 'parboiled', 'imported'], 'Imported parboiled rice that holds shape through party-size jollof.'),
  dry('thai-parboiled-rice', 'Thai Parboiled Rice', 'rice-grains', 'parboiled', 'Thailand', 1550, 'Golden Gate', ['rice', 'parboiled'], 'Clean Thai parboiled grains for everyday family pots.'),
  dry('brown-rice', 'Brown Rice', 'rice-grains', 'long-grain', 'Benue, Nigeria', 1900, 'Aurora', ['rice', 'brown', 'wholegrain'], 'Unpolished brown rice with bran intact for higher fibre meals.'),
  dry('pearl-millet', 'Pearl Millet (Gero)', 'rice-grains', 'millet', 'Kano, Nigeria', 900, 'Sahel Grains', ['millet', 'gero', 'tuwo'], 'Northern millet for tuwo, kunu and weaning pap.'),
  dry('finger-millet', 'Finger Millet', 'rice-grains', 'millet', 'Plateau, Nigeria', 1100, 'Jos Mills', ['millet', 'finger'], 'Nutty finger millet for porridge and gluten-free swallows.'),
  dry('sorghum-guinea-corn', 'Sorghum / Guinea Corn', 'rice-grains', 'sorghum', 'Kaduna, Nigeria', 850, 'Sahel Grains', ['sorghum', 'guinea-corn', 'tuwo'], 'Red guinea corn for tuwo masara and local drinks.'),
  dry('white-sorghum', 'White Sorghum', 'rice-grains', 'sorghum', 'Sokoto, Nigeria', 880, 'Sahel Grains', ['sorghum', 'white'], 'Milder white sorghum for pap and baked goods.'),
  dry('acha-fonio', 'Acha (Fonio)', 'rice-grains', 'acha', 'Plateau, Nigeria', 2200, 'Jos Mills', ['acha', 'fonio', 'ancient-grain'], 'Tiny nutritious fonio grains that cook in minutes.'),
  dry('white-maize', 'White Maize', 'rice-grains', 'maize', 'Kaduna, Nigeria', 700, 'Northern Harvest', ['maize', 'corn', 'ogi'], 'Dried white maize for ogi, tuwo and homemade corn flour.'),
  dry('yellow-maize', 'Yellow Maize', 'rice-grains', 'maize', 'Niger, Nigeria', 720, 'Northern Harvest', ['maize', 'yellow'], 'Yellow maize for roasted corn flour and animal-free household pap.'),
  dry('popcorn-maize', 'Popping Maize', 'rice-grains', 'maize', 'Plateau, Nigeria', 950, 'Jos Mills', ['maize', 'popcorn'], 'Small hard kernels that pop cleanly for snacks.'),
  dry('wheat-grain', 'Whole Wheat Grain', 'rice-grains', 'maize', 'Kano, Nigeria', 1000, 'Sahel Grains', ['wheat', 'grain'], 'Whole wheat berries for homemade flour and porridge.'),
];

export const BEANS_LEGUMES: SeedProductDef[] = [
  dry('oloyin-beans', 'Oloyin Honey Beans', 'beans-legumes', 'oloyin', 'Oyo, Nigeria', 1600, 'Ibadan Foods', ['beans', 'oloyin', 'honey-beans'], 'Sweet honey beans that cook soft for moin-moin and ewa agoyin.', PRODUCT_IMAGES.beans),
  dry('brown-beans', 'Brown Beans (Olotu)', 'beans-legumes', 'brown-beans', 'Benue, Nigeria', 1400, 'Benue Mills', ['beans', 'brown'], 'Classic Nigerian brown beans for porridge, stew and akara.', PRODUCT_IMAGES.beans),
  dry('white-beans', 'White Beans', 'beans-legumes', 'white-beans', 'Kano, Nigeria', 1350, 'Sahel Grains', ['beans', 'white'], 'Mild white beans for soups and salads.', PRODUCT_IMAGES.beans),
  dry('black-eyed-peas', 'Black-eyed Peas', 'beans-legumes', 'black-eyed', 'Kaduna, Nigeria', 1450, 'Northern Harvest', ['beans', 'black-eyed'], 'Black-eyed peas that hold shape in stews and rice dishes.', PRODUCT_IMAGES.beans),
  dry('iron-beans', 'Iron Beans', 'beans-legumes', 'brown-beans', 'Plateau, Nigeria', 1500, 'Jos Mills', ['beans', 'iron'], 'Darker, firmer beans popular in the Middle Belt.', PRODUCT_IMAGES.beans),
  dry('soybeans', 'Soybeans', 'beans-legumes', 'soybeans', 'Benue, Nigeria', 1200, 'Benue Mills', ['soy', 'soybeans', 'protein'], 'Whole soybeans for soymilk, dadawa and protein-rich stews.', PRODUCT_IMAGES.beans),
  dry('soybean-flour', 'Soybean Flour', 'beans-legumes', 'soybeans', 'Benue, Nigeria', 1800, 'Benue Mills', ['soy', 'flour'], 'Defatted soybean flour for baking and swallow enrichment.', PRODUCT_IMAGES.flour, [1, 2, 5, 10]),
  dry('groundnuts-raw', 'Raw Groundnuts', 'beans-legumes', 'groundnuts', 'Kano, Nigeria', 1600, 'Sahel Grains', ['groundnut', 'peanut'], 'Raw unshelled-style kernels for roasting, stew and kulikuli.', PRODUCT_IMAGES.seed),
  dry('groundnuts-roasted', 'Roasted Groundnuts', 'beans-legumes', 'groundnuts', 'Kano, Nigeria', 1900, 'Sahel Grains', ['groundnut', 'roasted'], 'Ready-to-eat roasted groundnuts for snacks and garnishes.', PRODUCT_IMAGES.seed, [1, 2, 5, 10]),
  dry('ukwa-breadfruit', 'Ukwa (African Breadfruit)', 'beans-legumes', 'ukwa', 'Imo, Nigeria', 3200, 'Eastern Harvest', ['ukwa', 'breadfruit'], 'Dried ukwa seeds for the classic Igbo porridge.', PRODUCT_IMAGES.beans),
  dry('lentils-red', 'Red Lentils', 'beans-legumes', 'lentils', 'India', 2200, 'Harvest Gold', ['lentils', 'imported'], 'Quick-cooking red lentils for soups and protein bowls.', PRODUCT_IMAGES.beans, [1, 2, 5, 10]),
  dry('lentils-brown', 'Brown Lentils', 'beans-legumes', 'lentils', 'Canada', 2100, 'Harvest Gold', ['lentils'], 'Brown lentils that keep their shape in stews.', PRODUCT_IMAGES.beans, [1, 2, 5, 10]),
  dry('bambara-nuts', 'Bambara Nuts (Okpa beans)', 'beans-legumes', 'ukwa', 'Enugu, Nigeria', 2000, 'Eastern Harvest', ['bambara', 'okpa'], 'Bambara groundnuts for traditional okpa pudding.', PRODUCT_IMAGES.beans),
];
