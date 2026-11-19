import React, { useState } from 'react';
import { Factory, Phone, MapPin, MessageSquare, AlertCircle } from 'lucide-react';
import { useErp } from '../store';
import type { Supplier } from '../types';
import { PageHeader, Card, Btn, Badge, Modal, Field, Input, Textarea, SearchBox, Stat, Table, Td, Empty } from './ui';
import { money, openWhatsApp } from '../utils/helpers';

export const SuppliersModule: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, toast } = useErp();
  const [q, setQ] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const [form, setForm] = useState({
    name: '',
    contact: '',
    phone: '',
    city: '',
    speciality: '',
    notes: ''
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', contact: '', phone: '', city: 'Dakar', speciality: '', notes: '' });
    setIsModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      contact: s.contact,
      phone: s.phone,
      city: s.city,
      speciality: s.speciality,
      notes: s.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Le nom du fournisseur est obligatoire', 'err');
    try {
      if (editing) {
        updateSupplier({ ...editing, ...form });
        toast('Fournisseur mis à jour');
      } else {
        addSupplier(form);
        toast('Fournisseur ajouté avec succès');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast(err.message || 'Erreur', 'err');
    }
  };

  const handleDelete = (s: Supplier) => {
    if (confirm(`Supprimer le fournisseur ${s.name} ?`)) {
      deleteSupplier(s.id);
      toast('Fournisseur supprimé');
    }
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.city.toLowerCase().includes(q.toLowerCase()) ||
    s.speciality.toLowerCase().includes(q.toLowerCase())
  );

  const totalDettes = suppliers.reduce((acc, s) => acc + (s.balanceDue || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Répertoire des Fournisseurs"
        subtitle="Grossistes et ateliers partenaires (Dakar, Bamako, Dubaï, Casablanca)"
        icon={<Factory className="w-5 h-5" />}
        actions={<Btn variant="primary" onClick={openNew}>+ Nouveau Fournisseur</Btn>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Stat label="Total Fournisseurs" value={`${suppliers.length}`} sub="Partenaires enregistrés" icon={<Factory className="w-5 h-5" />} tone="emerald" />
        <Stat label="Total Dettes Fournisseurs" value={money(totalDettes)} sub="Reste à leur régler" icon={<AlertCircle className="w-5 h-5" />} tone="rose" />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4">
          <SearchBox value={q} onChange={setQ} placeholder="Rechercher par nom, ville, spécialité..." className="max-w-md" />
        </div>

        {filtered.length === 0 ? (
          <Empty icon={<Factory className="w-10 h-10" />} text="Aucun fournisseur trouvé." />
        ) : (
          <Table head={['Nom / Établissement', 'Contact & Téléphone', 'Localisation', 'Spécialité', 'Solde Dû', { label: 'Actions', right: true }]}>
            {filtered.map(s => (
              <tr key={s.id}>
                <Td>
                  <div className="font-bold text-slate-900">{s.name}</div>
                  {s.notes && <div className="text-[11px] text-slate-400">{s.notes}</div>}
                </Td>
                <Td>
                  <div className="text-slate-800 font-medium">{s.contact}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {s.phone}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-1 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {s.city}
                  </div>
                </Td>
                <Td>
                  <Badge tone="slate">{s.speciality || 'Divers'}</Badge>
                </Td>
                <Td>
                  {s.balanceDue > 0 ? (
                    <span className="font-bold text-rose-600">{money(s.balanceDue)}</span>
                  ) : (
                    <Badge tone="emerald">À jour</Badge>
                  )}
                </Td>
                <Td right className="space-x-1 whitespace-nowrap">
                  {s.phone && (
                    <Btn size="sm" variant="ghost" title="WhatsApp" onClick={() => openWhatsApp(s.phone, `Bonjour ${s.contact || s.name}, concernant nos commandes chez Boutigou Pays Bi :`)}>
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={() => openEdit(s)}>Modifier</Btn>
                  <Btn size="sm" variant="danger" onClick={() => handleDelete(s)}></Btn>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Modifier Fournisseur" : "Ajouter un Fournisseur"} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Nom de l'entreprise / Atelier *">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Grossiste Sandaga" required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom du contact">
              <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Ex: Boubacar" />
            </Field>
            <Field label="Téléphone">
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Ex: 77 111 22 33" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Ville / Pays">
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Ex: Dakar - Sandaga" />
            </Field>
            <Field label="Spécialité">
              <Input value={form.speciality} onChange={e => setForm({ ...form, speciality: e.target.value })} placeholder="Ex: Bazin riche, Djallaba" />
            </Field>
          </div>
          <Field label="Notes particulières">
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Modalités de paiement, délais habituels..." />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" onClick={() => setIsModalOpen(false)}>Annuler</Btn>
            <Btn variant="primary" type="submit">Enregistrer</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
};
