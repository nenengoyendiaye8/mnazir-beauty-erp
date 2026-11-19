import React, { useState } from 'react';
import { ShieldCheck, UserPlus, Key, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { useErp } from '../store';
import type { AppUser, Role } from '../types';
import { PageHeader, Card, Btn, Badge, Modal, Field, Input, Select, Table, Td } from './ui';

export const UsersModule: React.FC = () => {
  const { users, currentUser, saveUser, deleteUser, toast } = useErp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);

  const [form, setForm] = useState<{
    name: string;
    username: string;
    pin: string;
    role: Role;
    active: boolean;
  }>({
    name: '',
    username: '',
    pin: '',
    role: 'caissier',
    active: true
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', username: '', pin: '', role: 'caissier', active: true });
    setIsModalOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setForm({
      name: u.name,
      username: u.username,
      pin: u.pin,
      role: u.role,
      active: u.active
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.pin.trim()) {
      return toast('Tous les champs sont requis', 'err');
    }
    saveUser({
      id: editing ? editing.id : undefined,
      name: form.name.trim(),
      username: form.username.trim(),
      pin: form.pin.trim(),
      role: form.role,
      active: form.active
    });
    toast(editing ? 'Utilisateur modifié' : 'Utilisateur créé avec succès');
    setIsModalOpen(false);
  };

  const handleDelete = (u: AppUser) => {
    if (u.id === currentUser?.id) return toast('Impossible de supprimer votre propre compte', 'err');
    if (confirm(`Supprimer l'accès de ${u.name} ?`)) {
      deleteUser(u.id);
      toast('Utilisateur supprimé');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestion des Comptes & Droits d'Accès"
        subtitle="Administrateurs, gérants et caissiers avec codes PIN sécurisés"
        icon={<ShieldCheck className="w-5 h-5" />}
        actions={<Btn variant="primary" onClick={openNew}><UserPlus className="w-4 h-4" /> Nouvel Utilisateur</Btn>}
      />

      <Card>
        <Table head={['Nom & Identifiant', 'Rôle & Permissions', 'Code PIN', 'Statut', { label: 'Actions', right: true }]}>
          {users.map(u => (
            <tr key={u.id}>
              <Td>
                <div className="font-bold text-slate-900">{u.name}</div>
                <div className="text-xs text-slate-500 font-mono">@{u.username}</div>
              </Td>
              <Td>
                <Badge tone={u.role === 'admin' ? 'rose' : u.role === 'gerant' ? 'amber' : 'emerald'}>
                  {u.role.toUpperCase()}
                </Badge>
              </Td>
              <Td>
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">•••• ({u.pin})</span>
              </Td>
              <Td>
                {u.active ? (
                  <Badge tone="emerald"><CheckCircle2 className="w-3 h-3" /> Actif</Badge>
                ) : (
                  <Badge tone="rose"><XCircle className="w-3 h-3" /> Bloqué</Badge>
                )}
              </Td>
              <Td right className="space-x-1 whitespace-nowrap">
                <Btn size="sm" variant="ghost" onClick={() => openEdit(u)}>Modifier</Btn>
                {u.id !== currentUser?.id && (
                  <Btn size="sm" variant="danger" onClick={() => handleDelete(u)}></Btn>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Modifier Compte" : "Créer un Compte Utilisateur"} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Nom complet *">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Fatou Ndiaye" required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Identifiant de connexion *">
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ex: fatou" required />
            </Field>
            <Field label="Code PIN (4 chiffres) *">
              <Input type="password" maxLength={8} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} placeholder="1234" required />
            </Field>
          </div>
          <Field label="Rôle & Permissions *">
            <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>
              <option value="admin">Administrateur (Accès illimité à tous les modules)</option>
              <option value="gerant">Gérant (Ventes, Stocks, Achats, Finances)</option>
              <option value="caissier">Caissier (Caisse POS, Ventes comptoir & Sur-mesure)</option>
            </Select>
          </Field>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="userActive" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded" />
            <label htmlFor="userActive" className="text-sm font-semibold text-slate-700 cursor-pointer">Compte autorisé à se connecter</label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Btn type="button" onClick={() => setIsModalOpen(false)}>Annuler</Btn>
            <Btn variant="primary" type="submit">Enregistrer l'accès</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
};
