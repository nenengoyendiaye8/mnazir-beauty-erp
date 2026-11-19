import type { Delivery, Product, Sale, Settings, TailorOrder, Variant } from '../types';
import { barcodeSvg, fdate, lineTotal, money, printHtml, variantLabel } from './helpers';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const head = (extra = '') => `<meta charset="utf-8"><style>
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;${extra}}
table{width:100%;border-collapse:collapse}.r{text-align:right}.c{text-align:center}hr{border:0;border-top:1px dashed #000;margin:6px 0}
</style>`;

/** Ticket de caisse 80 mm */
export function printReceipt(s: Sale, st: Settings) {
  const rows = s.items.map(i => `<tr><td colspan="2"><b>${esc(i.name)}</b><br><small>${esc(variantLabel(i.size, i.color))}</small></td></tr>
  <tr><td>${i.quantity} × ${money(i.unitPrice)}${i.discount ? ` <small>(-${money(i.discount)})</small>` : ''}</td><td class="r">${money(lineTotal(i))}</td></tr>`).join('');
  printHtml(`<html><head>${head('width:300px;margin:0 auto;font-size:12px;padding:6px')}</head><body>
  <div class="c"><div style="font-size:17px;font-weight:800">${esc(st.name)}</div><div>${esc(st.tagline)}</div><div>${esc(st.address)}<br>${esc(st.city)}</div><div>${st.phones.map(esc).join(' / ')}</div>${st.ninea ? `<div>NINEA : ${esc(st.ninea)}</div>` : ''}</div><hr>
  <div><b>${s.docType === 'proforma' ? 'PROFORMA' : 'TICKET'} ${esc(s.number)}</b><br>Date : ${fdate(s.date)} ${s.time}<br>Client : ${esc(s.customerName)}${s.customerPhone ? ' – ' + esc(s.customerPhone) : ''}<br>Caissier : ${esc(s.cashier)}</div><hr>
  <table>${rows}</table><hr>
  <table><tr><td>Sous-total</td><td class="r">${money(s.subtotal)}</td></tr>
  ${s.discountGlobal ? `<tr><td>Remise</td><td class="r">-${money(s.discountGlobal)}</td></tr>` : ''}${s.taxAmount ? `<tr><td>TVA ${st.vatRate}%</td><td class="r">${money(s.taxAmount)}</td></tr>` : ''}
  <tr style="font-size:15px"><td><b>TOTAL</b></td><td class="r"><b>${money(s.total)}</b></td></tr>
  ${s.payments.map(p => `<tr><td>Payé (${esc(p.method)})</td><td class="r">${money(p.amount)}</td></tr>`).join('')}
  ${s.cashReturned ? `<tr><td>Monnaie rendue</td><td class="r">${money(s.cashReturned)}</td></tr>` : ''}
  ${s.amountRemaining > 0 && s.docType === 'sale' ? `<tr><td><b>RESTE À PAYER</b></td><td class="r"><b>${money(s.amountRemaining)}</b></td></tr>` : ''}</table><hr>
  <div class="c" style="margin:6px 0">${barcodeSvg(s.number, 36, 1.2)}<br><small>${esc(s.number)}</small></div>
  <div class="c"><small>${esc(st.receiptFooter)}</small></div></body></html>`);
}

