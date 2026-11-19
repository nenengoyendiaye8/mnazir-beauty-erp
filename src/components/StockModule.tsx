import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Boxes, ClipboardCheck, Download, History, LayoutGrid, List, Minus, Package, Pencil, Plus, Printer, Sparkles, Tag, Trash2, Wallet,
} from 'lucide-react';
import { useErp } from '../store';
import type { Product, Variant } from '../types';
import {
  Badge, Btn, Card, Chip, Empty, Field, Input, Modal, PageHeader, SearchBox, Select, Stat, Table, Tabs, Td, Textarea,
} from './ui';
import { clsx, download, fdate, money, num, pct, productStock, sum, todayStr, toCSV, uid, variantLabel } from '../utils/helpers';
import { printLabels } from '../utils/print';

/* ============================== Helpers locaux ============================== */

const EMOJIS = ['MNS', 'MNP', 'MNG', 'DUO', 'TRI', 'COF', 'GOM', 'MAS', 'KAR', 'HUI', 'REV', 'EMB', 'ETQ', 'BIO'];
const SIZE_PRESETS = ['Pot 250g', 'Grand Pot 500g', 'Flacon 100 ml', '2 x 250g', '3 x 250g', 'Carton 5 Pots', 'Carton 10 Pots', 'Unique'];
const REASONS = ['Ajustement manuel', 'Casse / perte', 'Retour client', 'Don / échantillon', 'Correction d\'erreur', 'Retour fournisseur'];

type Status = 'rupture' | 'faible' | 'ok';
const statusOf = (p: Product): Status => {
  const s = productStock(p);
  return s <= 0 ? 'rupture' : s <= p.minStock ? 'faible' : 'ok';
};
const StatusBadge: React.FC<{ p: Product }> = ({ p }) => {
  const s = statusOf(p);
  return s === 'rupture' ? <Badge tone="rose">Rupture</Badge> : s === 'faible' ? <Badge tone="amber">Stock faible</Badge> : <Badge tone="emerald">En stock</Badge>;
};

const skuPrefix = (category: string, name: string) => {
  const c = category.toLowerCase();
  if (c.includes('homme')) return 'DJH';
  if (c.includes('femme')) return 'DJF';
  if (c.includes('kourouss')) return 'KOU';
  if (c.includes('kamil')) return 'KAM';
  if (c.includes('sidiada')) return 'SID';
  if (c.includes('access')) return 'ACC';
  const l = (name || category).replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
  return l.length === 3 ? l : 'BPB';
};
/** Génère un SKU unique (ex : DJH0123) en tenant compte d'un ensemble de SKU déjà pris. */
const nextSku = (prefix: string, taken: Set<string>) => {
  let max = 0;
  taken.forEach(s => { if (s.toUpperCase().startsWith(prefix)) { const n = parseInt(s.slice(prefix.length), 10); if (!isNaN(n) && n > max) max = n; } });
  let n = max + 1; let sku = prefix + String(n).padStart(4, '0');
  while (taken.has(sku.toLowerCase()) || taken.has(sku)) { n++; sku = prefix + String(n).padStart(4, '0'); }
  taken.add(sku); return sku;
};
const parseList = (s: string) => Array.from(new Set(s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)));

const NumInput: React.FC<{ value: number; onChange: (n: number) => void; min?: number; placeholder?: string; className?: string }> = ({ value, onChange, min = 0, placeholder = '0', className }) => (
  <Input type="number" inputMode="numeric" min={min} value={value ? value : ''} placeholder={placeholder} className={className}
    onChange={e => { const n = Number(e.target.value); onChange(isNaN(n) ? 0 : n); }} />
);

/* ============================== Formulaire modèle ============================== */

interface Draft {
  id?: string; name: string; category: string; material: string; origin: string; emoji: string; description: string;
  buyPrice: number; sellPrice: number; minStock: number; variants: Variant[]; createdAt?: string; imageUrl?: string;
}

