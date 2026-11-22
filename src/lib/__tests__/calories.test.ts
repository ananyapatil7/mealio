import { describe, expect, it } from 'vitest';
import { average, caloriesFor, dateKey, lastNDays, totalForDate } from '../calories';
import { makeLog } from '../cooking';
import { RECIPES_BY_ID } from '../../data/recipes';

const omelette = RECIPES_BY_ID.get('masala-omelette')!;
const dal = RECIPES_BY_ID.get('dal-tadka')!;

describe('calories', () => {
  it('done-criterion 5: meal calories = recipe calories per serving x servings', () => {
    expect(caloriesFor(omelette, 1)).toBe(omelette.caloriesPerServing);
    expect(caloriesFor(omelette, 3)).toBe(omelette.caloriesPerServing * 3);
    expect(makeLog(dal, 2).calories).toBe(dal.caloriesPerServing * 2);
  });

  it('daily total adds up the meals cooked that day', () => {
    const day = new Date(2026, 10, 20, 9);
    const logs = [
      makeLog(omelette, 1, day),
      makeLog(dal, 2, new Date(2026, 10, 20, 20)),
      makeLog(dal, 1, new Date(2026, 10, 19, 20)),
    ];
    expect(totalForDate(logs, '2026-11-20')).toBe(omelette.caloriesPerServing + dal.caloriesPerServing * 2);
    expect(totalForDate(logs, '2026-11-19')).toBe(dal.caloriesPerServing);
    expect(totalForDate(logs, '2026-11-18')).toBe(0);
  });

  it('builds a 7-day view ending today, oldest first', () => {
    const today = new Date(2026, 10, 22, 12);
    const logs = [makeLog(omelette, 2, new Date(2026, 10, 22, 8)), makeLog(dal, 1, new Date(2026, 10, 16, 20)), makeLog(dal, 1, new Date(2026, 10, 10, 20))];
    const days = lastNDays(logs, today, 7);
    expect(days.map((d) => d.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(days[0].total).toBe(dal.caloriesPerServing);
    expect(days[6].total).toBe(omelette.caloriesPerServing * 2);
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(dal.caloriesPerServing + omelette.caloriesPerServing * 2);
    expect(average(days)).toBe(Math.round((dal.caloriesPerServing + omelette.caloriesPerServing * 2) / 2));
  });

  it('uses the local date, across month boundaries', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(lastNDays([], new Date(2026, 2, 2), 3).map((d) => d.date)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});
