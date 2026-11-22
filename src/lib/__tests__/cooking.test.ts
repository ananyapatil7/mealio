import { describe, expect, it } from 'vitest';
import { applyDeductions, planCook } from '../cooking';
import { addToInventory, deductFromInventory, normalizeItem, stockLevel } from '../inventory';
import type { InventoryItem, Recipe, Staple } from '../types';

const onionRecipe: Recipe = {
  id: 'onion-thing', name: 'Onion thing', cuisine: 'Global', mealTypes: ['dinner'], baseServings: 2, cookTimeMin: 20,
  tags: ['veg', 'quick'], caloriesPerServing: 200,
  ingredients: [{ name: 'onion', qty: 4, unit: 'pcs' }, { name: 'tomato', qty: 200, unit: 'g' }, { name: 'salt', qty: 1, unit: 'g' }],
  steps: [],
};
const staples: Staple[] = [{ name: 'salt', have: true }];
const inv = (items: [string, number, InventoryItem['unit']][]): InventoryItem[] =>
  items.map(([name, qty, unit], i) => ({ id: String(i), name, qty, unit, updatedAt: 0 }));
const qtyOf = (items: InventoryItem[], name: string) => items.find((i) => i.name === name)?.qty;

describe('scaling and deduction', () => {
  it('done-criterion 3: 10 onions minus a 2-serving recipe needing 4 leaves 6', () => {
    const inventory = inv([['onion', 10, 'pcs'], ['tomato', 500, 'g']]);
    const plan = planCook(onionRecipe, 2, inventory, staples);
    expect(plan.lines.find((l) => l.name === 'onion')?.need).toEqual({ qty: 4, unit: 'pcs' });
    expect(plan.shortages).toEqual([]);
    const after = applyDeductions(inventory, plan.lines);
    expect(qtyOf(after, 'onion')).toBe(6);
    expect(qtyOf(after, 'tomato')).toBe(300);
  });

  it('changing servings scales the deduction', () => {
    const inventory = inv([['onion', 10, 'pcs'], ['tomato', 500, 'g']]);
    expect(qtyOf(applyDeductions(inventory, planCook(onionRecipe, 1, inventory, staples).lines), 'onion')).toBe(8);
    expect(qtyOf(applyDeductions(inventory, planCook(onionRecipe, 3, inventory, staples).lines), 'onion')).toBe(4);
    expect(qtyOf(applyDeductions(inventory, planCook(onionRecipe, 4, inventory, staples).lines), 'onion')).toBe(2);
  });

  it('warns on shortages and never goes below zero', () => {
    const inventory = inv([['onion', 3, 'pcs'], ['tomato', 100, 'g']]);
    const plan = planCook(onionRecipe, 2, inventory, staples);
    expect(plan.shortages.map((s) => [s.name, s.short])).toEqual([['onion', 1], ['tomato', 100]]);
    // Even if a user edits a deduction above what's there, it clamps.
    const lines = plan.lines.map((l) => ({ ...l, deduct: l.need.qty * 5 }));
    const after = applyDeductions(inventory, lines);
    expect(qtyOf(after, 'onion')).toBe(0);
    expect(qtyOf(after, 'tomato')).toBe(0);
  });

  it('lets the user adjust what is deducted', () => {
    const inventory = inv([['onion', 10, 'pcs'], ['tomato', 500, 'g']]);
    const plan = planCook(onionRecipe, 2, inventory, staples);
    const lines = plan.lines.map((l) => (l.name === 'onion' ? { ...l, deduct: 1 } : l));
    expect(qtyOf(applyDeductions(inventory, lines), 'onion')).toBe(9);
  });

  it('deducts across units (recipe in pcs, inventory in g)', () => {
    const inventory = inv([['onion', 1000, 'g'], ['tomato', 500, 'g']]);
    const after = applyDeductions(inventory, planCook(onionRecipe, 2, inventory, staples).lines);
    expect(qtyOf(after, 'onion')).toBe(400); // 4 x 150 g
  });

  it('does not deduct staples', () => {
    const plan = planCook(onionRecipe, 2, inv([['onion', 10, 'pcs']]), staples);
    expect(plan.lines.find((l) => l.name === 'salt')).toMatchObject({ staple: true, deduct: 0, short: 0 });
  });

  it('logs calories for the cooked servings', () => {
    expect(planCook(onionRecipe, 3, [], staples).calories).toBe(600);
  });
});

describe('inventory merging', () => {
  it('sums same-unit items and normalises names', () => {
    const a = addToInventory([], [{ name: 'Onions', qty: 3, unit: 'pcs' }], 1);
    const b = addToInventory(a, [{ name: 'onion', qty: 2, unit: 'pcs' }], 2);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ name: 'onion', qty: 5, unit: 'pcs' });
  });
  it('keeps countable items as a count when weight is added', () => {
    const a = addToInventory([], [{ name: 'onion', qty: 2, unit: 'pcs' }], 1);
    const b = addToInventory(a, [{ name: 'onion', qty: 1000, unit: 'g' }], 2); // ~7 onions
    expect(b).toEqual([expect.objectContaining({ name: 'onion', qty: 9, unit: 'pcs' })]);
    const c = addToInventory([], [{ name: 'tomato', qty: 500, unit: 'g' }], 1);
    expect(c).toEqual([expect.objectContaining({ name: 'tomato', qty: 4, unit: 'pcs' })]);
  });
  it('turns older weight-based entries of countable items into a count, threshold included', () => {
    const legacy: InventoryItem = { id: 'x', name: 'onion', qty: 1000, unit: 'g', lowAt: 300, updatedAt: 0 };
    expect(normalizeItem(legacy)).toMatchObject({ qty: 7, unit: 'pcs', lowAt: 2 });
    const paneer: InventoryItem = { id: 'y', name: 'paneer', qty: 200, unit: 'g', updatedAt: 0 };
    expect(normalizeItem(paneer)).toBe(paneer);
  });
  it('clamps manual deductions at zero', () => {
    const a = inv([['egg', 2, 'pcs']]);
    expect(deductFromInventory(a, 'egg', { qty: 5, unit: 'pcs' })[0].qty).toBe(0);
  });
});

describe('stock level', () => {
  const item = (qty: number, unit: InventoryItem['unit'], name: string, lowAt?: number): InventoryItem => ({ id: 'x', name, qty, unit, lowAt, updatedAt: 0 });
  it('is measured against 2x the threshold, or a usual pack', () => {
    expect(stockLevel(item(2, 'pcs', 'egg', 4))).toBe(0.25);
    expect(stockLevel(item(8, 'pcs', 'egg', 4))).toBe(1);
    expect(stockLevel(item(500, 'ml', 'milk'))).toBe(0.5); // pack = 1 l
    expect(stockLevel(item(0, 'g', 'rice'))).toBe(0);
    expect(stockLevel(item(3, 'pcs', 'mystery'))).toBe(1);
  });
});
