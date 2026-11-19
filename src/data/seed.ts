import type { ErpData, Product, Sale, Customer, Variant, Payment, PaymentMethod, TailorOrder, Expense, Purchase } from '../types';
import { addDays, todayStr, uid, lineTotal } from '../utils/helpers';

export const defaultSettings = (): ErpData['settings'] => ({
  name: 'M.Nazir_Beauty',
  tagline: 'Savon Naturel 100% — Une peau propre, douce et éclatante',
  phones: ['+221 78 661 34 53'],
  address: 'Dakar, Sénégal — Livraison Dakar & Régions',
  city: 'Dakar, Sénégal',
  email: 'contact@mnazir-beauty.sn',
  ninea: 'SN-DKR-2026-MN7866',
  rccm: 'SN-DKR-2026-B-13453',
  openingHours: '08h30 - 21h00 (Lundi au Dimanche)',
  receiptFooter: 'Merci pour votre confiance  Votre beauté, notre priorité ! — M.Nazir_Beauty (Tél / WhatsApp : 78 661 34 53)',
  enableVat: false,
  vatRate: 18,
  loyaltyPer1000: 1,
  loyaltyValuePoint: 100,
  categories: [
    'Savon Naturel',
    'Packs & Coffrets',
    'Gommages & Soins',
    'Huiles & Laits Naturels',
    'Grossiste / Revendeurs',
    'Emballages & Matières'
  ],
  expenseCategories: [
    'Ingrédients Naturels (Karité, Huiles, Jasmin)',
    'Pots Dorés & Étiquettes',
    'Publicité (TikTok, WhatsApp, Instagram)',
    'Transport & Livraison (Tiak-Tiak)',
    'Loyer Atelier & Boutique',
    'Électricité / Eau',
    'Salaires & Commissions',
    'Autre'
  ],
  neighborhoods: [
    'Parcelles Assainies',
    'Sacré-Cœur / Mermoz',
    'Almadies / Ngor',
    'Liberté 6',
    'Maristes / Hann',
    'Plateau / Médina',
    'Grand Yoff / Patte d\'Oie',
    'Pikine / Guédiawaye',
    'Keur Massar / Rufisque',
    'Thiès / Régions'
  ],
  couriers: ['Moussa (Tiak-Tiak)', 'Ibrahima Express', 'Livreur M.Nazir_Beauty', 'Expédition Régions'],
});

let seedCounter = 0;
const sku = (prefix: string) => `${prefix}${String(++seedCounter).padStart(4, '0')}`;
const variants = (prefix: string, sizes: string[], colors: string[], stock: number): Variant[] =>
  sizes.flatMap(size => colors.map(color => ({ id: uid('v'), size, color, stock: stock + ((size.length + color.length) % 6), sku: sku(prefix) })));

