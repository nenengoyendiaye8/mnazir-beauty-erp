import React, { useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { clsx } from '../utils/helpers';

/* Système UI Entreprise — Style Éditorial & Cosmétique Botanique (Sans artifice IA, bordures franches 1px, typographie tabulaire) */

export const PageHeader: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 pb-4 mb-5 border-b border-[#dcd5c7]">
    <div className="border-l-2 border-[#a68038] pl-3.5">
      <h1 className="font-serif-brand text-2xl font-bold text-[#12241a] leading-none tracking-tight">{title}</h1>
      {subtitle && <p className="text-xs text-[#6e6659] mt-1.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Card: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; className?: string; children: React.ReactNode; pad?: boolean }> = ({ title, right, className, children, pad = true }) => (
  <div className={clsx('bg-white rounded-md border border-[#dcd5c7]', className)}>
    {(title || right) && (
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#ebe5d9] bg-[#faf8f4] rounded-t-md">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#2b2720]">{title}</h3>
        {right}
      </div>
    )}
    <div className={pad ? 'p-4' : ''}>{children}</div>
  </div>
);

type Tone = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'violet';
const tones: Record<Tone, { box: string; dot: string }> = {
  emerald: { box: 'bg-[#eef5f0] text-[#164228] border-[#c4dccb]', dot: 'bg-[#1f6b3f]' },
  amber:   { box: 'bg-[#fbf4e4] text-[#785314] border-[#e6d1a4]', dot: 'bg-[#b88222]' },
  rose:    { box: 'bg-[#fbeeee] text-[#8a2626] border-[#e8c3c3]', dot: 'bg-[#c23838]' },
  sky:     { box: 'bg-[#eef4f8] text-[#1d4e73] border-[#c5d9e8]', dot: 'bg-[#2c74a8]' },
  slate:   { box: 'bg-[#f4f1ea] text-[#454038] border-[#d8d0c2]', dot: 'bg-[#787062]' },
  violet:  { box: 'bg-[#f5f0ea] text-[#5c4724] border-[#dccbb0]', dot: 'bg-[#8f6f38]' },
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({ tone = 'slate', children, className }) => (
  <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-[11px] font-medium whitespace-nowrap', tones[tone].box, className)}>
    <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', tones[tone].dot)} />
    {children}
  </span>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'amber' | 'dark'; size?: 'sm' | 'md' | 'lg' }> = ({ variant = 'ghost', size = 'md', className, ...p }) => (
  <button
    {...p}
    className={clsx(
      'inline-flex items-center justify-center gap-1.5 rounded-[5px] font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
      size === 'sm' ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-1.5 text-[13px]',
      variant === 'primary' && 'bg-[#143020] text-[#f7f4ec] hover:bg-[#1d442e] border border-[#143020]',
      variant === 'amber' && 'bg-[#9c7832] text-white hover:bg-[#846427] border border-[#846427]',
      variant === 'dark' && 'bg-[#1c1a17] text-white hover:bg-[#33302b]',
      variant === 'danger' && 'bg-white text-[#9e2a2a] border border-[#dfb8b8] hover:bg-[#fbeeee]',
      variant === 'ghost' && 'bg-white text-[#2b2720] border border-[#cfc7b8] hover:bg-[#f4f1ea]',
      className,
    )}
  />
);

export const inputCls = 'w-full rounded-[5px] border border-[#cfc7b8] bg-white px-3 py-1.5 text-sm text-[#1c1a17] focus:outline-none focus:border-[#143020] focus:ring-1 focus:ring-[#143020]';

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string; className?: string }> = ({ label, children, hint, className }) => (
  <label className={clsx('block', className)}>
    <span className="block text-[11px] font-semibold text-[#5c5549] mb-1 uppercase tracking-wider">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-[#857d6f] mt-0.5">{hint}</span>}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} {...p} className={clsx(inputCls, className)} />);
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...p }) => <select {...p} className={clsx(inputCls, className)} />;
export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...p }) => <textarea {...p} className={clsx(inputCls, className)} />;

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({ value, onChange, placeholder = 'Rechercher…', className }) => (
  <div className={clsx('relative', className)}>
    <Search className="w-3.5 h-3.5 text-[#7a7265] absolute left-3 top-1/2 -translate-y-1/2" />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={clsx(inputCls, 'pl-8')} />
  </div>
);

