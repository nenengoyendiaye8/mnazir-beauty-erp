import React, { useState } from 'react';
import { Settings as Cog, Store, Receipt, RefreshCw, Download, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { useErp } from '../store';
import { PageHeader, Card, Btn, Badge, Field, Input, Textarea } from './ui';
import { download, todayStr } from '../utils/helpers';

export const SettingsModule: React.FC = () => {
  const { settings, updateSettings, exportData, importData, resetAll, loadDemo, toast } = useErp();

  const [form, setForm] = useState({
    name: settings.name,
    tagline: settings.tagline,
    phones: settings.phones.join(' / '),
    address: settings.address,
    city: settings.city,
    email: settings.email || '',
    ninea: settings.ninea || '',
    rccm: settings.rccm || '',
    openingHours: settings.openingHours,
    receiptFooter: settings.receiptFooter,
    enableVat: settings.enableVat,
    vatRate: settings.vatRate,
    loyaltyPer1000: settings.loyaltyPer1000,
    loyaltyValuePoint: settings.loyaltyValuePoint
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ...form,
      phones: form.phones.split('/').map(p => p.trim()).filter(Boolean),
      vatRate: Number(form.vatRate) || 18,
      loyaltyPer1000: Number(form.loyaltyPer1000) || 1,
      loyaltyValuePoint: Number(form.loyaltyValuePoint) || 100
    });
    toast('Paramètres de la boutique enregistrés !');
  };

  const handleBackup = () => {
    const json = exportData();
    download(`sauvegarde_bpb_erp_${todayStr()}.json`, json, 'application/json');
    toast('Fichier de sauvegarde exporté');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (importData(content)) {
        toast('Données restaurées avec succès !');
      } else {
        toast('Fichier de sauvegarde invalide', 'err');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="Paramètres de l'ERP & Boutique"
        subtitle="Mentions légales, tickets de caisse, TVA et sauvegardes"
        icon={<Cog className="w-5 h-5" />}
      />

      <form onSubmit={handleSave} className="space-y-5">
        <Card title={<span className="flex items-center gap-2"><Store className="w-4 h-4 text-emerald-700" /> Identité & Coordonnées</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nom de l'enseigne *">
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Slogan commercial">
              <Input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Field label="Numéros de téléphone (séparés par /)">
              <Input value={form.phones} onChange={e => setForm({ ...form, phones: e.target.value })} />
            </Field>
            <Field label="Adresse physique">
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <Field label="Ville / Pays">
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="N° NINEA (facultatif)">
              <Input value={form.ninea} onChange={e => setForm({ ...form, ninea: e.target.value })} />
            </Field>
            <Field label="N° Registre du Commerce (RCCM)">
              <Input value={form.rccm} onChange={e => setForm({ ...form, rccm: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-700" /> Tickets de Caisse & Fidélité</span>}>
          <Field label="Message de bas de ticket">
            <Textarea value={form.receiptFooter} onChange={e => setForm({ ...form, receiptFooter: e.target.value })} rows={2} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Field label="Points par tranche de 1 000 FCFA">
              <Input type="number" min="0" value={form.loyaltyPer1000} onChange={e => setForm({ ...form, loyaltyPer1000: Number(e.target.value) })} />
            </Field>
            <Field label="Valeur en FCFA d'un point fidelité">
              <Input type="number" min="0" value={form.loyaltyValuePoint} onChange={e => setForm({ ...form, loyaltyValuePoint: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3">
            <input
              type="checkbox"
              id="enableVat"
              checked={form.enableVat}
              onChange={e => setForm({ ...form, enableVat: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded"
            />
            <label htmlFor="enableVat" className="text-sm font-semibold text-slate-800 cursor-pointer">
              Appliquer la TVA sur les factures et tickets
            </label>
            {form.enableVat && (
              <div className="w-28 ml-auto">
                <Input type="number" value={form.vatRate} onChange={e => setForm({ ...form, vatRate: Number(e.target.value) })} />
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-end">
          <Btn variant="primary" size="lg" type="submit"><CheckCircle2 className="w-4 h-4" /> Enregistrer les Paramètres</Btn>
        </div>
      </form>

      {/* Sauvegardes & Danger zone */}
      <Card title="Gestion des Données & Sauvegardes">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Btn onClick={handleBackup}><Download className="w-4 h-4" /> Télécharger une Sauvegarde (JSON)</Btn>
            <label className="inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold px-3.5 py-2 text-[13px] bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <Upload className="w-4 h-4" /> Restaurer un fichier
              <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
            <Btn variant="ghost" onClick={() => { if (confirm('Recharger les données de démonstration ?')) { loadDemo(); toast('Données de démo chargées'); } }}>
              <RefreshCw className="w-4 h-4 text-emerald-600" /> Recharger Données de Démo
            </Btn>
            <Btn variant="danger" onClick={() => { if (confirm('Attention : réinitialiser toutes les données de l\'ERP à zéro ?')) { resetAll(); toast('Base réinitialisée'); } }}>
              <Trash2 className="w-4 h-4" /> Tout Vider (Démarrer à Zéro)
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
};
