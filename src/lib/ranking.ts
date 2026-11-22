import type { InventoryItem, MealType, Quantity, Recipe, Staple } from './types';
import { available, isStaple } from './inventory';
import { scaleQty } from './units';
import { nameMatches, tokenize } from './names';
import { caloriesFor } from './calories';

export interface IngredientCheck {
  name: string;
  /** Scaled quantity needed for the chosen servings. */
  need: Quantity;
  /** Amount at home, in the need's unit (staples: 1 = have, 0 = don't). */
  have: number;
  staple: boolean;
  /** True only when the inventory covers the full scaled quantity. */
  ok: boolean;
  /** How much more is needed (0 when ok). */
  shortBy: number;
}

export interface RecipeMatch {
  recipe: Recipe;
  servings: number;
  checks: IngredientCheck[];
  missing: IngredientCheck[];
  missingCount: number;
  caloriesPerServing: number;
  totalCalories: number;
}

export function checkIngredients(recipe: Recipe, servings: number, inventory: InventoryItem[], staples: Staple[]): IngredientCheck[] {
  return recipe.ingredients.map((ing) => {
    const need: Quantity = { qty: scaleQty(ing.qty, recipe.baseServings, servings, ing.unit), unit: ing.unit };
    const staple = isStaple(staples, ing.name);
    if (staple) {
      return { name: ing.name, need, have: staple.have ? 1 : 0, staple: true, ok: staple.have, shortBy: staple.have ? 0 : need.qty };
    }
    const have = available(inventory, ing.name, ing.unit);
    const ok = have + 1e-9 >= need.qty;
    return { name: ing.name, need, have, staple: false, ok, shortBy: ok ? 0 : need.qty - have };
  });
}

export function matchRecipe(recipe: Recipe, inventory: InventoryItem[], staples: Staple[], servings: number): RecipeMatch {
  const checks = checkIngredients(recipe, servings, inventory, staples);
  const missing = checks.filter((c) => !c.ok);
  return {
    recipe,
    servings,
    checks,
    missing,
    missingCount: missing.length,
    caloriesPerServing: recipe.caloriesPerServing,
    totalCalories: caloriesFor(recipe, servings),
  };
}

export interface RecipeFilters {
  mealType?: MealType;
  vegOnly?: boolean;
  maxMinutes?: number;
  maxCalories?: number;
  servings: number;
  query?: string;
}

export interface ParsedQuery {
  include: string[];
  exclude: string[];
}

const NEGATIONS = /^(no|not|without|except|avoid|skip|minus|nothing with|hold the)\s+/i;

/** "no paneer, spicy, without onion or garlic" -> include [spicy], exclude [paneer, onion, garlic] */
export function parseQuery(query: string): ParsedQuery {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const part of query.toLowerCase().split(/[,;]/)) {
    const p = part.trim();
    if (!p) continue;
    const neg = p.match(NEGATIONS);
    if (neg) {
      exclude.push(...p.slice(neg[0].length).split(/\s+(?:or|and|nor)\s+|\s*\/\s*|\s*&\s*/).map((t) => t.trim()).filter(Boolean));
    } else {
      include.push(p);
    }
  }
  return { include, exclude };
}

const MEAT_WORDS = new Set(['meat', 'non veg', 'nonveg', 'non-veg']);

function recipeMentions(recipe: Recipe, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (MEAT_WORDS.has(t)) return recipe.tags.includes('non-veg');
  if (t === 'veg' || t === 'vegetarian') return recipe.tags.includes('veg');
  if (t === 'quick') return recipe.tags.includes('quick');
  if (t === recipe.cuisine.toLowerCase()) return true;
  const nameTokens = tokenize(recipe.name);
  const termTokens = tokenize(t);
  if (termTokens.length && termTokens.every((tok) => nameTokens.includes(tok))) return true;
  return recipe.ingredients.some((ing) => nameMatches(t, ing.name));
}

export function passesFilters(recipe: Recipe, f: RecipeFilters): boolean {
  if (f.mealType && !recipe.mealTypes.includes(f.mealType)) return false;
  if (f.vegOnly && !recipe.tags.includes('veg')) return false;
  if (f.maxMinutes !== undefined && recipe.cookTimeMin > f.maxMinutes) return false;
  if (f.maxCalories !== undefined && recipe.caloriesPerServing > f.maxCalories) return false;
  if (f.query) {
    const q = parseQuery(f.query);
    if (q.exclude.some((t) => recipeMentions(recipe, t))) return false;
    if (!q.include.every((t) => recipeMentions(recipe, t))) return false;
  }
  return true;
}

/** Sort by number of missing ingredients (ascending), then cook time, then name. */
export function compareMatches(a: RecipeMatch, b: RecipeMatch): number {
  return a.missingCount - b.missingCount || a.recipe.cookTimeMin - b.recipe.cookTimeMin || a.recipe.name.localeCompare(b.recipe.name);
}

export function rankRecipes(recipes: Recipe[], inventory: InventoryItem[], staples: Staple[], filters: RecipeFilters): RecipeMatch[] {
  return recipes
    .filter((r) => passesFilters(r, filters))
    .map((r) => matchRecipe(r, inventory, staples, filters.servings))
    .sort(compareMatches);
}

export function readiness(missingCount: number): { label: string; tone: 'ready' | 'close' | 'far' } {
  if (missingCount === 0) return { label: 'Cook now', tone: 'ready' };
  if (missingCount <= 2) return { label: `${missingCount} item${missingCount > 1 ? 's' : ''} away`, tone: 'close' };
  return { label: `${missingCount} missing`, tone: 'far' };
}
