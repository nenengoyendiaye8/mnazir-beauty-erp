import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type {
  AppUser, CashClosing, Customer, Delivery, DocType, ErpData, Expense, ModuleId, Payment, PaymentMethod, Product,
  Purchase, PurchaseItem, Sale, SaleItem, Settings, StaffMember, Supplier, TailorOrder, Variant,
} from './types';
import { ROLE_MODULES } from './types';
import { buildSeed, defaultSettings } from './data/seed';
import { addDays, isLive, lineTotal, nowTime, sum, todayStr, uid, variantLabel } from './utils/helpers';

const KEY = 'mnazir_beauty_erp_v4';
const SESSION = 'mnazir_beauty_erp_session_v4';

/* ---------- Types d'entrée publics ---------- */
export interface PaymentInput { amount: number; method: PaymentMethod; reference?: string }
export interface NewSaleInput {
  docType: DocType;
  customerId?: string; customerName?: string; customerPhone?: string; customerAddress?: string;
  items: SaleItem[];
  discountGlobal?: number;
  payments?: PaymentInput[];
  sellerId?: string;
  channel?: Sale['channel'];
  dueDate?: string;
  notes?: string;
  cashReceived?: number;
  loyaltyPointsUsed?: number;
}
export type NewOrderInput = Omit<TailorOrder, 'id' | 'number' | 'payments' | 'amountPaid'> & { deposit?: PaymentInput };
export type NewPurchaseInput = { date: string; supplierId: string; items: PurchaseItem[]; freight: number; expectedDate?: string; notes?: string; payment?: PaymentInput; receiveNow?: boolean };
export interface CartLine { productId: string; variantId: string; quantity: number; unitPrice: number; discount: number }

export interface DayStats {
  date: string; salesCount: number; totalSales: number; collected: number;
  byMethod: Partial<Record<PaymentMethod, number>>; expenses: number; cashExpenses: number; expectedCash: number;
}

export interface ErpApi extends ErpData {
  /* session */
  currentUser: AppUser | null; login: (username: string, pin: string) => boolean; logout: () => void; can: (m: ModuleId) => boolean;
  /* navigation / ui */
  tab: ModuleId; setTab: (t: ModuleId) => void;
  cart: CartLine[]; setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  toast: (msg: string, kind?: 'ok' | 'err') => void; toastMsg: { msg: string; kind: 'ok' | 'err' } | null;
  /* catalogue & stock */
  addProduct: (p: Omit<Product, 'id' | 'createdAt'>) => Product; updateProduct: (p: Product) => void; deleteProduct: (id: string) => void;
  adjustStock: (productId: string, variantId: string, delta: number, reason: string) => void;
  findVariant: (variantId: string) => { product: Product; variant: Variant } | undefined;
  findBySku: (sku: string) => { product: Product; variant: Variant } | undefined;
  /* ventes */
  createSale: (i: NewSaleInput) => Sale; addPayment: (saleId: string, p: PaymentInput) => void;
  cancelSale: (saleId: string) => void; convertProforma: (proformaId: string) => Sale; deleteProforma: (id: string) => void;
  /* clients */
  addCustomer: (c: Partial<Customer> & { fullName: string; phone: string }) => Customer; updateCustomer: (c: Customer) => void; deleteCustomer: (id: string) => void;
  collectCustomerDebt: (customerId: string, p: PaymentInput) => void;
  /* sur mesure */
  addOrder: (o: NewOrderInput) => TailorOrder; updateOrder: (o: TailorOrder) => void; addOrderPayment: (id: string, p: PaymentInput) => void; deleteOrder: (id: string) => void;
  /* livraisons */
  addDelivery: (d: Omit<Delivery, 'id' | 'number'>) => Delivery; updateDelivery: (d: Delivery) => void; deleteDelivery: (id: string) => void;
  /* fournisseurs & achats */
  addSupplier: (s: Omit<Supplier, 'id' | 'balanceDue'>) => Supplier; updateSupplier: (s: Supplier) => void; deleteSupplier: (id: string) => void;
  createPurchase: (i: NewPurchaseInput) => Purchase; receivePurchase: (id: string) => void; cancelPurchase: (id: string) => void; addPurchasePayment: (id: string, p: PaymentInput) => void;
  /* finances */
  addExpense: (e: Omit<Expense, 'id' | 'cashier'>) => void; deleteExpense: (id: string) => void;
  dayStats: (date: string) => DayStats; closeDay: (countedCash: number, notes?: string) => CashClosing;
  /* équipe */
  saveStaff: (s: Omit<StaffMember, 'id'> & { id?: string }) => void; deleteStaff: (id: string) => void;
  saveUser: (u: Omit<AppUser, 'id'> & { id?: string }) => void; deleteUser: (id: string) => void;
  /* paramètres / données */
  updateSettings: (s: Partial<Settings>) => void;
  exportData: () => string; importData: (json: string) => boolean; resetAll: () => void; loadDemo: () => void;
}

