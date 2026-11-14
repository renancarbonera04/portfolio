/* =====================================================================
   2.3 SINCRONIZAÇÃO — fila de gravação, releitura + merge, repetição,
   pendências guardadas no navegador, verificação depois de gravar
   ===================================================================== */
const USUARIO = () => lsGet('bc2.usuario', '') || 'Sem nome';
/* Quantas ações do usuário ainda não foram gravadas (uma ação pode gerar várias operações) */
const nPend = () => new Set(S.pend.filter(o => o.g !== 'presenca').map(o => o.g)).size;
const S = {
  base: null, meta: null, bytes: null, daCache: null, pend: [], conf: [], vista: null, ix: null,
  gravando: false, erro: null, tentativa: 0, timerTentativa: null, salvoEm: null, lidoEm: null,
  desfazer: [], refazer: [], sumidas: new Map(), precisaGravar: false, precisaMigrar: null, backupMotivo: null,
  presenca: [], excel: null, ultimaPresenca: 0, ultimoPoll: 0, conflitosVistos: new Set(), versao: 0,
  preparado: null, ilegivelDesde: 0, ultimoErroLeitura: ''
};
/* ---------- fila: uma operação de arquivo por vez neste navegador ---------- */
let _fila = Promise.resolve();
// Rede de segurança: cada tarefa tem no máximo 5 min; depois disso a fila segue (cada operação de
// arquivo já tem o seu próprio tempo-limite, então isso só vale para algo totalmente imprevisto).
function naFila(fn) { const p = _fila.then(() => comTempo(Promise.resolve().then(fn), 300000, 'tarefa de leitura/gravação')); _fila = p.catch(() => {}); return p; }

/* ---------- pendências (o que ainda não foi gravado) — sobrevivem ao F5 ---------- */
/* Pendências: cada ABA do navegador guarda as suas numa chave PRÓPRIA, em DOIS lugares:
   - localStorage ("bc2.pend:<planilha>#<aba>"): gravação imediata, sobrevive a F5/fechar na hora;
   - IndexedDB ("pend:<planilha>#<aba>"): consistente entre abas.
   Motivo (testado): com duas abas abertas em file://, o Chrome às vezes mantém o localStorage de
   cada aba separado e perde o de uma delas ao recarregar; o IndexedDB não tem esse problema, mas
   pode não terminar de gravar se a página fechar no mesmo instante. Ao ler, vale a cópia mais nova.
   Pendências de uma aba fechada (sem sinal de vida há 3 min) são "adotadas" pela próxima aba que
   abrir ou pela que já estiver aberta. */
const novoIdAba = () => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); try { sessionStorage.setItem('bc2.abaId', id); } catch (e) {} return id; };
let ABA_ID = (() => { try { return sessionStorage.getItem('bc2.abaId') || novoIdAba(); } catch (e) { return novoIdAba(); } })();
const ORFA_MS = 3 * 60000;
const sufixoPend = () => chaveArquivo() + '#';
const lsPend = id => 'bc2.pend:' + sufixoPend() + id, idbPend = id => 'pend:' + sufixoPend() + id;
function lerJSON(t) { try { return typeof t === 'string' ? JSON.parse(t) : (t || null); } catch (e) { return null; } }
const maisNova = (a, b) => !a ? b : !b ? a : ((b.quando || 0) > (a.quando || 0) ? b : a);
function gravarMinha() {
  const conf = S.conf.filter(c => c.ate > Date.now());
  if (!S.pend.length && !conf.length) { lsDel(lsPend(ABA_ID)); idbSet(idbPend(ABA_ID), undefined); return; }
  const txt = JSON.stringify({ quando: Date.now(), vivo: Date.now(), usuario: USUARIO(), ops: S.pend, conf });
  if (!lsSet(lsPend(ABA_ID), txt)) lsDel(lsPend(ABA_ID));        // localStorage cheio: fica só no IndexedDB
  idbSet(idbPend(ABA_ID), txt);
}
function salvarPend() { if (A.modo) gravarMinha(); }
/* Todas as entradas guardadas para esta planilha: { id: { e: entrada mais nova, naIdb } }.
   Uma cópia que só existe no localStorage e que outra aba já adotou (marca "pendFeito" no
   IndexedDB) é ignorada, para nunca aplicar de novo o que já foi gravado. */
async function entradasPend() {
  const out = {}, preLs = 'bc2.pend:' + sufixoPend(), preIdb = 'pend:' + sufixoPend();
  const ls = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(preLs)) ls[k.slice(preLs.length)] = lerJSON(lsGet(k)); } } catch (e) {}
  const chaves = await idbChaves(preIdb);
  const idbOk = chaves !== null;
  for (const k of chaves || []) { const id = String(k).slice(preIdb.length); const e = lerJSON(await idbGet(k)); if (e) out[id] = { e, naIdb: true }; }
  for (const [id, e] of Object.entries(ls)) {
    if (!e) continue;
    if (out[id]) { out[id].e = maisNova(out[id].e, e); continue; }
    const feito = idbOk ? await idbGet('pendFeito:' + sufixoPend() + id) : null;
    if (feito && feito >= (e.quando || 0)) continue;
    out[id] = { e, naIdb: false };
  }
  // formato antigo (uma chave só por planilha)
  const velhaLs = lerJSON(lsGet('bc2.pend:' + chaveArquivo())), velhaIdb = lerJSON(await idbGet('pend:' + chaveArquivo()));
  if (velhaLs || velhaIdb) out['(antiga)'] = { e: { ...maisNova(velhaLs, velhaIdb), vivo: 0 }, naIdb: true };
  return { out, idbOk };
}
/* Junta às desta aba as pendências de abas fechadas (sem repetir). Grava as minhas ANTES de
   apagar as outras, para nada se perder se o navegador fechar no meio. Cópias que só existem no
   localStorage só são adotadas ao abrir (quando a leitura do localStorage é confiável) ou se o
   IndexedDB não estiver funcionando. */
