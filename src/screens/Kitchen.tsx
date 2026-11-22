import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChefHat, Clock, Ellipsis, Flame, Minus, Plus, Search, ShoppingBasket, ShoppingCart, Sparkles, Trash2, TriangleAlert, Users } from 'lucide-react';
import { Button, Chip, EmptyState, FoodTile, IconButton, ScreenHeader, SectionTitle, Sheet, cx, useToast } from '../components/ui';
import { useStore } from '../state/store';
import { catalogEntry, displayName } from '../lib/names';
import { formatQty, isCountable, round } from '../lib/units';
import { isLow, stockLevel } from '../lib/inventory';
import { mealForNow, rankRecipes, type RecipeMatch } from '../lib/ranking';
import type { InventoryItem, Unit } from '../lib/types';
import { CATEGORY_LABELS, categoryFor, emojiFor, type Category } from '../data/ingredients';
import { RECIPES, recipeEmoji } from '../data/recipes';
import { useNav } from '../App';
import AddGroceries, { UnitPicker } from './AddGroceries';
import RecipeSheet from './RecipeSheet';

export const formatStock = (qty: number, unit: Unit) => (unit === 'pcs' ? `${formatQty(qty, unit)} pcs` : formatQty(qty, unit));

type Filter = 'all' | 'low' | Category;

export default function Kitchen() {
  const { state, dispatch, shopping } = useStore();
  const toast = useToast();
  const go = useNav();
  const [adding, setAdding] = useState<null | 'text' | 'single'>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openRecipe, setOpenRecipe] = useState<RecipeMatch | null>(null);

  const lowCount = state.inventory.filter(isLow).length;
  const empty = state.inventory.length === 0;

  const matches = useMemo(
    () => rankRecipes(RECIPES, state.inventory, state.staples, { servings: state.settings.servings, mealType: mealForNow() }),
    [state.inventory, state.staples, state.settings.servings],
  );
  const readyCount = useMemo(
    () => rankRecipes(RECIPES, state.inventory, state.staples, { servings: state.settings.servings }).filter((m) => m.missingCount === 0).length,
    [state.inventory, state.staples, state.settings.servings],
  );

  const categories = useMemo(() => {
    const present = new Set(state.inventory.map((i) => categoryFor(i.name)));
    return (Object.keys(CATEGORY_LABELS) as Category[]).filter((c) => present.has(c));
  }, [state.inventory]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.inventory]
      .filter((i) => !q || i.name.includes(q) || displayName(i.name).toLowerCase().includes(q))
      .filter((i) => (filter === 'all' ? true : filter === 'low' ? isLow(i) : categoryFor(i.name) === filter))
      // Running-low items first, then alphabetical.
      .sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || displayName(a.name).localeCompare(displayName(b.name)));
  }, [state.inventory, query, filter]);

  const loadSample = () => {
    const prev = state;
    dispatch({ type: 'loadSample' });
    setMenu(false);
    toast({ text: 'Sample kitchen loaded', action: { label: 'Undo', run: () => dispatch({ type: 'replace', state: prev }) } });
  };

  const toBuy = shopping.filter((r) => !state.shoppingChecked[r.key]);

  return (
    <div>
      <ScreenHeader
        title={
          <>
            Your kitchen<span className="hidden sm:inline">{empty ? '' : ', at a glance'}</span>
          </>
        }
        subtitle="Cook smarter with what you already have."
        action={
          <div className="flex items-center gap-2">
            {!empty && (
              <div className="hidden sm:block">
                <Button onClick={() => setAdding('text')}>
                  <Plus size={20} /> Add groceries
                </Button>
              </div>
            )}
            <IconButton label="More options" onClick={() => setMenu(true)} className="border border-line bg-surface">
              <Ellipsis size={22} />
            </IconButton>
          </div>
        }
      />

      <div className="px-4 lg:px-0">
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
            {/* At-a-glance tiles */}
            <div className="grid grid-cols-3 gap-2.5 lg:gap-5">
              <StatTile
                tone="green"
                icon={<ShoppingBasket size={24} />}
                value={state.inventory.length}
                label="ingredients"
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              <StatTile
                tone="amber"
                icon={<TriangleAlert size={24} />}
                value={lowCount}
                label="running low"
                active={filter === 'low'}
                onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}
              />
              <StatTile tone="rose" icon={<ChefHat size={24} />} value={readyCount} label="ready to cook" onClick={() => go('cook')} />
            </div>

            <Button size="lg" className="mt-4 w-full sm:hidden" onClick={() => setAdding('text')}>
              <Plus size={20} /> Add groceries
            </Button>

            <div className="mt-2 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
              {/* Suggestion: first on phones (most likely next action), right column on desktop */}
              <aside className="lg:sticky lg:top-8 lg:order-2">
                <Suggestion match={matches[0]} onOpen={setOpenRecipe} />
              </aside>

              <section className="lg:order-1">
                <SectionTitle
                  right={
                    <label className="hidden min-h-11 w-64 items-center gap-2 rounded-full border border-line bg-surface px-4 sm:flex">
                      <Search size={18} className="text-ink-3" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search ingredients…"
                        aria-label="Search ingredients"
                        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                      />
                    </label>
                  }
                >
                  In your kitchen
                </SectionTitle>
                <label className="mb-3 flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 sm:hidden">
                  <Search size={18} className="text-ink-3" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search ingredients…"
                    aria-label="Search ingredients"
                    className="min-w-0 flex-1 bg-transparent outline-none"
                  />
                </label>
                <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
                  <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
                    All
                  </Chip>
                  {lowCount > 0 && (
                    <Chip active={filter === 'low'} onClick={() => setFilter('low')}>
                      Running low
                    </Chip>
                  )}
                  {categories.map((c) => (
                    <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
                      {CATEGORY_LABELS[c]}
                    </Chip>
                  ))}
                </div>

                {items.length === 0 ? (
                  <p className="rounded-3xl border border-line bg-surface p-6 text-center text-ink-2">Nothing here{query ? ` for "${query}"` : ''}.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
                    {items.map((item) => (
                      <ItemCard key={item.id} item={item} onEdit={() => setEditing(item)} />
                    ))}
                    <li>
                      <button
                        onClick={() => setAdding('single')}
                        className="flex h-full min-h-[168px] w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-ink-2 hover:border-ink-3"
                      >
                        <Plus size={24} />
                        <span className="text-sm font-semibold">Add an item</span>
                      </button>
                    </li>
                  </ul>
                )}
              </section>
            </div>

            {toBuy.length > 0 && <GroceryStrip rows={toBuy} onOpen={() => go('shop')} />}
          </>
        )}

        <Staples />
      </div>

      <AddGroceries open={adding !== null} mode={adding ?? 'text'} onClose={() => setAdding(null)} />
      <ItemEditor item={editing} onClose={() => setEditing(null)} />
      <RecipeSheet recipe={openRecipe?.recipe ?? null} initialServings={state.settings.servings} onClose={() => setOpenRecipe(null)} />

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

