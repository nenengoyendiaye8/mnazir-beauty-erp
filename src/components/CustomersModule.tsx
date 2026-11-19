import React, { useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Eye, MessageCircle, Download, Phone, Mail, MapPin, Gift, Wallet, Ruler, Scissors, ShoppingBag, Star, Coins } from 'lucide-react';
import { useErp } from '../store';
import type { Customer, Measurements, PaymentMethod } from '../types';
import { PAYMENT_METHODS } from '../types';
import { clsx, download, fdate, money, num, openWhatsApp, sum, toCSV, todayStr } from '../utils/helpers';
import { Badge, Btn, Card, Chip, Empty, Field, Input, Modal, PageHeader, SearchBox, Select, Stat, Table, Td, Textarea } from './ui';

const MEAS: Array<[keyof Measurements, string]> = [
  ['poitrine', 'Hydratation (%)'], ['taille', 'Éclat (%)'], ['epaules', 'Poids pot (g)'], ['longueurHaut', 'Douceur parfum (/5)'],
  ['longueurManche', 'Karité (g)'], ['tourDeCou', 'Jasmin / Miel (ml)'], ['hanches', 'pH cible'], ['longueurPantalon', 'Cure (jours)'],
];

interface Form { fullName: string; phone: string; address: string; email: string; notes: string; meas: Record<string, string> }
const emptyForm = (): Form => ({ fullName: '', phone: '', address: '', email: '', notes: '', meas: {} });
const toForm = (c: Customer): Form => ({
  fullName: c.fullName, phone: c.phone, address: c.address || '', email: c.email || '', notes: c.notes || '',
  meas: Object.fromEntries(MEAS.map(([k]) => [k, c.measurements?.[k] !== undefined ? String(c.measurements[k]) : ''])),
});
const digits = (s: string) => (s || '').replace(/\D/g, '');
const parseMeas = (m: Record<string, string>): Measurements | undefined => {
  const out: Measurements = {};
  MEAS.forEach(([k]) => { const v = Number((m[k] || '').replace(',', '.')); if ((m[k] || '').trim() !== '' && isFinite(v) && v > 0) out[k] = v; });
  return Object.keys(out).length ? out : undefined;
};

type SortKey = 'recent' | 'top' | 'debt' | 'points' | 'name';
type TplId = 'promo' | 'relance' | 'tabaski' | 'korite' | 'ramadan' | 'pret' | 'libre';
const TPLS: Array<{ id: TplId; label: string }> = [
  { id: 'promo', label: ' Promo' }, { id: 'relance', label: ' Relance paiement' }, { id: 'tabaski', label: ' Tabaski' },
  { id: 'korite', label: ' Korité' }, { id: 'ramadan', label: ' Ramadan' }, { id: 'pret', label: ' Commande prête' }, { id: 'libre', label: ' Message libre' },
];