async function adotarOrfas(todas, aoAbrir) {
  const { out, idbOk } = todas || await entradasPend();
  const agora = Date.now(), lim = (window.__teste && window.__teste.orfaMs) || ORFA_MS;
  const orfas = Object.entries(out).filter(([id, x]) => id !== ABA_ID && agora - (x.e.vivo || x.e.quando || 0) >= lim && (x.naIdb || aoAbrir || !idbOk));
  if (!orfas.length) return 0;
  const vistas = new Set(S.pend.map(o => JSON.stringify(o))); let n = 0;
  for (const [, x] of orfas) {
    for (const o of x.e.ops || []) { const j = JSON.stringify(o); if (!vistas.has(j)) { vistas.add(j); S.pend.push(o); n++; } }
    for (const c of x.e.conf || []) if (c.ate > agora) S.conf.push(c);
  }
  gravarMinha();
  for (const [id, x] of orfas) {
    if (id === '(antiga)') { lsDel('bc2.pend:' + chaveArquivo()); idbSet('pend:' + chaveArquivo(), undefined); continue; }
    idbSet('pendFeito:' + sufixoPend() + id, x.e.quando || agora);
    lsDel(lsPend(id)); idbSet(idbPend(id), undefined);
  }
  if (n) diag('info', `${n} alteração(ões) guardada(s) por outra aba (já fechada) foram recuperadas`);
  return n;
}
async function carregarPend() {
  const todas = await entradasPend();
  const e = todas.out[ABA_ID] && todas.out[ABA_ID].e;
  S.pend = e && Array.isArray(e.ops) ? e.ops.slice() : [];
  // gravações dos últimos minutos ainda "a confirmar" (fechou o navegador logo depois de gravar)
  S.conf = (e && Array.isArray(e.conf) ? e.conf : []).filter(c => c.ate > Date.now());
  await adotarOrfas(todas, true);
  return S.pend;
}
/* Sinal de vida desta aba + adoção de pendências de abas fechadas enquanto esta continua aberta */
let _vidaRodando = false;
setInterval(async () => {
  if (!A.modo || !S.base || _vidaRodando) return;
  _vidaRodando = true;
  try {
    const todas = await entradasPend();
    if (await adotarOrfas(todas, false)) { recalcular(); agendarGravacao(300); return; }
    const tem = S.pend.length || S.conf.some(c => c.ate > Date.now()), e = todas.out[ABA_ID] && todas.out[ABA_ID].e;
    if (tem ? (!e || Date.now() - (e.vivo || 0) > 60000 || JSON.stringify(e.ops) !== JSON.stringify(S.pend)) : !!e) gravarMinha();
  } catch (e) { diag('erro', 'pendências entre abas: ' + detalheErro(e)); }
  finally { _vidaRodando = false; }
}, (window.__teste && window.__teste.vidaMs) || 20000);
/* Avisa (uma vez) se o sistema estiver aberto em outra aba deste navegador com a mesma planilha */
const _canal = (() => { try { return new BroadcastChannel('boletos-a-cobrar-v2'); } catch (e) { return null; } })();
if (_canal) {
  let avisou = false;
  _canal.onmessage = ev => {
    const m = ev.data || {};
    if (!A.modo || m.chave !== chaveArquivo()) return;
    if (m.tipo === 'ola') _canal.postMessage({ tipo: 'estou', chave: chaveArquivo(), aba: ABA_ID });
    // aba duplicada (o navegador copiou a identificação): esta, que acabou de abrir, ganha outra
    if (m.tipo === 'estou' && m.aba === ABA_ID) { const velho = ABA_ID; ABA_ID = novoIdAba(); diag('info', `aba duplicada: identificação ${velho} → ${ABA_ID}`); salvarPend(); }
    if (!avisou && (m.tipo === 'ola' || m.tipo === 'estou')) { avisou = true; aviso('O sistema também está aberto em outra aba deste navegador. Funciona, mas é melhor usar uma aba só.', { alerta: true, ms: 10000 }); }
  };
}
function anunciarAba() { try { if (_canal && A.modo) _canal.postMessage({ tipo: 'ola', chave: chaveArquivo(), aba: ABA_ID }); } catch (e) {} }

