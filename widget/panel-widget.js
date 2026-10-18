// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: wallet;

// Cuentas · panel para la pantalla de inicio del iPhone (app Scriptable)
//
// Un widget grande con las cuatro cuentas: Copec, FAN, Master y LiderBCI. De cada una muestra el total y los tres
// últimos movimientos, con la paleta de Copec:
//   · Copec y FAN: el saldo disponible de la cuenta.
//   · Master: la deuda a pagar este mes (sin las cuotas que vencen después).
//   · LiderBCI: el total del periodo de facturación (la app no lleva cupo ni saldo).
//
// Este script no lleva tokens. Toma el buzón y el token de los scripts de los widgets de cada app que ya están en
// Scriptable, así que esos cuatro scripts deben seguir ahí, aunque no estén en la pantalla de inicio. Cada cuenta se
// calcula con la misma lógica de su widget: lo que publicó la app más los avisos que llegaron al buzón después.
//
// La app Copec entrega este script con el botón «Copiar el script del panel». Si cambia el lector de Copec, se vuelve a
// armar con  python3 widget/armar-widget.py. Los lectores de FAN y Master están copiados de sus widgets: si alguno
// cambia, hay que copiarlo aquí también.

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ORDER = ['copec', 'fan', 'master', 'liderbci'];
const APPS = {
  copec: { name: 'Copec', title: 'Copec · widget' },
  fan: { name: 'FAN', title: 'FAN · widget' },
  master: { name: 'Master', title: 'Master · widget' },
  liderbci: { name: 'LiderBCI', title: 'LiderBCI · widget' }
};
const KEYCHAIN = 'cuentas-panel';

/* ---------- Formatos (los mismos de los cuatro widgets) ---------- */
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

/* ---------- GitHub ---------- */
// Una misma consulta se hace una sola vez: FAN, Master y LiderBCI comparten el buzón y leen los mismos hitos.
const asked = {};
function ghFor(c) {
  return function (path) {
    const url = 'https://api.github.com/repos/' + c.repo + path, id = c.token + ' ' + url;
    if (!asked[id]) asked[id] = getJSON(url, c.token);
    return asked[id];
  };
}
async function getJSON(url, token) {
  const r = new Request(url);
  r.headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  r.timeoutInterval = 20;
  const data = await r.loadJSON();
  const code = r.response && r.response.statusCode;
  if (code && code >= 400) { const e = new Error('GitHub ' + code); e.status = code; throw e; }
  return data;
}
// Lo que la app publicó para su widget, en el hito con su nombre
async function published(gh, title, app) {
  const list = await gh('/milestones?state=all&per_page=100');
  const ms = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.title === title; })[0];
  let st = null;
  try { st = ms && ms.description ? JSON.parse(ms.description) : null; } catch (e) { st = null; }
  return st && st.app === app ? st : null;
}
function sinceParam(read) {
  return '&since=' + encodeURIComponent(new Date(read - 30 * 60000).toISOString().replace(/\.\d+Z$/, 'Z'));
}

