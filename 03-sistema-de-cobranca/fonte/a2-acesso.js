/* =====================================================================
   2.2 ACESSO À PLANILHA — permissões em file://, pastas, backups, presença
   ---------------------------------------------------------------------
   O navegador só deixa gravar num arquivo depois que a pessoa autoriza.
   Ordem do que tentamos, do mais simples para o mais trabalhoso:
     1. requestPermission() no que já foi escolhido antes (um clique em
        "Permitir"). Em alguns PCs/versões isso dá SecurityError em file://;
        quando acontece, marcamos e nunca mais tentamos naquele PC.
     2. Modo PASTA: escolher a pasta da planilha (abre já nela) e
        "Permitir editar". Dá acesso a backup/ e ao arquivo de presença.
     3. Modo ARQUIVO (o que comprovadamente funciona em file://):
        abrir a planilha (leitura) e depois escolhê-la em "Salvar como"
        confirmando "Substituir". ATENÇÃO: o Chrome ESVAZIA o arquivo
        nessa hora; por isso o sistema relê a planilha e prepara o conteúdo
        ANTES de abrir a janela e grava imediatamente depois.
   ===================================================================== */
const TEM_FSA = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
const TEM_PASTA = typeof window.showDirectoryPicker === 'function';
const EH_HTTP = /^https?:$/.test(location.protocol);
const TIPOS_XLSX = [{ description: 'Planilha do Excel', accept: { [XLSX_MIME]: ['.xlsx'] } }];
const A = {
  modo: null, dir: null, arq: null, arqG: null, nome: '',
  podeLer: false, podeGravar: false,
  flags: lsJSON('bc2.flags', {}),
  rpNegadoNaSessao: false
};
const salvarFlags = () => lsSet('bc2.flags', JSON.stringify(A.flags));
function chaveArquivo() { return A.modo === 'navegador' ? 'navegador' : `${A.dir ? A.dir.name + '/' : ''}${A.nome}`; }
async function permissao(h, modo = 'readwrite') {
  if (!h) return 'prompt';
  if (!h.queryPermission) return 'granted';
  try { return await comTempo(h.queryPermission({ mode: modo }), 4000, 'consultar a permissão'); } catch (e) { diag('erro', 'queryPermission: ' + detalheErro(e)); return 'prompt'; }
}
async function lembrarAcesso() {
  lsSet('bc2.modo', A.modo || '');
  if (A.modo === 'navegador') return idbSet('acesso', { modo: 'navegador' });
  return idbSet('acesso', { modo: A.modo, dir: A.dir || null, arq: A.arqG || A.arq || null, nome: A.nome });
}
async function restaurarAcesso() {
  const a = await idbGet('acesso');
  if (!a || !a.modo) { if (lsGet('bc2.modo') === 'navegador') { A.modo = 'navegador'; return true; } return false; }
  A.modo = a.modo; A.dir = a.dir || null; A.arq = a.arq || null; A.arqG = null; A.nome = a.nome || (a.arq && a.arq.name) || '';
  return true;
}
/* Atualiza podeLer/podeGravar a partir das permissões atuais (sem perguntar nada) */
async function atualizarPermissoes() {
  if (A.modo === 'navegador') { A.podeLer = A.podeGravar = true; return; }
  if (A.modo === 'pasta' && A.dir) {
    const rw = await permissao(A.dir, 'readwrite');
    const r = rw === 'granted' ? 'granted' : await permissao(A.dir, 'read');
    A.podeLer = r === 'granted'; A.podeGravar = rw === 'granted';
    if (A.podeLer && A.nome) { try { A.arq = await comTempo(A.dir.getFileHandle(A.nome), 8000, 'achar a planilha na pasta'); A.arqG = A.podeGravar ? A.arq : null; } catch (e) { diag('erro', 'getFileHandle: ' + detalheErro(e)); A.podeLer = A.podeGravar = false; throw e; } }
    return;
  }
  const rw = await permissao(A.arqG || A.arq, 'readwrite');
  if (rw === 'granted') { A.arqG = A.arqG || A.arq; A.podeLer = A.podeGravar = true; return; }
  A.podeGravar = false;
  A.podeLer = (await permissao(A.arq, 'read')) === 'granted';
}