function StatTile({
  tone,
  icon,
  value,
  label,
  active,
  onClick,
}: {
  tone: 'green' | 'amber' | 'rose';
  icon: React.ReactNode;
  value: number;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex flex-col items-start gap-2 rounded-3xl border p-3.5 text-left transition sm:flex-row sm:items-center sm:gap-4 sm:p-5 lg:p-6',
        tone === 'green' && 'bg-tile-green text-good',
        tone === 'amber' && 'bg-tile-amber text-warn',
        tone === 'rose' && 'bg-tile-rose text-bad',
        active ? 'border-current/30' : 'border-transparent',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl leading-none font-extrabold text-ink tabular-nums lg:text-[32px]">{value}</span>
        <span className="mt-1 block text-[13px] leading-tight text-ink-2 sm:text-[15px]">{label}</span>
      </span>
    </button>
  );
}

function ItemCard({ item, onEdit }: { item: InventoryItem; onEdit: () => void }) {
  const { dispatch } = useStore();
  const low = isLow(item);
  const out = item.qty <= 0;
  const level = stockLevel(item);
  const bar = low ? 'bg-bad' : level < 0.5 ? 'bg-[#e3b341]' : 'bg-good';
  return (
    <li className="relative">
      <button
        onClick={onEdit}
        className="flex h-full w-full flex-col rounded-3xl border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(24,36,26,0.25)]"
      >
        <FoodTile emoji={emojiFor(item.name)} size="lg" className="mb-3 bg-tile-green" />
        <span className="line-clamp-1 font-bold">{displayName(item.name)}</span>
        <span className={cx('text-sm tabular-nums', out ? 'font-semibold text-bad' : 'text-ink-2')}>{out ? 'Out of stock' : formatStock(item.qty, item.unit)}</span>
        <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Stock level">
          <span className={cx('block h-full rounded-full', bar)} style={{ width: `${Math.max(level * 100, out ? 0 : 6)}%` }} />
        </span>
      </button>
      {item.unit === 'pcs' && !out && (
        <button
          aria-label={`Use one ${displayName(item.name)}`}
          title="Used one"
          onClick={() => dispatch({ type: 'updateItem', id: item.id, patch: { qty: Math.max(0, round(item.qty - 1, 'pcs')) } })}
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink"
        >
          <Minus size={16} />
        </button>
      )}
      {low && <span className="absolute top-4 right-14 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-bold text-bad">{out ? 'Out' : 'Low'}</span>}
    </li>
  );
}