/* ======================================================================================================== */
/* Copec: saldo de la cuenta Copec Pay y últimos cargos de bip! (igual que widget/copec-widget.js)          */
/* ======================================================================================================== */
const COPEC = (function () {
const MAX_AMOUNT = 9999999999;
function atMs(at) { return new Date(+at.slice(0, 4), +at.slice(5, 7) - 1, +at.slice(8, 10), +at.slice(11, 13), +at.slice(14, 16)).getTime(); }

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

function counts(f, at) {
  if (!at) return false;
  if (f.nt) {
    const day = at.slice(0, 10);
    if (f.date !== day) return f.date > day;
    return f.rcv ? f.rcv >= atMs(at) + 60000 : true;
  }
  return f.date + 'T' + f.time >= at;
}
async function load(gh) {
  const st = await published(gh, APPS.copec.title, 'copec');
  if (!st) return { msg: 'Activa el widget en Copec, en «Buzón y atajo».' };
  const known = {};
  (st.keys || []).forEach(function (k) { known[k] = 1; });
  const since = st.read > 0 ? sinceParam(st.read) : '';
  const nuevas = [];
  for (let page = 1; page <= 3; page++) {
    const issues = await gh('/issues?state=all&sort=created&direction=asc&per_page=100&page=' + page + since);
    if (!Array.isArray(issues)) break;
    issues.forEach(function (it) {
      if (!it || it.pull_request) return;
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
    .map(function (b) { return { d: b.d, h: b.nt ? '' : b.h, c: String(b.c || 'Carga bip!'), m: -b.m }; });
  return { total: saldo, empty: 'Sin saldo inicial', buys: buys };
}
return { load: load };
})();

/* ======================================================================================================== */
/* FAN: saldo de la cuenta y últimas compras con cargo a la cuenta (igual que el widget de FAN)            */
/* ======================================================================================================== */
const FAN = (function () {
const CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
function contByte(ch) { let c = ch.charCodeAt(0); if (c > 0xff) c = CP1252[c] || 0; return c >= 0x80 && c <= 0xbf ? c : -1; }
function demojibake(s) {
  if (!/[ÂÃâ]/.test(s)) return s;
  return s.replace(/[ÂÃ][^\u0000-\u007f]|â[^\u0000-\u007f]{2}/g, function (seq) {
    const b1 = contByte(seq.charAt(1)), b2 = seq.length > 2 ? contByte(seq.charAt(2)) : 0;
    if (b1 < 0 || b2 < 0) return seq;
    return String.fromCharCode(seq.length > 2 ? (0x2 << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f) : ((seq.charCodeAt(0) & 0x1f) << 6) | (b1 & 0x3f));
  });
}
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", dollar: '$', eacute: 'é', Eacute: 'É', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ' };
function plainText(s) {
  s = String(s == null ? '' : s);
  if (s.length > 400000) s = s.slice(-400000);
  s = demojibake(s);
  if (s.normalize) s = s.normalize('NFC');
  if (/<[a-z!\/][^>]*>/i.test(s)) s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (all, e) {
    if (e.charAt(0) === '#') {
      const c = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return c > 0 && c < 0x10000 ? String.fromCharCode(c) : ' ';
    }
    return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : all;
  });
  return s.replace(/[\s\xa0​-‍﻿]+/g, ' ');
}
function skel(key) {
  const p = String(key).split('|');
  return p[0] + '|' + (p[1] || '') + '|' + p.slice(2).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
// Devuelve las compras con cargo a la cuenta que trae un texto. Deja fuera las de tarjeta de crédito y en dólares.
function parseMail(raw) {
  const text = plainText(raw);
  const re = /compra\W{1,4}por\W{1,4}?(US\$|USD|\$)?\W{0,3}?([\d.]+(?:,\d{1,2})?)\W{1,4}con\W{1,4}(?:cargo\W{1,4}a\W{1,4})?(.{1,60}?)\s+en\s+(.{1,80}?)\s+el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\W{1,4}(\d{1,2}):(\d{2})/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const cur = (m[1] || '$').toUpperCase(), medio = m[3], merchant = clean(m[4]);
    const amount = parseInt(m[2].replace(/\./g, '').replace(/,.*$/, ''), 10);
    const date = m[7] + '-' + pad(+m[6]) + '-' + pad(+m[5]), time = pad(+m[8]) + ':' + m[9];
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !merchant || !(amount > 0)) continue;
    if (cur !== '$' || /cr.{0,12}dito/i.test(medio)) continue;
    out.push({ d: date, h: time, c: merchant, m: amount, acct: (/(\d{4})\W*$/.exec(medio) || [])[1] || '',
      key: date + 'T' + time + '|' + amount + '|' + merchant.toUpperCase() });
  }
  return out;
}
async function load(gh) {
  const st = await published(gh, APPS.fan.title, 'fan');
  if (!st) return { msg: 'Activa el widget en FAN, en «Buzón y atajo».' };
  const known = {};
  (st.keys || []).forEach(function (k) { known[k] = 1; });
  const acct = /^\d{4}$/.test(String(st.acct || '')) ? String(st.acct) : '';
  const since = st.read > 0 ? sinceParam(st.read) : '';
  const nuevas = [];
  for (let page = 1; page <= 3; page++) {
    const issues = await gh('/issues?state=all&sort=created&direction=asc&per_page=100&page=' + page + since);
    if (!Array.isArray(issues)) break;
    issues.forEach(function (it) {
      if (!it || it.pull_request) return;
      const title = String(it.title || '');
      parseMail((title.length > 20 ? title + '\n' : '') + String(it.body || '')).forEach(function (f) {
        const sk = skel(f.key);
        if (known[sk]) return;
        known[sk] = 1;
        if (acct && f.acct && f.acct !== acct) return;            // FAN sigue una sola cuenta
        if (st.at && f.d + 'T' + f.h < st.at) return;             // anterior al último ajuste de saldo
        nuevas.push(f);
      });
    });
    if (issues.length < 100) break;
  }
  let saldo = typeof st.saldo === 'number' ? st.saldo : null;
  if (saldo !== null) nuevas.forEach(function (f) { saldo -= f.m; });
  const buys = (st.ult || []).concat(nuevas).filter(function (b) { return b && b.d && b.m > 0; })
    .sort(function (a, b) { return (a.d + 'T' + a.h) < (b.d + 'T' + b.h) ? 1 : -1; }).slice(0, 3)
    .map(function (b) { return { d: b.d, h: b.h, c: String(b.c || 'Compra'), m: -b.m }; });
  return { total: saldo, empty: 'Sin definir', buys: buys };
}
return { load: load };
})();

/* ======================================================================================================== */
/* Master: total a pagar de este mes y últimas compras con la tarjeta (igual que el widget de Master)       */
/* ======================================================================================================== */
const MASTER = (function () {
function thisMonth() { return dayKey(new Date()).slice(0, 7); }
function addMonths(k, d) { const t = +k.slice(0, 4) * 12 + (+k.slice(5, 7) - 1) + d; return Math.floor(t / 12) + '-' + pad(t % 12 + 1); }
function monthsFrom(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
const CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
function contByte(ch) { let c = ch.charCodeAt(0); if (c > 0xff) c = CP1252[c] || 0; return c >= 0x80 && c <= 0xbf ? c : -1; }
function demojibake(s) {
  if (!/[ÂÃâ]/.test(s)) return s;
  return s.replace(/[ÂÃ][^\x00-\x7f]|â[^\x00-\x7f]{2}/g, function (seq) {
    const b1 = contByte(seq.charAt(1)), b2 = seq.length > 2 ? contByte(seq.charAt(2)) : 0;
    if (b1 < 0 || b2 < 0) return seq;
    return String.fromCharCode(seq.length > 2 ? (0x2 << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f) : ((seq.charCodeAt(0) & 0x1f) << 6) | (b1 & 0x3f));
  });
}
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", dollar: '$', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º',
  deg: '°', middot: '·', laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®' };
function plainText(s) {
  s = String(s == null ? '' : s);
  if (s.length > 400000) s = s.slice(-400000);
  s = demojibake(s);
  if (s.normalize) s = s.normalize('NFC');
  if (/<[a-z!\/][^>]*>/i.test(s)) s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (all, e) {
    if (e.charAt(0) === '#') {
      const c = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return c > 0 && c < 0x10000 ? String.fromCharCode(c) : ' ';
    }
    return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : all;
  });
  return s.replace(/[\s\xa0​-‍﻿]+/g, ' ');
}
function skel(key) {
  const p = String(key).split('|');
  return p[0] + '|' + (p[1] || '') + '|' + p.slice(2).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
// Devuelve las compras con la tarjeta que trae un texto. Manda la terminación de la tarjeta; quedan fuera las
// compras con cargo a la cuenta (las registra FAN), las que son en dólares y las de otra tarjeta.
function parseMail(raw, cards) {
  const text = plainText(raw);
  const re = /compra(?:\W{1,4}en\W{1,4}(?:(\d{1,2})\W{1,4})?cuotas?)?\W{1,4}por\W{1,4}?(US\$|USD|\$)?\W{0,3}?([\d.]+(?:,\d{1,2})?)(?:\W{1,4}en\W{1,4}(\d{1,2})\W{1,4}cuotas?)?\W{1,4}con\W{1,4}(?:cargo\W{1,4}a\W{1,4})?(.{1,60}?)\s+en\s+(.{1,80}?)\s+el\s+(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\W{1,4}a\W{1,4}las)?\W{1,4}(\d{1,2}):(\d{2})/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const cur = (m[2] || '$').toUpperCase(), medio = clean(m[5]), merchant = clean(m[6]);
    const amount = parseInt(m[3].replace(/\./g, '').replace(/,.*$/, ''), 10);
    const date = m[9] + '-' + pad(+m[8]) + '-' + pad(+m[7]), time = pad(+m[10]) + ':' + m[11];
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !merchant || !(amount > 0)) continue;
    const card = (/(\d{4})\D{0,2}$/.exec(medio) || [])[1] || '';
    if ((/cuenta/i.test(medio) && !/tarjeta/i.test(medio)) || cur !== '$' || !cards[card]) continue;
    const n = +(m[1] || m[4] || 1);
    out.push({ d: date, h: time, c: merchant, m: amount, w: cards[card], n: n >= 1 && n <= 60 ? n : 1,
      key: date + 'T' + time + '|' + amount + '|' + merchant.toUpperCase() + '|' + card });
  }
  return out;
}
// De una compra en cuotas { a: monto total, n: cuotas, f: mes de la cuota 1 }, lo que vence después del mes dado.
// Esas cuotas ocupan cupo, pero todavía no entran en el total a pagar.
function laterAmt(q, month) {
  const i = monthsFrom(q.f, month), paid = Math.max(0, Math.min(q.n, i)), now = i >= 0 && i < q.n ? i + 1 : 0;
  const v = Math.floor(q.a / q.n), paidAmt = paid >= q.n ? q.a : paid * v;
  const nowAmt = now ? (now === q.n ? q.a - v * (q.n - 1) : v) : 0;
  return q.a - paidAmt - nowAmt;
}
async function load(gh) {
  const st = await published(gh, APPS.master.title, 'master');
  if (!st) return { msg: 'Activa el widget en Master, en «Buzón y atajo».' };
  if (typeof st.used !== 'number') return { msg: 'Ingresa la deuda pendiente en Master.' };
  const known = {}, nuevas = [];
  (st.keys || []).forEach(function (k) { known[k] = 1; });
  const cards = st.cards && typeof st.cards === 'object' ? st.cards : {};
  if (st.read > 0) {   // sin una lectura previa de Master no hay desde dónde contar lo nuevo
    const since = sinceParam(st.read);
    for (let page = 1; page <= 3; page++) {
      const issues = await gh('/issues?state=all&sort=created&direction=asc&per_page=100&page=' + page + since);
      if (!Array.isArray(issues)) break;
      issues.forEach(function (it) {
        if (!it || it.pull_request) return;
        const title = String(it.title || '');
        parseMail((title.length > 20 ? title + '\n' : '') + String(it.body || ''), cards).forEach(function (f) {
          const sk = skel(f.key);
          if (known[sk]) return;
          known[sk] = 1;
          if (st.at && f.d + 'T' + f.h < st.at) return;           // anterior a la deuda inicial: ya está dentro de ella
          nuevas.push(f);
        });
      });
      if (issues.length < 100) break;
    }
  }
  let used = st.used;
  const cuotas = (st.cuotas || []).filter(function (q) { return q && q.a > 0 && q.n > 1 && /^\d{4}-\d{2}$/.test(String(q.f)); });
  nuevas.forEach(function (f) {
    used += f.m;
    if (f.n > 1) cuotas.push({ a: f.m, n: f.n, f: addMonths(f.d.slice(0, 7), 1) });   // la cuota 1, el mes siguiente a la compra
  });
  const month = thisMonth();
  let later = 0;
  cuotas.forEach(function (q) { later += laterAmt(q, month); });
  const buys = (st.ult || []).concat(nuevas).filter(function (b) { return b && b.d && b.m > 0; })
    .sort(function (a, b) { return (a.d + 'T' + a.h) < (b.d + 'T' + b.h) ? 1 : -1; }).slice(0, 3)
    .map(function (b) { return { d: b.d, h: b.h, c: String(b.c || 'Compra'), m: b.m, w: b.w === 'A' ? 'A' : 'T' }; });
  return { total: Math.max(0, used - later), month: month, buys: buys };
}
return { load: load };
})();

