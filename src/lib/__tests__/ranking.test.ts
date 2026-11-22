import { describe, expect, it } from 'vitest';
import { matchRecipe, missingLabel, parseQuery, rankRecipes, readiness } from '../ranking';
import type { InventoryItem, Recipe, Staple } from '../types';
import { RECIPES } from '../../data/recipes';

const inv = (items: [string, number, InventoryItem['unit']][]): InventoryItem[] =>
  items.map(([name, qty, unit], i) => ({ id: String(i), name, qty, unit, updatedAt: 0 }));

const recipe = (id: string, cookTimeMin: number, ingredients: [string, number, 'pcs' | 'g' | 'ml'][], extra: Partial<Recipe> = {}): Recipe => ({
  id, name: id, cuisine: 'Global', mealTypes: ['dinner'], baseServings: 2, cookTimeMin, tags: ['veg'], caloriesPerServing: 100,
  ingredients: ingredients.map(([name, qty, unit]) => ({ name, qty, unit })), steps: [], ...extra,
});

const staples: Staple[] = [{ name: 'salt', have: true }, { name: 'oil', have: false }];

describe('recipe ranking', () => {
  const recipes = [
    recipe('two-missing', 5, [['egg', 2, 'pcs'], ['paneer', 100, 'g'], ['spinach', 100, 'g']]),
    recipe('ready-slow', 40, [['egg', 2, 'pcs'], ['salt', 1, 'g']]),
    recipe('ready-fast', 10, [['onion', 2, 'pcs']]),
    recipe('one-missing', 15, [['onion', 1, 'pcs'], ['oil', 5, 'ml']]),
  ];
  const inventory = inv([['egg', 6, 'pcs'], ['onion', 3, 'pcs']]);

  it('done-criterion 2: sorts by fewest missing items, then cook time, and lists every missing item', () => {
    const ranked = rankRecipes(recipes, inventory, staples, { servings: 2 });
    expect(ranked.map((m) => m.recipe.id)).toEqual(['ready-fast', 'ready-slow', 'one-missing', 'two-missing']);
    expect(ranked.map((m) => m.missingCount)).toEqual([0, 0, 1, 2]);
    expect(ranked[2].missing.map((c) => c.name)).toEqual(['oil']);
    expect(ranked[3].missing.map((c) => c.name)).toEqual(['paneer', 'spinach']);
    for (const m of ranked) expect(m.missing.length).toBe(m.missingCount);
  });

  it('never shows an ingredient as available unless the scaled quantity is covered', () => {
    const r = recipe('r', 10, [['onion', 2, 'pcs']]);
    expect(matchRecipe(r, inventory, staples, 2).missingCount).toBe(0); // need 2, have 3
    const m = matchRecipe(r, inventory, staples, 4); // need 4, have 3
    expect(m.missingCount).toBe(1);
    expect(m.missing[0]).toMatchObject({ name: 'onion', have: 3, shortBy: 1 });
  });

  it('compares across units using piece weights', () => {
    const r = recipe('r', 10, [['onion', 4, 'pcs']]); // 4 x 150 g = 600 g
    expect(matchRecipe(r, inv([['onion', 1000, 'g']]), staples, 2).missingCount).toBe(0);
    expect(matchRecipe(r, inv([['onion', 500, 'g']]), staples, 2).missingCount).toBe(1);
  });

  it('applies filters', () => {
    const all = rankRecipes(RECIPES, [], [], { servings: 1, mealType: 'breakfast', vegOnly: true, maxMinutes: 20, maxCalories: 350 });
    expect(all.length).toBeGreaterThan(0);
    for (const m of all) {
      expect(m.recipe.mealTypes).toContain('breakfast');
      expect(m.recipe.tags).toContain('veg');
      expect(m.recipe.cookTimeMin).toBeLessThanOrEqual(20);
      expect(m.recipe.caloriesPerServing).toBeLessThanOrEqual(350);
    }
  });

  it('supports free-text "no paneer" and includes', () => {
    const noPaneer = rankRecipes(RECIPES, [], [], { servings: 1, query: 'no paneer' });
    expect(noPaneer.some((m) => m.recipe.ingredients.some((i) => i.name === 'paneer'))).toBe(false);
    expect(noPaneer.length).toBeGreaterThan(30);
    const eggOnly = rankRecipes(RECIPES, [], [], { servings: 1, query: 'egg' });
    expect(eggOnly.every((m) => m.recipe.ingredients.some((i) => i.name === 'egg'))).toBe(true);
    const noOnionGarlic = rankRecipes(RECIPES, [], [], { servings: 1, query: 'without onion or garlic' });
    expect(noOnionGarlic.every((m) => !m.recipe.ingredients.some((i) => i.name === 'onion' || i.name === 'garlic'))).toBe(true);
    expect(parseQuery('no paneer, pasta')).toEqual({ include: ['pasta'], exclude: ['paneer'] });
  });

  it('labels readiness', () => {
    expect(readiness(0).label).toBe('Cook now');
    expect(readiness(1).label).toBe('1 item away');
    expect(readiness(2).label).toBe('2 items away');
    expect(readiness(4).tone).toBe('far');
  });

  it('formats missing-item labels cleanly (no stray symbols)', () => {
    const r = recipe('r', 10, [['curd', 150, 'g'], ['paneer', 200, 'g'], ['oil', 5, 'ml']]);
    const m = matchRecipe(r, inv([['curd', 150, 'g']]), staples, 4); // need 300 g curd, have 150
    expect(m.missing.map(missingLabel)).toEqual(['Curd / yogurt: 150 g more', 'Paneer 400 g', 'Cooking oil']);
    for (const label of m.missing.map(missingLabel)) expect(label).toMatch(/^[\w /:.½¼¾⅓⅔-]+$/);
  });

  it('search works while typing: partial words match (live search)', () => {
    const names = (query: string, mealType?: 'lunch') => rankRecipes(RECIPES, [], [], { servings: 1, query, mealType }).map((m) => m.recipe.name);
    for (const partial of ['pas', 'past', 'pasta']) expect(names(partial)).toContain('Quick Tomato Pasta');
    expect(names('pane')).toEqual(expect.arrayContaining(['Palak Paneer', 'Paneer Bhurji']));
    expect(names('chick')).toEqual(expect.arrayContaining(['Chickpea Salad', 'Simple Chicken Curry']));
    expect(names('omelet')).toEqual(['Masala Omelette']);
    expect(names('p').length).toBeGreaterThan(10); // one letter narrows, never empties the list
  });

  it('every word must match, so multi-word searches narrow down', () => {
    const names = (query: string) => rankRecipes(RECIPES, [], [], { servings: 1, query }).map((m) => m.recipe.name);
    expect(names('tomato pasta')).toEqual(['Quick Tomato Pasta']);
    expect(names('egg rice')).toEqual(['Egg Fried Rice']);
    expect(names('Masala Chai')).toEqual(['Masala Chai']);
  });

  it('finds recipes by ingredient aliases and labels, any case', () => {
    const names = (query: string) => rankRecipes(RECIPES, [], [], { servings: 1, query }).map((m) => m.recipe.name);
    expect(names('ALOO')).toEqual(expect.arrayContaining(['Jeera Aloo', 'Aloo Gobi', 'Aloo Paratha']));
    expect(names('yogurt')).toContain('Curd Rice'); // curd's label is "Curd / yogurt"
    expect(names('breakfast').length).toBeGreaterThan(5);
  });

  it('"All" (no meal type) searches every recipe', () => {
    expect(rankRecipes(RECIPES, [], [], { servings: 1 })).toHaveLength(RECIPES.length);
    expect(rankRecipes(RECIPES, [], [], { servings: 1, query: 'chai', mealType: 'lunch' })).toHaveLength(0);
    expect(rankRecipes(RECIPES, [], [], { servings: 1, query: 'chai' })).toHaveLength(1);
  });

  it('exclusions ignore half-typed words and match prefixes once 3+ letters', () => {
    const count = (query: string) => rankRecipes(RECIPES, [], [], { servings: 1, query }).length;
    expect(count('no p')).toBe(RECIPES.length);
    const noPan = rankRecipes(RECIPES, [], [], { servings: 1, query: 'no pan' }).map((m) => m.recipe.name);
    expect(noPan).not.toContain('Palak Paneer');
  });
});
