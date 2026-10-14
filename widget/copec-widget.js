// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: bus;

// Copec · widget para la pantalla de inicio del iPhone (app Scriptable)
//
// Muestra el saldo de la cuenta Copec Pay y los tres últimos cargos de bip!. Parte del saldo que la app Copec
// publica en el buzón (el repositorio privado de GitHub) y le descuenta los cargos que llegaron después, aunque no
// hayas abierto la app: en la mañana, apenas Atajos envía los correos de la noche, el widget ya los descuenta.
// No copies este archivo a mano: usa el botón «Copiar el script del widget» de la app Copec, que completa las dos
// líneas siguientes con tu repositorio y tu token.
const REPO = '__REPO__';
const TOKEN = '__TOKEN__';

const API = 'https://api.github.com/repos/' + REPO;
const MS_TITLE = 'Copec · widget';
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MAX_AMOUNT = 9999999999;

/* ---------- Formatos ---------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function validDate(k) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k))) return false;
  const p = k.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
}
function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 60); }
function dots(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function money(n) { return (n < 0 ? '−' : '') + '$' + dots(n); }
function dayLabel(k) {
  const t = new Date(), y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (k === dayKey(t)) return 'hoy';
  if (k === dayKey(y)) return 'ayer';
  const p = k.split('-');
  return (+p[2]) + ' ' + MES[+p[1] - 1];
}
function atMs(at) { return new Date(+at.slice(0, 4), +at.slice(5, 7) - 1, +at.slice(8, 10), +at.slice(11, 13), +at.slice(14, 16)).getTime(); }

/* ---------- Lector de los avisos: el mismo de la app Copec, copiado tal cual ---------- */
/* LECTOR:INICIO */
/* ---------- Lector de los avisos de Copec Pay ---------- */
// El lector no depende de una frase exacta. De cada correo busca el monto, el comercio, la fecha y la hora del
// cargo, vengan en una oración («…un cargo por $5.990 en NETFLIX el 10/10/2026 a las 03:12») o como una lista
// de datos («Monto: $5.990 · Comercio: NETFLIX · Fecha: 10/10/2026 · Hora: 03:12»).
//
// La fecha y la hora que se guardan son las del cargo, no las de llegada del correo: los cargos se hacen de noche
// y el correo llega recién al encender el iPhone. Si el aviso no trae la hora o la fecha, ver «settle».

