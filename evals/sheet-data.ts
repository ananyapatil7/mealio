// Collects actual app outputs for the eval spreadsheet. Run: npx vite-node evals/sheet-data.ts <out.json>
import { writeFileSync } from 'node:fs';
import { parseGroceryText } from '../src/lib/parser';
import { rankRecipes, missingLabel, readiness } from '../src/lib/ranking';
import { planCook, applyDeductions, makeLog } from '../src/lib/cooking';
import { buildShoppingList } from '../src/lib/shopping';
import { addToInventory } from '../src/lib/inventory';
import { totalForDate, lastNDays } from '../src/lib/calories';
import { loadState } from '../src/lib/storage';
import { reducer } from '../src/state/reducer';
import { RECIPES, RECIPES_BY_ID } from '../src/data/recipes';
import { DEFAULT_STAPLES } from '../src/data/ingredients';
import type { Unit } from '../src/lib/types';

const staples = DEFAULT_STAPLES.map((name) => ({ name, have: true }));
const inv = (items: [string, number, Unit, number?][]) =>
  addToInventory([], items.map(([name, qty, unit]) => ({ name, qty, unit })), 0).map((i) => {
    const lowAt = items.find(([n]) => n === i.name)?.[3];
    return lowAt ? { ...i, lowAt } : i;
  });
const parse = (t: string) => parseGroceryText(t, DEFAULT_STAPLES).map((p) => `${p.name} ${p.qty} ${p.unit}${p.estimatedFrom ? ' (≈ estimate)' : ''}${p.assumed ? ' (guessed qty)' : ''}${!p.known ? ' (new item)' : ''}`).join('; ') || '(no items)';
const names = (q: string, mealType?: 'lunch', vegOnly?: boolean) => rankRecipes(RECIPES, [], [], { servings: 1, query: q, mealType, vegOnly }).map((m) => m.recipe.name);
const out: Record<string, string> = {};

const receipt = 'BIG BAZAAR\nTOMATO HYBRID 500G   1  24.00\nONION 1KG            1  40.00\nAMUL BUTTER 100G     2  112.00\nEGGS 12PC               84.00\nTOTAL                  260.00';
for (const [id, t] of Object.entries({
  P1: 'bought 6 eggs, 1kg onions, half kg tomatoes, milk', P2: '2 litres milk and a dozen eggs', P3: 'one and a half kg potatoes',
  P4: '250 gm butter, 200g cheese', P5: 'half dozen lemons', P6: '2 packets milk', P7: 'tomato ketchup', P8: receipt,
  P9: 'ek dozen ande', P10: 'do kilo aloo', P11: 'aadha kilo tamatar', P12: 'dahi 400g', P13: 'panner 200g', P14: '6 egs',
  P15: 'Zwiebeln 1kg', P16: '6 eggs Rs 42, 1 kg onions ₹35', U1: '1.5 kg rice',
})) out[id] = parse(t);

const s1 = names('pas'); out.S1 = `${s1.length} results: ${s1.join(', ')}`;
out.S2 = names('tomato pasta').join(', ');
out.S3 = names('aloo').join(', ');
const np = rankRecipes(RECIPES, [], [], { servings: 1, query: 'no paneer' });
out.S4 = `${np.length} results; containing paneer: ${np.filter((m) => m.recipe.ingredients.some((i) => i.name === 'paneer')).length}`;
const nog = rankRecipes(RECIPES, [], [], { servings: 1, query: 'without onion or garlic' });
out.S5 = `${nog.length} results; containing onion/garlic: ${nog.filter((m) => m.recipe.ingredients.some((i) => i.name === 'onion' || i.name === 'garlic')).length}`;
out.S6 = `${names('omlette').length} results`;
out.S7 = `Lunch tab: ${names('chai', 'lunch').length} results; All recipes: ${names('chai').join(', ')}`;
const veg = rankRecipes(RECIPES, [], [], { servings: 1, vegOnly: true });
out.S8 = `${veg.length} recipes; containing egg/chicken/fish: ${veg.filter((m) => m.recipe.ingredients.some((i) => ['egg', 'chicken', 'fish'].includes(i.name))).length}`;

