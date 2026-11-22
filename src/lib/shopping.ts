import type { InventoryItem, ManualShoppingItem, PlannedMeal, Recipe, Staple, Unit } from './types';
import { available, findItems, isStaple } from './inventory';
import { catalogEntry } from './names';
import { convert, round, scaleQty } from './units';

export interface ShoppingRow {
  /** Stable key for tick / dismiss state. */
  key: string;
  name: string;
  qty?: number;
  unit?: Unit;
  reasons: string[];
  staple: boolean;
  /** Has a generated (auto) component. */
  auto: boolean;
  /** Manual list entries merged into this row. */
  manualIds: string[];
  /** For manual items: how much is already at home (in row unit), so we can warn. */
  haveAtHome?: number;
}

export interface ShoppingInput {
  inventory: InventoryItem[];
  staples: Staple[];
  planned: PlannedMeal[];
  manual: ManualShoppingItem[];
  dismissed?: Record<string, boolean>;
  recipes: Map<string, Recipe>;
}

interface Need {
  qty: number;
  unit: Unit;
  for: string[];
}

/** Restock target for a low item: twice its threshold, or one usual pack when no threshold is set. */
function restockTarget(item: InventoryItem): number {
  if (item.lowAt && item.lowAt > 0) return item.lowAt * 2;
  const c = catalogEntry(item.name);
  if (c?.pack) return convert({ qty: c.pack, unit: c.unit }, item.unit, item.name) ?? 1;
  return item.unit === 'pcs' ? 1 : 500;
}

const ceilBuy = (n: number, unit: Unit) => (unit === 'pcs' ? Math.ceil(n - 1e-9) : Math.ceil(round(n, unit) - 1e-9));

/**
 * Build the shopping list:
 *  - inventory items below their low-stock threshold (or run out), topped up to a restock target
 *  - shortfalls for meals planned this week (needs summed across all planned meals, minus stock)
 *  - staples marked "don't have"
 *  - manual items (merged into matching rows, quantities summed)
 * An item only appears when the user has less than they need, so it never lists something you have enough of.
 */
export function buildShoppingList(input: ShoppingInput): ShoppingRow[] {
  const { inventory, staples, planned, manual, recipes, dismissed = {} } = input;
  const rows: ShoppingRow[] = [];

  // 1) Sum planned needs per ingredient (merging duplicates across recipes).
  const needs = new Map<string, Need[]>();
  const stapleNeeds = new Map<string, string[]>();
  for (const p of planned) {
    const recipe = recipes.get(p.recipeId);
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      if (isStaple(staples, ing.name)) {
        stapleNeeds.set(ing.name, [...(stapleNeeds.get(ing.name) ?? []), recipe.name]);
        continue;
      }
      const qty = scaleQty(ing.qty, recipe.baseServings, p.servings, ing.unit);
      const list = needs.get(ing.name) ?? [];
      // Prefer the unit the inventory already uses, so needs and stock compare directly.
      const invUnit = findItems(inventory, ing.name).find((i) => convert({ qty: 1, unit: ing.unit }, i.unit, ing.name) !== null)?.unit;
      const target = list.find((n) => convert({ qty: 1, unit: ing.unit }, n.unit, ing.name) !== null);
      if (target) {
        target.qty += convert({ qty, unit: ing.unit }, target.unit, ing.name) ?? 0;
        if (!target.for.includes(recipe.name)) target.for.push(recipe.name);
      } else {
        const unit = invUnit ?? ing.unit;
        list.push({ qty: convert({ qty, unit: ing.unit }, unit, ing.name) ?? qty, unit, for: [recipe.name] });
      }
      needs.set(ing.name, list);
    }
  }

  // 2) Quantity-tracked items: low stock and planned shortfalls.
  const names = new Set<string>([...inventory.map((i) => i.name), ...needs.keys()]);
  for (const name of names) {
    if (isStaple(staples, name)) continue;
    const items = findItems(inventory, name);
    const primary = items[0];
    const nameNeeds = needs.get(name) ?? [];
    const units = new Set<Unit>([...(primary ? [primary.unit] : []), ...nameNeeds.map((n) => n.unit)]);
    for (const unit of units) {
      const need = nameNeeds.find((n) => n.unit === unit);
      const have = available(inventory, name, unit);
      const owner = items.find((i) => i.unit === unit);
      let target = need?.qty ?? 0;
      const reasons: string[] = [];
      if (owner) {
        const totalOwned = items.filter((i) => i.unit === unit).reduce((s, i) => s + i.qty, 0);
        const low = totalOwned <= 0 || (owner.lowAt !== undefined && totalOwned < owner.lowAt);
        if (low) {
          target += restockTarget(owner);
          reasons.push(totalOwned <= 0 ? 'Ran out' : 'Running low');
        }
      }
      const buy = target - have;
      if (buy <= 1e-6) continue;
      if (need && need.qty > have) reasons.push(...need.for.map((r) => `For ${r}`));
      if (!reasons.length) continue;
      rows.push({ key: `auto:${name}:${unit}`, name, qty: ceilBuy(buy, unit), unit, reasons, staple: false, auto: true, manualIds: [] });
    }
  }

  // 3) Staples you don't have.
  for (const s of staples) {
    if (s.have) continue;
    const usedBy = stapleNeeds.get(s.name) ?? [];
    rows.push({
      key: `auto:${s.name}:staple`,
      name: s.name,
      reasons: ['Staple', ...[...new Set(usedBy)].map((r) => `For ${r}`)],
      staple: true,
      auto: true,
      manualIds: [],
    });
  }

  const visible = rows.filter((r) => !dismissed[r.key]);

  // 4) Manual items, merged into matching rows with quantities summed.
  for (const m of manual) {
    const match = visible.find(
      (r) => r.name === m.name && (r.staple || !m.unit || !r.unit || convert({ qty: 1, unit: m.unit }, r.unit, m.name) !== null),
    );
    if (match) {
      if (match.unit && m.qty && m.unit) {
        match.qty = ceilBuy((match.qty ?? 0) + (convert({ qty: m.qty, unit: m.unit }, match.unit, m.name) ?? 0), match.unit);
      }
      match.manualIds.push(m.id);
      if (!match.reasons.includes('Added by you')) match.reasons.push('Added by you');
      continue;
    }
    const staple = !!isStaple(staples, m.name);
    visible.push({
      key: `manual:${m.id}`,
      name: m.name,
      qty: staple ? undefined : m.qty,
      unit: staple ? undefined : m.unit,
      reasons: ['Added by you'],
      staple,
      auto: false,
      manualIds: [m.id],
      haveAtHome: !staple && m.unit ? available(inventory, m.name, m.unit) : undefined,
    });
  }

  return visible;
}