/** Facture / Proforma A4 */
export function printInvoice(s: Sale, st: Settings) {
  const proforma = s.docType === 'proforma';
  const rows = s.items.map((i, k) => `<tr><td>${k + 1}</td><td><b>${esc(i.name)}</b><br><small>${esc(variantLabel(i.size, i.color))}</small></td><td class="r">${i.quantity}</td><td class="r">${money(i.unitPrice)}</td><td class="r">${i.discount ? money(i.discount) : '—'}</td><td class="r">${money(lineTotal(i))}</td></tr>`).join('');
  printHtml(`<html><head>${head('padding:28px;font-size:13px')}<style>.t th{background:#14532d;color:#fff;padding:7px;text-align:left}.t td{border-bottom:1px solid #ddd;padding:7px}.box{border:1px solid #ccc;border-radius:8px;padding:10px}</style></head><body>
  <table><tr><td style="width:60%"><div style="font-size:24px;font-weight:800;color:#14532d">${esc(st.name)}</div><div>${esc(st.tagline)}</div><div>${esc(st.address)}, ${esc(st.city)}</div><div>Tél : ${st.phones.map(esc).join(' / ')}</div>${st.email ? `<div>${esc(st.email)}</div>` : ''}<div>${st.ninea ? 'NINEA : ' + esc(st.ninea) : ''} ${st.rccm ? ' – RCCM : ' + esc(st.rccm) : ''}</div></td>
  <td class="r"><div style="font-size:26px;font-weight:800">${proforma ? 'FACTURE PROFORMA' : 'FACTURE'}</div><div style="font-size:15px"><b>${esc(s.number)}</b></div><div>Date : ${fdate(s.date)}</div>${s.dueDate ? `<div>Échéance : ${fdate(s.dueDate)}</div>` : ''}</td></tr></table>
  <div class="box" style="margin:18px 0"><b>Client :</b> ${esc(s.customerName)}<br>${s.customerPhone ? 'Tél : ' + esc(s.customerPhone) + '<br>' : ''}${s.customerAddress ? esc(s.customerAddress) : ''}</div>
  <table class="t"><tr><th>#</th><th>Désignation</th><th class="r">Qté</th><th class="r">P.U.</th><th class="r">Remise</th><th class="r">Total</th></tr>${rows}</table>
  <table style="width:300px;margin:14px 0 0 auto"><tr><td>Sous-total</td><td class="r">${money(s.subtotal)}</td></tr>${s.discountGlobal ? `<tr><td>Remise globale</td><td class="r">-${money(s.discountGlobal)}</td></tr>` : ''}${s.taxAmount ? `<tr><td>TVA ${st.vatRate}%</td><td class="r">${money(s.taxAmount)}</td></tr>` : ''}
  <tr style="font-size:16px"><td><b>TOTAL</b></td><td class="r"><b>${money(s.total)}</b></td></tr>${!proforma ? `<tr><td>Déjà payé</td><td class="r">${money(s.amountPaid)}</td></tr><tr><td><b>Reste à payer</b></td><td class="r"><b>${money(s.amountRemaining)}</b></td></tr>` : ''}</table>
  ${proforma ? '<p><i>Cette facture proforma est valable 15 jours et ne constitue pas une facture définitive.</i></p>' : ''}
  ${s.notes ? `<p><b>Notes :</b> ${esc(s.notes)}</p>` : ''}
  <div style="margin-top:50px;display:flex;justify-content:space-between"><div>Signature client</div><div>Cachet & signature ${esc(st.name)}</div></div>
  <p class="c" style="margin-top:40px;color:#555;font-size:11px">${esc(st.receiptFooter)}</p></body></html>`);
}

