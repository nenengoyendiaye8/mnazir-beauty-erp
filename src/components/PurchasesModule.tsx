import React, { useState } from 'react';
import { PackagePlus, Truck, CheckCircle, XCircle, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { useErp } from '../store';
import type { PurchaseItem, PaymentMethod } from '../types';
import { PAYMENT_METHODS } from '../types';
import { PageHeader, Card, Btn, Badge, Modal, Field, Input, Select, SearchBox, Stat, Table, Td, Empty } from './ui';
import { money, fdate, sum, todayStr } from '../utils/helpers';

export const PurchasesModule: React.FC = () => {
  const { purchases, suppliers, products, createPurchase, receivePurchase, cancelPurchase, addPurchasePayment, toast } = useErp();
  const [q, setQ] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [payModal, setPayModal] = useState<{ open: boolean; purchaseId: string; remaining: number }>({ open: false, purchaseId: '', remaining: 0 });
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Virement');

  // Formulaire Nouvel Achat
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [expectedDate, setExpectedDate] = useState('');
  const [freight, setFreight] = useState('0');
  const [notes, setNotes] = useState('');
  const [receiveNow, setReceiveNow] = useState(true);
  const [items, setItems] = useState<Array<{ productId: string; variantId: string; quantity: number; unitCost: number }>>([]);
  const [deposit, setDeposit] = useState('');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('Virement');

  const filtered = purchases.filter(p => p.number.toLowerCase().includes(q.toLowerCase()) || p.supplierName.toLowerCase().includes(q.toLowerCase()));

  const thisMonth = todayStr().slice(0, 7);
  const monthPurchases = sum(purchases.filter(p => p.date.startsWith(thisMonth) && p.status !== 'annule'), p => p.total);
  const inTransit = purchases.filter(p => p.status === 'commande').length;
  const debts = sum(purchases.filter(p => p.status !== 'annule'), p => Math.max(0, p.total - p.amountPaid));

  const addItemLine = () => {
    if (products.length === 0) return toast('Aucun article en catalogue', 'err');
    const p = products[0];
    const v = p.variants[0];
    setItems([...items, { productId: p.id, variantId: v?.id || '', quantity: 1, unitCost: p.buyPrice }]);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return toast('Veuillez sélectionner un fournisseur', 'err');
    if (items.length === 0) return toast('Ajoutez au moins un article', 'err');

    const purchaseItems: PurchaseItem[] = items.map(it => {
      const p = products.find(prod => prod.id === it.productId);
      const v = p?.variants.find(vr => vr.id === it.variantId);
      return {
        productId: it.productId,
        variantId: it.variantId,
        name: p?.name || 'Article',
        size: v?.size || '',
        color: v?.color || '',
        quantity: it.quantity,
        unitCost: it.unitCost
      };
    });

    try {
      createPurchase({
        supplierId,
        date,
        expectedDate: expectedDate || undefined,
        freight: Number(freight) || 0,
        notes: notes || undefined,
        items: purchaseItems,
        receiveNow,
        payment: deposit && Number(deposit) > 0 ? { amount: Number(deposit), method: depositMethod } : undefined
      });
      toast('Achat enregistré avec succès !');
      setIsModalOpen(false);
      setItems([]);
      setSupplierId('');
      setDeposit('');
    } catch (err: any) {
      toast(err.message || 'Erreur lors de l\'enregistrement', 'err');
    }
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast('Montant invalide', 'err');
    try {
      addPurchasePayment(payModal.purchaseId, { amount: amt, method: payMethod });
      toast('Paiement fournisseur enregistré !');
      setPayModal({ open: false, purchaseId: '', remaining: 0 });
      setPayAmount('');
    } catch (err: any) {
      toast(err.message || 'Erreur', 'err');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Achats & Arrivages Fournisseurs"
        subtitle="Suivi des commandes d'approvisionnement et stocks entrants"
        icon={<PackagePlus className="w-5 h-5" />}
        actions={<Btn variant="primary" onClick={() => { setIsModalOpen(true); if (items.length === 0) addItemLine(); }}>+ Nouvel Arrivage</Btn>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Commandes en transit" value={`${inTransit}`} sub="Arrivages en attente" icon={<Truck className="w-5 h-5" />} tone="amber" />
        <Stat label="Achats du mois" value={money(monthPurchases)} sub="Hors commandes annulées" icon={<Calendar className="w-5 h-5" />} tone="emerald" />
        <Stat label="Dettes Fournisseurs" value={money(debts)} sub="Montants restants à verser" icon={<AlertCircle className="w-5 h-5" />} tone="rose" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
          <SearchBox value={q} onChange={setQ} placeholder="Rechercher par N° ou fournisseur..." className="max-w-md" />
        </div>

        {filtered.length === 0 ? (
          <Empty icon={<PackagePlus className="w-10 h-10" />} text="Aucun achat enregistré pour le moment." />
        ) : (
          <Table head={['N° Achat', 'Date', 'Fournisseur', 'Total & Fret', 'Statut', 'Reste à Payer', { label: 'Actions', right: true }]}>
            {filtered.map(p => {
              const remaining = Math.max(0, p.total - p.amountPaid);
              return (
                <tr key={p.id}>
                  <Td className="font-bold text-slate-900">{p.number}</Td>
                  <Td>{fdate(p.date)}</Td>
                  <Td className="font-semibold text-emerald-800">{p.supplierName}</Td>
                  <Td>
                    <div>{money(p.total)}</div>
                    {p.freight > 0 && <span className="text-[11px] text-slate-400">dont {money(p.freight)} fret</span>}
                  </Td>
                  <Td>
                    {p.status === 'recu' && <Badge tone="emerald"><CheckCircle className="w-3 h-3" /> Reçu en stock</Badge>}
                    {p.status === 'commande' && <Badge tone="amber"><Truck className="w-3 h-3" /> En transit</Badge>}
                    {p.status === 'annule' && <Badge tone="rose"><XCircle className="w-3 h-3" /> Annulé</Badge>}
                  </Td>
                  <Td>
                    {remaining > 0 ? (
                      <span className="font-bold text-rose-600">{money(remaining)}</span>
                    ) : (
                      <Badge tone="emerald">Soldé</Badge>
                    )}
                  </Td>
                  <Td right className="space-x-1 whitespace-nowrap">
                    {p.status === 'commande' && (
                      <Btn size="sm" variant="primary" onClick={() => { receivePurchase(p.id); toast('Articles ajoutés au stock avec succès !'); }}>
                        Réceptionner
                      </Btn>
                    )}
                    {remaining > 0 && p.status !== 'annule' && (
                      <Btn size="sm" variant="amber" onClick={() => setPayModal({ open: true, purchaseId: p.id, remaining })}>
                        <DollarSign className="w-3 h-3" /> Payer
                      </Btn>
                    )}
                    {p.status !== 'annule' && (
                      <Btn size="sm" variant="danger" onClick={() => { if (confirm('Annuler cet achat ?')) { cancelPurchase(p.id); toast('Achat annulé'); } }}>
                        Annuler
                      </Btn>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Modal Nouvel Achat */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="Créer un Bon d'Achat / Arrivage" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fournisseur *">
              <Select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                <option value="">Sélectionner un fournisseur...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
              </Select>
            </Field>
            <Field label="Date d'achat *">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </Field>
          </div>

          <div className="border border-slate-200 rounded-[5px] p-3 bg-slate-50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase text-slate-600">Articles commandés</span>
              <Btn size="sm" type="button" onClick={addItemLine}>+ Ajouter un article</Btn>
            </div>

            {items.map((it, idx) => {
              const p = products.find(prod => prod.id === it.productId);
              return (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2 rounded-lg border border-slate-200 items-end">
                  <div className="sm:col-span-2">
                    <span className="text-[11px] text-slate-500 block mb-1">Modèle & Variante</span>
                    <Select
                      value={`${it.productId}__${it.variantId}`}
                      onChange={e => {
                        const [pid, vid] = e.target.value.split('__');
                        const pr = products.find(x => x.id === pid);
                        const next = [...items];
                        next[idx] = { ...next[idx], productId: pid, variantId: vid, unitCost: pr?.buyPrice || 0 };
                        setItems(next);
                      }}
                    >
                      {products.flatMap(prod =>
                        prod.variants.map(vr => (
                          <option key={`${prod.id}__${vr.id}`} value={`${prod.id}__${vr.id}`}>
                            {prod.name} ({vr.size} - {vr.color})
                          </option>
                        ))
                      )}
                    </Select>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">Quantité</span>
                    <Input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={e => {
                        const next = [...items];
                        next[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
                        setItems(next);
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <span className="text-[11px] text-slate-500 block mb-1">Coût unitaire (FCFA)</span>
                      <Input
                        type="number"
                        min="0"
                        value={it.unitCost}
                        onChange={e => {
                          const next = [...items];
                          next[idx].unitCost = Number(e.target.value) || 0;
                          setItems(next);
                        }}
                      />
                    </div>
                    {items.length > 1 && (
                      <Btn size="sm" variant="danger" type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                        
                      </Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Frais de transport / Fret (FCFA)">
              <Input type="number" min="0" value={freight} onChange={e => setFreight(e.target.value)} />
            </Field>
            <Field label="Acompte versé">
              <Input type="number" min="0" placeholder="0" value={deposit} onChange={e => setDeposit(e.target.value)} />
            </Field>
            <Field label="Mode de règlement">
              <Select value={depositMethod} onChange={e => setDepositMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-3 rounded-[5px]">
            <input
              type="checkbox"
              id="receiveNow"
              checked={receiveNow}
              onChange={e => setReceiveNow(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <label htmlFor="receiveNow" className="text-sm font-semibold text-emerald-950 cursor-pointer">
              Réceptionner directement en stock (les articles seront immédiatement disponibles dans la boutique)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Btn type="button" onClick={() => setIsModalOpen(false)}>Annuler</Btn>
            <Btn variant="primary" type="submit">Enregistrer l'Achat</Btn>
          </div>
        </form>
      </Modal>

      {/* Modal Règlement */}
      <Modal open={payModal.open} onClose={() => setPayModal({ open: false, purchaseId: '', remaining: 0 })} title="Effectuer un paiement fournisseur" size="sm">
        <form onSubmit={handlePay} className="space-y-4">
          <div>Reste à payer : <strong className="text-rose-600 font-extrabold">{money(payModal.remaining)}</strong></div>
          <Field label="Montant du versement (FCFA)">
            <Input type="number" min="1" max={payModal.remaining} value={payAmount} onChange={e => setPayAmount(e.target.value)} required />
          </Field>
          <Field label="Mode de paiement">
            <Select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Btn type="button" onClick={() => setPayModal({ open: false, purchaseId: '', remaining: 0 })}>Fermer</Btn>
            <Btn variant="primary" type="submit">Valider le paiement</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
};
