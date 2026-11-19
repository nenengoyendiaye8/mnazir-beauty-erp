import React, { useState } from 'react';
import { UserCog, Trophy, DollarSign, Phone, CheckCircle, XCircle, Printer } from 'lucide-react';
import { useErp } from '../store';
import type { StaffMember } from '../types';
import { PageHeader, Card, Btn, Badge, Modal, Field, Input, Select, Stat, Table, Td, Empty } from './ui';
import { money, printHtml, sum, todayStr } from '../utils/helpers';

export const StaffModule: React.FC = () => {
  const { staff, sales, saveStaff, deleteStaff, settings, toast } = useErp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const [form, setForm] = useState<{
    name: string;
    role: StaffMember['role'];
    phone: string;
    salary: string;
    commissionRate: string;
    active: boolean;
  }>({
    name: '',
    role: 'Vendeur',
    phone: '',
    salary: '80000',
    commissionRate: '2',
    active: true
  });

  const thisMonth = todayStr().slice(0, 7);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', role: 'Vendeur', phone: '', salary: '80000', commissionRate: '2', active: true });
    setIsModalOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setForm({
      name: s.name,
      role: s.role,
      phone: s.phone,
      salary: String(s.salary),
      commissionRate: String(s.commissionRate),
      active: s.active
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Le nom est requis', 'err');
    saveStaff({
      id: editing ? editing.id : undefined,
      name: form.name,
      role: form.role,
      phone: form.phone,
      salary: Number(form.salary) || 0,
      commissionRate: Number(form.commissionRate) || 0,
      active: form.active
    });
    toast(editing ? 'Employé mis à jour' : 'Nouvel employé enregistré');
    setIsModalOpen(false);
  };

  const handleDelete = (s: StaffMember) => {
    if (confirm(`Supprimer ${s.name} ?`)) {
      deleteStaff(s.id);
      toast('Membre supprimé');
    }
  };

  // Calcul des commissions du mois
  const staffStats = staff.map(member => {
    const memberSales = sales.filter(s => s.sellerId === member.id && s.date.startsWith(thisMonth) && s.status !== 'cancelled' && s.docType === 'sale');
    const ca = sum(memberSales, s => s.total);
    const commission = Math.round(ca * (member.commissionRate / 100));
    const totalRemun = member.salary + commission;
    return { ...member, countSales: memberSales.length, ca, commission, totalRemun };
  });

  const totalMasseSalariale = sum(staffStats.filter(s => s.active), s => s.totalRemun);
  const topSeller = [...staffStats].filter(s => s.ca > 0).sort((a, b) => b.ca - a.ca)[0];

  const handlePrintSlip = (m: typeof staffStats[0]) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 500px; margin: 0 auto; border: 1px solid #ccc; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #15803d; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="color: #15803d; margin: 0;">${settings.name}</h2>
          <p style="font-size: 12px; color: #555; margin: 4px 0;">${settings.address} - ${settings.city}</p>
          <h3 style="margin-top: 15px;">BULLETIN DE PAIE - ${thisMonth}</h3>
        </div>
        <p><strong>Salarié(e) :</strong> ${m.name}</p>
        <p><strong>Poste :</strong> ${m.role} &nbsp;|&nbsp; <strong>Tél :</strong> ${m.phone}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="border-bottom: 1px solid #ddd; background: #f9f9f9;">
            <th style="text-align: left; padding: 8px;">Élément</th>
            <th style="text-align: right; padding: 8px;">Montant</th>
          </tr>
          <tr>
            <td style="padding: 8px;">Salaire de base</td>
            <td style="text-align: right; padding: 8px;">${money(m.salary)}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Ventes réalisées (${m.countSales} ventes)</td>
            <td style="text-align: right; padding: 8px;">${money(m.ca)}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Commission sur ventes (${m.commissionRate}%)</td>
            <td style="text-align: right; padding: 8px; color: #15803d; font-weight: bold;">+ ${money(m.commission)}</td>
          </tr>
          <tr style="border-top: 2px solid #15803d; font-weight: bold; font-size: 15px;">
            <td style="padding: 10px 8px;">NET À PERCEVOIR</td>
            <td style="text-align: right; padding: 10px 8px; color: #15803d;">${money(m.totalRemun)}</td>
          </tr>
        </table>
        <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px;">
          <div>Signature Employé</div>
          <div>Cachet & Direction</div>
        </div>
      </div>
    `;
    printHtml(html);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Personnel & Commissions Vendeurs"
        subtitle="Gestion de l'équipe commerciale, des salaires et primes sur ventes"
        icon={<UserCog className="w-5 h-5" />}
        actions={<Btn variant="primary" onClick={openNew}>+ Nouveau Membre</Btn>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Masse Salariale du mois" value={money(totalMasseSalariale)} sub="Salaires de base + Commissions" icon={<DollarSign className="w-5 h-5" />} tone="emerald" />
        <Stat label="Total Effectif Actif" value={`${staff.filter(s => s.active).length} employés`} sub="Équipe boutique & atelier" icon={<UserCog className="w-5 h-5" />} tone="slate" />
        <Stat
          label="Meilleur(e) Vendeur(se)"
          value={topSeller ? topSeller.name : 'Aucun'}
          sub={topSeller ? `${money(topSeller.ca)} de CA (${money(topSeller.commission)} prime)` : 'Pas encore de ventes'}
          icon={<Trophy className="w-5 h-5" />}
          tone="amber"
        />
      </div>

      <Card>
        <Table head={['Nom & Rôle', 'Contact', 'Salaire Base', 'Ventes du Mois', 'Commissions (%)', 'Total Net à Verser', { label: 'Actions', right: true }]}>
          {staffStats.map(m => (
            <tr key={m.id} className={!m.active ? 'opacity-50' : ''}>
              <Td>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  {m.name}
                  {topSeller?.id === m.id && <Trophy className="w-4 h-4 text-amber-500 inline" />}
                </div>
                <Badge tone={m.role === 'Gérant' ? 'emerald' : m.role === 'Couturier' ? 'sky' : 'slate'}>
                  {m.role}
                </Badge>
              </Td>
              <Td>
                <span className="text-xs text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {m.phone || '—'}</span>
              </Td>
              <Td className="font-semibold">{money(m.salary)}</Td>
              <Td>
                <div className="font-bold text-slate-800">{money(m.ca)}</div>
                <div className="text-[11px] text-slate-400">{m.countSales} vente(s)</div>
              </Td>
              <Td>
                <div className="font-bold text-emerald-700">+{money(m.commission)}</div>
                <div className="text-[11px] text-slate-400">({m.commissionRate}% de taux)</div>
              </Td>
              <Td>
                <span className="text-base font-extrabold text-emerald-900">{money(m.totalRemun)}</span>
              </Td>
              <Td right className="space-x-1 whitespace-nowrap">
                <Btn size="sm" variant="ghost" title="Imprimer fiche de paie" onClick={() => handlePrintSlip(m)}>
                  <Printer className="w-3.5 h-3.5" />
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => openEdit(m)}>Modifier</Btn>
                <Btn size="sm" variant="danger" onClick={() => handleDelete(m)}></Btn>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Modifier Employé" : "Ajouter un Employé"} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Nom complet *">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Rôle / Poste *">
              <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as StaffMember['role'] })}>
                <option value="Gérant">Gérant</option>
                <option value="Vendeur">Vendeur</option>
                <option value="Vendeuse">Vendeuse</option>
                <option value="Caissier">Caissier</option>
                <option value="Couturier">Couturier</option>
                <option value="Livreur">Livreur</option>
                <option value="Autre">Autre</option>
              </Select>
            </Field>
            <Field label="Téléphone">
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Salaire de base mensuel (FCFA)">
              <Input type="number" min="0" value={form.salary} onChange={e => setForm({ ...form, salary: e.target.value })} />
            </Field>
            <Field label="Taux de commission sur ventes (%)">
              <Input type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="staffActive" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded" />
            <label htmlFor="staffActive" className="text-sm font-semibold text-slate-700 cursor-pointer">Employé actif</label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Btn type="button" onClick={() => setIsModalOpen(false)}>Annuler</Btn>
            <Btn variant="primary" type="submit">Enregistrer</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
};