/* ---------- vista = planilha + minhas alterações pendentes ---------- */
function recalcular() {
  try { S.vista = S.pend.length ? aplicarOps(S.base, S.pend).doc : S.base; }
  catch (e) { diag('erro', 'recalcular: ' + detalheErro(e)); S.vista = S.base; }
  S.ix = indices(S.vista);
  for (const b of S.vista.tabs.boletos.linhas) if (!b._busca) b._busca = textoBusca(b);
  etapaInicial = etapas(S.vista)[0] || 'A cobrar';
  S.versao++;
  renderTudo();
}
/* Toda ação do usuário passa por aqui: vira operações, aparece na hora e é gravada em seguida */
function executar(rotulo, ops, opc = {}) {
  if (!ops || !ops.length) { if (!opc.silencioso) aviso('Nada mudou.'); return null; }
  S.pend.push(...ops);
  salvarPend();
  if (!opc.semDesfazer) { S.desfazer.push({ rotulo, ops }); if (S.desfazer.length > 40) S.desfazer.shift(); if (!opc.manterRefazer) S.refazer = []; }
  if (opc.backup) S.backupMotivo = opc.backup;
  recalcular();
  agendarGravacao(opc.imediato ? 0 : 120);
  if (!opc.silencioso) aviso(rotulo, { acao: opc.semDesfazer ? null : 'Desfazer', aoClicar: desfazer });
  diag('acao', `${rotulo} (${ops.length} operações)`);
  return ops;
}
function desfazer() {
  const e = S.desfazer.pop();
  if (!e) { aviso('Não há nada para desfazer.'); return; }
  const inv = inverterOps(S.vista, e.ops, novoCtx(USUARIO()));
  if (!inv.length) { aviso('Isso já tinha sido mudado de novo; nada para desfazer.'); return; }
  executar('Desfeito: ' + e.rotulo, inv, { semDesfazer: true, silencioso: true });
  S.refazer.push({ rotulo: e.rotulo, ops: inv });
  aviso('Desfeito: ' + e.rotulo, { acao: 'Refazer', aoClicar: refazer });
}
function refazer() {
  const e = S.refazer.pop();
  if (!e) { aviso('Não há nada para refazer.'); return; }
  const inv = inverterOps(S.vista, e.ops, novoCtx(USUARIO()));
  executar('Refeito: ' + e.rotulo, inv, { manterRefazer: true, silencioso: true });
  aviso('Refeito: ' + e.rotulo, { acao: 'Desfazer', aoClicar: desfazer });
}

