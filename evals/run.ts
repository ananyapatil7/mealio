/**
 * Mealio eval suite. Run: npm run evals
 * Scores real app logic against hand-labelled datasets (evals/datasets.ts) and seeded simulations.
 * Writes evals/RESULTS.md. Deterministic: same code -> same numbers.
 */
import { writeFileSync } from 'node:fs';
import { parseGroceryText } from '../src/lib/parser';
import { rankRecipes } from '../src/lib/ranking';
import { planCook } from '../src/lib/cooking';
import { buildShoppingList } from '../src/lib/shopping';
import { addToInventory, available } from '../src/lib/inventory';
import { convert, scaleQty } from '../src/lib/units';
import { CATALOG, DEFAULT_STAPLES } from '../src/data/ingredients';
import { RECIPES, RECIPES_BY_ID } from '../src/data/recipes';
import type { InventoryItem, MealType, Staple, Unit } from '../src/lib/types';
import { DIET_EXCLUSIONS, PARSE_CASES, SEARCH_CASES } from './datasets';

// ---------- helpers
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`);
const out: string[] = [];
const log = (s = '') => {
  console.log(s);
  out.push(s);
};
const table = (head: string[], rows: (string | number)[][]) => {
  log(`| ${head.join(' | ')} |`);
  log(`|${head.map(() => '---').join('|')}|`);
  for (const r of rows) log(`| ${r.join(' | ')} |`);
  log();
};
const nonStaples = CATALOG.filter((c) => !c.staple && c.pack);

// ---------- E1: grocery input understanding
function evalParsing() {
  const slices = new Map<string, { exp: number; found: number; parsed: number; correctParsed: number; qtyN: number; qtyOk: number; silent: number }>();
  const failures: string[] = [];
  for (const c of PARSE_CASES) {
    const s = slices.get(c.slice) ?? { exp: 0, found: 0, parsed: 0, correctParsed: 0, qtyN: 0, qtyOk: 0, silent: 0 };
    const parsed = parseGroceryText(c.input, DEFAULT_STAPLES);
    s.exp += c.expect.length;
    s.parsed += parsed.length;
    for (const p of parsed) {
      if (c.expect.some((x) => x.name === p.name)) s.correctParsed++;
      else {
        if (p.known) s.silent++; // mapped to a wrong *known* item: looks right, isn't
        failures.push(`[${c.slice}] "${p.source}" -> extra/garbled item "${p.name}"${p.known ? ' (SILENT)' : ' (flagged as new)'}`);
      }
    }
    for (const x of c.expect) {
      const p = parsed.find((q) => q.name === x.name);
      if (!p) {
        failures.push(`[${c.slice}] missed "${x.name}" in "${c.input.replace(/\n/g, ' / ').slice(0, 60)}"`);
        continue;
      }
      s.found++;
      if (x.qty === null || !x.unit) continue;
      s.qtyN++;
      const got = convert(p, x.unit, x.name);
      const ok = got !== null && Math.abs(got - x.qty) <= 0.1 * x.qty;
      if (ok) s.qtyOk++;
      else {
        const flagged = p.assumed || !!p.estimatedFrom;
        if (!flagged) s.silent++;
        failures.push(`[${c.slice}] "${x.name}": expected ${x.qty} ${x.unit}, got ${p.qty} ${p.unit}${flagged ? ' (flagged)' : ' (SILENT)'}`);
      }
    }
    slices.set(c.slice, s);
  }
  const tot = [...slices.values()].reduce((a, b) => ({
    exp: a.exp + b.exp, found: a.found + b.found, parsed: a.parsed + b.parsed, correctParsed: a.correctParsed + b.correctParsed,
    qtyN: a.qtyN + b.qtyN, qtyOk: a.qtyOk + b.qtyOk, silent: a.silent + b.silent,
  }));
  log(`## E1 · Grocery input understanding (${PARSE_CASES.length} inputs, ${tot.exp} labelled items)`);
  log('Item recall = typed items found with the right name. Precision = parsed items that are real and correctly named.');
  log('Qty accuracy = within ±10% of what was meant (counts compared via piece weight). Silent errors = wrong but NOT flagged on the confirm screen.');
  log();
  table(
    ['Slice', 'Items', 'Recall', 'Precision', 'Qty accuracy', 'Silent errors'],
    [...[...slices].map(([k, s]) => [k, s.exp, pct(s.found, s.exp), pct(s.correctParsed, s.parsed), pct(s.qtyOk, s.qtyN), s.silent]),
      ['**All**', tot.exp, `**${pct(tot.found, tot.exp)}**`, `**${pct(tot.correctParsed, tot.parsed)}**`, `**${pct(tot.qtyOk, tot.qtyN)}**`, `**${tot.silent}**`]],
  );
  log('<details><summary>Failures</summary>\n');
  for (const f of failures) log(`- ${f}`);
  log('\n</details>\n');
  return { recall: tot.found / tot.exp, silent: tot.silent };
}

