/* =====================================================================
   NÚCLEO 4 — Operações e mesclagem (merge por ID) entre os 4 usuários
   ---------------------------------------------------------------------
   Cada mudança feita na tela vira uma OPERAÇÃO pequena, guardada no
   navegador até ser gravada. Para gravar: relê a planilha, aplica por
   cima dela só as operações pendentes (rebase) e grava o resultado.
   Assim, linhas e campos que outra pessoa mudou não são sobrescritos.
     cri: cria linha       { op:'cri', tab, linha }
     alt: altera campos    { op:'alt', tab, id, c:{campo:novo}, a:{campo:antes}, assin? }
     cfg: muda uma config  { op:'cfg', aba:'config'|'sistema', k, v, a }
   Toda operação leva ts (data/hora em número de série do Excel), u
   (usuário) e g (grupo = uma ação do usuário).
   ===================================================================== */
const META_CRIACAO = { boletos: ['criadoEm', 'criadoPor'], clientes: ['criadoEm', 'criadoPor'], pagamentos: ['registradoEm', 'registradoPor'], contatos: ['dataHora', 'registradoPor'], historico: ['dataHora', 'usuario'] };
/* Carimbo de criação: data/hora (com fração única por linha) + quem criou. Identifica a linha
   mesmo que o ID precise mudar, e evita duplicar uma criação gravada duas vezes. */
function carimbo(t, l) { const [a, b] = META_CRIACAO[t]; const ts = l[a]; return (typeof ts === 'number' ? String(fatia(ts)) : String(ts || '')) + '|' + (l[b] || ''); }
function assinatura(b) { return [b.vencimento || '', cent(b.valor), String(b.parcela || ''), docLimpo(b.doc), normCab(b.pdv)].join('|'); }
function clonarDoc(doc) {
  const tabs = {};
  for (const t of TABS) { const tb = doc.tabs[t]; tabs[t] = { ...tb, linhas: tb.linhas.slice() }; }
  return { ...doc, tabs, config: { ...doc.config }, sistema: { ...doc.sistema }, configExtra: doc.configExtra.slice(), avisos: [] };
}
const temMeta = t => !!ESQUEMA[t].porK.alteradoEm;
function remapNumeros(txt, mapa) {
  if (!mapa || !mapa.size || vazio(txt)) return txt;
  return String(txt).replace(/\d+/g, n => String(mapa.has(+n) ? mapa.get(+n) : n));
}
/* Aplica operações sobre um modelo (sem alterar o original). Devolve o novo modelo,
   os conflitos encontrados e os IDs que precisaram mudar (colisão entre usuários). */
