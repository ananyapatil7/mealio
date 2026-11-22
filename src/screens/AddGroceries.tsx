import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, ReceiptText, Sparkles, X } from 'lucide-react';
import { Button, FoodTile, Sheet, cx, useToast } from '../components/ui';
import { emojiFor } from '../data/ingredients';
import { parseGroceryText, type ParsedItem } from '../lib/parser';
import { catalogEntry, displayName, isKnown, normalizeName } from '../lib/names';
import { formatQty, isCountable, toCount } from '../lib/units';
import type { Unit } from '../lib/types';
import { useStore } from '../state/store';

const EXAMPLE = 'bought 6 eggs, 1kg onions, half kg tomatoes, milk';
const RECEIPT_EXAMPLE = `FRESHMART
TOMATO HYBRID 500G      1   24.00
ONIONS 1KG              1   40.00
EGGS 12PC                   84.00
PANEER 200G             1   90.00
TOTAL                      238.00`;

interface Row extends ParsedItem {
  rowId: number;
  text: string; // editable name as shown
}

let nextRowId = 1;
const toRow = (p: ParsedItem): Row => ({ ...p, rowId: nextRowId++, text: p.known ? displayName(p.name) : p.name });
const blankRow = (): Row => ({ name: '', text: '', qty: 1, unit: 'pcs', source: '', assumed: false, known: false, staple: false, rowId: nextRowId++ });

