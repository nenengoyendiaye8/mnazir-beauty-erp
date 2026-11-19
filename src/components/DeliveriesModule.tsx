import React, { useState } from 'react';
import { Truck, CheckCircle2, Clock, XCircle, MapPin, Phone, MessageSquare, Printer, Plus } from 'lucide-react';
import { useErp } from '../store';
import type { Delivery } from '../types';
import { PageHeader, Card, Btn, Badge, Modal, Field, Input, Select, Textarea, Stat, Table, Td, Empty } from './ui';
import { money, fdate, openWhatsApp, todayStr } from '../utils/helpers';
import { printDeliverySlip } from '../utils/print';

export const DeliveriesModule: React.FC = () => {
  const { deliveries, settings, staff, addDelivery, updateDelivery, deleteDelivery, toast } = useErp();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Delivery | null>(null);

  const couriersList = [...settings.couriers, ...staff.filter(s => s.role === 'Livreur').map(s => s.name)];

  const [form, setForm] = useState({
    date: todayStr(),
    customerName: '',
    customerPhone: '',
    address: '',
    neighborhood: settings.neighborhoods[0] || 'Parcelles Assainies',
    fee: '2000',
    courier: couriersList[0] || 'Tiak-Tiak',
    amountToCollect: '0',
    notes: ''
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      date: todayStr(),
      customerName: '',
      customerPhone: '',
      address: '',
      neighborhood: settings.neighborhoods[0] || 'Parcelles Assainies',
      fee: '2000',
      courier: couriersList[0] || 'Tiak-Tiak',
      amountToCollect: '0',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const openEdit = (d: Delivery) => {
    setEditing(d);
    setForm({
      date: d.date,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      address: d.address,
      neighborhood: d.neighborhood,
      fee: String(d.fee),
      courier: d.courier,
      amountToCollect: String(d.amountToCollect),
      notes: d.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      return toast('Nom et téléphone client obligatoires', 'err');
    }
    if (editing) {
      updateDelivery({
        ...editing,
        ...form,
        fee: Number(form.fee) || 0,
        amountToCollect: Number(form.amountToCollect) || 0
      });
      toast('Livraison mise à jour');
    } else {
      addDelivery({
        ...form,
        fee: Number(form.fee) || 0,
        amountToCollect: Number(form.amountToCollect) || 0,
        status: 'preparation'
      });
      toast('Course enregistrée !');
    }
    setIsModalOpen(false);
  };

  const changeStatus = (d: Delivery, status: Delivery['status']) => {
    updateDelivery({ ...d, status });
    toast(`Statut passé à : ${status}`);
  };

  const sendWhatsApp = (d: Delivery) => {
    const text = `Bonjour ${d.customerName}, votre commande chez Boutigou Pays Bi (${settings.phones[0]}) est en cours de livraison à ${d.neighborhood}.\nLivreur : ${d.courier}.\nMontant à préparer : ${money(d.amountToCollect + d.fee)}. Merci de votre fidélité !`;
    openWhatsApp(d.customerPhone, text);
  };

  const inPrep = deliveries.filter(d => d.status === 'preparation');
  const inRoute = deliveries.filter(d => d.status === 'en_route');
  const delivered = deliveries.filter(d => d.status === 'livre');
  const cancelled = deliveries.filter(d => d.status === 'annule');

  const totalToCollect = inPrep.concat(inRoute).reduce((acc, d) => acc + d.amountToCollect, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expéditions & Livraisons Dakar"
        subtitle="Gestion des coursiers tiak-tiak, adresses et encaissements à la livraison"
        icon={<Truck className="w-5 h-5" />}
        actions={
          <div className="flex gap-2">
            <Btn variant={viewMode === 'kanban' ? 'primary' : 'ghost'} onClick={() => setViewMode('kanban')}>Tableau Kanban</Btn>
            <Btn variant={viewMode === 'list' ? 'primary' : 'ghost'} onClick={() => setViewMode('list')}>Liste</Btn>
            <Btn variant="primary" onClick={openNew}>+ Nouvelle Livraison</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Livraisons en cours" value={`${inPrep.length + inRoute.length}`} sub={`${inRoute.length} actuellement en route`} icon={<Clock className="w-5 h-5" />} tone="amber" />
        <Stat label="Montants à encaisser" value={money(totalToCollect)} sub="Par les livreurs sur le terrain" icon={<Truck className="w-5 h-5" />} tone="emerald" />
        <Stat label="Livrées avec succès" value={`${delivered.length}`} sub="Commandes acheminées" icon={<CheckCircle2 className="w-5 h-5" />} tone="slate" />
      </div>

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* En préparation */}
          <div className="bg-slate-100/70 p-3 rounded-md border border-slate-200 space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="font-bold text-xs uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> En Préparation ({inPrep.length})
              </span>
            </div>
            {inPrep.map(d => (
              <DeliveryCard key={d.id} d={d} onEdit={() => openEdit(d)} onPrint={() => printDeliverySlip(d, settings)} onWa={() => sendWhatsApp(d)} onNext={() => changeStatus(d, 'en_route')} nextLabel="Départ en route " />
            ))}
          </div>

          {/* En route */}
          <div className="bg-slate-100/70 p-3 rounded-md border border-slate-200 space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="font-bold text-xs uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <Truck className="w-4 h-4" /> En Cours de Route ({inRoute.length})
              </span>
            </div>
            {inRoute.map(d => (
              <DeliveryCard key={d.id} d={d} onEdit={() => openEdit(d)} onPrint={() => printDeliverySlip(d, settings)} onWa={() => sendWhatsApp(d)} onNext={() => changeStatus(d, 'livre')} nextLabel="Marquer Livré " />
            ))}
          </div>

          {/* Livré */}
          <div className="bg-slate-100/70 p-3 rounded-md border border-slate-200 space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Livrées ({delivered.length})
              </span>
            </div>
            {delivered.slice(0, 10).map(d => (
              <DeliveryCard key={d.id} d={d} onEdit={() => openEdit(d)} onPrint={() => printDeliverySlip(d, settings)} onWa={() => sendWhatsApp(d)} />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <Table head={['N° Course', 'Client', 'Quartier & Adresse', 'Livreur', 'Frais & À Encaisser', 'Statut', { label: 'Actions', right: true }]}>
            {deliveries.map(d => (
              <tr key={d.id}>
                <Td className="font-bold text-slate-900">{d.number}</Td>
                <Td>
                  <div className="font-bold">{d.customerName}</div>
                  <div className="text-xs text-slate-500">{d.customerPhone}</div>
                </Td>
                <Td>
                  <div className="font-semibold text-emerald-900">{d.neighborhood}</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs">{d.address}</div>
                </Td>
                <Td><Badge tone="slate">{d.courier}</Badge></Td>
                <Td>
                  <div>Frais: {money(d.fee)}</div>
                  {d.amountToCollect > 0 && <span className="font-bold text-rose-600">À encaisser: {money(d.amountToCollect)}</span>}
                </Td>
                <Td>
                  {d.status === 'preparation' && <Badge tone="amber">En préparation</Badge>}
                  {d.status === 'en_route' && <Badge tone="sky">En route</Badge>}
                  {d.status === 'livre' && <Badge tone="emerald">Livré</Badge>}
                  {d.status === 'annule' && <Badge tone="rose">Annulé</Badge>}
                </Td>
                <Td right className="space-x-1 whitespace-nowrap">
                  <Btn size="sm" variant="ghost" title="Bon de livraison" onClick={() => printDeliverySlip(d, settings)}><Printer className="w-3.5 h-3.5" /></Btn>
                  <Btn size="sm" variant="ghost" title="WhatsApp" onClick={() => sendWhatsApp(d)}><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /></Btn>
                  <Btn size="sm" variant="ghost" onClick={() => openEdit(d)}>Modifier</Btn>
                  <Btn size="sm" variant="danger" onClick={() => { if (confirm('Supprimer ?')) deleteDelivery(d.id); }}></Btn>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* Modal Création / Édition */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Modifier la Course" : "Nouvelle Expédition / Livraison"} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom du destinataire *">
              <Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required />
            </Field>
            <Field label="Téléphone WhatsApp *">
              <Input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} placeholder="77 000 00 00" required />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Quartier (Dakar) *">
              <Select value={form.neighborhood} onChange={e => setForm({ ...form, neighborhood: e.target.value })}>
                {settings.neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Adresse exacte">
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rue, Immeuble, repère..." />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Frais de livraison (FCFA)">
              <Input type="number" min="0" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} />
            </Field>
            <Field label="Montant articles à encaisser">
              <Input type="number" min="0" value={form.amountToCollect} onChange={e => setForm({ ...form, amountToCollect: e.target.value })} />
            </Field>
            <Field label="Livreur assigné">
              <Select value={form.courier} onChange={e => setForm({ ...form, courier: e.target.value })}>
                {couriersList.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Instructions particulières pour le livreur">
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Appeler avant d'arriver..." />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" onClick={() => setIsModalOpen(false)}>Annuler</Btn>
            <Btn variant="primary" type="submit">Valider la course</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const DeliveryCard: React.FC<{
  d: Delivery;
  onEdit: () => void;
  onPrint: () => void;
  onWa: () => void;
  onNext?: () => void;
  nextLabel?: string;
}> = ({ d, onEdit, onPrint, onWa, onNext, nextLabel }) => (
  <div className="bg-white rounded-[5px] border border-slate-200 p-3 shadow-sm hover:shadow transition space-y-2">
    <div className="flex justify-between items-start">
      <span className="font-extrabold text-xs text-emerald-800">{d.number}</span>
      <span className="text-[11px] text-slate-400">{fdate(d.date)}</span>
    </div>
    <div>
      <div className="font-bold text-sm text-slate-900">{d.customerName}</div>
      <div className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {d.customerPhone}</div>
      <div className="text-xs text-slate-700 flex items-center gap-1 mt-1 font-medium"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {d.neighborhood} ({d.address})</div>
    </div>
    <div className="bg-slate-50 p-2 rounded-lg text-xs space-y-1">
      <div className="flex justify-between">
        <span className="text-slate-500">Livreur :</span>
        <span className="font-semibold text-slate-800">{d.courier}</span>
      </div>
      {d.amountToCollect > 0 && (
        <div className="flex justify-between font-bold text-rose-600">
          <span>À encaisser :</span>
          <span>{money(d.amountToCollect)}</span>
        </div>
      )}
    </div>
    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
      <div className="space-x-1">
        <button onClick={onPrint} className="p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer" title="Imprimer Bon"><Printer className="w-3.5 h-3.5" /></button>
        <button onClick={onWa} className="p-1.5 text-emerald-600 hover:text-emerald-800 cursor-pointer" title="Informer par WhatsApp"><MessageSquare className="w-3.5 h-3.5" /></button>
        <button onClick={onEdit} className="p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer text-xs font-semibold">Modifier</button>
      </div>
      {onNext && nextLabel && (
        <Btn size="sm" variant="primary" onClick={onNext}>{nextLabel}</Btn>
      )}
    </div>
  </div>
);