function aplicarOps(base, ops, opc = {}) {
  const doc = clonarDoc(base);
  const idx = {}, maxId = {}, carimbos = {};
  for (const t of TABS) {
    const m = new Map(); let mx = 0;
    doc.tabs[t].linhas.forEach((l, i) => { m.set(l.id, i); if (l.id > mx) mx = l.id; });
    idx[t] = m; maxId[t] = mx;
  }
  const porCarimbo = t => {
    if (!carimbos[t]) { const m = new Map(); doc.tabs[t].linhas.forEach(l => m.set(carimbo(t, l), l.id)); carimbos[t] = m; }
    return carimbos[t];
  };
  let lancUsados = null;
  const usadosLanc = () => { if (!lancUsados) lancUsados = new Set(doc.tabs.boletos.linhas.map(b => b.lancamento).filter(Boolean)); return lancUsados; };
  let maxLanc = doc.tabs.boletos.linhas.reduce((m, b) => Math.max(m, b.lancamento || 0), 0);
  const remap = Object.fromEntries(TABS.map(t => [t, new Map()]));
  const lancRemap = new Map();
  const conflitos = [], aplicadas = [], ignoradas = [];
  for (const op0 of ops) {
    if (op0.op === 'cfg') {
      const alvo = op0.aba === 'sistema' ? doc.sistema : doc.config;
      if (op0.a !== undefined && !igual(alvo[op0.k], op0.a) && !igual(alvo[op0.k], op0.v) && op0.aba !== 'sistema')
        conflitos.push({ tipo: 'config', k: op0.k, meu: op0.v, deles: alvo[op0.k], ganhou: true });
      alvo[op0.k] = op0.v; aplicadas.push(op0);
      continue;
    }
    const t = op0.tab;
    if (!ESQUEMA[t]) { ignoradas.push(op0); continue; }
    const tab = doc.tabs[t];
    if (op0.op === 'cri') {
      const lin = { ...op0.linha };
      for (const k of ['boleto']) if (lin[k] && remap.boletos.has(lin[k])) lin[k] = remap.boletos.get(lin[k]);
      if (t === 'boletos' && lin.renegociadoDe) lin.renegociadoDe = remapNumeros(lin.renegociadoDe, remap.boletos);
      const ck = carimbo(t, lin);
      const jaTem = porCarimbo(t).get(ck);
      if (jaTem !== undefined) {               // já gravada antes (operação repetida): não duplica
        if (jaTem !== op0.linha.id) remap[t].set(op0.linha.id, jaTem);
        if (t === 'boletos' && lin.lancamento) { const b = tab.linhas[idx[t].get(jaTem)]; if (b && b.lancamento) lancRemap.set(op0.g + ':' + op0.linha.lancamento, b.lancamento); }
        aplicadas.push(op0); continue;
      }
      if (typeof lin.id !== 'number' || idx[t].has(lin.id)) { const novo = ++maxId[t]; remap[t].set(op0.linha.id, novo); lin.id = novo; }
      else if (lin.id > maxId[t]) maxId[t] = lin.id;
      if (t === 'boletos' && lin.lancamento) {
        const chave = op0.g + ':' + op0.linha.lancamento;
        if (lancRemap.has(chave)) lin.lancamento = lancRemap.get(chave);
        else {
          if (usadosLanc().has(lin.lancamento)) lin.lancamento = ++maxLanc;     // outro usuário usou o mesmo número
          else if (lin.lancamento > maxLanc) maxLanc = lin.lancamento;
          lancRemap.set(chave, lin.lancamento);
          usadosLanc().add(lin.lancamento);
        }
      }
      tab.linhas.push(lin); idx[t].set(lin.id, tab.linhas.length - 1); porCarimbo(t).set(ck, lin.id);
      aplicadas.push(op0);
      continue;
    }
    if (op0.op === 'alt') {
      let id = remap[t].has(op0.id) ? remap[t].get(op0.id) : op0.id;
      let i = idx[t].get(id);
      if (t === 'boletos' && op0.assin) {        // linha que ganhou ID na leitura (digitada no Excel) pode ter mudado de número
        const alvo = i !== undefined ? tab.linhas[i] : null;
        if (!alvo || (alvo._idNovo && assinatura(alvo) !== op0.assin)) {
          const achados = tab.linhas.filter(l => assinatura(l) === op0.assin);
          if (achados.length === 1) { id = achados[0].id; i = idx[t].get(id); }
        }
      }
      if (i === undefined) { conflitos.push({ tipo: 'sumiu', tab: t, id, op: op0 }); ignoradas.push(op0); continue; }
      const alvo = tab.linhas[i];
      const novo = { ...alvo }; let mudou = false;
      const tsRem = typeof alvo.alteradoEm === 'number' ? alvo.alteradoEm : 0;
      for (const k of Object.keys(op0.c)) {
        let v = op0.c[k];
        if (k === 'renegociadoPara' && v) v = remapNumeros(v, new Map([...lancRemap].filter(([c]) => c.startsWith(op0.g + ':')).map(([c, n]) => [+c.split(':')[1], n])));
        if (igual(alvo[k], v)) continue;
        if (op0.a && Object.prototype.hasOwnProperty.call(op0.a, k) && !igual(alvo[k], op0.a[k])) {
          if (depois(tsRem, op0.ts)) { conflitos.push({ tipo: 'perdeu', tab: t, id, campo: k, meu: v, deles: alvo[k], quem: alvo.alteradoPor || '' }); continue; }
          conflitos.push({ tipo: 'ganhou', tab: t, id, campo: k, meu: v, deles: alvo[k], quem: alvo.alteradoPor || '' });
        }
        novo[k] = v; mudou = true;
      }
      if (mudou) {
        if (temMeta(t) && !op0.semMeta) { if (!depois(tsRem, op0.ts)) { novo.alteradoEm = op0.ts; novo.alteradoPor = op0.u; } }
        tab.linhas[i] = novo;
      }
      aplicadas.push(op0);
      continue;
    }
    ignoradas.push(op0);
  }
  derivar(doc);
  return { doc, conflitos, aplicadas, ignoradas, remap, lancRemap };
}
/* Corrige os IDs das operações ainda pendentes depois de uma gravação que precisou renumerar */
function remapearOps(ops, remap, lancRemap) {
  const lmap = new Map([...(lancRemap || [])].map(([c, n]) => [+c.split(':')[1], n]));
  return ops.map(op => {
    if (op.op === 'alt' && remap[op.tab] && remap[op.tab].has(op.id)) return { ...op, id: remap[op.tab].get(op.id) };
    if (op.op === 'cri') {
      const linha = { ...op.linha }; let m = false;
      if (remap[op.tab] && remap[op.tab].has(linha.id)) { linha.id = remap[op.tab].get(linha.id); m = true; }
      if (linha.boleto && remap.boletos.has(linha.boleto)) { linha.boleto = remap.boletos.get(linha.boleto); m = true; }
      if (op.tab === 'boletos' && linha.lancamento && lancRemap && lancRemap.has(op.g + ':' + linha.lancamento)) { linha.lancamento = lancRemap.get(op.g + ':' + linha.lancamento); m = true; }
      return m ? { ...op, linha } : op;
    }
    return op;
  }).map(op => op.op === 'alt' && op.c.renegociadoPara && lmap.size ? { ...op, c: { ...op.c, renegociadoPara: remapNumeros(op.c.renegociadoPara, lmap) } } : op);
}
/* A operação (já gravada) continua valendo na planilha? Usado para detectar gravação
   simultânea que apagou a mudança de alguém: se o campo voltou exatamente ao valor
   antigo, a operação é refeita. */
