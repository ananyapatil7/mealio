import { CATALOG, type CatalogEntry } from '../data/ingredients';

/** Plural forms that the simple rules below get wrong. */
const IRREGULAR: Record<string, string> = {
  chillies: 'chilli',
  chilies: 'chili',
  leaves: 'leaf',
  loaves: 'loaf',
  knives: 'knife',
  cookies: 'cookie',
  tomatoes: 'tomato',
  potatoes: 'potato',
  mangoes: 'mango',
  peas: 'pea',
  chips: 'chip',
  noodles: 'noodle',
};

/** Words that never change when singularised. */
const KEEP = new Set(['hummus', 'couscous', 'swiss', 'molasses', 'oats', 'asparagus', 'citrus', 'masala']);

export function singularize(word: string): string {
  const w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (KEEP.has(w) || w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Lower-case, strip punctuation, collapse whitespace, singularise each word. */
export function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
}

/** Lookup index: normalised alias phrase -> catalog entry. */
const INDEX = new Map<string, CatalogEntry>();
for (const entry of CATALOG) {
  for (const phrase of [entry.key, ...(entry.aliases ?? [])]) {
    const k = tokenize(phrase).join(' ');
    if (!INDEX.has(k)) INDEX.set(k, entry);
  }
}
const BY_KEY = new Map(CATALOG.map((c) => [c.key, c]));

/**
 * Head words that turn a known ingredient into a different product
 * ("tomato ketchup", "garlic powder", "chana dal"). If the phrase ends in one of
 * these and we don't know the full phrase, keep it as typed rather than guess.
 */
const PRODUCT_HEADS = new Set([
  'sauce', 'paste', 'powder', 'flour', 'juice', 'jam', 'chip', 'biscuit', 'cake', 'pickle',
  'soup', 'puree', 'dal', 'oil', 'bread', 'noodle', 'stock', 'spread', 'drink', 'shake', 'cracker',
]);

/**
 * Normalise a free-text ingredient name to a canonical key.
 * "Onions" -> "onion", "Tomatoes" -> "tomato", "Amul butter" -> "butter",
 * "basmati rice" -> "rice". Unknown names come back cleaned and singularised.
 */
export function normalizeName(raw: string): string {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return '';
  const whole = INDEX.get(tokens.join(' '));
  if (whole) return whole.key;

  // 1) Longest known phrase that ends at the last word (the head noun): "red onion", "toned milk".
  for (let len = tokens.length - 1; len >= 1; len--) {
    const hit = INDEX.get(tokens.slice(tokens.length - len).join(' '));
    if (hit) return hit.key;
  }
  // 2) Receipt style "ONION NASIK" / "TOMATO HYBRID": longest known phrase anywhere,
  //    unless the head word says it's a different product.
  const head = tokens[tokens.length - 1];
  if (!PRODUCT_HEADS.has(head)) {
    for (let len = tokens.length - 1; len >= 1; len--) {
      for (let start = 0; start + len <= tokens.length; start++) {
        const hit = INDEX.get(tokens.slice(start, start + len).join(' '));
        if (hit) return hit.key;
      }
    }
  }
  return tokens.join(' ');
}

export function catalogEntry(key: string): CatalogEntry | undefined {
  return BY_KEY.get(key);
}

export function isKnown(key: string): boolean {
  return BY_KEY.has(key);
}

export function displayName(key: string): string {
  const entry = BY_KEY.get(key);
  if (entry) return entry.label;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Does the free-text term refer to this ingredient? Used for "no paneer" filters. */
export function nameMatches(term: string, key: string): boolean {
  const t = normalizeName(term);
  if (!t) return false;
  if (t === key) return true;
  const keyTokens = tokenize(key);
  const contains = (toks: string[]) => toks.length > 0 && toks.every((tok) => keyTokens.includes(tok));
  // "no chilli" should exclude both green chilli and chilli powder.
  return contains(tokenize(term)) || contains(tokenize(t));
}
