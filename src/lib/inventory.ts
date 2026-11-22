import type { InventoryItem, Quantity, Staple, Unit } from './types';
import { convert, isCountable, round, toCount } from './units';
import { catalogEntry, normalizeName } from './names';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export interface IncomingItem {
  name: string;
  qty: number;
  unit: Unit;
}

/**
 * How much of `name` the inventory holds, expressed in `unit`.
 * Entries that can't be converted to `unit` are ignored (we can't prove they cover it).
 */
export function available(inventory: InventoryItem[], name: string, unit: Unit): number {
  let total = 0;
  for (const item of inventory) {
    if (item.name !== name) continue;
    const c = convert(item, unit, name);
    if (c !== null) total += Math.max(0, c);
  }
  return total;
}

export function findItems(inventory: InventoryItem[], name: string): InventoryItem[] {
  return inventory.filter((i) => i.name === name);
}

/** Legacy or edited entries of countable items (e.g. onions saved as 1000 g) become a count. */
export function normalizeItem(item: InventoryItem): InventoryItem {
  if (item.unit === 'pcs' || !isCountable(item.name)) return item;
  const qty = toCount(item.name, item).qty;
  const next: InventoryItem = { ...item, qty, unit: 'pcs' };
  if (item.lowAt !== undefined) next.lowAt = Math.max(1, toCount(item.name, { qty: item.lowAt, unit: item.unit }).qty);
  return next;
}

/**
 * Add items to the inventory, merging with existing entries of the same name.
 * Countable items (eggs, onions, tomatoes…) are always kept as a whole count;
 * for everything else the existing entry's unit wins.
 */
export function addToInventory(inventory: InventoryItem[], incoming: IncomingItem[], now = Date.now()): InventoryItem[] {
  const next = inventory.map((i) => normalizeItem({ ...i }));
  for (const raw of incoming) {
    const name = normalizeName(raw.name);
    if (!name || !(raw.qty > 0)) continue;
    const q = toCount(name, { qty: raw.qty, unit: raw.unit });
    const existing = next.find((i) => i.name === name && convert(q, i.unit, name) !== null);
    if (!existing) {
      next.push({ id: uid(), name, qty: round(q.qty, q.unit), unit: q.unit, updatedAt: now });
      continue;
    }
    existing.qty = round(Math.max(0, existing.qty) + (convert(q, existing.unit, name) ?? 0), existing.unit);
    existing.updatedAt = now;
  }
  return next;
}

/** Subtract a quantity (in any convertible unit) from an ingredient. Never goes below zero. */
export function deductFromInventory(inventory: InventoryItem[], name: string, amount: Quantity, now = Date.now()): InventoryItem[] {
  let remaining = amount.qty;
  return inventory.map((item) => {
    if (item.name !== name || remaining <= 0) return item;
    const haveInAmountUnit = convert(item, amount.unit, name);
    if (haveInAmountUnit === null) return item;
    const take = Math.min(remaining, Math.max(0, haveInAmountUnit));
    remaining -= take;
    const takeInItemUnit = convert({ qty: take, unit: amount.unit }, item.unit, name) ?? 0;
    return { ...item, qty: Math.max(0, round(item.qty - takeInItemUnit, item.unit)), updatedAt: now };
  });
}

export function isStaple(staples: Staple[], name: string): Staple | undefined {
  return staples.find((s) => s.name === name);
}

export function isLow(item: InventoryItem): boolean {
  return item.qty <= 0 || (item.lowAt !== undefined && item.qty < item.lowAt);
}

/**
 * How full an item is, 0..1, for the stock bar. Measured against a "full" level of
 * 2x its low-stock threshold, or one usual pack when it has no threshold.
 */
export function stockLevel(item: InventoryItem): number {
  if (item.qty <= 0) return 0;
  let full: number | null = null;
  if (item.lowAt && item.lowAt > 0) full = item.lowAt * 2;
  else {
    const c = catalogEntry(item.name);
    if (c?.pack) full = convert({ qty: c.pack, unit: c.unit }, item.unit, item.name);
  }
  if (!full || full <= 0) return 1;
  return Math.max(0, Math.min(1, item.qty / full));
}
