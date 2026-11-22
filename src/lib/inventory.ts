import type { InventoryItem, Quantity, Staple, Unit } from './types';
import { convert, round } from './units';
import { normalizeName } from './names';

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

/**
 * Add items to the inventory, merging with existing entries of the same name.
 * Mixed pcs + g are stored in grams (finer unit); otherwise the existing unit wins.
 */
export function addToInventory(inventory: InventoryItem[], incoming: IncomingItem[], now = Date.now()): InventoryItem[] {
  const next = inventory.map((i) => ({ ...i }));
  for (const raw of incoming) {
    const name = normalizeName(raw.name);
    if (!name || !(raw.qty > 0)) continue;
    const existing = next.find((i) => i.name === name && convert(raw, i.unit, name) !== null);
    if (!existing) {
      next.push({ id: uid(), name, qty: round(raw.qty, raw.unit), unit: raw.unit, updatedAt: now });
      continue;
    }
    let unit: Unit = existing.unit;
    if (existing.unit !== raw.unit && (existing.unit === 'pcs' || raw.unit === 'pcs') && convert(raw, 'g', name) !== null) {
      unit = 'g';
    }
    const current = convert(existing, unit, name) ?? existing.qty;
    const add = convert(raw, unit, name) ?? 0;
    if (unit !== existing.unit && existing.lowAt !== undefined) {
      existing.lowAt = round(convert({ qty: existing.lowAt, unit: existing.unit }, unit, name) ?? existing.lowAt, unit);
    }
    existing.qty = round(Math.max(0, current) + add, unit);
    existing.unit = unit;
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