// ---------- E2: recipe search
function evalSearch() {
  const slices = new Map<string, { n: number; hit: number; zero: number }>();
  const failures: string[] = [];
  for (const c of SEARCH_CASES) {
    const s = slices.get(c.slice) ?? { n: 0, hit: 0, zero: 0 };
    const ids = rankRecipes(RECIPES, [], [], { servings: 1, query: c.query }).map((m) => m.recipe.id);
    s.n++;
    if (ids.length === 0) s.zero++;
    if (c.expect.every((id) => ids.includes(id))) s.hit++;
    else failures.push(`"${c.query}" -> ${ids.length ? `missing ${c.expect.filter((id) => !ids.includes(id)).join(', ')}` : '0 results'}`);
    slices.set(c.slice, s);
  }
  const tot = [...slices.values()].reduce((a, b) => ({ n: a.n + b.n, hit: a.hit + b.hit, zero: a.zero + b.zero }));
  log(`## E2 · Recipe search (${SEARCH_CASES.length} labelled queries)`);
  table(
    ['Slice', 'Queries', 'Found expected recipes', 'Zero-result rate'],
    [...[...slices].map(([k, s]) => [k, s.n, pct(s.hit, s.n), pct(s.zero, s.n)]), ['**All**', tot.n, `**${pct(tot.hit, tot.n)}**`, `**${pct(tot.zero, tot.n)}**`]],
  );
  if (failures.length) log(`Failures: ${failures.map((f) => `\`${f}\``).join(' · ')}\n`);
  return { hit: tot.hit / tot.n };
}

// ---------- E3: dietary safety (zero tolerance)
function evalDiet() {
  const NONVEG = new Set(['egg', 'chicken', 'fish']);
  let checked = 0;
  let violations = 0;
  const rows: (string | number)[][] = [];
  const vegResults = rankRecipes(RECIPES, [], [], { servings: 1, vegOnly: true });
  const vegViol = vegResults.filter((m) => m.recipe.ingredients.some((i) => NONVEG.has(i.name))).length;
  rows.push(['Veg filter', vegResults.length, vegViol]);
  checked += vegResults.length;
  violations += vegViol;
  for (const d of DIET_EXCLUSIONS) {
    const res = rankRecipes(RECIPES, [], [], { servings: 1, query: d.query });
    const v = res.filter((m) => m.recipe.ingredients.some((i) => d.banned.includes(i.name))).length;
    rows.push([`"${d.query}"`, res.length, v]);
    checked += res.length;
    violations += v;
  }
  log(`## E3 · Dietary safety (zero tolerance)`);
  table(['Filter', 'Recipes shown', 'Violations'], [...rows, ['**All**', checked, `**${violations}**`]]);
  return { violations };
}

// ---------- random kitchens
function randomKitchen(r: () => number, size: number, pool = nonStaples): { inventory: InventoryItem[]; staples: Staple[] } {
  const picks = [...pool].sort(() => r() - 0.5).slice(0, size);
  const incoming = picks.map((c) => {
    const unit: Unit = c.unit === 'pcs' && r() < 0.3 ? 'g' : c.unit; // sometimes entered by weight
    const base = unit === 'pcs' ? 12 : unit === 'g' ? 1500 : 2000;
    return { name: c.key, qty: Math.round(r() * base * 10) / 10 + (unit === 'pcs' ? 0.5 : 1), unit };
  });
  const inventory = addToInventory([], incoming, 0);
  const staples = DEFAULT_STAPLES.map((name) => ({ name, have: r() < 0.85 }));
  return { inventory, staples };
}

