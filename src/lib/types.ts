// Core data model for Mealio. Everything is persisted in localStorage (see storage.ts).

/** Canonical units. Countable things use 'pcs'; everything else is grams or millilitres. */
export type Unit = 'pcs' | 'g' | 'ml';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export type RecipeTag = 'veg' | 'non-veg' | 'quick';

export interface Quantity {
  qty: number;
  unit: Unit;
}

export interface InventoryItem {
  id: string;
  /** Canonical ingredient key, e.g. "onion" (see names.ts). */
  name: string;
  qty: number;
  unit: Unit;
  /** Optional low-stock threshold in the item's own unit. Below this it goes on the shopping list. */
  lowAt?: number;
  updatedAt: number;
}

/** Staples (salt, oil, spices) are tracked as have / don't have only. */
export interface Staple {
  name: string;
  have: boolean;
}

export interface RecipeIngredient {
  name: string;
  qty: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  name: string;
  cuisine: 'Indian' | 'Global';
  mealTypes: MealType[];
  baseServings: number;
  cookTimeMin: number;
  tags: RecipeTag[];
  caloriesPerServing: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface MealLog {
  id: string;
  recipeId: string;
  recipeName: string;
  servings: number;
  /** Total calories for the logged servings (caloriesPerServing x servings). */
  calories: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  cookedAt: number;
}

export interface PlannedMeal {
  id: string;
  recipeId: string;
  servings: number;
}

export interface ManualShoppingItem {
  id: string;
  name: string;
  qty?: number;
  unit?: Unit;
}

export interface AppState {
  version: 1;
  inventory: InventoryItem[];
  staples: Staple[];
  mealLogs: MealLog[];
  planned: PlannedMeal[];
  shoppingManual: ManualShoppingItem[];
  /** Tick state for shopping rows, keyed by row key. */
  shoppingChecked: Record<string, boolean>;
  /** Generated rows the user removed, keyed by row key. */
  shoppingDismissed: Record<string, boolean>;
  settings: {
    servings: number;
  };
}
