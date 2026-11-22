// Hand-labelled eval datasets. Labels are what a person MEANT, not what the parser currently outputs.
// qty: null = no amount was typed, so only the name is scored.
import type { Unit } from '../src/lib/types';

export interface Expected {
  name: string;
  qty: number | null;
  unit?: Unit;
}
export interface ParseCase {
  slice: 'casual' | 'hinglish' | 'receipt-in' | 'receipt-eu' | 'typo-edge';
  input: string;
  expect: Expected[];
}

const e = (name: string, qty: number | null = null, unit?: Unit): Expected => ({ name, qty, unit });

export const PARSE_CASES: ParseCase[] = [
  // Casual English
  { slice: 'casual', input: 'bought 6 eggs, 1kg onions, half kg tomatoes, milk', expect: [e('egg', 6, 'pcs'), e('onion', 1000, 'g'), e('tomato', 500, 'g'), e('milk')] },
  { slice: 'casual', input: '2 litres milk and a dozen eggs', expect: [e('milk', 2000, 'ml'), e('egg', 12, 'pcs')] },
  { slice: 'casual', input: '500g paneer', expect: [e('paneer', 500, 'g')] },
  { slice: 'casual', input: 'got 3 potatoes, 2 onions and some ginger', expect: [e('potato', 3, 'pcs'), e('onion', 2, 'pcs'), e('ginger')] },
  { slice: 'casual', input: '1.5 kg rice', expect: [e('rice', 1500, 'g')] },
  { slice: 'casual', input: 'bananas x6', expect: [e('banana', 6, 'pcs')] },
  { slice: 'casual', input: '250 gm butter, 200g cheese', expect: [e('butter', 250, 'g'), e('cheese', 200, 'g')] },
  { slice: 'casual', input: 'half dozen lemons', expect: [e('lemon', 6, 'pcs')] },
  { slice: 'casual', input: 'a bunch of coriander', expect: [e('coriander leaves')] },
  { slice: 'casual', input: '1 packet poha', expect: [e('flattened rice')] },
  { slice: 'casual', input: '4 tomatoes & 1 cucumber', expect: [e('tomato', 4, 'pcs'), e('cucumber', 1, 'pcs')] },
  { slice: 'casual', input: 'bread, butter, jam', expect: [e('bread'), e('butter'), e('jam')] },
  { slice: 'casual', input: '2 cans chickpeas', expect: [e('chickpeas')] },
  { slice: 'casual', input: 'one and a half kg potatoes', expect: [e('potato', 1500, 'g')] },
  { slice: 'casual', input: '300 g spinach; 200 ml cream', expect: [e('spinach', 300, 'g'), e('cream', 200, 'ml')] },
  // Hinglish
  { slice: 'hinglish', input: 'ek dozen ande', expect: [e('egg', 12, 'pcs')] },
  { slice: 'hinglish', input: 'do kilo aloo', expect: [e('potato', 2000, 'g')] },
  { slice: 'hinglish', input: '1 kg pyaz, aadha kilo tamatar', expect: [e('onion', 1000, 'g'), e('tomato', 500, 'g')] },
  { slice: 'hinglish', input: 'dahi 400g', expect: [e('curd', 400, 'g')] },
  { slice: 'hinglish', input: 'palak 250 g', expect: [e('spinach', 250, 'g')] },
  { slice: 'hinglish', input: '2 packet doodh', expect: [e('milk')] },
  { slice: 'hinglish', input: 'atta 5 kg', expect: [e('wheat flour', 5000, 'g')] },
  { slice: 'hinglish', input: 'hari mirch 10', expect: [e('green chilli', 10, 'pcs')] },
  { slice: 'hinglish', input: 'teen kele', expect: [e('banana', 3, 'pcs')] },
  { slice: 'hinglish', input: 'chawal 2 kilo', expect: [e('rice', 2000, 'g')] },
  // Indian supermarket receipts
  {
    slice: 'receipt-in',
    input: 'BIG BAZAAR\nTOMATO HYBRID 500G   1  24.00\nONION 1KG            1  40.00\nAMUL BUTTER 100G     2  112.00\nEGGS 12PC               84.00\nTOTAL                  260.00',
    expect: [e('tomato', 500, 'g'), e('onion', 1000, 'g'), e('butter', 200, 'g'), e('egg', 12, 'pcs')],
  },
  {
    slice: 'receipt-in',
    input: 'D-MART\nBRD WHT 400G         45.00\nPANEER 200G          90.00\nTOOR DAL 1KG        150.00\nCURD 400G            60.00\nSUB TOTAL           345.00',
    expect: [e('bread', 400, 'g'), e('paneer', 200, 'g'), e('toor dal', 1000, 'g'), e('curd', 400, 'g')],
  },
  // European receipt (exchange semester)
  {
    slice: 'receipt-eu',
    input: 'REWE Markt\nZwiebeln 1kg        1,49\nEier 10 Stk         2,99\nVollmilch 1L        1,15\nBananen 1,2kg       1,79\nSUMME EUR           7,42',
    expect: [e('onion', 1000, 'g'), e('egg', 10, 'pcs'), e('milk', 1000, 'ml'), e('banana', 1200, 'g')],
  },
  // Typos and edge cases
  { slice: 'typo-edge', input: 'tomatos 3', expect: [e('tomato', 3, 'pcs')] },
  { slice: 'typo-edge', input: 'onoins 1kg', expect: [e('onion', 1000, 'g')] },
  { slice: 'typo-edge', input: 'potatos 1 kg', expect: [e('potato', 1000, 'g')] },
  { slice: 'typo-edge', input: '6 egs', expect: [e('egg', 6, 'pcs')] },
  { slice: 'typo-edge', input: 'panner 200g', expect: [e('paneer', 200, 'g')] },
  { slice: 'typo-edge', input: '1kg chiken', expect: [e('chicken', 1000, 'g')] },
  { slice: 'typo-edge', input: 'Tomato Ketchup 1 bottle', expect: [e('ketchup')] },
  { slice: 'typo-edge', input: 'garlic powder', expect: [e('garlic powder')] },
  { slice: 'typo-edge', input: 'milk 56.00', expect: [e('milk')] },
  { slice: 'typo-edge', input: '2 x 500g pasta', expect: [e('pasta', 1000, 'g')] },
];