/* ---------- gravação ---------- */
let _timerGravar = null;
function agendarGravacao(ms = 120) {
  clearTimeout(_timerGravar);
  _timerGravar = setTimeout(() => naFila(ciclo), ms);
}
function presencaVencida() { return A.modo === 'arquivo' && A.podeGravar && Date.now() - S.ultimaPresenca > 3 * 60000; }
async function lerRemoto(forcar) {
  const m = await metaArquivo();
  if (!forcar && S.meta && m.lastModified === S.meta.lastModified && m.size === S.meta.size) return null;
  const { bytes, meta } = await lerBytesArquivo();
  if (!bytes) return { doc: null, meta };
  const doc = await comTempo(lerPlanilha(bytes), 60000, 'interpretar a planilha');
  return { doc, meta, bytes };
}
/* Junta a planilha recém-lida com o que este navegador sabe */
function integrar(r) {
  let doc = r.doc;
  if (doc.esquema < ESQUEMA_VERSAO) { S.precisaMigrar = r.bytes; doc = migrarV1(doc); S.precisaGravar = true; diag('info', 'planilha da V1: será atualizada para a V2 (com backup)'); }
  const p = protegerPerdas(S.base && !S.daCache ? S.base : null, doc);
  doc = p.doc;
  if (p.precisaGravar) { S.precisaGravar = true; for (const a of p.avisos) aviso(textoAvisoPerda(a), { alerta: true, ms: 12000 }); }
  // Gravação simultânea que desfez uma alteração minha: refaz
  const agora = Date.now();
  S.conf = S.conf.filter(c => c.ate > agora);
  const refazerOps = S.conf.filter(c => !opPresente(doc, c.op)).map(c => c.op);
  if (refazerOps.length) {
    S.conf = S.conf.filter(c => !refazerOps.includes(c.op));
    S.pend = [...refazerOps, ...S.pend]; salvarPend();
    diag('aviso', `${refazerOps.length} alteração(ões) sobrescrita(s) por gravação simultânea: refeitas`);
    aviso('Outra pessoa gravou ao mesmo tempo e uma alteração sua ficou de fora; o sistema já está gravando de novo.', { alerta: true });
    agendarGravacao(200 + Math.random() * 600);
  }
  // Linhas apagadas direto no Excel: registra no Histórico (com os dados) depois de 90 s
  if (S.base && !S.daCache) for (const s of linhasSumidas(S.base, doc)) if (!S.sumidas.has(s.chave)) S.sumidas.set(s.chave, { ...s, desde: agora });
  for (const [k, s] of S.sumidas) {
    const ainda = !linhaPresente(doc, s.tab, s.linha, s.repetido);
    if (!ainda) S.sumidas.delete(k);
    else if (agora - s.desde > 90000) { S.sumidas.delete(k); registrarSumida(doc, s); }
  }
  S.base = doc; S.meta = r.meta; S.bytes = r.bytes || S.bytes; S.daCache = null; S.lidoEm = new Date(); S.ilegivelDesde = 0;
  if (r.bytes) idbSet('cache:' + chaveArquivo(), { bytes: r.bytes, meta: r.meta, quando: Date.now() });
  presencaDaPlanilha();
  recalcular();
}
function textoAvisoPerda(a) {
  if (a.tipo === 'abaRecuperada') return `A aba ${ESQUEMA[a.tab].aba} sumiu da planilha (alguém apagou ou gravou com uma versão antiga). Os dados dela foram recuperados e serão gravados de novo.`;
  if (a.tipo === 'colunasRecuperadas') return `As colunas ${a.colunas.join(', ')} sumiram da aba ${ESQUEMA[a.tab].aba}. Os valores foram recuperados (${a.linhas} linhas) e serão gravados de novo.`;
  return 'A aba Config sumiu da planilha; a configuração foi recuperada.';
}
function registrarSumida(doc, s) {
  const l = s.linha, t = s.tab;
  const det = t === 'boletos' ? `${descBoleto(l)} · ID ${l.id} · CNPJ/CPF ${l.doc || '—'} · Nº doc ${l.numDoc || '—'} · status ${l.status}` : `${l.nome || ''} ${l.doc || ''} · ID ${l.id}`;
  const acao = t === 'boletos' ? 'Linha apagada direto no Excel' : 'Cliente apagado direto no Excel';
  // outra pessoa com o sistema aberto também percebeu e já registrou: não repete
  if (doc.tabs.historico.linhas.some(h => h.acao === acao && String(h.detalhe || '').startsWith(det))) return;
  const ctx = novoCtx(USUARIO());
  const op = { op: 'cri', tab: 'historico', linha: { id: proximoId(doc, 'historico'), dataHora: marca(ctx), usuario: '(direto na planilha)', acao, boleto: t === 'boletos' ? l.id : '', detalhe: `${det} · percebido por ${ctx.u}` }, ts: ctx.ts, u: ctx.u, g: ctx.g };
  S.pend.push(op); salvarPend();
  diag('aviso', 'linha apagada fora do sistema registrada no Histórico: ' + det);
  agendarGravacao(500);
}
async function ciclo() {
  if (S.gravando) return;
  if (!A.modo || !S.base) return;
  if (!A.podeLer && !A.podeGravar) { renderSalvo(); return; }
  S.gravando = true; S.gravandoDesde = Date.now(); S.avisouDemora = false; renderSalvo();
  try {
    let ilegivel = null;
    for (let tent = 1; tent <= 8; tent++) {
      let r = null;
      try { r = await lerRemoto(false); ilegivel = null; }
      catch (e) {
        if (e.tipo === 'vazia' || e.tipo === 'corrompida') { ilegivel = e; marcarIlegivel(e); if (tent >= 4) break; await pausa(800 * tent + Math.random() * 700); continue; }
        throw e;
      }
      if (r && r.doc) integrar(r);
      else if (r && !r.doc && A.modo === 'navegador') S.precisaGravar = true;
      const presenca = presencaVencida();
      if (!S.pend.length && !S.precisaGravar && !presenca) { S.erro = null; S.tentativa = 0; return; }
      if (!A.podeGravar) throw Object.assign(new Error('sem permissão de gravar'), { name: 'SemPermissao' });
      if (S.precisaMigrar) { await gravarBackup(S.precisaMigrar, 'antes da atualizacao V2', true); if (A.modo !== 'pasta') baixarArquivo(S.precisaMigrar, `${A.nome.replace(/\.xlsx$/i, '')} - antes da V2 ${carimboArquivo()}.xlsx`); }
      else if (S.backupMotivo && S.bytes) await gravarBackup(S.bytes, S.backupMotivo, true);
      else if (S.bytes && A.modo !== 'navegador') await gravarBackup(S.bytes, 'automatico', false);
      const ops = S.pend.slice();
      const extra = presenca ? [{ op: 'cfg', aba: 'sistema', k: 'presenca:' + USUARIO(), v: agoraSerial(), ts: agoraSerial(), u: USUARIO(), g: 'presenca' }] : [];
      const r2 = aplicarOps(S.base, [...ops, ...extra]);
      const bytes = await gerarPlanilha(r2.doc);
      const m2 = await metaArquivo();
      if (S.meta && (m2.lastModified !== S.meta.lastModified || m2.size !== S.meta.size)) {
        diag('info', `planilha mudou entre a leitura e a gravação (tentativa ${tent}); relendo`);
        await pausa(Math.random() * 400 * tent + 100);
        continue;
      }
      const m3 = await escreverBytes(bytes);
      // Sucesso
      const resto = S.pend.slice(ops.length);
      const final = remapearOps(ops, r2.remap, r2.lancRemap);
      S.base = r2.doc; S.meta = m3; S.bytes = bytes; S.salvoEm = new Date(); S.erro = null; S.tentativa = 0; S.daCache = null;
      S.pend = remapearOps(resto, r2.remap, r2.lancRemap);
      for (const pilha of [S.desfazer, S.refazer]) for (const e of pilha) e.ops = remapearOps(e.ops, r2.remap, r2.lancRemap);
      S.conf.push(...final.map(op => ({ op, ate: Date.now() + 180000 })));
      if (presenca) S.ultimaPresenca = Date.now();
      S.precisaGravar = false; S.precisaMigrar = null; S.backupMotivo = null;
      salvarPend();
      idbSet('cache:' + chaveArquivo(), { bytes, meta: m3, quando: Date.now() });
      notificarConflitos(r2.conflitos);
      diag('gravou', `${ops.length} operações · ${(bytes.length / 1024).toFixed(0)} KB${tent > 1 ? ` · tentativa ${tent}` : ''}`);
      recalcular();
      if (S.pend.length) agendarGravacao(60);
      // Confere (lendo de novo) se ninguém gravou por cima logo depois; a leitura é forçada porque
      // a data do arquivo lida logo após gravar pode já ser a da gravação de outra pessoa.
      setTimeout(() => naFila(() => releitura(true)), 2500 + Math.random() * 2000);
      return;
    }
    if (ilegivel) throw ilegivel;          // planilha ilegível (corrompida/no meio de outra gravação): não grava por cima
    throw Object.assign(new Error('a planilha mudou muitas vezes seguidas'), { name: 'Concorrencia' });
  } catch (e) {
    tratarErroGravacao(e);
  } finally {
    S.gravando = false; renderSalvo();
  }
}
function marcarIlegivel(e) {
  if (!S.ilegivelDesde) S.ilegivelDesde = Date.now();
  S.ultimoErroLeitura = e.message;
  diag('erro', 'planilha ilegível agora: ' + e.message);
}
function notificarConflitos(lista) {
  for (const c of lista) {
    if (c.tipo === 'sumiu') { aviso(`Um boleto que você alterou (ID ${c.id}) não existe mais na planilha (foi apagado direto no Excel). A alteração foi descartada.`, { alerta: true, ms: 10000 }); continue; }
    if (c.tipo === 'config') { aviso(`A configuração "${(CONFIG_DEF.find(d => d[0] === c.k) || [, c.k])[1]}" foi mudada por outra pessoa ao mesmo tempo; ficou a sua.`, { alerta: true }); continue; }
    const k = `${c.tab}:${c.id}:${c.campo}:${c.tipo}`;
    if (S.conflitosVistos.has(k)) continue; S.conflitosVistos.add(k);
    const campo = (ESQUEMA[c.tab].porK[c.campo] || { h: c.campo }).h;
    aviso(c.tipo === 'perdeu'
      ? `${c.quem || 'Outra pessoa'} mudou "${campo}" do boleto ${c.id} depois de você; ficou a alteração dela (mais recente).`
      : `${c.quem || 'Outra pessoa'} tinha mudado "${campo}" do boleto ${c.id}; ficou a sua alteração (mais recente).`, { alerta: true, ms: 9000 });
  }
}
function classificarErro(e) {
  const n = e && e.name, m = (e && e.message) || '';
  if (n === 'SemPermissao') return 'semPermissao';
  if (e && e.tipo === 'protegida') return 'protegida';
  if (e && (e.tipo === 'vazia' || e.tipo === 'corrompida' || e.tipo === 'formato' || e.tipo === 'semBoletos')) return 'ilegivel';
  if (n === 'NotFoundError') return 'sumiu';
  if (n === 'QuotaExceededError') return 'disco';
  if (n === 'Tempo') return 'tempo';
  if (n === 'Concorrencia') return 'concorrencia';
  if (n === 'NotAllowedError' || n === 'SecurityError') return A.podeGravar ? 'ocupada' : 'semPermissao';
  if (n === 'NoModificationAllowedError' || n === 'InvalidModificationError' || n === 'NotReadableError' || n === 'InvalidStateError' || /lock|in use|being used|em uso|bloquead/i.test(m)) return 'ocupada';
  return 'outro';
}
async function tratarErroGravacao(e) {
  let tipo = classificarErro(e);
  if ((tipo === 'ocupada' || tipo === 'outro') && A.modo !== 'navegador') {
    const rw = await permissao(A.arqG || A.dir, 'readwrite');
    if (rw !== 'granted') { tipo = 'semPermissao'; A.podeGravar = false; }
  }
  if (tipo === 'semPermissao') A.podeGravar = false;
  let excel = null;
  if (tipo === 'ocupada') excel = await excelAberto().catch(() => null);
  const n = nPend();
  const guardadas = n ? ` ${plural(n, 'alteração guardada', 'alterações guardadas')} neste navegador, sem perder nada.` : '';
  const msg = {
    semPermissao: `Falta liberar a gravação na planilha.${guardadas}`,
    ocupada: (excel ? `A planilha está aberta no Excel${excel.nome && excel.nome !== 'alguém' ? ' por ' + excel.nome : ''}. Feche o Excel ou aguarde: o sistema tenta de novo sozinho.${guardadas}` : `A planilha está ocupada (provavelmente aberta no Excel por alguém). Feche-a ou aguarde: o sistema tenta de novo sozinho.${guardadas}`) +
      (S.tentativa >= 4 && !excel ? ' Se ninguém está com ela aberta, pode ser que a pasta não deixe gravar (peça ao TI permissão de gravação na pasta).' : ''),
    tempo: `A pasta da rede está demorando para responder. O sistema tenta de novo sozinho.${guardadas}`,
    sumiu: `Não achei a planilha "${A.nome}" (foi movida, renomeada ou a rede caiu?). O sistema tenta de novo; se continuar, use "Trocar de planilha".${guardadas}`,
    disco: `Não há espaço para gravar a planilha.${guardadas}`,
    concorrencia: `Muitas pessoas gravando ao mesmo tempo; tentando de novo em instantes.${guardadas}`,
    ilegivel: `A planilha não pôde ser lida agora (${(e && e.message) || ''}). Se alguém está gravando, isso passa sozinho.${guardadas}`,
    protegida: e && e.message,
    outro: `Não consegui gravar na planilha (${detalheErro(e)}). O sistema tenta de novo sozinho.${guardadas}`
  }[tipo];
  S.erro = { tipo, msg, tecnico: detalheErro(e), quando: new Date(), excel };
  diag('erro', `gravação: ${tipo} · ${detalheErro(e)}`);
  if (tipo === 'semPermissao' || tipo === 'protegida') { renderFaixas(); renderSalvo(); return; }
  S.tentativa++;
  const espera = Math.min(60000, 2000 * Math.pow(2, Math.min(S.tentativa - 1, 5))) + Math.random() * 1500;
  S.erro.proxima = Date.now() + espera;
  clearTimeout(S.timerTentativa);
  S.timerTentativa = setTimeout(() => agendarGravacao(0), espera);
  renderFaixas(); renderSalvo();
}
/* Releitura (a cada poucos segundos, ao voltar para a janela ou quando pedida) */
async function releitura(forcar) {
  if (!A.modo || !A.podeLer || S.gravando) return false;
  try {
    const r = await lerRemoto(forcar);
    S.ultimoPoll = Date.now();
    if (r && r.doc) { integrar(r); if (S.pend.length || S.precisaGravar) agendarGravacao(100); return true; }
    if (S.erro && S.erro.tipo === 'sumiu') { S.erro = null; renderFaixas(); renderSalvo(); }
    return false;
  } catch (e) {
    S.ultimoPoll = Date.now();
    if (e.tipo === 'vazia' || e.tipo === 'corrompida') { marcarIlegivel(e); renderFaixas(); return false; }
    if (e.tipo === 'protegida') { S.erro = { tipo: 'protegida', msg: e.message, tecnico: detalheErro(e) }; renderFaixas(); renderSalvo(); return false; }
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') { A.podeLer = false; A.podeGravar = false; renderFaixas(); renderSalvo(); }
    if (e.name === 'NotFoundError') { S.erro = { tipo: 'sumiu', msg: `Não achei a planilha "${A.nome}" agora (rede fora do ar, ou foi movida/renomeada). Tentando de novo…`, tecnico: detalheErro(e) }; renderSalvo(); }
    diag('erro', 'releitura: ' + detalheErro(e));
    return false;
  }
}
function intervaloAtualizacao() { return Math.max(2, numCfg(S.vista ? S.vista.config.intervalo : 5, 5)) * 1000; }
setInterval(() => {
  if (S.gravando && !S.avisouDemora && Date.now() - S.gravandoDesde > 150000) {
    S.avisouDemora = true; diag('aviso', 'gravação demorando mais de 2,5 min');
    aviso('A gravação está demorando muito (rede lenta?). Suas alterações estão guardadas neste navegador. Se continuar assim, recarregue a página (F5).', { alerta: true, ms: 15000 });
  }
  if (!A.modo || A.modo === 'navegador' || !A.podeLer || S.gravando) return;
  const iv = document.hidden ? Math.max(30000, intervaloAtualizacao()) : intervaloAtualizacao();
  if (Date.now() - S.ultimoPoll >= iv) { S.ultimoPoll = Date.now(); naFila(() => releitura(false)); }
  if (A.modo === 'pasta' && Date.now() - S.ultimaPresenca > 30000) { S.ultimaPresenca = Date.now(); naFila(atualizarPresencaPasta); }
  if (presencaVencida() && !S.pend.length) agendarGravacao(0);
}, 1000);
window.addEventListener('focus', () => { if (A.podeLer && A.modo !== 'navegador') { S.ultimoPoll = Date.now(); naFila(() => releitura(false)); } });
async function atualizarPresencaPasta() {
  const l = await presencaPasta(true);
  if (l) S.presenca = l.filter(n => semAcento(n) !== semAcento(USUARIO()));
  S.excel = await excelAberto().catch(() => null);
  renderPresenca();
}
function presencaDaPlanilha() {
  if (A.modo !== 'arquivo' || !S.base) return;
  const agora = agoraSerial(), l = [];
  for (const [k, v] of Object.entries(S.base.sistema)) {
    if (!k.startsWith('presenca:')) continue;
    const nome = k.slice(9);
    if (typeof v === 'number' && (agora - v) * 1440 < PRESENCA_MIN && semAcento(nome) !== semAcento(USUARIO())) l.push(nome);
  }
  S.presenca = l;
  renderPresenca();
}
window.addEventListener('pagehide', () => { try { salvarPend(); } catch (e) {} if (A.modo === 'pasta' && A.podeGravar) presencaPasta('saiu'); });
window.addEventListener('beforeunload', e => { if (S.pend.length && A.modo !== 'navegador') { e.preventDefault(); e.returnValue = ''; } });

