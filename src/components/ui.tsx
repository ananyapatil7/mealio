import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Minus, Plus, X } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        size === 'lg' && 'min-h-14 px-5 text-[17px]',
        size === 'md' && 'min-h-12 px-4 text-base',
        size === 'sm' && 'min-h-10 px-3 text-sm',
        variant === 'primary' && 'bg-brand text-brand-ink shadow-sm',
        variant === 'secondary' && 'bg-surface text-ink border border-line',
        variant === 'ghost' && 'text-ink-2',
        variant === 'danger' && 'bg-bad-soft text-bad',
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...props}
      className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 active:bg-surface-2', className)}
    >
      {children}
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 12,
  label,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const btn = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Fewer ${label ?? ''}`}
        className={cx(btn, 'flex items-center justify-center rounded-full active:bg-surface-2 disabled:opacity-30')}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={18} />
      </button>
      <span className="min-w-8 text-center text-base font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label ?? ''}`}
        className={cx(btn, 'flex items-center justify-center rounded-full active:bg-surface-2 disabled:opacity-30')}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

export function Chip({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cx(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition',
        active ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-bg shadow-2xl">
        <div className="flex items-center gap-2 px-5 pt-3 pb-2">
          <div className="min-w-0 flex-1 pt-2 text-lg font-bold leading-tight">{title}</div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={22} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line bg-bg px-5 pt-3 pb-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ emoji, title, body, children }: { emoji: string; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <div className="mb-3 text-5xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 max-w-xs text-ink-2">{body}</p>
      {children && <div className="mt-5 flex w-full max-w-xs flex-col gap-2">{children}</div>}
    </div>
  );
}

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-start gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between px-1">
      <h2 className="text-sm font-bold tracking-wide text-ink-2 uppercase">{children}</h2>
      {right}
    </div>
  );
}

/* ---------------- Toasts (with Undo) ---------------- */

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(t: Omit<ToastMsg, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((t: Omit<ToastMsg, 'id'>) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <div
            key={toast.id}
            role="status"
            className="animate-fade pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-xl"
          >
            <span className="flex-1 text-sm">{toast.text}</span>
            {toast.action && (
              <button
                className="min-h-10 rounded-xl px-3 text-sm font-bold text-brand-soft"
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
