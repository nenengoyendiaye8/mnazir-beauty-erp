import React, { useState } from 'react';
import { ErpProvider, useErp } from './store';
import { LoginPage } from './components/LoginPage';
import { Header, MobileDrawer, Sidebar } from './components/Layout';
import { Toast } from './components/ui';
import { Dashboard } from './components/Dashboard';
import { PosModule } from './components/PosModule';
import { SalesModule } from './components/SalesModule';
import { InvoicingModule } from './components/InvoicingModule';
import { TailorModule } from './components/TailorModule';
import { DeliveriesModule } from './components/DeliveriesModule';
import { StockModule } from './components/StockModule';
import { PurchasesModule } from './components/PurchasesModule';
import { SuppliersModule } from './components/SuppliersModule';
import { CustomersModule } from './components/CustomersModule';
import { FinanceModule } from './components/FinanceModule';
import { StaffModule } from './components/StaffModule';
import { ReportsModule } from './components/ReportsModule';
import { UsersModule } from './components/UsersModule';
import { SettingsModule } from './components/SettingsModule';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#f4f1ea]">
        <div className="max-w-lg bg-white rounded-md border border-[#dcd5c7] p-6">
          <h1 className="text-lg font-bold text-[#8a2626]">Erreur applicative</h1>
          <p className="text-sm text-[#5c5549] mt-2">{this.state.err.message}</p>
          <button className="mt-4 px-4 py-2 rounded-[5px] bg-[#143020] text-white text-xs font-semibold cursor-pointer" onClick={() => location.reload()}>Recharger l'application</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

const Shell: React.FC = () => {
  const { currentUser, tab, can, toastMsg } = useErp();
  const [drawer, setDrawer] = useState(false);
  if (!currentUser) return <><LoginPage /><Toast toast={toastMsg} /></>;

  const views: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />, pos: <PosModule />, ventes: <SalesModule />, facturation: <InvoicingModule />, sur_mesure: <TailorModule />,
    livraisons: <DeliveriesModule />, stock: <StockModule />, achats: <PurchasesModule />, fournisseurs: <SuppliersModule />, clients: <CustomersModule />,
    finances: <FinanceModule />, personnel: <StaffModule />, rapports: <ReportsModule />, utilisateurs: <UsersModule />, parametres: <SettingsModule />,
  };

  return (
    <div className="h-screen flex bg-[#f4f1ea] text-[#1c1a17]">
      <div className="hidden lg:block no-print"><Sidebar /></div>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenu={() => setDrawer(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-[1480px] mx-auto">
            {can(tab) ? views[tab] : <div className="text-center text-[#6e6659] py-20 text-sm">Accès non autorisé pour ce profil utilisateur.</div>}
          </div>
        </main>
      </div>
      <Toast toast={toastMsg} />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <ErpProvider>
        <Shell />
      </ErpProvider>
    </ErrorBoundary>
  );
}
export default App;