/** Bon de commande / Lot de production cosmétique */
export function printOrderSlip(o: TailorOrder, st: Settings, tailorName?: string) {
  const m = o.measurements; const lab: Array<[string, number | undefined]> = [['Hydratation (%)', m.poitrine], ['Éclat (%)', m.taille], ['Poids pot (g)', m.epaules], ['Douceur parfum (/5)', m.longueurHaut], ['Karité (g)', m.longueurManche], ['Jasmin / Miel (ml)', m.tourDeCou], ['pH cible', m.hanches], ['Cure (jours)', m.longueurPantalon]];
  printHtml(`<html><head>${head('padding:24px;font-size:13px;max-width:520px;margin:0 auto')}</head><body>
  <div class="c"><div style="font-size:20px;font-weight:800">${esc(st.name)}</div><div>${esc(st.address)} – ${st.phones.map(esc).join(' / ')}</div></div><hr>
  <div style="font-size:16px"><b>${o.kind === 'retouche' ? 'FICHE DE LOT PRODUCTION' : 'BON DE COMMANDE COSMÉTIQUE'} ${esc(o.number)}</b></div>
  <p>Client(e) / Destinataire : <b>${esc(o.customerName)}</b> – ${esc(o.customerPhone)}<br>Produit / Lot : <b>${esc(o.garment)}</b> × ${o.quantity} pot(s)<br>Ingrédients : ${esc(o.fabric)} – Emballage : ${esc(o.color)}<br>Date lancement : ${fdate(o.orderDate)} – <b>Disponibilité prévue : ${fdate(o.dueDate)}</b>${tailorName ? `<br>Formulateur : ${esc(tailorName)}` : ''}</p>
  <table border="1" cellpadding="5">${lab.filter(x => x[1]).map(x => `<tr><td>${x[0]}</td><td class="r">${x[1]}</td></tr>`).join('') || '<tr><td>Formule 100% Naturelle Standard M.Nazir_Beauty</td></tr>'}</table>
  <p>Montant total : <b>${money(o.price)}</b><br>Avance versée : ${money(o.amountPaid)}<br><b>Reste à payer : ${money(o.price - o.amountPaid)}</b></p>${o.notes ? `<p>Notes contrôle qualité : ${esc(o.notes)}</p>` : ''}
  <div class="c">${barcodeSvg(o.number, 34, 1.2)}</div><p class="c"><small>Merci pour votre confiance  Votre beauté, notre priorité — ${esc(st.name)}</small></p></body></html>`);
}

/** Bon de livraison */
export function printDeliverySlip(d: Delivery, st: Settings) {
  printHtml(`<html><head>${head('padding:24px;font-size:13px;max-width:520px;margin:0 auto')}</head><body>
  <div class="c"><div style="font-size:20px;font-weight:800">${esc(st.name)}</div><div>${st.phones.map(esc).join(' / ')}</div></div><hr>
  <div style="font-size:16px"><b>BON DE LIVRAISON ${esc(d.number)}</b></div>
  <p>Date : ${fdate(d.date)}<br>Client : <b>${esc(d.customerName)}</b> – ${esc(d.customerPhone)}<br>Adresse : ${esc(d.address)} (${esc(d.neighborhood)})<br>Livreur : ${esc(d.courier)}</p>
  <p style="font-size:16px">Frais de livraison : <b>${money(d.fee)}</b><br>À encaisser : <b>${money(d.amountToCollect)}</b></p>${d.notes ? `<p>Notes : ${esc(d.notes)}</p>` : ''}
  <div style="margin-top:40px;display:flex;justify-content:space-between"><div>Signature livreur</div><div>Signature client</div></div></body></html>`);
}

/** Planche d'étiquettes (prix + code-barres) pour une liste de variantes */
export function printLabels(items: Array<{ product: Product; variant: Variant; copies: number }>, st: Settings) {
  const cells = items.flatMap(({ product, variant, copies }) => Array.from({ length: Math.max(1, copies) }, () => `<div class="l"><div class="n">${esc(st.name)}</div><div class="p">${esc(product.name)}</div><div class="v">${esc(variantLabel(variant.size, variant.color))}</div><div class="pr">${money(product.sellPrice)}</div>${barcodeSvg(variant.sku, 30, 1.1)}<div class="s">${esc(variant.sku)}</div></div>`)).join('');
  printHtml(`<html><head>${head('padding:8px')}<style>.g{display:flex;flex-wrap:wrap;gap:6px}.l{width:200px;height:130px;border:1px dashed #888;padding:5px;text-align:center;overflow:hidden}.n{font-size:9px;font-weight:700}.p{font-size:11px;font-weight:700}.v{font-size:10px}.pr{font-size:17px;font-weight:800;margin:2px 0}.s{font-size:9px}</style></head><body><div class="g">${cells}</div></body></html>`);
}
