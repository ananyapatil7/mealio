import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, CalendarPlus, Check, ChefHat, Clock, Flame, Leaf, TriangleAlert, X } from 'lucide-react';
import { Button, FoodTile, Sheet, Stepper, cx, useToast } from '../components/ui';
import { emojiFor } from '../data/ingredients';
import { recipeEmoji } from '../data/recipes';
import { useStore } from '../state/store';
import { matchRecipe } from '../lib/ranking';
import { planCook, type DeductionLine } from '../lib/cooking';
import { displayName } from '../lib/names';
import { formatQty, round } from '../lib/units';
import type { Recipe } from '../lib/types';
import { useNav } from '../App';

export default function RecipeSheet({ recipe, initialServings, onClose }: { recipe: Recipe | null; initialServings: number; onClose: () => void }) {
  const [servings, setServings] = useState(initialServings);
  const [cooking, setCooking] = useState(false);
  useEffect(() => {
    if (recipe) {
      setServings(initialServings);
      setCooking(false);
    }
  }, [recipe, initialServings]);
  if (!recipe) return null;
  return cooking ? (
    <CookStep recipe={recipe} servings={servings} setServings={setServings} onBack={() => setCooking(false)} onDone={onClose} />
  ) : (
    <RecipeView recipe={recipe} servings={servings} setServings={setServings} onCook={() => setCooking(true)} onClose={onClose} />
  );
}