// ---------- E4: "Cook now" honesty
function evalHonesty(N = 10000) {
  const r = rng(42);
  let readyClaims = 0, falseReady = 0, missingClaims = 0, falseMissing = 0, checks = 0;
  for (let k = 0; k < N; k++) {
    const { inventory, staples } = randomKitchen(r, 3 + Math.floor(r() * 22));
    const servings = 1 + Math.floor(r() * 4);
    for (const m of rankRecipes(RECIPES, inventory, staples, { servings })) {
      checks++;
      // Independent check, written from the rule: every ingredient covered at the scaled amount.
      const covered = m.recipe.ingredients.every((ing) => {
        const st = staples.find((s) => s.name === ing.name);
        if (st) return st.have;
        return available(inventory, ing.name, ing.unit) + 1e-9 >= scaleQty(ing.qty, m.recipe.baseServings, servings, ing.unit);
      });
      const cookPlanOk = planCook(m.recipe, servings, inventory, staples).shortages.length === 0;
      if (m.missingCount === 0) {
        readyClaims++;
        if (!covered || !cookPlanOk) falseReady++;
      } else {
        missingClaims++;
        if (covered) falseMissing++;
      }
    }
  }
  log(`## E4 · "Cook now" honesty (${N.toLocaleString()} simulated kitchens, ${checks.toLocaleString()} recipe checks)`);
  table(
    ['Check', 'Claims', 'Wrong', 'Rate'],
    [['Said "Cook now" but something was short', readyClaims, falseReady, pct(falseReady, readyClaims)], ['Said "missing" but you had enough', missingClaims, falseMissing, pct(falseMissing, missingClaims)]],
  );
  return { falseReady };
}

// ---------- E5: shopping list correctness
function evalShopping(N = 2000) {
  const r = rng(7);
  let rows = 0, unnecessary = 0, shortfalls = 0, listed = 0, cleared = 0;
  for (let k = 0; k < N; k++) {
    const { inventory, staples } = randomKitchen(r, 3 + Math.floor(r() * 15));
    const planned = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => ({ id: String(i), recipeId: RECIPES[Math.floor(r() * RECIPES.length)].id, servings: 1 + Math.floor(r() * 3) }));
    const list = buildShoppingList({ inventory, staples, planned, manual: [], recipes: RECIPES_BY_ID });
    // Independent need per ingredient (pcs for countables, as the app stores them)
    const need = new Map<string, number>();
    for (const p of planned) {
      const rec = RECIPES_BY_ID.get(p.recipeId)!;
      for (const ing of rec.ingredients) {
        if (staples.some((s) => s.name === ing.name)) continue;
        need.set(`${ing.name}|${ing.unit}`, (need.get(`${ing.name}|${ing.unit}`) ?? 0) + scaleQty(ing.qty, rec.baseServings, p.servings, ing.unit));
      }
    }
    for (const row of list) {
      rows++;
      if (row.staple) {
        if (staples.find((s) => s.name === row.name)?.have) unnecessary++;
        continue;
      }
      const item = inventory.find((i) => i.name === row.name && i.unit === row.unit);
      const low = !!item && (item.qty <= 0 || (item.lowAt !== undefined && item.qty < item.lowAt));
      const needInRow = [...need].filter(([key]) => key.startsWith(`${row.name}|`)).reduce((s, [key, q]) => s + (convert({ qty: q, unit: key.split('|')[1] as Unit }, row.unit!, row.name) ?? 0), 0);
      if (!low && available(inventory, row.name, row.unit!) + 1e-9 >= needInRow) unnecessary++;
    }
    for (const [key, q] of need) {
      const [name, unit] = key.split('|');
      if (available(inventory, name, unit as Unit) + 1e-9 < q) {
        shortfalls++;
        if (list.some((row) => row.name === name)) listed++;
      }
    }
    for (const s of staples) {
      if (!s.have) {
        shortfalls++;
        if (list.some((row) => row.name === s.name && row.staple)) listed++;
      }
    }
    const after = addToInventory(inventory, list.filter((x) => x.qty && x.unit).map((x) => ({ name: x.name, qty: x.qty!, unit: x.unit! })));
    const again = buildShoppingList({ inventory: after, staples: staples.map((s) => ({ ...s, have: true })), planned, manual: [], recipes: RECIPES_BY_ID });
    if (again.length === 0) cleared++;
  }
  log(`## E5 · Shopping list correctness (${N.toLocaleString()} simulated kitchens with 1–3 planned meals)`);
  table(
    ['Metric', 'Result'],
    [
      ['Precision: rows you actually needed', `${pct(rows - unnecessary, rows)} (${unnecessary} unnecessary of ${rows})`],
      ['Recall: real shortfalls that were listed', `${pct(listed, shortfalls)} (${listed}/${shortfalls})`],
      ['Buying the list fully covers the plan', pct(cleared, N)],
    ],
  );
  return { unnecessary };
}