/** Paste or type groceries -> confirm screen -> save. `mode="single"` opens straight on a blank confirm row. */
export default function AddGroceries({ open, onClose, mode = 'text' }: { open: boolean; onClose: () => void; mode?: 'text' | 'single' }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setRows(mode === 'single' ? [blankRow()] : null);
    }
  }, [open, mode]);

  const stapleNames = state.staples.map((s) => s.name);
  const read = () => setRows(parseGroceryText(text, stapleNames).map(toRow));

  const update = (rowId: number, patch: Partial<Row>) =>
    setRows((rs) =>
      (rs ?? []).map((r) => {
        if (r.rowId !== rowId) return r;
        const next = { ...r, ...patch };
        if (patch.text !== undefined) {
          next.name = normalizeName(patch.text);
          next.known = isKnown(next.name);
          next.staple = stapleNames.includes(next.name) || !!catalogEntry(next.name)?.staple;
          // A newly recognised item picks up its natural unit if the user hasn't set one.
          const entry = catalogEntry(next.name);
          if (entry && !r.name && r.unit === 'pcs') next.unit = entry.unit;
        }
        if (patch.qty !== undefined || patch.unit !== undefined) {
          next.assumed = false;
          next.estimatedFrom = undefined;
        }
        return next;
      }),
    );

  const valid = (rows ?? []).filter((r) => r.name && (r.staple || r.qty > 0));
  const save = () => {
    dispatch({ type: 'addItems', items: valid.map((r) => ({ name: r.name, qty: r.qty, unit: r.unit, staple: r.staple })) });
    toast({ text: `Saved ${valid.length} item${valid.length === 1 ? '' : 's'} to your kitchen` });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={rows ? (mode === 'single' ? 'Add an item' : 'Check and save') : 'Add groceries'}
      footer={
        rows ? (
          <Button size="lg" className="w-full" disabled={!valid.length} onClick={save}>
            Save {valid.length || ''} item{valid.length === 1 ? '' : 's'} to kitchen
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={!text.trim()} onClick={read}>
            <Sparkles size={20} /> Read items
          </Button>
        )
      }
    >
      {!rows ? (
        <div>
          <label htmlFor="grocery-text" className="mb-2 block text-ink-2">
            Type what you bought the way you'd say it, or paste a receipt.
          </label>
          <textarea
            id="grocery-text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={`e.g. "${EXAMPLE}"`}
            className="w-full resize-none rounded-3xl border border-line bg-surface p-4 leading-relaxed outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-10 rounded-full bg-surface-2 px-3.5 text-sm text-ink-2" onClick={() => setText(EXAMPLE)}>
              Try an example
            </button>
            <button className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm text-ink-2" onClick={() => setText(RECEIPT_EXAMPLE)}>
              <ReceiptText size={16} /> Sample receipt
            </button>
          </div>
          <p className="mt-4 text-sm text-ink-3">
            Works with kg, g, litres, ml, "half kg", "a dozen", packets. Prices and totals on receipts are ignored. You'll check everything before it's saved.
          </p>
        </div>
      ) : (
        <div>
          {mode !== 'single' && (
            <button className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-ink-2" onClick={() => setRows(null)}>
              <ArrowLeft size={16} /> Edit text
            </button>
          )}
          {rows.length === 0 && (
            <p className="rounded-2xl bg-warn-soft p-4 text-warn">
              Couldn't find any items in that text. Try something like "2 onions, 500g paneer", or add items one by one below.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.rowId} className="rounded-3xl border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <FoodTile emoji={r.name ? emojiFor(r.name) : '🧺'} size="sm" className="bg-tile-green" />
                  <input
                    aria-label="Item name"
                    value={r.text}
                    autoFocus={mode === 'single' && !r.text}
                    placeholder="Item name"
                    onChange={(e) => update(r.rowId, { text: e.target.value })}
                    className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 font-semibold outline-none focus:bg-surface-2"
                  />
                  <button
                    aria-label={`Remove ${r.text || 'row'}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 active:bg-surface-2"
                    onClick={() => setRows((rs) => (rs ?? []).filter((x) => x.rowId !== r.rowId))}
                  >
                    <X size={18} />
                  </button>
                </div>
                {r.staple ? (
                  <p className="px-2 pt-1 text-sm text-good">Staple: will be marked as "have"</p>
                ) : (
                  <div className="mt-1 flex items-center gap-2 px-1">
                    <input
                      aria-label={`Quantity of ${r.text}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={Number.isFinite(r.qty) ? r.qty : ''}
                      onChange={(e) => update(r.rowId, { qty: Number(e.target.value) })}
                      className={cx(
                        'min-h-11 w-24 rounded-xl border bg-bg px-3 tabular-nums outline-none focus:border-brand',
                        r.assumed ? 'border-warn' : 'border-line',
                      )}
                    />
                    <UnitPicker value={r.unit} onChange={(unit) => update(r.rowId, { unit })} />
                    <span className="ml-auto text-right text-xs text-ink-3">
                      {r.unit !== 'pcs' && r.name && isCountable(r.name) && r.qty > 0
                        ? `saves as ≈ ${toCount(r.name, r).qty} pcs`
                        : r.unit !== 'pcs' && r.qty >= 1000
                          ? formatQty(r.qty, r.unit)
                          : ''}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 px-2 pt-1.5 empty:hidden">
                  {r.assumed && !r.staple && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Guessed amount: check it</span>}
                  {r.estimatedFrom && !r.staple && (
                    <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-medium text-brand">
                      ≈ from {formatQty(r.estimatedFrom.qty, r.estimatedFrom.unit)}, check the count
                    </span>
                  )}
                  {r.name && !r.known && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">New item</span>}
                  {r.source && r.source.toLowerCase() !== r.text.toLowerCase() && <span className="truncate text-xs text-ink-3">from "{r.source}"</span>}
                </div>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setRows((rs) => [...(rs ?? []), blankRow()])}>
            <Plus size={18} /> Add another
          </Button>
        </div>
      )}
    </Sheet>
  );
}

export function UnitPicker({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-bg p-0.5" role="radiogroup" aria-label="Unit">
      {(['pcs', 'g', 'ml'] as Unit[]).map((u) => (
        <button
          key={u}
          role="radio"
          aria-checked={value === u}
          onClick={() => onChange(u)}
          className={cx('min-h-10 min-w-11 rounded-lg px-2 text-sm font-semibold', value === u ? 'bg-ink text-bg' : 'text-ink-2')}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