/* ======================================================================================================== */
/* LiderBCI: total del periodo y últimas compras, tal como LiderBCI los publicó (igual que su widget)       */
/* ======================================================================================================== */
const LIDERBCI = (function () {
async function load(gh) {
  const st = await published(gh, APPS.liderbci.title, 'liderbci');
  if (!st) return { msg: 'Activa el widget en LiderBCI.' };
  const buys = (Array.isArray(st.ult) ? st.ult : [])
    .filter(function (b) { return b && /^\d{4}-\d{2}-\d{2}$/.test(String(b.d)) && b.m > 0; }).slice(0, 3)
    .map(function (b) { return { d: String(b.d), h: '', c: String(b.c || 'Compra'), m: +b.m }; });
  return { total: typeof st.total === 'number' ? st.total : 0, n: +st.n > 0 ? Math.round(+st.n) : 0, buys: buys };
}
return { load: load };
})();

const LOADERS = { copec: COPEC, fan: FAN, master: MASTER, liderbci: LIDERBCI };

/* ---------- Buzón y token de cada cuenta ---------- */
// Se leen de los scripts de los widgets instalados en Scriptable. Cada script se reconoce por su contenido (la línea del
// hito, por ejemplo «FAN · widget»), no por su nombre. Lo encontrado se guarda en el llavero del iPhone, por si un
// script se borra después; si un script trae un token nuevo, se usa ese.
function fileManagers() {
  const out = [];
  try { const fm = FileManager.iCloud(); out.push({ fm: fm, dir: fm.documentsDirectory() }); } catch (e) {}
  try { const fm = FileManager.local(); out.push({ fm: fm, dir: fm.documentsDirectory() }); } catch (e) {}
  return out;
}
async function findAccounts() {
  let saved = {};
  try { if (Keychain.contains(KEYCHAIN)) saved = JSON.parse(Keychain.get(KEYCHAIN)) || {}; } catch (e) { saved = {}; }
  const byTitle = {}, found = {};
  ORDER.forEach(function (k) { byTitle[APPS[k].title] = k; });
  for (const place of fileManagers()) {
    let names = [];
    try { names = place.fm.listContents(place.dir); } catch (e) { continue; }
    for (const name of names) {
      if (!/\.js$/i.test(name)) continue;
      const path = place.fm.joinPath(place.dir, name);
      try {
        if (place.fm.isFileStoredIniCloud(path) && !place.fm.isFileDownloaded(path)) await place.fm.downloadFileFromiCloud(path);
        const src = place.fm.readString(path);
        if (!src || src.length > 400000) continue;
        const t = /^const MS_TITLE = '([^'\n]+)';[ \t]*$/m.exec(src);
        const key = t && byTitle[t[1]];
        if (!key) continue;
        const repo = (/^const REPO = '([^'\n]*)';[ \t]*$/m.exec(src) || [])[1] || '';
        const token = (/^const TOKEN = '([^'\n]*)';[ \t]*$/m.exec(src) || [])[1] || '';
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token || /^__/.test(token)) continue;
        let when = 0;
        try { when = place.fm.modificationDate(path).getTime(); } catch (e) {}
        if (!found[key] || when > found[key].when) found[key] = { repo: repo, token: token, script: name.replace(/\.js$/i, ''), when: when };
      } catch (e) {}
    }
  }
  const acc = {};
  ORDER.forEach(function (k) {
    const f = found[k] || saved[k];
    if (f && f.repo && f.token) acc[k] = { repo: f.repo, token: f.token, script: f.script || '', seen: !!found[k] };
  });
  const keep = {};
  ORDER.forEach(function (k) { if (acc[k]) keep[k] = { repo: acc[k].repo, token: acc[k].token, script: acc[k].script }; });
  try { if (JSON.stringify(keep) !== JSON.stringify(saved)) Keychain.set(KEYCHAIN, JSON.stringify(keep)); } catch (e) {}
  return acc;
}

