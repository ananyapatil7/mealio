import type { InventoryItem, MealLog, Quantity, Recipe, Staple } from './types';
import { checkIngredients } from './ranking';
import { deductFromInventory, uid } from './inventory';
import { caloriesFor, dateKey } from './calories';
import { round } from './units';

export interface DeductionLine {
  name: string;
  need: Quantity;
  /** At home, in need.unit. */
  available: number;
  /** What will actually be taken off, in need.unit. Editable by the user; clamped to [0, available]. */
  deduct: number;
  /** need - available when positive. */
  short: number;
  staple: boolean;
}

export interface CookPlan {
  recipe: Recipe;
  servings: number;
  lines: DeductionLine[];
  shortages: DeductionLine[];
  calories: number;
}

/** Work out what cooking `servings` of a recipe will take from the inventory. */
export function planCook(recipe: Recipe, servings: number, inventory: InventoryItem[], staples: Staple[]): CookPlan {
  const lines = checkIngredients(recipe, servings, inventory, staples).map<DeductionLine>((c) => {
    if (c.staple) {
      // Staples are have / don't have: nothing to deduct.
      return { name: c.name, need: c.need, available: c.have, deduct: 0, short: c.ok ? 0 : c.need.qty, staple: true };
    }
    const deduct = round(Math.min(c.need.qty, c.have), c.need.unit);
    return { name: c.name, need: c.need, available: c.have, deduct, short: round(Math.max(0, c.need.qty - c.have), c.need.unit), staple: false };
  });
  return { recipe, servings, lines, shortages: lines.filter((l) => l.short > 0), calories: caloriesFor(recipe, servings) };
}

/** Apply deductions. Each line is clamped to what's available, so stock never goes below zero. */
export function applyDeductions(inventory: InventoryItem[], lines: DeductionLine[], now = Date.now()): InventoryItem[] {
  let next = inventory;
  for (const line of lines) {
    if (line.staple) continue;
    const amount = Math.max(0, Math.min(line.deduct, line.available));
    if (amount <= 0) continue;
    next = deductFromInventory(next, line.name, { qty: amount, unit: line.need.unit }, now);
  }
  return next;
}

export function makeLog(recipe: Recipe, servings: number, at: Date = new Date()): MealLog {
  return {
    id: uid(),
    recipeId: recipe.id,
    recipeName: recipe.name,
    servings,
    calories: caloriesFor(recipe, servings),
    date: dateKey(at),
    cookedAt: at.getTime(),
  };
}
