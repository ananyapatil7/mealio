import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Ellipsis, Minus, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { Button, EmptyState, IconButton, ScreenHeader, SectionTitle, Sheet, cx, useToast } from '../components/ui';
import { useStore } from '../state/store';
import { displayName } from '../lib/names';
import { formatQty, round } from '../lib/units';
import { isLow } from '../lib/inventory';
import type { InventoryItem, Unit } from '../lib/types';
import AddGroceries, { UnitPicker } from './AddGroceries';

export const formatStock = (qty: number, unit: Unit) => (unit === 'pcs' ? `${formatQty(qty, unit)} pcs` : formatQty(qty, unit));

export default function Kitchen() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [adding, setAdding] = useState<null | 'text' | 'single'>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.inventory]
      .filter((i) => !q || i.name.includes(q) || displayName(i.name).toLowerCase().includes(q))
      .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  }, [state.inventory, query]);
  const low = items.filter(isLow);
  const rest = items.filter((i) => !isLow(i));
  const lowCount = state.inventory.filter(isLow).length;
  const empty = state.inventory.length === 0;

  const loadSample = () => {
    const prev = state;
    dispatch({ type: 'loadSample' });
    setMenu(false);
    toast({ text: 'Sample kitchen loaded', action: { label: 'Undo', run: () => dispatch({ type: 'replace', state: prev }) } });
  };

  return (
    <div>
      <ScreenHeader
        title="Kitchen"
        subtitle={empty ? "What's at home" : `${state.inventory.length} items${lowCount ? ` · ${lowCount} running low` : ''}`}
        action={
          <IconButton label="More options" onClick={() => setMenu(true)}>
            <Ellipsis size={24} />
          </IconButton>
        }
      />
      <div className="px-4">
        {empty ? (
          <EmptyState emoji="🧺" title="Your kitchen is empty" body="Tell Mealio what you have and it will suggest meals you can cook right now.">
            <Button size="lg" onClick={() => setAdding('text')}>
              <Plus size={20} /> Add groceries
            </Button>
            <Button variant="secondary" onClick={loadSample}>
              <Sparkles size={18} /> Try with a sample kitchen
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="flex gap-2">
              <Button size="lg" className="flex-1" onClick={() => setAdding('text')}>
                <Plus size={20} /> Add groceries
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setAdding('single')} aria-label="Add one item">
                One item
              </Button>
            </div>

            {state.inventory.length > 8 && (
              <label className="mt-4 flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-4">
                <Search size={18} className="text-ink-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find an item"
                  aria-label="Find an item"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
              </label>
            )}

            {low.length > 0 && (
              <>
                <SectionTitle>Running low</SectionTitle>
                <ItemList items={low} onEdit={setEditing} />
              </>
            )}
            {rest.length > 0 && (
              <>
                <SectionTitle>{low.length ? 'Everything else' : 'In stock'}</SectionTitle>
                <ItemList items={rest} onEdit={setEditing} />
              </>
            )}
            {items.length === 0 && <p className="mt-6 text-center text-ink-2">No items match "{query}".</p>}
          </>
        )}

        <Staples />
      </div>

      <AddGroceries open={adding !== null} mode={adding ?? 'text'} onClose={() => setAdding(null)} />
      <ItemEditor item={editing} onClose={() => setEditing(null)} />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Options">
        <div className="flex flex-col gap-2 pb-2">
          <Button variant="secondary" className="justify-start" onClick={loadSample}>
            <Sparkles size={18} /> Load sample data
          </Button>
          <p className="px-1 text-sm text-ink-3">Replaces your data with a sample kitchen, a planned meal and a week of meals.</p>
          <Button
            variant="danger"
            className="mt-4 justify-start"
            onClick={() => {
              if (!window.confirm('Delete all Mealio data on this device? This cannot be undone.')) return;
              dispatch({ type: 'reset' });
              setMenu(false);
            }}
          >
            <Trash2 size={18} /> Clear all data
          </Button>
          <p className="mt-4 px-1 text-xs text-ink-3">Everything is stored only on this device. No account, no server.</p>
        </div>
      </Sheet>
    </div>
  );
}

function ItemList({ items, onEdit }: { items: InventoryItem[]; onEdit: (i: InventoryItem) => void }) {
  const { dispatch } = useStore();
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((item) => {
        const out = item.qty <= 0;
        const lowNow = isLow(item);
        return (
          <li key={item.id} className="flex items-center">
            <button className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 text-left active:bg-surface-2" onClick={() => onEdit(item)}>
              <span className="min-w-0 flex-1 truncate font-semibold">{displayName(item.name)}</span>
              {lowNow && (
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', out ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn')}>
                  {out ? 'Out' : 'Low'}
                </span>
              )}
              <span className={cx('tabular-nums', out ? 'text-ink-3' : 'text-ink-2')}>{formatStock(item.qty, item.unit)}</span>
            </button>
            {item.unit === 'pcs' && (
              <button
                aria-label={`Use one ${displayName(item.name)}`}
                disabled={out}
                className="mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:bg-surface-2 disabled:opacity-30"
                onClick={() => dispatch({ type: 'updateItem', id: item.id, patch: { qty: Math.max(0, round(item.qty - 1, 'pcs')) } })}
              >
                <Minus size={18} />
              </button>
            )}
            {item.unit !== 'pcs' && <ChevronRight size={18} className="mr-4 text-ink-3" />}
          </li>
        );
      })}
    </ul>
  );
}