export interface SearchCase {
  slice: 'exact' | 'partial' | 'ingredient' | 'alias-hinglish' | 'typo' | 'multi-word';
  query: string;
  expect: string[]; // recipe ids that must be in the results
}

export const SEARCH_CASES: SearchCase[] = [
  { slice: 'exact', query: 'masala chai', expect: ['masala-chai'] },
  { slice: 'exact', query: 'dal tadka', expect: ['dal-tadka'] },
  { slice: 'exact', query: 'shakshuka', expect: ['shakshuka'] },
  { slice: 'exact', query: 'palak paneer', expect: ['palak-paneer'] },
  { slice: 'partial', query: 'pas', expect: ['tomato-pasta', 'mushroom-pasta'] },
  { slice: 'partial', query: 'pane', expect: ['palak-paneer', 'paneer-bhurji'] },
  { slice: 'partial', query: 'omel', expect: ['masala-omelette'] },
  { slice: 'partial', query: 'khich', expect: ['khichdi'] },
  { slice: 'ingredient', query: 'paneer', expect: ['palak-paneer', 'paneer-bhurji'] },
  { slice: 'ingredient', query: 'chickpea', expect: ['chickpea-salad', 'chana-masala'] },
  { slice: 'ingredient', query: 'mushroom', expect: ['mushroom-pasta'] },
  { slice: 'ingredient', query: 'oats', expect: ['overnight-oats', 'banana-pancakes'] },
  { slice: 'alias-hinglish', query: 'aloo', expect: ['jeera-aloo', 'aloo-gobi', 'aloo-paratha'] },
  { slice: 'alias-hinglish', query: 'dahi', expect: ['curd-rice'] },
  { slice: 'alias-hinglish', query: 'anda', expect: ['egg-curry'] },
  { slice: 'alias-hinglish', query: 'rajma', expect: ['rajma'] },
  { slice: 'alias-hinglish', query: 'chole', expect: ['chana-masala'] },
  { slice: 'typo', query: 'panner', expect: ['palak-paneer'] },
  { slice: 'typo', query: 'omlette', expect: ['masala-omelette'] },
  { slice: 'typo', query: 'chiken', expect: ['chicken-curry'] },
  { slice: 'typo', query: 'spageti', expect: ['aglio-olio'] },
  { slice: 'multi-word', query: 'tomato pasta', expect: ['tomato-pasta'] },
  { slice: 'multi-word', query: 'egg rice', expect: ['egg-fried-rice'] },
  { slice: 'multi-word', query: 'veg noodles', expect: ['hakka-noodles'] },
];

/** Exclusions people use for diet, religion or allergies. Any result containing these is a safety violation. */
export const DIET_EXCLUSIONS: { query: string; banned: string[] }[] = [
  { query: 'no egg', banned: ['egg'] },
  { query: 'no paneer', banned: ['paneer'] },
  { query: 'no chicken', banned: ['chicken'] },
  { query: 'no peanuts', banned: ['peanuts', 'peanut butter'] },
  { query: 'without onion or garlic', banned: ['onion', 'garlic'] },
  { query: 'no milk', banned: ['milk'] },
];
