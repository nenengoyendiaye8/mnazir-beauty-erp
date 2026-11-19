import React, { useMemo, useRef, useState } from 'react';
import { Barcode, Minus, Plus, Trash2, UserPlus, Printer, FileText, MessageCircle, ShoppingCart, Gift, X, Percent, Check } from 'lucide-react';
import { useErp, type PaymentInput } from '../store';
import type { PaymentMethod, Product, Sale, SaleItem, Variant } from '../types';
import { PAYMENT_METHODS } from '../types';
import { Badge, Btn, Card, Chip, Empty, Field, Input, Modal, Select, Textarea } from './ui';
import { addDays, clsx, lineTotal, money, num, openWhatsApp, productStock, sum, todayStr, variantLabel } from '../utils/helpers';
import { printInvoice, printReceipt } from '../utils/print';

interface PayRow { method: PaymentMethod; amount: string }

export const PosModule: React.FC = () => {
  const { products, customers, staff, settings, cart, setCart, findVariant, findBySku, createSale, addCustomer, toast, currentUser } = useErp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pick, setPick] = useState<Product | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [walkIn, setWalkIn] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [discount, setDiscount] = useState('');
  const [points, setPoints] = useState('');
  const [pays, setPays] = useState<PayRow[]>([{ method: 'Wave', amount: '' }]);
  const [dueDate, setDueDate] = useState(addDays(todayStr(), 15));
  const [channel, setChannel] = useState<Sale['channel']>('boutique');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState<Sale | null>(null);
  const [newCust, setNewCust] = useState(false);
  const [nc, setNc] = useState({ fullName: '', phone: '', address: '' });
  const scanRef = useRef<HTMLInputElement>(null);

  const sellers = staff.filter(s => s.active && (s.role === 'Vendeur' || s.role === 'Vendeuse' || s.role === 'Gérant'));
  const customer = customers.find(c => c.id === customerId);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter(p => (!cat || p.category === cat) && (!s || `${p.name} ${p.category} ${p.material}`.toLowerCase().includes(s) || p.variants.some(v => v.sku.toLowerCase().includes(s))));
  }, [products, q, cat]);

  /* ---- panier ---- */
  const lines = cart.map(l => { const f = findVariant(l.variantId); return f ? { ...l, product: f.product, variant: f.variant } : null; }).filter(Boolean) as Array<typeof cart[number] & { product: Product; variant: Variant }>;
  const subtotal = sum(lines, l => l.quantity * l.unitPrice);
  const lineDisc = sum(lines, l => l.discount);
  const ptsUsed = Math.min(Math.max(0, +points || 0), customer?.loyaltyPoints || 0);
  const globalDisc = Math.max(0, +discount || 0) + ptsUsed * settings.loyaltyValuePoint;
  const base = Math.max(0, subtotal - lineDisc - globalDisc);
  const tax = settings.enableVat ? Math.round(base * settings.vatRate / 100) : 0;
  const total = base + tax;
  const entered = sum(pays, p => Math.max(0, +p.amount || 0));
  const allEmpty = pays.every(p => !p.amount);
  const paid = allEmpty ? total : Math.min(total, entered);
  const remaining = total - paid;
  const cashEntered = sum(pays.filter(p => p.method === 'Espèces'), p => Math.max(0, +p.amount || 0));
  const change = !allEmpty && entered > total && cashEntered > 0 ? Math.min(cashEntered, entered - total) : 0;

  const addToCart = (p: Product, v: Variant) => {
    setCart(c => {
      const ex = c.find(l => l.variantId === v.id);
      const have = ex ? ex.quantity : 0;
      if (have + 1 > v.stock) { toast(`Stock insuffisant (${v.stock} dispo)`, 'err'); return c; }
      return ex ? c.map(l => l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l) : [...c, { productId: p.id, variantId: v.id, quantity: 1, unitPrice: p.sellPrice, discount: 0 }];
    });
  };
  const clickProduct = (p: Product) => {
    const avail = p.variants.filter(v => v.stock > 0);
    if (!avail.length) return toast('Article en rupture de stock', 'err');
    if (p.variants.length === 1) addToCart(p, p.variants[0]); else setPick(p);
  };
  const scan = (e: React.FormEvent) => {
    e.preventDefault();
    const f = findBySku(q);
    if (f) { addToCart(f.product, f.variant); setQ(''); toast(`${f.product.name} ajouté`); } else if (shown.length === 1) clickProduct(shown[0]);
  };
  const setLine = (id: string, patch: Partial<typeof cart[number]>) => setCart(c => c.map(l => l.variantId === id ? { ...l, ...patch } : l));
  const qty = (l: typeof lines[number], d: number) => {
    const nq = l.quantity + d;
    if (nq <= 0) return setCart(c => c.filter(x => x.variantId !== l.variantId));
    if (nq > l.variant.stock) return toast(`Stock maximum disponible : ${l.variant.stock}`, 'err');
    setLine(l.variantId, { quantity: nq });
  };

  const reset = () => { setCart([]); setCustomerId(''); setWalkIn(''); setDiscount(''); setPoints(''); setPays([{ method: 'Wave', amount: '' }]); setNotes(''); setChannel('boutique'); setDueDate(addDays(todayStr(), 15)); };

  const submit = (docType: 'sale' | 'proforma') => {
    if (!lines.length) return toast('Le panier est vide', 'err');
    if (docType === 'sale' && remaining > 0 && !customerId) return toast('Vente à crédit : sélectionnez un client.', 'err');
    const items: SaleItem[] = lines.map(l => ({ productId: l.productId, variantId: l.variantId, name: l.product.name, size: l.variant.size, color: l.variant.color, sku: l.variant.sku, quantity: l.quantity, unitPrice: l.unitPrice, buyPrice: l.product.buyPrice, discount: l.discount }));
    const payments: PaymentInput[] = allEmpty ? [{ amount: total, method: pays[0].method }] : pays.filter(p => +p.amount > 0).map(p => ({ amount: +p.amount, method: p.method }));
    try {
      const sale = createSale({
        docType, items, customerId: customerId || undefined, customerName: walkIn, discountGlobal: Math.max(0, +discount || 0), payments: docType === 'sale' ? payments : [],
        sellerId: sellerId || undefined, channel, dueDate: remaining > 0 ? dueDate : undefined, notes, cashReceived: change > 0 ? cashEntered : undefined, loyaltyPointsUsed: ptsUsed,
      });
      reset(); setDone(sale);
      toast(docType === 'sale' ? `Vente ${sale.number} enregistrée` : `Proforma ${sale.number} créée`);
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const wa = (s: Sale) => {
    const l = s.items.map(i => `- ${i.name} (${variantLabel(i.size, i.color)}) x${i.quantity} : ${money(lineTotal(i))}`).join('\n');
    openWhatsApp(s.customerPhone || '', `*${settings.name}*\n${s.docType === 'proforma' ? 'Devis Proforma' : 'Facture'} N° ${s.number} du ${s.date.split('-').reverse().join('/')}\n\n${l}\n\n*Total : ${money(s.total)}*${s.amountRemaining > 0 && s.docType === 'sale' ? `\nSolde restant : ${money(s.amountRemaining)}` : ''}\n\n${settings.receiptFooter}`);
  };

  const saveCustomer = () => {
    if (!nc.fullName.trim() || !nc.phone.trim()) return toast('Nom et téléphone requis', 'err');
    const c = addCustomer(nc); setCustomerId(c.id); setNewCust(false); setNc({ fullName: '', phone: '', address: '' }); toast('Client enregistré');
  };

  return (
    <div className="grid xl:grid-cols-[1fr_430px] gap-4 items-start">
      {/* ------- Catalogue ------- */}
      <div className="space-y-3">
        <form onSubmit={scan} className="flex gap-2">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-[#7a7265] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={scanRef}
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Filtrer par désignation, référence SKU ou scanner un code-barres (Entrée)…"
              className="w-full rounded-[5px] border border-[#cfc7b8] bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#143020]"
            />
          </div>
        </form>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={!cat} onClick={() => setCat('')}>Toutes les gammes</Chip>
          {settings.categories.map(c => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>

        {shown.length === 0 ? <Card><Empty icon={<ShoppingCart className="w-6 h-6" />} text="Aucune référence correspondante" /></Card> : (
          <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-2.5">
            {shown.map(p => {
              const st = productStock(p);
              const mainSku = p.variants[0]?.sku || 'REF';
              return (
                <button
                  key={p.id}
                  onClick={() => clickProduct(p)}
                  disabled={st <= 0}
                  className={clsx('text-left bg-white rounded-md border border-[#dcd5c7] p-2.5 transition hover:border-[#143020] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex flex-col justify-between')}
                >
                  <div>
                    <div className="h-24 rounded-[4px] bg-[#f4f1ea] border border-[#e6e0d4] flex items-center justify-center mb-2 overflow-hidden relative">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <div className="font-mono-num text-xs font-bold text-[#143020] tracking-wider px-2 py-1 border border-[#c8bfa8] bg-white rounded-[3px]">
                            {mainSku}
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-[#7a7265] mt-1">
                            {p.variants[0]?.size || 'Standard'}
                          </div>
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 font-mono-num text-[9px] font-semibold bg-[#102016]/85 text-[#f5f0e6] px-1.5 py-0.5 rounded-[2px]">
                        {mainSku}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-[#7a7265] font-semibold truncate">{p.category}</div>
                    <div className="text-xs font-bold text-[#1c1a17] leading-snug line-clamp-2 min-h-[32px] mt-0.5">{p.name}</div>
                  </div>
                  <div className="pt-2 mt-2 border-t border-[#f0ece3] flex items-center justify-between">
                    <span className="font-mono-num font-bold text-[#143020] text-xs">{money(p.sellPrice)}</span>
                    <Badge tone={st <= 0 ? 'rose' : st <= p.minStock ? 'amber' : 'slate'}>{st <= 0 ? 'Épuisé' : `${st} u.`}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ------- Ticket / Panier en cours ------- */}
      <Card
        className="xl:sticky xl:top-0"
        title={<span className="flex items-center gap-2"><ShoppingCart className="w-3.5 h-3.5 text-[#143020]" /> Ticket de Caisse ({sum(lines, l => l.quantity)} art.)</span>}
        right={lines.length > 0 && <button onClick={reset} className="text-[11px] text-[#8a2626] font-semibold hover:underline cursor-pointer">Réinitialiser</button>}
      >
        {lines.length === 0 ? <Empty icon={<ShoppingCart className="w-6 h-6" />} text="Sélectionnez une référence dans le catalogue" /> : (
          <div className="space-y-3">
            <div className="divide-y divide-[#ece7dc] max-h-[34vh] overflow-y-auto pr-1">
              {lines.map(l => (
                <div key={l.variantId} className="py-2.5 first:pt-0">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#1c1a17] truncate">{l.product.name}</div>
                      <div className="font-mono-num text-[10px] text-[#7a7265]">{l.variant.sku} · {variantLabel(l.variant.size, l.variant.color)} (disp. {l.variant.stock})</div>
                    </div>
                    <button onClick={() => setCart(c => c.filter(x => x.variantId !== l.variantId))} className="text-[#857d6f] hover:text-[#8a2626] cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center border border-[#cfc7b8] rounded-[4px] bg-[#faf8f4]">
                      <button onClick={() => qty(l, -1)} className="p-1 cursor-pointer hover:bg-[#eae4d7]"><Minus className="w-3 h-3" /></button>
                      <span className="w-7 text-center font-mono-num text-xs font-bold">{l.quantity}</span>
                      <button onClick={() => qty(l, 1)} className="p-1 cursor-pointer hover:bg-[#eae4d7]"><Plus className="w-3 h-3" /></button>
                    </div>
                    <input type="number" min={0} value={l.unitPrice} onChange={e => setLine(l.variantId, { unitPrice: Math.max(0, +e.target.value) })} className="w-22 rounded-[4px] border border-[#cfc7b8] px-2 py-1 font-mono-num text-xs" title="Prix unitaire" />
                    <input type="number" min={0} value={l.discount || ''} placeholder="Remise" onChange={e => setLine(l.variantId, { discount: Math.max(0, +e.target.value) })} className="w-18 rounded-[4px] border border-[#cfc7b8] px-2 py-1 font-mono-num text-xs" title="Remise ligne" />
                    <div className="ml-auto font-mono-num font-bold text-xs">{money(lineTotal({ ...l, name: '', size: '', color: '', sku: '', buyPrice: 0 }))}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#dcd5c7]">
              <Field label="Compte Client" className="col-span-2">
                <div className="flex gap-1.5">
                  <Select value={customerId} onChange={e => { setCustomerId(e.target.value); setPoints(''); }}>
                    <option value="">— Vente comptoir (client de passage) —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.fullName} ({c.phone})</option>)}
                  </Select>
                  <Btn onClick={() => setNewCust(true)} title="Créer une fiche client"><UserPlus className="w-3.5 h-3.5" /></Btn>
                </div>
              </Field>
              {!customerId && <Field label="Intitulé client sur reçu (optionnel)" className="col-span-2"><Input value={walkIn} onChange={e => setWalkIn(e.target.value)} placeholder="Nom du client" /></Field>}
              {customer && customer.loyaltyPoints > 0 && (
                <Field label={`Points fidélité (${customer.loyaltyPoints} pts disponibles)`} className="col-span-2" hint={`1 pt = ${money(settings.loyaltyValuePoint)}`}>
                  <div className="flex gap-1.5">
                    <Input type="number" min={0} max={customer.loyaltyPoints} value={points} onChange={e => setPoints(e.target.value)} placeholder="0" />
                    <Btn onClick={() => setPoints(String(Math.min(customer.loyaltyPoints, Math.floor(base / settings.loyaltyValuePoint))))}><Gift className="w-3.5 h-3.5" /> Utiliser max</Btn>
                  </div>
                </Field>
              )}
              <Field label="Commercial(e)"><Select value={sellerId} onChange={e => setSellerId(e.target.value)}><option value="">—</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
              <Field label="Canal de vente"><Select value={channel} onChange={e => setChannel(e.target.value as Sale['channel'])}><option value="boutique">Comptoir Boutique</option><option value="whatsapp">Commande WhatsApp</option><option value="livraison">Expédition Coursier</option></Select></Field>
              <Field label="Remise globale (FCFA)" className="col-span-2"><div className="relative"><Percent className="w-3.5 h-3.5 text-[#7a7265] absolute right-3 top-1/2 -translate-y-1/2" /><Input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></div></Field>
            </div>

            <div className="rounded-[4px] bg-[#faf8f4] border border-[#cfc7b8] p-3 space-y-1 text-xs">
              <Row l="Total brut HT" v={money(subtotal)} />
              {(lineDisc + globalDisc) > 0 && <Row l="Remises accordées" v={`-${money(lineDisc + globalDisc)}`} />}
              {tax > 0 && <Row l={`TVA (${settings.vatRate}%)`} v={money(tax)} />}
              <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-[#dcd5c7]">
                <span className="font-bold uppercase tracking-wider text-[11px] text-[#12241a]">Net à payer</span>
                <span className="font-mono-num text-xl font-bold text-[#143020]">{money(total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#6e6659]">
                Mode de règlement {allEmpty && <span className="normal-case font-normal text-[#857d6f]">(champ vide = encaissement intégral)</span>}
              </div>
              {pays.map((p, i) => (
                <div key={i} className="flex gap-1.5">
                  <Select value={p.method} onChange={e => setPays(r => r.map((x, j) => j === i ? { ...x, method: e.target.value as PaymentMethod } : x))} className="!w-40">{PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</Select>
                  <Input type="number" min={0} value={p.amount} placeholder={String(i === 0 ? total : '')} onChange={e => setPays(r => r.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} className="font-mono-num" />
                  {pays.length > 1 && <Btn onClick={() => setPays(r => r.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></Btn>}
                </div>
              ))}
              <div className="flex flex-wrap gap-1">
                <Btn size="sm" onClick={() => setPays(r => [...r, { method: 'Espèces', amount: '' }])}><Plus className="w-3 h-3" /> Règlement mixte</Btn>
                {[2500, 5000, 10000, 20000].map(v => <Btn key={v} size="sm" onClick={() => setPays(r => r.map((x, j) => j === 0 ? { ...x, method: 'Espèces', amount: String(v) } : x))} className="font-mono-num">{num(v)}</Btn>)}
                <Btn size="sm" onClick={() => setPays([{ method: pays[0]?.method || 'Wave', amount: String(total) }])}>Montant exact</Btn>
              </div>
              {change > 0 && <div className="text-xs font-bold text-[#785314] bg-[#fbf4e4] border border-[#e6d1a4] rounded-[4px] px-3 py-2 font-mono-num">Monnaie à rendre : {money(change)}</div>}
              {remaining > 0 && (
                <div className="rounded-[4px] bg-[#fbeeee] border border-[#e8c3c3] p-2.5 space-y-2">
                  <div className="text-xs font-bold text-[#8a2626]">Créance client — Solde restant : {money(remaining)} {!customerId && <span className="font-normal">(sélection client requise)</span>}</div>
                  <Field label="Date d'échéance"><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></Field>
                </div>
              )}
              <Textarea rows={1} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observation sur la pièce (optionnel)" />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <Btn variant="primary" size="lg" className="col-span-2 font-mono-num" onClick={() => submit('sale')}><Check className="w-4 h-4" /> Valider ({money(paid)})</Btn>
              <Btn size="lg" onClick={() => submit('proforma')} title="Émettre un devis proforma sans déduire du stock"><FileText className="w-3.5 h-3.5" /> Proforma</Btn>
            </div>
            <div className="text-[10px] text-[#857d6f] text-center">Opérateur caisse : {currentUser?.name}</div>
          </div>
        )}
      </Card>

      {/* ------- Choix de variante ------- */}
      <Modal open={!!pick} onClose={() => setPick(null)} title={pick ? `Sélection de déclinaison — ${pick.name}` : ''} size="md">
        {pick && (
          <div className="space-y-3">
            <div className="text-xs text-[#6e6659]">{pick.category} · {pick.material} · <b className="font-mono-num text-[#143020]">{money(pick.sellPrice)}</b></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pick.variants.map(v => {
                const inCart = cart.find(l => l.variantId === v.id)?.quantity || 0;
                return (
                  <button key={v.id} disabled={v.stock - inCart <= 0} onClick={() => { addToCart(pick, v); }}
                    className="rounded-[4px] border border-[#dcd5c7] p-2.5 text-left hover:border-[#143020] hover:bg-[#faf8f4] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                    <div className="font-mono-num text-[10px] text-[#7a7265]">{v.sku}</div>
                    <div className="font-bold text-xs text-[#1c1a17] mt-0.5">{v.size}</div>
                    <div className="text-[11px] text-[#5c5549]">{v.color}</div>
                    <div className="mt-1.5 flex items-center gap-1"><Badge tone={v.stock <= 0 ? 'rose' : v.stock <= 2 ? 'amber' : 'emerald'}>{v.stock} disp.</Badge>{inCart > 0 && <Badge tone="sky">{inCart} panier</Badge>}</div>
                  </button>
                );
              })}
            </div>
            <div className="text-right"><Btn variant="primary" onClick={() => setPick(null)}>Fermer</Btn></div>
          </div>
        )}
      </Modal>

      {/* ------- Nouveau client ------- */}
      <Modal open={newCust} onClose={() => setNewCust(false)} title="Nouvelle fiche client" size="sm" footer={<><Btn onClick={() => setNewCust(false)}>Annuler</Btn><Btn variant="primary" onClick={saveCustomer}>Enregistrer</Btn></>}>
        <div className="space-y-3">
          <Field label="Nom complet"><Input value={nc.fullName} onChange={e => setNc({ ...nc, fullName: e.target.value })} /></Field>
          <Field label="Téléphone / WhatsApp"><Input value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} placeholder="77 000 00 00" /></Field>
          <Field label="Quartier / Adresse"><Input value={nc.address} onChange={e => setNc({ ...nc, address: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* ------- Vente enregistrée ------- */}
      <Modal open={!!done} onClose={() => setDone(null)} title={done?.docType === 'proforma' ? 'Devis Proforma émis' : 'Pièce de vente validée'} size="sm"
        footer={<Btn variant="primary" onClick={() => { setDone(null); scanRef.current?.focus(); }}>Nouvelle saisie</Btn>}>
        {done && (
          <div className="space-y-3 text-center">
            <div className="font-mono-num text-2xl font-bold text-[#143020]">{money(done.total)}</div>
            <div className="font-mono-num text-xs text-[#6e6659]">{done.number} · {done.customerName}</div>
            {done.amountRemaining > 0 && done.docType === 'sale' && <Badge tone="amber">Solde à percevoir : {money(done.amountRemaining)}</Badge>}
            {(done.cashReturned || 0) > 0 && <div className="font-mono-num text-xs font-bold text-[#785314]">Monnaie rendue : {money(done.cashReturned)}</div>}
            <div className="grid grid-cols-1 gap-2 pt-2">
              <Btn variant="dark" onClick={() => printReceipt(done, settings)}><Printer className="w-3.5 h-3.5" /> Imprimer ticket thermique (80mm)</Btn>
              <Btn onClick={() => printInvoice(done, settings)}><FileText className="w-3.5 h-3.5" /> Éditer facture A4</Btn>
              <Btn onClick={() => wa(done)}><MessageCircle className="w-3.5 h-3.5 text-[#1f6b3f]" /> Transmettre sur WhatsApp</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const Row: React.FC<{ l: string; v: string }> = ({ l, v }) => <div className="flex justify-between text-[#5c5549]"><span>{l}</span><span className="font-mono-num font-semibold text-[#1c1a17]">{v}</span></div>;
