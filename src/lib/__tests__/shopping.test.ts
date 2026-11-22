import { describe, expect, it } from 'vitest';
import { buildShoppingList } from '../shopping';
import type { InventoryItem, Recipe, Staple } from '../types';
import { RECIPES, RECIPES_BY_ID } from '../../data/recipes';
import { addToInventory } from '../inventory';
import { DEFAULT_STAPLES } from '../../data/ingredients';

const mk = (id: string, ingredients: [string, number, 'pcs' | 'g' | 'ml'][], baseServings = 2): Recipe => ({
  id, name: id, cuisine: 'Global', mealTypes: ['dinner'], baseServings, cookTimeMin: 10, tags: ['veg'], caloriesPerServing: 100,
  ingredients: ingredients.map(([name, qty, unit]) => ({ name, qty, unit })), steps: [],
});
const recipes = new Map<string, Recipe>([
  ['a', mk('a', [['onion', 2, 'pcs'], ['tomato', 200, 'g'], ['salt', 1, 'g']])],
  ['b', mk('b', [['onion', 3, 'pcs'], ['paneer', 200, 'g'], ['oil', 10, 'ml']])],
]);
const inv = (items: [string, number, InventoryItem['unit'], number?][]): InventoryItem[] =>
  items.map(([name, qty, unit, lowAt], i) => ({ id: String(i), name, qty, unit, lowAt, updatedAt: 0 }));
const staples: Staple[] = [{ name: 'salt', have: true }, { name: 'oil', have: false }];
const base = { staples, manual: [], recipes };

describe('shopping list', () => {
  it('adds items below their low-stock threshold, topped up to a restock target', () => {
    const rows = buildShoppingList({ ...base, inventory: inv([['egg', 1, 'pcs', 4], ['milk', 1000, 'ml', 500]]), planned: [] });
    const egg = rows.find((r) => r.name === 'egg');
    expect(egg).toMatchObject({ qty: 7, unit: 'pcs', reasons: ['Running low'] }); // target 8
    expect(rows.find((r) => r.name === 'milk')).toBeUndefined();
  });

  it('merges planned needs across meals, sums them and subtracts stock', () => {
    const rows = buildShoppingList({
      ...base,
      inventory: inv([['onion', 4, 'pcs']]),
      planned: [{ id: '1', recipeId: 'a', servings: 2 }, { id: '2', recipeId: 'b', servings: 2 }],
    });
    const onion = rows.filter((r) => r.name === 'onion');
    expect(onion).toHaveLength(1);
    expect(onion[0]).toMatchObject({ qty: 1, unit: 'pcs' }); // 2 + 3 - 4
    expect(onion[0].reasons).toEqual(['For a', 'For b']);
    expect(rows.find((r) => r.name === 'tomato')).toMatchObject({ qty: 200, unit: 'g' });
    expect(rows.find((r) => r.name === 'paneer')).toMatchObject({ qty: 200, unit: 'g' });
    // staples: missing oil is listed, salt (have) is not
    expect(rows.find((r) => r.name === 'oil')).toMatchObject({ staple: true });
    expect(rows.find((r) => r.name === 'salt')).toBeUndefined();
  });

  it('scales planned needs by servings', () => {
    const rows = buildShoppingList({ ...base, inventory: [], planned: [{ id: '1', recipeId: 'a', servings: 4 }] });
    expect(rows.find((r) => r.name === 'onion')).toMatchObject({ qty: 4 });
    expect(rows.find((r) => r.name === 'tomato')).toMatchObject({ qty: 400 });
  });

  it('done-criterion 4: never includes items the user has enough of', () => {
    const inventory = inv([['onion', 10, 'pcs', 2], ['tomato', 1000, 'g'], ['paneer', 500, 'g', 100]]);
    const rows = buildShoppingList({
      ...base,
      staples: staples.map((s) => ({ ...s, have: true })),
      inventory,
      planned: [{ id: '1', recipeId: 'a', servings: 2 }, { id: '2', recipeId: 'b', servings: 2 }],
    });
    expect(rows).toEqual([]);
  });

  it('property: for every real recipe plan, no generated row is something already covered', () => {
    const inventory = inv([['onion', 3, 'pcs', 2], ['tomato', 2, 'pcs'], ['egg', 6, 'pcs', 4], ['rice', 1000, 'g'], ['milk', 300, 'ml', 500]]);
    const allStaples = DEFAULT_STAPLES.map((name) => ({ name, have: true }));
    for (const r of RECIPES) {
      const rows = buildShoppingList({ inventory, staples: allStaples, manual: [], recipes: RECIPES_BY_ID, planned: [{ id: 'x', recipeId: r.id, servings: 2 }] });
      for (const row of rows) {
        // buying the row must be necessary: stock alone doesn't cover need + restock
        expect(row.qty).toBeGreaterThan(0);
      }
      // And buying everything clears the list.
      const after = addToInventory(inventory, rows.filter((x) => x.qty && x.unit).map((x) => ({ name: x.name, qty: x.qty!, unit: x.unit! })));
      const again = buildShoppingList({ inventory: after, staples: allStaples, manual: [], recipes: RECIPES_BY_ID, planned: [{ id: 'x', recipeId: r.id, servings: 2 }] });
      expect(again).toEqual([]);
    }
  });

  it('lists run-out items with a usual pack size', () => {
    const rows = buildShoppingList({ ...base, inventory: inv([['milk', 0, 'ml']]), planned: [] });
    expect(rows.find((r) => r.name === 'milk')).toMatchObject({ qty: 1000, unit: 'ml', reasons: ['Ran out'] });
  });

  it('merges manual items into generated rows and sums quantities', () => {
    const rows = buildShoppingList({
      ...base,
      inventory: [],
      planned: [{ id: '1', recipeId: 'a', servings: 2 }],
      manual: [{ id: 'm1', name: 'onion', qty: 3, unit: 'pcs' }, { id: 'm2', name: 'bread', qty: 20, unit: 'pcs' }],
    });
    expect(rows.find((r) => r.name === 'onion')).toMatchObject({ qty: 5, manualIds: ['m1'] });
    expect(rows.find((r) => r.name === 'bread')).toMatchObject({ qty: 20, auto: false });
  });

  it('hides dismissed generated rows', () => {
    const rows = buildShoppingList({
      ...base, inventory: [], planned: [{ id: '1', recipeId: 'a', servings: 2 }], dismissed: { 'auto:tomato:g': true },
    });
    expect(rows.find((r) => r.name === 'tomato')).toBeUndefined();
    expect(rows.find((r) => r.name === 'onion')).toBeDefined();
  });

  it('uses the inventory unit when the recipe unit differs', () => {
    const rows = buildShoppingList({ ...base, inventory: inv([['onion', 150, 'g']]), planned: [{ id: '1', recipeId: 'a', servings: 2 }] });
    expect(rows.find((r) => r.name === 'onion')).toMatchObject({ qty: 150, unit: 'g' }); // 300 g needed
  });
});