function products(): Product[] {
  const d = todayStr();
  const mk = (
    name: string,
    category: string,
    material: string,
    origin: string,
    emoji: string,
    buy: number,
    sell: number,
    v: Variant[],
    desc = '',
    imageUrl?: string
  ): Product => ({
    id: uid('p'),
    name,
    category,
    material,
    origin,
    emoji,
    imageUrl,
    description: desc,
    buyPrice: buy,
    sellPrice: sell,
    minStock: 8,
    variants: v,
    createdAt: addDays(d, -60)
  });

  return [
    mk(
      'Savon Naturel M.Nazir_Beauty (Pot Officiel)',
      'Savon Naturel',
      'Ingrédients 100% Naturels sélectionnés',
      'Sénégal',
      'MN',
      850,
      2500,
      variants('MNS', ['Pot 250g'], ['Original Jasmin & Karité', 'Miel Pur & Douceur', 'Éclat Intense'], 25),
      'Nettoie en profondeur, nourrit la peau, adoucit et hydrate. Convient à tous les types de peau.',
      '/savon-naturel.jpg'
    ),
    mk(
      'Savon Naturel Peaux Sensibles & Bébé',
      'Savon Naturel',
      'Beurre de Karité & Aloé Vera',
      'Sénégal',
      'MN',
      900,
      2500,
      variants('MNP', ['Pot 250g'], ['Sans Parfum / Hypoallergénique', 'Fleur d\'Oranger Douce'], 18),
      'Formule ultra-douce haute tolérance qui apaise, nourrit et protège.',
      '/savon-naturel.jpg'
    ),
    mk(
      'Savon Naturel Format Grand Pot (500g)',
      'Savon Naturel',
      'Karité, Huiles Naturelles & Jasmin',
      'Sénégal',
      'MN',
      1550,
      4500,
      variants('MNG', ['Grand Pot 500g'], ['Original Jasmin', 'Karité Royal'], 16),
      'Format généreux économique pour une utilisation quotidienne.',
      '/savon-naturel.jpg'
    ),
    mk(
      'Pack Duo Éclat (2 Pots Savon Naturel)',
      'Packs & Coffrets',
      '100% Naturel',
      'Sénégal',
      'MN',
      1700,
      4500,
      variants('DUO', ['2 x 250g'], ['Duo Original', '1 Original + 1 Miel Pur'], 14),
      'Offre spéciale 2 pots de Savon Naturel M.Nazir_Beauty.',
      '/savon-naturel.jpg'
    ),
    mk(
      'Pack Trio Beauté (3 Pots Savon Naturel)',
      'Packs & Coffrets',
      '100% Naturel',
      'Sénégal',
      'MN',
      2550,
      6500,
      variants('TRI', ['3 x 250g'], ['Assortiment Éclat & Douceur'], 12),
      'Cure complète d\'un trimestre pour une peau propre, douce et éclatante.',
      '/savon-naturel.jpg'
    ),
    mk(
      'Coffret Prestige M.Nazir_Beauty (Savon + Gommage + Huile)',
      'Packs & Coffrets',
      'Routine Complète 100% Naturelle',
      'Sénégal',
      'MN',
      2900,
      7500,
      variants('COF', ['Coffret 3 pièces'], ['Routine Éclat Jasmin'], 10),
      'Le rituel complet : Savon Naturel 2500F + Gommage Doux + Huile Hydratante.'
    ),
    mk(
      'Gommage Corporel Doux aux Cristaux & Jasmin',
      'Gommages & Soins',
      'Sucre de canne, Miel & Extraits botaniques',
      'Sénégal',
      'MN',
      1050,
      3000,
      variants('GOM', ['Pot 250g'], ['Jasmin & Miel', 'Café & Karité'], 15),
      'Exfolie en douceur et prépare la peau au Savon Naturel.'
    ),
    mk(
      'Masque Visage & Corps Argile Blanche & Miel',
      'Gommages & Soins',
      'Argile pure & actifs naturels',
      'Maroc / Sénégal',
      'MN',
      950,
      2500,
      variants('MAS', ['Pot 200g'], ['Purifiant & Éclat'], 12),
      'Purifie les pores et illumine le teint naturellement.'
    ),
    mk(
      'Chantilly de Karité Pur Fouetté',
      'Huiles & Laits Naturels',
      'Beurre de Karité non raffiné & Huile d\'Amande',
      'Sénégal',
      'MN',
      1100,
      3000,
      variants('KAR', ['Pot 250g'], ['Vanille Douce', 'Jasmin Frais'], 16),
      'Nourrit intensément après la douche au Savon Naturel.'
    ),
    mk(
      'Huile Précieuse Hydratante & Satinée',
      'Huiles & Laits Naturels',
      'Huiles de Baobab, Moringa & Amande Douce',
      'Sénégal',
      'MN',
      950,
      2500,
      variants('HUI', ['Flacon 100 ml'], ['Éclat Doré', 'Fleur de Jasmin'], 18),
      'Adoucit et satine la peau sans film gras.'
    ),
    mk(
      'Pack Demi-Gros Revendeur (5 Pots Savon Naturel)',
      'Grossiste / Revendeurs',
      'Lot de 5 pots officiels 250g',
      'Sénégal',
      'MN',
      4250,
      10500,
      variants('REV5', ['Carton 5 Pots'], ['Original 100% Naturel'], 10),
      'Tarif préférentiel revendeur : revient à 2 100 F le pot (Prix public 2 500 F).',
      '/savon-naturel.jpg'
    ),
    mk(
      'Carton Grossiste Partenaire (10 Pots Savon Naturel)',
      'Grossiste / Revendeurs',
      'Lot de 10 pots officiels 250g',
      'Sénégal',
      'MN',
      8500,
      20000,
      variants('REV10', ['Carton 10 Pots'], ['Original 100% Naturel'], 8),
      'Tarif grossiste : revient à 2 000 F le pot (Marge revendeur : 5 000 F par carton).',
      '/savon-naturel.jpg'
    ),
    mk(
      'Pots Vides Transparents à Couvercle Doré (Stock Atelier)',
      'Emballages & Matières',
      'PET Cosmétique + Couvercle Gold',
      'Import / Dakar',
      'MN',
      220,
      500,
      variants('EMB', ['250g Standard', '500g Grand'], ['Couvercle Or'], 90),
      'Emballage officiel M.Nazir_Beauty pour le conditionnement.'
    ),
    mk(
      'Rouleau 100 Étiquettes Dorées M.Nazir_Beauty',
      'Emballages & Matières',
      'Vinyle imperméable doré',
      'Dakar',
      'MN',
      4500,
      6000,
      variants('ETQ', ['Rouleau 100 pcs'], ['Or & Vert Émeraude'], 6),
      'Étiquettes officielles résistantes à l\'eau pour les pots de Savon Naturel.'
    ),
  ];
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSeed(): ErpData {
  seedCounter = 0;
  const today = todayStr();
  const prods = products();
  const r = rng(786613453);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];

  const customers: Customer[] = [
    { n: 'Aïssatou Ndiaye', p: '77 345 12 89', a: 'Maristes, Dakar', notes: 'Peau normale à sèche · Fan du Savon Naturel 2 500 F' },
    { n: 'Mariama Diop', p: '78 412 90 34', a: 'Parcelles Assainies U15', notes: 'Peau sensible · Commande chaque mois 2 pots' },
    { n: 'Khady Sylla', p: '76 290 44 11', a: 'Almadies, Dakar', notes: 'Adore le Pack Duo Éclat et la Chantilly de Karité' },
    { n: 'Fatou Bintou Fall (Revendeuse)', p: '77 811 55 20', a: 'Keur Massar', notes: 'Partenaire revendeuse (commande par cartons de 10 pots)' },
    { n: 'Sokhna Bâ', p: '78 902 31 67', a: 'Sacré-Cœur 3, Dakar', notes: 'Peau mixte · Routine Savon Naturel + Gommage' },
    { n: 'Ndeye Astou Gueye', p: '77 604 19 82', a: 'Liberté 6 Extension', notes: 'Cliente VIP · Recommande la marque à ses collègues' },
    { n: 'Mame Diarra Sow', p: '78 555 66 77', a: 'Mermoz Pyrotechnie', notes: 'Préfère la livraison par Tiak-Tiak le week-end' },
    { n: 'Adja Coumba Seck (Boutique Thiès)', p: '77 222 11 00', a: 'Thiès Escale', notes: 'Distributrice régionale Thiès' },
  ].map(c => ({
    id: uid('c'),
    fullName: c.n,
    phone: c.p,
    address: c.a,
    notes: c.notes,
    loyaltyPoints: 0,
    totalSpent: 0,
    creditBalance: 0,
    createdAt: addDays(today, -45),
    measurements: {
      poitrine: 85 + Math.floor(r() * 15),   // % Hydratation souhaitée
      taille: 90 + Math.floor(r() * 10),     // % Éclat naturel
      epaules: 250,                          // Grammage pot préféré (g)
      longueurHaut: 5                        // Niveau douceur parfum (/5)
    },
  }));

  const staff = [
    { id: uid('s'), name: 'M. Nazir (Direction)', role: 'Gérant' as const, phone: '78 661 34 53', salary: 150000, commissionRate: 0, active: true },
    { id: uid('s'), name: 'Aïssatou (Conseillère Beauté)', role: 'Vendeuse' as const, phone: '77 510 22 33', salary: 75000, commissionRate: 4, active: true },
    { id: uid('s'), name: 'Mariama (Ventes WhatsApp)', role: 'Vendeuse' as const, phone: '78 440 11 99', salary: 75000, commissionRate: 4, active: true },
    { id: uid('s'), name: 'Fatou (Maître Formulateur)', role: 'Couturier' as const, phone: '76 300 45 67', salary: 100000, commissionRate: 0, active: true },
    { id: uid('s'), name: 'Moussa (Livreur Tiak-Tiak)', role: 'Livreur' as const, phone: '78 300 40 50', salary: 60000, commissionRate: 0, active: true },
  ];

  const suppliers = [
    { id: uid('f'), name: 'Coopérative Karité & Huiles Bio Kédougou', contact: 'Mme Traoré', phone: '77 111 22 33', city: 'Kédougou / Dakar', speciality: 'Beurre de karité pur, huile de baobab & moringa', balanceDue: 0 },
    { id: uid('f'), name: 'Dakar Packaging & Pots Cosmétiques Gold', contact: 'M. Ndiaye', phone: '77 800 90 10', city: 'Dakar Zone Industrielle', speciality: 'Pots transparents à couvercle doré 250g & 500g', balanceDue: 0 },
    { id: uid('f'), name: 'Herboristerie & Extraits Naturels du Sénégal', contact: 'Cheikh Tidiane', phone: '76 450 32 10', city: 'Dakar – Tilène', speciality: 'Base savon végétal, extraits de jasmin, miel pur', balanceDue: 0 },
    { id: uid('f'), name: 'Prestige Gold Print Sénégal', contact: 'Ousmane', phone: '78 123 98 76', city: 'Dakar – Sacré-Cœur', speciality: 'Impression étiquettes dorées imperméables & flyers', balanceDue: 0 },
  ];

  // ---- Ventes historiques sur 30 jours (avec mise en avant du Savon Naturel à 2 500 F) ----
  const sales: Sale[] = [];
  const methods: PaymentMethod[] = ['Wave', 'Wave', 'Wave', 'Orange Money', 'Orange Money', 'Espèces', 'Free Money'];
  const saleProducts = prods.slice(0, 12); // Produits commercialisés
  let n = 0;

  for (let back = 29; back >= 0; back--) {
    const date = addDays(today, -back);
    const count = 2 + Math.floor(r() * 4) + (new Date(date + 'T12:00:00').getDay() === 6 ? 3 : 0);
    for (let k = 0; k < count; k++) {
      const nLines = 1 + (r() < 0.4 ? 1 : 0);
      const items = Array.from({ length: nLines }, (_, idx) => {
        // 65% du temps, le 1er produit est le Savon Naturel 2 500 F
        const p = idx === 0 && r() < 0.65 ? saleProducts[0] : pick(saleProducts);
        const v = pick(p.variants);
        const q = p.sellPrice === 2500 ? 1 + Math.floor(r() * 3) : 1;
        return {
          productId: p.id,
          variantId: v.id,
          name: p.name,
          size: v.size,
          color: v.color,
          sku: v.sku,
          quantity: q,
          unitPrice: p.sellPrice,
          buyPrice: p.buyPrice,
          discount: 0
        };
      });
      const subtotal = items.reduce((t, i) => t + i.quantity * i.unitPrice, 0);
      const total = items.reduce((t, i) => t + lineTotal(i), 0);
      const cust = r() < 0.65 ? pick(customers) : undefined;
      const credit = cust && r() < 0.14;
      const paid = credit ? Math.round((total * 0.5) / 500) * 500 : total;
      const time = `${String(9 + Math.floor(r() * 11)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`;
      const pay: Payment[] = paid > 0 ? [{ id: uid('pay'), date, time, amount: paid, method: pick(methods), cashier: 'M. Nazir' }] : [];
      const seller = pick(staff.filter(s => s.role === 'Vendeuse'));
      sales.push({
        id: uid('sale'),
        number: `MN-${today.slice(0, 4)}-${String(++n).padStart(4, '0')}`,
        docType: 'sale',
        date,
        time,
        customerId: cust?.id,
        customerName: cust?.fullName || 'Cliente WhatsApp / Comptoir',
        customerPhone: cust?.phone,
        customerAddress: cust?.address,
        items,
        subtotal,
        discountGlobal: 0,
        total,
        taxAmount: 0,
        payments: pay,
        amountPaid: paid,
        amountRemaining: total - paid,
        dueDate: credit ? addDays(date, 10) : undefined,
        status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
        sellerId: seller.id,
        cashier: 'M. Nazir',
        channel: r() < 0.5 ? 'whatsapp' : r() < 0.8 ? 'boutique' : 'livraison',
      });
    }
  }

  customers.forEach(c => {
    const mine = sales.filter(s => s.customerId === c.id);
    c.totalSpent = mine.reduce((t, s) => t + s.total, 0);
    c.loyaltyPoints = Math.floor(c.totalSpent / 1000);
    c.creditBalance = mine.reduce((t, s) => t + s.amountRemaining, 0);
  });

  // ---- Lots de Production & Commandes Personnalisées Atelier Cosmétique ----
  const orders: TailorOrder[] = [
    {
      id: uid('o'),
      number: `LOT-${today.slice(0, 4)}-0001`,
      kind: 'sur_mesure',
      customerId: customers[3].id,
      customerName: customers[3].fullName,
      customerPhone: customers[3].phone,
      garment: 'Lot 20 Pots Savon Naturel 250g (Commande Revendeuse)',
      fabric: 'Base Karité, Huiles Naturelles & Jasmin',
      color: 'Pots Couvercle Or',
      quantity: 20,
      measurements: { poitrine: 95, taille: 95, epaules: 250, longueurHaut: 5 },
      price: 40000,
      payments: [{ id: uid('pay'), date: addDays(today, -3), time: '11:30', amount: 25000, method: 'Wave', cashier: 'M. Nazir' }],
      amountPaid: 25000,
      tailorId: staff[3].id,
      orderDate: addDays(today, -3),
      dueDate: addDays(today, 2),
      status: 'en_couture',
      notes: 'Étiquetage officiel M.Nazir_Beauty 100% Naturel. Livraison Keur Massar.'
    },
    {
      id: uid('o'),
      number: `LOT-${today.slice(0, 4)}-0002`,
      kind: 'sur_mesure',
      customerId: customers[0].id,
      customerName: customers[0].fullName,
      customerPhone: customers[0].phone,
      garment: 'Coffret Mariage & Éclat (4 Pots Savon Naturel + 2 Chantilly Karité)',
      fabric: 'Formule Enrichie Miel & Fleurs de Jasmin',
      color: 'Édition Dorée Prestige',
      quantity: 6,
      measurements: { poitrine: 100, taille: 100, epaules: 250, longueurHaut: 5 },
      price: 15000,
      payments: [{ id: uid('pay'), date: addDays(today, -2), time: '15:00', amount: 15000, method: 'Wave', cashier: 'M. Nazir' }],
      amountPaid: 15000,
      tailorId: staff[3].id,
      orderDate: addDays(today, -2),
      dueDate: today,
      status: 'pret',
      notes: 'Prêt à être livré aux Maristes. Emballage cadeau inclus.'
    },
    {
      id: uid('o'),
      number: `LOT-${today.slice(0, 4)}-0003`,
      kind: 'retouche',
      customerId: customers[7].id,
      customerName: customers[7].fullName,
      customerPhone: customers[7].phone,
      garment: 'Production Stock Boutique : 50 Pots Savon Naturel 2 500 F',
      fabric: 'Ingrédients 100% naturels sélectionnés',
      color: 'Crème & Jasmin',
      quantity: 50,
      measurements: { epaules: 250 },
      price: 125000,
      payments: [{ id: uid('pay'), date: addDays(today, -1), time: '09:30', amount: 125000, method: 'Orange Money', cashier: 'M. Nazir' }],
      amountPaid: 125000,
      tailorId: staff[3].id,
      orderDate: addDays(today, -1),
      dueDate: addDays(today, 4),
      status: 'finition',
      notes: 'Mise en pot et pose des étiquettes dorées M.Nazir_Beauty.'
    },
  ];

  const expenses: Expense[] = [
    { id: uid('e'), date: addDays(today, -20), category: 'Ingrédients Naturels (Karité, Huiles, Jasmin)', label: 'Achat 25 kg Beurre de Karité & Base Savon Végétal', amount: 45000, method: 'Wave', cashier: 'M. Nazir' },
    { id: uid('e'), date: addDays(today, -14), category: 'Pots Dorés & Étiquettes', label: 'Achat 200 pots transparents à couvercle doré + étiquettes', amount: 32000, method: 'Orange Money', cashier: 'M. Nazir' },
    { id: uid('e'), date: addDays(today, -7), category: 'Publicité (TikTok, WhatsApp, Instagram)', label: 'Campagne sponsorisée affiche Savon Naturel 2 500 F', amount: 15000, method: 'Wave', cashier: 'M. Nazir' },
    { id: uid('e'), date: addDays(today, -2), category: 'Transport & Livraison (Tiak-Tiak)', label: 'Forfait coursiers livraisons groupées Dakar', amount: 10000, method: 'Espèces', cashier: 'M. Nazir' },
  ];

  const purchases: Purchase[] = [
    {
      id: uid('a'),
      number: `ACH-${today.slice(0, 4)}-0001`,
      date: addDays(today, -10),
      supplierId: suppliers[1].id,
      supplierName: suppliers[1].name,
      items: [{
        productId: prods[12].id,
        variantId: prods[12].variants[0].id,
        name: prods[12].name,
        size: prods[12].variants[0].size,
        color: prods[12].variants[0].color,
        quantity: 200,
        unitCost: 220
      }],
      freight: 3000,
      total: 47000,
      payments: [{ id: uid('pay'), date: addDays(today, -10), time: '10:00', amount: 47000, method: 'Wave', cashier: 'M. Nazir' }],
      amountPaid: 47000,
      status: 'recu'
    },
    {
      id: uid('a'),
      number: `ACH-${today.slice(0, 4)}-0002`,
      date: addDays(today, -2),
      supplierId: suppliers[0].id,
      supplierName: suppliers[0].name,
      items: [{
        productId: prods[0].id,
        variantId: prods[0].variants[0].id,
        name: 'Lot Matières Premières Karité & Extraits de Jasmin (équivalent 60 pots)',
        size: prods[0].variants[0].size,
        color: prods[0].variants[0].color,
        quantity: 60,
        unitCost: 850
      }],
      freight: 4000,
      total: 55000,
      payments: [{ id: uid('pay'), date: addDays(today, -2), time: '14:00', amount: 30000, method: 'Orange Money', cashier: 'M. Nazir' }],
      amountPaid: 30000,
      status: 'commande',
      expectedDate: addDays(today, 3)
    },
  ];
  suppliers[0].balanceDue = 25000;

  return {
    settings: defaultSettings(),
    products: prods,
    customers,
    sales,
    orders,
    deliveries: [
      {
        id: uid('l'),
        number: `LIV-${today.slice(0, 4)}-0001`,
        date: today,
        customerName: 'Khady Sylla',
        customerPhone: '76 290 44 11',
        address: 'Almadies, près King Fahd Palace',
        neighborhood: 'Almadies / Ngor',
        fee: 1500,
        courier: 'Moussa (Tiak-Tiak)',
        amountToCollect: 7500,
        status: 'en_route',
        notes: '3 Pots de Savon Naturel (3 x 2 500 F) — Paiement Wave à la livraison'
      },
      {
        id: uid('l'),
        number: `LIV-${today.slice(0, 4)}-0002`,
        date: today,
        customerName: 'Sokhna Bâ',
        customerPhone: '78 902 31 67',
        address: 'Sacré-Cœur 3 Pyrotechnie, Villa 42',
        neighborhood: 'Sacré-Cœur / Mermoz',
        fee: 1000,
        courier: 'Moussa (Tiak-Tiak)',
        amountToCollect: 5000,
        status: 'preparation',
        notes: '2 Pots Savon Naturel 2 500 F'
      }
    ],
    suppliers,
    purchases,
    expenses,
    staff,
    stockMoves: [],
    closings: [],
    users: [
      { id: uid('u'), name: 'M. Nazir (Admin)', username: 'admin', pin: '1234', role: 'admin', active: true },
      { id: uid('u'), name: 'Gérant(e) Boutique', username: 'gerant', pin: '2345', role: 'gerant', active: true },
      { id: uid('u'), name: 'Caissière / Vente', username: 'caisse', pin: '0000', role: 'caissier', active: true },
    ],
    seq: { sale: n, proforma: 0, order: 3, delivery: 2, purchase: 2 },
  };
}