function opPresente(doc, op) {
  if (op.op === 'cfg') { const alvo = op.aba === 'sistema' ? doc.sistema : doc.config; return op.aba === 'sistema' || !igual(alvo[op.k], op.a) || igual(op.v, op.a); }
  const tab = doc.tabs[op.tab]; if (!tab) return true;
  if (op.op === 'cri') { const ck = carimbo(op.tab, op.linha); return tab.linhas.some(l => carimbo(op.tab, l) === ck); }
  if (op.op === 'alt') {
    const l = tab.linhas.find(x => x.id === op.id);
    if (!l) return true;                               // linha sumiu: tratada à parte
    const tsLinha = typeof l.alteradoEm === 'number' ? l.alteradoEm : null;
    for (const k of Object.keys(op.c)) {
      if (!op.a || !Object.prototype.hasOwnProperty.call(op.a, k)) continue;
      if (igual(op.c[k], op.a[k]) || igual(l[k], op.c[k])) continue;
      if (igual(l[k], op.a[k])) return false;            // voltou ao valor antigo: alguém gravou por cima
      // Um terceiro valor: só vale se a linha foi alterada DEPOIS da minha mudança;
      // se a linha está mais velha que ela, minha mudança (mais recente) se perdeu.
      if (tsLinha !== null && depois(op.ts, tsLinha)) return false;
    }
    return true;
  }
  return true;
}
/* Proteção: se a planilha nova perdeu colunas ou abas inteiras do sistema
   (ex.: alguém gravou por cima com a V1 ou apagou uma aba), recupera os
   valores a partir da última leitura boa. Linhas apagadas viram aviso. */
