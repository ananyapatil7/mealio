import type { AppState } from './types';
import { DEFAULT_STAPLES } from '../data/ingredients';

export const STORAGE_KEY = 'mealio:v1';

/** Minimal Storage interface so tests can pass an in-memory implementation. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function emptyState(): AppState {
  return {
    version: 1,
    inventory: [],
    staples: DEFAULT_STAPLES.map((name) => ({ name, have: true })),
    mealLogs: [],
    planned: [],
    shoppingManual: [],
    shoppingChecked: {},
    shoppingDismissed: {},
    settings: { servings: 1 },
  };
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Load persisted state, filling any missing fields from defaults. Corrupt data falls back to empty. */
export function loadState(store: KeyValueStore | null = defaultStore()): AppState {
  const base = emptyState();
  if (!store) return base;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      ...parsed,
      version: 1,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      staples: Array.isArray(parsed.staples) ? parsed.staples : base.staples,
      mealLogs: Array.isArray(parsed.mealLogs) ? parsed.mealLogs : [],
      planned: Array.isArray(parsed.planned) ? parsed.planned : [],
      shoppingManual: Array.isArray(parsed.shoppingManual) ? parsed.shoppingManual : [],
      shoppingChecked: parsed.shoppingChecked ?? {},
      shoppingDismissed: parsed.shoppingDismissed ?? {},
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return base;
  }
}

export function saveState(state: AppState, store: KeyValueStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode): the app keeps working in memory.
  }
}

export function clearState(store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
