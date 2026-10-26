// Builds a FatturaPA XML (FPR12, TD01) from an order.
// Prices arriving here are VAT-INCLUSIVE (what the customer paid): VAT is scorporata per aliquota,
// so ImponibileImporto + Imposta always equals the amount actually charged.
// Returns { xml, warnings } — warnings are data problems the owner should check before sending.

function pad(n, len) { return String(n).padStart(len, '0'); }
// FatturaPA text fields accept only Basic Latin + Latin-1 (String…LatinType): map typographic
// characters (— – ’ “ … ×) to ASCII and drop anything else outside U+0000–U+00FF.
function latin1(s) {
  return String(s ?? '')
    .replace(/[\u2012-\u2015\u2212]/g, '-').replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"').replace(/\u2026/g, '...').replace(/\u00D7/g, 'x')
    .replace(/[\u00A0\u2000-\u200B\u202F]/g, ' ').replace(/\u20AC/g, 'EUR')
    .normalize('NFC').replace(/[^\u0000-\u00FF]/g, (c) => c.normalize('NFD').replace(/[^\u0000-\u00FF]/g, ''));
}
function esc(s) {
  return latin1(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const eur = (cents) => (cents / 100).toFixed(2);
const clean = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

// customer: { type: 'privato'|'azienda'|'estero', name, company, vat, cf, pec, sdi, address, cap, city, province, country }
function buyerBlock(c, warnings) {
  const country = clean(c.country) || 'IT';
  const foreign = country !== 'IT';
  if (!/^[A-Z]{2}$/.test(country)) warnings.push(`Codice paese cliente non valido: "${c.country}"`);
  let vat = clean(c.vat).replace(/^[A-Z]{2}(?=\d)/, '');
  let cf = clean(c.cf);
  // Italian companies may type a CF (16 chars) in the "P.IVA / CF" field.
  if (!foreign && vat && !/^\d{11}$/.test(vat)) { if (!cf) cf = vat; vat = ''; }

  let fiscal = '';
  if (vat) fiscal += `<IdFiscaleIVA><IdPaese>${esc(country)}</IdPaese><IdCodice>${esc(vat)}</IdCodice></IdFiscaleIVA>`;
  if (!foreign && cf) fiscal += `<CodiceFiscale>${esc(cf)}</CodiceFiscale>`;
  if (!fiscal && foreign) fiscal = `<IdFiscaleIVA><IdPaese>${esc(country)}</IdPaese><IdCodice>99999999999</IdCodice></IdFiscaleIVA>`;
  if (!fiscal) warnings.push('Cliente senza Partita IVA né Codice Fiscale');

  const company = c.type === 'azienda' || (foreign && c.company);
  let anagrafica;
  if (company) {
    anagrafica = `<Denominazione>${esc(c.company || c.name)}</Denominazione>`;
  } else {
    const parts = String(c.name || '').trim().split(/\s+/);
    const nome = parts.shift() || 'Cliente';
    const cognome = parts.join(' ') || nome;
    anagrafica = `<Nome>${esc(nome)}</Nome><Cognome>${esc(cognome)}</Cognome>`;
  }

  const prov = clean(c.province);
  if (!foreign && !/^[A-Z]{2}$/.test(prov)) warnings.push('Provincia cliente mancante');
  const cap = foreign ? '00000' : clean(c.cap);
  if (!foreign && !/^\d{5}$/.test(cap)) warnings.push(`CAP cliente non valido: "${c.cap}"`);

  let codDest = foreign ? 'XXXXXXX' : (clean(c.sdi) || '0000000');
  if (!foreign && !/^[A-Z0-9]{7}$/.test(codDest)) { warnings.push(`Codice SDI non valido: "${c.sdi}"`); codDest = '0000000'; }
  if (c.type === 'azienda' && foreign === false && codDest === '0000000' && !c.pec) warnings.push('Azienda senza Codice SDI né PEC');
  if (foreign && vat && company) warnings.push('Cliente aziendale estero con P.IVA: verifica se serve non imponibilità (art. 41) invece del 22%');

  return {
    codDest,
    pec: codDest === '0000000' && c.pec ? c.pec : '',
    xml: `<CessionarioCommittente>
      <DatiAnagrafici>${fiscal}<Anagrafica>${anagrafica}</Anagrafica></DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(c.address)}</Indirizzo>
        <CAP>${esc(cap)}</CAP>
        <Comune>${esc(c.city)}</Comune>
        ${!foreign && prov ? `<Provincia>${esc(prov)}</Provincia>` : ''}
        <Nazione>${esc(country)}</Nazione>
      </Sede>
    </CessionarioCommittente>`,
  };
}

// order: { invoiceNumber, progressivo, ref, date, totalCents, customer, lines: [{ description, quantity, unitPrice (gross €), vatRate }] }
function buildFatturaPAXml(order, seller) {
  const warnings = [];
  const d = order.date || new Date();
  const dataDoc = `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
  for (const k of ['name', 'vatNumber', 'address', 'cap', 'city']) if (!seller[k]) warnings.push(`Dato venditore mancante: SELLER_${k.replace(/[A-Z]/g, (m) => '_' + m).toUpperCase()}`);

  // Group gross amounts by rate, scorporo per group, then spread the net over the lines.
  const lines = order.lines.map((l) => ({ ...l, grossCents: Math.round(l.quantity * l.unitPrice * 100) }));
  const groups = {};
  lines.forEach((l) => { (groups[l.vatRate] = groups[l.vatRate] || []).push(l); });
  const riepiloghi = [];
  for (const [rateStr, ls] of Object.entries(groups)) {
    const r = parseFloat(rateStr);
    const gross = ls.reduce((t, l) => t + l.grossCents, 0);
    const imponibile = Math.round(gross / (1 + r / 100));
    let assigned = 0;
    ls.forEach((l, i) => {
      l.netCents = i === ls.length - 1 ? imponibile - assigned : Math.round(l.grossCents / (1 + r / 100));
      assigned += l.netCents;
    });
    riepiloghi.push(`
      <DatiRiepilogo>
        <AliquotaIVA>${r.toFixed(2)}</AliquotaIVA>
        <ImponibileImporto>${eur(imponibile)}</ImponibileImporto>
        <Imposta>${eur(gross - imponibile)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>`);
  }
  const sumGross = lines.reduce((t, l) => t + l.grossCents, 0);
  if (sumGross !== order.totalCents) warnings.push(`Somma righe € ${eur(sumGross)} diversa dal pagato € ${eur(order.totalCents)}`);

  const dettaglio = lines.map((l, i) => `
      <DettaglioLinee>
        <NumeroLinea>${i + 1}</NumeroLinea>
        <Descrizione>${esc(String(l.description || 'Articolo').slice(0, 1000))}</Descrizione>
        <Quantita>${Number(l.quantity).toFixed(2)}</Quantita>
        <PrezzoUnitario>${(l.netCents / 100 / l.quantity).toFixed(6)}</PrezzoUnitario>
        <PrezzoTotale>${eur(l.netCents)}</PrezzoTotale>
        <AliquotaIVA>${Number(l.vatRate).toFixed(2)}</AliquotaIVA>
      </DettaglioLinee>`).join('');

  const buyer = buyerBlock(order.customer, warnings);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>01879020517</IdCodice></IdTrasmittente>
      <ProgressivoInvio>${esc(order.progressivo)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${esc(buyer.codDest)}</CodiceDestinatario>
      ${buyer.pec ? `<PECDestinatario>${esc(buyer.pec)}</PECDestinatario>` : ''}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${esc(seller.vatNumber)}</IdCodice></IdFiscaleIVA>
        ${seller.fiscalCode ? `<CodiceFiscale>${esc(seller.fiscalCode)}</CodiceFiscale>` : ''}
        <Anagrafica><Denominazione>${esc(seller.name)}</Denominazione></Anagrafica>
        <RegimeFiscale>${esc(seller.regimeFiscale || 'RF01')}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${esc(seller.address)}</Indirizzo>
        <CAP>${esc(seller.cap)}</CAP>
        <Comune>${esc(seller.city)}</Comune>
        ${seller.province ? `<Provincia>${esc(seller.province)}</Provincia>` : ''}
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    ${buyer.xml}
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${dataDoc}</Data>
        <Numero>${esc(order.invoiceNumber)}</Numero>
        <ImportoTotaleDocumento>${eur(order.totalCents)}</ImportoTotaleDocumento>
        <Causale>${esc(`Ordine ${order.ref} - pagato online`)}</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${dettaglio}${riepiloghi.join('')}
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP08</ModalitaPagamento>
        <ImportoPagamento>${eur(order.totalCents)}</ImportoPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;
  return { xml, warnings };
}

module.exports = { buildFatturaPAXml };
