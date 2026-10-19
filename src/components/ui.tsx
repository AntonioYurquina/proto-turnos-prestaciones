import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AUT_LABEL, ESTADO_LABEL, type EstadoAut, type EstadoTurno } from '../types';

export function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(' '); }

export function Button({ variant = 'secondary', size, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' }) {
  return <button type="button" {...p} className={cx(`btn-${variant}`, size === 'sm' && 'btn-sm', className)} />;
}

export function Card({ title, subtitle, actions, children, className, bodyClass }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('card min-w-0', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass ?? 'p-4'}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  gray: 'bg-slate-100 text-slate-500 ring-slate-200',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONES[tone], className)}>{children}</span>;
}

export const ESTADO_TONE: Record<EstadoTurno, keyof typeof TONES> = { asignado: 'neutral', confirmado: 'blue', enSala: 'amber', atendido: 'green', ausente: 'red', cancelado: 'gray' };
export function EstadoBadge({ e }: { e: EstadoTurno }) {
  return <Badge tone={ESTADO_TONE[e]}><span className={cx('h-1.5 w-1.5 rounded-full', DOT[e])} />{ESTADO_LABEL[e]}</Badge>;
}
export const DOT: Record<EstadoTurno, string> = { asignado: 'bg-est-asignado', confirmado: 'bg-est-confirmado', enSala: 'bg-est-sala', atendido: 'bg-est-atendido', ausente: 'bg-est-ausente', cancelado: 'bg-est-cancelado' };

const AUT_TONE: Record<EstadoAut, keyof typeof TONES> = { pendiente: 'amber', autorizada: 'green', rechazada: 'red', vencida: 'gray' };
export function AutBadge({ e }: { e: EstadoAut }) { return <Badge tone={AUT_TONE[e]}>{AUT_LABEL[e]}</Badge>; }

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', h);
    const t = setTimeout(() => { ref.current?.querySelector<HTMLElement>('input:not([type=date]):not([type=time]),select,textarea')?.focus(); }, 30);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); clearTimeout(t); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tid} className={cx('flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id={tid} className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50 px-5 py-3 sm:rounded-b-xl">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, error, className }: { label: string; children: ReactNode; hint?: ReactNode; error?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">{icon}</div>}
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'bad' | 'good'; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={cx('mt-1.5 text-[26px] font-semibold leading-none tracking-tight', tone === 'bad' && 'text-red-700', tone === 'warn' && 'text-amber-700', tone === 'good' && 'text-emerald-700')}>{value}</p>
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-slate-200/60 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} type="button" onClick={() => onChange(t.id)}
          className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors', value === t.id ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-600 hover:text-ink-900')}>
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-[11px]', value === t.id ? 'bg-brand-50 text-brand-700' : 'bg-slate-300/60 text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Bar({ value, tone, label }: { value: number; tone?: 'brand' | 'amber' | 'red'; label?: string }) {
  const c = tone === 'red' ? 'bg-red-600' : tone === 'amber' ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full', c)} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('overflow-x-auto', className)}><table className="w-full min-w-max border-collapse">{children}</table></div>;
}

export function PrintSheet({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="print-sheet">
      <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#555' }}>Cuadrante · Prototipo con datos ficticios · documento sin valor fiscal</p>
      <h1>{titulo}</h1>
      {subtitulo && <p style={{ color: '#444' }}>{subtitulo}</p>}
      {children}
    </div>
  );
}
