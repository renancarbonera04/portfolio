/* =====================================================================
   2. APLICATIVO
   2.1 BASE — DOM, avisos, janelas, tempo limite, IndexedDB, diagnóstico
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const svg = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  check: svg('<path d="M20 6 9 17l-5-5"/>'), x: svg('<path d="M18 6 6 18M6 6l12 12"/>'), fone: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
  msg: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'), lixo: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>'),
  desfaz: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'), mais: svg('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'),
  copiar: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'), baixar: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  imprimir: svg('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
  colunas: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>'), editar: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>')
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const pausa = ms => new Promise(r => setTimeout(r, ms));
const quadro = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

/* Promessa com tempo limite: a tela nunca fica parada esperando uma pasta da rede ou o IndexedDB */
function comTempo(p, ms, oque = 'operação') {
  let t;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(t)),
    new Promise((_, falha) => { t = setTimeout(() => falha(Object.assign(new Error(`${oque} demorou mais de ${Math.round(ms / 1000)} s`), { name: 'Tempo' })), ms); })
  ]);
}

/* ---------- diagnóstico: últimas operações ---------- */
const DIAG = [];
function diag(tipo, msg) {
  const d = new Date();
  DIAG.push({ h: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, tipo, msg: String(msg).slice(0, 400) });
  if (DIAG.length > 200) DIAG.splice(0, DIAG.length - 200);
  if (tipo === 'erro') console.warn('[boletos]', msg);
}
const detalheErro = e => e ? `${e.name || 'Erro'}: ${e.message || e}`.slice(0, 300) : '';

