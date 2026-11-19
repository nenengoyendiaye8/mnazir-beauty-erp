import React, { useMemo, useState } from 'react';
import { TrendingUp, Wallet, ShoppingBag, Percent, AlertTriangle, FlaskConical, Truck, HandCoins, Boxes, Plus, Package, Banknote, ArrowUpRight } from 'lucide-react';
import { useErp } from '../store';
import { Badge, Btn, Card, Empty, Modal, PageHeader, Stat, Table, Td } from './ui';
import { addDays, fdate, isLive, money, monthKey, num, pct, productStock, saleProfit, sum, todayStr } from '../utils/helpers';

export const Dashboard: React.FC = () => {
  const { sales, products, orders, deliveries, expenses, customers, purchases, suppliers, settings, currentUser, setTab, can, dayStats } = useErp();
  const [posterOpen, setPosterOpen] = useState(false);
  const today = todayStr();
  const m = monthKey(today);
  const lastM = monthKey(addDays(today.slice(0, 8) + '01', -1));

  const k = useMemo(() => {
    const live = sales.filter(isLive);
    const t = live.filter(s => s.date === today), mo = live.filter(s => monthKey(s.date) === m), lm = live.filter(s => monthKey(s.date) === lastM);
    const exp = sum(expenses.filter(e => monthKey(e.date) === m), e => e.amount);
    const days = Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); const l = live.filter(s => s.date === d); return { d, v: sum(l, s => s.total), n: l.length }; });
    const top: Record<string, { name: string; q: number; v: number; sku: string }> = {};
    mo.forEach(s => s.items.forEach(i => {
      const p = products.find(x => x.id === i.productId);
      const code = p?.variants?.[0]?.sku || 'MNS';
      const e = top[i.productId] ||= { name: i.name, q: 0, v: 0, sku: code };
      e.q += i.quantity;
      e.v += i.quantity * i.unitPrice - i.discount;
    }));
    const caM = sum(mo, s => s.total), caL = sum(lm, s => s.total);
    return {
      caT: sum(t, s => s.total), nT: t.length, caM, caL, nM: mo.length, exp, profit: sum(mo, saleProfit), panier: mo.length ? caM / mo.length : 0,
      days, max: Math.max(1, ...days.map(d => d.v)), top: Object.values(top).sort((a, b) => b.q - a.q).slice(0, 5),
      debts: live.filter(s => s.amountRemaining > 0), recent: sales.filter(s => s.docType === 'sale').slice(0, 7),
    };
  }, [sales, expenses, products, today, m, lastM]);

  const low = products.filter(p => productStock(p) <= p.minStock);
  const late = k.debts.filter(s => s.dueDate && s.dueDate < today);
  const lateOrders = orders.filter(o => o.status !== 'livre' && o.status !== 'annule' && o.dueDate < today);
  const readyOrders = orders.filter(o => o.status === 'pret');
  const activeDeliv = deliveries.filter(d => d.status === 'preparation' || d.status === 'en_route');
  const stockValue = sum(products, p => productStock(p) * p.buyPrice);
  const stockPieces = sum(products, productStock);
  const supplierDebt = sum(suppliers, s => s.balanceDue);
  const day = dayStats(today);
  const growth = k.caL ? Math.round(((k.caM - k.caL) / k.caL) * 100) : null;

  const alerts: Array<{ text: string; tone: 'amber' | 'rose' | 'sky' | 'emerald'; go: () => void; show: boolean }> = [
    { text: `${low.length} référence(s) sous le seuil de sécurité stock`, tone: 'amber', go: () => setTab('stock'), show: low.length > 0 && can('stock') },
    { text: `${late.length} créance(s) client échue(s) (${money(sum(late, s => s.amountRemaining))})`, tone: 'rose', go: () => setTab('facturation'), show: late.length > 0 && can('facturation') },
    { text: `${lateOrders.length} lot(s) d'atelier en dépassement de délai`, tone: 'rose', go: () => setTab('sur_mesure'), show: lateOrders.length > 0 },
    { text: `${readyOrders.length} lot(s) terminé(s) en attente de remise client`, tone: 'emerald', go: () => setTab('sur_mesure'), show: readyOrders.length > 0 },
    { text: `${activeDeliv.length} expédition(s) en cours de distribution`, tone: 'sky', go: () => setTab('livraisons'), show: activeDeliv.length > 0 },
  ];

  const mainProductStock = products[0] ? productStock(products[0]) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tableau d'Exploitation"
        subtitle={`${settings.name} — ${settings.tagline} · Session : ${currentUser?.name || 'Direction'}`}
        actions={
          <>
            {can('pos') && <Btn variant="primary" onClick={() => setTab('pos')}><Plus className="w-3.5 h-3.5" /> Saisir une vente</Btn>}
            {can('sur_mesure') && <Btn variant="amber" onClick={() => setTab('sur_mesure')}><FlaskConical className="w-3.5 h-3.5" /> Ordre de production</Btn>}
            {can('stock') && <Btn onClick={() => setTab('stock')}><Package className="w-3.5 h-3.5" /> Inventaire</Btn>}
          </>
        }
      />

      {/* Fiche Produit de Référence — Style Registre Professionnel */}
      <div className="bg-white rounded-md border border-[#dcd5c7] p-4 flex flex-col lg:flex-row items-stretch justify-between gap-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          <img
            src="/savon-naturel.jpg"
            alt="M.Nazir_Beauty Savon Naturel"
            onClick={() => setPosterOpen(true)}
            title="Consulter le visuel produit grand format"
            className="w-32 h-22 object-cover rounded-[4px] border border-[#c8bfa8] shrink-0 cursor-pointer hover:opacity-90 transition"
          />
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#143020] text-[#f5f0e6] rounded-[3px]">
                RÉF. PHARE · MNS-0001
              </span>
              <span className="text-[11px] font-medium text-[#6e6659]">
                Gamme Cosmétique 100% Naturelle
              </span>
            </div>
            <h2 className="font-serif-brand text-xl font-bold text-[#12241a] leading-tight">
              Savon Naturel M.Nazir_Beauty — Pot Standard 250g
            </h2>
            <p className="text-xs text-[#5c5549] max-w-2xl">
              Formulation botanique sélectionnée : nettoyage en profondeur, nutrition cutanée, hydratation et éclat. Tous types de peau.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-[#e6e0d4] pt-3 lg:pt-0 lg:pl-5 shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#7a7265] font-semibold">Tarif Détail</div>
            <div className="font-mono-num text-base font-bold text-[#12241a] mt-0.5">2 500 FCFA</div>
            <div className="text-[10px] text-[#7a7265]">Coût revient : 850 FCFA</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#7a7265] font-semibold">Stock Disponible</div>
            <div className="font-mono-num text-base font-bold text-[#143020] mt-0.5">{num(mainProductStock)} pots</div>
            <div className="text-[10px] text-[#7a7265]">3 variantes actives</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#7a7265] font-semibold">Ligne Directe</div>
            <div className="font-mono-num text-sm font-bold text-[#9c7832] mt-0.5">78 661 34 53</div>
            <button onClick={() => setPosterOpen(true)} className="text-[11px] text-[#143020] underline font-medium cursor-pointer mt-0.5 inline-flex items-center gap-0.5">
              Visuel officiel <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Grille des 8 indicateurs financiers et stocks */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Stat label="Chiffre d'affaires (Jour)" value={money(k.caT)} sub={`${k.nT} ticket(s) · encaissé ${money(day.collected)}`} icon={<ShoppingBag />} />
        <Stat label="Chiffre d'affaires (Mois)" value={money(k.caM)} sub={growth === null ? `${k.nM} vente(s)` : <span className={growth >= 0 ? 'text-[#164228] font-semibold' : 'text-[#8a2626] font-semibold'}>{growth >= 0 ? '+' : ''}{growth}% vs mois précédent</span>} icon={<TrendingUp />} tone="sky" />
        <Stat label="Résultat net mensuel" value={money(k.profit - k.exp)} sub={`Marge brute ${money(k.profit)} − charges ${money(k.exp)}`} icon={<Wallet />} tone={k.profit - k.exp >= 0 ? 'emerald' : 'rose'} />
        <Stat label="Panier moyen" value={money(k.panier)} sub={`Taux de marge brute : ${pct(k.profit, k.caM)}%`} icon={<Percent />} tone="violet" />
        <Stat label="Valorisation du stock" value={money(stockValue)} sub={`${num(stockPieces)} unités · ${products.length} références`} icon={<Boxes />} tone="slate" />
        <Stat label="Encours clients" value={money(sum(k.debts, s => s.amountRemaining))} sub={`${k.debts.length} facture(s) non soldée(s)`} icon={<HandCoins />} tone="amber" />
        <Stat label="Engagements fournisseurs" value={money(supplierDebt)} sub={`${purchases.filter(p => p.status === 'commande').length} commande(s) en attente`} icon={<Package />} tone="rose" />
        <Stat label="Encaisse espèces théorique" value={money(day.expectedCash)} sub="Espèces encaissées − décaissements jour" icon={<Banknote />} />
      </div>

      {/* Points de vigilance */}
      {alerts.some(a => a.show) && (
        <Card title={<span className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-[#b88222]" /> Points de vigilance opérationnels</span>}>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {alerts.filter(a => a.show).map((a, i) => (
              <button key={i} onClick={a.go} className="flex items-center justify-between gap-2 text-left text-xs font-medium px-3 py-2 rounded-[4px] border border-[#dcd5c7] bg-[#faf8f4] hover:border-[#143020] cursor-pointer transition">
                <Badge tone={a.tone}>{a.text}</Badge>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#7a7265] shrink-0" />
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Graphique 14 jours + Top références */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Évolution du chiffre d'affaires (14 derniers jours)" className="lg:col-span-2" right={<span className="font-mono-num text-[11px] text-[#7a7265]">Unité : FCFA</span>}>
          <div className="flex items-end gap-2 h-48 pt-6 px-1 border-b border-[#ece7dc]">
            {k.days.map(d => (
              <div key={d.d} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div className="absolute -top-2 hidden group-hover:block bg-[#12241a] text-white font-mono-num text-[10px] px-2 py-1 rounded-[3px] whitespace-nowrap z-10">
                  {fdate(d.d)} · {money(d.v)} ({d.n})
                </div>
                <div
                  className={`w-full rounded-t-[2px] transition-all ${d.d === today ? 'bg-[#a68038]' : 'bg-[#143020] group-hover:bg-[#234f36]'}`}
                  style={{ height: `${Math.max(3, (d.v / k.max) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1.5 px-1">
            {k.days.map(d => (
              <div key={d.d} className="flex-1 text-center font-mono-num text-[9px] text-[#7a7265]">
                {d.d.slice(8)}/{d.d.slice(5, 7)}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Volume des ventes par référence (Mois)">
          {k.top.length ? (
            <div className="divide-y divide-[#ece7dc]">
              {k.top.map((t, i) => (
                <div key={t.name} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                  <span className="font-mono-num text-xs font-bold text-[#7a7265] w-4">{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1c1a17] truncate">{t.name}</div>
                    <div className="font-mono-num text-[11px] text-[#6e6659]">{money(t.v)}</div>
                  </div>
                  <Badge tone="emerald">{t.q} u.</Badge>
                </div>
              ))}
            </div>
          ) : <Empty text="Aucune vente enregistrée sur la période" />}
        </Card>
      </div>

      {/* Dernières écritures de vente + Seuils de stock */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Dernières écritures de vente" className="lg:col-span-2" right={can('ventes') && <Btn size="sm" onClick={() => setTab('ventes')}>Journal complet</Btn>}>
          {k.recent.length ? (
            <Table head={['Pièce N°', 'Date & Heure', 'Client(e)', { label: 'Montant TTC', right: true }, 'Règlement']}>
              {k.recent.map(s => (
                <tr key={s.id} className="hover:bg-[#faf8f4]">
                  <Td className="font-mono-num text-xs font-semibold text-[#143020]">{s.number}</Td>
                  <Td className="font-mono-num text-xs text-[#5c5549]">{fdate(s.date)} · {s.time}</Td>
                  <Td className="truncate max-w-[180px] font-medium">{s.customerName}</Td>
                  <Td right className="font-bold">{money(s.total)}</Td>
                  <Td>{s.status === 'paid' ? <Badge tone="emerald">Soldée</Badge> : s.status === 'cancelled' ? <Badge tone="rose">Annulée</Badge> : <Badge tone="amber">Solde {money(s.amountRemaining)}</Badge>}</Td>
                </tr>
              ))}
            </Table>
          ) : <Empty text="Aucune écriture de vente" />}
        </Card>

        <Card title="État des seuils de réapprovisionnement">
          {low.length ? (
            <div className="divide-y divide-[#ece7dc] max-h-72 overflow-y-auto">
              {low.slice(0, 8).map(p => {
                const st = productStock(p);
                return (
                  <div key={p.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1c1a17] truncate">{p.name}</div>
                      <div className="text-[10px] text-[#7a7265]">{p.category} · Seuil min : {p.minStock}</div>
                    </div>
                    <Badge tone={st <= 0 ? 'rose' : 'amber'}>{st} u.</Badge>
                  </div>
                );
              })}
            </div>
          ) : <Empty text="Niveaux de stock conformes aux seuils" />}
        </Card>
      </div>

      <Modal open={posterOpen} onClose={() => setPosterOpen(false)} size="lg" title="Support Officiel — M.Nazir_Beauty (Savon Naturel 2 500 FCFA)">
        <img src="/savon-naturel.jpg" alt="M.Nazir_Beauty Savon Naturel" className="w-full rounded-[4px] border border-[#dcd5c7]" />
      </Modal>
    </div>
  );
};