const eggCurry = RECIPES_BY_ID.get('egg-curry')!;
const k1 = inv([['onion', 10, 'pcs'], ['egg', 12, 'pcs'], ['tomato', 6, 'pcs'], ['ginger', 100, 'g'], ['garlic', 10, 'pcs']]);
const p4 = planCook(eggCurry, 4, k1, staples);
out.C1 = `Onions needed ${p4.lines.find((l) => l.name === 'onion')!.need.qty}; left after: ${applyDeductions(k1, p4.lines).find((i) => i.name === 'onion')!.qty}`;
const p1 = planCook(eggCurry, 1, k1, staples);
out.C2 = `Onions needed ${p1.lines.find((l) => l.name === 'onion')!.need.qty}; left after: ${applyDeductions(k1, p1.lines).find((i) => i.name === 'onion')!.qty}`;
const soup = RECIPES_BY_ID.get('tomato-soup')!;
const k3 = inv([['tomato', 1, 'pcs'], ['onion', 2, 'pcs'], ['garlic', 4, 'pcs'], ['butter', 50, 'g']]);
const ps = planCook(soup, 2, k3, staples);
out.C3 = `Warning: ${ps.shortages.map((s) => `${s.name} need ${s.need.qty}, have ${s.available}`).join('; ')}; tomatoes after cooking: ${applyDeductions(k3, ps.lines).find((i) => i.name === 'tomato')!.qty}`;
const om = RECIPES_BY_ID.get('masala-omelette')!;
const exact = inv([['egg', 2, 'pcs'], ['onion', 1, 'pcs'], ['tomato', 1, 'pcs'], ['green chilli', 1, 'pcs']]);
const m1 = rankRecipes([om], exact, staples, { servings: 1 })[0];
const less = inv([['egg', 1, 'pcs'], ['onion', 1, 'pcs'], ['tomato', 1, 'pcs'], ['green chilli', 1, 'pcs']]);
const m2 = rankRecipes([om], less, staples, { servings: 1 })[0];
out.C4 = `With 2 eggs: "${readiness(m1.missingCount).label}"; with 1 egg: "${readiness(m2.missingCount).label}", missing: ${m2.missing.map(missingLabel).join(', ')}`;
const noOil = staples.map((s) => (s.name === 'oil' ? { ...s, have: false } : s));
const m5 = rankRecipes([om], exact, noOil, { servings: 1 })[0];
out.C5 = `"${readiness(m5.missingCount).label}", missing: ${m5.missing.map(missingLabel).join(', ')}`;

const k6 = inv([['paneer', 200, 'g'], ['onion', 3, 'pcs'], ['tomato', 3, 'pcs'], ['garlic', 6, 'pcs']]);
const l6 = buildShoppingList({ inventory: k6, staples, planned: [{ id: '1', recipeId: 'palak-paneer', servings: 2 }], manual: [], recipes: RECIPES_BY_ID });
out.SH1 = l6.map((r) => `${r.name} ${r.qty ?? ''} ${r.unit ?? ''}`.trim()).join('; ');
const l7 = buildShoppingList({ inventory: inv([['egg', 1, 'pcs', 4]]), staples, planned: [], manual: [], recipes: RECIPES_BY_ID });
out.SH2 = l7.map((r) => `${r.name} ${r.qty} ${r.unit} (${r.reasons.join(', ')})`).join('; ');
const l8 = buildShoppingList({ inventory: [], staples, planned: [{ id: '1', recipeId: 'dal-tadka', servings: 2 }, { id: '2', recipeId: 'aloo-gobi', servings: 2 }], manual: [], recipes: RECIPES_BY_ID });
const onionRows = l8.filter((r) => r.name === 'onion');
out.SH3 = `${onionRows.length} onion row: ${onionRows.map((r) => `${r.qty} ${r.unit} (${r.reasons.join(', ')})`).join('')}`;
let st = reducer(loadState(null), { type: 'togglePlan', recipeId: 'palak-paneer', servings: 2 });
const rows = buildShoppingList({ inventory: st.inventory, staples: st.staples, planned: st.planned, manual: [], recipes: RECIPES_BY_ID });
for (const r of rows) st = reducer(st, { type: 'toggleChecked', key: r.key });
st = reducer(st, { type: 'buyChecked', rows });
const after = buildShoppingList({ inventory: st.inventory, staples: st.staples, planned: st.planned, manual: [], recipes: RECIPES_BY_ID });
out.SH4 = `${rows.length} rows ticked -> kitchen now has ${st.inventory.length} items; list after: ${after.length} rows`;

