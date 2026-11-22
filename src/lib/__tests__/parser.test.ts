import { describe, expect, it } from 'vitest';
import { parseGroceryText } from '../parser';

const simple = (text: string) => parseGroceryText(text).map(({ name, qty, unit }) => ({ name, qty, unit }));

describe('parseGroceryText', () => {
  it('done-criterion 1: "bought 6 eggs, 1kg onions, half kg tomatoes"', () => {
    expect(simple('bought 6 eggs, 1kg onions, half kg tomatoes')).toEqual([
      { name: 'egg', qty: 6, unit: 'pcs' },
      { name: 'onion', qty: 1000, unit: 'g' },
      { name: 'tomato', qty: 500, unit: 'g' },
    ]);
  });

  it('gives a bare item a default quantity, flagged as assumed', () => {
    const [milk] = parseGroceryText('milk');
    expect(milk).toMatchObject({ name: 'milk', qty: 1000, unit: 'ml', assumed: true, known: true });
  });

  it('handles the full casual example including milk', () => {
    const items = parseGroceryText('bought 6 eggs, 1kg onions, half kg tomatoes, milk');
    expect(items.map((i) => i.name)).toEqual(['egg', 'onion', 'tomato', 'milk']);
    expect(items.filter((i) => i.assumed).map((i) => i.name)).toEqual(['milk']);
  });

  it('converts dozens, litres, decimals and fractions', () => {
    expect(simple('a dozen eggs')).toEqual([{ name: 'egg', qty: 12, unit: 'pcs' }]);
    expect(simple('half dozen bananas')).toEqual([{ name: 'banana', qty: 6, unit: 'pcs' }]);
    expect(simple('2 l milk')).toEqual([{ name: 'milk', qty: 2000, unit: 'ml' }]);
    expect(simple('1.5kg potatoes')).toEqual([{ name: 'potato', qty: 1500, unit: 'g' }]);
    expect(simple('1/2 kg paneer')).toEqual([{ name: 'paneer', qty: 500, unit: 'g' }]);
    expect(simple('250 gm butter')).toEqual([{ name: 'butter', qty: 250, unit: 'g' }]);
    expect(simple('500ml curd')).toEqual([{ name: 'curd', qty: 500, unit: 'ml' }]);
    expect(simple('one and a half kg rice')).toEqual([{ name: 'rice', qty: 1500, unit: 'g' }]);
  });

  it('splits on "and", "&", new lines and semicolons', () => {
    expect(simple('3 onions and 2 tomatoes\n200g paneer; bread & butter').map((i) => i.name)).toEqual([
      'onion', 'tomato', 'paneer', 'bread', 'butter',
    ]);
  });

  it('normalises names and aliases', () => {
    expect(simple('aloo 1kg, 4 Tomatoes, dahi 400g').map((i) => i.name)).toEqual(['potato', 'tomato', 'curd']);
    expect(simple('Amul toned milk 500ml')).toEqual([{ name: 'milk', qty: 500, unit: 'ml' }]);
    expect(simple('basmati rice 1kg')).toEqual([{ name: 'rice', qty: 1000, unit: 'g' }]);
  });

  it('does not turn a different product into an ingredient', () => {
    expect(simple('tomato ketchup')[0].name).toBe('ketchup');
    expect(simple('garlic powder')[0].name).toBe('garlic powder');
  });

  it('uses pack sizes for packets', () => {
    const [m] = parseGroceryText('2 packets milk');
    expect(m).toMatchObject({ name: 'milk', qty: 2000, unit: 'ml', assumed: true });
  });

  it('parses a pasted receipt, ignoring prices, totals and headers', () => {
    const receipt = `FRESHMART SUPERSTORE
Date: 12/11/2026  18:42
TOMATO HYBRID 500G      1   24.00
ONIONS 1KG              1   40.00
EGGS 12PC                   84.00
AMUL BUTTER 100G        2  112.00
Milk 1L x2                 108.00
Coriander leaves            10.00
SUBTOTAL                   378.00
GST                          0.00
TOTAL                      378.00
Thank you for shopping!`;
    expect(simple(receipt)).toEqual([
      { name: 'tomato', qty: 500, unit: 'g' },
      { name: 'onion', qty: 1000, unit: 'g' },
      { name: 'egg', qty: 12, unit: 'pcs' },
      { name: 'butter', qty: 200, unit: 'g' },
      { name: 'milk', qty: 2000, unit: 'ml' },
      { name: 'coriander leaves', qty: 50, unit: 'g' },
    ]);
  });

  it('treats prices with currency as prices', () => {
    expect(simple('6 eggs Rs 42, 1 kg onions ₹35')).toEqual([
      { name: 'egg', qty: 6, unit: 'pcs' },
      { name: 'onion', qty: 1000, unit: 'g' },
    ]);
  });

  it('merges duplicate lines and sums quantities', () => {
    expect(simple('2 onions, 3 onions')).toEqual([{ name: 'onion', qty: 5, unit: 'pcs' }]);
    expect(simple('500g tomatoes, half kg tomatoes')).toEqual([{ name: 'tomato', qty: 1000, unit: 'g' }]);
  });

  it('flags staples and keeps unknown items as typed (never invents)', () => {
    const items = parseGroceryText('salt, 2 dragonfruits');
    expect(items[0]).toMatchObject({ name: 'salt', staple: true });
    expect(items[1]).toMatchObject({ name: 'dragonfruit', qty: 2, unit: 'pcs', known: false });
    expect(parseGroceryText('')).toEqual([]);
    expect(parseGroceryText('TOTAL 300.00')).toEqual([]);
  });

  it('handles multipliers', () => {
    expect(simple('2 x 500g pasta')).toEqual([{ name: 'pasta', qty: 1000, unit: 'g' }]);
    expect(simple('eggs x 12')).toEqual([{ name: 'egg', qty: 12, unit: 'pcs' }]);
  });
});