// Si Atajos entrega el correo mal decodificado, «é» llega como «Ã©» y el espacio duro como «Â ». Esto lo repara
// letra por letra, sin tocar el texto que viene bien.
var CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
function contByte(ch) { var c = ch.charCodeAt(0); if (c > 0xff) c = CP1252[c] || 0; return c >= 0x80 && c <= 0xbf ? c : -1; }
function demojibake(s) {
  if (!/[ÂÃâ]/.test(s)) return s;
  return s.replace(/[ÂÃ][^\u0000-\u007f]|â[^\u0000-\u007f]{2}/g, function (seq) {
    var b1 = contByte(seq.charAt(1)), b2 = seq.length > 2 ? contByte(seq.charAt(2)) : 0;
    if (b1 < 0 || b2 < 0) return seq;
    return String.fromCharCode(seq.length > 2 ? (0x2 << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f) : ((seq.charCodeAt(0) & 0x1f) << 6) | (b1 & 0x3f));
  });
}
// Texto a bytes UTF-8 y de vuelta, escrito a mano: el mismo lector corre en el widget de Scriptable, sin las
// funciones del navegador (TextDecoder, atob).
function utf8Bytes(str, out) {
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var d = str.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
    else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
  }
  return out;
}
function utf8Text(b) {   // null si los bytes no son UTF-8 válido
  var out = '', i = 0;
  while (i < b.length) {
    var c = b[i++];
    if (c < 0x80) { out += String.fromCharCode(c); continue; }
    var n = c >= 0xc2 && c < 0xe0 ? 1 : c >= 0xe0 && c < 0xf0 ? 2 : c >= 0xf0 && c < 0xf5 ? 3 : 0;
    if (!n || i + n > b.length) return null;
    var cp = c & (n === 1 ? 0x1f : n === 2 ? 0x0f : 0x07);
    for (var k = 0; k < n; k++) { var x = b[i++]; if ((x & 0xc0) !== 0x80) return null; cp = cp << 6 | x & 0x3f; }
    if (cp >= 0x10000) { cp -= 0x10000; out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); }
    else out += String.fromCharCode(cp);
  }
  return out;
}
var CP1252_BACK = {};
Object.keys(CP1252).forEach(function (k) { CP1252_BACK[CP1252[k]] = +k; });
// Bytes a texto: UTF-8 si es válido; si no, la codificación habitual de los correos en español (Windows-1252)
function bytesToText(bytes) {
  var t = utf8Text(bytes);
  if (t !== null) return t;
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(CP1252_BACK[bytes[i]] || bytes[i]);
  return out;
}
var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64Bytes(str) {
  var out = [], acc = 0, bits = 0;
  for (var i = 0; i < str.length; i++) {
    var v = B64.indexOf(str.charAt(i));
    if (v < 0) continue;
    acc = (acc << 6 | v) & 0xffffff; bits += 6;
    if (bits >= 8) { bits -= 8; out.push(acc >> bits & 0xff); }
  }
  return out;
}
// Un correo puede llegar tal como viaja por la red: con «=C3=A9» y líneas cortadas con «=», o entero en base64
function unwrapMail(raw) {
  var src = String(raw == null ? '' : raw), out = [];
  if (/=\r?\n|=[0-9A-Fa-f]{2}/.test(src)) {
    var q = src.replace(/=\r?\n/g, ''), bytes = [], last = 0, re = /(?:=[0-9A-Fa-f]{2})+/g, m;
    while ((m = re.exec(q))) {
      utf8Bytes(q.slice(last, m.index), bytes);
      m[0].slice(1).split('=').forEach(function (h) { bytes.push(parseInt(h, 16)); });
      last = re.lastIndex;
    }
    utf8Bytes(q.slice(last), bytes);
    out.push(bytesToText(bytes));
  }
  var b = src.replace(/\s+/g, '');
  if (b.length >= 80 && b.length % 4 === 0 && /^[A-Za-z0-9+\/]+={0,2}$/.test(b)) out.push(bytesToText(b64Bytes(b)));
  return out;
}
// Entidades de HTML («&eacute;», «&#36;»): las habituales en un correo en español
var ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", dollar: '$', num: '#', percnt: '%', excl: '!', quest: '?', ast: '*',
  colon: ':', semi: ';', comma: ',', period: '.', sol: '/', lpar: '(', rpar: ')', deg: '°', ordm: 'º', ordf: 'ª', iexcl: '¡', iquest: '¿',
  laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  euro: '€', copy: '©', reg: '®', trade: '™', times: '×', shy: '', zwnj: '', zwj: '', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü' };
