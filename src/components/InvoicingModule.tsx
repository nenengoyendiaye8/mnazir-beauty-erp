import React, { useMemo, useState } from 'react';
import { AlertTriangle, Banknote, FileCheck2, FilePlus2, FileText, MessageCircle, Plus, Printer, Receipt, Trash2, Users } from 'lucide-react';
import { useErp } from '../store';
import type { PaymentMethod, Sale, SaleItem } from '../types';
import { PAYMENT_METHODS } from '../types';
import { addDays, clsx, fdate, isLive, lineTotal, money, openWhatsApp, sum, todayStr, variantLabel } from '../utils/helpers';
import { printInvoice } from '../utils/print';
import { Badge, Btn, Card, Empty, Field, Input, Modal, PageHeader, SearchBox, Select, Stat, Table, Tabs, Td, Textarea } from './ui';

type TabId = 'credits' | 'proformas' | 'factures' | 'debiteurs';
type DocMode = 'proforma' | 'facture';

interface Line { productId: string; variantId: string; quantity: string; unitPrice: string; discount: string }
interface PayRow { amount: string; method: PaymentMethod }
const emptyLine = (): Line => ({ productId: '', variantId: '', quantity: '1', unitPrice: '', discount: '0' });

const STATUS_LABEL: Record<string, string> = { paid: 'Payée', partial: 'Partielle', unpaid: 'Impayée', cancelled: 'Annulée', proforma: 'Proforma' };
const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'rose' | 'slate'> = { paid: 'emerald', partial: 'amber', unpaid: 'rose', cancelled: 'slate', proforma: 'slate' };

const isOverdue = (s: Sale) => !!s.dueDate && s.dueDate < todayStr() && s.amountRemaining > 0;

