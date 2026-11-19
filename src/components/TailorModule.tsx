import React, { useMemo, useState } from 'react';
import { Scissors, Plus, Pencil, Trash2, Printer, MessageCircle, Wallet, ChevronRight, ChevronLeft, Clock, User, Ruler, AlertTriangle, CheckCircle2, Package } from 'lucide-react';
import { useErp } from '../store';
import type { Measurements, PaymentMethod, TailorOrder } from '../types';
import { PAYMENT_METHODS } from '../types';
import { addDays, clsx, fdate, money, num, openWhatsApp, sum, todayStr } from '../utils/helpers';
import { printOrderSlip } from '../utils/print';
import { Badge, Btn, Card, Chip, Empty, Field, Input, Modal, PageHeader, SearchBox, Select, Stat, Textarea } from './ui';

type Status = TailorOrder['status'];
const FLOW: Status[] = ['a_couper', 'en_couture', 'finition', 'pret', 'livre'];
const COLS: Record<Status, { label: string; head: string; dot: string; next?: string }> = {
  a_couper: { label: 'À formuler', head: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', next: 'Lancer fabrication' },
  en_couture: { label: 'En fabrication', head: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500', next: 'Mise en pot & étiquettes' },
  finition: { label: 'Mise en pot & contrôle', head: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', next: 'Marquer prêt' },
  pret: { label: 'Prêt à livrer', head: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', next: 'Marquer livré' },
  livre: { label: 'Livré / En stock', head: 'bg-emerald-700 text-white', dot: 'bg-emerald-800' },
  annule: { label: 'Annulé', head: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};
const MEAS: Array<[keyof Measurements, string]> = [
  ['poitrine', 'Hydratation (%)'], ['taille', 'Éclat (%)'], ['epaules', 'Poids pot (g)'], ['longueurHaut', 'Douceur parfum (/5)'],
  ['longueurManche', 'Karité (g)'], ['tourDeCou', 'Jasmin / Miel (ml)'], ['hanches', 'pH cible'], ['longueurPantalon', 'Cure (jours)'],
];

interface Form {
  kind: 'sur_mesure' | 'retouche'; customerId: string; customerName: string; customerPhone: string; garment: string; fabric: string; color: string;
  quantity: string; meas: Record<string, string>; price: string; deposit: string; method: PaymentMethod; tailorId: string; orderDate: string; dueDate: string; status: Status; notes: string; saveMeas: boolean;
}
const emptyForm = (): Form => ({
  kind: 'sur_mesure', customerId: '', customerName: '', customerPhone: '', garment: '', fabric: '', color: '', quantity: '1', meas: {}, price: '', deposit: '', method: 'Espèces',
  tailorId: '', orderDate: todayStr(), dueDate: addDays(todayStr(), 7), status: 'a_couper', notes: '', saveMeas: false,
});
const measToStr = (m?: Measurements): Record<string, string> => Object.fromEntries(MEAS.map(([k]) => [k, m?.[k] !== undefined ? String(m[k]) : '']));
const strToMeas = (m: Record<string, string>): Measurements => {
  const o: Measurements = {};
  MEAS.forEach(([k]) => { const s = (m[k] || '').trim().replace(',', '.'); const v = Number(s); if (s && isFinite(v) && v > 0) o[k] = v; });
  return o;
};
const digits = (s: string) => (s || '').replace(/\D/g, '');
const daysTo = (d: string) => Math.round((new Date(d + 'T12:00:00').getTime() - new Date(todayStr() + 'T12:00:00').getTime()) / 864e5);
const rest = (o: TailorOrder) => Math.max(0, o.price - o.amountPaid);

export const TailorModule: React.FC = () => {
  const { orders, customers, staff, settings, addOrder, updateOrder, addOrderPayment, deleteOrder, updateCustomer, toast } = useErp();
  const [q, setQ] = useState('');
  const [fTailor, setFTailor] = useState('');
  const [fKind, setFKind] = useState<'' | 'sur_mesure' | 'retouche'>('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [pay, setPay] = useState<{ id: string; thenDeliver: boolean } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Espèces');
  const [delId, setDelId] = useState<string | null>(null);
  const [notifyId, setNotifyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const tailors = useMemo(() => staff.filter(s => s.role === 'Couturier'), [staff]);
  const tailorName = (id?: string) => (id ? staff.find(s => s.id === id)?.name : undefined);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter(o =>
      (!fTailor || (fTailor === '_none' ? !o.tailorId : o.tailorId === fTailor)) && (!fKind || o.kind === fKind) &&
      (!s || [o.number, o.customerName, o.customerPhone, o.garment, o.fabric, o.color].some(x => (x || '').toLowerCase().includes(s))));
  }, [orders, q, fTailor, fKind]);

  const active = orders.filter(o => o.status !== 'annule');
  const inProgress = active.filter(o => ['a_couper', 'en_couture', 'finition'].includes(o.status));
  const late = inProgress.filter(o => daysTo(o.dueDate) < 0);
  const ready = active.filter(o => o.status === 'pret');
  const toCollect = sum(active, rest);

  const columns: Status[] = showCancelled ? [...FLOW, 'annule'] : FLOW;
  const byCol = (st: Status) => filtered.filter(o => o.status === st).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const detail = orders.find(o => o.id === detailId) || null;
  const payO = orders.find(o => o.id === pay?.id) || null;
  const delO = orders.find(o => o.id === delId) || null;
  const notifyO = orders.find(o => o.id === notifyId) || null;

  /* ---------- Formulaire ---------- */
  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const openNew = () => { setForm(emptyForm()); setEditing({}); };
  const openEdit = (o: TailorOrder) => {
    setForm({
      kind: o.kind, customerId: o.customerId || '', customerName: o.customerName, customerPhone: o.customerPhone, garment: o.garment, fabric: o.fabric, color: o.color,
      quantity: String(o.quantity), meas: measToStr(o.measurements), price: String(o.price), deposit: '', method: 'Espèces', tailorId: o.tailorId || '',
      orderDate: o.orderDate, dueDate: o.dueDate, status: o.status, notes: o.notes || '', saveMeas: false,
    });
    setEditing({ id: o.id });
  };
  const pickCustomer = (id: string) => {
    const c = customers.find(x => x.id === id);
    if (!c) return setForm(f => ({ ...f, customerId: '' }));
    setForm(f => ({ ...f, customerId: c.id, customerName: c.fullName, customerPhone: c.phone, meas: c.measurements ? measToStr(c.measurements) : f.meas }));
  };
  const cur = editing?.id ? orders.find(o => o.id === editing.id) : undefined;

  const save = () => {
    const price = Math.round(Number(form.price)); const qty = Math.round(Number(form.quantity)); const dep = form.deposit.trim() ? Math.round(Number(form.deposit)) : 0;
    if (form.customerName.trim().length < 2) return toast('Le nom du client est obligatoire', 'err');
    if (digits(form.customerPhone).length < 8) return toast('Téléphone client invalide (8 chiffres minimum)', 'err');
    if (!form.garment.trim()) return toast('Le modèle / vêtement est obligatoire', 'err');
    if (!isFinite(qty) || qty < 1) return toast('Quantité invalide', 'err');
    if (!isFinite(price) || price <= 0) return toast('Le prix doit être supérieur à 0', 'err');
    if (!isFinite(dep) || dep < 0) return toast('Avance invalide', 'err');
    if (!form.orderDate || !form.dueDate) return toast('Dates obligatoires', 'err');
    if (form.dueDate < form.orderDate) return toast('L\'échéance ne peut pas précéder la date de commande', 'err');
    for (const [k, l] of MEAS) { const s = (form.meas[k] || '').trim().replace(',', '.'); if (s && (!isFinite(Number(s)) || Number(s) <= 0)) return toast(`Mesure invalide : ${l}`, 'err'); }
    const measurements = strToMeas(form.meas);
    try {
      if (cur) {
        if (price < cur.amountPaid) return toast(`Le prix ne peut pas être inférieur à l'avance déjà versée (${money(cur.amountPaid)})`, 'err');
        updateOrder({
          ...cur, kind: form.kind, customerId: form.customerId || undefined, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(), garment: form.garment.trim(),
          fabric: form.fabric.trim(), color: form.color.trim(), quantity: qty, measurements, price, tailorId: form.tailorId || undefined, orderDate: form.orderDate, dueDate: form.dueDate, status: form.status, notes: form.notes.trim() || undefined,
        });
        toast('Commande mise à jour');
      } else {
        if (dep > price) return toast('L\'avance dépasse le prix', 'err');
        const o = addOrder({
          kind: form.kind, customerId: form.customerId || undefined, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(), garment: form.garment.trim(),
          fabric: form.fabric.trim(), color: form.color.trim(), quantity: qty, measurements, price, tailorId: form.tailorId || undefined, orderDate: form.orderDate, dueDate: form.dueDate,
          status: 'a_couper', notes: form.notes.trim() || undefined, deposit: dep > 0 ? { amount: dep, method: form.method } : undefined,
        });
        toast(`Commande ${o.number} créée`);
      }
      if (form.saveMeas && form.customerId && Object.keys(measurements).length) {
        const c = customers.find(x => x.id === form.customerId); if (c) updateCustomer({ ...c, measurements });
      }
      setEditing(null);
    } catch (e) { toast((e as Error).message || 'Erreur lors de l\'enregistrement', 'err'); }
  };

  /* ---------- Statuts ---------- */
  const setStatus = (o: TailorOrder, status: Status) => {
    try { updateOrder({ ...o, status }); toast(`${o.number} → ${COLS[status].label}`); if (status === 'pret') setNotifyId(o.id); }
    catch (e) { toast((e as Error).message || 'Changement de statut impossible', 'err'); }
  };
  const advance = (o: TailorObjectLike) => {
    const i = FLOW.indexOf(o.status); if (i < 0 || i >= FLOW.length - 1) return;
    const nx = FLOW[i + 1];
    if (nx === 'livre' && rest(o) > 0) { setPayAmount(String(rest(o))); setPayMethod('Espèces'); setPay({ id: o.id, thenDeliver: true }); return; }
    setStatus(o, nx);
  };
  const back = (o: TailorOrder) => { const i = FLOW.indexOf(o.status); if (i > 0) setStatus(o, FLOW[i - 1]); };

  /* ---------- Paiement ---------- */
  const openPay = (o: TailorOrder) => { setPayAmount(String(rest(o))); setPayMethod('Espèces'); setPay({ id: o.id, thenDeliver: false }); };
  const doPay = () => {
    if (!payO || !pay) return;
    const a = Math.round(Number(payAmount)); const r = rest(payO);
    if (!isFinite(a) || a <= 0) return toast('Montant invalide', 'err');
    if (a > r) return toast(`Le montant dépasse le reste à payer (${money(r)})`, 'err');
    try {
      addOrderPayment(payO.id, { amount: a, method: payMethod });
      toast(`${money(a)} encaissé (${payMethod})`);
      if (pay.thenDeliver) { if (a >= r) updateOrder({ ...payO, status: 'livre', amountPaid: payO.amountPaid + a, payments: payO.payments }); }
      setPay(null);
    } catch (e) { toast((e as Error).message || 'Encaissement impossible', 'err'); }
  };
  const deliverAnyway = () => { if (!payO) return; setStatus(payO, 'livre'); setPay(null); };

  const confirmDelete = () => {
    if (!delO) return;
    try { deleteOrder(delO.id); toast('Commande supprimée'); setDelId(null); if (detailId === delO.id) setDetailId(null); }
    catch (e) { toast((e as Error).message || 'Suppression impossible', 'err'); }
  };
  const print = (o: TailorOrder) => { try { printOrderSlip(o, settings, tailorName(o.tailorId)); } catch { toast('Impression impossible', 'err'); } };
  const notifyMsg = (o: TailorOrder) => `Bonjour ${o.customerName.split(' ')[0]} \nBonne nouvelle : votre commande ${o.number} (${o.garment}) est prête ! Vous pouvez passer la retirer chez ${settings.name}${settings.openingHours ? ` (${settings.openingHours})` : ''}.${rest(o) > 0 ? ` Reste à payer : ${money(rest(o))}.` : ''}\nMerci de votre confiance `;
  const sendNotify = (o: TailorOrder) => { try { openWhatsApp(o.customerPhone, notifyMsg(o)); toast('WhatsApp ouvert'); setNotifyId(null); } catch { toast('Impossible d\'ouvrir WhatsApp', 'err'); } };

  /* ---------- Carte ---------- */
  const dueBadge = (o: TailorOrder) => {
    if (o.status === 'livre' || o.status === 'annule') return <span className="text-[11px] text-slate-500">{fdate(o.dueDate)}</span>;
    const d = daysTo(o.dueDate);
    if (o.status === 'pret') return <Badge tone="emerald"><Clock className="w-3 h-3" />{fdate(o.dueDate)}</Badge>;
    if (d < 0) return <Badge tone="rose"><AlertTriangle className="w-3 h-3" />En retard · {-d} j</Badge>;
    if (d === 0) return <Badge tone="amber"><Clock className="w-3 h-3" />Aujourd'hui</Badge>;
    return <Badge tone={d <= 2 ? 'amber' : 'slate'}><Clock className="w-3 h-3" />J-{d} · {fdate(o.dueDate)}</Badge>;
  };

  const Cardo = (o: TailorOrder) => {
    const r = rest(o); const isLate = ['a_couper', 'en_couture', 'finition'].includes(o.status) && daysTo(o.dueDate) < 0;
    return (
      <div key={o.id} className={clsx('bg-white rounded-[5px] border shadow-sm p-3 text-sm', isLate ? 'border-rose-300 ring-1 ring-rose-100' : 'border-slate-200')}>
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => setDetailId(o.id)} className="font-mono text-[11px] font-bold text-emerald-800 cursor-pointer hover:underline">{o.number}</button>
          <div className="flex gap-1">{o.kind === 'retouche' && <Badge tone="violet">Retouche</Badge>}{dueBadge(o)}</div>
        </div>
        <div className="font-bold text-slate-900 mt-1 leading-tight">{o.garment}{o.quantity > 1 && <span className="text-slate-500 font-semibold"> ×{o.quantity}</span>}</div>
        <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5"><User className="w-3 h-3" />{o.customerName}</div>
        {(o.fabric || o.color) && <div className="text-[11px] text-slate-500 mt-0.5"> {[o.fabric, o.color].filter(Boolean).join(' · ')}</div>}
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-slate-500 flex items-center gap-1"><Scissors className="w-3 h-3" />{tailorName(o.tailorId) || 'Non assigné'}</span>
          {o.status !== 'annule' && (r > 0 ? <span className="font-bold text-rose-600">Reste {money(r)}</span> : <span className="font-bold text-emerald-700 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Soldé</span>)}
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-2.5 pt-2 border-t border-slate-100">
          {FLOW.indexOf(o.status) >= 0 && FLOW.indexOf(o.status) < FLOW.length - 1 && (
            <Btn size="sm" variant="primary" className="flex-1" onClick={() => advance(o)}>{COLS[o.status].next}<ChevronRight className="w-3.5 h-3.5" /></Btn>
          )}
          {o.status === 'annule' && <Btn size="sm" className="flex-1" onClick={() => setStatus(o, 'a_couper')}>Réactiver</Btn>}
          {FLOW.indexOf(o.status) > 0 && <Btn size="sm" title="Étape précédente" onClick={() => back(o)}><ChevronLeft className="w-3.5 h-3.5" /></Btn>}
        </div>
        <div className="flex gap-1 mt-1.5">
          {r > 0 && o.status !== 'annule' && <Btn size="sm" title="Encaisser le solde" onClick={() => openPay(o)}><Wallet className="w-3.5 h-3.5 text-emerald-700" /></Btn>}
          {o.status === 'pret' && <Btn size="sm" title="Prévenir par WhatsApp" onClick={() => setNotifyId(o.id)}><MessageCircle className="w-3.5 h-3.5 text-emerald-700" /></Btn>}
          <Btn size="sm" title="Imprimer le bon" onClick={() => print(o)}><Printer className="w-3.5 h-3.5" /></Btn>
          <Btn size="sm" title="Modifier" onClick={() => openEdit(o)}><Pencil className="w-3.5 h-3.5" /></Btn>
          <Btn size="sm" variant="danger" title="Supprimer" className="ml-auto" onClick={() => setDelId(o.id)}><Trash2 className="w-3.5 h-3.5" /></Btn>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Atelier Cosmétique & Lots de Production" subtitle="Fabrication des lots de Savon Naturel 2 500 F, commandes grossistes & formules personnalisées" icon={<Scissors className="w-5 h-5" />}
        actions={<Btn variant="primary" onClick={openNew}><Plus className="w-4 h-4" /> Nouveau lot / commande</Btn>} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Stat label="En fabrication" value={String(inProgress.length)} icon={<Scissors className="w-5 h-5" />} tone="sky" sub="formulation · cure · mise en pot" />
        <Stat label="En retard" value={String(late.length)} icon={<AlertTriangle className="w-5 h-5" />} tone={late.length ? 'rose' : 'slate'} />
        <Stat label="Prêts à livrer" value={String(ready.length)} icon={<Package className="w-5 h-5" />} tone="emerald" />
        <Stat label="Valeur lots / commandes" value={money(sum(active, o => o.price))} icon={<Ruler className="w-5 h-5" />} tone="violet" sub={`${money(sum(active, o => o.amountPaid))} encaissé`} />
        <Stat label="Reste à encaisser" value={money(toCollect)} icon={<Wallet className="w-5 h-5" />} tone="amber" />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="N° lot, cliente, formule, ingrédient…" className="w-full sm:w-64" />
          <Select value={fTailor} onChange={e => setFTailor(e.target.value)} className="!w-auto">
            <option value="">Tous les formulateurs</option>{tailors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}<option value="_none">Non assigné</option>
          </Select>
          <div className="flex gap-1.5">
            <Chip active={fKind === ''} onClick={() => setFKind('')}>Tous types</Chip>
            <Chip active={fKind === 'sur_mesure'} onClick={() => setFKind('sur_mesure')}>Commande / Coffret</Chip>
            <Chip active={fKind === 'retouche'} onClick={() => setFKind('retouche')}>Lot Stock Boutique</Chip>
          </div>
          <Chip active={showCancelled} onClick={() => setShowCancelled(v => !v)}>Afficher annulés</Chip>
        </div>
      </Card>

      {orders.length === 0 ? (
        <Card><Empty icon={<Scissors className="w-10 h-10" />} text="Aucune commande sur mesure pour l'instant. Créez votre première commande !" /></Card>
      ) : (
        <div className={clsx('grid gap-3 grid-cols-1 sm:grid-cols-2 items-start', showCancelled ? 'xl:grid-cols-6' : 'xl:grid-cols-5')}>
          {columns.map(st => {
            const items = byCol(st); const shown = st === 'livre' ? items.slice(0, 20) : items;
            return (
              <div key={st} className="bg-slate-100/70 rounded-md p-2 min-w-0">
                <div className={clsx('flex items-center justify-between rounded-[5px] px-3 py-2 mb-2 text-xs font-extrabold uppercase tracking-wide', COLS[st].head)}>
                  <span className="flex items-center gap-2"><span className={clsx('w-2 h-2 rounded-full', COLS[st].dot)} />{COLS[st].label}</span>
                  <span className="bg-white/70 text-slate-800 rounded-full px-2 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {shown.length === 0 ? <div className="text-center text-[11px] text-slate-400 py-6">Aucune commande</div> : shown.map(Cardo)}
                  {items.length > shown.length && <div className="text-center text-[11px] text-slate-400">+ {items.length - shown.length} plus anciennes</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Formulaire ---- */}
      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={cur ? `Modifier ${cur.number}` : 'Nouvelle commande'}
        footer={<><Btn onClick={() => setEditing(null)}>Annuler</Btn><Btn variant="primary" onClick={save}>{cur ? 'Enregistrer' : 'Créer la commande'}</Btn></>}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Chip active={form.kind === 'sur_mesure'} onClick={() => setF('kind', 'sur_mesure')}> Commande Personnalisée / Revendeur</Chip>
            <Chip active={form.kind === 'retouche'} onClick={() => setF('kind', 'retouche')}> Lot Production Stock Boutique</Chip>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Cliente / Partenaire existant(e)" className="sm:col-span-3">
              <Select value={form.customerId} onChange={e => pickCustomer(e.target.value)}>
                <option value="">— Saisie libre (cliente ou lot interne) —</option>
                {[...customers].sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr')).map(c => <option key={c.id} value={c.id}>{c.fullName} · {c.phone}</option>)}
              </Select>
            </Field>
            <Field label="Nom cliente / Destinataire *" className="sm:col-span-2"><Input value={form.customerName} onChange={e => setF('customerName', e.target.value)} /></Field>
            <Field label="Téléphone *"><Input value={form.customerPhone} onChange={e => setF('customerPhone', e.target.value)} inputMode="tel" /></Field>
            <Field label="Produit / Lot à fabriquer *" className="sm:col-span-2"><Input value={form.garment} onChange={e => setF('garment', e.target.value)} placeholder="Ex : Lot 30 Pots Savon Naturel 2 500 F" /></Field>
            <Field label="Nombre de pots *"><Input type="number" min={1} value={form.quantity} onChange={e => setF('quantity', e.target.value)} /></Field>
            <Field label="Ingrédients clés"><Input value={form.fabric} onChange={e => setF('fabric', e.target.value)} placeholder="Karité, Jasmin, Miel…" /></Field>
            <Field label="Format / Emballage"><Input value={form.color} onChange={e => setF('color', e.target.value)} placeholder="Pot 250g Couvercle Or" /></Field>
            <Field label="Formulateur / Préparatrice">
              <Select value={form.tailorId} onChange={e => setF('tailorId', e.target.value)}>
                <option value="">— Non assigné —</option>
                {tailors.filter(t => t.active || t.id === form.tailorId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          </div>

          <div className="rounded-[5px] border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 mb-2"><Ruler className="w-4 h-4" /> Paramètres Formule & Diagnostic Peau</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {MEAS.map(([k, l]) => <Field key={k} label={l}><Input type="number" min={0} step="0.5" inputMode="decimal" value={form.meas[k] || ''} onChange={e => setForm(f => ({ ...f, meas: { ...f.meas, [k]: e.target.value } }))} /></Field>)}
            </div>
            {form.customerId && <label className="flex items-center gap-2 mt-2.5 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={form.saveMeas} onChange={e => setF('saveMeas', e.target.checked)} /> Enregistrer ce profil beauté dans la fiche de la cliente</label>}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Prix total (FCFA) *"><Input type="number" min={0} value={form.price} onChange={e => setF('price', e.target.value)} /></Field>
            {cur ? (
              <Field label="Déjà versé"><div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-semibold">{money(cur.amountPaid)}</div></Field>
            ) : (<>
              <Field label="Avance (FCFA)"><Input type="number" min={0} value={form.deposit} onChange={e => setF('deposit', e.target.value)} /></Field>
              <Field label="Mode de paiement"><Select value={form.method} onChange={e => setF('method', e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select></Field>
            </>)}
            <Field label="Date de commande"><Input type="date" value={form.orderDate} onChange={e => setF('orderDate', e.target.value)} /></Field>
            <Field label="Échéance / livraison *"><Input type="date" value={form.dueDate} min={form.orderDate} onChange={e => setF('dueDate', e.target.value)} /></Field>
            {cur && <Field label="Statut"><Select value={form.status} onChange={e => setF('status', e.target.value as Status)}>{(Object.keys(COLS) as Status[]).map(s => <option key={s} value={s}>{COLS[s].label}</option>)}</Select></Field>}
            <Field label="Notes" className="sm:col-span-3"><Textarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Broderies, finitions, remarques…" /></Field>
          </div>
        </div>
      </Modal>

      {/* ---- Détail ---- */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} size="md" title={detail ? `${detail.number} – ${detail.garment}` : ''}
        footer={detail && <><Btn onClick={() => print(detail)}><Printer className="w-4 h-4" /> Imprimer le bon</Btn><Btn onClick={() => { openEdit(detail); setDetailId(null); }}><Pencil className="w-4 h-4" /> Modifier</Btn><Btn onClick={() => setDetailId(null)}>Fermer</Btn></>}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2"><Badge tone="emerald">{COLS[detail.status].label}</Badge><Badge tone={detail.kind === 'retouche' ? 'violet' : 'sky'}>{detail.kind === 'retouche' ? 'Retouche' : 'Sur mesure'}</Badge>{dueBadge(detail)}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-500">Client</span><div className="font-semibold text-sm">{detail.customerName}</div><div>{detail.customerPhone}</div></div>
              <div><span className="text-slate-500">Couturier</span><div className="font-semibold text-sm">{tailorName(detail.tailorId) || 'Non assigné'}</div></div>
              <div><span className="text-slate-500">Tissu / couleur</span><div className="font-semibold text-sm">{[detail.fabric, detail.color].filter(Boolean).join(' · ') || '—'}</div></div>
              <div><span className="text-slate-500">Dates</span><div className="font-semibold text-sm">{fdate(detail.orderDate)} → {fdate(detail.dueDate)}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-2"><Stat label="Prix" value={money(detail.price)} tone="slate" /><Stat label="Versé" value={money(detail.amountPaid)} /><Stat label="Reste" value={money(rest(detail))} tone={rest(detail) > 0 ? 'rose' : 'slate'} /></div>
            {MEAS.some(([k]) => detail.measurements?.[k]) && <div className="grid grid-cols-4 gap-1.5">{MEAS.filter(([k]) => detail.measurements?.[k]).map(([k, l]) => <div key={k} className="rounded-lg bg-slate-50 px-2 py-1.5"><div className="text-[9px] uppercase text-slate-500 font-semibold">{l}</div><div className="font-bold">{detail.measurements?.[k]}</div></div>)}</div>}
            {detail.payments.length > 0 && <div className="text-xs text-slate-600"><b>Paiements :</b> {detail.payments.map(p => `${fdate(p.date)} ${money(p.amount)} (${p.method})`).join(' · ')}</div>}
            {detail.notes && <div className="text-xs bg-amber-50 text-amber-900 rounded-lg p-2"> {detail.notes}</div>}
            <div className="text-[11px] text-slate-400">Quantité : {num(detail.quantity)}</div>
          </div>
        )}
      </Modal>

      {/* ---- Encaissement ---- */}
      <Modal open={!!payO} onClose={() => setPay(null)} size="sm" title={`Encaisser – ${payO?.number || ''}`}
        footer={<><Btn onClick={() => setPay(null)}>Annuler</Btn>{pay?.thenDeliver && <Btn onClick={deliverAnyway}>Livrer sans encaisser</Btn>}<Btn variant="primary" onClick={doPay}>{pay?.thenDeliver ? 'Encaisser & livrer' : 'Encaisser'}</Btn></>}>
        {payO && (
          <div className="space-y-3">
            <div className="rounded-[5px] bg-amber-50 text-amber-900 p-3 text-sm">{pay?.thenDeliver && <div className="text-xs mb-1">Un solde reste dû avant la livraison.</div>}Client : <b>{payO.customerName}</b><br />Reste à payer : <b>{money(rest(payO))}</b></div>
            <Field label="Montant (FCFA)"><Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus /></Field>
            <Field label="Mode de paiement"><Select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select></Field>
          </div>
        )}
      </Modal>

      {/* ---- Notification prêt ---- */}
      <Modal open={!!notifyO} onClose={() => setNotifyId(null)} size="sm" title="Commande prête "
        footer={<><Btn onClick={() => setNotifyId(null)}>Plus tard</Btn><Btn variant="primary" onClick={() => notifyO && sendNotify(notifyO)}><MessageCircle className="w-4 h-4" /> Prévenir le client</Btn></>}>
        {notifyO && <div className="text-sm space-y-2"><p>La commande <b>{notifyO.number}</b> de <b>{notifyO.customerName}</b> est prête. Envoyer un message WhatsApp ?</p><pre className="whitespace-pre-wrap text-xs bg-slate-50 rounded-lg p-3 text-slate-600 font-sans">{notifyMsg(notifyO)}</pre></div>}
      </Modal>

      {/* ---- Suppression ---- */}
      <Modal open={!!delO} onClose={() => setDelId(null)} size="sm" title="Supprimer la commande ?"
        footer={<><Btn onClick={() => setDelId(null)}>Annuler</Btn><Btn variant="danger" onClick={confirmDelete}><Trash2 className="w-4 h-4" /> Supprimer</Btn></>}>
        {delO && <div className="text-sm space-y-2"><p>Supprimer définitivement <b>{delO.number}</b> ({delO.garment} – {delO.customerName}) ?</p>{delO.amountPaid > 0 && <p className="rounded-lg bg-rose-50 text-rose-700 p-2 text-xs"> {money(delO.amountPaid)} ont déjà été encaissés sur cette commande. Pensez plutôt à l'annuler si vous devez conserver la trace.</p>}</div>}
      </Modal>
    </div>
  );
};

type TailorObjectLike = TailorOrder;
