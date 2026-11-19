import React, { useEffect, useState } from 'react';
import {
  Database, RefreshCw, UploadCloud, DownloadCloud, Terminal, Eye, EyeOff, Copy, Check, Server, Layers, ShieldCheck,
} from 'lucide-react';
import { useErp } from '../store';
import {
  DEFAULT_NEON_DATABASE_URL,
  NEON_AUTOSYNC_KEY,
  NEON_STORAGE_KEY,
  getSavedNeonUrl,
  initializeNeonSchema,
  runCustomSqlQuery,
  sanitizeNeonUrl,
  testNeonConnection,
  type NeonConnectionStatus,
} from '../services/neonService';
import { Badge, Btn, Card, Field, Input, PageHeader, Stat, Table, Td, Textarea } from './ui';

export const NeonDatabaseModule: React.FC = () => {
  const {
    products, customers, sales, orders, deliveries, expenses,
    neonSyncStatus, lastNeonSync, pushToNeon, pullFromNeon, toast,
  } = useErp();

  const [url, setUrl] = useState(() => getSavedNeonUrl());
  const [showPwd, setShowPwd] = useState(false);
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem(NEON_AUTOSYNC_KEY) !== 'false');
  const [status, setStatus] = useState<NeonConnectionStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [sqlQuery, setSqlQuery] = useState(
    'SELECT name, category, sell_price, stock_total FROM mnazir_beauty_products ORDER BY sell_price DESC LIMIT 10;'
  );
  const [sqlResult, setSqlResult] = useState<{ rows: Record<string, unknown>[]; durationMs: number; err?: string } | null>(null);

  const runTest = async (targetUrl = url) => {
    setBusy('test');
    const clean = sanitizeNeonUrl(targetUrl);
    const res = await testNeonConnection(clean);
    setStatus(res);
    setBusy(null);
    return res;
  };

  useEffect(() => {
    runTest(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveUrl = async () => {
    const clean = sanitizeNeonUrl(url);
    localStorage.setItem(NEON_STORAGE_KEY, clean);
    setUrl(clean);
    const res = await runTest(clean);
    if (res.success) {
      toast('Connexion PostgreSQL Neon enregistrée et vérifiée');
    } else {
      toast(res.message, 'err');
    }
  };

  const handleRestoreDefault = async () => {
    localStorage.setItem(NEON_STORAGE_KEY, DEFAULT_NEON_DATABASE_URL);
    setUrl(DEFAULT_NEON_DATABASE_URL);
    const res = await runTest(DEFAULT_NEON_DATABASE_URL);
    if (res.success) toast('Base Cloud PostgreSQL officielle connectée');
  };

  const toggleAutoSync = (checked: boolean) => {
    setAutoSync(checked);
    localStorage.setItem(NEON_AUTOSYNC_KEY, checked ? 'true' : 'false');
    toast(checked ? 'Synchronisation temps réel activée' : 'Synchronisation temps réel désactivée');
  };

  const handleInitSchema = async () => {
    setBusy('schema');
    try {
      await initializeNeonSchema(url);
      await runTest(url);
      toast('Schéma SQL (7 tables mnazir_beauty_*) initialisé avec succès');
    } catch (e) {
      toast((e as Error).message || 'Erreur lors de la création des tables', 'err');
    }
    setBusy(null);
  };

  const handlePush = async () => {
    setBusy('push');
    const ok = await pushToNeon(url);
    await runTest(url);
    setBusy(null);
    if (ok) toast('Toutes les données M.Nazir_Beauty ont été envoyées vers Neon Cloud SQL');
    else toast('Échec de l\'envoi vers Neon Cloud SQL', 'err');
  };

  const handlePull = async () => {
    setBusy('pull');
    const ok = await pullFromNeon(url);
    await runTest(url);
    setBusy(null);
    if (ok) toast('Données rechargées depuis Neon Cloud SQL');
    else toast('Échec de la récupération depuis Neon Cloud SQL', 'err');
  };

  const handleRunSql = async () => {
    if (!sqlQuery.trim()) return;
    setBusy('sql');
    try {
      const res = await runCustomSqlQuery(sqlQuery, url);
      setSqlResult(res);
      toast(`Requête exécutée en ${res.durationMs} ms (${res.rows.length} ligne(s))`);
    } catch (e) {
      setSqlResult({ rows: [], durationMs: 0, err: (e as Error).message });
      toast('Erreur SQL', 'err');
    }
    setBusy(null);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedUrl = showPwd ? url : url.replace(/:([^:@]+)@/, ':••••••••••••@');

  const tablesList = [
    { name: 'mnazir_beauty_erp_state', desc: 'État global JSONB synchronisé entre appareils', count: 1 },
    { name: 'mnazir_beauty_products', desc: 'Catalogue Savon Naturel, packs & emballages', count: products.length },
    { name: 'mnazir_beauty_sales', desc: 'Pièces de vente, tickets POS & factures', count: sales.length },
    { name: 'mnazir_beauty_customers', desc: 'Répertoire clientes, fidélité & créances', count: customers.length },
    { name: 'mnazir_beauty_orders', desc: 'Lots de production atelier & commandes', count: orders.length },
    { name: 'mnazir_beauty_deliveries', desc: 'Expéditions & livraisons coursiers', count: deliveries.length },
    { name: 'mnazir_beauty_expenses', desc: 'Journal des dépenses & charges', count: expenses.length },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Base de Données Cloud (Neon PostgreSQL)"
        subtitle="Synchronisation SQL multi-appareils en temps réel pour M.Nazir_Beauty (Render + Neon Serverless)"
        actions={
          <>
            <Btn onClick={() => runTest(url)} disabled={!!busy}>
              <RefreshCw className={`w-3.5 h-3.5 ${busy === 'test' ? 'animate-spin' : ''}`} /> Tester la liaison
            </Btn>
            <Btn variant="amber" onClick={handlePull} disabled={!!busy}>
              <DownloadCloud className="w-3.5 h-3.5" /> Charger depuis le Cloud (Pull)
            </Btn>
            <Btn variant="primary" onClick={handlePush} disabled={!!busy}>
              <UploadCloud className="w-3.5 h-3.5" /> Sauvegarder sur le Cloud (Push)
            </Btn>
          </>
        }
      />

      {/* Indicateurs de santé de la base SQL */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat
          label="Statut Liaison SQL"
          value={status?.success ? 'CONNECTÉ' : busy === 'test' ? 'VÉRIFICATION…' : 'HORS LIGNE'}
          sub={status?.message || 'En attente de test'}
          icon={<Database />}
          tone={status?.success ? 'emerald' : 'rose'}
        />
        <Stat
          label="Instance & Base"
          value={status?.database || 'neondb'}
          sub={status?.version || 'PostgreSQL Serverless AWS'}
          icon={<Server />}
          tone="sky"
        />
        <Stat
          label="Latence Réseau"
          value={status?.latencyMs !== undefined ? `${status.latencyMs} ms` : '—'}
          sub={lastNeonSync ? `Dernière synchro : ${lastNeonSync}` : `État : ${neonSyncStatus}`}
          icon={<ShieldCheck />}
          tone="amber"
        />
        <Stat
          label="Tables M.Nazir_Beauty"
          value={`${status?.tablesCount ?? 7} tables`}
          sub={`${products.length} produits · ${sales.length} ventes · ${customers.length} clientes`}
          icon={<Layers />}
          tone="violet"
        />
      </div>

      {/* Configuration de la chaîne de connexion PostgreSQL */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card
          title="Configuration de l'URL PostgreSQL (Neon Cloud)"
          className="lg:col-span-2"
          right={
            <label className="flex items-center gap-2 text-xs font-medium text-[#143020] cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={e => toggleAutoSync(e.target.checked)}
                className="rounded border-[#cfc7b8]"
              />
              <span>Synchronisation automatique à chaque opération</span>
            </label>
          }
        >
          <div className="space-y-3">
            <Field
              label="Chaîne de connexion PostgreSQL (DATABASE_URL / VITE_NEON_DATABASE_URL)"
              hint="Format : postgresql://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require"
            >
              <div className="flex gap-1.5">
                <Input
                  value={showPwd ? url : maskedUrl}
                  onChange={e => { setShowPwd(true); setUrl(e.target.value); }}
                  className="font-mono-num text-xs"
                />
                <Btn onClick={() => setShowPwd(v => !v)} title={showPwd ? 'Masquer' : 'Afficher'}>
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Btn>
                <Btn onClick={copyUrl} title="Copier l'URL">
                  {copied ? <Check className="w-3.5 h-3.5 text-[#1f6b3f]" /> : <Copy className="w-3.5 h-3.5" />}
                </Btn>
              </div>
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#ece7dc]">
              <div className="flex flex-wrap gap-2">
                <Btn variant="primary" onClick={handleSaveUrl} disabled={!!busy}>
                  Enregistrer & Connecter
                </Btn>
                <Btn onClick={handleInitSchema} disabled={!!busy}>
                  Initialiser les 7 tables SQL
                </Btn>
                <Btn onClick={handleRestoreDefault} disabled={!!busy}>
                  Utiliser la base Cloud par défaut
                </Btn>
              </div>
              <Badge tone={neonSyncStatus === 'synced' ? 'emerald' : neonSyncStatus === 'syncing' ? 'amber' : 'slate'}>
                {neonSyncStatus === 'synced' ? 'Synchronisé' : neonSyncStatus === 'syncing' ? 'Synchro en cours…' : 'Prêt'}
              </Badge>
            </div>
          </div>
        </Card>

        <Card title="Architecture des Tables SQL">
          <div className="divide-y divide-[#ece7dc]">
            {tablesList.map(t => (
              <div key={t.name} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono-num text-xs font-bold text-[#143020] truncate">{t.name}</div>
                  <div className="text-[11px] text-[#6e6659] truncate">{t.desc}</div>
                </div>
                <Badge tone="slate">{t.count} l.</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Console SQL Interactive */}
      <Card
        title={<span className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-[#143020]" /> Console d'Interrogation SQL Directe</span>}
        right={
          <div className="flex flex-wrap gap-1">
            <Btn
              size="sm"
              onClick={() => setSqlQuery('SELECT name, category, sell_price, stock_total FROM mnazir_beauty_products ORDER BY sell_price DESC;')}
            >
              Produits
            </Btn>
            <Btn
              size="sm"
              onClick={() => setSqlQuery('SELECT number, sale_date, customer_name, total, status FROM mnazir_beauty_sales ORDER BY sale_date DESC LIMIT 15;')}
            >
              Ventes
            </Btn>
            <Btn
              size="sm"
              onClick={() => setSqlQuery('SELECT full_name, phone, address, loyalty_points, total_spent, credit_balance FROM mnazir_beauty_customers ORDER BY total_spent DESC;')}
            >
              Clientes
            </Btn>
            <Btn
              size="sm"
              onClick={() => setSqlQuery('SELECT number, customer_name, garment, quantity, price, status, due_date FROM mnazir_beauty_orders;')}
            >
              Lots Atelier
            </Btn>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              rows={2}
              value={sqlQuery}
              onChange={e => setSqlQuery(e.target.value)}
              className="font-mono-num text-xs bg-[#faf8f4]"
            />
            <Btn variant="primary" onClick={handleRunSql} disabled={!!busy} className="shrink-0">
              Exécuter SQL
            </Btn>
          </div>

          {sqlResult && (
            <div className="border border-[#dcd5c7] rounded-[4px] overflow-hidden">
              <div className="bg-[#faf8f4] px-3 py-1.5 border-b border-[#dcd5c7] flex items-center justify-between text-[11px] text-[#6e6659]">
                <span>Résultat de la requête</span>
                <span className="font-mono-num">{sqlResult.rows.length} ligne(s) · {sqlResult.durationMs} ms</span>
              </div>
              {sqlResult.err ? (
                <div className="p-3 text-xs font-mono-num text-[#8a2626] bg-[#fbeeee]">{sqlResult.err}</div>
              ) : sqlResult.rows.length === 0 ? (
                <div className="p-4 text-xs text-[#7a7265] text-center">Aucune ligne retournée (cliquez sur « Sauvegarder sur le Cloud (Push) » pour peupler les tables SQL).</div>
              ) : (
                <Table head={Object.keys(sqlResult.rows[0])}>
                  {sqlResult.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#faf8f4]">
                      {Object.values(row).map((val, cIdx) => (
                        <Td key={cIdx} className="font-mono-num text-xs">
                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
