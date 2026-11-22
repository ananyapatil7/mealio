import type { AppState, InventoryItem, MealLog, Unit } from '../lib/types';
import { DEFAULT_STAPLES } from './ingredients';
import { RECIPES_BY_ID } from './recipes';
import { uid } from '../lib/inventory';
import { makeLog } from '../lib/cooking';

/** A realistic single-person kitchen to try the app with. */
const SAMPLE_ITEMS: [string, number, Unit, number?][] = [
  ['egg', 6, 'pcs', 4],
  ['onion', 5, 'pcs', 2],
  ['tomato', 3, 'pcs', 2],
  ['potato', 4, 'pcs'],
  ['green chilli', 6, 'pcs'],
  ['garlic', 10, 'pcs'],
  ['ginger', 50, 'g'],
  ['lemon', 1, 'pcs'],
  ['banana', 2, 'pcs'],
  ['bread', 6, 'pcs', 4],
  ['milk', 400, 'ml', 500],
  ['curd', 300, 'g'],
  ['paneer', 200, 'g'],
  ['rice', 1500, 'g', 500],
  ['toor dal', 400, 'g'],
  ['flattened rice', 300, 'g'],
  ['pasta', 250, 'g'],
  ['oats', 200, 'g'],
  ['cheese', 100, 'g'],
  ['peanuts', 100, 'g'],
];

const MISSING_STAPLES = new Set(['soy sauce', 'chaat masala', 'chilli flakes']);

export function sampleState(now: Date = new Date()): AppState {
  const t = now.getTime();
  const inventory: InventoryItem[] = SAMPLE_ITEMS.map(([name, qty, unit, lowAt]) => ({
    id: uid(),
    name,
    qty,
    unit,
    ...(lowAt !== undefined ? { lowAt } : {}),
    updatedAt: t,
  }));

  // A few meals over the past week so the tracker has something to show.
  const history: [string, number, number, number][] = [
    // [recipeId, servings, daysAgo, hour]
    ['poha', 1, 1, 9],
    ['dal-tadka', 1, 1, 20],
    ['masala-omelette', 1, 2, 9],
    ['tomato-pasta', 1, 2, 20],
    ['overnight-oats', 1, 3, 8],
    ['egg-fried-rice', 1, 3, 21],
    ['curd-rice', 1, 4, 13],
    ['banana-smoothie', 1, 5, 17],
    ['chana-masala', 1, 5, 20],
  ];
  const mealLogs: MealLog[] = history.flatMap(([id, servings, daysAgo, hour]) => {
    const recipe = RECIPES_BY_ID.get(id);
    if (!recipe) return [];
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 0);
    return [makeLog(recipe, servings, at)];
  });

  return {
    version: 1,
    inventory,
    staples: DEFAULT_STAPLES.map((name) => ({ name, have: !MISSING_STAPLES.has(name) })),
    mealLogs,
    planned: [{ id: uid(), recipeId: 'palak-paneer', servings: 2 }],
    shoppingManual: [],
    shoppingChecked: {},
    shoppingDismissed: {},
    settings: { servings: 1 },
  };
}
