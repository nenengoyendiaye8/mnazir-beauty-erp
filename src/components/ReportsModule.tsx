import React, { useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Calendar, PieChart, Users, Package, Printer, Download } from 'lucide-react';
import { useErp } from '../store';
import { PageHeader, Card, Btn, Badge, Stat, Table, Td } from './ui';
import { money, fdate, sum, saleProfit, isLive, todayStr, toCSV, download, printHtml } from '../utils/helpers';

export const ReportsModule: React.FC = () => {
  const { sales, expenses, products, customers, staff, settings } = useErp();
  const [period, setPeriod] = useState<'7j' | '30j' | 'mois' | 'annee'>('30j');

  const today = todayStr();
  const now = new Date();

  // Filtrage selon la période
  const filteredSales = sales.filter(s => {
    if (!isLive(s)) return false;
    if (period === '7j') {
      const d7 = new Date(); d7.setDate(now.getDate() - 7);
      return s.date >= d7.toISOString().slice(0, 10);
    }
    if (period === '30j') {
      const d30 = new Date(); d30.setDate(now.getDate() - 30);
      return s.date >= d30.toISOString().slice(0, 10);
    }
    if (period === 'mois') {
      return s.date.startsWith(today.slice(0, 7));
    }
    if (period === 'annee') {
      return s.date.startsWith(today.slice(0, 4));
    }
    return true;
  });

  const totalCA = sum(filteredSales, s => s.total);
  const totalEncaisse = sum(filteredSales, s => s.amountPaid);
  const totalMarge = sum(filteredSales, saleProfit);

  const filteredExpenses = expenses.filter(e => {
    if (period === '7j') {
      const d7 = new Date(); d7.setDate(now.getDate() - 7);
      return e.date >= d7.toISOString().slice(0, 10);
    }
    if (period === '30j') {
      const d30 = new Date(); d30.setDate(now.getDate() - 30);
      return e.date >= d30.toISOString().slice(0, 10);
    }
    if (period === 'mois') return e.date.startsWith(today.slice(0, 7));
    if (period === 'annee') return e.date.startsWith(today.slice(0, 4));
    return true;
  });

  const totalDepenses = sum(filteredExpenses, e => e.amount);
  const beneficeNet = totalMarge - totalDepenses;

  // Ventes par catégorie
  const catSales: Record<string, { qte: number; ca: number }> = {};
  filteredSales.forEach(s => {
    s.items.forEach(it => {
      const pr = products.find(p => p.id === it.productId);
      const cat = pr?.category || 'Autres';
      if (!catSales[cat]) catSales[cat] = { qte: 0, ca: 0 };
      catSales[cat].qte += it.quantity;
      catSales[cat].ca += it.quantity * it.unitPrice - (it.discount || 0);
    });
  });

  // Top Produits
  const prodSales: Record<string, { name: string; qte: number; ca: number }> = {};
  filteredSales.forEach(s => {
    s.items.forEach(it => {
      if (!prodSales[it.productId]) prodSales[it.productId] = { name: it.name, qte: 0, ca: 0 };
      prodSales[it.productId].qte += it.quantity;
      prodSales[it.productId].ca += it.quantity * it.unitPrice - (it.discount || 0);
    });
  });
  const topProducts = Object.values(prodSales).sort((a, b) => b.ca - a.ca).slice(0, 5);

  const handleExportCSV = () => {
    const rows = [
      ['Rapport Commercial', settings.name, period],
      ['Chiffre d\'Affaires', totalCA],
      ['Marge Brute', totalMarge],
      ['Dépenses', totalDepenses],
      ['Bénéfice Net', beneficeNet],
      [],
      ['Produit', 'Quantité Vendue', 'CA Réalisé'],
      ...topProducts.map(p => [p.name, p.qte, p.ca])
    ];
    download(`rapport_${period}_${today}.csv`, toCSV(rows), 'text/csv');
  };

  const handlePrint = () => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 30px;">
        <div style="text-align: center; border-bottom: 2px solid #15803d; padding-bottom: 10px;">
          <h1 style="color: #15803d; margin: 0;">${settings.name}</h1>
          <p>${settings.tagline} - ${settings.address}</p>
          <h2>RAPPORT D'ACTIVITÉ & RENTABILITÉ (${period.toUpperCase()})</h2>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 20px 0;">
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; flex: 1; margin-right: 10px;">
            <div style="font-size: 12px; color: #666;">Chiffre d'Affaires</div>
            <div style="font-size: 20px; font-weight: bold; color: #15803d;">${money(totalCA)}</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; flex: 1; margin-right: 10px;">
            <div style="font-size: 12px; color: #666;">Marge Commerciale</div>
            <div style="font-size: 20px; font-weight: bold; color: #0284c7;">${money(totalMarge)}</div>
          </div>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; flex: 1;">
            <div style="font-size: 12px; color: #666;">Bénéfice Net Réel</div>
            <div style="font-size: 20px; font-weight: bold; color: ${beneficeNet >= 0 ? '#15803d' : '#e11d48'};">${money(beneficeNet)}</div>
          </div>
        </div>
        <h3>Top 5 des Meilleures Ventes</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f4f4f4; text-align: left;">
            <th style="padding: 8px;">Article</th>
            <th style="padding: 8px; text-align: right;">Quantité</th>
            <th style="padding: 8px; text-align: right;">Total CA</th>
          </tr>
          ${topProducts.map(p => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px;">${p.name}</td>
              <td style="padding: 8px; text-align: right;">${p.qte} pcs</td>
              <td style="padding: 8px; text-align: right; font-weight: bold;">${money(p.ca)}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
    printHtml(html);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rapports d'Activité & Rentabilité"
        subtitle="Analyses financières, top produits et marges bénéficiaires de la boutique"
        icon={<BarChart3 className="w-5 h-5" />}
        actions={
          <div className="flex gap-2">
            <Btn onClick={handleExportCSV}><Download className="w-4 h-4" /> Export CSV</Btn>
            <Btn onClick={handlePrint}><Printer className="w-4 h-4" /> Imprimer Rapport</Btn>
          </div>
        }
      />

      {/* Sélecteur de période */}
      <div className="flex gap-2 bg-white p-2 rounded-[5px] border border-slate-200 w-fit">
        {(['7j', '30j', 'mois', 'annee'] as const).map(p => (
          <Btn key={p} size="sm" variant={period === p ? 'primary' : 'ghost'} onClick={() => setPeriod(p)}>
            {p === '7j' ? '7 derniers jours' : p === '30j' ? '30 derniers jours' : p === 'mois' ? 'Ce mois-ci' : 'Cette année'}
          </Btn>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Stat label="Chiffre d'Affaires" value={money(totalCA)} sub={`${filteredSales.length} ventes conclues`} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
        <Stat label="Encaissé Réel" value={money(totalEncaisse)} sub="Sur les comptes & caisse" icon={<DollarSign className="w-5 h-5" />} tone="sky" />
        <Stat label="Marge Brute" value={money(totalMarge)} sub="Bénéfice sur articles" icon={<BarChart3 className="w-5 h-5" />} tone="amber" />
        <Stat label="Bénéfice Net" value={money(beneficeNet)} sub={`Après charges (${money(totalDepenses)})`} icon={<DollarSign className="w-5 h-5" />} tone={beneficeNet >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ventes par Catégorie */}
        <Card title="Répartition des Ventes par Univers">
          <div className="space-y-3 pt-2">
            {Object.entries(catSales).map(([cat, data]) => {
              const perc = totalCA > 0 ? Math.round((data.ca / totalCA) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{cat} ({data.qte} pcs)</span>
                    <span className="text-emerald-800">{money(data.ca)} ({perc}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${perc}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top 5 Produits */}
        <Card title=" Top 5 des Meilleures Ventes">
          <Table head={['Article', 'Quantité', { label: 'Chiffre d\'Affaires', right: true }]}>
            {topProducts.map((p, idx) => (
              <tr key={idx}>
                <Td className="font-bold text-slate-800">{p.name}</Td>
                <Td><Badge tone="slate">{p.qte} vendus</Badge></Td>
                <Td right className="font-extrabold text-emerald-800">{money(p.ca)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
};