const Ctx = createContext<ErpApi | null>(null);
export const useErp = () => { const c = useContext(Ctx); if (!c) throw new Error('useErp hors provider'); return c; };

function emptyData(prev?: ErpData): ErpData {
  return {
    settings: prev?.settings || defaultSettings(), products: [], customers: [], sales: [], orders: [], deliveries: [], suppliers: [], purchases: [], expenses: [],
    staff: [], stockMoves: [], closings: [], users: prev?.users?.length ? prev.users : buildSeed().users, seq: { sale: 0, proforma: 0, order: 0, delivery: 0, purchase: 0 }, isDemo: false,
  };
}

function loadData(): ErpData {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d && d.products) return d; } } catch { /* ignore */ }
  const seed = buildSeed(); seed.isDemo = true; localStorage.setItem(KEY, JSON.stringify(seed)); return seed;
}

const year = () => new Date().getFullYear();
const pad = (n: number, w = 4) => String(n).padStart(w, '0');

/** Recalcule les champs dérivés (clients / fournisseurs). */
function recompute(d: ErpData) {
  d.customers.forEach(c => {
    const mine = d.sales.filter(s => s.customerId === c.id && isLive(s));
    c.totalSpent = sum(mine, s => s.total);
    c.creditBalance = sum(mine, s => s.amountRemaining) + sum(d.orders.filter(o => o.customerId === c.id && o.status !== 'annule'), o => Math.max(0, o.price - o.amountPaid));
  });
  d.suppliers.forEach(s => { s.balanceDue = sum(d.purchases.filter(p => p.supplierId === s.id && p.status !== 'annule'), p => Math.max(0, p.total - p.amountPaid)); });
}