'aeiouAEIOU'.split('').forEach(function (v, i) { ENT[v + 'acute'] = 'áéíóúÁÉÍÓÚ'.charAt(i); });
function decodeEntities(str) {
  return str.replace(/&(#x?[0-9a-f]+|[a-z]+[0-9]*);/gi, function (all, e) {
    if (e.charAt(0) === '#') {
      var c = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ' '; } catch (er) { return ' '; }
    }
    return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : all;
  });
}
// Texto del correo sin etiquetas. Cada bloque del correo (párrafo, fila o celda de una tabla) queda en su propia línea.
function plainText(s) {
  s = String(s == null ? '' : s);
  if (s.length > 4000000) s = s.slice(-4000000);
  s = demojibake(s);
  if (s.normalize) s = s.normalize('NFC');   // «é» siempre como una sola letra, venga como venga en el correo
  if (/<[a-z!\/][^>]*>/i.test(s)) {
    s = s.replace(/<(script|style|head|title)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|tr|li|h[1-6]|table|ul|ol|td|th|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
  }
  if (/&[#a-z0-9]+;/i.test(s)) s = decodeEntities(s);
  return s.replace(/[   ​‌‍﻿]/g, ' ');
}

var LETTER = 'a-záéíóúüñ';
// La app registra solo los correos de bip!: los que traen «bip» en el asunto («Tu compra en Carga bip! se realizó con éxito»)
var RE_BIP = new RegExp('(?:^|[^' + LETTER + '0-9])bip(?![' + LETTER + '0-9])', 'i');
// Encabezado del aviso: «Tu compra en Carga bip! se realizó con éxito». Lo que va entre «en» y «se realizó» es el comercio.
var RE_HEAD = /(?:compra|pago|cargo|transacci[oó]n|recarga)\s+en\s+(.{2,60}?)\s+(?:se\s+(?:realiz|proces|complet|hizo|efectu)|fue\s|ha\s+sido|no\s+(?:se\s+)?(?:pudo|ha\s+podido|realiz|proces)|est[aá]\s)/i;
// Señas de un aviso de Copec Pay, para cuando el texto llega sin su encabezado
var RE_COPEC = /copec\s*pay|cuenta\s+vista|n[°º]\s*(?:de\s+)?transacci/i;
// Palabras de un movimiento que saca dinero de la cuenta
var RE_CARGO = new RegExp('(?:^|[^' + LETTER + '])(?:compra|cargo|carg[oó]|pago|pag[oó]|pagaste|pagamos|cobr|transacci|suscripci|d[ée]bit|descont|recarga|carga|giro|retir|transfer|consumo|movimiento|operaci[oó]n)', 'i');
// Un cargo que no se hizo: no descuenta
var RE_NO = /rechazad|declinad|denegad|fallid|no\s+(?:fue\s+|ha\s+sido\s+|pudo\s+ser\s+|se\s+pudo\s+|se\s+ha\s+podido\s+|pudimos\s+|hemos\s+podido\s+)?(?:aprobad|realizad|realizar|procesad|procesar|autorizad|complet|efectu)|saldo\s+insuficiente|sin\s+saldo|fondos\s+insuficientes/i;
// Dinero que entra: los abonos se anotan a mano, así que estos avisos no se registran solos
var RE_IN = new RegExp('(?:^|[^' + LETTER + '])(?:abono|abonamos|abonad[oa]|abonaron|abonaste|dep[oó]sit|recibiste|has\\s+recibido|te\\s+transfiri|transferencia\\s+recibida|devoluci[oó]n|devolvimos|reembols|revers[oa]|anulaci[oó]n|anulad[oa]|cargaste\\s+(?:saldo|dinero)|carga\\s+de\\s+(?:saldo|dinero))', 'i');
var MONEY_SRC = '(US\\$|USD|U\\$S|CLP|\\$)\\s{0,2}(\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?(?!\\d)|(\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?\\s{0,2}(pesos|CLP|USD|d[oó]lares)(?![' + LETTER + '])';
// Montos que no son el del cargo: el saldo que quedó, un tope, una promoción
var RE_AUX = /(?:saldo|disponible|cupo|l[ií]mite|tope|m[ií]nim[oa]|m[aá]xim[oa]|descuento|dcto|ahorr[a-z]*|gana[a-z]*|premio|hasta|desde|comisi[oó]n)[^$]{0,24}$/i;
var MONTHS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
var LABELS = ['nombre\\s+(?:del?\\s+)?comercio', 'comercio', 'establecimiento', 'tienda', 'destinatario', 'beneficiario', 'glosa', 'descripci[oó]n', 'detalle', 'concepto', 'servicio', 'empresa', 'local', 'lugar', 'motivo'];
var STRONG = 6;   // los seis primeros rótulos se aceptan también sin dos puntos («Comercio NETFLIX»)
// Dónde termina un nombre dentro de una lista de datos: en el rótulo siguiente, un monto o una fecha. Los rótulos se
// reconocen en minúsculas o con mayúscula inicial («Fecha»), no en mayúsculas completas: así «BANCO ESTADO» queda entero.
var RE_STOP = new RegExp('\\s+(?:' + ['monto', 'total', 'valor', 'importe', 'fecha', 'hora', 'tarjeta', 'nro\\.?', 'n[uú]mero', 'c[oó]digo', 'operaci[oó]n',
  'autorizaci[oó]n', 'cuotas?', 'tipo', 'medio', 'saldo', 'estado', 'rut', 'cuenta', 'comercio', 'detalle'].map(function (w) {
  return '[' + w.charAt(0) + w.charAt(0).toUpperCase() + ']' + w.slice(1);
}).join('|') + '|[Nn][°º])(?![' + LETTER + 'A-ZÁÉÍÓÚÜÑ])|\\s*(?:US\\$|\\$)\\s?\\d|\\s+\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{2,4}|\\s+[|·•]\\s+');
// Dónde termina el nombre de un comercio dentro de una oración. Las palabras van en minúsculas a propósito:
// los comercios suelen venir en mayúsculas («PIZZA CON TODO») y así no se cortan.
var NAME_END = '(?=\\s+(?:el|con|por|a\\s+las|fecha|de\\s+fecha|del\\s+d[ií]a|mediante|desde|usando|fue|ha|han|se|est[aá]|qued[oó]|ya|que|realizad[oa]|aprobad[oa]|exitos[oa])\\s|\\s*[.;,](?:\\s|$)|\\s*$|\\s+(?:US\\$|\\$)\\s?\\d|\\s+\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{2,4})';
// «en tu cuenta», «en la app», «en cuotas»: no son un comercio. Los nombres en mayúsculas («LA FETE») sí pasan.
var RE_NOT_NAME = /^(?:tu|tus|su|sus|la|las|el|los|mi|un|una|nuestr[a-z]*|l[ií]nea|cuotas?|pesos|d[oó]lares|caso|www|http|efectivo|total|forma|cualquier|est[ea]s?|breve|unos|minutos|adelante|cuanto|relaci[oó]n)(?:\s|$)/;

function findAmount(flat) {
  var re = new RegExp(MONEY_SRC, 'gi'), m, main = [], aux = [];
  while ((m = re.exec(flat))) {
    var cur = (m[1] || m[4] || '$').toUpperCase();
    var amount = parseInt((m[2] || m[3]).replace(/[.,]/g, ''), 10);
    if (!(amount > 0) || amount > MAX_AMOUNT) continue;
    var pre = flat.slice(Math.max(0, m.index - 40), m.index);
    var hit = { amount: amount, idx: m.index, end: re.lastIndex, foreign: /US|U\$S|D[OÓ]L/.test(cur), total: /(?:^|[^a-z])total[^$]{0,18}$/i.test(pre) };
    (RE_AUX.test(pre) ? aux : main).push(hit);
  }
  for (var i = 0; i < main.length; i++) if (main[i].total) return main[i];
  return main[0] || (RE_CARGO.test(flat) ? aux[0] : null) || null;
}

// Fecha y hora del cargo. «ref» es el momento en que llegó el aviso: ninguna fecha puede ser posterior.
// «from» es dónde está el monto: manda la primera fecha que viene después de él. Un correo reenviado trae antes su
// propia «Fecha:» de envío, que no es la del cargo.
function findWhen(flat, ref, from) {
  var base = new Date(ref || Date.now()), lim = dayKey(new Date(base.getTime() + 36 * 3600 * 1000));
  var dates = [], times = [], m, re;
  function add(y, mo, d, idx, end) {
    var k = y + '-' + pad(mo) + '-' + pad(d);
    if (validDate(k) && k <= lim && y >= 2000) dates.push({ date: k, idx: idx, end: end });
  }
  re = /(^|[^\d\/.\-])(\d{1,2})([\/.\-])(\d{1,2})\3(\d{4}|\d{2})(?![\d\/\-])/g;
  while ((m = re.exec(flat))) {
    var d = +m[2], mo = +m[4], y = +m[5];
    if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) { var sw = d; d = mo; mo = sw; }
    add(y, mo, d, m.index + m[1].length, re.lastIndex);
  }
  re = /(^|\D)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
  while ((m = re.exec(flat))) add(+m[2], +m[3], +m[4], m.index + m[1].length, re.lastIndex);
  re = new RegExp('(^|\\D)(\\d{1,2})\\s*(?:de\\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic)\\.?(?![' + LETTER + '])(?:\\s*,?\\s*(?:de\\s+|del\\s+)?(\\d{4})(?!\\d))?', 'gi');
  while ((m = re.exec(flat))) {
    var mon = MONTHS[m[3].toLowerCase().slice(0, 3)], yr = m[4] ? +m[4] : base.getFullYear();
    if (!m[4] && yr + '-' + pad(mon) + '-' + pad(+m[2]) > lim) yr--;   // sin año: el más reciente que no sea futuro
    add(yr, mon, +m[2], m.index + m[1].length, re.lastIndex);
  }
  dates.sort(function (a, b) { return a.idx - b.idx; });
  re = /(^|[^\d:])(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z]))?(?![\d:])/gi;
  while ((m = re.exec(flat))) {
    var h = +m[2], mi = +m[3], ap = (m[4] || '').toLowerCase().charAt(0);
    if (ap === 'p' && h < 12) h += 12;
    if (ap === 'a' && h === 12) h = 0;
    if (h < 24 && mi < 60) times.push({ time: pad(h) + ':' + pad(mi), idx: m.index + m[1].length, end: re.lastIndex });
  }
  var date = null, time = null, i;
  for (i = 0; i < dates.length && !date; i++) if (dates[i].idx >= (from || 0)) date = dates[i];
  if (!date) date = dates[0] || null;
  if (date) {
    for (i = 0; i < times.length && !time; i++) if (times[i].idx >= date.end && times[i].idx - date.end <= 30) time = times[i];
    for (i = 0; i < times.length && !time; i++) if (times[i].end <= date.idx && date.idx - times[i].end <= 16) time = times[i];
  }
  for (i = 0; i < times.length && !time; i++) if (/(?:hora|a\s+las?)\W{0,4}$/i.test(flat.slice(Math.max(0, times[i].idx - 16), times[i].idx))) time = times[i];
  return { date: date ? date.date : '', time: time ? time.time : '' };
}

