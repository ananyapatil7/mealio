import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState } from '../lib/types';
import { loadState, saveState } from '../lib/storage';
import { reducer, type Action } from './reducer';
import { buildShoppingList, type ShoppingRow } from '../lib/shopping';
import { RECIPES_BY_ID } from '../data/recipes';

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  shopping: ShoppingRow[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState());

  // Persist every change; localStorage is the only database.
  useEffect(() => saveState(state), [state]);

  const shopping = useMemo(
    () =>
      buildShoppingList({
        inventory: state.inventory,
        staples: state.staples,
        planned: state.planned,
        manual: state.shoppingManual,
        dismissed: state.shoppingDismissed,
        recipes: RECIPES_BY_ID,
      }),
    [state.inventory, state.staples, state.planned, state.shoppingManual, state.shoppingDismissed],
  );

  const value = useMemo(() => ({ state, dispatch, shopping }), [state, shopping]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
