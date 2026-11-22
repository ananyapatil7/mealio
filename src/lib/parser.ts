import type { Quantity, Unit } from './types';
import { catalogEntry, normalizeName } from './names';
import { PACK_WORDS, convert, round, toCanonical, toCount, unitWord } from './units';

export interface ParsedItem {
  /** Canonical name. */
  name: string;
  qty: number;
  unit: Unit;
  /** The text this came from, for the confirm screen. */
  source: string;
  /** True when the quantity was guessed (no amount given, or "1 packet"). */
  assumed: boolean;
  /** True when the name matched our ingredient catalog. */
  known: boolean;
  /** Staples are saved as "have", not as a quantity. */
  staple: boolean;
  /** Set when a weight was turned into a count ("half kg tomatoes" -> 4): the amount as typed. */
  estimatedFrom?: Quantity;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, half: 0.5, quarter: 0.25,
};

const STOP_WORDS = new Set([
  'i', 'we', 'bought', 'buy', 'got', 'get', 'picked', 'up', 'also', 'some', 'the', 'of', 'from', 'store',
  'shop', 'market', 'supermarket', 'today', 'yesterday', 'and', 'plus', 'then', 'just', 'few', 'little',
  'more', 'extra', 'about', 'around', 'approx', 'roughly', 'with', 'for', 'my', 'a', 'an', 'item', 'items',
]);

/** Lines on a receipt that are never groceries. */
const NOISE_LINE =
  /\b(sub\s*total|total|tax|gst|cgst|sgst|vat|cash|change|card|visa|mastercard|upi|paytm|balance|thank|thanks|invoice|bill\s*no|receipt|tel|phone|www|discount|savings|you saved|amount|mrp|tender|cashier|counter|gstin|order|payment|round\s*off)\b/i;
const DATE_LIKE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}:\d{2}\b/;

/** Parse casual text or pasted receipt text into grocery items. Never adds items that weren't typed. */
export function parseGroceryText(text: string, staples: string[] = []): ParsedItem[] {
  const stapleSet = new Set(staples);
  const items: ParsedItem[] = [];

  const lines = text.split(/\r?\n/);
  // Two or more price-column lines means this is a pasted receipt: header lines without
  // numbers (shop name, address) are only kept if they name a known grocery.
  const receiptMode = lines.filter((l) => /\t|\S\s{2,}\S/.test(l.trim()) || /\d+[.,]\d{2}\s*$/.test(l)).length >= 2;

  for (const rawLine of lines) {
    // "one and a half kg" must be read before we split on "and".
    const line = rawLine
      .trim()
      .replace(/\b(\d+(?:\.\d+)?|one|two|three|four|five)\s+and\s+a\s+half\b/gi, (_, n: string) => {
        const base = /\d/.test(n) ? Number(n) : NUMBER_WORDS[n.toLowerCase()];
        return String(base + 0.5);
      });
    if (!/[a-z]/i.test(line)) continue;
    if (NOISE_LINE.test(line) || DATE_LIKE.test(line)) continue;
    const receiptLike = /\t|\S\s{2,}\S/.test(line) || /\d+[.,]\d{2}\s*$/.test(line);

    // Split on commas (not decimal commas), semicolons, "and", "&", "+", bullets.
    const chunks = line.split(/(?<!\d),|,(?!\d)|;|\s+and\s+|\s*&\s*|\s\+\s|\s*•\s*/i);
    for (const chunk of chunks) {
      const parsed = parseChunk(chunk, receiptLike, stapleSet);
      if (!parsed) continue;
      if (receiptMode && !/\d/.test(line) && !parsed.known) continue;
      items.push(parsed);
    }
  }
  // Merge first (so 500 g + 500 g tomatoes = 1 kg), then turn weights of countable things into counts.
  return mergeParsed(items).map(asCount);
}

/** Countable items are kept as a whole count: "half kg tomatoes" -> 4 tomatoes (estimated). */
export function asCount(item: ParsedItem): ParsedItem {
  if (item.staple) return item;
  const c = toCount(item.name, item);
  if (!c.from) return item;
  return { ...item, qty: c.qty, unit: 'pcs', estimatedFrom: c.from };
}