function saleStatus(s: Sale): Sale['status'] {
  if (s.docType === 'proforma') return 'proforma';
  if (s.status === 'cancelled') return 'cancelled';
  return s.amountRemaining <= 0 ? 'paid' : s.amountPaid > 0 ? 'partial' : 'unpaid';
}

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<ErpData>(loadData());
  const [data, setData] = useState<ErpData>(ref.current);
  const [currentUser, setUser] = useState<AppUser | null>(() => {
    try {
      const id = localStorage.getItem(SESSION);
      if (id === '__logged_out__') return null;
      if (id) return ref.current.users.find(u => u.id === id && u.active) || ref.current.users[0] || null;
      return ref.current.users[0] || null;
    } catch {
      return ref.current.users[0] || null;
    }
  });
  const userRef = useRef(currentUser); userRef.current = currentUser;
  const [tab, setTab] = useState<ModuleId>('dashboard');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [toastMsg, setToastMsg] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const toastT = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToastMsg({ msg, kind }); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const mutate = useCallback(<R,>(fn: (d: ErpData) => R): R => {
    const d: ErpData = structuredClone(ref.current);
    const r = fn(d);
    recompute(d);
    ref.current = d; setData(d);
    try {
      const serialized = JSON.stringify(d);
      localStorage.setItem(KEY, serialized);
      fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized }).catch(() => {});
    } catch { /* quota */ }
    return r;
  }, []);

  const who = () => userRef.current?.name || 'Système';
  const mkPayment = (p: PaymentInput, date = todayStr()): Payment => ({ id: uid('pay'), date, time: nowTime(), amount: p.amount, method: p.method, reference: p.reference, cashier: who() });
  const move = (d: ErpData, p: Product, v: Variant, delta: number, reason: string) => {
    v.stock += delta;
    d.stockMoves.unshift({ id: uid('m'), date: todayStr(), time: nowTime(), productId: p.id, variantId: v.id, label: `${p.name} (${variantLabel(v.size, v.color)})`, delta, reason, user: who() });
    if (d.stockMoves.length > 1500) d.stockMoves.length = 1500;
  };
  const locate = (d: ErpData, variantId: string) => { for (const p of d.products) { const v = p.variants.find(x => x.id === variantId); if (v) return { p, v }; } return undefined; };

  /* ---------- API ---------- */
  const api: ErpApi = useMemo(() => ({
    ...data,
    currentUser, tab, setTab, cart, setCart, toast, toastMsg,
    login: (username, pin) => {
      const u = ref.current.users.find(x => x.active && x.username.toLowerCase() === username.trim().toLowerCase() && x.pin === pin);
      if (!u) return false; setUser(u); localStorage.setItem(SESSION, u.id); setTab('dashboard'); return true;
    },
    logout: () => { setUser(null); localStorage.setItem(SESSION, '__logged_out__'); },
    can: m => !!currentUser && ROLE_MODULES[currentUser.role].includes(m),

    addProduct: p => mutate(d => { const np: Product = { ...p, id: uid('p'), createdAt: todayStr() }; d.products.unshift(np); np.variants.forEach(v => { if (v.stock) d.stockMoves.unshift({ id: uid('m'), date: todayStr(), time: nowTime(), productId: np.id, variantId: v.id, label: `${np.name} (${variantLabel(v.size, v.color)})`, delta: v.stock, reason: 'Stock initial', user: who() }); }); return np; }),
    updateProduct: p => mutate(d => { const i = d.products.findIndex(x => x.id === p.id); if (i >= 0) d.products[i] = p; }),
    deleteProduct: id => mutate(d => { d.products = d.products.filter(p => p.id !== id); }),
    adjustStock: (productId, variantId, delta, reason) => mutate(d => { const p = d.products.find(x => x.id === productId); const v = p?.variants.find(x => x.id === variantId); if (p && v) move(d, p, v, delta, reason); }),
    findVariant: variantId => { for (const product of data.products) { const variant = product.variants.find(v => v.id === variantId); if (variant) return { product, variant }; } return undefined; },
    findBySku: sku => { const s = sku.trim().toLowerCase(); for (const product of data.products) { const variant = product.variants.find(v => v.sku.toLowerCase() === s); if (variant) return { product, variant }; } return undefined; },

    createSale: input => mutate(d => {
      const isSale = input.docType === 'sale';
      if (isSale) for (const it of input.items) { const l = locate(d, it.variantId); if (!l) throw new Error(`Article introuvable : ${it.name}`); if (l.v.stock < it.quantity) throw new Error(`Stock insuffisant : ${it.name} (${variantLabel(l.v.size, l.v.color)}) – reste ${l.v.stock}`); }
      const cust = input.customerId ? d.customers.find(c => c.id === input.customerId) : undefined;
      const pointsUsed = isSale && cust ? Math.min(input.loyaltyPointsUsed || 0, cust.loyaltyPoints) : 0;
      const discountGlobal = (input.discountGlobal || 0) + pointsUsed * d.settings.loyaltyValuePoint;
      const subtotal = sum(input.items, i => i.quantity * i.unitPrice);
      const base = Math.max(0, sum(input.items, lineTotal) - discountGlobal);
      const taxAmount = d.settings.enableVat ? Math.round(base * d.settings.vatRate / 100) : 0;
      const total = base + taxAmount;
      const date = todayStr(), time = nowTime();
      const num = isSale ? ++d.seq.sale : ++d.seq.proforma;
      const payments: Payment[] = []; let left = total;
      if (isSale) for (const p of input.payments || []) { const a = Math.min(p.amount, left); if (a > 0) { payments.push(mkPayment({ ...p, amount: a }, date)); left -= a; } }
      const paid = total - left;
      const sale: Sale = {
        id: uid('sale'), number: `${isSale ? 'MN' : 'PRO'}-${year()}-${pad(num)}`, docType: input.docType, date, time,
        customerId: cust?.id, customerName: cust?.fullName || input.customerName?.trim() || 'Client de passage', customerPhone: cust?.phone || input.customerPhone, customerAddress: cust?.address || input.customerAddress,
        items: input.items, subtotal, discountGlobal, total, taxAmount, payments, amountPaid: paid, amountRemaining: isSale ? total - paid : total,
        dueDate: input.dueDate, status: 'paid', sellerId: input.sellerId, cashier: who(), channel: input.channel || 'boutique', notes: input.notes,
        cashReceived: input.cashReceived, cashReturned: input.cashReceived && paid ? Math.max(0, input.cashReceived - paid) : undefined,
      };
      sale.status = saleStatus(sale);
      if (isSale) {
        for (const it of input.items) { const l = locate(d, it.variantId)!; move(d, l.p, l.v, -it.quantity, `Vente ${sale.number}`); }
        if (cust) { cust.loyaltyPoints = cust.loyaltyPoints - pointsUsed + Math.floor(total / 1000 * d.settings.loyaltyPer1000); }
      }
      d.sales.unshift(sale);
      return sale;
    }),
    addPayment: (saleId, p) => mutate(d => {
      const s = d.sales.find(x => x.id === saleId); if (!s || s.docType !== 'sale' || s.status === 'cancelled') return;
      const a = Math.min(p.amount, s.amountRemaining); if (a <= 0) return;
      s.payments.push(mkPayment({ ...p, amount: a })); s.amountPaid += a; s.amountRemaining -= a; s.status = saleStatus(s);
    }),
    cancelSale: saleId => mutate(d => {
      const s = d.sales.find(x => x.id === saleId); if (!s || s.status === 'cancelled') return;
      if (s.docType === 'sale') {
        s.items.forEach(it => { const l = locate(d, it.variantId); if (l) move(d, l.p, l.v, it.quantity, `Annulation ${s.number}`); });
        const c = d.customers.find(x => x.id === s.customerId); if (c) c.loyaltyPoints = Math.max(0, c.loyaltyPoints - Math.floor(s.total / 1000 * d.settings.loyaltyPer1000));
      }
      s.status = 'cancelled';
    }),
    convertProforma: id => mutate(d => {
      const pf = d.sales.find(x => x.id === id && x.docType === 'proforma'); if (!pf) throw new Error('Proforma introuvable');
      for (const it of pf.items) { const l = locate(d, it.variantId); if (!l || l.v.stock < it.quantity) throw new Error(`Stock insuffisant : ${it.name}`); }
      const sale: Sale = { ...pf, id: uid('sale'), number: `MN-${year()}-${pad(++d.seq.sale)}`, docType: 'sale', date: todayStr(), time: nowTime(), payments: [], amountPaid: 0, amountRemaining: pf.total, status: 'unpaid', cashier: who(), notes: `Issue de ${pf.number}` };
      sale.items.forEach(it => { const l = locate(d, it.variantId)!; move(d, l.p, l.v, -it.quantity, `Vente ${sale.number}`); });
      d.sales = d.sales.filter(x => x.id !== id); d.sales.unshift(sale); return sale;
    }),
    deleteProforma: id => mutate(d => { d.sales = d.sales.filter(s => !(s.id === id && s.docType === 'proforma')); }),

    addCustomer: c => mutate(d => { const nc: Customer = { address: '', loyaltyPoints: 0, totalSpent: 0, creditBalance: 0, ...c, id: uid('c'), createdAt: todayStr() }; d.customers.unshift(nc); return nc; }),
    updateCustomer: c => mutate(d => { const i = d.customers.findIndex(x => x.id === c.id); if (i >= 0) d.customers[i] = c; }),
    deleteCustomer: id => mutate(d => { d.customers = d.customers.filter(c => c.id !== id); }),
    collectCustomerDebt: (customerId, p) => mutate(d => {
      let rest = p.amount;
      d.sales.filter(s => s.customerId === customerId && s.docType === 'sale' && s.status !== 'cancelled' && s.amountRemaining > 0).sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
        if (rest <= 0) return; const a = Math.min(rest, s.amountRemaining); s.payments.push(mkPayment({ ...p, amount: a })); s.amountPaid += a; s.amountRemaining -= a; s.status = saleStatus(s); rest -= a;
      });
    }),

    addOrder: input => mutate(d => {
      const { deposit, ...rest } = input;
      const o: TailorOrder = { ...rest, id: uid('o'), number: `LOT-${year()}-${pad(++d.seq.order)}`, payments: [], amountPaid: 0 };
      if (deposit && deposit.amount > 0) { o.payments.push(mkPayment(deposit)); o.amountPaid = deposit.amount; }
      d.orders.unshift(o); return o;
    }),
    updateOrder: o => mutate(d => { const i = d.orders.findIndex(x => x.id === o.id); if (i >= 0) d.orders[i] = o; }),
    addOrderPayment: (id, p) => mutate(d => { const o = d.orders.find(x => x.id === id); if (!o) return; const a = Math.min(p.amount, o.price - o.amountPaid); if (a > 0) { o.payments.push(mkPayment({ ...p, amount: a })); o.amountPaid += a; } }),
    deleteOrder: id => mutate(d => { d.orders = d.orders.filter(o => o.id !== id); }),

    addDelivery: x => mutate(d => { const nd: Delivery = { ...x, id: uid('l'), number: `LIV-${year()}-${pad(++d.seq.delivery)}` }; d.deliveries.unshift(nd); return nd; }),
    updateDelivery: x => mutate(d => { const i = d.deliveries.findIndex(l => l.id === x.id); if (i >= 0) d.deliveries[i] = x; }),
    deleteDelivery: id => mutate(d => { d.deliveries = d.deliveries.filter(l => l.id !== id); }),

    addSupplier: s => mutate(d => { const ns: Supplier = { ...s, id: uid('f'), balanceDue: 0 }; d.suppliers.unshift(ns); return ns; }),
    updateSupplier: s => mutate(d => { const i = d.suppliers.findIndex(x => x.id === s.id); if (i >= 0) d.suppliers[i] = s; }),
    deleteSupplier: id => mutate(d => { d.suppliers = d.suppliers.filter(s => s.id !== id); }),
    createPurchase: i => mutate(d => {
      const sup = d.suppliers.find(s => s.id === i.supplierId);
      const total = sum(i.items, x => x.quantity * x.unitCost) + (i.freight || 0);
      const p: Purchase = { id: uid('a'), number: `ACH-${year()}-${pad(++d.seq.purchase)}`, date: i.date, supplierId: i.supplierId, supplierName: sup?.name || '—', items: i.items, freight: i.freight || 0, total, payments: [], amountPaid: 0, status: 'commande', expectedDate: i.expectedDate, notes: i.notes };
      if (i.payment && i.payment.amount > 0) { const a = Math.min(i.payment.amount, total); p.payments.push(mkPayment({ ...i.payment, amount: a }, i.date)); p.amountPaid = a; }
      d.purchases.unshift(p);
      if (i.receiveNow) receive(d, p);
      return p;
    }),
    receivePurchase: id => mutate(d => { const p = d.purchases.find(x => x.id === id); if (p && p.status === 'commande') receive(d, p); }),
    cancelPurchase: id => mutate(d => { const p = d.purchases.find(x => x.id === id); if (!p || p.status === 'annule') return; if (p.status === 'recu') p.items.forEach(it => { const l = locate(d, it.variantId); if (l) move(d, l.p, l.v, -it.quantity, `Annulation ${p.number}`); }); p.status = 'annule'; }),
    addPurchasePayment: (id, p) => mutate(d => { const x = d.purchases.find(q => q.id === id); if (!x) return; const a = Math.min(p.amount, x.total - x.amountPaid); if (a > 0) { x.payments.push(mkPayment({ ...p, amount: a })); x.amountPaid += a; } }),

    addExpense: e => mutate(d => { d.expenses.unshift({ ...e, id: uid('e'), cashier: who() }); }),
    deleteExpense: id => mutate(d => { d.expenses = d.expenses.filter(e => e.id !== id); }),
    dayStats: date => computeDay(data, date),
    closeDay: (counted, notes) => mutate(d => {
      const st = computeDay(d, date0());
      const c: CashClosing = { id: uid('z'), date: st.date, time: nowTime(), user: who(), salesCount: st.salesCount, totalSales: st.totalSales, byMethod: st.byMethod, expenses: st.expenses, expectedCash: st.expectedCash, countedCash: counted, gap: counted - st.expectedCash, notes };
      d.closings.unshift(c); return c;
    }),

    saveStaff: s => mutate(d => { if (s.id) { const i = d.staff.findIndex(x => x.id === s.id); if (i >= 0) d.staff[i] = s as StaffMember; } else d.staff.push({ ...s, id: uid('s') } as StaffMember); }),
    deleteStaff: id => mutate(d => { d.staff = d.staff.filter(s => s.id !== id); }),
    saveUser: u => mutate(d => { if (u.id) { const i = d.users.findIndex(x => x.id === u.id); if (i >= 0) d.users[i] = u as AppUser; } else d.users.push({ ...u, id: uid('u') } as AppUser); }),
    deleteUser: id => mutate(d => { if (d.users.filter(u => u.role === 'admin' && u.id !== id).length) d.users = d.users.filter(u => u.id !== id); }),

    updateSettings: s => mutate(d => { d.settings = { ...d.settings, ...s }; }),
    exportData: () => JSON.stringify(ref.current),
    importData: json => { try { const d = JSON.parse(json); if (!d.products || !d.settings) return false; ref.current = d; setData(d); localStorage.setItem(KEY, json); return true; } catch { return false; } },
    resetAll: () => { const d = emptyData(ref.current); ref.current = d; setData(d); localStorage.setItem(KEY, JSON.stringify(d)); setCart([]); },
    loadDemo: () => { const d = buildSeed(); d.isDemo = true; ref.current = d; setData(d); localStorage.setItem(KEY, JSON.stringify(d)); setCart([]); },
  }), [data, currentUser, tab, cart, toastMsg, mutate, toast]);

  function date0() { return todayStr(); }
  function receive(d: ErpData, p: Purchase) {
    p.status = 'recu';
    p.items.forEach(it => { const l = locate(d, it.variantId); if (l) { move(d, l.p, l.v, it.quantity, `Réception ${p.number}`); l.p.buyPrice = it.unitCost + (p.freight / Math.max(1, sum(p.items, x => x.quantity))); } });
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
};

export function computeDay(d: ErpData, date: string): DayStats {
  const sales = d.sales.filter(s => s.date === date && isLive(s));
  const pays = [...d.sales.flatMap(s => (s.docType === 'sale' && s.status !== 'cancelled' ? s.payments : [])), ...d.orders.flatMap(o => o.payments)].filter(p => p.date === date);
  const byMethod: DayStats['byMethod'] = {};
  pays.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; });
  const exps = d.expenses.filter(e => e.date === date);
  const cashExpenses = sum(exps.filter(e => e.method === 'Espèces'), e => e.amount);
  return { date, salesCount: sales.length, totalSales: sum(sales, s => s.total), collected: sum(pays, p => p.amount), byMethod, expenses: sum(exps, e => e.amount), cashExpenses, expectedCash: (byMethod['Espèces'] || 0) - cashExpenses };
}

export { addDays };
