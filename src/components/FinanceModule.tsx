import React, { useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, Receipt, Banknote, Plus, Trash2, Download, Printer, Lock, AlertTriangle, ShoppingBag,
  HandCoins, Landmark, Scale, Calculator, PiggyBank, CheckCircle2,
} from 'lucide-react';
import { useErp } from '../store';
import type { DayStats } from '../store';
import { PAYMENT_METHODS } from '../types';
import type { CashClosing, PaymentMethod } from '../types';
import { clsx, download, fdate, isLive, money, pct, printHtml, saleProfit, sum, todayStr, toCSV } from '../utils/helpers';
import { Badge, Btn, Card, Empty, Field, Input, Modal, PageHeader, Select, SearchBox, Stat, Table, Tabs, Td, Textarea } from './ui';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const METHOD_COLOR: Record<string, string> = {
  'Espèces': 'bg-emerald-600', Wave: 'bg-sky-500', 'Orange Money': 'bg-orange-500', 'Free Money': 'bg-rose-500',
  'Carte Bancaire': 'bg-violet-500', Virement: 'bg-slate-500', 'Chèque': 'bg-amber-500',
};

const HBars: React.FC<{ rows: Array<{ label: string; value: number; color?: string }>; empty: string }> = ({ rows, empty }) => {
  const total = sum(rows, r => r.value);
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length || total <= 0) return <Empty icon={<Wallet className="w-8 h-8" />} text={empty} />;
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700">{r.label}</span>
            <span className="text-slate-600"><b className="text-slate-900">{money(r.value)}</b> · {pct(r.value, total)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={clsx('h-full rounded-full', r.color || 'bg-emerald-600')} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

type ZData = Pick<CashClosing, 'date' | 'salesCount' | 'totalSales' | 'byMethod' | 'expenses' | 'expectedCash'> & { time?: string; user?: string; countedCash?: number; gap?: number; notes?: string };

export const FinanceModule: React.FC = () => {
  const erp = useErp();
  const { sales, orders, purchases, expenses, suppliers, closings, settings, toast } = erp;
  const today = todayStr();
  const [tab, setTab] = useState('overview');
  const [month, setMonth] = useState(today.slice(0, 7));

  /* ---------- Vue d'ensemble ---------- */
  const ov = useMemo(() => {
    const inM = (d: string) => (d || '').slice(0, 7) === month;
    const live = sales.filter(isLive);
    const msales = live.filter(s => inM(s.date));
    const ca = sum(msales, s => s.total);
    const margin = sum(msales, saleProfit);
    const allIn = [...live.flatMap(s => s.payments), ...orders.flatMap(o => o.payments)];
    const mIn = allIn.filter(p => inM(p.date));
    const collected = sum(mIn, p => p.amount);
    const byMethod: Record<string, number> = {};
    mIn.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });
    const mExp = expenses.filter(e => inM(e.date));
    const expTotal = sum(mExp, e => e.amount);
    const byCat: Record<string, number> = {};
    mExp.forEach(e => { byCat[e.category || 'Autres'] = (byCat[e.category || 'Autres'] || 0) + e.amount; });
    const allPurchasePays = purchases.filter(p => p.status !== 'annule').flatMap(p => p.payments);
    const purchasesPaid = sum(allPurchasePays.filter(p => inM(p.date)), p => p.amount);
    // soldes des comptes (cumul toutes périodes)
    const balances = PAYMENT_METHODS.map(m => {
      const inn = sum(allIn.filter(p => p.method === m), p => p.amount);
      const out = sum(expenses.filter(e => e.method === m), e => e.amount);
      const buy = sum(allPurchasePays.filter(p => p.method === m), p => p.amount);
      return { method: m, inn, out, buy, balance: inn - out - buy };
    }).filter(b => ['Espèces', 'Wave', 'Orange Money'].includes(b.method) || b.inn || b.out || b.buy);
    return {
      ca, margin, collected, expTotal, purchasesPaid, net: margin - expTotal, count: msales.length, balances,
      methods: Object.entries(byMethod).map(([label, value]) => ({ label, value, color: METHOD_COLOR[label] })).sort((a, b) => b.value - a.value),
      cats: Object.entries(byCat).map(([label, value]) => ({ label, value, color: 'bg-amber-500' })).sort((a, b) => b.value - a.value),
    };
  }, [sales, orders, purchases, expenses, month]);

  /* ---------- Dépenses ---------- */
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('');
  const [fMethod, setFMethod] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [open, setOpen] = useState(false);
  const cats = settings.expenseCategories?.length ? settings.expenseCategories : ['Autres'];
  const blank = () => ({ date: today, category: cats[0], label: '', amount: '', method: 'Espèces' as PaymentMethod });
  const [form, setForm] = useState(blank());
  const [errs, setErrs] = useState<Record<string, string>>({});

  const filteredExp = useMemo(() => {
    const s = q.trim().toLowerCase();
    return expenses
      .filter(e => (!s || `${e.label} ${e.category} ${e.cashier}`.toLowerCase().includes(s)) && (!fCat || e.category === fCat) && (!fMethod || e.method === fMethod) && (!fFrom || e.date >= fFrom) && (!fTo || e.date <= fTo))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, q, fCat, fMethod, fFrom, fTo]);
  const filteredTotal = sum(filteredExp, e => e.amount);

  const submitExpense = () => {
    const e: Record<string, string> = {};
    const amount = Number(form.amount);
    if (!form.label.trim()) e.label = 'Libellé obligatoire';
    if (!form.amount || !isFinite(amount) || amount <= 0) e.amount = 'Montant invalide (> 0)';
    if (!form.date) e.date = 'Date obligatoire';
    if (!form.category) e.category = 'Catégorie obligatoire';
    setErrs(e);
    if (Object.keys(e).length) { toast('Veuillez corriger le formulaire', 'err'); return; }
    erp.addExpense({ date: form.date, category: form.category, label: form.label.trim(), amount: Math.round(amount), method: form.method });
    toast('Dépense enregistrée'); setOpen(false); setForm(blank()); setErrs({});
  };
  const delExpense = (id: string, label: string) => {
    if (window.confirm(`Supprimer la dépense « ${label} » ? Cette action est irréversible.`)) { erp.deleteExpense(id); toast('Dépense supprimée'); }
  };
  const exportExp = () => {
    if (!filteredExp.length) { toast('Aucune dépense à exporter', 'err'); return; }
    download(`depenses_${today}.csv`, toCSV([['Date', 'Catégorie', 'Libellé', 'Mode', 'Montant', 'Saisi par'], ...filteredExp.map(e => [fdate(e.date), e.category, e.label, e.method, e.amount, e.cashier])]), 'text/csv;charset=utf-8');
    toast('Export CSV téléchargé');
  };

  /* ---------- Clôture ---------- */
  const st: DayStats = erp.dayStats(today);
  const closedToday = closings.filter(c => c.date === today);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const countedNum = counted.trim() === '' ? NaN : Number(counted);
  const gap = isFinite(countedNum) ? countedNum - st.expectedCash : null;

  const printZ = (z: ZData) => {
    const rows = Object.entries(z.byMethod).filter(([, v]) => (v || 0) > 0).map(([m, v]) => `<tr><td>${esc(m)}</td><td class="r">${money(v)}</td></tr>`).join('');
    printHtml(`<html><head><meta charset="utf-8"><title>Ticket Z</title><style>
      body{font-family:'Courier New',monospace;font-size:12px;width:76mm;margin:0 auto;padding:4mm;color:#000}
      h1{font-size:15px;text-align:center;margin:0}h2{font-size:13px;text-align:center;margin:6px 0}
      .c{text-align:center}.r{text-align:right}table{width:100%;border-collapse:collapse}td{padding:2px 0}
      hr{border:0;border-top:1px dashed #000;margin:6px 0}.b{font-weight:bold}
    </style></head><body>
      <h1>${esc(settings.name)}</h1><div class="c">${esc(settings.address)} ${esc(settings.city)}</div>
      <h2>TICKET Z — CLÔTURE DE CAISSE</h2><hr>
      <table><tr><td>Date</td><td class="r">${fdate(z.date)} ${esc(z.time || '')}</td></tr>
      <tr><td>Opérateur</td><td class="r">${esc(z.user || '—')}</td></tr>
      <tr><td>Nb ventes</td><td class="r">${z.salesCount}</td></tr>
      <tr><td>Chiffre d'affaires</td><td class="r">${money(z.totalSales)}</td></tr></table><hr>
      <div class="b">Encaissements</div><table>${rows || '<tr><td>Aucun</td><td></td></tr>'}</table><hr>
      <table><tr><td>Dépenses (total)</td><td class="r">${money(z.expenses)}</td></tr>
      <tr><td>Espèces attendues</td><td class="r">${money(z.expectedCash)}</td></tr>
      ${z.countedCash !== undefined ? `<tr><td>Espèces comptées</td><td class="r">${money(z.countedCash)}</td></tr><tr class="b"><td>Écart</td><td class="r">${(z.gap || 0) > 0 ? '+' : ''}${money(z.gap)}</td></tr>` : ''}
      </table>${z.notes ? `<hr><div>Notes : ${esc(z.notes)}</div>` : ''}<hr><div class="c">Signature : ____________</div>
    </body></html>`);
  };

  const submitClosing = () => {
    if (!isFinite(countedNum) || countedNum < 0) { toast('Saisissez le montant d\'espèces comptées', 'err'); return; }
    if (closedToday.length && !window.confirm('Une clôture existe déjà pour aujourd\'hui. Enregistrer une nouvelle clôture ?')) return;
    if (!window.confirm(`Confirmer la clôture de caisse ?\nEspèces comptées : ${money(countedNum)}\nÉcart : ${money(countedNum - st.expectedCash)}`)) return;
    const c = erp.closeDay(Math.round(countedNum), notes.trim() || undefined);
    toast(c.gap === 0 ? 'Caisse clôturée — aucun écart' : `Caisse clôturée — écart de ${money(c.gap)}`, c.gap === 0 ? 'ok' : 'err');
    setCounted(''); setNotes('');
  };

  /* ---------- Créances & dettes ---------- */
  const receivables = useMemo(() => sales.filter(s => isLive(s) && s.amountRemaining > 0).sort((a, b) => a.date.localeCompare(b.date)), [sales]);
  const totalRecv = sum(receivables, s => s.amountRemaining);
  const debts = suppliers.filter(s => s.balanceDue > 0).sort((a, b) => b.balanceDue - a.balanceDue);
  const totalDebt = sum(debts, s => s.balanceDue);
  const orderRecv = sum(orders.filter(o => o.status !== 'annule'), o => Math.max(0, o.price - o.amountPaid));
  const net = totalRecv - totalDebt;

  return (
    <div>
      <PageHeader title="Finances & Trésorerie" subtitle="Encaissements, dépenses, clôture de caisse, créances et dettes" icon={<Wallet className="w-6 h-6" />}
        actions={tab === 'overview' ? <Input type="month" value={month} onChange={e => setMonth(e.target.value || today.slice(0, 7))} className="!w-44" /> : undefined} />
      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'overview', label: "Vue d'ensemble" }, { id: 'expenses', label: 'Dépenses', count: expenses.length },
          { id: 'closing', label: 'Clôture de caisse (Z)' }, { id: 'debts', label: 'Créances & Dettes' },
        ]} />
      </div>

      {/* ================= VUE D'ENSEMBLE ================= */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <Stat label="Chiffre d'affaires" value={money(ov.ca)} sub={`${ov.count} vente(s)`} icon={<ShoppingBag className="w-5 h-5" />} />
            <Stat label="Encaissements réels" value={money(ov.collected)} sub="Ventes + sur-mesure" icon={<Banknote className="w-5 h-5" />} tone="sky" />
            <Stat label="Marge brute" value={money(ov.margin)} sub={`${pct(ov.margin, ov.ca)}% du CA`} icon={<TrendingUp className="w-5 h-5" />} tone="violet" />
            <Stat label="Dépenses" value={money(ov.expTotal)} icon={<Receipt className="w-5 h-5" />} tone="amber" />
            <Stat label="Achats payés" value={money(ov.purchasesPaid)} sub="Règlements fournisseurs" icon={<HandCoins className="w-5 h-5" />} tone="slate" />
            <Stat label="Bénéfice net estimé" value={money(ov.net)} sub="Marge brute − dépenses" icon={<PiggyBank className="w-5 h-5" />} tone={ov.net >= 0 ? 'emerald' : 'rose'} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Encaissements par mode de paiement"><HBars rows={ov.methods} empty="Aucun encaissement sur ce mois" /></Card>
            <Card title="Dépenses par catégorie"><HBars rows={ov.cats} empty="Aucune dépense sur ce mois" /></Card>
          </div>
          <Card title="Solde des comptes (cumul)" right={<span className="text-[11px] text-slate-400">Encaissements − dépenses − paiements achats</span>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {ov.balances.map(b => (
                <div key={b.method} className="rounded-[5px] border border-slate-200 p-3 bg-slate-50/60">
                  <div className="flex items-center gap-2 mb-1"><span className={clsx('w-2.5 h-2.5 rounded-full', METHOD_COLOR[b.method] || 'bg-slate-400')} /><span className="text-xs font-bold text-slate-700">{b.method}</span></div>
                  <div className={clsx('text-lg font-extrabold', b.balance < 0 ? 'text-rose-600' : 'text-slate-900')}>{money(b.balance)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">+ {money(b.inn)} · − {money(b.out)} dép. · − {money(b.buy)} achats</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-sm"><span className="font-semibold text-slate-600">Trésorerie totale</span><b className={sum(ov.balances, b => b.balance) < 0 ? 'text-rose-600' : 'text-emerald-700'}>{money(sum(ov.balances, b => b.balance))}</b></div>
          </Card>
        </div>
      )}

      {/* ================= DÉPENSES ================= */}
      {tab === 'expenses' && (
        <Card pad={false}>
          <div className="p-4 flex flex-wrap items-end gap-2 border-b border-slate-100">
            <SearchBox value={q} onChange={setQ} placeholder="Rechercher une dépense…" className="w-56" />
            <Select value={fCat} onChange={e => setFCat(e.target.value)} className="!w-44"><option value="">Toutes catégories</option>{cats.map(c => <option key={c}>{c}</option>)}</Select>
            <Select value={fMethod} onChange={e => setFMethod(e.target.value)} className="!w-40"><option value="">Tous modes</option>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select>
            <Input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="!w-40" title="Du" />
            <Input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className="!w-40" title="Au" />
            <div className="ml-auto flex gap-2">
              <Btn onClick={exportExp}><Download className="w-4 h-4" />CSV</Btn>
              <Btn variant="primary" onClick={() => { setForm(blank()); setErrs({}); setOpen(true); }}><Plus className="w-4 h-4" />Nouvelle dépense</Btn>
            </div>
          </div>
          <div className="px-4 py-2 text-xs text-slate-500 flex justify-between bg-slate-50"><span>{filteredExp.length} dépense(s)</span><span>Total : <b className="text-slate-900">{money(filteredTotal)}</b></span></div>
          <div className="px-4 pb-3">
            {filteredExp.length === 0 ? <Empty icon={<Receipt className="w-8 h-8" />} text="Aucune dépense trouvée" /> : (
              <Table head={['Date', 'Catégorie', 'Libellé', 'Mode', { label: 'Montant', right: true }, 'Saisi par', '']}>
                {filteredExp.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">{fdate(e.date)}</Td>
                    <Td><Badge tone="amber">{e.category}</Badge></Td>
                    <Td className="font-medium text-slate-800">{e.label}</Td>
                    <Td><Badge tone="slate">{e.method}</Badge></Td>
                    <Td right className="font-bold whitespace-nowrap">{money(e.amount)}</Td>
                    <Td className="text-xs text-slate-500">{e.cashier}</Td>
                    <Td right><Btn size="sm" variant="danger" onClick={() => delExpense(e.id, e.label)} title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></Btn></Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
          <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle dépense" size="md"
            footer={<><Btn onClick={() => setOpen(false)}>Annuler</Btn><Btn variant="primary" onClick={submitExpense}>Enregistrer</Btn></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Date" hint={errs.date}><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Catégorie" hint={errs.category}><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Libellé" className="sm:col-span-2" hint={errs.label}><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex : Facture Senelec" autoFocus /></Field>
              <Field label="Montant (FCFA)" hint={errs.amount}><Input type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" /></Field>
              <Field label="Mode de paiement"><Select value={form.method} onChange={e => setForm({ ...form, method: e.target.value as PaymentMethod })}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select></Field>
            </div>
            {Object.keys(errs).length > 0 && <p className="mt-3 text-xs text-rose-600 font-semibold">Corrigez les champs : {Object.values(errs).join(' · ')}</p>}
          </Modal>
        </Card>
      )}

      {/* ================= CLÔTURE ================= */}
      {tab === 'closing' && (
        <div className="space-y-4">
          {closedToday.length > 0 && (
            <div className="flex items-start gap-3 rounded-[5px] border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div><b>La caisse a déjà été clôturée aujourd'hui</b> ({closedToday.length} clôture(s), dernière à {closedToday[0].time} par {closedToday[0].user}). Une nouvelle clôture demandera confirmation.</div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title={`Journée du ${fdate(today)}`} right={<Badge tone="emerald">En cours</Badge>}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-[5px] bg-slate-50 border border-slate-200 p-3"><div className="text-[11px] uppercase font-semibold text-slate-500">Ventes</div><div className="text-xl font-extrabold">{st.salesCount}</div></div>
                <div className="rounded-[5px] bg-slate-50 border border-slate-200 p-3"><div className="text-[11px] uppercase font-semibold text-slate-500">Chiffre d'affaires</div><div className="text-xl font-extrabold">{money(st.totalSales)}</div></div>
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Encaissements par mode</div>
              {Object.entries(st.byMethod).filter(([, v]) => (v || 0) > 0).length === 0 ? <p className="text-sm text-slate-400 py-2">Aucun encaissement aujourd'hui</p> : (
                <div className="divide-y divide-slate-100 mb-3">
                  {Object.entries(st.byMethod).filter(([, v]) => (v || 0) > 0).map(([m, v]) => (
                    <div key={m} className="flex justify-between py-1.5 text-sm"><span className="flex items-center gap-2"><span className={clsx('w-2 h-2 rounded-full', METHOD_COLOR[m] || 'bg-slate-400')} />{m}</span><b>{money(v)}</b></div>
                  ))}
                  <div className="flex justify-between py-1.5 text-sm font-bold"><span>Total encaissé</span><span>{money(st.collected)}</span></div>
                </div>
              )}
              <div className="rounded-[5px] bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Espèces encaissées</span><b>{money(st.byMethod['Espèces'] || 0)}</b></div>
                <div className="flex justify-between"><span>Dépenses en espèces</span><b className="text-rose-600">− {money(st.cashExpenses)}</b></div>
                <div className="flex justify-between text-base pt-1 border-t border-emerald-200"><span className="font-bold text-emerald-900">Espèces attendues</span><b className="text-emerald-800">{money(st.expectedCash)}</b></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Dépenses totales du jour : {money(st.expenses)}</p>
            </Card>

            <Card title="Comptage de la caisse" right={<Calculator className="w-4 h-4 text-slate-400" />}>
              <div className="space-y-3">
                <Field label="Espèces comptées (FCFA)"><Input type="number" min={0} value={counted} onChange={e => setCounted(e.target.value)} placeholder="Montant physique en caisse" className="!text-lg !font-bold" /></Field>
                {gap !== null && (
                  <div className={clsx('rounded-[5px] p-3 border flex items-center gap-3', gap === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : gap > 0 ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-rose-50 border-rose-200 text-rose-700')}>
                    {gap === 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <div className="text-sm"><div className="font-bold">{gap === 0 ? 'Caisse juste' : gap > 0 ? 'Excédent de caisse' : 'Manque en caisse'}</div><div>Écart : <b>{gap > 0 ? '+' : ''}{money(gap)}</b></div></div>
                  </div>
                )}
                <Field label="Notes (facultatif)"><Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Explication d'un écart, remarque…" /></Field>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="primary" size="lg" onClick={submitClosing} className="flex-1"><Lock className="w-4 h-4" />Clôturer la caisse</Btn>
                  <Btn size="lg" onClick={() => printZ({ ...st, time: new Date().toTimeString().slice(0, 5), user: erp.currentUser?.name, countedCash: isFinite(countedNum) ? countedNum : undefined, gap: gap ?? undefined, notes })}><Printer className="w-4 h-4" />Aperçu Z</Btn>
                </div>
              </div>
            </Card>
          </div>

          <Card title="Historique des clôtures" pad={false}>
            <div className="px-4 pb-3">
              {closings.length === 0 ? <Empty icon={<Lock className="w-8 h-8" />} text="Aucune clôture enregistrée" /> : (
                <Table head={['Date', 'Opérateur', { label: 'Ventes', right: true }, { label: 'CA', right: true }, { label: 'Attendu', right: true }, { label: 'Compté', right: true }, { label: 'Écart', right: true }, '']}>
                  {closings.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <Td className="whitespace-nowrap">{fdate(c.date)} <span className="text-xs text-slate-400">{c.time}</span></Td>
                      <Td className="text-xs">{c.user}</Td>
                      <Td right>{c.salesCount}</Td>
                      <Td right className="whitespace-nowrap">{money(c.totalSales)}</Td>
                      <Td right className="whitespace-nowrap">{money(c.expectedCash)}</Td>
                      <Td right className="whitespace-nowrap">{money(c.countedCash)}</Td>
                      <Td right><Badge tone={c.gap === 0 ? 'emerald' : c.gap > 0 ? 'sky' : 'rose'}>{c.gap > 0 ? '+' : ''}{money(c.gap)}</Badge></Td>
                      <Td right><Btn size="sm" onClick={() => printZ(c)} title="Imprimer le ticket Z"><Printer className="w-3.5 h-3.5" /></Btn></Td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ================= CRÉANCES & DETTES ================= */}
      {tab === 'debts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Créances clients" value={money(totalRecv)} sub={`${receivables.length} vente(s) impayée(s)`} icon={<HandCoins className="w-5 h-5" />} tone="sky" />
            <Stat label="Dettes fournisseurs" value={money(totalDebt)} sub={`${debts.length} fournisseur(s)`} icon={<Landmark className="w-5 h-5" />} tone="amber" />
            <Stat label="Solde net" value={money(net)} sub="Créances − dettes" icon={<Scale className="w-5 h-5" />} tone={net >= 0 ? 'emerald' : 'rose'} />
          </div>
          {orderRecv > 0 && <p className="text-xs text-slate-500">À titre indicatif : {money(orderRecv)} restent à encaisser sur les commandes sur-mesure (non inclus ci-dessus).</p>}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card title="Créances clients" pad={false}>
              <div className="px-4 pb-3">
                {receivables.length === 0 ? <Empty icon={<CheckCircle2 className="w-8 h-8" />} text="Aucune créance client" /> : (
                  <Table head={['Facture', 'Client', 'Date', { label: 'Reste dû', right: true }]}>
                    {receivables.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <Td className="font-semibold">{s.number}</Td><Td>{s.customerName}</Td><Td className="whitespace-nowrap">{fdate(s.date)}</Td>
                        <Td right className="font-bold text-sky-700 whitespace-nowrap">{money(s.amountRemaining)}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            </Card>
            <Card title="Dettes fournisseurs" pad={false}>
              <div className="px-4 pb-3">
                {debts.length === 0 ? <Empty icon={<CheckCircle2 className="w-8 h-8" />} text="Aucune dette fournisseur" /> : (
                  <Table head={['Fournisseur', 'Contact', { label: 'Solde dû', right: true }]}>
                    {debts.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <Td className="font-semibold">{s.name}</Td><Td className="text-xs text-slate-500">{s.phone}</Td>
                        <Td right className="font-bold text-amber-700 whitespace-nowrap">{money(s.balanceDue)}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceModule;