// ---------- E6: utility: how often can the app actually help?
function evalUtility(N = 1000) {
  const r = rng(99);
  const COMMON = ['egg', 'onion', 'tomato', 'potato', 'green chilli', 'garlic', 'ginger', 'lemon', 'banana', 'bread', 'milk', 'curd', 'paneer', 'rice', 'toor dal', 'pasta', 'oats', 'cheese', 'butter', 'flattened rice', 'chickpeas', 'spinach', 'carrot', 'capsicum', 'chicken', 'peas', 'wheat flour', 'semolina', 'noodles', 'cucumber'];
  const pool = CATALOG.filter((c) => COMMON.includes(c.key));
  const rows: (string | number)[][] = [];
  for (const size of [5, 10, 15]) {
    const meals: (MealType | undefined)[] = ['breakfast', 'lunch', 'dinner', 'snack', undefined];
    const stat = meals.map(() => ({ ready: 0, close: 0, counts: [] as number[] }));
    for (let k = 0; k < N; k++) {
      // Realistic stock: one usual pack of each item, all staples except ~10%
      const picks = [...pool].sort(() => r() - 0.5).slice(0, size);
      const inventory = addToInventory([], picks.map((c) => ({ name: c.key, qty: c.pack ?? 1, unit: c.unit })), 0);
      const staples = DEFAULT_STAPLES.map((name) => ({ name, have: r() < 0.9 }));
      meals.forEach((mealType, i) => {
        const res = rankRecipes(RECIPES, inventory, staples, { servings: 1, mealType });
        const ready = res.filter((m) => m.missingCount === 0).length;
        stat[i].counts.push(ready);
        if (ready > 0) stat[i].ready++;
        if (res.some((m) => m.missingCount <= 2)) stat[i].close++;
      });
    }
    const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    rows.push([`${size} items`, ...stat.map((s) => `${pct(s.ready, N)} · ${pct(s.close, N)} · ${median(s.counts)}`)]);
  }
  log(`## E6 · Utility: can the app suggest something? (${N.toLocaleString()} realistic kitchens per size)`);
  log('Each cell: kitchens with ≥1 recipe ready now · with ≥1 recipe ≤2 items away · median recipes ready now.');
  log();
  table(['Kitchen', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'All'], rows);
}

// ---------- run
log(`# Mealio eval results`);
log(`Generated by \`npm run evals\` on ${new Date().toISOString().slice(0, 10)}. Datasets: evals/datasets.ts. Seeded, so reruns are identical.\n`);
const e1 = evalParsing();
const e2 = evalSearch();
const e3 = evalDiet();
const e4 = evalHonesty();
const e5 = evalShopping();
evalUtility();
log(`## Release gates`);
table(
  ['Gate', 'Target', 'Result', 'Status'],
  [
    ['Dietary violations', '0', e3.violations, e3.violations === 0 ? 'PASS' : 'FAIL'],
    ['False "Cook now"', '0', e4.falseReady, e4.falseReady === 0 ? 'PASS' : 'FAIL'],
    ['Unnecessary shopping rows', '0', e5.unnecessary, e5.unnecessary === 0 ? 'PASS' : 'FAIL'],
    ['Grocery item recall', '≥ 90%', pct(e1.recall * 100, 100), e1.recall >= 0.9 ? 'PASS' : 'FAIL'],
    ['Silent parsing errors', '0', e1.silent, e1.silent === 0 ? 'PASS' : 'FAIL'],
    ['Search: expected recipes found', '≥ 90%', pct(e2.hit * 100, 100), e2.hit >= 0.9 ? 'PASS' : 'FAIL'],
  ],
);
writeFileSync(new URL('./RESULTS.md', import.meta.url), out.join('\n') + '\n');