/* ---------- armazenamento local ---------- */
const lsGet = (k, pad = null) => { try { const v = localStorage.getItem(k); return v == null ? pad : v; } catch (e) { return pad; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { diag('erro', 'localStorage: ' + detalheErro(e)); return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
const lsJSON = (k, pad) => { try { const v = JSON.parse(lsGet(k, 'null')); return v == null ? pad : v; } catch (e) { return pad; } };
let _db = null, _dbFalhouEm = 0;
function idb() {
  if (_db) return _db;
  // se acabou de falhar (ex.: IndexedDB travado), não espera de novo a cada chamada por 1 minuto
  if (Date.now() - _dbFalhouEm < 60000) return Promise.reject(Object.assign(new Error('armazenamento do navegador indisponível'), { name: 'Tempo' }));
  _db = comTempo(new Promise((ok, falha) => {
    const r = indexedDB.open('boletos-a-cobrar-v2', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
    r.onblocked = () => falha(new Error('IndexedDB bloqueado por outra aba'));
  }), 4000, 'abrir o armazenamento do navegador');
  _db.catch(() => { _db = null; _dbFalhouEm = Date.now(); });
  return _db;
}
async function idbGet(k) {
  try {
    const db = await idb();
    return await comTempo(new Promise((ok, falha) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => falha(q.error); }), 6000, 'ler do navegador');
  } catch (e) { diag('erro', 'IndexedDB get ' + k + ': ' + detalheErro(e)); return undefined; }
}
async function idbSet(k, v) {
  try {
    const db = await idb();
    await comTempo(new Promise((ok, falha) => {
      const t = db.transaction('kv', 'readwrite');
      if (v === undefined) t.objectStore('kv').delete(k); else t.objectStore('kv').put(v, k);
      t.oncomplete = ok; t.onerror = () => falha(t.error); t.onabort = () => falha(t.error);
    }), 8000, 'gravar no navegador');
    return true;
  } catch (e) { diag('erro', 'IndexedDB set ' + k + ': ' + detalheErro(e)); return false; }
}
async function idbChaves(prefixo) {
  try {
    const db = await idb();
    return await comTempo(new Promise((ok, falha) => { const q = db.transaction('kv').objectStore('kv').getAllKeys(IDBKeyRange.bound(prefixo, prefixo + '\uffff')); q.onsuccess = () => ok(q.result || []); q.onerror = () => falha(q.error); }), 6000, 'listar no navegador');
  } catch (e) { diag('erro', 'IndexedDB chaves ' + prefixo + ': ' + detalheErro(e)); return null; }
}

/* ---------- avisos (toast) com botão de ação ---------- */
function aviso(msg, opc = {}) {
  const box = $('#avisos');
  const t = document.createElement('div');
  t.className = 'toast' + (opc.erro ? ' erro' : opc.alerta ? ' aviso' : '');
  t.innerHTML = `<span></span>${opc.acao ? `<button type="button">${esc(opc.acao)}</button>` : ''}<button type="button" aria-label="Fechar">✕</button>`;
  t.querySelector('span').textContent = msg;
  const fechar = () => { t.remove(); };
  const bts = t.querySelectorAll('button');
  if (opc.acao) bts[0].onclick = () => { fechar(); opc.aoClicar && opc.aoClicar(); };
  bts[bts.length - 1].onclick = fechar;
  box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(fechar, opc.ms || (opc.erro ? 9000 : opc.acao ? 7000 : 3200));
  diag(opc.erro ? 'aviso-erro' : 'aviso', msg);
  return t;
}

/* ---------- janelas (formulários) ---------- */
let _janela = null;
function abrirJanela(html, opc = {}) {
  fecharJanela();
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="modal-box${opc.largo ? ' largo' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  $('#camada').appendChild(m);
  const anterior = document.activeElement;
  _janela = { el: m, aoFechar: opc.aoFechar, anterior };
  m.addEventListener('mousedown', e => { if (e.target === m && !opc.fixa) fecharJanela(); });
  setTimeout(() => { const f = m.querySelector('[autofocus]') || m.querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea,button.btn:not(.sec)'); if (f) f.focus(); }, 30);
  return m.firstElementChild;
}
function fecharJanela() {
  if (!_janela) return;
  const j = _janela; _janela = null;
  j.el.remove();
  if (j.aoFechar) j.aoFechar();
  if (j.anterior && document.contains(j.anterior)) try { j.anterior.focus(); } catch (e) {}
}
function confirmar(titulo, texto, rotuloSim = 'Confirmar', perigo = false) {
  return new Promise(res => {
    let ok = false;
    const box = abrirJanela(`<h3>${esc(titulo)}</h3><p>${esc(texto)}</p><div class="modal-acoes"><button type="button" class="btn sec" data-r="0">Voltar</button><button type="button" class="btn${perigo ? ' perigo' : ''}" data-r="1" autofocus>${esc(rotuloSim)}</button></div>`, { aoFechar: () => res(ok) });
    box.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; ok = b.dataset.r === '1'; fecharJanela(); });
  });
}
function pedirTexto(titulo, texto, valor = '', rotulo = 'OK') {
  return new Promise(res => {
    let v = null;
    const box = abrirJanela(`<h3>${esc(titulo)}</h3><p>${esc(texto)}</p><form><input id="jTexto" value="${esc(valor)}" autofocus><div class="modal-acoes"><button type="button" class="btn sec" data-r="0">Cancelar</button><button type="submit" class="btn">${esc(rotulo)}</button></div></form>`, { aoFechar: () => res(v) });
    box.querySelector('form').onsubmit = e => { e.preventDefault(); v = box.querySelector('#jTexto').value.trim(); fecharJanela(); };
    box.querySelector('[data-r="0"]').onclick = () => fecharJanela();
  });
}

/* ---------- arquivos: baixar, escolher, copiar ---------- */
function baixarArquivo(conteudo, nome, tipo = XLSX_MIME) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  diag('info', 'baixado: ' + nome);
}
function escolherArquivo(accept) {
  return new Promise(res => {
    const inp = $('#inputArquivo');
    inp.value = ''; inp.accept = accept || '';
    const fim = () => { inp.removeEventListener('change', ch); window.removeEventListener('focus', foco); };
    const ch = () => { fim(); res(inp.files[0] || null); };
    const foco = () => setTimeout(() => { if (!inp.files.length) { fim(); res(null); } }, 800);
    inp.addEventListener('change', ch);
    window.addEventListener('focus', foco);
    inp.click();
  });
}
async function copiarTexto(txt) {
  try { await navigator.clipboard.writeText(txt); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); return ok;
  }
}
const nomeSeguro = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 60) || 'sem nome';
function carimboArquivo(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}h${pad(d.getMinutes())}`; }
function horaCurta(d) { return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; }
function iniciais(n) { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function listaNomes(arr) { return arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1]; }