function parseChunk(chunk: string, receiptLike: boolean, staples: Set<string>): ParsedItem | null {
  const source = chunk.trim().replace(/^[-*•\d]+[.)]\s+/, '');
  if (!source) return null;

  let s = ' ' + source.toLowerCase() + ' ';
  // Currency amounts and "@ 56.00" unit prices are prices, not quantities.
  s = s.replace(/(rs\.?|inr|₹|\$|€|£)\s*\d+(?:[.,]\d+)?/g, ' ');
  s = s.replace(/\d+(?:[.,]\d+)?\s*(?:rs|inr|₹|\/-|eur|usd)\b/g, ' ');
  s = s.replace(/@\s*\d+(?:[.,]\d+)?/g, ' ');
  // Fractions and words for amounts.
  s = s.replace(/½/g, ' 0.5 ').replace(/¼/g, ' 0.25 ').replace(/¾/g, ' 0.75 ');
  s = s.replace(/(\d+)\s+(\d)\/(\d)/g, (_, w, n, d) => ` ${Number(w) + Number(n) / Number(d)} `);
  s = s.replace(/(\d)\/(\d)/g, (_, n, d) => ` ${Number(n) / Number(d)} `);
  s = s.replace(/\bhalf an?\b/g, ' half ');
  s = s.replace(/\b(a\s+)?couple(\s+of)?\b/g, ' 2 ');
  s = s.replace(/(\d),(\d{1,2})\b/g, '$1.$2'); // decimal comma
  // Separate glued numbers and units: "1kg" -> "1 kg", "x2" -> "x 2".
  s = s.replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2');
  s = s.replace(/(\d)\s*\*\s*(\d)/g, '$1 x $2');

  const tokens = s.split(/[\s()[\]:"']+/).filter(Boolean);
  let measure: { qty: number; unit: Unit } | null = null;
  let packs: number | null = null;
  let multiplier: number | null = null;
  const bare: number[] = [];
  const nameTokens: string[] = [];

  const numberOf = (tok: string | undefined): number | null => {
    if (tok === undefined) return null;
    if (/^\d+(\.\d+)?$/.test(tok)) return Number(tok);
    if (tok in NUMBER_WORDS) return NUMBER_WORDS[tok];
    return null;
  };
  const isUnitOrPack = (tok: string | undefined) => !!tok && (!!unitWord(tok) || PACK_WORDS.has(tok));

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = tokens[i + 1];
    let n = numberOf(tok);
    // "a dozen", "an l", "a packet" -> 1
    if (n === null && (tok === 'a' || tok === 'an') && isUnitOrPack(next)) n = 1;

    if (n !== null) {
      // Prices on receipts look like 45.00; drop them unless a unit follows.
      if (/^\d+\.\d{2}$/.test(tok) && !isUnitOrPack(next)) continue;
      if (next === 'x') {
        // "2 x 500 g butter" -> multiplier
        multiplier = n;
        i++;
        continue;
      }
      // "half dozen" / "1 kg" / "2 l"
      let j = i + 1;
      if (tokens[j] === 'of') j++;
      if (unitWord(tokens[j] ?? '')) {
        const m = toCanonical(n, tokens[j]);
        if (m) {
          if (measure && measure.unit === m.unit) measure = { qty: measure.qty + m.qty, unit: m.unit };
          else if (!measure) measure = m;
          i = j;
          if (tokens[i + 1] === 'of') i++;
          continue;
        }
      }
      if (PACK_WORDS.has(tokens[j] ?? '')) {
        packs = (packs ?? 0) + n;
        i = j;
        if (tokens[i + 1] === 'of') i++;
        continue;
      }
      bare.push(n); // "6 eggs", or "half watermelon" -> 0.5
      continue;
    }
    if (tok === 'x') {
      const m = numberOf(next);
      if (m !== null) {
        multiplier = m;
        i++;
      }
      continue;
    }
    if (unitWord(tok) && !['no', 'unit', 'count', 'l', 'g'].includes(tok)) {
      // Unit without a number: "kg onions" -> 1 kg
      if (!measure) measure = toCanonical(1, tok);
      continue;
    }
    if (PACK_WORDS.has(tok)) {
      packs = packs ?? 1;
      continue;
    }
    if (STOP_WORDS.has(tok)) continue;
    if (/^[a-z][a-z-]*$/.test(tok)) nameTokens.push(tok);
  }

  const name = normalizeName(nameTokens.join(' '));
  if (!name) return null;
  const entry = catalogEntry(name);
  const defaultUnit: Unit = entry?.unit ?? 'pcs';
  const pack = entry?.pack ?? (defaultUnit === 'pcs' ? 1 : 500);

  // Bare numbers: on receipts, extra numbers after a quantity are line qty or prices.
  let count: number | null = null;
  for (const b of bare) {
    if (measure || packs !== null) {
      if (multiplier === null && b <= 10 && Number.isInteger(b)) multiplier = b;
      continue; // larger numbers alongside a weight are prices
    }
    if (count === null) {
      if (receiptLike && bare.length === 1 && b > 30) continue; // "BREAD   45" is a price
      count = b;
    } else if (multiplier === null && b <= 10) {
      // "EGGS 6 2" -> 6 x 2 (line qty); otherwise it's a price
      multiplier = b;
    }
  }
  if (count === null && multiplier !== null && !measure && packs === null) {
    count = multiplier;
    multiplier = null;
  }

  let qty: number;
  let unit: Unit;
  let assumed = false;
  if (measure) {
    qty = measure.qty * (multiplier ?? 1);
    unit = measure.unit;
  } else if (packs !== null) {
    qty = packs * pack * (multiplier ?? 1);
    unit = defaultUnit;
    assumed = true;
  } else if (count !== null) {
    if (defaultUnit === 'pcs') {
      qty = count * (multiplier ?? 1);
      unit = 'pcs';
    } else {
      // "2 milk" means two of the usual pack
      qty = count * pack * (multiplier ?? 1);
      unit = defaultUnit;
      assumed = true;
    }
  } else {
    qty = pack;
    unit = defaultUnit;
    assumed = true;
  }

  return {
    name,
    qty: round(qty, unit),
    unit,
    source,
    assumed,
    known: !!entry,
    staple: staples.has(name) || !!entry?.staple,
  };
}

/** Merge duplicate names, summing quantities where units are compatible. */
export function mergeParsed(items: ParsedItem[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const item of items) {
    const existing = out.find((o) => o.name === item.name && convert(item, o.unit, o.name) !== null);
    if (existing) {
      existing.qty = round(existing.qty + (convert(item, existing.unit, existing.name) ?? 0), existing.unit);
      existing.source = `${existing.source}; ${item.source}`;
      existing.assumed = existing.assumed || item.assumed;
    } else {
      out.push({ ...item });
    }
  }
  return out;
}