/* ---------- Copia local: si una cuenta no se puede leer, se muestra lo último que se leyó ---------- */
function cachePath() { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), 'cuentas-panel.json'); }
function readCache() {
  try { const fm = FileManager.local(), p = cachePath(); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) || {} : {}; } catch (e) { return {}; }
}
function writeCache(c) { try { FileManager.local().writeString(cachePath(), JSON.stringify(c)); } catch (e) {} }

async function loadAccount(key, acc) {
  const name = APPS[key].name;
  if (!acc) return { msg: 'Falta el script del widget de ' + name + ' en Scriptable.', missing: true };
  try {
    const r = await LOADERS[key].load(ghFor(acc));
    r.at = Date.now();
    return r;
  } catch (e) {
    return { failed: true, msg: e && e.status === 401 ? 'El token venció. Copia de nuevo el widget de ' + name + '.' : 'No se pudo leer el buzón de ' + name + '.' };
  }
}
async function loadAll() {
  const accs = await findAccounts();
  const cache = readCache(), res = {};
  const out = await Promise.all(ORDER.map(function (k) { return loadAccount(k, accs[k]); }));
  ORDER.forEach(function (k, i) {
    let r = out[i];
    if (r.failed && cache[k] && !cache[k].msg) r = Object.assign({}, cache[k], { old: true });
    else if (!r.msg) cache[k] = r;
    res[k] = r;
  });
  writeCache(cache);
  return { accounts: res, found: accs, at: Date.now() };
}

