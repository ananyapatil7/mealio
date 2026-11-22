import { useMemo, useState } from 'react';
import { CalendarCheck, Clock, Flame, Leaf, Search, X } from 'lucide-react';
import { Button, Chip, EmptyState, ScreenHeader, Stepper, cx } from '../components/ui';
import { useStore } from '../state/store';
import { RECIPES } from '../data/recipes';
import { rankRecipes, readiness, type IngredientCheck, type RecipeMatch } from '../lib/ranking';
import { MEAL_TYPES, type MealType, type Recipe } from '../lib/types';
import { displayName } from '../lib/names';
import { formatQty } from '../lib/units';
import { useNav } from '../App';
import RecipeSheet from './RecipeSheet';

function mealForNow(d = new Date()): MealType {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

const KCAL_OPTIONS = [undefined, 300, 400, 500, 700] as const;

export function missingLabel(c: IngredientCheck): string {
  const name = displayName(c.name);
  if (c.staple) return name;
  if (c.have > 0) return `${name}: ${formatQty(c.shortBy, c.need.unit)}$ more`;
  return `${name} ${formatQty(c.need.qty, c.need.unit)}`;
}

export default function Cook() {
  const { state, dispatch } = useStore();
  const go = useNav();
  const [mealType, setMealType] = useState<MealType>(mealForNow);
  const [vegOnly, setVegOnly] = useState(false);
  const [quick, setQuick] = useState(false);
  const [maxKcal, setMaxKcal] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Recipe | null>(null);
  const servings = state.settings.servings;

  const matches = useMemo(
    () =>
      rankRecipes(RECIPES, state.inventory, state.staples, {
        mealType,
        vegOnly,
        maxMinutes: quick ? 20 : undefined,
        maxCalories: maxKcal,
        servings,
        query,
      }),
    [state.inventory, state.staples, mealType, vegOnly, quick, maxKcal, servings, query],
  );
  const ready = matches.filter((m) => m.missingCount === 0).length;
  const close = matches.filter((m) => m.missingCount > 0 && m.missingCount <= 2).length;
  const plannedIds = new Set(state.planned.map((p) => p.recipeId));
  const filtersOn = vegOnly || quick || maxKcal !== undefined || query.trim() !== '';

  return (
    <div>
      <ScreenHeader
        title="What to cook?"
        subtitle={
          state.inventory.length === 0
            ? 'Add groceries to see what you can make'
            : ready
              ? `${ready} you can cook now${close ? ` · ${close} almost there` : ''}`
              : close
                ? `${close} recipes are 1–2 items away`
                : 'Nothing ready with what you have yet'
        }
      />

      <div className="sticky top-0 z-20 bg-bg/95 px-4 pt-1 pb-3 backdrop-blur">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Meal type">
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={mealType === t}
              onClick={() => setMealType(t)}
              className={cx('min-h-11 rounded-xl text-sm font-semibold capitalize', mealType === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-2')}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Stepper size="sm" label="servings" value={servings} onChange={(v) => dispatch({ type: 'setServings', servings: v })} />
          <span className="shrink-0 text-sm text-ink-2">{servings === 1 ? 'serving' : 'servings'}</span>
          <Chip active={vegOnly} onClick={() => setVegOnly((v) => !v)}>
            <Leaf size={15} /> Veg
          </Chip>
          <Chip active={quick} onClick={() => setQuick((v) => !v)}>
            <Clock size={15} /> ≤ 20 min
          </Chip>
          <Chip
            active={maxKcal !== undefined}
            onClick={() => setMaxKcal((k) => KCAL_OPTIONS[(KCAL_OPTIONS.indexOf(k as never) + 1) % KCAL_OPTIONS.length])}
            aria-label="Maximum calories per serving, tap to change"
          >
            <Flame size={15} /> {maxKcal ? `≤ ${maxKcal} kcal` : 'Any kcal'}
          </Chip>
        </div>
        <label className="mt-2 flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-3">
          <Search size={18} className="shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "no paneer" or "pasta"'
            aria-label="Search recipes"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          {query && (
            <button aria-label="Clear search" className="flex h-9 w-9 items-center justify-center text-ink-3" onClick={() => setQuery('')}>
              <X size={18} />
            </button>
          )}
        </label>
      </div>

      <div className="px-4">
        {state.inventory.length === 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-soft p-3">
            <p className="flex-1 text-sm">Your kitchen is empty, so every recipe shows what you'd need to buy.</p>
            <Button size="sm" onClick={() => go('kitchen')}>
              Add food
            </Button>
          </div>
        )}

        {matches.length === 0 ? (
          <EmptyState emoji="🍳" title="No recipes match" body="Try a different meal type or loosen the filters.">
            {filtersOn && (
              <Button
                variant="secondary"
                onClick={() => {
                  setVegOnly(false);
                  setQuick(false);
                  setMaxKcal(undefined);
                  setQuery('');
                }}
              >
                Clear filters
              </Button>
            )}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3 pb-4">
            {matches.map((m) => (
              <RecipeCard key={m.recipe.id} match={m} planned={plannedIds.has(m.recipe.id)} onOpen={() => setOpen(m.recipe)} />
            ))}
          </ul>
        )}
      </div>

      <RecipeSheet recipe={open} initialServings={servings} onClose={() => setOpen(null)} />
    </div>
  );
}

function RecipeCard({ match, planned, onOpen }: { match: RecipeMatch; planned: boolean; onOpen: () => void }) {
  const { recipe, missing, missingCount, servings, totalCalories } = match;
  const r = readiness(missingCount);
  return (
    <li>
      <button onClick={onOpen} className="w-full rounded-3xl border border-line bg-surface p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)] active:scale-[0.99]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] leading-snug font-bold">{recipe.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1">
                <Clock size={14} /> {recipe.cookTimeMin} min
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame size={14} /> {recipe.caloriesPerServing} kcal/serving
                {servings > 1 && <span className="text-ink-3"> · {totalCalories} for {servings}</span>}
              </span>
              {recipe.tags.includes('veg') && (
                <span className="inline-flex items-center gap-1 text-good">
                  <Leaf size={14} /> Veg
                </span>
              )}
            </p>
          </div>
          <span
            className={cx(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
              r.tone === 'ready' && 'bg-good-soft text-good',
              r.tone === 'close' && 'bg-warn-soft text-warn',
              r.tone === 'far' && 'bg-surface-2 text-ink-2',
            )}
          >
            {r.label}
          </span>
        </div>
        {missing.length > 0 && (
          <div className="mt-3">
            <span className="sr-only">Missing:</span>
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((c) => (
                <li key={c.name} className="rounded-lg bg-bad-soft px-2 py-1 text-xs font-semibold text-bad">
                  {missingLabel(c)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {planned && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
            <CalendarCheck size={14} /> Planned this week
          </p>
        )}
      </button>
    </li>
  );
}