function tidyName(v) {
  v = String(v == null ? '' : v).split(RE_STOP)[0];
  return clean(v.replace(/^[\s:"'«»“”*\-–—]+|[\s:"'«»“”*.,;\-–—]+$/g, ''));
}
function okName(v) { return v.length >= 2 && /[a-z0-9]/i.test(v) && !/^[\s$\d.,:\/\-]+$/.test(v); }
function findMerchant(lines, flat, from) {
  var m, v, i, j, re;
  // 1. «Comercio: NOMBRE», en cualquier parte del texto
  for (j = 0; j < LABELS.length; j++) {
    m = new RegExp('(?:^|[^' + LETTER + '])(?:' + LABELS[j] + ')\\s*:\\s*(.{2,90})', 'i').exec(flat);
    if (m && okName(v = tidyName(m[1]))) return v;
  }
  // 2. El rótulo solo en su línea y el nombre en la siguiente, o «Comercio NOMBRE» sin dos puntos
  for (j = 0; j < LABELS.length; j++) {
    re = new RegExp('^(?:' + LABELS[j] + ')(?![' + LETTER + '])\\s*[:\\-–]?\\s*(.*)$', 'i');
    for (i = 0; i < lines.length; i++) {
      m = re.exec(lines[i]);
      if (!m) continue;
      if (!m[1]) v = tidyName(lines[i + 1]);
      else if (j < STRONG && !/^del?\s/i.test(m[1])) v = tidyName(m[1]);
      else continue;
      if (okName(v)) return v;
    }
  }
  // 3. «Comercio NOMBRE» en medio de una línea, sin dos puntos. El nombre debe partir con mayúscula o número, y el
  //    rótulo no puede ir todo en mayúsculas: ahí es parte del nombre de un comercio («COMERCIO UNO»).
  for (j = 0; j < STRONG; j++) {
    m = new RegExp('(?:^|[^' + LETTER + '])(' + LABELS[j] + ')\\s+(.{2,90})', 'i').exec(flat);
    if (m && m[1] !== m[1].toUpperCase() && /^[A-ZÁÉÍÓÚÑ0-9]/.test(m[2]) && okName(v = tidyName(m[2]))) return v;
  }
  // 4. «… en NOMBRE el 10/10/2026»: primero lo que sigue al monto, después el texto completo
  var parts = [flat.slice(from), flat];
  for (j = 0; j < parts.length; j++) {
    re = new RegExp('(?:^|\\s)[Ee][Nn]\\s+(?:el\\s+comercio\\s+|el\\s+local\\s+|la\\s+tienda\\s+|comercio\\s+)?(.{2,60}?)' + NAME_END, 'g');
    while ((m = re.exec(parts[j]))) {
      if (RE_NOT_NAME.test(m[1])) { re.lastIndex = m.index + 3; continue; }
      if (okName(v = tidyName(m[1]))) return v;
    }
  }
  // 5. «Pagaste $5.990 a NETFLIX»
  m = new RegExp('^\\s*(?:a|para|de)\\s+([A-Z0-9].{1,50}?)' + NAME_END).exec(flat.slice(from));
  if (m && okName(v = tidyName(m[1]))) return v;
  return '';
}
var RE_OP = new RegExp('(?:^|[^' + LETTER + '])(?:n[°ºo]\\.?|nro\\.?|n[uú]mero|c[oó]digo|id|folio)\\s*(?:de\\s+)?(?:la\\s+)?(?:operaci[oó]n|transacci[oó]n|autorizaci[oó]n|comprobante|orden|referencia|movimiento)\\s*[:#\\-]?\\s*([A-Za-z0-9][A-Za-z0-9\\-]{3,23})', 'i');
function findOp(flat) {
  var m = RE_OP.exec(flat);
  return m && /\d/.test(m[1]) ? m[1].toUpperCase() : '';
}
// ¿El texto afirma esto? No cuenta si viene en una frase condicional («si la compra no fue realizada por ti…»).
function says(re, text) {
  var g = new RegExp(re.source, 'gi'), m;
  while ((m = g.exec(text))) {
    var clause = text.slice(0, m.index + 1).split(/[.!?:]\s+/).pop();
    if (!new RegExp('(?:^|[^' + LETTER + '])(?:si|en\\s+caso)\\s', 'i').test(clause)) return true;
    if (g.lastIndex === m.index) g.lastIndex++;
  }
  return false;
}

// Lee un aviso. «kind»: 'c' cargo, 'd' aviso de abono o devolución, 'x' cargo rechazado, 'f' cargo en dólares,
// 'o' correo que no es de bip! (lo decide parseMail) y '' un correo que no se reconoce como aviso.
function readNotice(text, ref) {
  var lines = text.split(/[\r\n\t]+/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  var flat = lines.join(' ');
  var out = { kind: '', amount: 0, merchant: '', date: '', time: '', op: '', bip: RE_BIP.test(flat), text: flat.slice(0, 300),
    subj: findSubject(lines), head: '', copec: RE_COPEC.test(flat) };
  var hm = RE_HEAD.exec(flat);
  if (hm) out.head = clean(hm[1]);
  var pay = flat ? findAmount(flat) : null;
  if (!pay) return out;
  var when = findWhen(flat, ref, pay.idx);
  out.amount = pay.amount;
  out.date = when.date; out.time = when.time;
  out.merchant = findMerchant(lines, flat, pay.end);
  out.op = findOp(flat);
  // El asunto y el encabezado del aviso van antes del monto: ahí, o en el nombre del comercio, tiene que decir «bip».
  // Una mención de bip! más abajo (en la letra chica de otro correo) no cuenta.
  out.bip = RE_BIP.test(flat.slice(0, pay.idx) + ' ' + out.merchant);
  // El rechazo o el abono se anuncian junto al monto, no en la letra chica del final del correo
  out.kind = says(RE_NO, flat.slice(0, pay.end + 120)) ? 'x' : says(RE_IN, flat.slice(0, pay.end + 60)) ? 'd' : !RE_CARGO.test(flat) ? '' : pay.foreign ? 'f' : 'c';
  return out;
}
// El asunto, cuando viene en el texto: la app y los widgets anteponen «Asunto: …» si el atajo envía el asunto como
// título, y un correo reenviado lo trae en su encabezado.
function findSubject(lines) {
  for (var i = 0; i < lines.length && i < 40; i++) {
    var m = /^(?:asunto|subject)\s*:\s*(.+)$/i.exec(lines[i]);
    if (m) return clean(m[1]);
  }
  return '';
}
function parseAny(raw, ref) {
  // Primero el texto tal como llegó. Si trae líneas cortadas con «=», primero su versión decodificada,
  // para no leer un comercio o una hora partidos por la mitad.
  var texts = [String(raw == null ? '' : raw)], alt = unwrapMail(raw), first = null;
  texts = /=\r?\n/.test(texts[0]) ? alt.concat(texts) : texts.concat(alt);
  for (var i = 0; i < texts.length; i++) {
    var p = readNotice(plainText(texts[i]), ref);
    if (p.kind) return p;
    if (!first || (p.bip && !first.bip)) first = p;
  }
  return first;
}
// Solo cuentan los correos de bip!. Se descarta un correo solo cuando hay una señal de que es de otra cosa:
//  1. Si se conoce el asunto, manda el asunto: tiene que decir «bip».
//  2. Si no, manda el encabezado del aviso («Tu compra en … se realizó con éxito»): tiene que ser una compra en bip!.
//  3. Si el texto no trae ni asunto ni encabezado (por ejemplo, porque se copió desde la mitad), se acepta un cargo
//     que diga «bip» antes del monto o que sea un aviso de Copec Pay. El atajo ya deja pasar solo los correos con
//     «bip» en el asunto.
function parseMail(raw, ref) {
  var p = parseAny(raw, ref), ok;
  if (p.subj) { ok = RE_BIP.test(p.subj); p.why = ok ? '' : 'subj'; }
  else if (p.head) { ok = RE_BIP.test(p.head); p.why = ok ? '' : 'head'; }
  else { ok = p.bip || (p.kind === 'c' && p.copec); p.why = ok ? '' : 'none'; }
  if (!ok) p.kind = 'o';
  return p;
}
// Deja el cargo listo para guardarlo. «at» es el momento en que el aviso llegó al buzón (0 si se pegó a mano)
// y «num», su número dentro del buzón.
//  · Con fecha y hora en el aviso: se usan tal cual. Es el momento real del cargo, aunque el correo llegue horas después.
//  · Con fecha y sin hora: si el aviso llegó ese mismo día, el cargo fue en la madrugada (00:00); si llegó al día
//    siguiente, fue en la noche anterior (23:59).
//  · Con hora y sin fecha: el día es el de llegada, o el anterior si esa hora todavía no había pasado.
//  · Sin fecha ni hora: se usa el momento de llegada.
function settle(p, at, num) {
  var ref = new Date(at || Date.now()), date = p.date, time = p.time, nt = 0, est = 0;
  if (!date) {
    date = dayKey(ref);
    if (time) { est = 1; if (time > hm(ref)) date = dayKey(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1)); }
    else { est = 2; time = hm(ref); }
  } else if (!time) {
    nt = 1; time = at && dayKey(ref) > date ? '23:59' : '00:00';
  }
  var name = p.merchant || 'Carga bip!', exact = !!(p.op || (p.date && p.time));
  var key = p.op ? 'OP' + p.op + '|' + p.amount
    : exact ? date + 'T' + time + '|' + p.amount + '|' + name.toUpperCase()
    : num ? 'I' + num + '|' + p.amount
    : date + '|' + p.amount + '|' + name.toUpperCase() + '|P';
  return { date: date, time: time, amount: p.amount, merchant: name, key: key, exact: exact, nt: nt, est: est, rcv: at || 0, raw: p.text };
}
// La clave de un cargo, sin signos ni acentos en el comercio: así un mismo aviso se reconoce aunque el correo
// haya llegado una vez con el texto dañado y otra vez bien.
function skel(key) {
  var p = String(key).split('|');
  return p[0] + '|' + (p[1] || '') + '|' + p.slice(2).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
/* LECTOR:FIN */

// ¿El cargo es posterior al saldo de partida? Lo anterior ya está incluido en ese saldo (la misma regla de la app).
function counts(f, at) {
  if (!at) return false;
  if (f.nt) {
    const day = at.slice(0, 10);
    if (f.date !== day) return f.date > day;
    return f.rcv ? f.rcv >= atMs(at) + 60000 : true;
  }
  return f.date + 'T' + f.time >= at;
}

/* ---------- Datos ---------- */
async function gh(path) {
  const r = new Request(API + path);
  r.headers = { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json' };
  r.timeoutInterval = 20;
  const data = await r.loadJSON();
  const code = r.response && r.response.statusCode;
  if (code && code >= 400) { const e = new Error('GitHub ' + code); e.status = code; throw e; }
  return data;
}
function cachePath() { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), 'copec-widget.json'); }
function readCache() {
  try { const fm = FileManager.local(), p = cachePath(); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; }
}
function writeCache(res) { try { FileManager.local().writeString(cachePath(), JSON.stringify(res)); } catch (e) {} }

// Saldo publicado por la app + cargos de bip! que llegaron al buzón después de la última vez que la app lo leyó
async function load() {
  const list = await gh('/milestones?state=all&per_page=100');
  const ms = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.title === MS_TITLE; })[0];
  let st = null;
  try { st = ms && ms.description ? JSON.parse(ms.description) : null; } catch (e) { st = null; }
  if (!st || st.app !== 'copec') return { msg: 'Abre la app Copec y activa el widget en «Buzón y atajo».' };

  const known = {};
  (st.keys || []).forEach(function (k) { known[k] = 1; });
  const since = st.read > 0 ? '&since=' + encodeURIComponent(new Date(st.read - 30 * 60000).toISOString().replace(/\.\d+Z$/, 'Z')) : '';
  const nuevas = [];
  for (let page = 1; page <= 3; page++) {
    const issues = await gh('/issues?state=all&sort=created&direction=asc&per_page=100&page=' + page + since);
    if (!Array.isArray(issues)) break;
    issues.forEach(function (it) {
      if (!it || it.pull_request) return;
      // «Copec» a secas es la etiqueta fija del atajo; cualquier otro título es el asunto del correo (y manda: tiene que decir «bip»)
      const title = String(it.title || '').trim();
      const text = (title && !/^(?:copec|aviso)$/i.test(title) ? 'Asunto: ' + title + '\n' : '') + String(it.body || '');
      const at = Date.parse(it.created_at) || 0;
      const p = parseMail(text, at);                 // solo los correos de bip!
      if (p.kind !== 'c') return;
      const f = settle(p, at, +it.number || 0), sk = skel(f.key);
      if (known[sk]) return;
      known[sk] = 1;
      if (st.at && !counts(f, st.at)) return;         // anterior al saldo de partida: ya está incluido en él
      nuevas.push(f);
    });
    if (issues.length < 100) break;
  }
  let saldo = typeof st.saldo === 'number' ? st.saldo : null;
  if (saldo !== null) nuevas.forEach(function (f) { saldo -= f.amount; });
  const buys = (st.ult || []).concat(nuevas.map(function (f) { return { d: f.date, h: f.time, c: f.merchant, m: f.amount, nt: f.nt }; }))
    .filter(function (b) { return b && b.d && b.m > 0; })
    .sort(function (a, b) { return (a.d + 'T' + a.h) < (b.d + 'T' + b.h) ? 1 : -1; }).slice(0, 3)
    .map(function (b) { return { d: b.d, h: b.h, c: String(b.c || 'Carga bip!'), m: b.m, nt: b.nt ? 1 : 0 }; });
  return { saldo: saldo, buys: buys, nuevas: nuevas.length, at: Date.now() };
}

/* ---------- Dibujo ---------- */
const WHITE = new Color('#ffffff'), LIME = new Color('#00ff7e');
function label(stack, str, size, color, opacity, bold) {
  const t = stack.addText(str);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color || WHITE;
  if (opacity) t.textOpacity = opacity;
  t.lineLimit = 1;
  return t;
}
function when(b) { return dayLabel(b.d) + (b.nt ? '' : ' ' + b.h); }
function build(res, family) {
  const w = new ListWidget();
  const lock = String(family || '').indexOf('accessory') === 0;
  const small = family === 'small';
  if (lock) {
    // Pantalla bloqueada: saldo y último cargo
    label(w, 'Copec ' + (res.msg ? '' : res.saldo === null ? 'sin saldo' : money(res.saldo)), 14, null, 0, true).minimumScaleFactor = 0.6;
    if (res.msg) label(w, res.msg, 11).lineLimit = 2;
    else if (res.buys.length) label(w, 'bip! ' + when(res.buys[0]) + ' ' + money(-res.buys[0].m), 11).minimumScaleFactor = 0.7;
    return w;
  }
  const g = new LinearGradient();
  g.colors = [new Color('#1f4dff'), new Color('#002df9'), new Color('#001a9c')];
  g.locations = [0, 0.45, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(small ? 12 : 14, small ? 12 : 16, small ? 10 : 12, small ? 12 : 16);

  const head = w.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  label(head, 'SALDO COPEC', small ? 9 : 10, LIME, 0, true);
  head.addSpacer();
  if (res.at) label(head, (res.old ? 'sin conexión · ' : '') + hm(new Date(res.at)), 9, WHITE, 0.6);
  w.addSpacer(2);

  if (res.msg) {
    const t = label(w, res.msg, small ? 12 : 14, WHITE, 0.9);
    t.lineLimit = 4;
    w.addSpacer();
    return w;
  }
  const total = label(w, res.saldo === null ? 'Sin saldo inicial' : money(res.saldo), small ? 22 : 28, WHITE, 0, true);
  total.minimumScaleFactor = 0.5;
  w.addSpacer(small ? 4 : 8);

  if (!res.buys.length) label(w, 'Aún no hay cargos de bip!', 12, WHITE, 0.7);
  res.buys.forEach(function (b, i) {
    if (i) w.addSpacer(small ? 2 : 4);
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    if (small) label(row, when(b), 10, WHITE, 0.75);
    else {
      const col = row.addStack();                    // columna de la fecha, de ancho fijo para que los nombres queden alineados
      col.layoutHorizontally();
      col.size = new Size(66, 0);
      label(col, when(b), 10, WHITE, 0.6);
      col.addSpacer();
      label(row, b.c, 12, WHITE, 0.95);
    }
    row.addSpacer();
    label(row, money(-b.m), small ? 10 : 12, WHITE, 0, true);
  });
  w.addSpacer();
  return w;
}

/* ---------- Ejecución ---------- */
let res;
if (/^__/.test(TOKEN) || /^__/.test(REPO)) {
  res = { msg: 'Copia este script desde la app Copec, con el botón «Copiar el script del widget».' };
} else {
  try {
    res = await load();
    if (!res.msg) writeCache(res);
  } catch (e) {
    const c = readCache();
    if (c && !c.msg) { res = c; res.old = true; }
    else res = { msg: e && e.status === 401 ? 'El token venció. Copia de nuevo el script desde la app Copec.' : 'No se pudo leer el buzón. Revisa la conexión.' };
  }
}
const widget = build(res, config.widgetFamily);
widget.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