/* =====================================================================
   LIBERAR A GRAVAÇÃO (um botão grande; depois disso, nenhuma pergunta)
   ===================================================================== */
async function liberar() {
  if (!TEM_FSA) { aviso('Este navegador não grava direto em arquivo. Use o Edge ou o Chrome atualizados.', { erro: true }); return; }
  diag('info', `liberar: modo=${A.modo} ler=${A.podeLer} gravar=${A.podeGravar} flags=${JSON.stringify(A.flags)}`);
  const h = A.modo === 'pasta' ? A.dir : (A.arqG || A.arq);
  // 1) Permissão direta (um clique em "Permitir") — se este computador aceitar
  if (h && h.requestPermission && (EH_HTTP || !A.flags.rpFalha) && !A.rpNegadoNaSessao) {
    let r;
    try { r = await comTempo(h.requestPermission({ mode: 'readwrite' }), 180000, 'a resposta da pergunta de permissão'); }
    catch (e) {
      diag('erro', 'requestPermission: ' + detalheErro(e));
      if (e.name === 'Tempo') { aviso('A pergunta de permissão ficou sem resposta. Clique de novo em "Liberar".', { alerta: true }); return; }
      if (e.name === 'SecurityError' || e.name === 'NotAllowedError' || e.name === 'TypeError') { A.flags.rpFalha = true; salvarFlags(); }
    }
    if (r === 'granted') { await aposPermissao(); return; }
    if (r === 'denied' || r === 'prompt') { A.rpNegadoNaSessao = true; aviso('O navegador não liberou. Clique de novo em "Liberar" para escolher a planilha pela janela do Windows.', { alerta: true, ms: 9000 }); renderFaixas(); return; }
  }
  // 2) Janelas do Windows
  if (A.modo === 'pasta' && A.flags.dirFalha) { A.modo = 'arquivo'; A.arqG = null; }
  const porPasta = A.modo === 'pasta';
  try {
    if (porPasta) await liberarPorPasta();
    else await liberarPorArquivo();
  } catch (e) {
    if (e.name === 'AbortError') { diag('info', 'janela cancelada'); return; }
    diag('erro', 'liberar: ' + detalheErro(e));
    if (e.name === 'SecurityError' && /gesture|activation|ativa/i.test(e.message)) { aviso('Clique de novo em "Liberar" (o navegador pediu mais um clique).', { alerta: true }); return; }
    if (porPasta && (e.name === 'SecurityError' || e.name === 'NotAllowedError')) {
      A.flags.dirFalha = true; salvarFlags();
      aviso('Este computador não deixa liberar pela pasta. Clique de novo em "Liberar": o sistema vai pedir para escolher a planilha.', { alerta: true, ms: 12000 });
      return;
    }
    aviso(msgErroAcesso(e), { erro: true, ms: 12000 });
  } finally { renderFaixas(); renderSalvo(); }
}
function msgErroAcesso(e) {
  const n = e && e.name;
  if (n === 'NotFoundError') return `Não achei a planilha "${A.nome}" nessa pasta. Confira se escolheu a pasta certa (a que tem a planilha do time).`;
  if (n === 'SecurityError' || n === 'NotAllowedError') return 'O navegador bloqueou o acesso (pode ser regra da empresa ou uma pasta do sistema, como a Área de Trabalho). Escolha a pasta da rede onde a planilha fica. Se continuar, use "Guardar neste navegador".';
  if (n === 'Tempo') return 'A pasta da rede demorou demais para responder. Confira a conexão e tente de novo.';
  if (e && e.tipo) return e.message;
  return 'Não foi possível abrir a planilha: ' + detalheErro(e);
}
async function aposPermissao() {
  await atualizarPermissoes();
  await lembrarAcesso();
  if (A.podeLer) await naFila(() => releitura(true).catch(e => { throw e; }));
  if (A.podeGravar) { S.erro = null; aviso('Gravação liberada. A partir de agora tudo é gravado sozinho.'); agendarGravacao(0); }
  renderFaixas(); renderSalvo();
}
async function liberarPorPasta() {
  const d2 = await janelaPasta(A.dir || undefined);
  let mesma = false; try { mesma = A.dir ? await d2.isSameEntry(A.dir) : true; } catch (e) {}
  const rw = await permissao(d2, 'readwrite');
  if (!mesma) {
    let tem = false; try { await comTempo(d2.getFileHandle(A.nome), 10000, 'achar a planilha na pasta'); tem = true; } catch (e) {}
    if (!tem) throw Object.assign(new Error(`A pasta "${d2.name}" não tem a planilha "${A.nome}". Escolha a pasta onde ela está (ou use "Trocar de planilha").`), { tipo: 'outraPasta' });
  }
  A.dir = d2;
  if (rw !== 'granted') {          // a pasta só deu leitura neste computador: passa para o modo arquivo
    A.flags.dirFalha = true; salvarFlags();
    A.modo = 'arquivo'; A.arq = await comTempo(d2.getFileHandle(A.nome), 10000, 'achar a planilha na pasta'); A.arqG = null; A.podeLer = true; A.podeGravar = false;
    await lembrarAcesso();
    await naFila(() => releitura(true));
    aviso('Este computador não deixa gravar pela pasta. Falta um passo: clique em "Liberar a gravação" e confirme "Substituir".', { alerta: true, ms: 12000 });
    return;
  }
  await aposPermissao();
}
async function liberarPorArquivo() {
  if (!A.podeLer) {
    const h = await janelaAbrir(A.arq || A.dir || undefined);
    if (A.nome && h.name !== A.nome) {
      const ok = await confirmar('Usar esta planilha?', `Você escolheu "${h.name}", mas a planilha usada até agora era "${A.nome}". Usar "${h.name}" daqui para frente?`, 'Usar esta');
      if (!ok) return;
      S.pend.length && salvarPend();
    }
    A.arq = h; A.nome = h.name; A.arqG = null;
    await atualizarPermissoes();
    A.podeLer = true;
    await lembrarAcesso();
    if (!S.base || !A.arqG) S.meta = null;
    await naFila(() => releitura(true));
    if (A.podeGravar) { aviso('Gravação liberada.'); agendarGravacao(0); return; }
    if (A.flags.rpFalha || EH_HTTP) aviso('Pronto, você já vê os dados atuais. Falta liberar a gravação: clique no botão e confirme "Substituir" (é seguro: o sistema regrava a planilha na hora com tudo).', { ms: 10000 });
    renderFaixas();
    return;
  }
  await gravarPorSubstituir();
}
/* Passo do "Salvar como → Substituir". O Chrome esvazia o arquivo escolhido nessa hora;
   por isso relemos e preparamos o conteúdo completo ANTES e gravamos logo DEPOIS. */
