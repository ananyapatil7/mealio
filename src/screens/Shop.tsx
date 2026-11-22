import { useState } from 'react';
import { Check, PackagePlus, Plus, X } from 'lucide-react';
import { Button, EmptyState, ScreenHeader, SectionTitle, Stepper, cx, useToast } from '../components/ui';
import { useStore } from '../state/store';
import { parseGroceryText } from '../lib/parser';
import { displayName } from '../lib/names';
import type { ShoppingRow } from '../lib/shopping';
import { RECIPES_BY_ID } from '../data/recipes';
import { formatStock } from './Kitchen';
import { useNav } from '../App';

export default function Shop() {
  const { state, dispatch, shopping } = useStore();
  const toast = useToast();
  const go = useNav();
  const [text, setText] = useState('');

  const toBuy = shopping.filter((r) => !state.shoppingChecked[r.key]);
  const inCart = shopping.filter((r) => state.shoppingChecked[r.key]);
  const hidden = Object.keys(state.shoppingDismissed).length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const items = parseGroceryText(text, state.staples.map((s) => s.name));
    if (!items.length) return;
    dispatch({ type: 'addShopping', items: items.map((i) => ({ name: i.name, qty: i.staple ? undefined : i.qty, unit: i.staple ? undefined : i.unit })) });
    setText('');
  };

  const buy = () => {
    const prev = state;
    const n = inCart.length;
    dispatch({ type: 'buyChecked', rows: shopping });
    toast({ text: `Added ${n} item${n === 1 ? '' : 's'} to your kitchen`, action: { label: 'Undo', run: () => dispatch({ type: 'replace', state: prev }) } });
  };

  return (
    <div>
      <ScreenHeader title="Shopping list" subtitle={shopping.length ? `${toBuy.length} to buy${inCart.length ? ` · ${inCart.length} in cart` : ''}` : 'Only what you actually need'} />
      <div className="px-4">
        <form onSubmit={add} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add: 2 l milk, bread…"
            aria-label="Add to shopping list"
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 outline-none focus:border-brand"
          />
          <Button type="submit" disabled={!text.trim()} aria-label="Add">
            <Plus size={20} />
          </Button>
        </form>

        {shopping.length === 0 ? (
          <div className="mt-4">
            <EmptyState emoji="🛒" title="Nothing to buy right now" body="Plan a meal and anything missing lands here. Items that run low show up too.">
              <Button onClick={() => go('cook')}>Find a meal to plan</Button>
            </EmptyState>
          </div>
        ) : (
          <>
            {toBuy.length > 0 && (
              <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {toBuy.map((r) => (
                  <Row key={r.key} row={r} />
                ))}
              </ul>
            )}
            {toBuy.length === 0 && <p className="mt-6 rounded-2xl bg-good-soft p-4 text-center font-semibold text-good">All ticked off. Nice!</p>}
            {inCart.length > 0 && (
              <>
                <SectionTitle>In your cart</SectionTitle>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                  {inCart.map((r) => (
                    <Row key={r.key} row={r} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {hidden > 0 && (
          <button className="mt-3 min-h-10 text-sm font-semibold text-ink-2 underline" onClick={() => dispatch({ type: 'restoreDismissed' })}>
            Show {hidden} removed suggestion{hidden === 1 ? '' : 's'}
          </button>
        )}

        <Planned />
      </div>

      {inCart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-lg px-4 pb-3">
          <Button size="lg" className="w-full shadow-lg" onClick={buy}>
            <PackagePlus size={20} /> Add {inCart.length} ticked to kitchen
          </Button>
        </div>
      )}
      {inCart.length > 0 && <div className="h-20" />}
    </div>
  );
}

function Row({ row }: { row: ShoppingRow }) {
  const { state, dispatch } = useStore();
  const checked = !!state.shoppingChecked[row.key];
  const enoughAtHome = row.haveAtHome !== undefined && row.qty !== undefined && row.haveAtHome >= row.qty;
  return (
    <li className="flex items-center">
      <button
        role="checkbox"
        aria-checked={checked}
        onClick={() => dispatch({ type: 'toggleChecked', key: row.key })}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
      >
        <span
          className={cx(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2',
            checked ? 'border-good bg-good text-surface' : 'border-ink-3',
          )}
        >
          {checked && <Check size={16} strokeWidth={3.5} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx('block font-semibold', checked && 'text-ink-3 line-through')}>
            {displayName(row.name)}
            {row.qty !== undefined && row.unit && <span className="ml-2 font-normal text-ink-2 tabular-nums">{formatStock(row.qty, row.unit)}</span>}
          </span>
          <span className="block truncate text-xs text-ink-3">{row.reasons.join(' · ')}</span>
          {enoughAtHome && <span className="block text-xs text-warn">You already have {formatStock(row.haveAtHome!, row.unit!)} at home</span>}
        </span>
      </button>
      <button
        aria-label={`Remove ${displayName(row.name)}`}
        onClick={() => dispatch({ type: 'removeRow', row })}
        className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 active:bg-surface-2"
      >
        <X size={18} />
      </button>
    </li>
  );
}

function Planned() {
  const { state, dispatch } = useStore();
  const go = useNav();
  return (
    <section className="pb-6">
      <SectionTitle>Planned this week</SectionTitle>
      {state.planned.length === 0 ? (
        <p className="px-1 text-sm text-ink-2">
          No meals planned.{' '}
          <button className="font-semibold text-brand underline" onClick={() => go('cook')}>
            Pick some in Cook
          </button>{' '}
          and their missing ingredients are added here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {state.planned.map((p) => {
            const recipe = RECIPES_BY_ID.get(p.recipeId);
            if (!recipe) return null;
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-line bg-surface py-1 pr-1 pl-4">
                <span className="min-w-0 flex-1 truncate font-medium">{recipe.name}</span>
                <Stepper size="sm" label="servings" value={p.servings} onChange={(v) => dispatch({ type: 'setPlannedServings', id: p.id, servings: v })} />
                <button
                  aria-label={`Unplan ${recipe.name}`}
                  onClick={() => dispatch({ type: 'removePlanned', id: p.id })}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink-3 active:bg-surface-2"
                >
                  <X size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
