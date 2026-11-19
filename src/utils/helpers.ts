import type { Product, SaleItem, Sale } from '../types';

export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
export const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const todayStr = () => localDate();
export const nowTime = () => new Date().toTimeString().slice(0, 5);
export const addDays = (date: string, n: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); };

export const money = (n: number | undefined | null) => `${Math.round(n || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} FCFA`;
export const num = (n: number | undefined | null) => Math.round(n || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
export const fdate = (d?: string) => (d ? d.split('-').reverse().join('/') : '');
export const monthKey = (d: string) => d.slice(0, 7);
export const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + f(x), 0);
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const lineTotal = (i: SaleItem) => Math.max(0, i.quantity * i.unitPrice - (i.discount || 0));
export const lineProfit = (i: SaleItem) => lineTotal(i) - i.quantity * i.buyPrice;
export const saleProfit = (s: Sale) => (s.status === 'cancelled' || s.docType === 'proforma' ? 0 : sum(s.items, lineProfit) - s.discountGlobal);
export const productStock = (p: Product) => sum(p.variants, v => v.stock);
export const variantLabel = (size: string, color: string) => [size, color].filter(Boolean).join(' · ');
export const isLive = (s: Sale) => s.docType === 'sale' && s.status !== 'cancelled';

export const clsx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

export function download(name: string, content: string, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function toCSV(rows: Array<Array<string | number>>) {
  return '\ufeff' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
}

/** Imprime un document HTML complet dans un iframe caché. */
export function printHtml(html: string) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(html); d.close();
  setTimeout(() => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 2000); }, 300);
}

/** Lien WhatsApp (numéros sénégalais : ajoute +221 si absent). */
export function whatsappLink(phone: string, message: string) {
  let p = (phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  else if (p.length === 9) p = '221' + p;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}
export const openWhatsApp = (phone: string, message: string) => window.open(whatsappLink(phone, message), '_blank');

/** Code 39 → SVG (lisible par la plupart des lecteurs). */
const C39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
};
export function barcodeSvg(value: string, height = 40, narrow = 1.6): string {
  const text = `*${String(value).toUpperCase().replace(/[^0-9A-Z\-. ]/g, '-')}*`;
  let x = 0; let bars = '';
  for (const ch of text) {
    const pat = C39[ch] || C39['-'];
    for (let i = 0; i < 9; i++) {
      const w = (pat[i] === 'w' ? 3 : 1) * narrow;
      if (i % 2 === 0) bars += `<rect x="${x.toFixed(1)}" y="0" width="${w}" height="${height}" fill="#000"/>`;
      x += w;
    }
    x += narrow;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x.toFixed(0)}" height="${height}" viewBox="0 0 ${x.toFixed(1)} ${height}">${bars}</svg>`;
}