/* ---------- Dibujo (paleta de Copec) ---------- */
const WHITE = new Color('#ffffff'), LIME = new Color('#BDEBFB'), OVER = new Color('#ff9b92');
const TIT = new Color('#DCE6FF'), ADI = new Color('#7FD3F5'), LINE = new Color('#ffffff', 0.2);
function label(stack, str, size, color, opacity, bold) {
  const t = stack.addText(str);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color || WHITE;
  if (opacity) t.textOpacity = opacity;
  t.lineLimit = 1;
  return t;
}
function background(w) {
  const g = new LinearGradient();
  g.colors = [new Color('#4D78F3'), new Color('#2950F4'), new Color('#1C38C2')];
  g.locations = [0, 0.45, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
}
// Qué es el total de cada cuenta
function what(key, r) {
  if (r.old) return 'sin conexión · ' + hm(new Date(r.at));
  if (key === 'master') return 'a pagar en ' + MESL[+(r.month || dayKey(new Date())).slice(5, 7) - 1];
  if (key === 'liderbci') return 'total del periodo';
  return 'saldo disponible';
}
function totalText(r) { return typeof r.total === 'number' ? money(r.total) : r.empty || 'Sin definir'; }
function totalColor(r) { return typeof r.total === 'number' && r.total < 0 ? OVER : WHITE; }
function when(b) { return dayLabel(b.d) + (b.h ? ' ' + b.h : ''); }

function divider(w) {
  const d = w.addStack();
  d.layoutHorizontally();
  d.size = new Size(0, 1);
  d.backgroundColor = LINE;
  d.addSpacer();
}
// Una cuenta: nombre, qué se muestra y el total; debajo, los tres últimos movimientos
function band(w, key, r) {
  const head = w.addStack();
  head.layoutHorizontally();
  head.bottomAlignContent();
  label(head, APPS[key].name.toUpperCase(), 11, LIME, 0, true);
  head.addSpacer(6);
  if (!r.msg) label(head, what(key, r), 10, WHITE, 0.65);
  head.addSpacer();
  if (!r.msg) label(head, totalText(r), 16, totalColor(r), 0, true).minimumScaleFactor = 0.6;
  w.addSpacer(3);
  if (r.msg) {
    label(w, r.msg, 11, WHITE, 0.85).lineLimit = 2;
    return;
  }
  if (!r.buys.length) label(w, key === 'copec' ? 'Aún no hay cargos de bip!' : 'Aún no hay movimientos', 11, WHITE, 0.7);
  r.buys.forEach(function (b, i) {
    if (i) w.addSpacer(1.5);
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const col = row.addStack();                      // la fecha, en una columna de ancho fijo para alinear los nombres
    col.layoutHorizontally();
    col.size = new Size(64, 0);
    label(col, when(b), 10, WHITE, 0.6);
    col.addSpacer();
    if (key === 'master') { label(row, b.w, 9, b.w === 'A' ? ADI : TIT, 0, true); row.addSpacer(4); }   // T: titular · A: adicional
    label(row, b.c, 11, WHITE, 0.95);
    row.addSpacer();
    label(row, money(b.m), 11, WHITE, 0, true);
  });
}

function buildLarge(data) {
  const w = new ListWidget();
  background(w);
  w.setPadding(12, 14, 12, 14);
  const top = w.addStack();
  top.layoutHorizontally();
  top.centerAlignContent();
  label(top, 'MIS CUENTAS', 10, LIME, 0, true);
  top.addSpacer();
  label(top, hm(new Date(data.at)), 9, WHITE, 0.6);
  w.addSpacer(5);
  ORDER.forEach(function (k, i) {
    if (i) { w.addSpacer(); w.addSpacer(3); divider(w); w.addSpacer(3); w.addSpacer(); }
    band(w, k, data.accounts[k]);
  });
  return w;
}
// Mediano: las cuatro cuentas en dos columnas, con el total y el último movimiento
function leading(stack, str, size, color, opacity, bold) {   // texto alineado a la izquierda dentro de una columna
  const s = stack.addStack();
  s.layoutHorizontally();
  const t = label(s, str, size, color, opacity, bold);
  s.addSpacer();
  return t;
}
function buildMedium(data) {
  const w = new ListWidget();
  background(w);
  w.setPadding(12, 14, 12, 14);
  [[0, 1], [2, 3]].forEach(function (pair, r) {
    if (r) { w.addSpacer(); divider(w); w.addSpacer(); }
    const line = w.addStack();
    line.layoutHorizontally();
    line.topAlignContent();
    pair.forEach(function (idx, c) {
      const k = ORDER[idx], a = data.accounts[k];
      if (c) line.addSpacer(12);
      const cell = line.addStack();
      cell.layoutVertically();
      cell.size = new Size(140, 0);
      leading(cell, APPS[k].name.toUpperCase(), 10, LIME, 0, true);
      if (a.msg) { leading(cell, a.msg, 10, WHITE, 0.85).lineLimit = 2; return; }
      leading(cell, totalText(a), 18, totalColor(a), 0, true).minimumScaleFactor = 0.5;
      const b = a.buys[0];
      leading(cell, b ? b.c + ' ' + money(b.m) : 'Sin movimientos', 10, WHITE, 0.7).minimumScaleFactor = 0.7;
    });
  });
  return w;
}
// Pequeño: solo los cuatro totales
function buildSmall(data) {
  const w = new ListWidget();
  background(w);
  w.setPadding(12, 12, 12, 12);
  ORDER.forEach(function (k, i) {
    const a = data.accounts[k];
    if (i) w.addSpacer();
    label(w, APPS[k].name.toUpperCase(), 9, LIME, 0, true);
    label(w, a.msg ? '—' : totalText(a), 15, a.msg ? WHITE : totalColor(a), 0, true).minimumScaleFactor = 0.5;
  });
  return w;
}
// Pantalla bloqueada: los cuatro totales en dos líneas
function buildLock(data) {
  const w = new ListWidget();
  function part(k) { const a = data.accounts[k]; return APPS[k].name + ' ' + (a.msg ? '—' : totalText(a)); }
  label(w, part('copec') + ' · ' + part('fan'), 12, null, 0, true).minimumScaleFactor = 0.5;
  label(w, part('master') + ' · ' + part('liderbci'), 12, null, 0, true).minimumScaleFactor = 0.5;
  return w;
}
function build(data, family) {
  if (String(family || '').indexOf('accessory') === 0) return buildLock(data);
  if (family === 'small') return buildSmall(data);
  if (family === 'medium') return buildMedium(data);
  return buildLarge(data);
}

/* ---------- Ejecución ---------- */
const data = await loadAll();
const widget = build(data, config.widgetFamily);
widget.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Al ejecutarlo en Scriptable, avisa qué cuentas no encontró antes de mostrar el panel
  const missing = ORDER.filter(function (k) { return !data.found[k]; }).map(function (k) { return APPS[k].name; });
  if (missing.length) {
    const a = new Alert();
    a.title = missing.length === 1 ? 'Falta una cuenta' : 'Faltan ' + missing.length + ' cuentas';
    a.message = 'No encontré en Scriptable el script del widget de ' + missing.join(', ').replace(/, ([^,]*)$/, ' y $1') + '. ' +
      'Cópialo desde la app con el botón «Copiar el script del widget», pégalo en Scriptable y vuelve a ejecutar este script.';
    a.addAction('Entendido');
    await a.present();
  }
  await widget.presentLarge();
}
Script.complete();