/* ---------------- leitura e escrita ---------------- */
async function metaArquivo() {
  if (A.modo === 'navegador') { const d = await idbGet('nav:dados'); return d ? { lastModified: d.lastModified, size: d.bytes.length } : { lastModified: 0, size: 0 }; }
  const f = await comTempo((A.arqG || A.arq).getFile(), 15000, 'ler as informações da planilha');
  return { lastModified: f.lastModified, size: f.size };
}
async function lerBytesArquivo() {
  if (A.modo === 'navegador') { const d = await idbGet('nav:dados'); return d ? { bytes: d.bytes, meta: { lastModified: d.lastModified, size: d.bytes.length } } : { bytes: null, meta: { lastModified: 0, size: 0 } }; }
  let ultimo;
  for (let i = 0; i < 3; i++) {
    try {
      const f = await comTempo((A.arqG || A.arq).getFile(), 15000, 'abrir a planilha');
      const buf = await comTempo(f.arrayBuffer(), 45000, 'ler a planilha');
      return { bytes: new Uint8Array(buf), meta: { lastModified: f.lastModified, size: f.size } };
    } catch (e) {
      ultimo = e;
      if (e.name !== 'NotReadableError') throw e;     // o arquivo mudou durante a leitura: tenta de novo
      await pausa(300 + Math.random() * 500);
    }
  }
  throw ultimo;
}
async function escreverBytes(bytes) {
  if (window.__teste && window.__teste.falharGravacao) { const n = window.__teste.falharGravacao; throw Object.assign(new Error('simulação de teste: ' + n), { name: n }); }
  if (window.__teste && window.__teste.atrasoGravacao) await pausa(window.__teste.atrasoGravacao);
  if (A.modo === 'navegador') {
    const lm = Date.now();
    if (!await idbSet('nav:dados', { bytes, lastModified: lm })) throw Object.assign(new Error('O navegador não deixou guardar os dados.'), { name: 'QuotaExceededError' });
    return { lastModified: lm, size: bytes.length };
  }
  const h = A.arqG;
  if (!h) throw Object.assign(new Error('sem permissão de gravar'), { name: 'SemPermissao' });
  let w;
  try {
    w = await comTempo(h.createWritable(), 30000, 'abrir a planilha para gravar');
    await comTempo(w.write(bytes), 60000, 'gravar a planilha');
    await comTempo(w.close(), 60000, 'terminar a gravação');
  } catch (e) {
    if (w) try { await w.abort(); } catch (_) {}
    throw e;
  }
  const f = await comTempo(h.getFile(), 15000, 'conferir a gravação');
  return { lastModified: f.lastModified, size: f.size };
}

