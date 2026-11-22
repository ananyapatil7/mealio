import { describe, expect, it } from 'vitest';
import svg from '../../../public/icon.svg?raw';
import ui from '../../components/ui.tsx?raw';

// The in-app logo and the app/tab icon must stay the same artwork.
describe('logo', () => {
  it('Logo component uses the same shapes as public/icon.svg', () => {
    const shapes = (src: string) => [...src.matchAll(/\b(d|fill|rx)="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`);
    const logo = ui.slice(ui.indexOf('export function Logo'));
    expect(shapes(logo).length).toBeGreaterThan(5);
    expect(shapes(logo)).toEqual(shapes(svg));
  });
});
