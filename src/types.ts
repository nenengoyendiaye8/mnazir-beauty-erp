// ===================== TYPES – BPB ERP (Boutigou Pays Bi) =====================

export type ModuleId =
  | 'dashboard' | 'pos' | 'ventes' | 'facturation' | 'sur_mesure' | 'livraisons'
  | 'stock' | 'achats' | 'clients' | 'fournisseurs'
  | 'finances' | 'personnel' | 'rapports' | 'utilisateurs' | 'parametres';

export type PaymentMethod = 'Espèces' | 'Wave' | 'Orange Money' | 'Free Money' | 'Carte Bancaire' | 'Virement' | 'Chèque';
export const PAYMENT_METHODS: PaymentMethod[] = ['Espèces', 'Wave', 'Orange Money', 'Free Money', 'Carte Bancaire', 'Virement', 'Chèque'];

export interface Variant {
  id: string;
  size: string;      // ex: "M", "L", "XL", "54"
  color: string;     // ex: "Blanc", "Bleu nuit"
  stock: number;
  sku: string;       // code-barres / SKU unique de la variante
}

export interface Product {
  id: string;
  name: string;
  category: string;       // une des catégories de settings.categories
  material: string;       // Bazin riche, Coton, Soie, Lin, Brodé main...
  origin?: string;        // Mali, Sénégal, Maroc, Turquie, Dubaï...
  emoji: string;          // pictogramme affiché si pas de photo
  imageUrl?: string;
  description?: string;
  buyPrice: number;       // prix d'achat (coût de revient)
  sellPrice: number;      // prix de vente public
  minStock: number;       // seuil d'alerte (sur le stock total du modèle)
  variants: Variant[];
  createdAt: string;      // YYYY-MM-DD
}

export interface Measurements {
  poitrine?: number; taille?: number; epaules?: number; longueurHaut?: number;
  longueurManche?: number; tourDeCou?: number; hanches?: number; longueurPantalon?: number;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  address: string;
  email?: string;
  notes?: string;
  loyaltyPoints: number;     // 1 point / 1000 FCFA
  totalSpent: number;
  creditBalance: number;     // reste à payer cumulé (calculé par le store)
  measurements?: Measurements;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  sku: string;
  quantity: number;
  unitPrice: number;        // prix unitaire réellement facturé
  buyPrice: number;         // coût unitaire (snapshot)
  discount: number;         // remise totale sur la ligne en FCFA
}

export interface Payment {
  id: string;
  date: string;             // YYYY-MM-DD
  time: string;             // HH:mm
  amount: number;
  method: PaymentMethod;
  reference?: string;
  cashier: string;
}

export type DocType = 'sale' | 'proforma';
export type SaleStatus = 'paid' | 'partial' | 'unpaid' | 'cancelled' | 'proforma';

export interface Sale {
  id: string;
  number: string;            // F-2026-0001 / PRO-2026-0001
  docType: DocType;
  date: string;
  time: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: SaleItem[];
  subtotal: number;
  discountGlobal: number;    // remise globale en FCFA
  total: number;             // subtotal - remises lignes - discountGlobal (+ TVA si activée)
  taxAmount: number;
  payments: Payment[];
  amountPaid: number;
  amountRemaining: number;
  dueDate?: string;
  status: SaleStatus;
  sellerId?: string;         // vendeur (commission)
  cashier: string;
  channel: 'boutique' | 'whatsapp' | 'livraison';
  notes?: string;
  cashReceived?: number;
  cashReturned?: number;
}

export interface TailorOrder {   // Commande sur mesure / retouche
  id: string;
  number: string;           // CM-2026-0001
  kind: 'sur_mesure' | 'retouche';
  customerId?: string;
  customerName: string;
  customerPhone: string;
  garment: string;          // ex: "Djallaba brodée homme"
  fabric: string;           // tissu choisi
  color: string;
  quantity: number;
  measurements: Measurements;
  price: number;
  payments: Payment[];
  amountPaid: number;
  tailorId?: string;        // StaffMember (couturier)
  orderDate: string;
  dueDate: string;
  status: 'a_couper' | 'en_couture' | 'finition' | 'pret' | 'livre' | 'annule';
  notes?: string;
}

export interface Delivery {
  id: string;
  number: string;           // LIV-2026-0001
  date: string;
  saleId?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhood: string;
  fee: number;
  courier: string;
  amountToCollect: number;  // à encaisser à la livraison (0 si déjà payé)
  status: 'preparation' | 'en_route' | 'livre' | 'annule';
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  city: string;
  speciality: string;
  notes?: string;
  balanceDue: number;       // dette (calculée par le store)
}

export interface PurchaseItem { productId: string; variantId: string; name: string; size: string; color: string; quantity: number; unitCost: number; }
export interface Purchase {
  id: string;
  number: string;           // ACH-2026-0001
  date: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  freight: number;          // frais de transport
  total: number;            // somme lignes + freight
  payments: Payment[];
  amountPaid: number;
  status: 'commande' | 'recu' | 'annule';
  expectedDate?: string;
  notes?: string;
}

export interface Expense {
  id: string; date: string; category: string; label: string; amount: number; method: PaymentMethod; cashier: string;
}

export interface StaffMember {
  id: string; name: string; role: 'Gérant' | 'Vendeur' | 'Vendeuse' | 'Caissier' | 'Couturier' | 'Livreur' | 'Autre';
  phone: string; salary: number; commissionRate: number; // % sur ventes (vendeurs)
  active: boolean;
}

export interface StockMove {
  id: string; date: string; time: string; productId: string; variantId: string; label: string;
  delta: number; reason: string; user: string;
}

export interface CashClosing {
  id: string; date: string; time: string; user: string;
  salesCount: number; totalSales: number;
  byMethod: Partial<Record<PaymentMethod, number>>;
  expenses: number; expectedCash: number; countedCash: number; gap: number; notes?: string;
}

export type Role = 'admin' | 'gerant' | 'caissier';
export interface AppUser { id: string; name: string; username: string; pin: string; role: Role; active: boolean; }

export interface Settings {
  name: string; tagline: string; phones: string[]; address: string; city: string; email?: string;
  ninea: string; rccm: string; openingHours: string;
  receiptFooter: string; enableVat: boolean; vatRate: number;
  loyaltyPer1000: number;       // points par tranche de 1000 FCFA
  loyaltyValuePoint: number;    // valeur d'un point en FCFA lors d'une utilisation
  categories: string[];
  expenseCategories: string[];
  neighborhoods: string[];
  couriers: string[];
}

export interface ErpData {
  settings: Settings;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  orders: TailorOrder[];
  deliveries: Delivery[];
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  staff: StaffMember[];
  stockMoves: StockMove[];
  closings: CashClosing[];
  users: AppUser[];
  seq: { sale: number; proforma: number; order: number; delivery: number; purchase: number };
  isDemo?: boolean;
}

/** Permissions par rôle */
export const ROLE_MODULES: Record<Role, ModuleId[]> = {
  admin: ['dashboard', 'pos', 'ventes', 'facturation', 'sur_mesure', 'livraisons', 'stock', 'achats', 'clients', 'fournisseurs', 'finances', 'personnel', 'rapports', 'utilisateurs', 'parametres'],
  gerant: ['dashboard', 'pos', 'ventes', 'facturation', 'sur_mesure', 'livraisons', 'stock', 'achats', 'clients', 'fournisseurs', 'finances', 'personnel', 'rapports'],
  caissier: ['dashboard', 'pos', 'ventes', 'sur_mesure', 'livraisons', 'clients'],
};
