import React, { useMemo, useState } from 'react';
import { Ban, Banknote, Download, FileText, MessageCircle, Printer, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useErp } from '../store';
import type { PaymentMethod, Sale } from '../types';
import { PAYMENT_METHODS } from '../types';
import { addDays, clsx, download, fdate, isLive, lineTotal, money, openWhatsApp, saleProfit, sum, toCSV, todayStr, variantLabel } from '../utils/helpers';
import { printInvoice, printReceipt } from '../utils/print';
import { Badge, Btn, Card, Chip, Empty, Field, Input, Modal, PageHeader, SearchBox, Select, Stat, Table, Td } from './ui';

type Period = 'all' | 'day' | 'week' | 'month' | 'custom';
type StatusF = 'all' | 'paid' | 'partial' | 'unpaid' | 'cancelled';

const STATUS_LABEL: Record<string, string> = { paid: 'Payée', partial: 'Partielle', unpaid: 'Impayée', cancelled: 'Annulée', proforma: 'Proforma' };
const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'rose' | 'slate'> = { paid: 'emerald', partial: 'amber', unpaid: 'rose', cancelled: 'slate', proforma: 'slate' };

export const SalesModule: React.FC = () => {
  const erp = useErp();
  const { sales, staff, settings, toast } = erp;

  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState(addDays(todayStr(), -30));
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState<StatusF>('all');
  const [method, setMethod] = useState<'all' | PaymentMethod>('all');
  const [seller, setSeller] = useState('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Espèces');
  const [confirmCancel, setConfirmCancel] = useState(false);

  const sellerName = (id?: string) => staff.find(s => s.id === id)?.name || '—';

  const filtered = useMemo(() => {
    const today = todayStr();
    return sales
      .filter(s => s.docType === 'sale')
      .filter(s => {
        if (period === 'day') return s.date === today;
        if (period === 'week') return s.date >= addDays(today, -6) && s.date <= today;
        if (period === 'month') return s.date.slice(0, 7) === today.slice(0, 7);
        if (period === 'custom') return (!from || s.date >= from) && (!to || s.date <= to);
        return true;
      })
      .filter(s => status === 'all' || s.status === status)
      .filter(s => method === 'all' || s.payments.some(p => p.method === method))
      .filter(s => seller === 'all' || (seller === 'none' ? !s.sellerId : s.sellerId === seller))
      .filter(s => {
        const t = q.trim().toLowerCase();
        return !t || s.number.toLowerCase().includes(t) || s.customerName.toLowerCase().includes(t) || (s.customerPhone || '').includes(t);
      })
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [sales, period, from, to, status, method, seller, q]);

  const live = filtered.filter(isLive);
  const ca = sum(live, s => s.total);
  const profit = sum(live, saleProfit);
  const avg = live.length ? ca / live.length : 0;
  const rest = sum(live, s => s.amountRemaining);

  const sel: Sale | undefined = openId ? sales.find(s => s.id === openId) : undefined;
  const close = () => { setOpenId(null); setPayAmount(''); setConfirmCancel(false); };
  const openSale = (s: Sale) => { setOpenId(s.id); setPayAmount(String(s.amountRemaining || '')); setPayMethod('Espèces'); setConfirmCancel(false); };

  const doPay = () => {
    if (!sel) return;
    const a = Number(payAmount);
    if (!(a > 0)) return toast('Saisissez un montant valide', 'err');
    if (a > sel.amountRemaining) return toast(`Montant supérieur au reste à payer (${money(sel.amountRemaining)})`, 'err');
    try {
      erp.addPayment(sel.id, { amount: a, method: payMethod });
      toast(`Encaissement de ${money(a)} enregistré`);
      setPayAmount('');
    } catch (e) { toast((e as Error).message || 'Erreur', 'err'); }
  };

  const doCancel = () => {
    if (!sel) return;
    try { erp.cancelSale(sel.id); toast(`Vente ${sel.number} annulée – stock remis`); setConfirmCancel(false); }
    catch (e) { toast((e as Error).message || 'Erreur', 'err'); }
  };

  const sendWa = (s: Sale) => {
    if (!s.customerPhone) return toast('Aucun numéro de téléphone pour ce client', 'err');
    const lines = s.items.map(i => `• ${i.name} (${variantLabel(i.size, i.color)}) x${i.quantity} = ${money(lineTotal(i))}`).join('\n');
    const msg = `Bonjour ${s.customerName},\nMerci pour votre achat chez ${settings.name} !\n\nTicket ${s.number} du ${fdate(s.date)}\n${lines}\n\nTotal : ${money(s.total)}\nPayé : ${money(s.amountPaid)}${s.amountRemaining > 0 ? `\nReste à payer : ${money(s.amountRemaining)}` : ''}\n\nÀ très bientôt ! `;
    openWhatsApp(s.customerPhone, msg);
  };

  const exportCsv = () => {
    if (!filtered.length) return toast('Aucune vente à exporter', 'err');
    const rows: Array<Array<string | number>> = [['N°', 'Date', 'Heure', 'Client', 'Téléphone', 'Vendeur', 'Articles', 'Total', 'Payé', 'Reste', 'Statut', 'Modes de paiement', 'Bénéfice']];
    filtered.forEach(s => rows.push([s.number, fdate(s.date), s.time, s.customerName, s.customerPhone || '', sellerName(s.sellerId), sum(s.items, i => i.quantity), s.total, s.amountPaid, s.amountRemaining, STATUS_LABEL[s.status], [...new Set(s.payments.map(p => p.method))].join(' + '), saleProfit(s)]));
    download(`ventes_${todayStr()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
    toast('Export CSV téléchargé');
  };

  const periods: Array<[Period, string]> = [['all', 'Tout'], ['day', "Aujourd'hui"], ['week', '7 jours'], ['month', 'Ce mois'], ['custom', 'Personnalisée']];

  return (
    <div>
      <PageHeader
        title="Historique des ventes" subtitle={`${filtered.length} vente(s) affichée(s)`} icon={<Receipt className="w-5 h-5" />}
        actions={<Btn onClick={exportCsv}><Download className="w-4 h-4" /> Export CSV</Btn>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Chiffre d'affaires" value={money(ca)} icon={<Wallet className="w-5 h-5" />} sub={rest > 0 ? `${money(rest)} restent à encaisser` : 'Tout est encaissé'} />
        <Stat label="Nombre de ventes" value={String(live.length)} icon={<ShoppingBag className="w-5 h-5" />} tone="sky" sub={filtered.length - live.length > 0 ? `${filtered.length - live.length} annulée(s)` : undefined} />
        <Stat label="Panier moyen" value={money(avg)} icon={<Receipt className="w-5 h-5" />} tone="violet" />
        <Stat label="Bénéfice" value={money(profit)} icon={<TrendingUp className="w-5 h-5" />} tone="amber" sub={ca > 0 ? `Marge ${Math.round((profit / ca) * 100)} %` : undefined} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {periods.map(([k, l]) => <Chip key={k} active={period === k} onClick={() => setPeriod(k)}>{l}</Chip>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {period === 'custom' && (
            <>
              <Field label="Du"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
              <Field label="Au"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
            </>
          )}
          <Field label="Statut">
            <Select value={status} onChange={e => setStatus(e.target.value as StatusF)}>
              <option value="all">Tous les statuts</option>
              <option value="paid">Payée</option><option value="partial">Partielle</option><option value="unpaid">Impayée</option><option value="cancelled">Annulée</option>
            </Select>
          </Field>
          <Field label="Mode de paiement">
            <Select value={method} onChange={e => setMethod(e.target.value as 'all' | PaymentMethod)}>
              <option value="all">Tous les modes</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Vendeur">
            <Select value={seller} onChange={e => setSeller(e.target.value)}>
              <option value="all">Tous les vendeurs</option>
              <option value="none">Sans vendeur</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Recherche"><SearchBox value={q} onChange={setQ} placeholder="N° ou client…" /></Field>
        </div>
      </Card>

      <Card pad={false}>
        <div className="p-3">
          {filtered.length === 0 ? <Empty icon={<Receipt className="w-10 h-10" />} text="Aucune vente ne correspond à ces filtres." /> : (
            <Table head={['N°', 'Date', 'Client', 'Vendeur', 'Articles', { label: 'Total', right: true }, { label: 'Reste', right: true }, 'Statut', '']}>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => openSale(s)} className={clsx('cursor-pointer hover:bg-emerald-50/50', s.status === 'cancelled' && 'opacity-60')}>
                  <Td className="font-semibold text-slate-800 whitespace-nowrap">{s.number}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{fdate(s.date)} <span className="text-slate-400 text-xs">{s.time}</span></Td>
                  <Td><div className="font-medium text-slate-800">{s.customerName}</div>{s.customerPhone && <div className="text-[11px] text-slate-400">{s.customerPhone}</div>}</Td>
                  <Td className="text-slate-600">{sellerName(s.sellerId)}</Td>
                  <Td className="text-slate-600">{sum(s.items, i => i.quantity)}</Td>
                  <Td right className={clsx('font-bold', s.status === 'cancelled' ? 'line-through text-slate-400' : 'text-slate-900')}>{money(s.total)}</Td>
                  <Td right className={s.amountRemaining > 0 && s.status !== 'cancelled' ? 'text-rose-600 font-semibold' : 'text-slate-400'}>{s.status === 'cancelled' ? '—' : money(s.amountRemaining)}</Td>
                  <Td><Badge tone={STATUS_TONE[s.status] || 'slate'}>{STATUS_LABEL[s.status] || s.status}</Badge></Td>
                  <Td><Btn size="sm" onClick={e => { e.stopPropagation(); openSale(s); }}>Détail</Btn></Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </Card>

      <Modal
        open={!!sel} onClose={close} size="lg"
        title={sel ? <span className="flex items-center gap-2">{sel.number} <Badge tone={STATUS_TONE[sel.status] || 'slate'}>{STATUS_LABEL[sel.status]}</Badge></span> : ''}
        footer={sel && (
          <>
            <Btn onClick={() => printReceipt(sel, settings)}><Printer className="w-4 h-4" /> Ticket</Btn>
            <Btn onClick={() => printInvoice(sel, settings)}><FileText className="w-4 h-4" /> Facture A4</Btn>
            <Btn onClick={() => sendWa(sel)}><MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp</Btn>
            {sel.status !== 'cancelled' && !confirmCancel && <Btn variant="danger" onClick={() => setConfirmCancel(true)}><Ban className="w-4 h-4" /> Annuler la vente</Btn>}
            {confirmCancel && (
              <>
                <span className="text-xs text-rose-700 self-center font-semibold">Annuler définitivement ? Le stock sera remis.</span>
                <Btn onClick={() => setConfirmCancel(false)}>Non</Btn>
                <Btn variant="danger" onClick={doCancel}>Oui, annuler</Btn>
              </>
            )}
          </>
        )}
      >
        {sel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><div className="text-[11px] uppercase text-slate-500 font-semibold">Date</div>{fdate(sel.date)} {sel.time}</div>
              <div><div className="text-[11px] uppercase text-slate-500 font-semibold">Client</div>{sel.customerName}{sel.customerPhone && <div className="text-xs text-slate-500">{sel.customerPhone}</div>}</div>
              <div><div className="text-[11px] uppercase text-slate-500 font-semibold">Vendeur</div>{sellerName(sel.sellerId)}<div className="text-xs text-slate-500">Caisse : {sel.cashier}</div></div>
              <div><div className="text-[11px] uppercase text-slate-500 font-semibold">Canal</div><span className="capitalize">{sel.channel}</span>{sel.dueDate && <div className="text-xs text-slate-500">Échéance : {fdate(sel.dueDate)}</div>}</div>
            </div>

            <Table head={['Article', { label: 'Qté', right: true }, { label: 'P.U.', right: true }, { label: 'Remise', right: true }, { label: 'Total', right: true }]}>
              {sel.items.map((i, k) => (
                <tr key={k}>
                  <Td><div className="font-medium">{i.name}</div><div className="text-[11px] text-slate-400">{variantLabel(i.size, i.color)}</div></Td>
                  <Td right>{i.quantity}</Td><Td right>{money(i.unitPrice)}</Td><Td right>{i.discount ? money(i.discount) : '—'}</Td><Td right className="font-semibold">{money(lineTotal(i))}</Td>
                </tr>
              ))}
            </Table>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-1">Paiements</h4>
                {sel.payments.length === 0 ? <p className="text-sm text-slate-400">Aucun paiement enregistré.</p> : (
                  <ul className="text-sm divide-y divide-slate-100 border border-slate-200 rounded-[5px]">
                    {sel.payments.map(p => (
                      <li key={p.id} className="flex justify-between px-3 py-1.5">
                        <span>{fdate(p.date)} {p.time} · <Badge tone="sky">{p.method}</Badge></span><b>{money(p.amount)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-slate-50 rounded-[5px] p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Sous-total</span><span>{money(sel.subtotal)}</span></div>
                {sel.discountGlobal > 0 && <div className="flex justify-between"><span>Remise globale</span><span>-{money(sel.discountGlobal)}</span></div>}
                {sel.taxAmount > 0 && <div className="flex justify-between"><span>TVA</span><span>{money(sel.taxAmount)}</span></div>}
                <div className="flex justify-between font-extrabold text-base"><span>Total</span><span>{money(sel.total)}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Payé</span><span>{money(sel.amountPaid)}</span></div>
                {sel.status !== 'cancelled' && <div className="flex justify-between text-rose-600 font-semibold"><span>Reste à payer</span><span>{money(sel.amountRemaining)}</span></div>}
                <div className="flex justify-between pt-1 border-t border-slate-200 text-amber-700 font-semibold"><span>Bénéfice</span><span>{money(saleProfit(sel))}</span></div>
              </div>
            </div>

            {sel.notes && <p className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"> {sel.notes}</p>}

            {sel.status !== 'cancelled' && sel.amountRemaining > 0 && (
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-[5px] p-3">
                <h4 className="text-xs font-bold uppercase text-emerald-800 mb-2 flex items-center gap-1"><Banknote className="w-4 h-4" /> Encaisser le reste</h4>
                <div className="grid sm:grid-cols-3 gap-3 items-end">
                  <Field label="Montant (FCFA)"><Input type="number" min={0} max={sel.amountRemaining} value={payAmount} onChange={e => setPayAmount(e.target.value)} /></Field>
                  <Field label="Mode"><Select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select></Field>
                  <Btn variant="primary" onClick={doPay}>Encaisser</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
