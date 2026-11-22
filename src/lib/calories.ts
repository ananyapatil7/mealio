import type { MealLog, Recipe } from './types';

/** Total calories for the given servings: caloriesPerServing x servings. */
export function caloriesFor(recipe: Pick<Recipe, 'caloriesPerServing'>, servings: number): number {
  return Math.round(recipe.caloriesPerServing * servings);
}

/** Local calendar date as YYYY-MM-DD (not UTC, so late dinners land on the right day). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function totalForDate(logs: MealLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((sum, l) => sum + l.calories, 0);
}

export interface DayTotal {
  date: string;
  total: number;
  meals: MealLog[];
}

/** Totals for the `days` days ending on `end` (inclusive), oldest first. */
export function lastNDays(logs: MealLog[], end: Date = new Date(), days = 7): DayTotal[] {
  const out: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const key = dateKey(d);
    const meals = logs.filter((l) => l.date === key).sort((a, b) => a.cookedAt - b.cookedAt);
    out.push({ date: key, total: meals.reduce((s, l) => s + l.calories, 0), meals });
  }
  return out;
}

export function average(days: DayTotal[]): number {
  const logged = days.filter((d) => d.meals.length > 0);
  if (!logged.length) return 0;
  return Math.round(logged.reduce((s, d) => s + d.total, 0) / logged.length);
}