const dal = RECIPES_BY_ID.get('dal-tadka')!;
out.K1 = `${makeLog(dal, 2).calories} kcal (${dal.caloriesPerServing} x 2)`;
const day = new Date(2026, 10, 20);
const logs = [makeLog(om, 1, new Date(2026, 10, 20, 9)), makeLog(dal, 2, new Date(2026, 10, 20, 20))];
out.K2 = `${totalForDate(logs, '2026-11-20')} kcal (${om.caloriesPerServing} + ${dal.caloriesPerServing * 2})`;
out.K3 = lastNDays(logs, new Date(2026, 10, 22), 7).map((d) => `${d.date.slice(5)}: ${d.total}`).join(', ');
void day;

const store = new Map<string, string>();
const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
kv.setItem('mealio:v1', JSON.stringify({ inventory: [{ id: 'a', name: 'onion', qty: 1000, unit: 'g', updatedAt: 0 }] }));
const mig = loadState(kv).inventory[0];
out.U2 = `${mig.name} ${mig.qty} ${mig.unit}`;

// AI-judged: persona kitchens -> app's top 3
const personas: [string, string, 'breakfast' | 'lunch' | 'dinner' | 'snack', [string, number, Unit][], { vegOnly?: boolean; query?: string }][] = [
  ['A1', 'Student, end of month', 'dinner', [['rice', 1000, 'g'], ['toor dal', 500, 'g'], ['onion', 2, 'pcs'], ['potato', 3, 'pcs'], ['egg', 2, 'pcs'], ['garlic', 8, 'pcs'], ['tomato', 1, 'pcs']], {}],
  ['A2', 'Just shopped, vegetarian', 'lunch', [['paneer', 200, 'g'], ['spinach', 250, 'g'], ['tomato', 4, 'pcs'], ['onion', 4, 'pcs'], ['rice', 1000, 'g'], ['curd', 400, 'g'], ['garlic', 10, 'pcs'], ['green chilli', 6, 'pcs'], ['capsicum', 1, 'pcs']], { vegOnly: true }],
  ['A3', 'Weekday breakfast, 10 minutes', 'breakfast', [['egg', 6, 'pcs'], ['bread', 10, 'pcs'], ['milk', 1000, 'ml'], ['banana', 3, 'pcs'], ['butter', 100, 'g'], ['oats', 300, 'g']], {}],
  ['A4', 'Almost empty: 3 items', 'dinner', [['pasta', 500, 'g'], ['garlic', 10, 'pcs'], ['cheese', 100, 'g']], {}],
  ['A5', 'European pantry', 'dinner', [['pasta', 500, 'g'], ['tomato', 4, 'pcs'], ['onion', 2, 'pcs'], ['cheese', 200, 'g'], ['mushroom', 200, 'g'], ['cream', 200, 'ml'], ['bread', 10, 'pcs'], ['garlic', 8, 'pcs'], ['butter', 100, 'g']], {}],
  ['A6', 'Afternoon snack', 'snack', [['banana', 2, 'pcs'], ['milk', 500, 'ml'], ['sweet corn', 200, 'g'], ['peanuts', 200, 'g'], ['lemon', 2, 'pcs'], ['onion', 1, 'pcs'], ['tomato', 1, 'pcs']], {}],
  ['A7', 'No onion or garlic (Jain)', 'lunch', [['rice', 1000, 'g'], ['potato', 4, 'pcs'], ['curd', 400, 'g'], ['moong dal', 500, 'g'], ['green chilli', 5, 'pcs'], ['lemon', 2, 'pcs'], ['peanuts', 100, 'g']], { query: 'without onion or garlic' }],
  ['A8', 'Protein dinner (chicken)', 'dinner', [['chicken', 500, 'g'], ['onion', 3, 'pcs'], ['tomato', 3, 'pcs'], ['curd', 400, 'g'], ['capsicum', 2, 'pcs'], ['rice', 1000, 'g'], ['ginger', 50, 'g'], ['garlic', 10, 'pcs']], {}],
];
const ai = personas.map(([id, who, meal, items, f]) => {
  const top = rankRecipes(RECIPES, inv(items), staples, { servings: 1, mealType: meal, ...f }).slice(0, 3);
  return { id, who, meal, kitchen: items.map(([n, q, u]) => `${n} ${q}${u === 'pcs' ? '' : ' ' + u}`).join(', '), filter: f.vegOnly ? 'Veg' : f.query ?? '', top: top.map((m) => `${m.recipe.name} [${readiness(m.missingCount).label}${m.missing.length ? ': ' + m.missing.map(missingLabel).join(', ') : ''}]`) };
});
writeFileSync(process.argv[2], JSON.stringify({ cases: out, ai }, null, 2));
console.log(JSON.stringify({ cases: out, ai }, null, 2));
