import { createContext, useContext, useEffect, useState } from 'react';
import { ChartColumn, ChefHat, Leaf, Refrigerator, ShoppingBasket } from 'lucide-react';
import { ToastProvider, cx } from './components/ui';
import { useStore } from './state/store';
import Kitchen from './screens/Kitchen';
import Cook from './screens/Cook';
import Shop from './screens/Shop';
import Track from './screens/Track';

export type Tab = 'kitchen' | 'cook' | 'shop' | 'track';
const NavCtx = createContext<(t: Tab) => void>(() => {});
export const useNav = () => useContext(NavCtx);

const TABS: { id: Tab; label: string; long: string; Icon: typeof ChefHat }[] = [
  { id: 'kitchen', label: 'Kitchen', long: 'My Kitchen', Icon: Refrigerator },
  { id: 'cook', label: 'Cook', long: 'Recipes', Icon: ChefHat },
  { id: 'shop', label: 'Shop', long: 'Grocery List', Icon: ShoppingBasket },
  { id: 'track', label: 'Track', long: 'Calories', Icon: ChartColumn },
];

function initialTab(): Tab {
  const fromHash = window.location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === fromHash) ? fromHash : 'kitchen';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { state, shopping } = useStore();
  const toBuy = shopping.filter((r) => !state.shoppingChecked[r.key]).length;

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <NavCtx.Provider value={setTab}>
      <ToastProvider>
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-8 lg:flex">
          <div className="mb-10 flex items-center gap-2.5 px-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <Leaf size={20} strokeWidth={2.4} />
            </span>
            <span className="text-2xl font-extrabold tracking-tight">Mealio</span>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Main">
            {TABS.map(({ id, long, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cx(
                  'flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[15px] font-semibold transition',
                  tab === id ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon size={20} strokeWidth={tab === id ? 2.4 : 2} />
                <span className="flex-1 text-left">{long}</span>
                {id === 'shop' && toBuy > 0 && <span className="rounded-full bg-brand px-2 text-xs leading-5 text-brand-ink">{toBuy}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-tile-green p-4 text-sm text-ink-2">
            <p className="font-semibold text-ink">Cook more, waste less.</p>
            <p className="mt-1">Your data stays on this device. No account needed.</p>
          </div>
        </aside>

        <main className="mx-auto min-h-dvh max-w-lg pb-[calc(76px+env(safe-area-inset-bottom))] lg:ml-64 lg:max-w-none lg:px-10 lg:pb-12">
          <div className="lg:mx-auto lg:max-w-6xl">
            {tab === 'kitchen' && <Kitchen />}
            {tab === 'cook' && <Cook />}
            {tab === 'shop' && <Shop />}
            {tab === 'track' && <Track />}
          </div>
        </main>

        {/* Mobile bottom tabs */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Main">
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={cx('relative flex h-[68px] flex-col items-center justify-center gap-1 text-xs font-semibold', tab === id ? 'text-brand' : 'text-ink-3')}
              >
                <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition', tab === id && 'bg-brand-soft')}>
                  <Icon size={22} strokeWidth={tab === id ? 2.4 : 2} />
                </span>
                {label}
                {id === 'shop' && toBuy > 0 && (
                  <span className="absolute top-2 left-1/2 ml-3 min-w-5 rounded-full bg-brand px-1.5 text-[11px] leading-5 text-brand-ink">{toBuy}</span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </ToastProvider>
    </NavCtx.Provider>
  );
}