function ItemEditor({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [qty, setQty] = useState(0);
  const [unit, setUnit] = useState<Unit>('pcs');
  const [lowAt, setLowAt] = useState('');

  useEffect(() => {
    if (item) {
      setQty(item.qty);
      setUnit(item.unit);
      setLowAt(item.lowAt !== undefined ? String(item.lowAt) : '');
    }
  }, [item]);

  if (!item) return null;
  const step = unit === 'pcs' ? 1 : 50;
  const save = () => {
    dispatch({ type: 'updateItem', id: item.id, patch: { qty, unit, lowAt: lowAt === '' ? undefined : Number(lowAt) } });
    onClose();
  };
  const remove = () => {
    dispatch({ type: 'deleteItem', id: item.id });
    toast({ text: `Removed ${displayName(item.name)}`, action: { label: 'Undo', run: () => dispatch({ type: 'restoreItem', item }) } });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={displayName(item.name)}
      footer={
        <div className="flex gap-2">
          <Button variant="danger" onClick={remove} aria-label="Delete item">
            <Trash2 size={18} />
          </Button>
          <Button size="lg" className="flex-1" onClick={save}>
            <Check size={20} /> Save
          </Button>
        </div>
      }
    >
      <p className="mb-2 font-semibold">How much is left?</p>
      <div className="flex items-center gap-2">
        <button aria-label="Less" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface" onClick={() => setQty((q) => Math.max(0, round(q - step, unit)))}>
          <Minus size={22} />
        </button>
        <input
          type="number"
          inputMode="decimal"
          aria-label="Quantity"
          min={0}
          value={qty}
          onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
          className="min-h-14 w-0 min-w-0 flex-1 rounded-2xl border border-line bg-surface text-center text-2xl font-bold tabular-nums outline-none focus:border-brand"
        />
        <button aria-label="More" className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface" onClick={() => setQty((q) => round(q + step, unit))}>
          <Plus size={22} />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <UnitPicker value={unit} onChange={setUnit} />
        <span className="text-ink-2">{formatStock(qty, unit)}</span>
      </div>

      <label className="mt-6 block font-semibold" htmlFor="low-at">
        Remind me when below
      </label>
      <p className="mb-2 text-sm text-ink-3">Goes on the shopping list automatically. Leave empty to only list it when it runs out.</p>
      <div className="flex items-center gap-2">
        <input
          id="low-at"
          type="number"
          inputMode="decimal"
          min={0}
          value={lowAt}
          placeholder="e.g. 2"
          onChange={(e) => setLowAt(e.target.value)}
          className="min-h-12 w-32 rounded-2xl border border-line bg-surface px-4 tabular-nums outline-none focus:border-brand"
        />
        <span className="text-ink-2">{unit}</span>
      </div>
    </Sheet>
  );
}

function Staples() {
  const { state, dispatch } = useStore();
  const [adding, setAdding] = useState('');
  const missing = state.staples.filter((s) => !s.have).length;
  return (
    <section>
      <SectionTitle right={missing ? <span className="text-sm text-warn">{missing} to buy</span> : undefined}>Staples</SectionTitle>
      <p className="mb-3 px-1 text-sm text-ink-3">Salt, oil, spices: just tap what you've run out of.</p>
      <div className="flex flex-wrap gap-2">
        {state.staples.map((s) => (
          <button
            key={s.name}
            aria-pressed={s.have}
            onClick={() => dispatch({ type: 'toggleStaple', name: s.name })}
            onContextMenu={(e) => {
              e.preventDefault();
              if (window.confirm(`Stop tracking ${displayName(s.name)} as a staple?`)) dispatch({ type: 'removeStaple', name: s.name });
            }}
            className={cx(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium',
              s.have ? 'border-good/30 bg-good-soft text-good' : 'border-dashed border-bad/50 bg-surface text-bad line-through decoration-1',
            )}
          >
            {s.have && <Check size={15} strokeWidth={3} />}
            {displayName(s.name)}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (adding.trim()) dispatch({ type: 'addStaple', name: adding });
          setAdding('');
        }}
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add a staple (e.g. vinegar)"
          aria-label="Add a staple"
          className="min-h-11 min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 text-sm outline-none focus:border-brand"
        />
        <Button size="sm" variant="secondary" type="submit" disabled={!adding.trim()}>
          Add
        </Button>
      </form>
      <p className="mt-2 mb-6 px-1 text-xs text-ink-3">Long-press a staple to stop tracking it.</p>
    </section>
  );
}
