import { describe, expect, it } from 'vitest';
import { convert, formatQty, scaleQty, toCanonical } from '../units';
import { normalizeName, nameMatches } from '../names';

describe('unit conversion', () => {
  it('converts kg, l, dozen and kitchen units into g / ml / pcs', () => {
    expect(toCanonical(1, 'kg')).toEqual({ qty: 1000, unit: 'g' });
    expect(toCanonical(0.5, 'kg')).toEqual({ qty: 500, unit: 'g' });
    expect(toCanonical(1.5, 'litre')).toEqual({ qty: 1500, unit: 'ml' });
    expect(toCanonical(2, 'dozen')).toEqual({ qty: 24, unit: 'pcs' });
    expect(toCanonical(0.5, 'dozen')).toEqual({ qty: 6, unit: 'pcs' });
    expect(toCanonical(2, 'tbsp')).toEqual({ qty: 30, unit: 'ml' });
    expect(toCanonical(1, 'banana')).toBeNull();
  });

  it('converts pcs <-> g only when the catalog knows the piece weight', () => {
    expect(convert({ qty: 2, unit: 'pcs' }, 'g', 'onion')).toBe(300);
    expect(convert({ qty: 300, unit: 'g' }, 'pcs', 'onion')).toBe(2);
    expect(convert({ qty: 2, unit: 'pcs' }, 'g', 'mystery')).toBeNull();
    expect(convert({ qty: 100, unit: 'ml' }, 'g', 'milk')).toBe(100);
    expect(convert({ qty: 100, unit: 'ml' }, 'pcs', 'milk')).toBeNull();
  });

  it('scales linearly with servings', () => {
    expect(scaleQty(4, 2, 2, 'pcs')).toBe(4);
    expect(scaleQty(4, 2, 3, 'pcs')).toBe(6);
    expect(scaleQty(4, 2, 1, 'pcs')).toBe(2);
    expect(scaleQty(150, 2, 1, 'g')).toBe(75);
  });

  it('formats quantities for people', () => {
    expect(formatQty(1500, 'g')).toBe('1.5 kg');
    expect(formatQty(250, 'ml')).toBe('250 ml');
    expect(formatQty(0.5, 'pcs')).toBe('½');
    expect(formatQty(2.5, 'pcs')).toBe('2½');
    expect(formatQty(6, 'pcs')).toBe('6');
  });
});

describe('name normalisation', () => {
  it('is case-insensitive and singular', () => {
    expect(normalizeName('Onions')).toBe('onion');
    expect(normalizeName('ONION')).toBe('onion');
    expect(normalizeName('tomatoes')).toBe('tomato');
    expect(normalizeName('Tomato')).toBe('tomato');
    expect(normalizeName('Green Chillies')).toBe('green chilli');
    expect(normalizeName('potatoes')).toBe('potato');
    expect(normalizeName('chickpeas')).toBe('chickpeas');
  });
  it('maps common aliases', () => {
    expect(normalizeName('pyaz')).toBe('onion');
    expect(normalizeName('yoghurt')).toBe('curd');
    expect(normalizeName('bell peppers')).toBe('capsicum');
    expect(normalizeName('cilantro')).toBe('coriander leaves');
    expect(normalizeName('red chilli powder')).toBe('chilli powder');
  });
  it('matches filter terms against ingredients', () => {
    expect(nameMatches('paneer', 'paneer')).toBe(true);
    expect(nameMatches('chilli', 'chilli powder')).toBe(true);
    expect(nameMatches('chilli', 'green chilli')).toBe(true);
    expect(nameMatches('onion', 'garlic')).toBe(false);
  });
});
