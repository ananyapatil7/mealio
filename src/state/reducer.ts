import type { AppState, InventoryItem, ManualShoppingItem, Unit } from '../lib/types';
import { addToInventory, normalizeItem, uid, type IncomingItem } from '../lib/inventory';
import { applyDeductions, makeLog, type DeductionLine } from '../lib/cooking';
import { normalizeName } from '../lib/names';
import { RECIPES_BY_ID } from '../data/recipes';
import { sampleState } from '../data/sample';
import { emptyState } from '../lib/storage';
import type { ShoppingRow } from '../lib/shopping';

export type Action =
  | { type: 'addItems'; items: (IncomingItem & { staple?: boolean })[] }
  | { type: 'updateItem'; id: string; patch: Partial<Pick<InventoryItem, 'name' | 'qty' | 'unit' | 'lowAt'>> }
  | { type: 'deleteItem'; id: string }
  | { type: 'restoreItem'; item: InventoryItem }
  | { type: 'toggleStaple'; name: string }
  | { type: 'addStaple'; name: string }
  | { type: 'removeStaple'; name: string }
  | { type: 'cook'; recipeId: string; servings: number; lines: DeductionLine[]; at?: number }
  | { type: 'deleteLog'; id: string }
  | { type: 'togglePlan'; recipeId: string; servings: number }
  | { type: 'removePlanned'; id: string }
  | { type: 'setPlannedServings'; id: string; servings: number }
  | { type: 'addShopping'; items: { name: string; qty?: number; unit?: Unit }[] }
  | { type: 'toggleChecked'; key: string }
  | { type: 'removeRow'; row: ShoppingRow }
  | { type: 'restoreDismissed' }
  | { type: 'buyChecked'; rows: ShoppingRow[] }
  | { type: 'setServings'; servings: number }
  | { type: 'loadSample' }
  | { type: 'reset' }
  | { type: 'replace'; state: AppState };

export function reducer(state: AppState, action: Action): AppState {
  const now = Date.now();
  switch (action.type) {
    case 'addItems': {
      const stapleNames = new Set(action.items.filter((i) => i.staple).map((i) => normalizeName(i.name)));
      const staples = state.staples.map((s) => (stapleNames.has(s.name) ? { ...s, have: true } : s));
      for (const n of stapleNames) if (!staples.some((s) => s.name === n)) staples.push({ name: n, have: true });
      return {
        ...state,
        staples,
        inventory: addToInventory(state.inventory, action.items.filter((i) => !i.staple), now),
      };
    }
    case 'updateItem':
      return {
        ...state,
        inventory: state.inventory.map((i) => {
          if (i.id !== action.id) return i;
          const next = { ...i, ...action.patch, updatedAt: now };
          if (action.patch.name !== undefined) next.name = normalizeName(action.patch.name) || i.name;
          next.qty = Math.max(0, Number(next.qty) || 0);
          if (next.lowAt !== undefined && !(next.lowAt > 0)) delete next.lowAt;
          return normalizeItem(next);
        }),
      };
    case 'deleteItem':
      return { ...state, inventory: state.inventory.filter((i) => i.id !== action.id) };
    case 'restoreItem':
      return { ...state, inventory: [...state.inventory, action.item] };
    case 'toggleStaple':
      return { ...state, staples: state.staples.map((s) => (s.name === action.name ? { ...s, have: !s.have } : s)) };
    case 'addStaple': {
      const name = normalizeName(action.name);
      if (!name || state.staples.some((s) => s.name === name)) return state;
      return { ...state, staples: [...state.staples, { name, have: true }] };
    }
    case 'removeStaple':
      return { ...state, staples: state.staples.filter((s) => s.name !== action.name) };
    case 'cook': {
      const recipe = RECIPES_BY_ID.get(action.recipeId);
      if (!recipe) return state;
      const plannedIdx = state.planned.findIndex((p) => p.recipeId === action.recipeId);
      return {
        ...state,
        inventory: applyDeductions(state.inventory, action.lines, now),
        mealLogs: [...state.mealLogs, makeLog(recipe, action.servings, new Date(action.at ?? now))],
        planned: plannedIdx >= 0 ? state.planned.filter((_, i) => i !== plannedIdx) : state.planned,
      };
    }
    case 'deleteLog':
      return { ...state, mealLogs: state.mealLogs.filter((l) => l.id !== action.id) };
    case 'togglePlan': {
      const existing = state.planned.find((p) => p.recipeId === action.recipeId);
      if (existing) return { ...state, planned: state.planned.filter((p) => p.id !== existing.id) };
      return { ...state, planned: [...state.planned, { id: uid(), recipeId: action.recipeId, servings: action.servings }] };
    }
    case 'removePlanned':
      return { ...state, planned: state.planned.filter((p) => p.id !== action.id) };
    case 'setPlannedServings':
      return { ...state, planned: state.planned.map((p) => (p.id === action.id ? { ...p, servings: Math.max(1, action.servings) } : p)) };
    case 'addShopping': {
      const items: ManualShoppingItem[] = action.items
        .map((i) => ({ id: uid(), name: normalizeName(i.name), qty: i.qty, unit: i.unit }))
        .filter((i) => i.name);
      return { ...state, shoppingManual: [...state.shoppingManual, ...items] };
    }
    case 'toggleChecked': {
      const checked = { ...state.shoppingChecked };
      if (checked[action.key]) delete checked[action.key];
      else checked[action.key] = true;
      return { ...state, shoppingChecked: checked };
    }
    case 'removeRow': {
      const { row } = action;
      const checked = { ...state.shoppingChecked };
      delete checked[row.key];
      return {
        ...state,
        shoppingChecked: checked,
        shoppingManual: state.shoppingManual.filter((m) => !row.manualIds.includes(m.id)),
        shoppingDismissed: row.auto ? { ...state.shoppingDismissed, [row.key]: true } : state.shoppingDismissed,
      };
    }
    case 'restoreDismissed':
      return { ...state, shoppingDismissed: {} };
    case 'buyChecked': {
      const rows = action.rows.filter((r) => state.shoppingChecked[r.key]);
      const stapleNames = new Set(rows.filter((r) => r.staple).map((r) => r.name));
      const incoming: IncomingItem[] = rows
        .filter((r) => !r.staple && r.qty && r.unit)
        .map((r) => ({ name: r.name, qty: r.qty as number, unit: r.unit as Unit }));
      const manualIds = new Set(rows.flatMap((r) => r.manualIds));
      const checked = { ...state.shoppingChecked };
      for (const r of rows) delete checked[r.key];
      return {
        ...state,
        inventory: addToInventory(state.inventory, incoming, now),
        staples: state.staples.map((s) => (stapleNames.has(s.name) ? { ...s, have: true } : s)),
        shoppingManual: state.shoppingManual.filter((m) => !manualIds.has(m.id)),
        shoppingChecked: checked,
      };
    }
    case 'setServings':
      return { ...state, settings: { ...state.settings, servings: Math.min(12, Math.max(1, Math.round(action.servings))) } };
    case 'loadSample':
      return sampleState(new Date(now));
    case 'reset':
      return emptyState();
    case 'replace':
      return action.state;
  }
}