export const Modal: React.FC<{ open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ open, onClose, title, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#121c15]/60 p-3 sm:p-8 no-print" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={clsx('w-full bg-white rounded-md border border-[#c8bfa8] shadow-xl', w)}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5dfd3] bg-[#faf8f4]">
          <h2 className="font-serif-brand text-lg font-bold text-[#12241a]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#eae4d7] text-[#5c5549] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-[#e5dfd3] bg-[#faf8f4] rounded-b-md flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export const Stat: React.FC<{ label: string; value: string; sub?: React.ReactNode; icon?: React.ReactNode; tone?: 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'violet' }> = ({ label, value, sub, icon, tone = 'emerald' }) => {
  const accent = {
    emerald: 'border-t-2 border-t-[#143020]',
    amber: 'border-t-2 border-t-[#b08938]',
    rose: 'border-t-2 border-t-[#b83232]',
    sky: 'border-t-2 border-t-[#29638f]',
    slate: 'border-t-2 border-t-[#787062]',
    violet: 'border-t-2 border-t-[#8f6f38]',
  }[tone];
  return (
    <div className={clsx('bg-white rounded-md border border-[#dcd5c7] p-3.5 flex flex-col justify-between', accent)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6e6659]">{label}</span>
        {icon && <span className="text-[#8c8270] [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>}
      </div>
      <div className="font-mono-num text-lg font-bold text-[#12241a] truncate mt-1.5">{value}</div>
      {sub && <div className="text-[11px] text-[#6e6659] mt-1 pt-1 border-t border-[#f0ece3] truncate">{sub}</div>}
    </div>
  );
};

export const Empty: React.FC<{ icon?: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="py-10 text-center text-[#857d6f]">
    {icon && <div className="flex justify-center mb-2 opacity-50">{icon}</div>}
    <p className="text-xs uppercase tracking-wider font-medium">{text}</p>
  </div>
);

export const Tabs: React.FC<{ tabs: Array<{ id: string; label: string; count?: number }>; value: string; onChange: (id: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="inline-flex flex-wrap border border-[#cfc7b8] bg-[#f4f1ea] p-0.5 rounded-[5px]">
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} className={clsx('px-3 py-1 text-xs font-semibold rounded-[4px] cursor-pointer transition', value === t.id ? 'bg-[#143020] text-white' : 'text-[#524c42] hover:text-[#12241a]')}>
        {t.label}{t.count !== undefined && <span className="ml-1.5 font-mono-num text-[10px] opacity-75">({t.count})</span>}
      </button>
    ))}
  </div>
);

export const Table: React.FC<{ head: Array<string | { label: string; right?: boolean }>; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[13px] border-collapse">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-[#665e52] bg-[#faf8f4] border-y border-[#e2dcd0]">
          {head.map((h, i) => { const o = typeof h === 'string' ? { label: h, right: false } : h; return <th key={i} className={clsx('py-2 px-2.5 font-bold', o.right ? 'text-right' : 'text-left')}>{o.label}</th>; })}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#ece7dc]">{children}</tbody>
    </table>
  </div>
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean }> = ({ right, className, ...p }) => (
  <td {...p} className={clsx('py-2.5 px-2.5 align-middle text-[#24211d]', right && 'text-right font-mono-num', className)} />
);

export const Toast: React.FC<{ toast: { msg: string; kind: 'ok' | 'err' } | null }> = ({ toast }) => toast ? (
  <div className={clsx('fixed bottom-5 right-5 z-[60] px-4 py-2.5 rounded-md border text-xs font-semibold shadow-lg no-print', toast.kind === 'ok' ? 'bg-[#143020] text-[#f5f2eb] border-[#a68038]' : 'bg-[#7d1f1f] text-white border-[#dc8a8a]')}>
    {toast.msg}
  </div>
) : null;

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} className={clsx('px-3 py-1 rounded-[4px] text-xs font-medium border cursor-pointer transition whitespace-nowrap', active ? 'bg-[#143020] text-white border-[#143020]' : 'bg-white text-[#4a443b] border-[#cfc7b8] hover:border-[#143020]')}>
    {children}
  </button>
);
