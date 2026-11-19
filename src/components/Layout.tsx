import React, { useState } from 'react';
import {
  LayoutDashboard, ShoppingCart, Receipt, FileText, FlaskConical, Truck, Boxes, PackagePlus, Users, Factory,
  Wallet, UserCog, BarChart3, ShieldCheck, Settings as Cog, LogOut, Menu, X, AlertTriangle, Phone,
} from 'lucide-react';
import { useErp } from '../store';
import type { ModuleId } from '../types';
import { clsx, productStock, sum } from '../utils/helpers';

const GROUPS: Array<{ title: string; items: Array<{ id: ModuleId; label: string; icon: React.ElementType }> }> = [
  { title: 'Opérations & Caisse', items: [
    { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
    { id: 'pos', label: 'Point de vente (POS)', icon: ShoppingCart },
    { id: 'ventes', label: 'Journal des ventes', icon: Receipt },
    { id: 'facturation', label: 'Facturation & créances', icon: FileText },
  ] },
  { title: 'Production & Expédition', items: [
    { id: 'sur_mesure', label: 'Atelier & lots de fabrication', icon: FlaskConical },
    { id: 'livraisons', label: 'Expéditions & coursiers', icon: Truck },
  ] },
  { title: 'Inventaire & Achats', items: [
    { id: 'stock', label: 'Catalogue, stocks & étiquettes', icon: Boxes },
    { id: 'achats', label: 'Approvisionnements', icon: PackagePlus },
    { id: 'fournisseurs', label: 'Fournisseurs', icon: Factory },
  ] },
  { title: 'Clientèle & Équipe', items: [
    { id: 'clients', label: 'Fichier clients & fidélité', icon: Users },
    { id: 'personnel', label: 'Personnel & commissions', icon: UserCog },
  ] },
  { title: 'Trésorerie & Administration', items: [
    { id: 'finances', label: 'Trésorerie & clôture Z', icon: Wallet },
    { id: 'rapports', label: 'Analytique & rapports', icon: BarChart3 },
    { id: 'utilisateurs', label: 'Comptes & habilitations', icon: ShieldCheck },
    { id: 'parametres', label: 'Configuration', icon: Cog },
  ] },
];

export const TITLES: Record<ModuleId, string> = {
  dashboard: 'Exploitation & Synthèse Commerciale',
  pos: 'Point de Vente & Encaissement',
  ventes: 'Journal des Ventes',
  facturation: 'Facturation, Devis Proforma & Créances',
  sur_mesure: 'Atelier de Formulation & Lots de Production',
  livraisons: 'Suivi des Expéditions & Coursiers',
  stock: 'Catalogue, Inventaire & Étiquetage Code-Barres',
  achats: 'Bons de Commande & Réceptions Matières',
  clients: 'Répertoire Clientèle & Programme Fidélité',
  fournisseurs: 'Fournisseurs Matières & Conditionnement',
  finances: 'Trésorerie, Charges & Clôture de Caisse Z',
  personnel: 'Collaborateurs & Commissions sur Ventes',
  rapports: 'Rapports Financiers & Analytique',
  utilisateurs: 'Habilitations & Codes d\'Accès',
  parametres: 'Paramètres de l\'Établissement',
};

export const Sidebar: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { tab, setTab, can, products, cart, sales, orders, deliveries, settings } = useErp();
  const low = products.filter(p => productStock(p) <= p.minStock).length;
  const debts = sales.filter(s => s.docType === 'sale' && s.status !== 'cancelled' && s.amountRemaining > 0).length;
  const open = orders.filter(o => o.status !== 'livre' && o.status !== 'annule').length;
  const liv = deliveries.filter(d => d.status === 'preparation' || d.status === 'en_route').length;

  const badges: Partial<Record<ModuleId, { t: string; c: string }>> = {
    pos: cart.length ? { t: `${sum(cart, l => l.quantity)}`, c: 'bg-[#a68038] text-white' } : undefined,
    stock: low ? { t: `${low}`, c: 'bg-[#362b16] text-[#dfc07f] border border-[#6e5528]' } : undefined,
    facturation: debts ? { t: `${debts}`, c: 'bg-[#362b16] text-[#dfc07f] border border-[#6e5528]' } : undefined,
    sur_mesure: open ? { t: `${open}`, c: 'bg-[#1d3b29] text-[#a7d4b8]' } : undefined,
    livraisons: liv ? { t: `${liv}`, c: 'bg-[#1d3b29] text-[#a7d4b8]' } : undefined,
  };

  return (
    <aside className="w-64 shrink-0 bg-[#102016] text-[#e6e1d6] flex flex-col h-full border-r border-[#23382b] select-none">
      {/* En-tête de marque sobre et éditorial */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-[#1e3326]">
        <div className="w-10 h-10 rounded-[4px] border border-[#a68038] bg-[#162b1e] text-[#dfc07f] font-serif-brand font-bold text-lg tracking-wider flex items-center justify-center shrink-0">
          MN
        </div>
        <div className="min-w-0">
          <div className="font-serif-brand text-lg font-bold leading-none tracking-wide text-[#f5f0e6] truncate">
            {settings.name}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-[#a68038] mt-1 truncate">
            Cosmétique Naturelle
          </div>
        </div>
      </div>

      {/* Navigation structurée */}
      <nav className="flex-1 overflow-y-auto side-scroll px-2.5 py-3 space-y-4">
        {GROUPS.map(g => {
          const items = g.items.filter(i => can(i.id));
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <div className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a8f81]">
                {g.title}
              </div>
              <div className="space-y-0.5">
                {items.map(i => {
                  const b = badges[i.id];
                  const active = tab === i.id;
                  return (
                    <button
                      key={i.id}
                      onClick={() => { setTab(i.id); onNavigate?.(); }}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] text-[12.5px] cursor-pointer transition',
                        active
                          ? 'bg-[#1b3324] text-[#f7f2e7] font-semibold border-l-2 border-[#c29b48]'
                          : 'text-[#b5c2b9] hover:bg-[#16291d] hover:text-[#f0ece1]'
                      )}
                    >
                      <i.icon className={clsx('w-3.5 h-3.5 shrink-0', active ? 'text-[#c29b48]' : 'text-[#768c7d]')} />
                      <span className="flex-1 text-left truncate">{i.label}</span>
                      {b && <span className={clsx('font-mono-num text-[10px] font-semibold px-1.5 py-0.2 rounded-[3px]', b.c)}>{b.t}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Pied de barre latérale */}
      <div className="px-4 py-3 text-[11px] text-[#8a9e91] border-t border-[#1e3326] bg-[#0c1810]">
        <div className="font-mono-num text-[11px] text-[#d6be89] font-medium flex items-center gap-1.5">
          <Phone className="w-3 h-3" /> {settings.phones[0] || '+221 78 661 34 53'}
        </div>
        <div className="text-[10px] text-[#6d8274] mt-0.5 truncate">{settings.city}</div>
      </div>
    </aside>
  );
};

export const Header: React.FC<{ onMenu: () => void }> = ({ onMenu }) => {
  const { tab, setTab, currentUser, logout, products, can } = useErp();
  const low = products.filter(p => productStock(p) <= p.minStock).length;
  const [now] = useState(() => new Date());
  return (
    <header className="bg-white border-b border-[#dcd5c7] px-4 lg:px-6 py-2.5 flex items-center gap-3 no-print">
      <button onClick={onMenu} className="lg:hidden p-1.5 rounded border border-[#cfc7b8] hover:bg-[#f4f1ea] cursor-pointer">
        <Menu className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0 flex items-baseline gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#143020] truncate">{TITLES[tab]}</span>
        <span className="hidden md:inline text-[11px] text-[#7a7265] border-l border-[#dcd5c7] pl-3">
          {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>
      {low > 0 && can('stock') && (
        <button
          onClick={() => setTab('stock')}
          className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-[#785314] bg-[#fbf4e4] border border-[#e6d1a4] px-2.5 py-1 rounded-[4px] cursor-pointer hover:bg-[#f5e9ce]"
        >
          <AlertTriangle className="w-3 h-3 text-[#b88222]" />
          <span>{low} réf. sous seuil</span>
        </button>
      )}
      {can('pos') && tab !== 'pos' && (
        <button
          onClick={() => setTab('pos')}
          className="flex items-center gap-1.5 text-xs font-medium text-[#f7f4ec] bg-[#143020] hover:bg-[#1d442e] px-3 py-1.5 rounded-[4px] cursor-pointer transition"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-[#c29b48]" />
          <span>Caisse POS</span>
        </button>
      )}
      <div className="flex items-center gap-2.5 pl-3 border-l border-[#dcd5c7]">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-[#1c1a17] leading-tight">{currentUser?.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#857d6f]">{currentUser?.role}</div>
        </div>
        <button
          onClick={logout}
          title="Fermer la session"
          className="p-1.5 rounded-[4px] border border-[#e2dcd0] hover:bg-[#fbeeee] hover:border-[#dfb8b8] text-[#7a7265] hover:text-[#8a2626] cursor-pointer transition"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

export const MobileDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => !open ? null : (
  <div className="fixed inset-0 z-40 flex lg:hidden no-print">
    <div className="h-full"><Sidebar onNavigate={onClose} /></div>
    <div className="flex-1 bg-black/50" onClick={onClose}><X className="w-6 h-6 text-white m-3" /></div>
  </div>
);