export const CustomersModule: React.FC = () => {
  const { customers, sales, orders, settings, addCustomer, updateCustomer, deleteCustomer, collectCustomerDebt, toast } = useErp();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [collectId, setCollectId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Espèces');
  const [waId, setWaId] = useState<string | null>(null);
  const [tpl, setTpl] = useState<TplId>('promo');
  const [waText, setWaText] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const d = digits(q);
    let r = customers.filter(c => !s || c.fullName.toLowerCase().includes(s) || (d.length >= 3 && digits(c.phone).includes(d)) || (c.address || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s));
    if (onlyDebt) r = r.filter(c => c.creditBalance > 0);
    const cmp: Record<SortKey, (a: Customer, b: Customer) => number> = {
      recent: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
      top: (a, b) => b.totalSpent - a.totalSpent,
      debt: (a, b) => b.creditBalance - a.creditBalance,
      points: (a, b) => b.loyaltyPoints - a.loyaltyPoints,
      name: (a, b) => a.fullName.localeCompare(b.fullName, 'fr'),
    };
    return [...r].sort(cmp[sort]);
  }, [customers, q, sort, onlyDebt]);

  const totalPoints = sum(customers, c => c.loyaltyPoints);
  const debtors = customers.filter(c => c.creditBalance > 0).length;
  const detail = customers.find(c => c.id === detailId) || null;
  const collectC = customers.find(c => c.id === collectId) || null;
  const waC = customers.find(c => c.id === waId) || null;
  const delC = customers.find(c => c.id === delId) || null;

  /* ---------- CRUD ---------- */
  const openNew = () => { setForm(emptyForm()); setEditing({}); };
  const openEdit = (c: Customer) => { setForm(toForm(c)); setEditing({ id: c.id }); };
  const setF = (k: keyof Omit<Form, 'meas'>, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setM = (k: string, v: string) => setForm(f => ({ ...f, meas: { ...f.meas, [k]: v } }));

  const save = () => {
    const name = form.fullName.trim();
    if (name.length < 2) return toast('Le nom du client est obligatoire', 'err');
    if (digits(form.phone).length < 8) return toast('Téléphone invalide (8 chiffres minimum)', 'err');
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) return toast('Adresse e-mail invalide', 'err');
    for (const [k, l] of MEAS) { const v = (form.meas[k] || '').trim(); if (v && (!isFinite(Number(v.replace(',', '.'))) || Number(v.replace(',', '.')) <= 0)) return toast(`Mesure invalide : ${l}`, 'err'); }
    if (customers.some(c => c.id !== editing?.id && digits(c.phone) === digits(form.phone))) return toast('Un client avec ce numéro existe déjà', 'err');
    try {
      const base = { fullName: name, phone: form.phone.trim(), address: form.address.trim(), email: form.email.trim() || undefined, notes: form.notes.trim() || undefined, measurements: parseMeas(form.meas) };
      if (editing?.id) {
        const cur = customers.find(c => c.id === editing.id); if (!cur) return toast('Client introuvable', 'err');
        updateCustomer({ ...cur, ...base }); toast('Client mis à jour');
      } else { addCustomer(base); toast('Client ajouté'); }
      setEditing(null);
    } catch (e) { toast((e as Error).message || 'Erreur lors de l\'enregistrement', 'err'); }
  };

  const confirmDelete = () => {
    if (!delC) return;
    try { deleteCustomer(delC.id); toast('Client supprimé'); if (detailId === delC.id) setDetailId(null); setDelId(null); }
    catch (e) { toast((e as Error).message || 'Suppression impossible', 'err'); }
  };

  /* ---------- Encaissement ---------- */
  const salesDebt = (id: string) => sum(sales.filter(s => s.customerId === id && s.docType === 'sale' && s.status !== 'cancelled'), s => s.amountRemaining);
  const openCollect = (c: Customer) => { setPayAmount(String(salesDebt(c.id) || '')); setPayMethod('Espèces'); setCollectId(c.id); };
  const doCollect = () => {
    if (!collectC) return;
    const max = salesDebt(collectC.id); const a = Math.round(Number(payAmount));
    if (!isFinite(a) || a <= 0) return toast('Montant invalide', 'err');
    if (a > max) return toast(`Le montant dépasse la dette sur factures (${money(max)})`, 'err');
    try { collectCustomerDebt(collectC.id, { amount: a, method: payMethod }); toast(`${money(a)} encaissé (${payMethod})`); setCollectId(null); }
    catch (e) { toast((e as Error).message || 'Encaissement impossible', 'err'); }
  };

  /* ---------- WhatsApp ---------- */
  const buildMsg = (t: TplId, c: Customer): string => {
    const shop = settings.name || 'M.Nazir_Beauty'; const first = c.fullName.split(' ')[0];
    const sign = `\n\n *${shop}* — Savon Naturel 100% (2 500 F)\n Contact : ${settings.phones?.[0] || '78 661 34 53'}\n_« Votre beauté, notre priorité »_`;
    const ready = orders.filter(o => o.customerId === c.id && o.status === 'pret').map(o => `${o.number} (${o.garment})`).join(', ');
    switch (t) {
      case 'promo': return `Bonjour ${first} \nNos nouveaux pots de *Savon Naturel M.Nazir_Beauty (2 500 F)* sont disponibles ! Nettoie en profondeur, nourrit, adoucit et hydrate tous les types de peau . Souhaitez-vous réserver votre pot ou votre Pack Duo ?${sign}`;
      case 'relance': return `Bonjour ${first},\nNous vous rappelons gentiment qu'un solde de ${money(c.creditBalance)} reste à régler chez ${shop}. Vous pouvez régler par Wave, Orange Money ou en espèces. Merci pour votre confiance ${sign}`;
      case 'tabaski': return `Bonjour ${first} \nÀ l'approche de la Tabaski, préparez votre peau avec notre *Savon Naturel & Coffret Éclat* chez ${shop}. Tabaski Mubarak à vous et à votre famille ! ${sign}`;
      case 'korite': return `Bonjour ${first} \nÀ l'occasion de la Korité, toute l'équipe de ${shop} vous souhaite une excellente fête ! Sublimez votre éclat naturel avec nos soins 100% naturels ${sign}`;
      case 'ramadan': return `Ramadan Mubarak ${first} \nPrenez soin de l'hydratation et de la douceur de votre peau pendant ce mois béni avec ${shop}.${sign}`;
      case 'pret': return `Bonjour ${first} \nBonne nouvelle : votre commande ${ready || 'Savon Naturel M.Nazir_Beauty'} est prête ! Nous pouvons vous la livrer ou vous pouvez passer la récupérer.${sign}`;
      default: return `Bonjour ${first},\n`;
    }
  };
  const openWa = (c: Customer, t: TplId = c.creditBalance > 0 ? 'relance' : 'promo') => { setWaId(c.id); setTpl(t); setWaText(buildMsg(t, c)); };
  const pickTpl = (t: TplId) => { if (!waC) return; setTpl(t); setWaText(buildMsg(t, waC)); };
  const sendWa = () => {
    if (!waC) return;
    if (digits(waC.phone).length < 8) return toast('Numéro de téléphone invalide', 'err');
    if (!waText.trim()) return toast('Message vide', 'err');
    try { openWhatsApp(waC.phone, waText); toast('WhatsApp ouvert'); setWaId(null); } catch { toast('Impossible d\'ouvrir WhatsApp', 'err'); }
  };

  /* ---------- Export ---------- */
  const exportCsv = () => {
    if (!list.length) return toast('Aucun client à exporter', 'err');
    const rows: Array<Array<string | number>> = [['Nom', 'Téléphone', 'Adresse', 'E-mail', 'Total achats (FCFA)', 'Solde dû (FCFA)', 'Points', 'Valeur points (FCFA)', ...MEAS.map(m => m[1] + ' (cm)'), 'Notes', 'Inscrit le']];
    list.forEach(c => rows.push([c.fullName, c.phone, c.address || '', c.email || '', Math.round(c.totalSpent), Math.round(c.creditBalance), c.loyaltyPoints, c.loyaltyPoints * settings.loyaltyValuePoint, ...MEAS.map(([k]) => c.measurements?.[k] ?? ''), c.notes || '', fdate(c.createdAt)]));
    download(`clients_${todayStr()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast(`${list.length} clients exportés`);
  };

  const rankOf = (c: Customer) => { const i = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).findIndex(x => x.id === c.id); return i; };
  const tier = (c: Customer) => (c.totalSpent >= 500000 ? <Badge tone="violet">VIP</Badge> : c.totalSpent >= 150000 ? <Badge tone="amber">Fidèle</Badge> : null);

  return (
    <div>
      <PageHeader
        title="Clients & Fidélité" subtitle="Fichier clients, mesures, créances et programme de fidélité" icon={<Users className="w-5 h-5" />}
        actions={<><Btn onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</Btn><Btn variant="primary" onClick={openNew}><Plus className="w-4 h-4" /> Nouveau client</Btn></>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Clients" value={num(customers.length)} icon={<Users className="w-5 h-5" />} sub={`${num(customers.filter(c => c.totalSpent > 0).length)} ont déjà acheté`} />
        <Stat label="CA clients" value={money(sum(customers, c => c.totalSpent))} icon={<ShoppingBag className="w-5 h-5" />} tone="sky" />
        <Stat label="Créances" value={money(sum(customers, c => c.creditBalance))} icon={<Wallet className="w-5 h-5" />} tone="rose" sub={`${debtors} débiteur${debtors > 1 ? 's' : ''}`} />
        <Stat label="Points fidélité" value={num(totalPoints)} icon={<Gift className="w-5 h-5" />} tone="amber" sub={`≈ ${money(totalPoints * settings.loyaltyValuePoint)}`} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={q} onChange={setQ} placeholder="Nom, téléphone, adresse…" className="w-full sm:w-72" />
          <Select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="!w-auto">
            <option value="recent">Plus récents</option><option value="top">Plus gros acheteurs</option><option value="debt">Plus gros débiteurs</option>
            <option value="points">Plus de points</option><option value="name">Nom (A → Z)</option>
          </Select>
          <Chip active={onlyDebt} onClick={() => setOnlyDebt(v => !v)}> Débiteurs uniquement</Chip>
          <span className="ml-auto text-xs text-slate-500">{list.length} résultat{list.length > 1 ? 's' : ''}</span>
        </div>
      </Card>

      <Card pad={false}>
        {list.length === 0 ? <Empty icon={<Users className="w-10 h-10" />} text={customers.length ? 'Aucun client ne correspond à la recherche.' : 'Aucun client enregistré. Ajoutez votre premier client !'} /> : (
          <div className="p-3">
            <Table head={['Client', 'Contact', { label: 'Achats', right: true }, { label: 'Solde dû', right: true }, { label: 'Points', right: true }, { label: 'Actions', right: true }]}>
              {list.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <Td>
                    <button className="flex items-center gap-2.5 text-left cursor-pointer" onClick={() => setDetailId(c.id)}>
                      <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center shrink-0">{c.fullName.trim().charAt(0).toUpperCase() || '?'}</span>
                      <span><span className="block font-semibold text-slate-900 leading-tight">{c.fullName}</span><span className="flex gap-1 mt-0.5">{tier(c)}{c.measurements && <Badge tone="sky"><Ruler className="w-3 h-3" />Mesures</Badge>}</span></span>
                    </button>
                  </Td>
                  <Td className="text-slate-600 text-xs"><div>{c.phone}</div><div className="text-slate-400 truncate max-w-[180px]">{c.address}</div></Td>
                  <Td right className="font-semibold">{money(c.totalSpent)}</Td>
                  <Td right>{c.creditBalance > 0 ? <Badge tone="rose">{money(c.creditBalance)}</Badge> : <span className="text-slate-300">—</span>}</Td>
                  <Td right><span className="font-semibold text-amber-700">{num(c.loyaltyPoints)}</span></Td>
                  <Td right>
                    <div className="flex justify-end gap-1">
                      <Btn size="sm" title="Fiche" onClick={() => setDetailId(c.id)}><Eye className="w-3.5 h-3.5" /></Btn>
                      <Btn size="sm" title="WhatsApp" className="!text-emerald-700" onClick={() => openWa(c)}><MessageCircle className="w-3.5 h-3.5" /></Btn>
                      <Btn size="sm" title="Modifier" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Btn>
                      <Btn size="sm" variant="danger" title="Supprimer" onClick={() => setDelId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      {/* ---- Formulaire ---- */}
      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" title={editing?.id ? 'Modifier le client' : 'Nouveau client'}
        footer={<><Btn onClick={() => setEditing(null)}>Annuler</Btn><Btn variant="primary" onClick={save}>{editing?.id ? 'Enregistrer' : 'Ajouter le client'}</Btn></>}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nom complet *"><Input value={form.fullName} onChange={e => setF('fullName', e.target.value)} placeholder="Ex : Awa Diop" autoFocus /></Field>
          <Field label="Téléphone *"><Input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="77 123 45 67" inputMode="tel" /></Field>
          <Field label="Adresse"><Input value={form.address} onChange={e => setF('address', e.target.value)} placeholder="Quartier, ville" /></Field>
          <Field label="E-mail"><Input value={form.email} onChange={e => setF('email', e.target.value)} placeholder="client@exemple.com" type="email" /></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Préférences, remarques…" /></Field>
        </div>
        <div className="mt-4 rounded-[5px] border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-900 mb-2"><Ruler className="w-4 h-4" /> Mesures (cm) <span className="text-[11px] font-normal text-slate-500">– utilisées pour les commandes sur mesure</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {MEAS.map(([k, l]) => <Field key={k} label={l}><Input type="number" min={0} step="0.5" inputMode="decimal" value={form.meas[k] || ''} onChange={e => setM(k, e.target.value)} placeholder="cm" /></Field>)}
          </div>
        </div>
      </Modal>

      {/* ---- Fiche détaillée ---- */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} size="xl" title={detail ? <span className="flex items-center gap-2">{detail.fullName} {tier(detail)}</span> : ''}
        footer={detail && <><Btn onClick={() => openWa(detail)}><MessageCircle className="w-4 h-4 text-emerald-700" /> WhatsApp</Btn><Btn onClick={() => { openEdit(detail); setDetailId(null); }}><Pencil className="w-4 h-4" /> Modifier</Btn><Btn onClick={() => setDetailId(null)}>Fermer</Btn></>}>
        {detail && (() => {
          const cs = sales.filter(s => s.customerId === detail.id && s.docType === 'sale').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
          const co = orders.filter(o => o.customerId === detail.id).sort((a, b) => b.orderDate.localeCompare(a.orderDate));
          const sd = salesDebt(detail.id);
          const od = sum(co.filter(o => o.status !== 'annule'), o => Math.max(0, o.price - o.amountPaid));
          const rk = rankOf(detail);
          return (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 rounded-[5px] border border-slate-200 p-4 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{detail.phone}</div>
                  {detail.address && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" />{detail.address}</div>}
                  {detail.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{detail.email}</div>}
                  <div className="text-xs text-slate-500">Client depuis le {fdate(detail.createdAt)}{detail.totalSpent > 0 && rk >= 0 ? ` · n°${rk + 1} des acheteurs` : ''}</div>
                  {detail.notes && <div className="text-xs bg-amber-50 text-amber-900 rounded-lg p-2 mt-1"> {detail.notes}</div>}
                </div>
                <div className="rounded-[5px] bg-amber-50 border border-amber-200 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase"><Star className="w-4 h-4" /> Fidélité</div>
                  <div className="text-2xl font-extrabold text-amber-900 mt-1">{num(detail.loyaltyPoints)} pts</div>
                  <div className="text-xs text-amber-800 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Valeur : <b>{money(detail.loyaltyPoints * settings.loyaltyValuePoint)}</b></div>
                  <div className="text-[11px] text-amber-700/80 mt-1">1 point = {money(settings.loyaltyValuePoint)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Total achats" value={money(detail.totalSpent)} tone="emerald" />
                <Stat label="Nb achats" value={String(cs.filter(s => s.status !== 'cancelled').length)} tone="sky" />
                <Stat label="Solde dû" value={money(detail.creditBalance)} tone={detail.creditBalance > 0 ? 'rose' : 'slate'} sub={od > 0 ? `dont ${money(od)} sur-mesure` : undefined} />
                <div className="bg-white rounded-md border border-slate-200 shadow-sm p-3 flex flex-col justify-center gap-1.5">
                  <Btn variant="primary" size="sm" disabled={sd <= 0} onClick={() => openCollect(detail)}><Wallet className="w-4 h-4" /> Encaisser</Btn>
                  <Btn size="sm" disabled={detail.creditBalance <= 0} onClick={() => openWa(detail, 'relance')}>Relancer</Btn>
                </div>
              </div>

              <div className="rounded-[5px] border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-2"><Ruler className="w-4 h-4 text-emerald-700" /> Mesures</div>
                {detail.measurements ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MEAS.filter(([k]) => detail.measurements?.[k]).map(([k, l]) => <div key={k} className="rounded-lg bg-slate-50 px-3 py-2"><div className="text-[10px] uppercase text-slate-500 font-semibold">{l}</div><div className="font-bold text-slate-900">{detail.measurements?.[k]} cm</div></div>)}
                  </div>
                ) : <p className="text-xs text-slate-400">Aucune mesure enregistrée. <button className="text-emerald-700 font-semibold underline cursor-pointer" onClick={() => { openEdit(detail); setDetailId(null); }}>Ajouter</button></p>}
              </div>

              <div>
                <div className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-emerald-700" /> Historique des achats ({cs.length})</div>
                {cs.length === 0 ? <Empty text="Aucun achat enregistré." /> : (
                  <Table head={['N°', 'Date', 'Articles', { label: 'Total', right: true }, { label: 'Reste', right: true }, 'Statut']}>
                    {cs.slice(0, 30).map(s => (
                      <tr key={s.id}>
                        <Td className="font-mono text-xs">{s.number}</Td><Td className="text-xs">{fdate(s.date)}</Td>
                        <Td className="text-xs text-slate-600 max-w-[240px] truncate">{s.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</Td>
                        <Td right className="font-semibold">{money(s.total)}</Td>
                        <Td right className={clsx(s.status !== 'cancelled' && s.amountRemaining > 0 && 'text-rose-600 font-semibold')}>{s.status === 'cancelled' ? '—' : money(s.amountRemaining)}</Td>
                        <Td><Badge tone={s.status === 'paid' ? 'emerald' : s.status === 'partial' ? 'amber' : s.status === 'cancelled' ? 'slate' : 'rose'}>{s.status === 'paid' ? 'Payée' : s.status === 'partial' ? 'Partielle' : s.status === 'cancelled' ? 'Annulée' : 'Impayée'}</Badge></Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>

              <div>
                <div className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><Scissors className="w-4 h-4 text-emerald-700" /> Commandes sur mesure ({co.length})</div>
                {co.length === 0 ? <Empty text="Aucune commande sur mesure." /> : (
                  <Table head={['N°', 'Modèle', 'Échéance', { label: 'Prix', right: true }, { label: 'Reste', right: true }, 'Statut']}>
                    {co.map(o => (
                      <tr key={o.id}>
                        <Td className="font-mono text-xs">{o.number}</Td><Td className="text-xs">{o.garment} ×{o.quantity}</Td><Td className="text-xs">{fdate(o.dueDate)}</Td>
                        <Td right className="font-semibold">{money(o.price)}</Td><Td right>{o.status === 'annule' ? '—' : money(Math.max(0, o.price - o.amountPaid))}</Td>
                        <Td><Badge tone={o.status === 'livre' ? 'emerald' : o.status === 'pret' ? 'sky' : o.status === 'annule' ? 'slate' : 'amber'}>{({ a_couper: 'À couper', en_couture: 'En couture', finition: 'Finition', pret: 'Prêt', livre: 'Livré', annule: 'Annulé' })[o.status]}</Badge></Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ---- Encaissement ---- */}
      <Modal open={!!collectC} onClose={() => setCollectId(null)} size="sm" title={`Encaisser – ${collectC?.fullName || ''}`}
        footer={<><Btn onClick={() => setCollectId(null)}>Annuler</Btn><Btn variant="primary" onClick={doCollect}>Valider l'encaissement</Btn></>}>
        {collectC && (
          <div className="space-y-3">
            <div className="rounded-[5px] bg-rose-50 text-rose-800 p-3 text-sm">Dette sur factures : <b>{money(salesDebt(collectC.id))}</b><div className="text-[11px] opacity-80">Le règlement est affecté aux factures les plus anciennes d'abord. Les soldes sur-mesure s'encaissent dans le module Couture.</div></div>
            <Field label="Montant (FCFA)"><Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus /></Field>
            <div className="flex gap-2"><Chip onClick={() => setPayAmount(String(salesDebt(collectC.id)))}>Tout</Chip><Chip onClick={() => setPayAmount(String(Math.round(salesDebt(collectC.id) / 2)))}>Moitié</Chip></div>
            <Field label="Mode de paiement"><Select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select></Field>
          </div>
        )}
      </Modal>

      {/* ---- WhatsApp ---- */}
      <Modal open={!!waC} onClose={() => setWaId(null)} size="md" title={<span className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-emerald-600" /> WhatsApp – {waC?.fullName}</span>}
        footer={<><Btn onClick={() => setWaId(null)}>Annuler</Btn><Btn variant="primary" onClick={sendWa}><MessageCircle className="w-4 h-4" /> Envoyer sur WhatsApp</Btn></>}>
        {waC && (
          <div className="space-y-3">
            <div className="text-xs text-slate-500">Destinataire : <b>{waC.phone}</b></div>
            <div className="flex flex-wrap gap-1.5">{TPLS.map(t => <Chip key={t.id} active={tpl === t.id} onClick={() => pickTpl(t.id)}>{t.label}</Chip>)}</div>
            <Field label="Message (modifiable)"><Textarea rows={8} value={waText} onChange={e => setWaText(e.target.value)} /></Field>
          </div>
        )}
      </Modal>

      {/* ---- Suppression ---- */}
      <Modal open={!!delC} onClose={() => setDelId(null)} size="sm" title="Supprimer le client ?"
        footer={<><Btn onClick={() => setDelId(null)}>Annuler</Btn><Btn variant="danger" onClick={confirmDelete}><Trash2 className="w-4 h-4" /> Supprimer</Btn></>}>
        {delC && <div className="text-sm text-slate-700 space-y-2">
          <p>Voulez-vous vraiment supprimer <b>{delC.fullName}</b> ? Cette action est définitive.</p>
          {delC.creditBalance > 0 && <p className="rounded-lg bg-rose-50 text-rose-700 p-2 text-xs"> Ce client a encore un solde dû de {money(delC.creditBalance)}.</p>}
          <p className="text-xs text-slate-500">Ses ventes passées restent conservées dans l'historique.</p>
        </div>}
      </Modal>
    </div>
  );
};