async function prepararSubstituicao() {
  const r = await lerRemoto(false).catch(e => { if (e.tipo === 'vazia') return null; throw e; });
  if (r && r.doc) integrar(r);
  if (!S.base) throw new Error('A planilha ainda não foi lida.');
  const ops = S.pend.slice();
  const r2 = aplicarOps(S.base, ops);
  const bytes = await gerarPlanilha(r2.doc);
  S.preparado = { bytes, ops, r2, meta: S.meta, versao: S.versao };
  return S.preparado;
}
async function gravarPorSubstituir() {
  // Usa o conteúdo preparado (se ainda vale) para abrir a janela logo após o clique
  let prep = S.preparado;
  const m = await metaArquivo().catch(() => null);
  if (!prep || prep.versao !== S.versao || !m || !S.meta || m.lastModified !== prep.meta.lastModified || m.size !== prep.meta.size) prep = await prepararSubstituicao();
  const original = A.arq;
  const h = await janelaSalvar(A.nome, A.arq || A.dir || undefined);
  let mesma = false; try { mesma = await h.isSameEntry(original); } catch (e) {}
  // gravar já (o arquivo escolhido acabou de ser esvaziado pelo navegador)
  let w;
  try { w = await comTempo(h.createWritable(), 30000, 'abrir a planilha para gravar'); await comTempo(w.write(prep.bytes), 60000, 'gravar a planilha'); await comTempo(w.close(), 60000, 'terminar a gravação'); }
  catch (e) { if (w) try { await w.abort(); } catch (_) {} baixarArquivo(prep.bytes, `${A.nome.replace(/\.xlsx$/i, '')} - copia de seguranca ${carimboArquivo()}.xlsx`); throw Object.assign(new Error('A gravação falhou logo depois de "Substituir" (' + detalheErro(e) + '). Uma cópia completa foi baixada na pasta Downloads. Tente "Liberar" de novo.'), { tipo: 'pos' }); }
  if (!mesma) {
    aviso(`Você escolheu "${h.name}", que não é a planilha que estava aberta ("${A.nome}"). Os boletos foram gravados nesse arquivo, mas o sistema continua usando "${A.nome}". Clique em Liberar e escolha "${A.nome}".`, { erro: true, ms: 15000 });
    return;
  }
  A.arqG = h; A.arq = h; A.podeGravar = true; A.podeLer = true;
  const f = await comTempo(h.getFile(), 15000, 'conferir a planilha gravada').catch(() => ({ lastModified: 0, size: prep.bytes.length }));
  const resto = S.pend.slice(prep.ops.length);
  S.base = prep.r2.doc; S.meta = { lastModified: f.lastModified, size: f.size }; S.bytes = prep.bytes; S.salvoEm = new Date(); S.erro = null;
  S.pend = remapearOps(resto, prep.r2.remap, prep.r2.lancRemap);
  S.conf.push(...remapearOps(prep.ops, prep.r2.remap, prep.r2.lancRemap).map(op => ({ op, ate: Date.now() + 180000 })));
  salvarPend(); S.preparado = null;
  await lembrarAcesso();
  idbSet('cache:' + chaveArquivo(), { bytes: prep.bytes, meta: S.meta, quando: Date.now() });
  diag('gravou', 'liberado por "Substituir" e gravado');
  aviso('Gravação liberada. A partir de agora tudo é gravado sozinho.');
  recalcular();
  if (S.pend.length) agendarGravacao(0);
}
/* Mantém o conteúdo pronto enquanto o botão "Liberar a gravação" está na tela */
const prepararEmSegundoPlano = debounce(() => {
  if (A.modo === 'arquivo' && A.podeLer && !A.podeGravar && !S.gravando) naFila(() => prepararSubstituicao().catch(e => diag('erro', 'preparar: ' + detalheErro(e))));
}, 700);
