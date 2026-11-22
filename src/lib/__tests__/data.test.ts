import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../data/recipes';
import { isKnown, normalizeName } from '../names';
import { sampleState } from '../../data/sample';

describe('recipe dataset', () => {
  it('has ~40 recipes with unique ids, covering all meal types and both cuisines', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const t of ['breakfast', 'lunch', 'dinner', 'snack'] as const) expect(RECIPES.some((r) => r.mealTypes.includes(t))).toBe(true);
    expect(RECIPES.some((r) => r.cuisine === 'Indian')).toBe(true);
    expect(RECIPES.some((r) => r.cuisine === 'Global')).toBe(true);
  });

  it('every ingredient uses a canonical, catalogued name and a valid unit', () => {
    for (const r of RECIPES) {
      expect(r.baseServings).toBeGreaterThan(0);
      expect(r.caloriesPerServing).toBeGreaterThan(0);
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.tags.includes('veg') !== r.tags.includes('non-veg')).toBe(true);
      expect(r.tags.includes('quick')).toBe(r.cookTimeMin <= 20);
      for (const ing of r.ingredients) {
        expect(normalizeName(ing.name), `${r.id}: ${ing.name}`).toBe(ing.name);
        expect(isKnown(ing.name), `${r.id}: ${ing.name}`).toBe(true);
        expect(['pcs', 'g', 'ml']).toContain(ing.unit);
        expect(ing.qty).toBeGreaterThan(0);
      }
    }
  });

  it('sample data only uses canonical names', () => {
    for (const i of sampleState().inventory) expect(normalizeName(i.name)).toBe(i.name);
  });
});