const ProductForm: React.FC<{ product: Product | null; onClose: () => void }> = ({ product, onClose }) => {
  const { settings, products, addProduct, updateProduct, toast } = useErp();
  const originalIds = useMemo(() => new Set((product?.variants || []).map(v => v.id)), [product]);
  const [d, setD] = useState<Draft>(() => product
    ? { ...product, origin: product.origin || '', description: product.description || '', variants: product.variants.map(v => ({ ...v })) }
    : { name: '', category: settings.categories[0] || '', material: '', origin: '', emoji: 'MNS', description: '', buyPrice: 0, sellPrice: 0, minStock: 3, variants: [] });
  const [sizes, setSizes] = useState('');
  const [colors, setColors] = useState('');
  const [initStock, setInitStock] = useState(0);
  const [err, setErr] = useState('');

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const takenSkus = () => {
    const s = new Set<string>();
    products.forEach(p => { if (p.id !== d.id) p.variants.forEach(v => s.add(v.sku.toLowerCase())); });
    d.variants.forEach(v => v.sku && s.add(v.sku.toLowerCase()));
    return s;
  };
  const prefix = skuPrefix(d.category, d.name);

  const addRow = () => setD(p => ({ ...p, variants: [...p.variants, { id: uid('v'), size: '', color: '', stock: 0, sku: nextSku(prefix, takenSkus()) }] }));
  const upVar = (id: string, patch: Partial<Variant>) => setD(p => ({ ...p, variants: p.variants.map(v => (v.id === id ? { ...v, ...patch } : v)) }));
  const delVar = (id: string) => setD(p => ({ ...p, variants: p.variants.filter(v => v.id !== id) }));
  const addPreset = (s: string) => { const l = parseList(sizes); setSizes((l.includes(s) ? l.filter(x => x !== s) : [...l, s]).join(', ')); };

  const generate = () => {
    const sl = parseList(sizes), cl = parseList(colors);
    if (!sl.length || !cl.length) { toast('Indiquez au moins une taille et une couleur', 'err'); return; }
    const taken = takenSkus(); const add: Variant[] = [];
    sl.forEach(size => cl.forEach(color => {
      if (d.variants.some(v => v.size.toLowerCase() === size.toLowerCase() && v.color.toLowerCase() === color.toLowerCase())) return;
      add.push({ id: uid('v'), size, color, stock: Math.max(0, Math.floor(initStock)), sku: nextSku(prefix, taken) });
    }));
    if (!add.length) { toast('Toutes ces combinaisons existent déjà', 'err'); return; }
    setD(p => ({ ...p, variants: [...p.variants, ...add] }));
    toast(`${add.length} variante(s) générée(s)`);
  };

  const submit = () => {
    const name = d.name.trim();
    if (!name) return setErr('Le nom du modèle est obligatoire.');
    if (!d.category) return setErr('Choisissez une catégorie.');
    if (d.sellPrice <= 0) return setErr('Le prix de vente doit être supérieur à 0.');
    if (d.buyPrice < 0) return setErr('Le prix d\'achat est invalide.');
    if (!d.variants.length) return setErr('Ajoutez au moins une variante (taille / couleur).');
    const seenSku = new Set<string>(), seenCombo = new Set<string>();
    const others = new Set<string>(); products.forEach(p => { if (p.id !== d.id) p.variants.forEach(v => others.add(v.sku.toLowerCase())); });
    for (const v of d.variants) {
      const sku = v.sku.trim().toLowerCase();
      if (!sku) return setErr('Chaque variante doit avoir un SKU.');
      if (seenSku.has(sku) || others.has(sku)) return setErr(`SKU en double : ${v.sku}`);
      seenSku.add(sku);
      const combo = `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`;
      if (seenCombo.has(combo)) return setErr(`Variante en double : ${variantLabel(v.size, v.color) || '(vide)'}`);
      seenCombo.add(combo);
      if (v.stock < 0) return setErr('Le stock ne peut pas être négatif.');
    }
    try {
      const base = {
        name, category: d.category, material: d.material.trim(), origin: d.origin.trim() || undefined, emoji: d.emoji || '', imageUrl: d.imageUrl,
        description: d.description.trim() || undefined, buyPrice: d.buyPrice, sellPrice: d.sellPrice, minStock: d.minStock,
        variants: d.variants.map(v => ({ ...v, size: v.size.trim(), color: v.color.trim(), sku: v.sku.trim(), stock: Math.max(0, Math.floor(v.stock)) })),
      };
      if (product) { updateProduct({ ...base, id: product.id, createdAt: product.createdAt || todayStr() }); toast('Modèle mis à jour'); }
      else { addProduct(base); toast('Modèle ajouté au catalogue'); }
      onClose();
    } catch (e) { toast((e as Error).message || 'Erreur', 'err'); }
  };

  const margin = d.sellPrice - d.buyPrice;
  return (
    <Modal open onClose={onClose} size="xl" title={product ? `Modifier : ${product.name}` : 'Nouveau modèle'}
      footer={<>
        {err && <span className="mr-auto text-xs font-semibold text-rose-600 self-center">{err}</span>}
        <Btn onClick={onClose}>Annuler</Btn><Btn variant="primary" onClick={submit}>{product ? 'Enregistrer' : 'Ajouter le modèle'}</Btn>
      </>}>
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nom du modèle *" className="md:col-span-2"><Input value={d.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Djallaba brodée Prestige" autoFocus /></Field>
          <Field label="Catégorie *">
            <Select value={d.category} onChange={e => set('category', e.target.value)}>
              {!settings.categories.includes(d.category) && d.category && <option value={d.category}>{d.category}</option>}
              {settings.categories.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Tissu / matière"><Input value={d.material} onChange={e => set('material', e.target.value)} placeholder="Bazin riche, Coton, Soie…" /></Field>
          <Field label="Origine"><Input value={d.origin} onChange={e => set('origin', e.target.value)} placeholder="Mali, Sénégal, Dubaï…" /></Field>
          <Field label="Seuil d'alerte (stock total)"><NumInput value={d.minStock} onChange={n => set('minStock', n)} /></Field>
          <Field label="Prix d'achat (FCFA)"><NumInput value={d.buyPrice} onChange={n => set('buyPrice', n)} /></Field>
          <Field label="Prix de vente (FCFA) *"><NumInput value={d.sellPrice} onChange={n => set('sellPrice', n)} /></Field>
          <div className="rounded-[5px] bg-emerald-50 border border-emerald-100 px-3 py-2 flex flex-col justify-center">
            <span className="text-[11px] font-semibold uppercase text-emerald-700">Marge unitaire</span>
            <span className={clsx('font-extrabold', margin < 0 ? 'text-rose-600' : 'text-emerald-800')}>{money(margin)} <span className="text-xs font-semibold">({pct(margin, d.sellPrice)}%)</span></span>
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Pictogramme</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {EMOJIS.map(e => <button key={e} type="button" onClick={() => set('emoji', e)} className={clsx('w-9 h-9 rounded-lg text-xl border cursor-pointer', d.emoji === e ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50')}>{e}</button>)}
            <Input className="!w-20 text-center" value={d.emoji} maxLength={4} onChange={e => set('emoji', e.target.value)} />
          </div>
        </div>
        <Field label="Description"><Textarea rows={2} value={d.description} onChange={e => set('description', e.target.value)} placeholder="Détails, broderie, finitions…" /></Field>

        <Card title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" />Générer une matrice tailles × couleurs</span>} className="!bg-slate-50">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">{SIZE_PRESETS.map(s => <Chip key={s} active={parseList(sizes).includes(s)} onClick={() => addPreset(s)}>{s}</Chip>)}</div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Tailles (séparées par virgule)" className="md:col-span-1"><Input value={sizes} onChange={e => setSizes(e.target.value)} placeholder="M, L, XL" /></Field>
              <Field label="Couleurs (séparées par virgule)" className="md:col-span-2"><Input value={colors} onChange={e => setColors(e.target.value)} placeholder="Blanc, Bleu nuit, Noir" /></Field>
              <Field label="Stock initial / variante"><NumInput value={initStock} onChange={setInitStock} /></Field>
            </div>
            <Btn variant="amber" onClick={generate}><Sparkles className="w-4 h-4" />Générer les variantes</Btn>
          </div>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-slate-800">Variantes ({d.variants.length}) · stock total {num(sum(d.variants, v => v.stock))}</h4>
            <Btn size="sm" onClick={addRow}><Plus className="w-3.5 h-3.5" />Ajouter une variante</Btn>
          </div>
          {d.variants.length === 0 ? <Empty icon={<Tag className="w-8 h-8" />} text="Aucune variante : générez une matrice ou ajoutez une ligne." /> : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              <div className="hidden md:grid grid-cols-[1fr_1fr_90px_140px_36px] gap-2 text-[10px] uppercase font-semibold text-slate-400 px-1"><span>Taille</span><span>Couleur</span><span>Stock</span><span>SKU</span><span /></div>
              {d.variants.map(v => (
                <div key={v.id} className="grid grid-cols-2 md:grid-cols-[1fr_1fr_90px_140px_36px] gap-2 items-center">
                  <Input value={v.size} placeholder="Taille" onChange={e => upVar(v.id, { size: e.target.value })} />
                  <Input value={v.color} placeholder="Couleur" onChange={e => upVar(v.id, { color: e.target.value })} />
                  {originalIds.has(v.id)
                    ? <div className="px-3 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-lg text-center" title="Utilisez « Stock » pour ajuster (traçabilité)">{v.stock}</div>
                    : <NumInput value={v.stock} onChange={n => upVar(v.id, { stock: Math.max(0, Math.floor(n)) })} />}
                  <Input value={v.sku} placeholder="SKU" className="font-mono" onChange={e => upVar(v.id, { sku: e.target.value.toUpperCase().replace(/\s/g, '') })} />
                  <button type="button" onClick={() => delVar(v.id)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer justify-self-end" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
          {product && <p className="text-[11px] text-slate-400 mt-2">Le stock des variantes existantes se modifie via le bouton « Stock » (ajustement tracé) ou l'onglet Inventaire.</p>}
        </div>
      </div>
    </Modal>
  );
};

/* ============================== Ajustement rapide ============================== */

const AdjustModal: React.FC<{ productId: string; onClose: () => void }> = ({ productId, onClose }) => {
  const { products, adjustStock, toast } = useErp();
  const p = products.find(x => x.id === productId);
  const [reason, setReason] = useState(REASONS[0]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  if (!p) return null;

  const apply = (v: Variant, delta: number) => {
    if (!delta) return;
    if (v.stock + delta < 0) { toast(`Stock insuffisant (${v.stock} en stock)`, 'err'); return; }
    try { adjustStock(p.id, v.id, delta, reason); toast(`${p.name} (${variantLabel(v.size, v.color)}) : ${delta > 0 ? '+' : ''}${delta}`); } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={<span>{p.emoji} Ajuster le stock – {p.name}</span>} footer={<Btn variant="primary" onClick={onClose}>Terminer</Btn>}>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <Field label="Raison de l'ajustement"><Select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</Select></Field>
        <div className="flex items-end text-sm text-slate-600">Stock total : <b className="ml-1 text-slate-900">{productStock(p)}</b></div>
      </div>
      <div className="space-y-2">
        {p.variants.map(v => (
          <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-[5px] border border-slate-200 px-3 py-2">
            <div className="min-w-[140px] flex-1">
              <div className="text-sm font-semibold text-slate-800">{variantLabel(v.size, v.color) || '—'}</div>
              <div className="text-[11px] font-mono text-slate-400">{v.sku}</div>
            </div>
            <div className={clsx('text-lg font-extrabold w-12 text-center', v.stock <= 0 ? 'text-rose-600' : 'text-slate-900')}>{v.stock}</div>
            <div className="flex gap-1">
              {[-10, -1, 1, 10].map(n => <Btn key={n} size="sm" variant={n < 0 ? 'danger' : 'ghost'} onClick={() => apply(v, n)}>{n > 0 ? '+' : ''}{n}</Btn>)}
            </div>
            <div className="flex gap-1">
              <Input type="number" className="!w-20 !py-1" placeholder="±qté" value={custom[v.id] ?? ''} onChange={e => setCustom(c => ({ ...c, [v.id]: e.target.value }))} />
              <Btn size="sm" variant="primary" disabled={!Number(custom[v.id])} onClick={() => { apply(v, Math.trunc(Number(custom[v.id]))); setCustom(c => ({ ...c, [v.id]: '' })); }}>OK</Btn>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

/* ============================== Module principal ============================== */

export const StockModule: React.FC = () => {
  const { settings, products, stockMoves, deleteProduct, adjustStock, toast } = useErp();
  const [tab, setTab] = useState('catalogue');

  /* --- catalogue --- */
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Toutes');
  const [lowOnly, setLowOnly] = useState(false);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [editing, setEditing] = useState<Product | null | undefined>(undefined); // undefined = fermé, null = nouveau
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const matches = (p: Product, query: string) => {
    const s = query.trim().toLowerCase();
    return !s || [p.name, p.material, p.category, p.origin || ''].some(x => x.toLowerCase().includes(s)) || p.variants.some(v => v.sku.toLowerCase().includes(s) || v.color.toLowerCase().includes(s));
  };
  const filtered = useMemo(() => products.filter(p => (cat === 'Toutes' || p.category === cat) && matches(p, q) && (!lowOnly || statusOf(p) !== 'ok')), [products, cat, q, lowOnly]);

  const totals = useMemo(() => ({
    pieces: sum(products, productStock),
    cost: sum(products, p => productStock(p) * p.buyPrice),
    retail: sum(products, p => productStock(p) * p.sellPrice),
    low: products.filter(p => statusOf(p) === 'faible').length,
    out: products.filter(p => statusOf(p) === 'rupture').length,
  }), [products]);

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [['Modèle', 'Catégorie', 'Tissu', 'Taille', 'Couleur', 'SKU', 'Stock', 'Prix achat', 'Prix vente', 'Valeur stock (coût)', 'Valeur stock (vente)', 'Seuil alerte']];
    products.forEach(p => p.variants.forEach(v => rows.push([p.name, p.category, p.material, v.size, v.color, v.sku, v.stock, p.buyPrice, p.sellPrice, v.stock * p.buyPrice, v.stock * p.sellPrice, p.minStock])));
    download(`stock_${todayStr()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast('Export CSV du stock téléchargé');
  };

  const confirmDelete = () => {
    if (!deleting) return;
    try { deleteProduct(deleting.id); toast(`« ${deleting.name} » supprimé`); } catch (e) { toast((e as Error).message, 'err'); }
    setDeleting(null);
  };

  /* --- mouvements --- */
  const [mq, setMq] = useState('');
  const [mType, setMType] = useState('Tous');
  const [mDate, setMDate] = useState('');
  const [mLimit, setMLimit] = useState(100);
  const moveKind = (r: string) => (r.startsWith('Vente') ? 'Ventes' : r.startsWith('Réception') ? 'Réceptions' : r.startsWith('Inventaire') ? 'Inventaire' : r.startsWith('Annulation') ? 'Annulations' : r === 'Stock initial' ? 'Stock initial' : 'Ajustements');
  const moves = useMemo(() => stockMoves.filter(m => {
    const s = mq.trim().toLowerCase();
    return (!s || m.label.toLowerCase().includes(s) || m.reason.toLowerCase().includes(s) || m.user.toLowerCase().includes(s))
      && (mType === 'Tous' || moveKind(m.reason) === mType) && (!mDate || m.date === mDate);
  }), [stockMoves, mq, mType, mDate]);

  /* --- inventaire --- */
  const [iq, setIq] = useState('');
  const [icat, setIcat] = useState('Toutes');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [confirmInv, setConfirmInv] = useState(false);
  const invProducts = useMemo(() => products.filter(p => (icat === 'Toutes' || p.category === icat) && matches(p, iq)), [products, icat, iq]);
  const gaps = useMemo(() => products.flatMap(p => p.variants.flatMap(v => {
    const raw = counts[v.id]; if (raw === undefined || raw === '') return [];
    const c = Math.max(0, Math.floor(Number(raw))); if (isNaN(c) || c === v.stock) return [];
    return [{ p, v, counted: c, diff: c - v.stock }];
  })), [products, counts]);
  const applyInventory = () => {
    try {
      gaps.forEach(g => adjustStock(g.p.id, g.v.id, g.diff, 'Inventaire'));
      toast(`Inventaire appliqué : ${gaps.length} écart(s) corrigé(s)`);
      setCounts({});
    } catch (e) { toast((e as Error).message, 'err'); }
    setConfirmInv(false);
  };

  /* --- étiquettes --- */
  const [lq, setLq] = useState('');
  const [lcat, setLcat] = useState('Toutes');
  const [labels, setLabels] = useState<Record<string, number>>({});
  const lblProducts = useMemo(() => products.filter(p => (lcat === 'Toutes' || p.category === lcat) && matches(p, lq)), [products, lcat, lq]);
  const lblItems = useMemo(() => products.flatMap(p => p.variants.filter(v => (labels[v.id] || 0) > 0).map(v => ({ product: p, variant: v, copies: labels[v.id] }))), [products, labels]);
  const lblTotal = sum(lblItems, i => i.copies);
  const doPrint = () => {
    if (!lblItems.length) { toast('Sélectionnez au moins une variante', 'err'); return; }
    try { printLabels(lblItems, settings); } catch (e) { toast((e as Error).message, 'err'); }
  };

  const cats = ['Toutes', ...settings.categories];
  const CatChips: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-1.5">{cats.map(c => <Chip key={c} active={value === c} onClick={() => onChange(c)}>{c}</Chip>)}</div>
  );

  return (
    <div>
      <PageHeader title="Stock & Catalogue" subtitle={`${products.length} modèle(s) · ${num(totals.pieces)} pièces en stock`} icon={<Package className="w-5 h-5" />}
        actions={<>
          <Btn onClick={exportCsv}><Download className="w-4 h-4" />Export CSV</Btn>
          <Btn variant="primary" onClick={() => setEditing(null)}><Plus className="w-4 h-4" />Nouveau modèle</Btn>
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Pièces en stock" value={num(totals.pieces)} sub={`${products.length} modèle(s)`} icon={<Boxes className="w-5 h-5" />} />
        <Stat label="Valeur (coût)" value={money(totals.cost)} sub={`Valeur de vente : ${money(totals.retail)}`} icon={<Wallet className="w-5 h-5" />} tone="sky" />
        <Stat label="Marge potentielle" value={money(totals.retail - totals.cost)} sub={`${pct(totals.retail - totals.cost, totals.retail)}% du prix de vente`} icon={<Sparkles className="w-5 h-5" />} tone="violet" />
        <Stat label="Alertes" value={`${totals.low + totals.out}`} sub={`${totals.out} rupture(s) · ${totals.low} stock faible`} icon={<AlertTriangle className="w-5 h-5" />} tone={totals.out ? 'rose' : 'amber'} />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'catalogue', label: 'Catalogue', count: products.length }, { id: 'mouvements', label: 'Mouvements', count: stockMoves.length },
          { id: 'inventaire', label: 'Inventaire' }, { id: 'etiquettes', label: 'Étiquettes' },
        ]} />
      </div>

      {/* ============ CATALOGUE ============ */}
      {tab === 'catalogue' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox value={q} onChange={setQ} placeholder="Nom, tissu, SKU, couleur…" className="w-full sm:w-72" />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} className="accent-emerald-700" />Stock faible / rupture</label>
              <div className="ml-auto flex gap-1">
                <Btn size="sm" variant={view === 'grid' ? 'dark' : 'ghost'} onClick={() => setView('grid')}><LayoutGrid className="w-4 h-4" /></Btn>
                <Btn size="sm" variant={view === 'table' ? 'dark' : 'ghost'} onClick={() => setView('table')}><List className="w-4 h-4" /></Btn>
              </div>
            </div>
            <div className="mt-3"><CatChips value={cat} onChange={setCat} /></div>
          </Card>

          {filtered.length === 0 ? (
            <Card><Empty icon={<Package className="w-10 h-10" />} text={products.length ? 'Aucun modèle ne correspond à vos filtres.' : 'Votre catalogue est vide. Ajoutez votre premier modèle !'} /></Card>
          ) : view === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map(p => {
                const st = productStock(p); const m = p.sellPrice - p.buyPrice;
                return (
                  <div key={p.id} className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-14 h-14 rounded-[5px] bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : p.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 leading-tight truncate" title={p.name}>{p.name}</div>
                        <div className="text-xs text-slate-500 truncate">{p.category}{p.material ? ` · ${p.material}` : ''}</div>
                        <div className="mt-1.5"><StatusBadge p={p} /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-px bg-slate-100 border-y border-slate-100 text-center">
                      <div className="bg-white py-2"><div className="text-[10px] uppercase text-slate-400 font-semibold">Stock</div><div className={clsx('font-extrabold', st <= 0 ? 'text-rose-600' : 'text-slate-900')}>{st}</div></div>
                      <div className="bg-white py-2"><div className="text-[10px] uppercase text-slate-400 font-semibold">Valeur</div><div className="font-bold text-slate-800 text-sm">{num(st * p.buyPrice)}</div></div>
                      <div className="bg-white py-2"><div className="text-[10px] uppercase text-slate-400 font-semibold">Marge</div><div className={clsx('font-bold text-sm', m < 0 ? 'text-rose-600' : 'text-emerald-700')}>{pct(m, p.sellPrice)}%</div></div>
                    </div>
                    <div className="px-4 py-2 text-xs text-slate-500 flex justify-between"><span>Vente <b className="text-slate-800">{money(p.sellPrice)}</b></span><span>Marge <b className="text-emerald-700">{money(m)}</b></span></div>
                    <div className="px-4 pb-2 flex flex-wrap gap-1">
                      {p.variants.slice(0, 6).map(v => <span key={v.id} className={clsx('text-[10px] px-1.5 py-0.5 rounded border', v.stock <= 0 ? 'border-rose-200 text-rose-600 bg-rose-50' : 'border-slate-200 text-slate-600')}>{variantLabel(v.size, v.color)}: {v.stock}</span>)}
                      {p.variants.length > 6 && <span className="text-[10px] text-slate-400 px-1">+{p.variants.length - 6}</span>}
                    </div>
                    <div className="mt-auto p-3 pt-1 flex gap-2">
                      <Btn size="sm" className="flex-1" onClick={() => setAdjusting(p.id)}><Minus className="w-3 h-3" /><Plus className="w-3 h-3 -ml-1" />Stock</Btn>
                      <Btn size="sm" onClick={() => setEditing(p)} title="Modifier"><Pencil className="w-3.5 h-3.5" /></Btn>
                      <Btn size="sm" variant="danger" onClick={() => setDeleting(p)} title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card pad={false}>
              <div className="p-2">
                <Table head={['Modèle', 'Catégorie', 'Tissu', { label: 'Stock', right: true }, { label: 'Valeur stock', right: true }, { label: 'Marge', right: true }, 'Statut', '']}>
                  {filtered.map(p => {
                    const st = productStock(p); const m = p.sellPrice - p.buyPrice;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <Td><div className="flex items-center gap-2"><span className="text-xl">{p.emoji}</span><div><div className="font-semibold text-slate-800">{p.name}</div><div className="text-[11px] text-slate-400">{p.variants.length} variante(s)</div></div></div></Td>
                        <Td className="text-slate-600">{p.category}</Td>
                        <Td className="text-slate-600">{p.material || '—'}</Td>
                        <Td right className="font-bold">{st}</Td>
                        <Td right>{money(st * p.buyPrice)}</Td>
                        <Td right><span className={m < 0 ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-semibold'}>{money(m)}</span><div className="text-[11px] text-slate-400">{pct(m, p.sellPrice)}%</div></Td>
                        <Td><StatusBadge p={p} /></Td>
                        <Td right><div className="flex justify-end gap-1">
                          <Btn size="sm" onClick={() => setAdjusting(p.id)}>Stock</Btn>
                          <Btn size="sm" onClick={() => setEditing(p)}><Pencil className="w-3.5 h-3.5" /></Btn>
                          <Btn size="sm" variant="danger" onClick={() => setDeleting(p)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                        </div></Td>
                      </tr>
                    );
                  })}
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ============ MOUVEMENTS ============ */}
      {tab === 'mouvements' && (
        <Card title={<span className="flex items-center gap-2"><History className="w-4 h-4" />Journal des mouvements ({moves.length})</span>}
          right={<Btn size="sm" onClick={() => { download(`mouvements_${todayStr()}.csv`, toCSV([['Date', 'Heure', 'Article', 'Variation', 'Raison', 'Utilisateur'], ...moves.map(m => [fdate(m.date), m.time, m.label, m.delta, m.reason, m.user])]), 'text/csv;charset=utf-8'); toast('Journal exporté'); }}><Download className="w-3.5 h-3.5" />CSV</Btn>}>
          <div className="flex flex-wrap gap-3 mb-3">
            <SearchBox value={mq} onChange={v => { setMq(v); setMLimit(100); }} placeholder="Article, raison, utilisateur…" className="w-full sm:w-72" />
            <Select className="!w-44" value={mType} onChange={e => { setMType(e.target.value); setMLimit(100); }}>
              {['Tous', 'Ventes', 'Réceptions', 'Inventaire', 'Ajustements', 'Annulations', 'Stock initial'].map(t => <option key={t}>{t}</option>)}
            </Select>
            <Input type="date" className="!w-44" value={mDate} onChange={e => { setMDate(e.target.value); setMLimit(100); }} />
            {(mq || mDate || mType !== 'Tous') && <Btn size="sm" onClick={() => { setMq(''); setMDate(''); setMType('Tous'); }}>Réinitialiser</Btn>}
          </div>
          {moves.length === 0 ? <Empty icon={<History className="w-10 h-10" />} text="Aucun mouvement de stock trouvé." /> : (
            <>
              <Table head={['Date', 'Article', { label: 'Variation', right: true }, 'Raison', 'Par']}>
                {moves.slice(0, mLimit).map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-slate-600">{fdate(m.date)} <span className="text-slate-400 text-xs">{m.time}</span></Td>
                    <Td className="font-medium text-slate-800">{m.label}</Td>
                    <Td right><Badge tone={m.delta > 0 ? 'emerald' : 'rose'}>{m.delta > 0 ? '+' : ''}{m.delta}</Badge></Td>
                    <Td className="text-slate-600">{m.reason}</Td>
                    <Td className="text-slate-500 text-xs">{m.user}</Td>
                  </tr>
                ))}
              </Table>
              {moves.length > mLimit && <div className="text-center mt-3"><Btn size="sm" onClick={() => setMLimit(l => l + 200)}>Afficher plus ({moves.length - mLimit} restants)</Btn></div>}
            </>
          )}
        </Card>
      )}

      {/* ============ INVENTAIRE ============ */}
      {tab === 'inventaire' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox value={iq} onChange={setIq} placeholder="Rechercher un article…" className="w-full sm:w-72" />
              <div className="text-xs text-slate-500 flex-1 min-w-[200px]">Saisissez la quantité réellement comptée. Les variantes laissées vides sont ignorées.</div>
              <Btn onClick={() => setCounts({})} disabled={!Object.keys(counts).length}>Effacer la saisie</Btn>
              <Btn variant="primary" disabled={!gaps.length} onClick={() => setConfirmInv(true)}><ClipboardCheck className="w-4 h-4" />Appliquer ({gaps.length} écart{gaps.length > 1 ? 's' : ''})</Btn>
            </div>
            <div className="mt-3"><CatChips value={icat} onChange={setIcat} /></div>
          </Card>
          <Card pad={false}>
            <div className="p-2">
              {invProducts.length === 0 ? <Empty icon={<ClipboardCheck className="w-10 h-10" />} text="Aucun article à inventorier." /> : (
                <Table head={['Article', 'Variante', 'SKU', { label: 'Théorique', right: true }, { label: 'Compté', right: true }, { label: 'Écart', right: true }]}>
                  {invProducts.flatMap(p => p.variants.map(v => {
                    const raw = counts[v.id]; const has = raw !== undefined && raw !== '';
                    const c = has ? Math.max(0, Math.floor(Number(raw))) : null; const diff = c === null || isNaN(c) ? null : c - v.stock;
                    return (
                      <tr key={v.id} className={clsx(diff ? (diff < 0 ? 'bg-rose-50/50' : 'bg-emerald-50/50') : 'hover:bg-slate-50')}>
                        <Td className="font-medium text-slate-800">{p.emoji} {p.name}</Td>
                        <Td className="text-slate-600">{variantLabel(v.size, v.color) || '—'}</Td>
                        <Td className="font-mono text-xs text-slate-400">{v.sku}</Td>
                        <Td right className="font-bold">{v.stock}</Td>
                        <Td right><Input type="number" min={0} className="!w-24 !py-1 text-right ml-auto" value={raw ?? ''} placeholder="—" onChange={e => setCounts(s => ({ ...s, [v.id]: e.target.value }))} /></Td>
                        <Td right>{diff === null ? <span className="text-slate-300">—</span> : diff === 0 ? <Badge tone="slate">OK</Badge> : <Badge tone={diff < 0 ? 'rose' : 'emerald'}>{diff > 0 ? '+' : ''}{diff}</Badge>}</Td>
                      </tr>
                    );
                  }))}
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ============ ÉTIQUETTES ============ */}
      {tab === 'etiquettes' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox value={lq} onChange={setLq} placeholder="Rechercher un article…" className="w-full sm:w-72" />
              <Btn size="sm" onClick={() => setLabels(l => { const n = { ...l }; lblProducts.forEach(p => p.variants.forEach(v => { n[v.id] = n[v.id] || 1; })); return n; })}>Tout sélectionner</Btn>
              <Btn size="sm" onClick={() => setLabels(l => { const n = { ...l }; lblProducts.forEach(p => p.variants.forEach(v => { if (v.stock > 0) n[v.id] = v.stock; })); return n; })}>Copies = stock</Btn>
              <Btn size="sm" onClick={() => setLabels({})} disabled={!lblItems.length}>Vider</Btn>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-sm text-slate-600"><b>{lblTotal}</b> étiquette(s)</span>
                <Btn variant="primary" onClick={doPrint} disabled={!lblItems.length}><Printer className="w-4 h-4" />Imprimer</Btn>
              </div>
            </div>
            <div className="mt-3"><CatChips value={lcat} onChange={setLcat} /></div>
          </Card>
          <Card pad={false}>
            <div className="p-2">
              {lblProducts.length === 0 ? <Empty icon={<Tag className="w-10 h-10" />} text="Aucun article." /> : (
                <Table head={['', 'Article', 'Variante', 'SKU', { label: 'Stock', right: true }, { label: 'Copies', right: true }]}>
                  {lblProducts.flatMap(p => p.variants.map(v => {
                    const n = labels[v.id] || 0;
                    return (
                      <tr key={v.id} className={n > 0 ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}>
                        <Td><input type="checkbox" className="accent-emerald-700 w-4 h-4" checked={n > 0} onChange={e => setLabels(l => ({ ...l, [v.id]: e.target.checked ? 1 : 0 }))} /></Td>
                        <Td className="font-medium text-slate-800">{p.emoji} {p.name}</Td>
                        <Td className="text-slate-600">{variantLabel(v.size, v.color) || '—'}</Td>
                        <Td className="font-mono text-xs text-slate-400">{v.sku}</Td>
                        <Td right>{v.stock}</Td>
                        <Td right><Input type="number" min={0} className="!w-20 !py-1 text-right ml-auto" value={n || ''} placeholder="0" onChange={e => setLabels(l => ({ ...l, [v.id]: Math.max(0, Math.floor(Number(e.target.value)) || 0) }))} /></Td>
                      </tr>
                    );
                  }))}
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ============ MODALES ============ */}
      {editing !== undefined && <ProductForm product={editing} onClose={() => setEditing(undefined)} />}
      {adjusting && <AdjustModal productId={adjusting} onClose={() => setAdjusting(null)} />}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} size="sm" title="Supprimer le modèle ?"
        footer={<><Btn onClick={() => setDeleting(null)}>Annuler</Btn><Btn variant="danger" onClick={confirmDelete}><Trash2 className="w-4 h-4" />Supprimer</Btn></>}>
        {deleting && <p className="text-sm text-slate-600">Voulez-vous vraiment supprimer <b>{deleting.emoji} {deleting.name}</b> et ses {deleting.variants.length} variante(s) ({productStock(deleting)} pièces en stock) ? Cette action est irréversible.</p>}
      </Modal>

      <Modal open={confirmInv} onClose={() => setConfirmInv(false)} size="md" title="Appliquer l'inventaire ?"
        footer={<><Btn onClick={() => setConfirmInv(false)}>Annuler</Btn><Btn variant="primary" onClick={applyInventory}>Confirmer et corriger le stock</Btn></>}>
        <p className="text-sm text-slate-600 mb-3">Le stock sera corrigé pour {gaps.length} variante(s), avec la raison « Inventaire ».</p>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-sm">
          {gaps.map(g => (
            <div key={g.v.id} className="flex items-center justify-between py-1.5">
              <span>{g.p.name} <span className="text-slate-400">({variantLabel(g.v.size, g.v.color)})</span></span>
              <span className="whitespace-nowrap">{g.v.stock} → <b>{g.counted}</b> <Badge tone={g.diff < 0 ? 'rose' : 'emerald'}>{g.diff > 0 ? '+' : ''}{g.diff}</Badge></span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
