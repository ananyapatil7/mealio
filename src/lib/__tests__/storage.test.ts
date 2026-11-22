import { describe, expect, it } from 'vitest';
import { loadState, saveState, STORAGE_KEY, type KeyValueStore } from '../storage';
import { reducer } from '../../state/reducer';
import { parseGroceryText } from '../parser';
import { RECIPES_BY_ID } from '../../data/recipes';
import { planCook } from '../cooking';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('persistence', () => {
  it('done-criterion 6: all data survives a reload', () => {
    const store = memoryStore();
    let state = loadState(store);
    state = reducer(state, { type: 'addItems', items: parseGroceryText('bought 6 eggs, 1kg onions, half kg tomatoes') });
    const omelette = RECIPES_BY_ID.get('masala-omelette')!;
    state = reducer(state, { type: 'cook', recipeId: omelette.id, servings: 1, lines: planCook(omelette, 1, state.inventory, state.staples).lines });
    state = reducer(state, { type: 'togglePlan', recipeId: 'dal-tadka', servings: 2 });
    state = reducer(state, { type: 'addShopping', items: [{ name: 'bread', qty: 20, unit: 'pcs' }] });
    state = reducer(state, { type: 'toggleStaple', name: 'salt' });
    saveState(state, store);

    const reloaded = loadState(store);
    expect(reloaded).toEqual(state);
    expect(reloaded.inventory.find((i) => i.name === 'egg')?.qty).toBe(4);
    expect(reloaded.mealLogs).toHaveLength(1);
    expect(reloaded.planned).toHaveLength(1);
    expect(reloaded.shoppingManual).toHaveLength(1);
  });

  it('falls back to an empty state on corrupt data', () => {
    const store = memoryStore();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadState(store).inventory).toEqual([]);
    expect(loadState(null).inventory).toEqual([]);
  });
});