function RecipeView({
  recipe,
  servings,
  setServings,
  onCook,
  onClose,
}: {
  recipe: Recipe;
  servings: number;
  setServings: (n: number) => void;
  onCook: () => void;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const go = useNav();
  const match = useMemo(() => matchRecipe(recipe, state.inventory, state.staples, servings), [recipe, state.inventory, state.staples, servings]);
  const planned = state.planned.some((p) => p.recipeId === recipe.id);

  const togglePlan = () => {
    dispatch({ type: 'togglePlan', recipeId: recipe.id, servings });
    if (!planned) {
      toast({
        text: match.missingCount ? `Planned. ${match.missingCount} item${match.missingCount > 1 ? 's' : ''} added to your shopping list` : 'Planned for this week',
        action: match.missingCount ? { label: 'View list', run: () => go('shop') } : undefined,
      });
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={recipe.name}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={togglePlan} className={cx('flex-1', planned && 'border-brand text-brand')}>
            {planned ? <CalendarCheck size={20} /> : <CalendarPlus size={20} />}
            {planned ? 'Planned' : 'Plan this week'}
          </Button>
          <Button size="lg" className="flex-[1.3]" onClick={onCook}>
            <ChefHat size={20} /> I cooked this
          </Button>
        </div>
      }
    >
      <FoodTile emoji={recipeEmoji(recipe.id)} size="xl" className="mb-4 h-32 bg-gradient-to-br from-lime to-brand-soft text-7xl" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1">
          <Clock size={15} /> {recipe.cookTimeMin} min
        </span>
        <span className="inline-flex items-center gap-1">
          <Flame size={15} /> {recipe.caloriesPerServing} kcal per serving
        </span>
        {recipe.tags.includes('veg') ? (
          <span className="inline-flex items-center gap-1 text-good">
            <Leaf size={15} /> Veg
          </span>
        ) : (
          <span>Non-veg</span>
        )}
        <span>{recipe.cuisine}</span>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface p-3">
        <div>
          <p className="font-semibold">Servings</p>
          <p className="text-sm text-ink-2">
            {match.totalCalories} kcal total ({servings} × {recipe.caloriesPerServing})
          </p>
        </div>
        <Stepper label="servings" value={servings} onChange={setServings} />
      </div>

      <h3 className="mt-5 mb-2 flex items-center justify-between font-bold">
        Ingredients
        <span className={cx('text-sm font-semibold', match.missingCount ? 'text-bad' : 'text-good')}>
          {match.missingCount ? `${match.missingCount} missing` : 'You have everything'}
        </span>
      </h3>
      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface">
        {match.checks.map((c) => (
          <li key={c.name} className="flex min-h-12 items-center gap-3 px-3 py-2">
            <span className="relative">
              <FoodTile emoji={emojiFor(c.name)} size="sm" />
              <span
                className={cx('absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-surface', c.ok ? 'bg-good text-surface' : 'bg-bad text-surface')}
                aria-label={c.ok ? 'Have' : 'Missing'}
              >
                {c.ok ? <Check size={12} strokeWidth={3.5} /> : <X size={12} strokeWidth={3.5} />}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className={cx('font-medium', !c.ok && 'text-bad')}>{displayName(c.name)}</span>
              {c.staple && <span className="ml-1.5 text-xs text-ink-3">staple</span>}
              {!c.ok && !c.staple && c.have > 0 && (
                <span className="block text-xs text-ink-2">
                  have {formatQty(c.have, c.need.unit)}
                  , need {formatQty(c.shortBy, c.need.unit)} more
                </span>
              )}
            </span>
            <span className="text-sm text-ink-2 tabular-nums">{formatNeed(c.need.qty, c.need.unit)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 mb-2 font-bold">Steps</h3>
      <ol className="mb-2 flex flex-col gap-3">
        {recipe.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-ink">{i + 1}</span>
            <span className="pt-0.5 leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

const formatNeed = (qty: number, unit: 'pcs' | 'g' | 'ml') => (unit === 'pcs' ? `× ${formatQty(qty, unit)}` : formatQty(qty, unit));

function CookStep({
  recipe,
  servings,
  setServings,
  onBack,
  onDone,
}: {
  recipe: Recipe;
  servings: number;
  setServings: (n: number) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const plan = useMemo(() => planCook(recipe, servings, state.inventory, state.staples), [recipe, servings, state.inventory, state.staples]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [adjust, setAdjust] = useState(false);
  useEffect(() => setEdits({}), [servings]);

  const lines: DeductionLine[] = plan.lines.map((l) =>
    edits[l.name] !== undefined ? { ...l, deduct: Math.max(0, Math.min(l.available, edits[l.name])) } : l,
  );
  const tracked = lines.filter((l) => !l.staple);
  const missingStaples = lines.filter((l) => l.staple && l.short > 0);

  const confirm = () => {
    const prev = state;
    dispatch({ type: 'cook', recipeId: recipe.id, servings, lines });
    toast({
      text: `Logged ${recipe.name} · ${plan.calories} kcal. Kitchen updated.`,
      action: { label: 'Undo', run: () => dispatch({ type: 'replace', state: prev }) },
    });
    onDone();
  };

  return (
    <Sheet
      open
      onClose={onDone}
      title={
        <span className="flex items-center gap-1">
          <button aria-label="Back to recipe" onClick={onBack} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full active:bg-surface-2">
            <ArrowLeft size={20} />
          </button>
          Cooked {recipe.name}?
        </span>
      }
      footer={
        <Button size="lg" className="w-full" onClick={confirm}>
          <Check size={20} /> {plan.shortages.length ? 'Cook anyway & update kitchen' : 'Done, update kitchen'}
        </Button>
      }
    >
      <div className="flex items-center justify-between rounded-2xl bg-surface p-3">
        <div>
          <p className="font-semibold">Servings cooked</p>
          <p className="text-sm text-ink-2">
            Logs {plan.calories} kcal ({servings} × {recipe.caloriesPerServing})
          </p>
        </div>
        <Stepper label="servings" value={servings} onChange={setServings} />
      </div>

      {plan.shortages.length > 0 && (
        <div className="mt-3 flex gap-3 rounded-2xl bg-warn-soft p-3 text-warn" role="alert">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">You didn't have enough of {plan.shortages.length} item{plan.shortages.length > 1 ? 's' : ''}.</p>
            <p className="mt-0.5">
              {plan.shortages
                .map((s) => (s.staple ? `${displayName(s.name)} (marked as out)` : `${displayName(s.name)} (need ${formatQty(s.need.qty, s.need.unit)}, have ${formatQty(s.available, s.need.unit)})`))
                .join(', ')}
              . We'll use what you have. Stock never goes below zero. Adjust below if you used something else.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 mb-2 flex items-center justify-between">
        <h3 className="font-bold">Taken from your kitchen</h3>
        <button className="min-h-10 px-2 text-sm font-semibold text-brand" onClick={() => setAdjust((a) => !a)}>
          {adjust ? 'Done adjusting' : 'Adjust amounts'}
        </button>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {tracked.map((l) => {
          const left = round(l.available - l.deduct, l.need.unit);
          return (
            <li key={l.name} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{displayName(l.name)}</span>
                <span className={cx('block text-xs', l.short > 0 ? 'text-warn' : 'text-ink-3')}>
                  {l.available <= 0 ? 'none at home' : `${formatQty(left, l.need.unit)} left after`}
                  {l.short > 0 && l.available > 0 ? ` · short ${formatQty(l.short, l.need.unit)}` : ''}
                </span>
              </span>
              {adjust ? (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={l.available}
                    aria-label={`Amount of ${displayName(l.name)} used`}
                    value={l.deduct}
                    onChange={(e) => setEdits((ed) => ({ ...ed, [l.name]: Number(e.target.value) || 0 }))}
                    className="min-h-11 w-20 rounded-xl border border-line bg-bg px-2 text-right tabular-nums outline-none focus:border-brand"
                  />
                  <span className="w-7 text-sm text-ink-2">{l.need.unit}</span>
                </span>
              ) : (
                <span className="font-semibold tabular-nums">− {formatNeed(l.deduct, l.need.unit).replace('× ', '')}</span>
              )}
            </li>
          );
        })}
      </ul>
      {missingStaples.length === 0 && lines.some((l) => l.staple) && (
        <p className="mt-3 text-sm text-ink-3">
          Staples used: {lines.filter((l) => l.staple).map((l) => displayName(l.name)).join(', ')}. These aren't counted, just marked have / don't have.
        </p>
      )}
    </Sheet>
  );
}