/* ---------------- janelas do sistema operacional ---------------- */
async function janelaPasta(inicio) {
  const opc = { id: 'boletos-pasta', mode: 'readwrite' };
  if (inicio) opc.startIn = inicio;
  try { return await window.showDirectoryPicker(opc); }
  catch (e) { if (e.name === 'TypeError' && opc.startIn) { delete opc.startIn; return window.showDirectoryPicker(opc); } throw e; }
}
async function janelaAbrir(inicio) {
  const opc = { id: 'boletos-arquivo', types: TIPOS_XLSX, multiple: false };
  if (inicio) opc.startIn = inicio;
  try { return (await window.showOpenFilePicker(opc))[0]; }
  catch (e) { if (e.name === 'TypeError' && opc.startIn) { delete opc.startIn; return (await window.showOpenFilePicker(opc))[0]; } throw e; }
}
async function janelaSalvar(nome, inicio) {
  const opc = { id: 'boletos-arquivo', types: TIPOS_XLSX, excludeAcceptAllOption: true, suggestedName: nome || 'Boletos a cobrar.xlsx' };
  if (inicio) opc.startIn = inicio;
  try { return await window.showSaveFilePicker(opc); }
  catch (e) { if (e.name === 'TypeError' && opc.startIn) { delete opc.startIn; return window.showSaveFilePicker(opc); } throw e; }
}
/* Lista uma pasta com tempo-limite (pasta de rede lenta não pode travar nada) */
function itensDaPasta(dir, ms = 15000, oque = 'listar a pasta') {
  return comTempo((async () => { const out = []; for await (const par of dir.entries()) out.push(par); return out; })(), ms, oque);
}
async function planilhasDaPasta(dir) {
  const out = [];
  for (const [nome, h] of await itensDaPasta(dir, 20000, 'listar as planilhas da pasta')) if (h.kind === 'file' && /\.xlsx$/i.test(nome) && !/^~\$/.test(nome)) out.push(nome);
  return out.sort((a, b) => (/boleto/i.test(b) - /boleto/i.test(a)) || COLL.compare(a, b));
}

/* ---------------- backups ---------------- */
let _ultimoBackupVisto = 0;
async function gravarBackup(bytes, motivo, forcar) {
  if (!bytes || !bytes.length) return false;
  const quem = nomeSeguro(USUARIO()), nome = `${A.nome.replace(/\.xlsx$/i, '')} - ${carimboArquivo()} - ${nomeSeguro(motivo)} - ${quem}.xlsx`;
  if (A.modo === 'pasta' && A.podeGravar) {
    try {
      const pasta = await comTempo(A.dir.getDirectoryHandle('backup', { create: true }), 10000, 'abrir a pasta backup');
      if (!forcar && Date.now() - _ultimoBackupVisto < 55 * 60000) return false;
      if (!forcar) {      // backup de hora em hora: só se ninguém fez um na última hora
        let maisNovo = 0;
        for (const [n, h] of await itensDaPasta(pasta, 15000, 'listar os backups')) if (h.kind === 'file') { const m = /(\d{4})-(\d{2})-(\d{2}) (\d{2})h(\d{2})/.exec(n); if (m) maisNovo = Math.max(maisNovo, new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime()); }
        _ultimoBackupVisto = maisNovo;
        if (Date.now() - maisNovo < 55 * 60000) return false;
      }
      const fh = await comTempo(pasta.getFileHandle(nome, { create: true }), 10000, 'criar o backup');
      const w = await comTempo(fh.createWritable(), 20000, 'criar o backup');
      await comTempo(w.write(bytes), 60000, 'gravar o backup'); await comTempo(w.close(), 60000, 'terminar o backup');
      _ultimoBackupVisto = Date.now();
      diag('info', 'backup na pasta: ' + nome);
      await podarBackups(pasta);
      return true;
    } catch (e) { diag('erro', 'backup na pasta falhou: ' + detalheErro(e)); }
  }
  if (!forcar && Date.now() - _ultimoBackupVisto < 55 * 60000) return false;
  const lista = (await idbGet('backups:' + chaveArquivo())) || [];
  lista.push({ nome, quando: Date.now(), bytes });
  while (lista.length > 8) lista.shift();
  await idbSet('backups:' + chaveArquivo(), lista);
  _ultimoBackupVisto = Date.now();
  diag('info', 'backup no navegador: ' + nome);
  return true;
}
async function podarBackups(pasta) {
  const manter = Math.max(5, Math.round(numCfg(S.vista ? S.vista.config.backups : 30, 30)));
  const nomes = [];
  for (const [n, h] of await itensDaPasta(pasta, 15000, 'listar os backups')) if (h.kind === 'file' && /\.xlsx$/i.test(n) && /\d{4}-\d{2}-\d{2} \d{2}h\d{2}/.test(n)) nomes.push(n);
  nomes.sort((a, b) => (/(\d{4}-\d{2}-\d{2} \d{2}h\d{2})/.exec(a) || [''])[0].localeCompare((/(\d{4}-\d{2}-\d{2} \d{2}h\d{2})/.exec(b) || [''])[0]));
  for (const n of nomes.slice(0, Math.max(0, nomes.length - manter))) { try { await comTempo(pasta.removeEntry(n), 10000, 'apagar backup antigo'); } catch (e) { diag('erro', 'apagar backup antigo: ' + detalheErro(e)); } }
}
async function listarBackups() {
  const out = [];
  if (A.modo === 'pasta' && A.podeLer) {
    try {
      const pasta = await comTempo(A.dir.getDirectoryHandle('backup'), 8000, 'abrir backup');
      for (const [n, h] of await itensDaPasta(pasta, 15000, 'listar os backups')) if (h.kind === 'file') out.push({ nome: n, onde: 'pasta', h });
    } catch (e) { /* ainda não existe */ }
  }
  for (const b of (await idbGet('backups:' + chaveArquivo())) || []) out.push({ nome: b.nome, onde: 'navegador', bytes: b.bytes });
  return out.sort((a, b) => b.nome.localeCompare(a.nome));
}

