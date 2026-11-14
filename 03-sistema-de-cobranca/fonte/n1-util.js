/* =====================================================================
   NÚCLEO 1 — Utilitários, datas, valores, parcelas, CPF/CNPJ,
   linha digitável, juros/multa, aging, mensagens, CSV/OFX/CNAB.
   Tudo aqui são funções puras (sem DOM), testadas em Node.
   ===================================================================== */
const VERSAO_APP = '2.0.0';

const pad = n => String(n).padStart(2, '0');
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const normCab = s => semAcento(s).replace(/[^a-z0-9]/g, '');
const limitar = (n, a, b) => Math.min(Math.max(n, a), b);
/* Centavos inteiros, arredondando 0,5 para longe do zero sem erro de ponto flutuante (1,005 -> 101) */
const cent = v => { const n = +((Number(v) || 0) * 100).toPrecision(15); return Math.sign(n) * Math.round(Math.abs(n)); };
const arred2 = n => cent(n) / 100;
const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
const vazio = v => v === undefined || v === null || v === '' || (typeof v === 'number' && !isFinite(v));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLL = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = v => BRL.format(Number(v) || 0);
const somaCent = (arr, f) => arr.reduce((s, x) => s + cent(f ? f(x) : x), 0) / 100;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/* Comparação "de planilha": vazio == vazio, números com 6 casas, texto exato */
function normValor(v) {
  if (vazio(v)) return '';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}
const igual = (a, b) => normValor(a) === normValor(b);

/* ---------------- Datas ----------------
   Datas de calendário: texto "aaaa-mm-dd", contas em UTC (nunca "pulam" um dia).
   Data e hora (cadastrado/alterado em): número de série do Excel, hora local. */
