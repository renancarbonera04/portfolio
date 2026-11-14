/* =====================================================================
   NÚCLEO 2 — Motor XLSX próprio (sem bibliotecas)
   ZIP (CompressionStream 'deflate-raw' + CRC32), leitura rápida de XML
   por expressões regulares, estilos que só ACRESCENTAM (preservam os do
   time), deslocamento de fórmulas e montagem do pacote preservando abas,
   partes e nomes definidos que o sistema não conhece.
   ===================================================================== */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const REL_WS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const XML_TOPO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const CT_WS = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';

class ErroPlanilha extends Error {
  constructor(tipo, msg) { super(msg); this.name = 'ErroPlanilha'; this.tipo = tipo; }
}

/* ---------------- XML ---------------- */
const xEsc = s => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function xmlDec(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e]);
}
function attrs(s) {
  const o = {}; const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let m;
  while ((m = re.exec(s || ''))) o[m[1]] = xmlDec(m[2] !== undefined ? m[2] : m[3]);
  return o;
}
function attrSufixo(o, suf) { for (const k in o) if (k === suf || k.endsWith(':' + suf)) return o[k]; return undefined; }
/* Texto de <si>/<is>: junta os <t>, ignorando a fonética (<rPh>) */
function textoRico(x) {
  if (!x) return '';
  x = x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = ''; const re = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g; let m;
  while ((m = re.exec(x))) out += m[1] ? xmlDec(m[1]) : '';
  return out;
}
const letraCol = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const numCol = s => { let n = 0; for (const ch of String(s).toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; };

/* ---------------- ZIP ---------------- */
const CRC_TAB = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TAB[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function fluxo(u8, ts) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(ts)).arrayBuffer()); }
async function comprimir(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  try { return await fluxo(u8, new CompressionStream('deflate-raw')); } catch (e) { return null; }
}
async function descomprimir(u8) {
  if (typeof DecompressionStream === 'undefined') throw new ErroPlanilha('navegador', 'Este navegador é antigo demais para ler a planilha. Use o Edge ou o Chrome atualizados.');
  return fluxo(u8, new DecompressionStream('deflate-raw'));
}
const UTF8 = new TextEncoder(), UTF8D = new TextDecoder();
async function zipar(entradas) {
  const partes = [], central = [];
  const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  let pos = 0;
  for (const [nomeTxt, conteudo] of entradas) {
    const nome = UTF8.encode(nomeTxt);
    const bruto = typeof conteudo === 'string' ? UTF8.encode(conteudo) : conteudo;
    const crc = crc32(bruto);
    let dados = bruto.length > 64 ? await comprimir(bruto) : null, metodo = 8;
    if (!dados || dados.length >= bruto.length) { dados = bruto; metodo = 0; }
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, metodo, true);
    lh.setUint16(10, hora, true); lh.setUint16(12, dia, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, dados.length, true); lh.setUint32(22, bruto.length, true); lh.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(lh.buffer), nome, dados);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, metodo, true);
    ch.setUint16(12, hora, true); ch.setUint16(14, dia, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, dados.length, true); ch.setUint32(24, bruto.length, true); ch.setUint16(28, nome.length, true);
    ch.setUint32(42, pos, true);
    central.push(new Uint8Array(ch.buffer), nome);
    pos += 30 + nome.length + dados.length;
  }
  const tamCentral = central.reduce((s, u) => s + u.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, entradas.length, true); fim.setUint16(10, entradas.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const out = new Uint8Array(todas.reduce((s, u) => s + u.length, 0));
  let o = 0; for (const u of todas) { out.set(u, o); o += u.length; }
  return out;
}
function abrirZip(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new ErroPlanilha('corrompida', 'O arquivo não é uma planilha .xlsx válida (pode estar incompleto ou corrompido).');
  const mapa = new Map(), nomes = [];
  let p = dv.getUint32(e + 16, true);
  const n = dv.getUint16(e + 10, true);
  for (let k = 0; k < n; k++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) throw new ErroPlanilha('corrompida', 'O arquivo .xlsx está corrompido (índice interno quebrado).');
    const ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true);
    const nome = UTF8D.decode(u8.subarray(p + 46, p + 46 + ln));
    const ent = { nome, metodo: dv.getUint16(p + 10, true), tam: dv.getUint32(p + 20, true), pos: dv.getUint32(p + 42, true) };
    if (!nome.endsWith('/')) { mapa.set(nome.replace(/^\//, '').toLowerCase(), ent); nomes.push(nome.replace(/^\//, '')); }
    p += 46 + ln + lx + lc;
  }
  const bytes = async nome => {
    const a = mapa.get(String(nome).replace(/^\//, '').toLowerCase());
    if (!a) return null;
    if (a.pos + 30 > u8.length) throw new ErroPlanilha('corrompida', 'O arquivo .xlsx está incompleto.');
    const ini = a.pos + 30 + dv.getUint16(a.pos + 26, true) + dv.getUint16(a.pos + 28, true);
    const dados = u8.subarray(ini, ini + a.tam);
    if (a.metodo === 0) return dados.slice();
    if (a.metodo !== 8) throw new ErroPlanilha('corrompida', 'A planilha usa uma compressão que o navegador não lê.');
    try { return await descomprimir(dados); }
    catch (err) { throw new ErroPlanilha('corrompida', 'Uma parte da planilha está corrompida e não pôde ser lida.'); }
  };
  return { nomes, tem: nome => mapa.has(String(nome).replace(/^\//, '').toLowerCase()), bytes, texto: async nome => { const b = await bytes(nome); return b ? UTF8D.decode(b) : null; } };
}
function verificarAssinatura(u8) {
  if (!u8 || !u8.length) throw new ErroPlanilha('vazia', 'A planilha está vazia (0 bytes). Pode ser que outra pessoa esteja gravando neste momento.');
  if (u8.length >= 4 && u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0)
    throw new ErroPlanilha('protegida', 'A planilha está com SENHA ou com RÓTULO DE CONFIDENCIALIDADE do Office, e o navegador não consegue ler arquivos assim. Peça a quem colocou para tirar: no Excel, Arquivo › Informações › Proteger pasta de trabalho (tirar a senha) e Rótulo/Confidencialidade › "Geral" ou "Público". A planilha do sistema precisa ficar SEM senha e SEM rótulo.');
  if (!(u8[0] === 0x50 && u8[1] === 0x4B)) throw new ErroPlanilha('formato', 'Este arquivo não é uma planilha .xlsx (talvez seja .xls antigo, .csv ou outro formato).');
}

/* ---------------- Deslocar fórmulas (quando a linha muda de lugar) ---------------- */
function deslocarFormula(f, dr, dc = 0) {
  if (!f || (!dr && !dc)) return f;
  let out = '', i = 0;
  const trecho = s => s.replace(/(?<![A-Za-z0-9_.$'\]\\])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(])/g, (m, ca, col, ra, row) => {
    let c = numCol(col), r = +row;
    if (c > 16384) return m;
    if (!ra) r += dr;
    if (!ca) c += dc;
    if (r < 1 || c < 1 || r > 1048576) return '#REF!';
    return ca + letraCol(c) + ra + r;
  });
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"' || ch === "'" || ch === '[') {
      const fecha = ch === '[' ? ']' : ch; let j = i + 1;
      while (j < f.length) { if (f[j] === fecha) { if (ch !== '[' && f[j + 1] === fecha) { j += 2; continue; } break; } j++; }
      out += f.slice(i, j + 1); i = j + 1;
    } else {
      let j = i; while (j < f.length && f[j] !== '"' && f[j] !== "'" && f[j] !== '[') j++;
      out += trecho(f.slice(i, j)); i = j;
    }
  }
  return out;
}

/* ---------------- Leitura de uma aba em grade ---------------- */
/* Devolve linhas: Map(numLinha -> Map(numColuna -> célula)); célula = { v, t, s, fx? }.
   Assíncrona: a cada ~1500 linhas devolve o controle ao navegador (a tela não trava). */
/* Em aba escondida o navegador atrasa muito o setTimeout; aí não cedemos (só evita travar quem está vendo). */
const ceder = () => (typeof document !== 'undefined' && document.hidden) ? Promise.resolve() : new Promise(r => setTimeout(r, 0));
async function gradeDaAba(xml, sst) {
  const linhas = new Map();
  let maxR = 0, maxC = 0;
  const ini = xml.indexOf('<sheetData'), fim = xml.lastIndexOf('</sheetData>');
  const corpo = ini >= 0 && fim > ini ? xml.slice(ini, fim) : '';
  const reRow = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  const reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  const reAt = /\b(r|s|t)="([^"]*)"/g;
  const compart = new Map();   // fórmulas compartilhadas: si -> { f, r, c }
  let m, rSeq = 0, n = 0;
  while ((m = reRow.exec(corpo))) {
    if (++n % 1500 === 0) await ceder();
    const ra = /\br="(\d+)"/.exec(m[1]);
    const r = ra ? +ra[1] : rSeq + 1; rSeq = r;
    if (!m[2]) continue;
    const cels = new Map(); let cSeq = 0, mc;
    reC.lastIndex = 0;
    while ((mc = reC.exec(m[2]))) {
      let ref = '', t = 'n', s, ma;
      reAt.lastIndex = 0;
      while ((ma = reAt.exec(mc[1]))) { if (ma[1] === 'r') ref = ma[2]; else if (ma[1] === 't') t = ma[2]; else s = ma[2]; }
      let c;
      if (ref) { c = 0; for (let k = 0; k < ref.length; k++) { const ch = ref.charCodeAt(k); if (ch >= 65 && ch <= 90) c = c * 26 + ch - 64; else if (ch >= 97 && ch <= 122) c = c * 26 + ch - 96; else break; } }
      else c = cSeq + 1;
      cSeq = c;
      const dentro = mc[2] || '';
      const cel = { t };
      if (s !== undefined) cel.s = +s;
      let v = '', vTxt = '';
      const iv = dentro.indexOf('<v');
      if (iv >= 0) { const mv = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(dentro.slice(iv)); if (mv) vTxt = xmlDec(mv[1]); }
      if (t === 's') v = vTxt !== '' ? (sst[+vTxt] ?? '') : '';
      else if (t === 'inlineStr') { const ii = dentro.indexOf('<is>'); v = ii >= 0 ? textoRico(dentro.slice(ii + 4, dentro.lastIndexOf('</is>'))) : ''; }
      else if (t === 'str' || t === 'd') v = vTxt;
      else if (t === 'b') v = vTxt === '1' || vTxt === 'true';
      else if (t === 'e') v = vTxt;
      else if (vTxt !== '') { const nn = Number(vTxt); v = isFinite(nn) ? nn : vTxt; }
      cel.v = v;
      if (dentro.indexOf('<f') >= 0) {
        const mf = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(dentro);
        if (mf) {
          const fa = attrs(mf[1]);
          const ftxt = mf[2] ? xmlDec(mf[2]) : '';
          if (fa.t === 'shared') {
            if (ftxt) { compart.set(fa.si, { f: ftxt, r, c }); cel.fx = ftxt; }
            else { const mst = compart.get(fa.si); if (mst) cel.fx = deslocarFormula(mst.f, r - mst.r, c - mst.c); }
          } else if (fa.t === 'array' || fa.t === 'dataTable') { cel.fArray = true; if (ftxt) cel.fx = ftxt; }
          else if (ftxt) cel.fx = ftxt;
        }
      }
      if (v === '' && cel.fx === undefined && cel.s === undefined) continue;
      cels.set(c, cel);
      if (c > maxC) maxC = c;
    }
    if (cels.size) { linhas.set(r, cels); if (r > maxR) maxR = r; }
  }
  return { linhas, maxR, maxC };
}
/* Larguras/ocultas das colunas (para preservar o que o time ajustou no Excel) */
function colsDaAba(xml) {
  const out = []; const mc = /<cols>([\s\S]*?)<\/cols>/.exec(xml || '');
  if (!mc) return out;
  const re = /<col\b([^>]*?)\/?>/g; let m;
  while ((m = re.exec(mc[1]))) { const a = attrs(m[1]); out.push({ min: +a.min, max: +a.max, width: +a.width || 0, hidden: a.hidden === '1' || a.hidden === 'true', custom: a.customWidth === '1' }); }
  return out;
}

/* ---------------- Pacote (workbook) ---------------- */
function caminhoRel(base, alvo) {
  if (!alvo) return '';
  if (alvo.startsWith('/')) return alvo.slice(1);
  const partesB = base.split('/'); partesB.pop();
  for (const p of alvo.split('/')) { if (p === '..') partesB.pop(); else if (p !== '.') partesB.push(p); }
  return partesB.join('/');
}
function relsDe(caminho) { const i = caminho.lastIndexOf('/'); return caminho.slice(0, i + 1) + '_rels/' + caminho.slice(i + 1) + '.rels'; }
function lerRels(xml, base) {
  const out = []; if (!xml) return out;
  const re = /<Relationship\b([^>]*?)\/?>/g; let m;
  while ((m = re.exec(xml))) {
    const a = attrs(m[1]);
    out.push({ id: a.Id, tipo: a.Type || '', alvo: a.Target || '', modo: a.TargetMode || '', caminho: a.TargetMode === 'External' ? '' : caminhoRel(base, a.Target || '') });
  }
  return out;
}
async function lerPacote(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  verificarAssinatura(u8);
  const zip = abrirZip(u8);
  const arquivos = new Map();
  for (const nome of zip.nomes) arquivos.set(nome.toLowerCase(), { nome, bytes: await zip.bytes(nome) });
  const txt = nome => { const a = arquivos.get(String(nome).toLowerCase()); return a ? UTF8D.decode(a.bytes) : null; };
  const relsRaiz = lerRels(txt('_rels/.rels'), '');
  const relWb = relsRaiz.find(r => /\/officeDocument$/.test(r.tipo));
  const wbCaminho = relWb ? relWb.caminho : 'xl/workbook.xml';
  const wbXml = txt(wbCaminho);
  if (!wbXml) throw new ErroPlanilha('corrompida', 'Este arquivo não é uma planilha .xlsx válida (falta o "workbook").');
  const wbRels = lerRels(txt(relsDe(wbCaminho)), wbCaminho);
  const porId = new Map(wbRels.map(r => [r.id, r]));
  const pr = /<workbookPr\b([^>]*)\/?>/.exec(wbXml);
  const date1904 = !!(pr && /date1904="(1|true)"/i.test(pr[1]));
  const sstRel = wbRels.find(r => /\/sharedStrings$/.test(r.tipo));
  const sstXml = sstRel ? txt(sstRel.caminho) : null;
  const sst = [];
  if (sstXml) { const re = /<si>([\s\S]*?)<\/si>|<si\/>/g; let m; while ((m = re.exec(sstXml))) sst.push(m[1] ? textoRico(m[1]) : ''); }
  const stRel = wbRels.find(r => /\/styles$/.test(r.tipo));
  const abas = [];
  const reS = /<sheet\b([^>]*?)\/?>/g; let m;
  const blocoSheets = (/<sheets>([\s\S]*?)<\/sheets>/.exec(wbXml) || [])[1] || '';
  while ((m = reS.exec(blocoSheets))) {
    const a = attrs(m[1]);
    const rid = attrSufixo(a, 'id');
    const rel = porId.get(rid);
    abas.push({ nome: a.name || '', sheetId: +a.sheetId || 0, estado: a.state || '', rid, caminho: rel ? rel.caminho : '', tipoRel: rel ? rel.tipo : '' });
  }
  const nomes = [];
  const blocoNomes = (/<definedNames>([\s\S]*?)<\/definedNames>/.exec(wbXml) || [])[1] || '';
  const reN = /<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g;
  while ((m = reN.exec(blocoNomes))) nomes.push({ a: attrs(m[1]), texto: xmlDec(m[2]) });
  return {
    arquivos, txt, wbCaminho, wbXml, wbRels, date1904, sst, sstCaminho: sstRel ? sstRel.caminho : '',
    stylesCaminho: stRel ? stRel.caminho : '', stylesXml: stRel ? txt(stRel.caminho) : null,
    abas, nomesDefinidos: nomes, ctXml: txt('[Content_Types].xml') || ''
  };
}

/* ---------------- Estilos: acrescenta os do sistema sem estragar os do time ---------------- */
const ESTILOS_BASE = XML_TOPO + `<styleSheet xmlns="${NS_MAIN}"><fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts>` +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';
const ORDEM_ESTILOS = ['numFmts', 'fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'cellStyles', 'dxfs', 'tableStyles', 'colors', 'extLst'];
const FMT = { data: 'dd/mm/yyyy', dataHora: 'dd/mm/yyyy hh:mm', moeda: '"R$" #,##0.00', mes: '[$-416]mmmm "de" yyyy', pct: '0.0%' };
/* Definições: [formato (id embutido ou código), fonte {b,i,cor,sz,strike}, preenchimento (cor), alinhamento {h,v,wrap}] */
const DEF_ESTILOS = {
  padrao: [0, {}, null, null], quebra: [0, {}, null, { v: 'top', wrap: 1 }],
  cab: [0, { b: 1, cor: 'FFFFFF' }, '1D6A56', { h: 'center', v: 'center', wrap: 1 }],
  cabExtra: [0, { b: 1, cor: '1B2220' }, 'DDE3DF', { h: 'center', v: 'center', wrap: 1 }],
  data: [FMT.data, {}, null, { h: 'center' }], dataHora: [FMT.dataHora, {}, null, { h: 'center' }],
  moeda: [FMT.moeda, {}, null, null], texto: [49, {}, null, null], centro: [0, {}, null, { h: 'center' }],
  cinza: [0, { sz: 10, cor: '80868B' }, null, { h: 'center' }], cinzaDataHora: [FMT.dataHora, { sz: 10, cor: '80868B' }, null, { h: 'center' }],
  cinzaTexto: [49, { sz: 10, cor: '80868B' }, null, null],
  titulo: [0, { b: 1, sz: 14 }, null, null], nota: [0, { sz: 10, cor: '80868B' }, null, null], negrito: [0, { b: 1 }, null, null],
  int: [1, {}, null, { h: 'center' }], pct: [FMT.pct, {}, null, { h: 'center' }],
  mes: [FMT.mes, {}, null, { h: 'left' }], mesAt: [FMT.mes, { b: 1 }, 'E6F1ED', { h: 'left' }],
  moedaAt: [FMT.moeda, { b: 1 }, 'E6F1ED', null], intAt: [1, { b: 1 }, 'E6F1ED', { h: 'center' }],
  verm: [0, { b: 1, cor: 'A50E0E' }, null, null], moedaVerm: [FMT.moeda, { b: 1, cor: 'A50E0E' }, null, null], intVerm: [1, { b: 1, cor: 'A50E0E' }, null, { h: 'center' }],
  ambar: [0, { cor: '9A5B00' }, null, null], moedaAmbar: [FMT.moeda, { cor: '9A5B00' }, null, null], intAmbar: [1, { cor: '9A5B00' }, null, { h: 'center' }],
  moedaNeg: [FMT.moeda, { b: 1 }, null, null], cfgChave: [0, { b: 1 }, 'F0F2EF', { v: 'top', wrap: 1 }], cfgValor: [49, {}, null, { v: 'top', wrap: 1 }]
};
const DEF_DXF = {
  pago: '<font><color rgb="FF1D7544"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFE6F4EA"/></patternFill></fill>',
  cancelado: '<font><strike/><color rgb="FF9AA0A6"/></font>',
  vencido: '<font><color rgb="FFA50E0E"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFCE8E6"/></patternFill></fill>',
  breve: '<fill><patternFill patternType="solid"><bgColor rgb="FFFEF7E0"/></patternFill></fill>',
  lixeira: '<font><i/><strike/><color rgb="FFB0B5B9"/></font>',
  promessa: '<font><color rgb="FF5B3A99"/></font>'
};
function blocoEstilo(xml, nome) {
  const re = new RegExp(`<${nome}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${nome}>)`);
  const m = re.exec(xml);
  return m ? { ini: m.index, fim: m.index + m[0].length, attrs: m[1], corpo: m[2] || '' } : null;
}
function itensEstilo(corpo, tag) {
  const out = []; const re = new RegExp(`<${tag}\\b(?:[^>]*?/>|[^>]*?>[\\s\\S]*?</${tag}>)`, 'g'); let m;
  while ((m = re.exec(corpo || ''))) out.push(m[0]);
  return out;
}
const chaveCor = x => { const m = /rgb="([0-9A-Fa-f]{6,8})"/.exec(x || ''); return m ? m[1].slice(-6).toUpperCase() : (/theme="(\d+)"/.exec(x || '') || [, ''])[1] && 't' + /theme="(\d+)"/.exec(x)[1]; };
function chaveFonte(x) {
  const tem = t => new RegExp(`<${t}\\b(?![^>]*val="(0|false)")`).test(x);
  return [tem('b') ? 'b' : '', tem('i') ? 'i' : '', tem('strike') ? 's' : '', (/<sz val="([\d.]+)"/.exec(x) || [, '11'])[1],
    chaveCor((/<color\b[^>]*>/.exec(x) || [''])[0]) || '', (/<name val="([^"]*)"/.exec(x) || [, ''])[1].toLowerCase()].join('|');
}
function chaveFill(x) { return [(/patternType="(\w+)"/.exec(x) || [, 'none'])[1], chaveCor((/<fgColor\b[^>]*>/.exec(x) || [''])[0]) || ''].join('|'); }
function chaveXf(x) {
  const a = attrs((/<xf\b([^>]*)/.exec(x) || [])[1]);
  const al = attrs((/<alignment\b([^>]*)/.exec(x) || [])[1]);
  return [a.numFmtId || 0, a.fontId || 0, a.fillId || 0, a.borderId || 0, a.xfId || 0, al.horizontal || '', al.vertical || '', al.wrapText === '1' || al.wrapText === 'true' ? 'w' : ''].join('|');
}
const chaveBruta = x => String(x).replace(/\s+/g, '');
function prepararEstilos(stylesXml) {
  let xml = stylesXml && /<styleSheet\b/.test(stylesXml) ? stylesXml : ESTILOS_BASE;
  const sec = {};
  for (const n of ORDEM_ESTILOS) sec[n] = blocoEstilo(xml, n);
  const lista = { numFmts: itensEstilo(sec.numFmts && sec.numFmts.corpo, 'numFmt'), fonts: itensEstilo(sec.fonts && sec.fonts.corpo, 'font'),
    fills: itensEstilo(sec.fills && sec.fills.corpo, 'fill'), borders: itensEstilo(sec.borders && sec.borders.corpo, 'border'),
    cellXfs: itensEstilo(sec.cellXfs && sec.cellXfs.corpo, 'xf'), dxfs: itensEstilo(sec.dxfs && sec.dxfs.corpo, 'dxf') };
  let mudou = false;
  const achar = (arr, chave, item, fk) => { const k = fk(item); let i = arr.findIndex(x => fk(x) === k); if (i < 0) { arr.push(item); i = arr.length - 1; mudou = true; } return i; };
  if (!lista.fonts.length) lista.fonts.push('<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>');
  while (lista.fills.length < 2) lista.fills.push(lista.fills.length ? '<fill><patternFill patternType="gray125"/></fill>' : '<fill><patternFill patternType="none"/></fill>');
  const bordaVazia = (() => { const i = lista.borders.findIndex(b => !/<(left|right|top|bottom)\b[^>]*style=/.test(b)); if (i >= 0) return i; lista.borders.push('<border><left/><right/><top/><bottom/><diagonal/></border>'); mudou = true; return lista.borders.length - 1; })();
  const fonteBase = (lista.fonts[0] && (/<name val="([^"]*)"/.exec(lista.fonts[0]) || [])[1]) || 'Calibri';
  const fmtId = codigo => {
    if (typeof codigo === 'number') return codigo;
    for (const f of lista.numFmts) { const a = attrs(f); if (a.formatCode === codigo) return +a.numFmtId; }
    const max = lista.numFmts.reduce((mx, f) => Math.max(mx, +attrs(f).numFmtId || 0), 163);
    lista.numFmts.push(`<numFmt numFmtId="${max + 1}" formatCode="${xEsc(codigo)}"/>`); mudou = true; return max + 1;
  };
  const idx = {};
  for (const [nome, [fmt, fo, fi, al]] of Object.entries(DEF_ESTILOS)) {
    const nf = fmtId(fmt);
    const fontXml = `<font>${fo.b ? '<b/>' : ''}${fo.i ? '<i/>' : ''}${fo.strike ? '<strike/>' : ''}<sz val="${fo.sz || 11}"/>${fo.cor ? `<color rgb="FF${fo.cor}"/>` : '<color theme="1"/>'}<name val="${xEsc(fonteBase)}"/><family val="2"/></font>`;
    const fontId = (!fo.b && !fo.i && !fo.cor && !fo.sz) ? 0 : achar(lista.fonts, null, fontXml, chaveFonte);
    const fillId = fi ? achar(lista.fills, null, `<fill><patternFill patternType="solid"><fgColor rgb="FF${fi}"/><bgColor indexed="64"/></patternFill></fill>`, chaveFill) : 0;
    const a = `numFmtId="${nf}" fontId="${fontId}" fillId="${fillId}" borderId="${bordaVazia}" xfId="0"` + (nf ? ' applyNumberFormat="1"' : '') + (fontId ? ' applyFont="1"' : '') + (fillId ? ' applyFill="1"' : '');
    const xf = al ? `<xf ${a} applyAlignment="1"><alignment${al.h ? ` horizontal="${al.h}"` : ''}${al.v ? ` vertical="${al.v}"` : ''}${al.wrap ? ' wrapText="1"' : ''}/></xf>` : `<xf ${a}/>`;
    idx[nome] = achar(lista.cellXfs, null, xf, chaveXf);
  }
  const dxf = {};
  for (const [nome, corpo] of Object.entries(DEF_DXF)) dxf[nome] = achar(lista.dxfs, null, `<dxf>${corpo}</dxf>`, chaveBruta);
  if (mudou || xml === ESTILOS_BASE) {
    const novo = {
      numFmts: lista.numFmts.length ? `<numFmts count="${lista.numFmts.length}">${lista.numFmts.join('')}</numFmts>` : '',
      fonts: `<fonts count="${lista.fonts.length}"${sec.fonts ? attrsSem(sec.fonts.attrs) : ''}>${lista.fonts.join('')}</fonts>`,
      fills: `<fills count="${lista.fills.length}">${lista.fills.join('')}</fills>`,
      borders: `<borders count="${lista.borders.length}">${lista.borders.join('')}</borders>`,
      cellXfs: `<cellXfs count="${lista.cellXfs.length}">${lista.cellXfs.join('')}</cellXfs>`,
      dxfs: `<dxfs count="${lista.dxfs.length}">${lista.dxfs.join('')}</dxfs>`
    };
    // Substitui de trás para frente para não bagunçar as posições; insere as seções que faltam na ordem certa
    const ops = [];
    for (const n of Object.keys(novo)) {
      if (sec[n]) ops.push({ ini: sec[n].ini, fim: sec[n].fim, txt: novo[n] });
      else if (novo[n]) {
        const seguinte = ORDEM_ESTILOS.slice(ORDEM_ESTILOS.indexOf(n) + 1).find(k => sec[k]);
        const pos = seguinte ? sec[seguinte].ini : xml.lastIndexOf('</styleSheet>');
        ops.push({ ini: pos, fim: pos, txt: novo[n] });
      }
    }
    ops.sort((a, b) => b.ini - a.ini || b.fim - a.fim);
    for (const o of ops) xml = xml.slice(0, o.ini) + o.txt + xml.slice(o.fim);
  }
  return { xml, idx, dxf };
}
function attrsSem(a) { return (a || '').replace(/\bcount="\d+"/, '').replace(/\s+$/, ''); }

/* Insere um elemento no workbook.xml respeitando a ordem que o Excel exige */
const ORDEM_WB = ['fileVersion', 'fileSharing', 'workbookPr', 'workbookProtection', 'bookViews', 'sheets', 'functionGroups', 'externalReferences', 'definedNames', 'calcPr', 'oleSize', 'customWorkbookViews', 'pivotCaches', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'];
function inserirNoWorkbook(wb, nome, xml) {
  for (const seg of ORDEM_WB.slice(ORDEM_WB.indexOf(nome) + 1)) {
    const m = new RegExp(`<(?:\\w+:)?${seg}\\b`).exec(wb);
    if (m) return wb.slice(0, m.index) + xml + wb.slice(m.index);
  }
  return wb.replace(/<\/(\w+:)?workbook>\s*$/, m => xml + m);
}

/* ---------------- Montagem do pacote final ----------------
   abasSistema: [{ chave, nome, xml, oculta }] na ordem desejada.
   Abas do time (não gerenciadas) e todas as partes ligadas a elas são copiadas como estão. */
async function montarXlsx(pacote, abasSistema, estilosXml, opc = {}) {
  const ehSistema = a => abasSistema.some(s => s.casaCom && s.casaCom(a.nome));
  const entradas = new Map();       // caminho -> conteúdo
  const tipos = new Map();          // caminho -> content type
  const defaults = new Map([['rels', 'application/vnd.openxmlformats-package.relationships+xml'], ['xml', 'application/xml']]);
  let wbCaminho = 'xl/workbook.xml';
  const descartar = new Set();
  const ctOrig = new Map();
  if (pacote) {
    wbCaminho = pacote.wbCaminho;
    const reD = /<Default\b([^>]*?)\/?>/g, reO = /<Override\b([^>]*?)\/?>/g; let m;
    while ((m = reD.exec(pacote.ctXml))) { const a = attrs(m[1]); if (a.Extension) defaults.set(a.Extension.toLowerCase(), a.ContentType); }
    while ((m = reO.exec(pacote.ctXml))) { const a = attrs(m[1]); if (a.PartName) ctOrig.set(a.PartName.replace(/^\//, '').toLowerCase(), a.ContentType); }
    // Partes alcançáveis só pelas abas do sistema (tabelas, comentários, desenhos) são descartadas
    const alcancaveis = (ini, set) => {
      const pilha = [ini];
      while (pilha.length) {
        const p = pilha.pop(); const rels = lerRels(pacote.txt(relsDe(p)), p);
        set.add(relsDe(p).toLowerCase());
        for (const r of rels) if (r.caminho && !set.has(r.caminho.toLowerCase())) { set.add(r.caminho.toLowerCase()); pilha.push(r.caminho); }
      }
    };
    const usadasSistema = new Set(), usadasOutras = new Set();
    for (const a of pacote.abas) if (a.caminho) (ehSistema(a) ? usadasSistema : usadasOutras).add(a.caminho.toLowerCase());
    for (const a of pacote.abas) if (a.caminho) alcancaveis(a.caminho, ehSistema(a) ? usadasSistema : usadasOutras);
    for (const p of usadasSistema) if (!usadasOutras.has(p)) descartar.add(p);
    for (const r of pacote.wbRels) if (/\/calcChain$/.test(r.tipo)) descartar.add(r.caminho.toLowerCase());
    descartar.add(relsDe(wbCaminho).toLowerCase()); descartar.add(wbCaminho.toLowerCase());
    descartar.add('[content_types].xml'); descartar.add('docprops/app.xml');
    if (pacote.stylesCaminho) descartar.add(pacote.stylesCaminho.toLowerCase());
    for (const [k, a] of pacote.arquivos) if (!descartar.has(k)) { entradas.set(a.nome, a.bytes); if (ctOrig.has(k)) tipos.set(a.nome, ctOrig.get(k)); }
  } else {
    entradas.set('_rels/.rels', XML_TOPO + `<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
    const agora = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    entradas.set('docProps/core.xml', XML_TOPO + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xEsc(opc.titulo || 'Boletos a cobrar')}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${agora}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${agora}</dcterms:modified></cp:coreProperties>`);
    tipos.set('docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml');
  }
  const pasta = wbCaminho.replace(/[^/]*$/, '');
  // Ordem final das abas: a do arquivo; abas do sistema que ainda não existem vão para o fim
  const antigas = pacote ? pacote.abas : [];
  const usadosCam = new Set([...entradas.keys()].map(k => k.toLowerCase()));
  let maxSheetId = antigas.reduce((m, a) => Math.max(m, a.sheetId || 0), 0);
  const finais = [];
  const pendentesSis = abasSistema.slice();
  for (const a of antigas) {
    const s = pendentesSis.find(x => x.casaCom(a.nome));
    if (s) { pendentesSis.splice(pendentesSis.indexOf(s), 1); finais.push({ ...s, sheetId: a.sheetId, caminho: a.caminho || null, antigo: a }); }
    else if (!ehSistema(a)) finais.push({ extra: true, nome: a.nome, sheetId: a.sheetId, caminho: a.caminho, estado: a.estado, rid: a.rid, tipoRel: a.tipoRel, antigo: a });
  }
  for (const s of pendentesSis) {
    const k = finais.findIndex(f => !f.extra && f.ordem > s.ordem);
    const novo = { ...s, sheetId: ++maxSheetId, caminho: null };
    if (k >= 0 && s.inserirAntes) finais.splice(k, 0, novo); else finais.push(novo);
  }
  let nNovo = 1;
  for (const f of finais) if (!f.extra) {
    if (!f.caminho || usadosCam.has(f.caminho.toLowerCase())) {
      while (usadosCam.has(`${pasta}worksheets/sheet${nNovo}.xml`.toLowerCase())) nNovo++;
      f.caminho = `${pasta}worksheets/sheet${nNovo}.xml`;
    }
    usadosCam.add(f.caminho.toLowerCase());
    entradas.set(f.caminho, f.xml);
    tipos.set(f.caminho, CT_WS);
  }
  // Relações do workbook: mantém as do time (tema, pivôs, links), refaz as das abas
  const relsOut = [];
  const idsUsados = new Set();
  if (pacote) for (const r of pacote.wbRels) {
    if (/\/worksheet$|\/chartsheet$|\/dialogsheet$|\/calcChain$|\/styles$/.test(r.tipo)) continue;
    if (r.caminho && !entradas.has(r.caminho) && ![...entradas.keys()].some(k => k.toLowerCase() === r.caminho.toLowerCase())) continue;
    relsOut.push(`<Relationship Id="${xEsc(r.id)}" Type="${xEsc(r.tipo)}" Target="${xEsc(r.alvo)}"${r.modo ? ` TargetMode="${xEsc(r.modo)}"` : ''}/>`);
    idsUsados.add(r.id);
  }
  const novoId = (pref) => { let i = 1; while (idsUsados.has(pref + i)) i++; idsUsados.add(pref + i); return pref + i; };
  for (const f of finais) {
    if (f.extra && f.antigo && f.antigo.rid && f.caminho) {
      f.rid = idsUsados.has(f.antigo.rid) ? novoId('rIdS') : f.antigo.rid; idsUsados.add(f.rid);
    } else f.rid = novoId('rIdS');
    const alvo = f.caminho.startsWith(pasta) ? f.caminho.slice(pasta.length) : '/' + f.caminho;
    relsOut.push(`<Relationship Id="${f.rid}" Type="${f.tipoRel || REL_WS}" Target="${xEsc(alvo)}"/>`);
  }
  const stCaminho = (pacote && pacote.stylesCaminho) || pasta + 'styles.xml';
  entradas.set(stCaminho, estilosXml);
  tipos.set(stCaminho, 'application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml');
  relsOut.push(`<Relationship Id="${novoId('rIdE')}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="${xEsc(stCaminho.startsWith(pasta) ? stCaminho.slice(pasta.length) : '/' + stCaminho)}"/>`);
  entradas.set(relsDe(wbCaminho), XML_TOPO + `<Relationships xmlns="${NS_PKG_REL}">${relsOut.join('')}</Relationships>`);

  // Nomes definidos: mantém os do time (remapeando localSheetId), refaz os filtros das abas do sistema
  const idxNovo = new Map(finais.map((f, i) => [f.nome, i]));
  const nomesOut = [];
  if (pacote) for (const n of pacote.nomesDefinidos) {
    const ls = n.a.localSheetId;
    let alvoNome = null;
    if (ls !== undefined) { const ant = pacote.abas[+ls]; alvoNome = ant ? ant.nome : null; }
    const daSistema = alvoNome && finais.some(f => !f.extra && f.nome === alvoNome);
    if (daSistema && /^_xlnm\./.test(n.a.name || '')) continue;
    const a = { ...n.a };
    if (ls !== undefined) { if (!idxNovo.has(alvoNome)) continue; a.localSheetId = String(idxNovo.get(alvoNome)); }
    nomesOut.push(`<definedName ${Object.entries(a).map(([k, v]) => `${k}="${xEsc(v)}"`).join(' ')}>${xEsc(n.texto)}</definedName>`);
  }
  finais.forEach((f, i) => {
    if (f.extra) return;
    if (f.filtro) nomesOut.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xEsc(f.filtro)}</definedName>`);
    if (f.impressao) nomesOut.push(`<definedName name="_xlnm.Print_Area" localSheetId="${i}">${xEsc(f.impressao)}</definedName>`);
    if (f.titulos) nomesOut.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${xEsc(f.titulos)}</definedName>`);
  });
  // Se uma aba do time estava selecionada (salva assim pelo Excel), ela continua a ativa: duas abas
  // "selecionadas" fariam o Excel abrir com as abas AGRUPADAS (edição em várias abas ao mesmo tempo).
  let ativa = Math.max(0, finais.findIndex(f => f.ativa));
  const selTime = finais.findIndex(f => f.extra && f.caminho && pacote && pacote.arquivos.has(f.caminho.toLowerCase()) && /<sheetView\b[^>]*\btabSelected="(1|true)"/.test(UTF8D.decode(pacote.arquivos.get(f.caminho.toLowerCase()).bytes.subarray(0, 4000))));
  if (selTime >= 0) {
    ativa = selTime;
    for (const f of finais) if (!f.extra && typeof f.xml === 'string') { f.xml = f.xml.replace(' tabSelected="1"', ''); entradas.set(f.caminho, f.xml); }
  }
  const sheetsXml = `<sheets>${finais.map(f => `<sheet name="${xEsc(f.nome)}" sheetId="${f.sheetId}"${(f.extra ? f.estado : (f.oculta ? 'hidden' : '')) ? ` state="${f.extra ? f.estado : 'hidden'}"` : ''} r:id="${f.rid}"/>`).join('')}</sheets>`;
  const nomesXml = nomesOut.length ? `<definedNames>${nomesOut.join('')}</definedNames>` : '';
  let wb;
  if (pacote) {
    wb = pacote.wbXml;
    wb = wb.replace(/<sheets>[\s\S]*?<\/sheets>|<sheets\/>/, sheetsXml);
    if (/<definedNames>[\s\S]*?<\/definedNames>/.test(wb)) wb = wb.replace(/<definedNames>[\s\S]*?<\/definedNames>/, nomesXml);
    else if (nomesXml) wb = inserirNoWorkbook(wb, 'definedNames', nomesXml);
    if (/<calcPr\b[^>]*\/>/.test(wb)) wb = wb.replace(/<calcPr\b([^>]*?)\/>/, (m, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
    else if (/<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/.test(wb)) wb = wb.replace(/<calcPr\b([^>]*?)>/, (m, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1">`);
    else wb = inserirNoWorkbook(wb, 'calcPr', '<calcPr calcId="191029" fullCalcOnLoad="1"/>');
    wb = wb.replace(/<workbookView\b([^>]*?)\/>/, (m, a) => `<workbookView${a.replace(/\s*(activeTab|firstSheet)="\d+"/g, '')} activeTab="${ativa}"/>`);
    if (!/xmlns:r=/.test(wb.slice(0, 600))) wb = wb.replace(/<workbook\b/, `<workbook xmlns:r="${NS_REL}"`);
  } else {
    wb = XML_TOPO + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><workbookPr defaultThemeVersion="164011"/>` +
      `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="${ativa}"/></bookViews>` +
      sheetsXml + nomesXml + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  }
  entradas.set(wbCaminho, wb);
  tipos.set(wbCaminho, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml');
  entradas.set('docProps/app.xml', XML_TOPO + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Excel</Application><AppVersion>16.0300</AppVersion></Properties>');
  tipos.set('docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml');
  // [Content_Types].xml
  const overrides = [];
  for (const nome of entradas.keys()) {
    const ext = (nome.split('.').pop() || '').toLowerCase();
    const t = tipos.get(nome);
    if (t && (defaults.get(ext) !== t)) overrides.push(`<Override PartName="/${xEsc(nome)}" ContentType="${xEsc(t)}"/>`);
    else if (!t && !defaults.has(ext)) defaults.set(ext, 'application/octet-stream');
  }
  const ct = XML_TOPO + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    [...defaults].map(([e, t]) => `<Default Extension="${xEsc(e)}" ContentType="${xEsc(t)}"/>`).join('') + overrides.join('') + '</Types>';
  // Ordem dentro do zip: [Content_Types] primeiro (o Excel prefere assim)
  const lista = [['[Content_Types].xml', ct]];
  const prior = ['_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', wbCaminho, relsDe(wbCaminho)];
  for (const p of prior) if (entradas.has(p)) { lista.push([p, entradas.get(p)]); entradas.delete(p); }
  for (const [k, v] of entradas) lista.push([k, v]);
  return zipar(lista);
}