/* ---------------- presença (quem está com o sistema aberto) ---------------- */
const PRESENCA_MIN = 6;
async function presencaPasta(escrever) {
  if (A.modo !== 'pasta' || !A.podeLer) return null;
  try {
    const pasta = await comTempo(A.dir.getDirectoryHandle('_sistema', { create: !!(escrever && A.podeGravar) }), 8000, 'abrir _sistema');
    if (escrever && A.podeGravar) {
      const fh = await comTempo(pasta.getFileHandle(`presenca - ${nomeSeguro(USUARIO())}.txt`, { create: true }), 8000, 'avisar presença');
      const w = await comTempo(fh.createWritable(), 8000, 'avisar presença');
      await comTempo(w.write(JSON.stringify({ nome: USUARIO(), ultimo: Date.now(), versao: VERSAO_APP, saiu: escrever === 'saiu' })), 8000, 'avisar presença');
      await comTempo(w.close(), 8000, 'avisar presença');
    }
    const out = [];
    for (const [n, h] of await itensDaPasta(pasta, 8000, 'ver quem está usando')) {
      if (h.kind !== 'file' || !/^presenca - /.test(n)) continue;
      try { const j = JSON.parse(await comTempo(h.getFile().then(f => f.text()), 5000, 'ver quem está usando')); if (!j.saiu && Date.now() - j.ultimo < PRESENCA_MIN * 60000) out.push(j.nome); } catch (e) {}
    }
    return out;
  } catch (e) { if (e.name !== 'NotFoundError') diag('erro', 'presença: ' + detalheErro(e)); return null; }
}
/* O Excel cria "~$Nome.xlsx" na pasta enquanto a planilha está aberta; dentro vem o nome de quem abriu */
async function excelAberto() {
  if (A.modo !== 'pasta' || !A.podeLer || !A.nome) return null;
  for (const n of ['~$' + A.nome, '~$' + A.nome.slice(2), '~$' + A.nome.slice(1)]) {
    try {
      const f = await comTempo(A.dir.getFileHandle(n).then(h => h.getFile()), 5000, 'ver se o Excel está com a planilha');
      const u8 = new Uint8Array(await comTempo(f.slice(0, 165).arrayBuffer(), 5000, 'ver se o Excel está com a planilha'));
      let nome = '';
      const n16 = u8[54] || 0;
      if (n16 && n16 < 54 && u8.length >= 55 + n16 * 2) nome = new TextDecoder('utf-16le').decode(u8.subarray(55, 55 + n16 * 2));
      if (!nome && u8[0]) nome = new TextDecoder('latin1').decode(u8.subarray(1, 1 + u8[0]));
      return { nome: nome.replace(/[\u0000-\u001f]/g, '').trim() || 'alguém', quando: f.lastModified };
    } catch (e) { /* não existe */ }
  }
  return null;
}
