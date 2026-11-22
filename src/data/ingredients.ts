import type { Unit } from '../lib/types';

/**
 * Ingredient catalog: canonical keys, aliases, default units and conversion hints.
 * Used for name normalisation, pcs <-> g conversion and sensible defaults when a
 * quantity isn't given ("milk" -> 1 l). Unknown items are still allowed everywhere.
 */
export interface CatalogEntry {
  /** Canonical key, lower-case. Recipes reference ingredients by this key. */
  key: string;
  /** Friendly display label. */
  label: string;
  /** Default unit when the user gives a bare number or no quantity. */
  unit: Unit;
  /** Average weight of one piece, enables pcs <-> g conversion. */
  gramsPerPiece?: number;
  /** Grams per millilitre, enables g <-> ml conversion for liquids. */
  density?: number;
  /** Typical pack size in `unit`, used when no quantity is given. */
  pack?: number;
  /** Tracked as have / don't have only. */
  staple?: boolean;
  aliases?: string[];
}

export const CATALOG: CatalogEntry[] = [
  // ---- Countable produce & basics
  { key: 'egg', label: 'Eggs', unit: 'pcs', gramsPerPiece: 50, pack: 6, aliases: ['anda', 'ande'] },
  { key: 'onion', label: 'Onions', unit: 'pcs', gramsPerPiece: 150, pack: 4, aliases: ['pyaz', 'pyaaz', 'kanda', 'red onion', 'white onion'] },
  { key: 'tomato', label: 'Tomatoes', unit: 'pcs', gramsPerPiece: 100, pack: 4, aliases: ['tamatar', 'cherry tomato'] },
  { key: 'potato', label: 'Potatoes', unit: 'pcs', gramsPerPiece: 170, pack: 4, aliases: ['aloo', 'alu', 'batata'] },
  { key: 'green chilli', label: 'Green chillies', unit: 'pcs', gramsPerPiece: 5, pack: 10, aliases: ['chilli', 'chili', 'green chili', 'hari mirch', 'mirchi'] },
  { key: 'garlic', label: 'Garlic (cloves)', unit: 'pcs', gramsPerPiece: 5, pack: 20, aliases: ['garlic clove', 'lehsun', 'lasun'] },
  { key: 'lemon', label: 'Lemons', unit: 'pcs', gramsPerPiece: 60, pack: 3, aliases: ['lime', 'nimbu'] },
  { key: 'banana', label: 'Bananas', unit: 'pcs', gramsPerPiece: 120, pack: 6, aliases: ['kela'] },
  { key: 'apple', label: 'Apples', unit: 'pcs', gramsPerPiece: 180, pack: 4, aliases: ['seb'] },
  { key: 'carrot', label: 'Carrots', unit: 'pcs', gramsPerPiece: 80, pack: 4, aliases: ['gajar'] },
  { key: 'capsicum', label: 'Capsicum', unit: 'pcs', gramsPerPiece: 150, pack: 2, aliases: ['bell pepper', 'shimla mirch', 'green pepper', 'red pepper'] },
  { key: 'cucumber', label: 'Cucumbers', unit: 'pcs', gramsPerPiece: 200, pack: 2, aliases: ['kheera', 'khira'] },
  { key: 'bread', label: 'Bread (slices)', unit: 'pcs', gramsPerPiece: 30, pack: 20, aliases: ['bread slice', 'white bread', 'brown bread', 'pav', 'toast'] },
  { key: 'tortilla', label: 'Tortillas / wraps', unit: 'pcs', gramsPerPiece: 40, pack: 6, aliases: ['wrap', 'roti wrap'] },

  // ---- Weighed produce, grains, protein
  { key: 'ginger', label: 'Ginger', unit: 'g', pack: 100, aliases: ['adrak'] },
  { key: 'coriander leaves', label: 'Coriander leaves', unit: 'g', pack: 50, aliases: ['coriander', 'cilantro', 'dhaniya', 'dhania', 'fresh coriander'] },
  { key: 'spinach', label: 'Spinach', unit: 'g', pack: 250, aliases: ['palak', 'spinach leaves'] },
  { key: 'cauliflower', label: 'Cauliflower', unit: 'g', pack: 500, aliases: ['gobi', 'gobhi'] },
  { key: 'cabbage', label: 'Cabbage', unit: 'g', pack: 500, aliases: ['patta gobi', 'band gobhi'] },
  { key: 'peas', label: 'Green peas', unit: 'g', pack: 250, aliases: ['pea', 'green pea', 'matar', 'frozen pea'] },
  { key: 'okra', label: 'Okra', unit: 'g', pack: 250, aliases: ['bhindi', 'lady finger', 'ladies finger'] },
  { key: 'mushroom', label: 'Mushrooms', unit: 'g', pack: 200, aliases: ['button mushroom'] },
  { key: 'sweet corn', label: 'Sweet corn', unit: 'g', pack: 200, aliases: ['corn', 'corn kernel', 'bhutta'] },
  { key: 'rice', label: 'Rice', unit: 'g', pack: 1000, aliases: ['basmati', 'basmati rice', 'chawal', 'white rice'] },
  { key: 'flattened rice', label: 'Poha (flattened rice)', unit: 'g', pack: 500, aliases: ['poha', 'beaten rice', 'aval'] },
  { key: 'semolina', label: 'Semolina (rava)', unit: 'g', pack: 500, aliases: ['rava', 'sooji', 'suji'] },
  { key: 'gram flour', label: 'Gram flour (besan)', unit: 'g', pack: 500, aliases: ['besan', 'chickpea flour'] },
  { key: 'wheat flour', label: 'Wheat flour (atta)', unit: 'g', pack: 1000, aliases: ['atta', 'whole wheat flour', 'chapati flour'] },
  { key: 'oats', label: 'Oats', unit: 'g', pack: 500, aliases: ['oat', 'rolled oat', 'oatmeal'] },
  { key: 'pasta', label: 'Pasta', unit: 'g', pack: 500, aliases: ['spaghetti', 'penne', 'macaroni', 'fusilli'] },
  { key: 'noodles', label: 'Noodles', unit: 'g', pack: 300, aliases: ['noodle', 'hakka noodle', 'egg noodle', 'ramen'] },
  { key: 'toor dal', label: 'Toor dal', unit: 'g', pack: 500, aliases: ['arhar dal', 'tur dal', 'toor', 'pigeon pea', 'yellow lentil'] },
  { key: 'moong dal', label: 'Moong dal', unit: 'g', pack: 500, aliases: ['moong', 'mung dal', 'yellow moong'] },
  { key: 'masoor dal', label: 'Masoor dal', unit: 'g', pack: 500, aliases: ['masoor', 'red lentil', 'lentil'] },
  { key: 'kidney beans', label: 'Kidney beans (cooked/canned)', unit: 'g', pack: 400, aliases: ['kidney bean', 'rajma', 'red bean'] },
  { key: 'chickpeas', label: 'Chickpeas (cooked/canned)', unit: 'g', pack: 400, aliases: ['chickpea', 'chana', 'kabuli chana', 'chole', 'garbanzo'] },
  { key: 'peanuts', label: 'Peanuts', unit: 'g', pack: 200, aliases: ['peanut', 'groundnut', 'moongphali'] },
  { key: 'paneer', label: 'Paneer', unit: 'g', pack: 200, aliases: ['cottage cheese'] },
  { key: 'tofu', label: 'Tofu', unit: 'g', pack: 200 },
  { key: 'chicken', label: 'Chicken', unit: 'g', pack: 500, aliases: ['chicken breast', 'chicken thigh', 'boneless chicken', 'murgh'] },
  { key: 'fish', label: 'Fish fillet', unit: 'g', pack: 400, aliases: ['fish fillet', 'basa', 'salmon', 'machli'] },
  { key: 'cheese', label: 'Cheese', unit: 'g', pack: 200, aliases: ['cheddar', 'mozzarella', 'cheese slice', 'parmesan'] },
  { key: 'butter', label: 'Butter', unit: 'g', pack: 100, aliases: ['salted butter', 'makhan'] },
  { key: 'curd', label: 'Curd / yogurt', unit: 'g', density: 1, pack: 400, aliases: ['yogurt', 'yoghurt', 'dahi', 'greek yogurt'] },
  { key: 'peanut butter', label: 'Peanut butter', unit: 'g', pack: 350 },
  { key: 'tomato puree', label: 'Tomato puree', unit: 'g', pack: 200, aliases: ['passata'] },

  // ---- Liquids
  { key: 'milk', label: 'Milk', unit: 'ml', density: 1, pack: 1000, aliases: ['doodh', 'toned milk', 'full cream milk', 'whole milk', 'skimmed milk'] },
  { key: 'cream', label: 'Cream', unit: 'ml', density: 1, pack: 200, aliases: ['fresh cream', 'malai', 'heavy cream'] },
  { key: 'coconut milk', label: 'Coconut milk', unit: 'ml', density: 1, pack: 400 },
  { key: 'honey', label: 'Honey', unit: 'ml', density: 1.4, pack: 250, aliases: ['shahad'] },

  // ---- Staples (have / don't have)
  { key: 'salt', label: 'Salt', unit: 'g', staple: true, aliases: ['namak'] },
  { key: 'oil', label: 'Cooking oil', unit: 'ml', staple: true, density: 0.92, aliases: ['cooking oil', 'vegetable oil', 'sunflower oil', 'olive oil', 'mustard oil', 'refined oil'] },
  { key: 'sugar', label: 'Sugar', unit: 'g', staple: true, aliases: ['cheeni', 'chini'] },
  { key: 'black pepper', label: 'Black pepper', unit: 'g', staple: true, aliases: ['pepper', 'kali mirch', 'pepper powder'] },
  { key: 'turmeric', label: 'Turmeric', unit: 'g', staple: true, aliases: ['haldi', 'turmeric powder'] },
  { key: 'chilli powder', label: 'Chilli powder', unit: 'g', staple: true, aliases: ['red chilli powder', 'chili powder', 'lal mirch', 'kashmiri chilli'] },
  { key: 'cumin seeds', label: 'Cumin seeds', unit: 'g', staple: true, aliases: ['cumin', 'jeera', 'cumin seed'] },
  { key: 'mustard seeds', label: 'Mustard seeds', unit: 'g', staple: true, aliases: ['mustard seed', 'rai', 'sarson'] },
  { key: 'garam masala', label: 'Garam masala', unit: 'g', staple: true },
  { key: 'coriander powder', label: 'Coriander powder', unit: 'g', staple: true, aliases: ['dhania powder', 'dhaniya powder'] },
  { key: 'ghee', label: 'Ghee', unit: 'g', staple: true, aliases: ['clarified butter'] },
  { key: 'soy sauce', label: 'Soy sauce', unit: 'ml', staple: true, aliases: ['soya sauce'] },
  { key: 'chilli flakes', label: 'Chilli flakes', unit: 'g', staple: true, aliases: ['red chilli flakes', 'chili flakes'] },
  { key: 'tea', label: 'Tea leaves', unit: 'g', staple: true, aliases: ['tea leaf', 'chai patti', 'tea powder'] },
  { key: 'chaat masala', label: 'Chaat masala', unit: 'g', staple: true },

  // ---- Common groceries that aren't recipe ingredients (prevents "tomato ketchup" -> tomato)
  { key: 'ketchup', label: 'Ketchup', unit: 'ml', pack: 500, aliases: ['tomato ketchup', 'tomato sauce'] },
  { key: 'chips', label: 'Chips', unit: 'pcs', pack: 1, aliases: ['potato chip', 'crisp', 'chip'] },
  { key: 'biscuits', label: 'Biscuits', unit: 'pcs', pack: 1, aliases: ['biscuit', 'cookie'] },
  { key: 'juice', label: 'Juice', unit: 'ml', pack: 1000, aliases: ['orange juice', 'apple juice'] },
  { key: 'coffee', label: 'Coffee', unit: 'g', pack: 100, aliases: ['instant coffee', 'coffee powder'] },
  { key: 'jam', label: 'Jam', unit: 'g', pack: 200 },
];

export const DEFAULT_STAPLES = CATALOG.filter((c) => c.staple).map((c) => c.key);
