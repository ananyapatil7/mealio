import type { Quantity, Unit } from './types';
import { catalogEntry } from './names';

/** How a unit word maps onto a canonical unit. */
interface UnitDef {
  unit: Unit;
  factor: number;
}

const UNIT_WORDS: Record<string, UnitDef> = {};
const def = (words: string[], unit: Unit, factor: number) => {
  for (const w of words) UNIT_WORDS[w] = { unit, factor };
};
def(['g', 'gm', 'gms', 'gr', 'grm', 'grms', 'gram', 'grams', 'gramme', 'grammes'], 'g', 1);
def(['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme'], 'g', 1000);
def(['lb', 'lbs', 'pound', 'pounds'], 'g', 453.6);
def(['oz', 'ounce', 'ounces'], 'g', 28.35);
def(['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters'], 'ml', 1);
def(['l', 'lt', 'ltr', 'ltrs', 'litre', 'litres', 'liter', 'liters'], 'ml', 1000);
def(['tbsp', 'tablespoon', 'tablespoons'], 'ml', 15);
def(['tsp', 'teaspoon', 'teaspoons'], 'ml', 5);
def(['cup', 'cups'], 'ml', 240);
def(['pc', 'pcs', 'piece', 'pieces', 'nos', 'no', 'unit', 'units', 'count'], 'pcs', 1);
def(['dozen', 'dozens', 'dz', 'doz'], 'pcs', 12);

/** Pack words mean "N of the usual pack size" (e.g. "2 packets of milk"). */
export const PACK_WORDS = new Set([
  'pack', 'packs', 'packet', 'packets', 'pkt', 'pkts', 'bag', 'bags', 'box', 'boxes', 'bottle', 'bottles',
  'can', 'cans', 'tin', 'tins', 'jar', 'jars', 'loaf', 'loaves', 'bunch', 'bunches', 'carton', 'cartons',
  'tray', 'trays', 'pouch', 'pouches', 'block', 'blocks', 'tub', 'tubs',
]);

export function unitWord(word: string): UnitDef | undefined {
  return UNIT_WORDS[word.toLowerCase()];
}

/** Convert an amount in a unit word ("kg", "dozen", "l") into canonical units. */
export function toCanonical(qty: number, word: string): Quantity | null {
  const d = unitWord(word);
  if (!d) return null;
  return { qty: round(qty * d.factor, d.unit), unit: d.unit };
}

/** Round to a sensible precision: whole grams/ml above 10, otherwise 2 decimals. */
export function round(n: number, unit: Unit): number {
  if (unit !== 'pcs' && Math.abs(n) >= 10) return Math.round(n);
  return Math.round(n * 100) / 100;
}

/**
 * Convert a quantity of a named ingredient to another unit.
 * Same unit is always possible; pcs <-> g needs gramsPerPiece; g <-> ml needs density.
 * Returns null when there's no reliable conversion.
 */
export function convert(q: Quantity, to: Unit, name: string): number | null {
  if (q.unit === to) return q.qty;
  const c = catalogEntry(name);
  const grams = toGrams(q, c?.gramsPerPiece, c?.density);
  if (grams === null) return null;
  if (to === 'g') return grams;
  if (to === 'pcs') return c?.gramsPerPiece ? grams / c.gramsPerPiece : null;
  if (to === 'ml') return c?.density ? grams / c.density : null;
  return null;
}

function toGrams(q: Quantity, gpp?: number, density?: number): number | null {
  if (q.unit === 'g') return q.qty;
  if (q.unit === 'pcs') return gpp ? q.qty * gpp : null;
  if (q.unit === 'ml') return density ? q.qty * density : null;
  return null;
}

export function canConvert(from: Unit, to: Unit, name: string): boolean {
  return convert({ qty: 1, unit: from }, to, name) !== null;
}

/** Scale a recipe quantity from base servings to the chosen servings. */
export function scaleQty(qty: number, baseServings: number, servings: number, unit: Unit): number {
  return round((qty * servings) / baseServings, unit);
}

const FRACTIONS: [number, string][] = [
  [0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾'],
];

/** Human formatting: 1500 g -> "1.5 kg", 0.5 pcs -> "½", 250 ml -> "250 ml". */
export function formatQty(qty: number, unit: Unit): string {
  if (unit === 'pcs') {
    const whole = Math.floor(qty + 1e-9);
    const frac = qty - whole;
    if (frac < 0.05) return `${whole}`;
    const f = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.05);
    if (f) return whole ? `${whole}${f[1]}` : f[1];
    return `${Math.round(qty * 10) / 10}`;
  }
  if (qty >= 1000) {
    const big = Math.round(qty / 10) / 100;
    return `${big} ${unit === 'g' ? 'kg' : 'l'}`;
  }
  return `${qty >= 10 ? Math.round(qty) : Math.round(qty * 10) / 10} ${unit}`;
}

export function formatAmount(qty: number, unit: Unit): string {
  return unit === 'pcs' ? `× ${formatQty(qty, unit)}` : formatQty(qty, unit);
}