export const InvoicingModule: React.FC = () => {
  const erp = useErp();
  const { sales, customers, products, staff, settings, toast } = erp;

  const [tab, setTab] = useState<TabId>('credits');
  const [q, setQ] = useState('');
  const [docMode, setDocMode] = useState<DocMode | null>(null);

  /* encaissement d'une vente */
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [debtor, setDebtor] = useState<DebtorGroup | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Espèces');
  const [confirm, setConfirm] = useState<{ kind: 'convert' | 'delete'; sale: Sale } | null>(null);

  const real = useMemo(() => sales.filter(s => s.docType === 'sale').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [sales]);
  const credits = useMemo(() => real.filter(s => s.status !== 'cancelled' && s.amountRemaining > 0).sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date)), [real]);
  const proformas = useMemo(() => sales.filter(s => s.docType === 'proforma').sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [sales]);

  const groups = useMemo<DebtorGroup[]>(() => {
    const m = new Map<string, DebtorGroup>();
    credits.forEach(s => {
      const key = s.customerId || `n:${s.customerName}`;
      const g = m.get(key) || { key, customerId: s.customerId, name: s.customerName, phone: s.customerPhone, balance: 0, sales: [] };
      g.balance += s.amountRemaining; g.sales.push(s); if (!g.phone && s.customerPhone) g.phone = s.customerPhone;
      m.set(key, g);
    });
    return [...m.values()].sort((a, b) => b.balance - a.balance);
  }, [credits]);

  const totalDue = sum(credits, s => s.amountRemaining);
  const overdue = credits.filter(isOverdue);
  const match = (s: Sale) => { const t = q.trim().toLowerCase(); return !t || s.number.toLowerCase().includes(t) || s.customerName.toLowerCase().includes(t) || (s.customerPhone || '').includes(t); };

  const startPay = (s: Sale) => { setPaySale(s); setAmount(String(s.amountRemaining)); setMethod('Espèces'); };
  const startDebtor = (g: DebtorGroup) => { setDebtor(g); setAmount(String(g.balance)); setMethod('Espèces'); };
  const closePay = () => { setPaySale(null); setDebtor(null); setAmount(''); };

  const submitPay = () => {
    const a = Number(amount);
    if (!(a > 0)) return toast('Saisissez un montant valide', 'err');
    try {
      if (paySale) {
        if (a > paySale.amountRemaining) return toast(`Maximum : ${money(paySale.amountRemaining)}`, 'err');
        erp.addPayment(paySale.id, { amount: a, method });
      } else if (debtor?.customerId) {
        if (a > debtor.balance) return toast(`Maximum : ${money(debtor.balance)}`, 'err');
        erp.collectCustomerDebt(debtor.customerId, { amount: a, method });
      } else return;
      toast(`Encaissement de ${money(a)} enregistré`);
      closePay();
    } catch (e) { toast((e as Error).message || 'Erreur', 'err'); }
  };

  const relance = (s: Sale) => {
    if (!s.customerPhone) return toast('Aucun numéro de téléphone pour ce client', 'err');
    const late = isOverdue(s);
    const msg = `Bonjour ${s.customerName},\n\nNous espérons que vous allez bien. ${late ? `Sauf erreur de notre part, le règlement de la facture ${s.number} était attendu pour le ${fdate(s.dueDate)}.` : `Nous vous rappelons aimablement la facture ${s.number} du ${fdate(s.date)}.`}\n\nMontant restant dû : ${money(s.amountRemaining)}.\n\nVous pouvez régler en espèces, par Wave ou Orange Money. Si le paiement est déjà effectué, veuillez ignorer ce message.\n\nMerci pour votre confiance,\n${settings.name}${settings.phones[0] ? ' – ' + settings.phones[0] : ''}`;
    openWhatsApp(s.customerPhone, msg);
  };
  const relanceGroup = (g: DebtorGroup) => {
    if (!g.phone) return toast('Aucun numéro de téléphone pour ce client', 'err');
    const list = g.sales.map(s => `• ${s.number} (${fdate(s.date)}) : ${money(s.amountRemaining)}`).join('\n');
    openWhatsApp(g.phone, `Bonjour ${g.name},\n\nNous espérons que vous allez bien. Voici un rappel aimable de votre solde chez ${settings.name} :\n${list}\n\nTotal restant dû : ${money(g.balance)}.\n\nMerci de passer régler à votre convenance. Si le paiement est déjà effectué, veuillez ignorer ce message.\n\nCordialement,\n${settings.name}`);
  };
  const sendProforma = (s: Sale) => {
    if (!s.customerPhone) return toast('Aucun numéro de téléphone pour ce client', 'err');
    const lines = s.items.map(i => `• ${i.name} (${variantLabel(i.size, i.color)}) x${i.quantity} = ${money(lineTotal(i))}`).join('\n');
    openWhatsApp(s.customerPhone, `Bonjour ${s.customerName},\n\nVoici votre devis ${s.number} du ${fdate(s.date)} :\n${lines}\n\nTotal : ${money(s.total)}\nValable 15 jours.\n\nN'hésitez pas à nous contacter pour le confirmer.\n${settings.name}`);
  };

  const runConfirm = () => {
    if (!confirm) return;
    try {
      if (confirm.kind === 'convert') { const f = erp.convertProforma(confirm.sale.id); toast(`Facture ${f.number} créée – stock mis à jour`); setTab('factures'); }
      else { erp.deleteProforma(confirm.sale.id); toast('Proforma supprimée'); }
    } catch (e) { toast((e as Error).message || 'Erreur', 'err'); }
    setConfirm(null);
  };

  const payTitle = paySale ? `Encaisser – ${paySale.number}` : debtor ? `Encaisser – ${debtor.name}` : '';
  const payMax = paySale ? paySale.amountRemaining : debtor?.balance || 0;

  return (
    <div>
      <PageHeader
        title="Facturation & Crédits" subtitle="Crédits clients, devis proforma et factures A4" icon={<FileText className="w-5 h-5" />}
        actions={<>
          <Btn onClick={() => setDocMode('proforma')}><FilePlus2 className="w-4 h-4" /> Nouvelle proforma</Btn>
          <Btn variant="primary" onClick={() => setDocMode('facture')}><Plus className="w-4 h-4" /> Nouvelle facture</Btn>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Total à encaisser" value={money(totalDue)} icon={<Banknote className="w-5 h-5" />} tone="rose" sub={`${credits.length} facture(s) en crédit`} />
        <Stat label="En retard" value={money(sum(overdue, s => s.amountRemaining))} icon={<AlertTriangle className="w-5 h-5" />} tone="amber" sub={`${overdue.length} facture(s) échue(s)`} />
        <Stat label="Clients débiteurs" value={String(groups.length)} icon={<Users className="w-5 h-5" />} tone="sky" />
        <Stat label="Proformas en attente" value={String(proformas.length)} icon={<FileCheck2 className="w-5 h-5" />} tone="violet" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Tabs
          value={tab} onChange={id => setTab(id as TabId)}
          tabs={[{ id: 'credits', label: 'Crédits en cours', count: credits.length }, { id: 'proformas', label: 'Proformas / Devis', count: proformas.length }, { id: 'factures', label: 'Factures', count: real.length }, { id: 'debiteurs', label: 'Clients débiteurs', count: groups.length }]}
        />
        {tab !== 'debiteurs' && <SearchBox value={q} onChange={setQ} placeholder="N° ou client…" className="w-full sm:w-64" />}
      </div>

      {tab === 'credits' && (
        <Card pad={false}><div className="p-3">
          {credits.filter(match).length === 0 ? <Empty icon={<Receipt className="w-10 h-10" />} text="Aucun crédit en cours. " /> : (
            <Table head={['Facture', 'Client', 'Date', 'Échéance', { label: 'Total', right: true }, { label: 'Reste dû', right: true }, '']}>
              {credits.filter(match).map(s => (
                <tr key={s.id} className={clsx(isOverdue(s) && 'bg-rose-50/50')}>
                  <Td className="font-semibold whitespace-nowrap">{s.number}</Td>
                  <Td><div className="font-medium">{s.customerName}</div><div className="text-[11px] text-slate-400">{s.customerPhone}</div></Td>
                  <Td className="text-slate-600 whitespace-nowrap">{fdate(s.date)}</Td>
                  <Td className="whitespace-nowrap">{s.dueDate ? <span className={clsx(isOverdue(s) ? 'text-rose-700 font-semibold' : 'text-slate-600')}>{fdate(s.dueDate)}</span> : <span className="text-slate-300">—</span>}{isOverdue(s) && <Badge tone="rose" className="ml-1">Retard {Math.round((Date.parse(todayStr()) - Date.parse(s.dueDate!)) / 86400000)} j</Badge>}</Td>
                  <Td right>{money(s.total)}</Td>
                  <Td right className="font-bold text-rose-600">{money(s.amountRemaining)}</Td>
                  <Td><div className="flex gap-1 justify-end">
                    <Btn size="sm" variant="primary" onClick={() => startPay(s)}><Banknote className="w-3.5 h-3.5" /> Encaisser</Btn>
                    <Btn size="sm" onClick={() => relance(s)} title="Relance WhatsApp"><MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> Relancer</Btn>
                    <Btn size="sm" onClick={() => printInvoice(s, settings)} title="Imprimer"><Printer className="w-3.5 h-3.5" /></Btn>
                  </div></Td>
                </tr>
              ))}
            </Table>
          )}
        </div></Card>
      )}

      {tab === 'proformas' && (
        <Card pad={false}><div className="p-3">
          {proformas.filter(match).length === 0 ? <Empty icon={<FileCheck2 className="w-10 h-10" />} text="Aucune proforma. Créez un devis pour un client." /> : (
            <Table head={['N°', 'Date', 'Client', 'Articles', { label: 'Total', right: true }, '']}>
              {proformas.filter(match).map(s => (
                <tr key={s.id}>
                  <Td className="font-semibold whitespace-nowrap">{s.number}</Td>
                  <Td className="text-slate-600 whitespace-nowrap">{fdate(s.date)}</Td>
                  <Td><div className="font-medium">{s.customerName}</div><div className="text-[11px] text-slate-400">{s.customerPhone}</div></Td>
                  <Td className="text-slate-600">{sum(s.items, i => i.quantity)}</Td>
                  <Td right className="font-bold">{money(s.total)}</Td>
                  <Td><div className="flex gap-1 justify-end flex-wrap">
                    <Btn size="sm" variant="primary" onClick={() => setConfirm({ kind: 'convert', sale: s })}><FileCheck2 className="w-3.5 h-3.5" /> Convertir</Btn>
                    <Btn size="sm" onClick={() => printInvoice(s, settings)} title="Imprimer"><Printer className="w-3.5 h-3.5" /></Btn>
                    <Btn size="sm" onClick={() => sendProforma(s)} title="WhatsApp"><MessageCircle className="w-3.5 h-3.5 text-emerald-600" /></Btn>
                    <Btn size="sm" variant="danger" onClick={() => setConfirm({ kind: 'delete', sale: s })} title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></Btn>
                  </div></Td>
                </tr>
              ))}
            </Table>
          )}
        </div></Card>
      )}

      {tab === 'factures' && (
        <Card pad={false}><div className="p-3">
          {real.filter(match).length === 0 ? <Empty icon={<Receipt className="w-10 h-10" />} text="Aucune facture trouvée." /> : (
            <Table head={['N°', 'Date', 'Client', 'Échéance', { label: 'Total', right: true }, { label: 'Reste', right: true }, 'Statut', '']}>
              {real.filter(match).slice(0, 300).map(s => (
                <tr key={s.id} className={clsx(s.status === 'cancelled' && 'opacity-60')}>
                  <Td className="font-semibold whitespace-nowrap">{s.number}</Td>
                  <Td className="text-slate-600 whitespace-nowrap">{fdate(s.date)}</Td>
                  <Td><div className="font-medium">{s.customerName}</div><div className="text-[11px] text-slate-400">{s.customerPhone}</div></Td>
                  <Td className="text-slate-600 whitespace-nowrap">{s.dueDate ? fdate(s.dueDate) : '—'}</Td>
                  <Td right className="font-bold">{money(s.total)}</Td>
                  <Td right className={s.amountRemaining > 0 && s.status !== 'cancelled' ? 'text-rose-600 font-semibold' : 'text-slate-400'}>{s.status === 'cancelled' ? '—' : money(s.amountRemaining)}</Td>
                  <Td><Badge tone={STATUS_TONE[s.status] || 'slate'}>{STATUS_LABEL[s.status] || s.status}</Badge></Td>
                  <Td><div className="flex gap-1 justify-end">
                    {isLive(s) && s.amountRemaining > 0 && <Btn size="sm" variant="primary" onClick={() => startPay(s)}>Encaisser</Btn>}
                    <Btn size="sm" onClick={() => printInvoice(s, settings)}><Printer className="w-3.5 h-3.5" /> A4</Btn>
                  </div></Td>
                </tr>
              ))}
            </Table>
          )}
        </div></Card>
      )}

      {tab === 'debiteurs' && (
        <Card pad={false}><div className="p-3">
          {groups.length === 0 ? <Empty icon={<Users className="w-10 h-10" />} text="Aucun client débiteur." /> : (
            <Table head={['Client', 'Téléphone', 'Factures', { label: 'Solde total dû', right: true }, '']}>
              {groups.map(g => (
                <tr key={g.key}>
                  <Td className="font-semibold">{g.name}{g.sales.some(isOverdue) && <Badge tone="rose" className="ml-2">En retard</Badge>}</Td>
                  <Td className="text-slate-600">{g.phone || '—'}</Td>
                  <Td className="text-slate-600 text-xs">{g.sales.map(s => s.number).join(', ')}</Td>
                  <Td right className="font-bold text-rose-600">{money(g.balance)}</Td>
                  <Td><div className="flex gap-1 justify-end">
                    {g.customerId
                      ? <Btn size="sm" variant="primary" onClick={() => startDebtor(g)}><Banknote className="w-3.5 h-3.5" /> Encaisser</Btn>
                      : <Btn size="sm" onClick={() => { setTab('credits'); setQ(g.name); }} title="Client non enregistré : encaissez facture par facture">Voir factures</Btn>}
                    <Btn size="sm" onClick={() => relanceGroup(g)}><MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> Relancer</Btn>
                  </div></Td>
                </tr>
              ))}
            </Table>
          )}
        </div></Card>
      )}

      {/* Encaissement */}
      <Modal
        open={!!(paySale || debtor)} onClose={closePay} size="sm" title={payTitle}
        footer={<><Btn onClick={closePay}>Annuler</Btn><Btn variant="primary" onClick={submitPay}>Valider l'encaissement</Btn></>}
      >
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-100 rounded-[5px] p-3 text-sm flex justify-between"><span>Reste dû</span><b className="text-rose-700">{money(payMax)}</b></div>
          {debtor && <p className="text-xs text-slate-500">Le montant est réparti sur les factures les plus anciennes en premier.</p>}
          <Field label="Montant (FCFA)"><Input type="number" min={0} max={payMax} value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></Field>
          <Field label="Mode de paiement"><Select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select></Field>
        </div>
      </Modal>

      {/* Confirmations */}
      <Modal
        open={!!confirm} onClose={() => setConfirm(null)} size="sm" title={confirm?.kind === 'convert' ? 'Convertir en facture' : 'Supprimer la proforma'}
        footer={<><Btn onClick={() => setConfirm(null)}>Annuler</Btn><Btn variant={confirm?.kind === 'delete' ? 'danger' : 'primary'} onClick={runConfirm}>{confirm?.kind === 'convert' ? 'Convertir' : 'Supprimer'}</Btn></>}
      >
        {confirm && (confirm.kind === 'convert'
          ? <p className="text-sm text-slate-700">Convertir <b>{confirm.sale.number}</b> ({money(confirm.sale.total)}) en facture ? Le stock sera décompté et la facture créée sera impayée.</p>
          : <p className="text-sm text-slate-700">Supprimer définitivement la proforma <b>{confirm.sale.number}</b> ? Cette action est irréversible.</p>)}
      </Modal>

      {docMode && (
        <DocModal
          mode={docMode} onClose={() => setDocMode(null)}
          customers={customers} products={products} staff={staff} vat={settings.enableVat ? settings.vatRate : 0}
          onSubmit={input => {
            try {
              const s = erp.createSale(input);
              toast(`${input.docType === 'proforma' ? 'Proforma' : 'Facture'} ${s.number} créée`);
              setDocMode(null); setTab(input.docType === 'proforma' ? 'proformas' : (s.amountRemaining > 0 ? 'credits' : 'factures'));
              return s;
            } catch (e) { toast((e as Error).message || 'Erreur', 'err'); return undefined; }
          }}
          onPrint={s => printInvoice(s, settings)}
        />
      )}
    </div>
  );
};

interface DebtorGroup { key: string; customerId?: string; name: string; phone?: string; balance: number; sales: Sale[] }

/* ---------------- Modal de création (proforma ou facture) ---------------- */
type CreateInput = Parameters<ReturnType<typeof useErp>['createSale']>[0];

const DocModal: React.FC<{
  mode: DocMode; onClose: () => void;
  customers: ReturnType<typeof useErp>['customers']; products: ReturnType<typeof useErp>['products']; staff: ReturnType<typeof useErp>['staff']; vat: number;
  onSubmit: (i: CreateInput) => Sale | undefined; onPrint: (s: Sale) => void;
}> = ({ mode, onClose, customers, products, staff, vat, onSubmit, onPrint }) => {
  const { toast } = useErp();
  const isFac = mode === 'facture';
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [discountGlobal, setDiscountGlobal] = useState('0');
  const [dueDate, setDueDate] = useState(isFac ? addDays(todayStr(), 15) : '');
  const [sellerId, setSellerId] = useState('');
  const [notes, setNotes] = useState('');
  const [pays, setPays] = useState<PayRow[]>([]);
  const [printAfter, setPrintAfter] = useState(true);

  const cust = customers.find(c => c.id === customerId);
  const setLine = (i: number, p: Partial<Line>) => setLines(ls => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));

  const built: SaleItem[] = lines.flatMap(l => {
    const p = products.find(x => x.id === l.productId); const v = p?.variants.find(x => x.id === l.variantId);
    if (!p || !v) return [];
    return [{ productId: p.id, variantId: v.id, name: p.name, size: v.size, color: v.color, sku: v.sku, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0, buyPrice: p.buyPrice, discount: Number(l.discount) || 0 }];
  });
  const base = Math.max(0, sum(built, lineTotal) - (Number(discountGlobal) || 0));
  const tax = Math.round(base * vat / 100);
  const total = base + tax;
  const paid = sum(pays, p => Number(p.amount) || 0);

  const submit = () => {
    if (!cust && !name.trim()) return toast('Choisissez un client ou saisissez un nom', 'err');
    if (lines.some(l => !l.variantId)) return toast('Complétez chaque ligne (produit et variante) ou supprimez-la', 'err');
    if (built.length === 0) return toast('Ajoutez au moins un article', 'err');
    if (built.some(i => i.quantity <= 0 || !Number.isInteger(i.quantity))) return toast('Quantités invalides', 'err');
    if (built.some(i => i.unitPrice <= 0)) return toast('Prix unitaire invalide', 'err');
    if (built.some(i => i.discount < 0 || i.discount > i.quantity * i.unitPrice)) return toast('Remise de ligne invalide', 'err');
    if ((Number(discountGlobal) || 0) < 0) return toast('Remise globale invalide', 'err');
    if (isFac) {
      if (pays.some(p => !(Number(p.amount) > 0))) return toast('Montant de paiement invalide', 'err');
      if (paid > total) return toast('Les paiements dépassent le total', 'err');
      if (total - paid > 0 && !dueDate) return toast("Indiquez une date d'échéance pour le reste à payer", 'err');
    }
    const s = onSubmit({
      docType: isFac ? 'sale' : 'proforma',
      customerId: cust?.id, customerName: cust ? undefined : name.trim(), customerPhone: cust ? undefined : phone.trim() || undefined, customerAddress: cust ? undefined : address.trim() || undefined,
      items: built, discountGlobal: Number(discountGlobal) || 0,
      payments: isFac ? pays.map(p => ({ amount: Number(p.amount), method: p.method })) : undefined,
      sellerId: sellerId || undefined, dueDate: dueDate || undefined, channel: 'boutique', notes: notes.trim() || undefined,
    });
    if (s && printAfter) onPrint(s);
  };

  return (
    <Modal
      open onClose={onClose} size="xl" title={isFac ? 'Nouvelle facture A4' : 'Nouvelle facture proforma / devis'}
      footer={<>
        <label className="mr-auto flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={printAfter} onChange={e => setPrintAfter(e.target.checked)} /> Imprimer après création</label>
        <Btn onClick={onClose}>Annuler</Btn><Btn variant="primary" onClick={submit}>{isFac ? 'Créer la facture' : 'Créer la proforma'}</Btn>
      </>}
    >
      <div className="space-y-5">
        <section>
          <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Client</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Client enregistré">
              <Select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">— Saisir un client —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.fullName} · {c.phone}</option>)}
              </Select>
            </Field>
            {cust ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm self-end"><b>{cust.fullName}</b><div className="text-xs text-slate-500">{cust.phone} {cust.address && '· ' + cust.address}</div></div>
            ) : (
              <>
                <Field label="Nom du client *"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Mamadou Diop" /></Field>
                <Field label="Téléphone"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="77 000 00 00" /></Field>
                <Field label="Adresse"><Input value={address} onChange={e => setAddress(e.target.value)} /></Field>
              </>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase text-slate-500">Articles</h4>
            <Btn size="sm" onClick={() => setLines(ls => [...ls, emptyLine()])}><Plus className="w-3.5 h-3.5" /> Ligne</Btn>
          </div>
          {products.length === 0 && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">Aucun produit en catalogue : ajoutez d'abord des produits dans Stock.</p>}
          <div className="space-y-2">
            {lines.map((l, i) => {
              const p = products.find(x => x.id === l.productId);
              const v = p?.variants.find(x => x.id === l.variantId);
              const q = Number(l.quantity) || 0;
              const overStock = isFac && v && q > v.stock;
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-[5px] p-2.5">
                  <Field label="Produit" className="col-span-12 sm:col-span-4">
                    <Select value={l.productId} onChange={e => { const pr = products.find(x => x.id === e.target.value); setLine(i, { productId: e.target.value, variantId: '', unitPrice: pr ? String(pr.sellPrice) : '' }); }}>
                      <option value="">— Choisir —</option>
                      {products.map(x => <option key={x.id} value={x.id}>{x.emoji} {x.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Variante" className="col-span-12 sm:col-span-3">
                    <Select value={l.variantId} onChange={e => setLine(i, { variantId: e.target.value })} disabled={!p}>
                      <option value="">— Taille / couleur —</option>
                      {p?.variants.map(x => <option key={x.id} value={x.id}>{variantLabel(x.size, x.color)} (stock {x.stock})</option>)}
                    </Select>
                  </Field>
                  <Field label="Qté" className="col-span-3 sm:col-span-1"><Input type="number" min={1} value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} className={clsx(overStock && 'border-rose-400')} /></Field>
                  <Field label="Prix unit." className="col-span-4 sm:col-span-2"><Input type="number" min={0} value={l.unitPrice} onChange={e => setLine(i, { unitPrice: e.target.value })} /></Field>
                  <Field label="Remise" className="col-span-4 sm:col-span-1"><Input type="number" min={0} value={l.discount} onChange={e => setLine(i, { discount: e.target.value })} /></Field>
                  <button className="col-span-1 p-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer justify-self-end" onClick={() => setLines(ls => (ls.length > 1 ? ls.filter((_, k) => k !== i) : [emptyLine()]))} title="Supprimer la ligne"><Trash2 className="w-4 h-4" /></button>
                  {overStock && <p className="col-span-12 text-[11px] text-rose-600"> Quantité supérieure au stock disponible ({v?.stock}).</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Remise globale (FCFA)"><Input type="number" min={0} value={discountGlobal} onChange={e => setDiscountGlobal(e.target.value)} /></Field>
            {isFac && <Field label="Date d'échéance" hint="Obligatoire s'il reste un montant à payer"><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>}
            <Field label="Vendeur (optionnel)"><Select value={sellerId} onChange={e => setSellerId(e.target.value)}><option value="">— Aucun —</option>{staff.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <Field label="Notes"><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Conditions, remarques…" /></Field>
          </div>
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-[5px] p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Sous-total</span><span>{money(sum(built, lineTotal))}</span></div>
              {(Number(discountGlobal) || 0) > 0 && <div className="flex justify-between"><span>Remise globale</span><span>-{money(Number(discountGlobal))}</span></div>}
              {vat > 0 && <div className="flex justify-between"><span>TVA {vat}%</span><span>{money(tax)}</span></div>}
              <div className="flex justify-between font-extrabold text-lg text-emerald-800 border-t border-slate-200 pt-1"><span>Total</span><span>{money(total)}</span></div>
              {isFac && <>
                <div className="flex justify-between text-emerald-700"><span>Payé</span><span>{money(paid)}</span></div>
                <div className={clsx('flex justify-between font-semibold', total - paid > 0 ? 'text-rose-600' : 'text-emerald-700')}><span>Reste à payer</span><span>{money(Math.max(0, total - paid))}</span></div>
              </>}
            </div>
            {isFac && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold uppercase text-slate-500">Paiements reçus</h4>
                  <Btn size="sm" onClick={() => setPays(p => [...p, { amount: p.length === 0 ? String(total || '') : '', method: 'Espèces' }])}><Plus className="w-3.5 h-3.5" /> Paiement</Btn>
                </div>
                {pays.length === 0 && <p className="text-xs text-slate-400">Aucun paiement : la facture sera entièrement à crédit.</p>}
                <div className="space-y-2">
                  {pays.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <Input type="number" min={0} value={p.amount} onChange={e => setPays(ps => ps.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} placeholder="Montant" />
                      <Select value={p.method} onChange={e => setPays(ps => ps.map((x, k) => (k === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}>{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select>
                      <button className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer" onClick={() => setPays(ps => ps.filter((_, k) => k !== i))}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
};
