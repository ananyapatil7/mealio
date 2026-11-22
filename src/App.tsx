import { createContext, useContext, useEffect, useState } from 'react';
import { ChartColumn, ChefHat, Refrigerator, ShoppingBasket } from 'lucide-react';
import { ToastProvider, cx } from './components/ui';
import { useStore } from './state/store';
import Kitchen from './screens/Kitchen';
import Cook from './screens/Cook';
import Shop from './screens/Shop';
import Track from './screens/Track';

export type Tab = 'kitchen' | 'cook' | 'shop' | 'track';
const NavCtx = createContext<(t: Tab) => void>(() => {});
export const useNav = () => useContext(NavCtx);

const TABS: { id: Tab; label: string; Icon: typeof ChefHat }[] = [
  { id: 'kitchen', label: 'Kitchen', Icon: Refrigerator },
  { id: 'cook', label: 'Cook', Icon: ChefHat },
  { id: 'shop', label: 'Shop', Icon: ShoppingBasket },
  { id: 'track', label: 'Track', Icon: ChartColumn },
];

function initialTab(): Tab {
  const fromHash = window.location.hash.replace('#', '') as Tab;
  return TABS.some((t) => t.id === fromHash) ? fromHash : 'kitchen';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { state, shopping } = useStore();
  const toBuy = shopping.filter((r) => !state.shoppingChecked[r.key]).length;

  // Start on Cook when there's food at home: deciding what to eat is the most common job.
  useEffect(() => {
    if (!window.location.hash && state.inventory.length > 0) setTab('cook');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <NavCtx.Provider value={setTab}>
      <ToastProvider>
        <div className="mx-auto min-h-dvh max-w-lg pb-[calc(76px+env(safe-area-inset-bottom))]">
          {tab === 'kitchen' && <Kitchen />}
          {tab === 'cook' && <Cook />}
          {tab === 'shop' && <Shop />}
          {tab === 'track' && <Track />}
        </div>
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur" aria-label="Main">
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
