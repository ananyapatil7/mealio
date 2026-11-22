import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, EmptyState, ScreenHeader, SectionTitle, cx, useToast } from '../components/ui';
import { useStore } from '../state/store';
import { average, dateKey, lastNDays, type DayTotal } from '../lib/calories';
import { useNav } from '../App';

const weekday = (key: string, short = true) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, short ? { weekday: 'short' } : { weekday: 'long', day: 'numeric', month: 'short' });
};
const fmt = (n: number) => n.toLocaleString();

export default function Track() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const go = useNav();
  const today = dateKey();
  const days = useMemo(() => lastNDays(state.mealLogs, new Date(), 7), [state.mealLogs]);
  const [selected, setSelected] = useState(today);
  const day = days.find((d) => d.date === selected) ?? days[days.length - 1];
  const avg = average(days);
  const isToday = day.date === today;

  if (state.mealLogs.length === 0) {
    return (
      <div>
        <ScreenHeader title="Track" subtitle="Calories from meals you cook" />
        <div className="px-4">
          <EmptyState emoji="📊" title="Nothing logged yet" body={'When you tap "I cooked this" on a recipe, the meal and its calories land here.'}>
            <Button onClick={() => go('cook')}>Find something to cook</Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Track" subtitle="Calories from meals you cook" />
      <div className="px-4">
        <div className="rounded-3xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold text-ink-2">{isToday ? 'Today' : weekday(day.date, false)}</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight tabular-nums">
            {fmt(day.total)}
            <span className="ml-1.5 text-lg font-semibold text-ink-2">kcal</span>
          </p>
          <p className="mt-1 text-sm text-ink-2">
            {day.meals.length} meal{day.meals.length === 1 ? '' : 's'} logged
            {avg > 0 && <> · 7-day average {fmt(avg)} kcal</>}
          </p>
          <WeekChart days={days} selected={day.date} onSelect={setSelected} today={today} />
        </div>

        <SectionTitle>{isToday ? "Today's meals" : `Meals on ${weekday(day.date, false)}`}</SectionTitle>
        {day.meals.length === 0 ? (
          <p className="px-1 text-ink-2">No meals logged {isToday ? 'yet today' : 'this day'}.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {day.meals.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center gap-3 pl-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.recipeName}</span>
                  <span className="text-xs text-ink-3">
                    {new Date(m.cookedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {m.servings} serving{m.servings === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{fmt(m.calories)} kcal</span>
                <button
                  aria-label={`Delete ${m.recipeName} from log`}
                  className="mr-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 active:bg-surface-2"
                  onClick={() => {
                    dispatch({ type: 'deleteLog', id: m.id });
                    const prev = state;
                    toast({ text: 'Removed from log (kitchen stock unchanged)', action: { label: 'Undo', run: () => dispatch({ type: 'replace', state: prev }) } });
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
            <li className="flex min-h-12 items-center justify-between px-4 font-bold">
              <span>Total</span>
              <span className="mr-12 tabular-nums">{fmt(day.total)} kcal</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

/** Single-series bar chart, one hue, tappable bars (selection shows that day's meals). */
function WeekChart({ days, selected, onSelect, today }: { days: DayTotal[]; selected: string; onSelect: (d: string) => void; today: string }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const H = 120;
  return (
    <div className="mt-5">
      <div className="flex h-[148px] items-end gap-2" role="group" aria-label="Calories, last 7 days">
        {days.map((d) => {
          const h = d.total ? Math.max(6, Math.round((d.total / max) * H)) : 0;
          const active = d.date === selected;
          return (
            <button
              key={d.date}
              onClick={() => onSelect(d.date)}
              aria-pressed={active}
              aria-label={`${weekday(d.date, false)}: ${d.total} kcal`}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            >
              <span className={cx('mb-1 text-[11px] font-semibold tabular-nums', active ? 'text-ink' : 'text-transparent group-hover:text-ink-2')}>
                {d.total ? fmt(d.total) : ''}
              </span>
              <span className="flex w-full max-w-8 justify-center border-b border-line">
                <span
                  className={cx('w-full rounded-t-[4px] transition-all', !active && 'opacity-45')}
                  style={{ height: h, background: 'var(--chart)' }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {days.map((d) => (
          <span key={d.date} className={cx('flex-1 text-center text-xs', d.date === selected ? 'font-bold text-ink' : 'text-ink-3')}>
            {d.date === today ? 'Today' : weekday(d.date)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Calories per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{d.total} kcal</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