function hojeLocal(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function partes(iso) { const [y, m, d] = String(iso).split('-').map(Number); return { y, m, d }; }
function isoValida(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return false;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3] && +m[1] >= 1900 && +m[1] <= 2200;
}
function somaDias(iso, n) { const { y, m, d } = partes(iso); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function somaMeses(iso, k) {
  const { y, m, d } = partes(iso);
  const ultimo = new Date(Date.UTC(y, m + k, 0)).getUTCDate();          // 31/01 + 1 mês = 28/02 (ou 29)
  return new Date(Date.UTC(y, m - 1 + k, Math.min(d, ultimo))).toISOString().slice(0, 10);
}
function difDias(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5); }
function diaSemana(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
function fmtData(iso) { if (!iso) return ''; const { y, m, d } = partes(iso); return `${pad(d)}/${pad(m)}/${y}`; }
function fmtDataCurta(iso) { if (!iso) return ''; const { m, d } = partes(iso); return `${pad(d)}/${pad(m)}`; }
function nomeMes(ym) { const [y, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${y}`; }
function primeiroDoMes(iso, k = 0) { const { y, m } = partes(iso); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 10); }
function inicioSemana(iso) { const d = diaSemana(iso); return somaDias(iso, d === 0 ? -6 : 1 - d); } // segunda-feira
function isoParaSerial(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 864e5) : null;
}
function serialParaIso(n) { return new Date(Date.UTC(1899, 11, 30) + Math.floor(n + 1e-9) * 864e5).toISOString().slice(0, 10); }
/* Datas/horas gravadas pelo sistema (criação, alteração) andam em "fatias" de 1e-7 dia (~8,6 ms).
   Motivo: o Excel guarda só 15 dígitos e outros programas arredondam ao milissegundo; numa grade
   de ~8,6 ms o valor volta idêntico depois desses arredondamentos, e o carimbo de criação de cada
   linha (que evita duplicar ou perder linhas entre os 4 usuários) continua batendo. */
const PASSO_TS = 1e-7;
const fatia = ts => Math.round(ts / PASSO_TS);
const depois = (a, b) => a - b > PASSO_TS / 2;          // "a" é mais recente que "b" (com folga de arredondamento)
function agoraSerial(d = new Date()) {
  return isoParaSerial(hojeLocal(d)) + (d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds()) / 864e5;
}
function serialParaTexto(s, comSeg) {
  if (vazio(s) || typeof s !== 'number') return '';
  const iso = serialParaIso(s);
  let ms = Math.round((s - Math.floor(s + 1e-9)) * 864e5);
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60;
  return `${fmtData(iso)} ${pad(h)}:${pad(mi)}${comSeg ? ':' + pad(se) : ''}`;
}
function serialParaHora(s) { const t = serialParaTexto(s); return t.slice(11); }
/* Aceita "dd/mm/aaaa", "dd/mm/aa", "aaaa-mm-dd", "dd.mm.aaaa", "ddmmaaaa", número de série */
function paraIso(v, off = 0) {
  if (typeof v === 'number') return v > 0 && v < 2958466 ? serialParaIso(v + off) : '';
  if (v instanceof Date && !isNaN(v)) return hojeLocal(v);
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  let m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})(?:\s.*)?$/.exec(s);
  if (m) {
    let y = +m[3]; if (m[3].length === 2) y += y < 70 ? 2000 : 1900;
    const iso = `${y}-${pad(m[2])}-${pad(m[1])}`;
    return isoValida(iso) ? iso : '';
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) { const iso = `${m[1]}-${pad(m[2])}-${pad(m[3])}`; return isoValida(iso) ? iso : ''; }
  m = /^(\d{2})(\d{2})(\d{4})$/.exec(s);
  if (m) { const iso = `${m[3]}-${m[2]}-${m[1]}`; return isoValida(iso) ? iso : ''; }
  if (/^\d+(\.\d+)?$/.test(s)) { const n = +s; if (n > 20000 && n < 80000) return serialParaIso(n + off); }
  return '';
}

/* ---------------- Valores ---------------- */
/* "1.234,56" / "1234,56" / "1234.56" / "R$ 1.234" / "-10,5" -> número (2 casas) */
function lerValor(s) {
  if (typeof s === 'number') return isFinite(s) ? arred2(s) : NaN;
  s = String(s == null ? '' : s).trim();
  const neg = /^-|^\(.*\)$|-$/.test(s.replace(/\s|R\$/g, ''));
  s = s.replace(/[^\d,.]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\.(?=.*\.)/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? arred2(neg ? -n : n) : NaN;
}

/* Parcelas: mensal no mesmo dia (ajuste de fim de mês) ou a cada X dias;
   valor por parcela ou total dividido (centavos que sobram vão na parcela 1);
   começar da parcela N. */
function gerarParcelas({ qtd = 1, inicio = 1, valor, venc1, modo = 'parcela', intervalo = 'mensal', dias = 30 }) {
  const total = limitar(parseInt(qtd, 10) || 1, 1, 360);
  const ini = limitar(parseInt(inicio, 10) || 1, 1, total);
  const d = limitar(parseInt(dias, 10) || 30, 1, 3650);
  const v = typeof valor === 'number' ? valor : lerValor(valor);
  if (!(v > 0) || !isoValida(venc1)) return [];
  const totalCent = Math.round(v * 100);
  const parcelado = total > 1;
  const base = Math.floor(totalCent / total);
  const centavos = n => (modo === 'total' && parcelado) ? base + (n === 1 ? totalCent - base * total : 0) : totalCent;
  const out = [];
  for (let n = ini, k = 0; n <= total; n++, k++) {
    const venc = intervalo === 'dias' && parcelado ? somaDias(venc1, k * d) : somaMeses(venc1, k);
    out.push({ numero: n, total, valor: centavos(n) / 100, venc });
  }
  return out;
}
function lerParcela(p) { const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(String(p || '')); return m ? { n: +m[1], t: +m[2] } : null; }

/* ---------------- CPF / CNPJ (inclui o CNPJ alfanumérico) ---------------- */
const docLimpo = v => String(v == null ? '' : v).toUpperCase().replace(/[^0-9A-Z]/g, '');
function mascara(s, m) { let o = '', i = 0; for (const c of m) { if (i >= s.length) break; o += c === '#' ? s[i++] : c; } return o; }
function formatarDoc(v) {
  let s = docLimpo(v).slice(0, 14);
  if (/^\d{1,11}$/.test(s)) return mascara(s, '###.###.###-##');
  return mascara(s, '##.###.###/####-##');
}
function cpfValido(s) {
  if (!/^\d{11}$/.test(s) || /^(\d)\1{10}$/.test(s)) return false;
  const dv = n => { let soma = 0; for (let i = 0; i < n; i++) soma += +s[i] * (n + 1 - i); const r = (soma * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +s[9] && dv(10) === +s[10];
}
function cnpjValido(s) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(s) || /^(\d)\1{13}$/.test(s)) return false;
  const val = c => c.charCodeAt(0) - 48;              // dígitos 0–9 e letras A=17 … Z=42 (regra da Receita)
  const dv = n => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0; for (let i = 0; i < n; i++) soma += val(s[i]) * pesos[i];
    const r = soma % 11; return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === +s[12] && dv(13) === +s[13];
}
function checarDoc(v) {
  const s = docLimpo(v);
  if (!s) return { vazio: true, ok: false };
  if (/^\d{11}$/.test(s)) return { tipo: 'CPF', ok: cpfValido(s) };
  if (s.length === 14) return { tipo: 'CNPJ', ok: cnpjValido(s) };
  return { incompleto: true, ok: false };
}

/* ---------------- Boleto: linha digitável / código de barras ---------------- */
function mod10(num) {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = +num[i] * peso; if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p; peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}
function mod11(num, tipo) {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) { soma += +num[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  const resto = soma % 11;
  if (tipo === 'banco') { const dv = 11 - resto; return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv; }
  const dv = 11 - resto; return (dv === 10 || dv === 11) ? 0 : dv;  // arrecadação
}
const BASE_FATOR = '1997-10-07';
/* Fator de vencimento: 1000..9999. Em 22/02/2025 o fator voltou a 1000 (ciclos de 9000 dias).
   Escolhemos o ciclo cuja data fica mais perto de hoje. */
function dataDoFator(fator, hoje = hojeLocal()) {
  if (!fator) return '';
  let melhor = '', dist = Infinity;
  for (let c = 0; c < 4; c++) {
    const iso = somaDias(BASE_FATOR, fator + c * 9000);
    const d = Math.abs(difDias(iso, hoje));
    if (d < dist || (d === dist && iso > melhor)) { dist = d; melhor = iso; }
  }
  return melhor;
}
function fatorDaData(iso) { let f = difDias(iso, BASE_FATOR); while (f > 9999) f -= 9000; return f; }
const BANCOS = { '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '070': 'BRB', '077': 'Inter', '104': 'Caixa', '136': 'Unicred', '208': 'BTG', '237': 'Bradesco', '260': 'Nubank', '336': 'C6', '341': 'Itaú', '389': 'Mercantil', '422': 'Safra', '748': 'Sicredi', '756': 'Sicoob' };
/* Lê linha digitável (47 = bancário, 48 = arrecadação/convênio) ou código de barras (44). */
function lerBoleto(entrada, hoje = hojeLocal()) {
  const d = String(entrada || '').replace(/\D/g, '');
  const r = { ok: false, digitos: d, erros: [] };
  if (!d) { r.erros.push('vazio'); return r; }
  let barras = '';
  if (d.length === 47) {
    r.tipo = 'bancario';
    const campos = [[0, 9, 9], [10, 20, 20], [21, 31, 31]];
    campos.forEach(([a, b, p], i) => { if (mod10(d.slice(a, b)) !== +d[p]) r.erros.push(`dígito do ${i + 1}º campo não confere`); });
    barras = d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
  } else if (d.length === 48) {
    r.tipo = 'arrecadacao';
    if (d[0] !== '8') { r.erros.push('linha de 48 dígitos deve começar com 8'); return r; }
    const ref = d[2];
    const usa10 = ref === '6' || ref === '7';
    for (let i = 0; i < 4; i++) {
      const bloco = d.slice(i * 12, i * 12 + 11), dv = +d[i * 12 + 11];
      if ((usa10 ? mod10(bloco) : mod11(bloco)) !== dv) r.erros.push(`dígito do ${i + 1}º bloco não confere`);
    }
    barras = [0, 1, 2, 3].map(i => d.slice(i * 12, i * 12 + 11)).join('');
  } else if (d.length === 44) {
    barras = d; r.tipo = d[0] === '8' ? 'arrecadacao' : 'bancario';
  } else {
    r.erros.push(`tem ${d.length} dígitos; a linha digitável tem 47 (boleto bancário) ou 48 (conta/convênio)`);
    return r;
  }
  r.barras = barras;
  if (r.tipo === 'bancario') {
    const dv = mod11(barras.slice(0, 4) + barras.slice(5), 'banco');
    if (dv !== +barras[4]) r.erros.push('dígito verificador geral não confere');
    r.banco = barras.slice(0, 3); r.nomeBanco = BANCOS[r.banco] || '';
    r.fator = +barras.slice(5, 9);
    r.vencimento = dataDoFator(r.fator, hoje);
    r.valor = +barras.slice(9, 19) / 100;
    r.campoLivre = barras.slice(19);
    r.linha = d.length === 47 ? d : linhaDeBarras(barras);
  } else {
    const ref = barras[2], usa10 = ref === '6' || ref === '7';
    const dv = usa10 ? mod10(barras.slice(0, 3) + barras.slice(4)) : mod11(barras.slice(0, 3) + barras.slice(4));
    if (dv !== +barras[3]) r.erros.push('dígito verificador geral não confere');
    r.segmento = barras[1];
    if (ref === '6' || ref === '8') r.valor = +barras.slice(4, 15) / 100;
    r.linha = d.length === 48 ? d : '';
  }
  r.ok = r.erros.length === 0;
  return r;
}
function linhaDeBarras(b) {
  const c1 = b.slice(0, 4) + b.slice(19, 24), c2 = b.slice(24, 34), c3 = b.slice(34, 44);
  return c1 + mod10(c1) + c2 + mod10(c2) + c3 + mod10(c3) + b[4] + b.slice(5, 19);
}
function fmtLinha(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.length === 47) return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
  if (d.length === 48) return [0, 1, 2, 3].map(i => d.slice(i * 12, i * 12 + 11) + '-' + d[i * 12 + 11]).join(' ');
  return d;
}

/* ---------------- Juros, multa, aging, mensagens ---------------- */
/* Multa (uma vez) + juros simples ao mês, proporcionais aos dias (mês = 30 dias) */
function valorAtualizado(saldo, vencimento, hoje, multaPct, jurosMesPct) {
  const s = Number(saldo) || 0;
  const dias = vencimento ? difDias(hoje, vencimento) : 0;
  if (dias <= 0 || s <= 0) return { dias: Math.max(0, dias), multa: 0, juros: 0, total: arred2(s) };
  const multa = arred2(s * (Number(multaPct) || 0) / 100);
  const juros = arred2(s * (Number(jurosMesPct) || 0) / 100 / 30 * dias);
  return { dias, multa, juros, total: arred2(s + multa + juros) };
}
const FAIXAS = [
  { k: 'avencer', rot: 'A vencer', min: -Infinity, max: 0 },
  { k: 'd1', rot: '1–7 dias', min: 1, max: 7 },
  { k: 'd8', rot: '8–15 dias', min: 8, max: 15 },
  { k: 'd16', rot: '16–30 dias', min: 16, max: 30 },
  { k: 'd31', rot: '31–60 dias', min: 31, max: 60 },
  { k: 'd61', rot: 'Mais de 60 dias', min: 61, max: Infinity }
];
function faixaAtraso(vencimento, hoje) {
  if (!vencimento) return 'avencer';
  const d = difDias(hoje, vencimento);
  return FAIXAS.find(f => d >= f.min && d <= f.max).k;
}
/* Troca {variavel} pelo valor (aceita maiúsculas, acentos e espaços) */
function preencherModelo(modelo, vars) {
  const mapa = {};
  Object.keys(vars).forEach(k => { mapa[normCab(k)] = vars[k]; });
  return String(modelo || '').replace(/\{([^{}]{1,40})\}/g, (m, k) => {
    const n = normCab(k);
    return n in mapa ? String(mapa[n] == null ? '' : mapa[n]) : m;
  });
}
function linkWhats(telefone, texto) {
  let t = String(telefone || '').replace(/\D/g, '');
  if (t && t.length <= 11) t = '55' + t;
  return `https://wa.me/${t}?text=${encodeURIComponent(texto || '')}`;
}

/* ---------------- CSV ---------------- */
function detectarSeparador(txt) {
  const linha = (txt.split(/\r?\n/).find(l => l.trim()) || '');
  let melhor = ';', max = -1;
  for (const sep of [';', ',', '\t', '|']) {
    let n = 0, q = false;
    for (const c of linha) { if (c === '"') q = !q; else if (c === sep && !q) n++; }
    if (n > max) { max = n; melhor = sep; }
  }
  return melhor;
}
function lerCSV(txt, sep) {
  txt = String(txt || '').replace(/^﻿/, '');
  sep = sep || detectarSeparador(txt);
  const linhas = []; let campo = '', linha = [], q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; }
      else campo += c;
    } else if (c === '"' && campo === '') q = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && txt[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); if (linha.length > 1 || linha[0] !== '') linhas.push(linha); }
  return linhas;
}
function gerarCSV(linhas, sep = ';') {
  return linhas.map(l => l.map(v => {
    const s = v == null ? '' : String(v);
    return /[";\n\r,\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(sep)).join('\r\n');
}

/* ---------------- Retorno bancário: OFX e CNAB 240/400 ---------------- */
function lerOFX(txt) {
  const out = [];
  const blocos = String(txt || '').split(/<STMTTRN>/i).slice(1);
  for (const b0 of blocos) {
    const b = b0.split(/<\/STMTTRN>/i)[0];
    const tag = t => { const m = new RegExp('<' + t + '>([^<\\r\\n]*)', 'i').exec(b); return m ? m[1].trim() : ''; };
    const dt = tag('DTPOSTED');
    const data = /^\d{8}/.test(dt) ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '';
    const valor = lerValor(tag('TRNAMT').replace(/^\+/, ''));
    out.push({ data, valor, id: tag('FITID'), documento: tag('CHECKNUM') || tag('REFNUM'), descricao: [tag('NAME'), tag('MEMO')].filter(Boolean).join(' · '), tipo: tag('TRNTYPE') });
  }
  return out.filter(t => t.data && isFinite(t.valor));
}
function dataCnab(s) {
  s = String(s || '').trim();
  if (/^\d{8}$/.test(s) && s !== '00000000') { const iso = `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`; return isoValida(iso) ? iso : ''; }
  if (/^\d{6}$/.test(s) && s !== '000000') { const iso = `20${s.slice(4, 6)}-${s.slice(2, 4)}-${s.slice(0, 2)}`; return isoValida(iso) ? iso : ''; }
  return '';
}
const valCnab = s => (+String(s || '').replace(/\D/g, '') || 0) / 100;
const OCORR_LIQ_240 = ['06', '17'];
const OCORR_LIQ_400 = ['06', '07', '08', '15', '16', '17'];
function lerCNAB(txt) {
  const linhas = String(txt || '').split(/\r?\n/).map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (!linhas.length) return { formato: '', itens: [], avisos: ['arquivo vazio'] };
  const tam = Math.max(...linhas.map(l => l.length));
  const itens = [], avisos = [];
  if (tam >= 240 && tam < 390) {
    const banco = linhas[0].slice(0, 3);
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (l[7] !== '3' || l[13] !== 'T') continue;
      const u = linhas[i + 1] && linhas[i + 1][13] === 'U' ? linhas[i + 1] : '';
      const ocorr = l.slice(15, 17);
      const it = {
        ocorrencia: ocorr, liquidacao: OCORR_LIQ_240.includes(ocorr),
        nossoNumero: l.slice(37, 57).trim().replace(/^0+(?=\d)/, ''),
        documento: l.slice(58, 73).trim(), vencimento: dataCnab(l.slice(73, 81)),
        valorTitulo: valCnab(l.slice(81, 96)), seuNumero: l.slice(105, 130).trim(),
        pagador: l.slice(148, 188).trim(), banco
      };
      if (u) {
        it.juros = valCnab(u.slice(17, 32)); it.desconto = valCnab(u.slice(32, 47));
        it.valorPago = valCnab(u.slice(77, 92)); it.data = dataCnab(u.slice(137, 145)); it.dataCredito = dataCnab(u.slice(145, 153));
      }
      itens.push(it);
    }
    return { formato: 'CNAB 240', banco, itens, avisos };
  }
  if (tam >= 390) {
    const banco = (linhas[0].slice(76, 79) || '').trim();
    const nn = { '237': [70, 82], '341': [62, 70], '001': [63, 80], '033': [62, 70], '104': [56, 73], '756': [62, 74] }[banco] || [62, 82];
    if (!['237', '341'].includes(banco)) avisos.push('Layout CNAB 400 deste banco não foi validado; confira cada linha antes de aplicar.');
    for (const l of linhas) {
      if (l[0] !== '1') continue;
      const ocorr = l.slice(108, 110);
      itens.push({
        ocorrencia: ocorr, liquidacao: OCORR_LIQ_400.includes(ocorr),
        nossoNumero: l.slice(nn[0], nn[1]).trim().replace(/^0+(?=\d)/, ''),
        data: dataCnab(l.slice(110, 116)), documento: l.slice(116, 126).trim(),
        vencimento: dataCnab(l.slice(146, 152)), valorTitulo: valCnab(l.slice(152, 165)),
        desconto: valCnab(l.slice(240, 253)), valorPago: valCnab(l.slice(253, 266)), juros: valCnab(l.slice(266, 279)),
        dataCredito: dataCnab(l.slice(295, 301)), banco
      });
    }
    return { formato: 'CNAB 400', banco, itens, avisos };
  }
  return { formato: '', itens: [], avisos: ['não parece um arquivo CNAB 240 ou 400'] };
}