function protegerPerdas(anterior, novo) {
  const avisos = [];
  if (!anterior) return { doc: novo, avisos, precisaGravar: false };
  let precisa = false;
  const doc = clonarDoc(novo);
  for (const t of TABS) {
    const ta = anterior.tabs[t], tn = doc.tabs[t];
    if ((ta.presente || ta.linhas.length) && ta.linhas.length && !tn.presente) {
      doc.tabs[t] = { ...ta, linhas: ta.linhas.slice(), presente: true };
      avisos.push({ tipo: 'abaRecuperada', tab: t, n: ta.linhas.length }); precisa = true; continue;
    }
    if (!tn.presente) continue;
    const temNovo = new Set(tn.ordem.filter(o => o.k).map(o => o.k));
    const perdidas = ta.ordem.filter(o => o.k && !temNovo.has(o.k) && !ESQUEMA[t].derivadas.has(o.k)).map(o => o.k);
    if (perdidas.length) {
      const porId = new Map(ta.linhas.map(l => [l.id, l]));
      let n = 0;
      tn.linhas = tn.linhas.map(l => {
        const a = porId.get(l.id); if (!a) return l;
        const ext = {}; let tem = false;
        for (const k of perdidas) if (!vazio(a[k]) && vazio(l[k])) { ext[k] = a[k]; tem = true; }
        if (tem) { n++; return { ...l, ...ext }; }
        return l;
      });
      tn.ordem = tn.ordem.concat(perdidas.map(k => ({ k })));
      avisos.push({ tipo: 'colunasRecuperadas', tab: t, colunas: perdidas.map(k => ESQUEMA[t].porK[k].h), linhas: n }); precisa = true;
    }
  }
  for (const k of Object.keys(anterior.config)) if (!doc.abaConfigPresente && anterior.abaConfigPresente) { doc.config[k] = anterior.config[k]; precisa = true; }
  if (!doc.abaConfigPresente && anterior.abaConfigPresente) { doc.abaConfigPresente = true; avisos.push({ tipo: 'configRecuperada' }); }
  if (precisa) derivar(doc);
  return { doc, avisos, precisaGravar: precisa };
}
/* Linhas que existiam e sumiram da planilha (apagadas direto no Excel) */
/* A linha (de uma leitura anterior) ainda está na planilha? Procura pelo mesmo ID com a mesma
   criação (quem + quando, com folga para arredondamentos) ou pelo carimbo de criação (se o ID
   mudou). Linhas antigas da V1 podem repetir a data de criação: aí só vale o ID. */