function Suggestion({ match, onOpen }: { match?: RecipeMatch; onOpen: (m: RecipeMatch) => void }) {
  const go = useNav();
  if (!match) return null;
  const { recipe, missingCount, servings } = match;
  return (
    <div className="mt-5 rounded-[28px] border border-line bg-surface p-5 lg:mt-0">
      <div className="flex items-start gap-2.5">
        <Sparkles size={22} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <h2 className="text-lg font-bold tracking-tight lg:text-xl">Cook with what you have</h2>
          <p className="text-sm text-ink-2">Top {mealForNow()} pick for your ingredients</p>
        </div>
      </div>
      <FoodTile emoji={recipeEmoji(recipe.id)} size="xl" className="mt-4 bg-gradient-to-br from-lime to-brand-soft" />
      <h3 className="mt-4 text-xl font-bold tracking-tight">{recipe.name}</h3>
      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} /> {recipe.cookTimeMin} min
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flame size={15} /> {recipe.caloriesPerServing} kcal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users size={15} /> {servings} serving{servings > 1 ? 's' : ''}
        </span>
      </p>
      <p
        className={cx(
          'mt-4 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold',
          missingCount === 0 ? 'bg-good-soft text-good' : 'bg-lime text-brand',
        )}
      >
        {missingCount === 0 ? <Check size={16} strokeWidth={3} /> : <ShoppingCart size={16} />}
        {missingCount === 0 ? 'You have everything' : `Only ${missingCount} item${missingCount > 1 ? 's' : ''} to buy`}
      </p>
      <Button size="lg" className="mt-4 w-full rounded-full" onClick={() => onOpen(match)}>
        View recipe <ArrowRight size={18} />
      </Button>
      <button className="mt-2 min-h-10 w-full text-sm font-semibold text-ink-2 hover:text-ink" onClick={() => go('cook')}>
        See all recipes
      </button>
    </div>
  );
}

function GroceryStrip({ rows, onOpen }: { rows: { key: string; name: string; qty?: number; unit?: Unit }[]; onOpen: () => void }) {
  return (
    <section className="mt-8 rounded-[28px] bg-tile-green p-5 lg:flex lg:items-center lg:gap-6 lg:p-6">
      <div className="flex items-center gap-4 lg:w-72 lg:shrink-0">
        <ShoppingCart size={30} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight">Your next grocery run</h2>
          <p className="text-sm text-ink-2">
            {rows.length} item{rows.length === 1 ? '' : 's'} from your plans and low stock
          </p>
        </div>
        <div className="lg:hidden">
          <IconButton label="Open shopping list" onClick={onOpen} className="bg-surface text-ink">
            <ArrowRight size={20} />
          </IconButton>
        </div>
      </div>
      <ul className="-mx-5 mt-4 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:mt-0 lg:flex-1 lg:px-0">
        {rows.slice(0, 6).map((r) => (
          <li key={r.key} className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-surface py-2 pr-4 pl-2">
            <FoodTile emoji={emojiFor(r.name)} size="sm" className="bg-transparent" />
            <span>
              <span className="block text-sm leading-tight font-bold">{displayName(r.name)}</span>
              <span className="block text-xs text-ink-2">{r.qty !== undefined && r.unit ? formatStock(r.qty, r.unit) : 'staple'}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden lg:block">
        <IconButton label="Open shopping list" onClick={onOpen} className="bg-surface text-ink">
          <ArrowRight size={20} />
        </IconButton>
      </div>
    </section>
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
  const countable = isCountable(item.name);
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
      title={
        <span className="flex items-center gap-3">
          <FoodTile emoji={emojiFor(item.name)} size="sm" className="bg-tile-green" />
          {displayName(item.name)}
        </span>
      }
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
        {countable ? (
          <span className="text-sm text-ink-2">Counted in pieces · about {catalogEntry(item.name)?.gramsPerPiece} g each</span>
        ) : (
          <UnitPicker value={unit} onChange={setUnit} />
        )}
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
    <section className="pb-8">
      <SectionTitle right={missing ? <span className="text-sm font-semibold text-warn">{missing} to buy</span> : undefined}>Staples</SectionTitle>
      <p className="mb-3 px-1 text-sm text-ink-2">Salt, oil, spices: just tap what you've run out of.</p>
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
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition',
              s.have ? 'border-transparent bg-good-soft text-good' : 'border-dashed border-bad/50 bg-surface text-bad line-through decoration-1',
            )}
          >
            {s.have && <Check size={15} strokeWidth={3} />}
            {displayName(s.name)}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex max-w-md gap-2"
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
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-brand"
        />
        <Button size="sm" variant="secondary" type="submit" disabled={!adding.trim()} className="rounded-full">
          Add
        </Button>
      </form>
      <p className="mt-2 px-1 text-xs text-ink-3">Long-press (or right-click) a staple to stop tracking it.</p>
    </section>
  );
}
