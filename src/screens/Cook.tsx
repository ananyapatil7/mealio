import { useMemo, useState } from 'react';
import { CalendarCheck, Clock, Flame, Leaf, Search, X } from 'lucide-react';
import { Button, Chip, EmptyState, FoodTile, ScreenHeader, Stepper, cx } from '../components/ui';
import { useStore } from '../state/store';
import { RECIPES, recipeEmoji } from '../data/recipes';
import { mealForNow, missingLabel, rankRecipes, readiness, type RecipeMatch } from '../lib/ranking';
import { MEAL_TYPES, type MealType, type Recipe } from '../lib/types';
import { useNav } from '../App';
import RecipeSheet from './RecipeSheet';

const KCAL_OPTIONS = [undefined, 300, 400, 500, 700] as const;

export default function Cook() {
  const { state, dispatch } = useStore();
  const go = useNav();
  const [mealType, setMealType] = useState<MealType>(() => mealForNow());
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

      <div className="sticky top-0 z-20 bg-bg/95 px-4 pt-1 pb-3 backdrop-blur lg:static lg:px-0 lg:pb-6">
        <div className="lg:flex lg:items-center lg:gap-4">
          <div className="grid grid-cols-4 gap-1 rounded-full bg-surface-2 p-1 lg:w-[460px] lg:shrink-0" role="tablist" aria-label="Meal type">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={mealType === t}
                onClick={() => setMealType(t)}
                className={cx('min-h-11 rounded-full text-sm font-semibold capitalize transition', mealType === t ? 'bg-brand text-brand-ink shadow-sm' : 'text-ink-2 hover:text-ink')}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="mt-3 flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 lg:mt-0 lg:flex-1">
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
        <div className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
          <Stepper size="sm" label="servings" value={servings} onChange={(v) => dispatch({ type: 'setServings', servings: v })} />
          <span className="mr-1 shrink-0 text-sm text-ink-2">{servings === 1 ? 'serving' : 'servings'}</span>
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
      </div>

      <div className="px-4 lg:px-0">
        {state.inventory.length === 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-3xl bg-tile-green p-4">
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
          <ul className="grid gap-3 pb-6 lg:grid-cols-2 lg:gap-4">
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
      <button
        onClick={onOpen}
        className="flex h-full w-full gap-4 rounded-[28px] border border-line bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(24,36,26,0.25)] active:scale-[0.99]"
      >
        <FoodTile emoji={recipeEmoji(recipe.id)} size="lg" className={r.tone === 'ready' ? 'bg-tile-green' : 'bg-surface-2'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-[17px] leading-snug font-bold">{recipe.name}</h3>
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
          {missing.length > 0 && (
            <div className="mt-2.5">
              <span className="sr-only">Missing:</span>
              <ul className="flex flex-wrap gap-1.5">
                {missing.map((c) => (
                  <li key={c.name} className="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad">
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
        </div>
      </button>
    </li>
  );
}