const _idxPres = new WeakMap();
function linhaPresente(doc, t, l, carimboRepetido) {
  const tab = doc.tabs[t];
  let ix = _idxPres.get(tab.linhas);
  if (!ix) { ix = { id: new Map(), ck: new Set() }; for (const r of tab.linhas) { ix.id.set(r.id, r); ix.ck.add(carimbo(t, r)); } _idxPres.set(tab.linhas, ix); }
  const [a, b] = META_CRIACAO[t], r = ix.id.get(l.id);
  if (r && (r[b] || '') === (l[b] || '') && (typeof r[a] === 'number' && typeof l[a] === 'number' ? Math.abs(r[a] - l[a]) < 1e-6 : String(r[a] || '') === String(l[a] || ''))) return true;
  return !carimboRepetido && ix.ck.has(carimbo(t, l));
}
function linhasSumidas(anterior, novo, tabs = ['boletos', 'clientes']) {
  const out = [];
  if (!anterior) return out;
  for (const t of tabs) {
    if (!novo.tabs[t].presente && !novo.tabs[t].linhas.length) continue;
    const repetidos = new Map();
    for (const l of anterior.tabs[t].linhas) { const c = carimbo(t, l); repetidos.set(c, (repetidos.get(c) || 0) + 1); }
    for (const l of anterior.tabs[t].linhas) {
      const repetido = repetidos.get(carimbo(t, l)) > 1;
      if (!l._idNovo && !linhaPresente(novo, t, l, repetido)) out.push({ tab: t, linha: l, repetido, chave: t + ':' + l.id + ':' + carimbo(t, l) });
    }
  }
  return out;
}
/* Desfazer: operações inversas, calculadas sobre a vista atual */
function inverterOps(vista, ops, ctx) {
  const inv = [];
  for (const op of ops.slice().reverse()) {
    if (op.op === 'alt') {
      const l = vista.tabs[op.tab].linhas.find(x => x.id === op.id);
      if (!l) continue;
      const c = {}, a = {};
      for (const k of Object.keys(op.c)) if (op.a && Object.prototype.hasOwnProperty.call(op.a, k) && igual(l[k], op.c[k])) { c[k] = op.a[k]; a[k] = op.c[k]; }
      if (Object.keys(c).length) inv.push({ op: 'alt', tab: op.tab, id: op.id, c, a, ts: ctx.ts, u: ctx.u, g: ctx.g });
    } else if (op.op === 'cri') {
      const ck = carimbo(op.tab, op.linha);
      const l = vista.tabs[op.tab].linhas.find(x => carimbo(op.tab, x) === ck);
      if (!l) continue;
      if (op.tab === 'boletos' || op.tab === 'clientes') {
        if (!l.excluidoEm) inv.push({ op: 'alt', tab: op.tab, id: l.id, c: { excluidoEm: ctx.ts, excluidoPor: ctx.u }, a: { excluidoEm: l.excluidoEm || '', excluidoPor: l.excluidoPor || '' }, ts: ctx.ts, u: ctx.u, g: ctx.g });
      } else if (op.tab === 'pagamentos') {
        if (!l.estornadoEm) inv.push({ op: 'alt', tab: 'pagamentos', id: l.id, c: { estornadoEm: ctx.ts, estornadoPor: ctx.u }, a: { estornadoEm: '', estornadoPor: '' }, ts: ctx.ts, u: ctx.u, g: ctx.g });
      } else if (op.tab === 'contatos') {
        if (!l.excluidoEm) inv.push({ op: 'alt', tab: 'contatos', id: l.id, c: { excluidoEm: ctx.ts }, a: { excluidoEm: '' }, ts: ctx.ts, u: ctx.u, g: ctx.g });
      }
    } else if (op.op === 'cfg') {
      const alvo = op.aba === 'sistema' ? vista.sistema : vista.config;
      if (igual(alvo[op.k], op.v)) inv.push({ op: 'cfg', aba: op.aba, k: op.k, v: op.a, a: op.v, ts: ctx.ts, u: ctx.u, g: ctx.g });
    }
  }
  return inv;
}
/* Migração V1 -> V2 (determinística: dois computadores chegam ao mesmo resultado).
   Mantém todas as linhas e colunas; cria o cadastro de clientes a partir dos boletos. */
function migrarV1(doc) {
  if (doc.esquema >= ESQUEMA_VERSAO) return doc;
  const d = clonarDoc(doc);
  const bol = d.tabs.boletos.linhas;
  if (!d.tabs.clientes.linhas.length) {
    const vistos = new Map(); let id = 0;
    for (const b of bol.slice().sort((x, y) => x.id - y.id)) {
      const k = docLimpo(b.doc) || ('pdv:' + normCab(b.pdv));
      if (k === 'pdv:' || vistos.has(k)) continue;
      vistos.set(k, true);
      d.tabs.clientes.linhas.push({ id: ++id, nome: b.cliente || b.pdv || '', setor: b.setor || '', pdv: b.pdv || '', doc: b.doc || '', criadoEm: typeof b.criadoEm === 'number' ? b.criadoEm : 0, criadoPor: 'Migração V1' });
    }
  }
  const setores = [...new Set(bol.map(b => b.setor).filter(Boolean))].sort((a, b) => COLL.compare(a, b));
  if (!d.config.setores && setores.length) d.config.setores = setores.join('; ');
  const ts = bol.reduce((m, b) => Math.max(m, typeof b.criadoEm === 'number' ? b.criadoEm : 0), 0);
  d.tabs.historico.linhas.push({ id: d.tabs.historico.linhas.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1, dataHora: ts, usuario: 'Sistema', acao: 'Planilha atualizada da V1 para a V2', boleto: '', detalhe: `${bol.length} boletos mantidos; criadas as abas Clientes, Pagamentos, Contatos, Histórico e Config.` });
  for (const t of TABS) d.tabs[t].presente = true;
  d.esquema = ESQUEMA_VERSAO; d.migrado = true;
  derivar(d);
  return d;
}
