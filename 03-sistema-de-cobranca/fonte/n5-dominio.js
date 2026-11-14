/* =====================================================================
   NÚCLEO 5 — Regras do negócio: lançar, editar, baixar, estornar,
   contato, renegociar, lixeira, cliente, conciliação, importação,
   verificação da planilha, indicadores e relatórios.
   Todas produzem operações (ou números) a partir da "vista" atual.
   ===================================================================== */
let _seqGrupo = 0;
/* Próxima fatia de tempo livre neste navegador: nunca repete, mesmo com várias ações no mesmo
   milissegundo ou um lançamento de muitas parcelas (cada linha ganha a sua). */
let _ultimaFatia = 0;
function fatiaLivre(ts) { const f = Math.max(fatia(ts), _ultimaFatia + 1); _ultimaFatia = f; return f / 1e7; }
function novoCtx(usuario, agora = new Date()) {
  return { ts: fatiaLivre(agoraSerial(agora)), u: usuario || 'Sem nome', g: Date.now().toString(36) + '-' + (++_seqGrupo).toString(36) + Math.random().toString(36).slice(2, 6), hoje: hojeLocal(agora) };
}
/* Data/hora de criação única por linha (fatias de ~8,6 ms), para o carimbo de criação */
function marca(ctx) { return fatiaLivre(ctx.ts); }
function proximoId(vista, t, usados) { let m = vista.tabs[t].linhas.reduce((x, l) => Math.max(x, l.id || 0), 0); if (usados) m = Math.max(m, ...usados); return m + 1; }
function proximoLanc(vista) { return vista.tabs.boletos.linhas.reduce((x, b) => Math.max(x, b.lancamento || 0), 0) + 1; }
const cfgNum = (vista, k) => numCfg(vista.config[k], numCfg(CONFIG_PADRAO[k], 0));
const etapas = vista => { const l = listaCfg(vista.config.etapas); return l.length ? l : listaCfg(CONFIG_PADRAO.etapas); };
function histOp(vista, ctx, acao, boleto, detalhe, usados) {
  const id = proximoId(vista, 'historico', usados.historico); usados.historico.push(id);
  return { op: 'cri', tab: 'historico', linha: { id, dataHora: marca(ctx), usuario: ctx.u, acao, boleto: boleto || '', detalhe: detalhe || '' }, ts: ctx.ts, u: ctx.u, g: ctx.g };
}
const novosUsados = () => Object.fromEntries(TABS.map(t => [t, []]));
const descBoleto = b => [b.pdv, b.cliente].filter(Boolean).join(' · ') + ` · parcela ${b.parcela || '—'} · ${fmtBRL(b.valor)} · venc. ${fmtData(b.vencimento)}`;
function altOp(t, linha, campos, ctx, extra = {}) {
  const c = {}, a = {};
  for (const [k, v] of Object.entries(campos)) if (!igual(linha[k], v)) { c[k] = v; a[k] = vazio(linha[k]) ? '' : linha[k]; }
  if (!Object.keys(c).length) return null;
  const op = { op: 'alt', tab: t, id: linha.id, c, a, ts: ctx.ts, u: ctx.u, g: ctx.g, ...extra };
  if (t === 'boletos') op.assin = assinatura(linha);
  return op;
}

/* ---------------- Índices da vista ---------------- */
function indices(vista) {
  const boletoPorId = new Map(), pagPorBoleto = new Map(), contPorBoleto = new Map(), porLanc = new Map(), clientePorDoc = new Map(), clientePorPdv = new Map(), clientePorId = new Map();
  for (const b of vista.tabs.boletos.linhas) {
    boletoPorId.set(b.id, b);
    if (b.lancamento) { if (!porLanc.has(b.lancamento)) porLanc.set(b.lancamento, []); porLanc.get(b.lancamento).push(b); }
  }
  for (const p of vista.tabs.pagamentos.linhas) { if (!pagPorBoleto.has(p.boleto)) pagPorBoleto.set(p.boleto, []); pagPorBoleto.get(p.boleto).push(p); }
  for (const c of vista.tabs.contatos.linhas) { if (c.excluidoEm) continue; if (!contPorBoleto.has(c.boleto)) contPorBoleto.set(c.boleto, []); contPorBoleto.get(c.boleto).push(c); }
  for (const c of vista.tabs.clientes.linhas) {
    clientePorId.set(c.id, c);
    if (c.excluidoEm) continue;
    const d = docLimpo(c.doc); if (d && !clientePorDoc.has(d)) clientePorDoc.set(d, c);
    const p = normCab(c.pdv); if (p && !clientePorPdv.has(p)) clientePorPdv.set(p, c);
  }
  for (const arr of porLanc.values()) arr.sort((a, b) => ((lerParcela(a.parcela) || {}).n || 0) - ((lerParcela(b.parcela) || {}).n || 0) || (a.vencimento || '').localeCompare(b.vencimento || ''));
  for (const arr of contPorBoleto.values()) arr.sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0));
  return { boletoPorId, pagPorBoleto, contPorBoleto, porLanc, clientePorDoc, clientePorPdv, clientePorId };
}
function clienteDoBoleto(ix, b) { return (docLimpo(b.doc) && ix.clientePorDoc.get(docLimpo(b.doc))) || (normCab(b.pdv) && ix.clientePorPdv.get(normCab(b.pdv))) || null; }

/* ---------------- Situação, indicadores, agenda ---------------- */
const ativo = b => !b.excluidoEm;
const emAberto = b => !b.excluidoEm && b.status === 'Em aberto';
function situacao(b, hoje, diasAlerta = 7) {
  if (b.excluidoEm) return { cls: 'lixeira', txt: 'Na lixeira' };
  if (b.status === 'Pago') return { cls: 'pago', txt: b.pagoEm ? 'Pago em ' + fmtDataCurta(b.pagoEm) : 'Pago' };
  if (b.status === 'Cancelado') return { cls: 'cancelado', txt: 'Cancelado' };
  if (b.status === 'Renegociado') return { cls: 'cancelado', txt: 'Renegociado' };
  if (!b.vencimento || !isoValida(b.vencimento)) return { cls: 'futuro', txt: 'Sem vencimento' };
  const d = difDias(b.vencimento, hoje);
  const parcial = typeof b.saldo === 'number' && typeof b.valor === 'number' && b.saldo < b.valor - 0.004 ? ' · parcial' : '';
  if (d < 0) return { cls: 'vencido', txt: `Vencido há ${plural(-d, 'dia')}` + parcial, dias: -d };
  if (d === 0) return { cls: 'hoje', txt: 'Vence hoje' + parcial };
  if (d === 1) return { cls: 'breve', txt: 'Vence amanhã' + parcial };
  if (d <= diasAlerta) return { cls: 'breve', txt: `Vence em ${d} dias` + parcial };
  return { cls: 'futuro', txt: `Em ${d} dias` + parcial };
}
const saldoDe = b => typeof b.saldo === 'number' ? b.saldo : (b.status === 'Em aberto' && typeof b.valor === 'number' ? b.valor : 0);
function kpis(vista, hoje) {
  const dias = cfgNum(vista, 'diasAlerta') || 7;
  const ab = vista.tabs.boletos.linhas.filter(emAberto);
  const venc = ab.filter(b => b.vencimento && b.vencimento < hoje);
  const hj = ab.filter(b => b.vencimento === hoje);
  const prox = ab.filter(b => b.vencimento > hoje && difDias(b.vencimento, hoje) <= dias);
  const mes = ab.filter(b => b.vencimento && b.vencimento.slice(0, 7) === hoje.slice(0, 7));
  const s = arr => ({ valor: somaCent(arr, saldoDe), qtd: arr.length });
  const recMes = vista.tabs.pagamentos.linhas.filter(p => !p.estornadoEm && p.data && p.data.slice(0, 7) === hoje.slice(0, 7));
  return { vencidos: s(venc), hoje: s(hj), proximos: s(prox), mes: s(mes), aberto: s(ab), recebidoMes: { valor: somaCent(recMes, p => p.valor), qtd: recMes.length }, diasAlerta: dias };
}
function aging(boletos, hoje) {
  const out = Object.fromEntries(FAIXAS.map(f => [f.k, { ...f, valor: 0, qtd: 0 }]));
  for (const b of boletos) { if (!emAberto(b)) continue; const k = faixaAtraso(b.vencimento, hoje); out[k].valor = arred2(out[k].valor + saldoDe(b)); out[k].qtd++; }
  return FAIXAS.map(f => out[f.k]);
}
/* Agenda priorizada do dia */
function agendaHoje(vista, hoje, opc = {}) {
  const ontem = somaDias(hoje, -1);
  const meus = b => !opc.usuario || !opc.soMeus || semAcento(b.responsavel) === semAcento(opc.usuario);
  const ab = vista.tabs.boletos.linhas.filter(b => emAberto(b) && meus(b));
  const grupos = [
    { k: 'quebradas', rot: 'Promessas quebradas', dica: 'A data prometida passou e o boleto continua em aberto.', cls: 'perigo', itens: ab.filter(b => b.promessaEm && b.promessaEm < hoje) },
    { k: 'acoes', rot: 'Ações agendadas para hoje', dica: 'Próxima ação marcada para hoje (ou atrasada).', cls: 'acao', itens: ab.filter(b => b.proxAcaoEm && b.proxAcaoEm <= hoje) },
    { k: 'promessasHoje', rot: 'Promessas que vencem hoje', dica: 'O cliente prometeu pagar hoje.', cls: 'promessa', itens: ab.filter(b => b.promessaEm === hoje) },
    { k: 'venceHoje', rot: 'Vencem hoje', dica: '', cls: 'hoje', itens: ab.filter(b => b.vencimento === hoje) },
    { k: 'venceuOntem', rot: diaSemana(hoje) === 1 ? 'Venceram no fim de semana ou na sexta' : 'Venceu ontem', dica: 'Primeiro contato de cobrança.', cls: 'vencido',
      itens: ab.filter(b => b.vencimento && (b.vencimento === ontem || (diaSemana(hoje) === 1 && b.vencimento >= somaDias(hoje, -3) && b.vencimento < hoje)) && !(b.promessaEm >= hoje)) },
    { k: 'semAcao', rot: 'Vencidos sem próxima ação marcada', dica: 'Atrasados que ninguém agendou para cobrar. Registre um contato ou marque a próxima ação.', cls: '',
      itens: ab.filter(b => b.vencimento && b.vencimento < hoje && !(b.proxAcaoEm >= hoje) && !(b.promessaEm >= hoje)) }
  ];
  const vistos = new Set();
  for (const g of grupos) {
    g.itens = g.itens.filter(b => { if (vistos.has(b.id)) return false; vistos.add(b.id); return true; })
      .sort((a, b) => saldoDe(b) - saldoDe(a));
    g.total = somaCent(g.itens, saldoDe);
  }
  return grupos;
}

/* ---------------- Filtros e ordenação da lista ---------------- */
function textoBusca(b) { return semAcento([b.cliente, b.pdv, b.setor, b.doc, docLimpo(b.doc), b.numDoc, b.nossoNumero, b.obs, b.parcela, '#' + b.lancamento, 'id' + b.id, b.responsavel, b.etapa].join(' ')); }
function passaFiltro(b, f, hoje, dias) {
  if (f.lancamento != null) return b.lancamento === f.lancamento && !b.excluidoEm;
  if (f.ids) return f.ids.has(b.id);
  const lix = !!b.excluidoEm;
  if (f.status === 'lixeira') { if (!lix) return false; }
  else if (lix) return false;
  const aberto = b.status === 'Em aberto';
  const d = b.vencimento && isoValida(b.vencimento) ? difDias(b.vencimento, hoje) : null;
  const ok = {
    aberto, vencido: aberto && d !== null && d < 0, hoje: aberto && d === 0, semana: aberto && d !== null && d >= 0 && d <= dias,
    mes: aberto && !!b.vencimento && b.vencimento.slice(0, 7) === hoje.slice(0, 7),
    pago: b.status === 'Pago', cancelado: b.status === 'Cancelado' || b.status === 'Renegociado', todos: true, lixeira: true,
    promessa: aberto && !!b.promessaEm, quebrada: aberto && !!b.promessaEm && b.promessaEm < hoje
  }[f.status || 'aberto'];
  if (!ok) return false;
  if (f.setor && (b.setor || '') !== f.setor) return false;
  if (f.etapa && (b.etapa || etapaInicial) !== f.etapa) return false;
  if (f.responsavel === '__meus') { if (semAcento(b.responsavel) !== semAcento(f.usuario)) return false; }
  else if (f.responsavel === '__ninguem') { if (b.responsavel) return false; }
  else if (f.responsavel && semAcento(b.responsavel) !== semAcento(f.responsavel)) return false;
  if (f.faixa && (!aberto || faixaAtraso(b.vencimento, hoje) !== f.faixa)) return false;
  if (f.de && (!b.vencimento || b.vencimento < f.de)) return false;
  if (f.ate && (!b.vencimento || b.vencimento > f.ate)) return false;
  if (f.dia && b.vencimento !== f.dia) return false;
  if (f.busca) { const alvo = b._busca || textoBusca(b); if (!f.busca.split(/\s+/).every(t => alvo.includes(t))) return false; }
  return true;
}
let etapaInicial = 'A cobrar';
const ORDENS = {
  vencimento: (a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'),
  valor: (a, b) => (Number(a.valor) || 0) - (Number(b.valor) || 0),
  saldo: (a, b) => saldoDe(a) - saldoDe(b),
  cliente: (a, b) => COLL.compare(a.cliente || a.pdv || '', b.cliente || b.pdv || ''),
  pdv: (a, b) => COLL.compare(a.pdv || '', b.pdv || ''),
  setor: (a, b) => COLL.compare(a.setor || '', b.setor || ''),
  status: (a, b) => COLL.compare(a.status || '', b.status || ''),
  etapa: (a, b) => COLL.compare(a.etapa || '', b.etapa || ''),
  responsavel: (a, b) => COLL.compare(a.responsavel || '', b.responsavel || ''),
  parcela: (a, b) => ((lerParcela(a.parcela) || {}).n || 0) - ((lerParcela(b.parcela) || {}).n || 0),
  id: (a, b) => a.id - b.id, lancamento: (a, b) => (a.lancamento || 0) - (b.lancamento || 0),
  numDoc: (a, b) => COLL.compare(a.numDoc || '', b.numDoc || ''), doc: (a, b) => COLL.compare(a.doc || '', b.doc || ''),
  promessaEm: (a, b) => (a.promessaEm || '9999').localeCompare(b.promessaEm || '9999'),
  proxAcaoEm: (a, b) => (a.proxAcaoEm || '9999').localeCompare(b.proxAcaoEm || '9999'),
  pagoEm: (a, b) => (a.pagoEm || '').localeCompare(b.pagoEm || ''),
  alteradoEm: (a, b) => (a.alteradoEm || 0) - (b.alteradoEm || 0), criadoEm: (a, b) => (a.criadoEm || 0) - (b.criadoEm || 0)
};
function ordenarBoletos(arr, campo = 'vencimento', desc = false) {
  const f = ORDENS[campo] || ORDENS.vencimento;
  return arr.sort((a, b) => (desc ? -f(a, b) : f(a, b)) || ORDENS.vencimento(a, b) || COLL.compare(a.setor || '', b.setor || '') || COLL.compare(a.pdv || '', b.pdv || '') || ORDENS.parcela(a, b) || a.id - b.id);
}

/* ---------------- Lançar ---------------- */
function possiveisRepetidos(vista, doc, parcelas, numDoc) {
  const d = docLimpo(doc);
  return vista.tabs.boletos.linhas.filter(b => !b.excluidoEm && b.status !== 'Cancelado' && docLimpo(b.doc) === d &&
    parcelas.some(p => p.venc === b.vencimento && cent(p.valor) === cent(b.valor)) && (!numDoc || !b.numDoc || b.numDoc === numDoc));
}
function opsLancamento(vista, dados, ctx) {
  const ops = [], usados = novosUsados();
  const lanc = proximoLanc(vista);
  let id = proximoId(vista, 'boletos') - 1;
  const doc = dados.doc ? formatarDoc(dados.doc) : '';
  const ini = etapas(vista)[0] || '';
  for (const p of dados.parcelas) {
    id++;
    ops.push({ op: 'cri', tab: 'boletos', linha: {
      id, lancamento: lanc, vencimento: p.venc, status: 'Em aberto', valor: arred2(p.valor), parcela: `${p.numero}/${p.total}`,
      setor: dados.setor || '', pdv: dados.pdv || '', cliente: dados.cliente || '', doc, numDoc: p.numDoc || dados.numDoc || '',
      nossoNumero: p.nossoNumero || dados.nossoNumero || '', linhaDigitavel: p.linhaDigitavel || dados.linhaDigitavel || '',
      obs: dados.obs || '', responsavel: dados.responsavel || '', etapa: ini, renegociadoDe: dados.renegociadoDe || '',
      criadoEm: marca(ctx), criadoPor: ctx.u, alteradoEm: ctx.ts, alteradoPor: ctx.u
    }, ts: ctx.ts, u: ctx.u, g: ctx.g });
    ops.push(histOp(vista, ctx, dados.acaoHist || 'Lançou boleto', id, `${dados.pdv || ''} ${dados.cliente || ''} · parcela ${p.numero}/${p.total} · ${fmtBRL(p.valor)} · venc. ${fmtData(p.venc)}`.trim(), usados));
  }
  if (dados.criarCliente !== false && (doc || dados.pdv)) {
    const ix = indices(vista);
    const existe = (docLimpo(doc) && ix.clientePorDoc.get(docLimpo(doc))) || (!docLimpo(doc) && dados.pdv && ix.clientePorPdv.get(normCab(dados.pdv)));
    if (!existe) {
      const cid = proximoId(vista, 'clientes');
      ops.push({ op: 'cri', tab: 'clientes', linha: { id: cid, nome: dados.cliente || dados.pdv || '', setor: dados.setor || '', pdv: dados.pdv || '', doc, responsavel: dados.responsavel || '', criadoEm: marca(ctx), criadoPor: ctx.u, alteradoEm: ctx.ts, alteradoPor: ctx.u }, ts: ctx.ts, u: ctx.u, g: ctx.g });
      ops.clienteCriado = dados.cliente || dados.pdv;
    }
  }
  ops.lancamento = lanc;
  return ops;
}
/* Editar um boleto; com "proximos", copia os campos para as parcelas seguintes em aberto
   do mesmo lançamento (vencimento: desloca pela mesma diferença de dias). */
const CAMPOS_EDITAVEIS = ['vencimento', 'valor', 'parcela', 'setor', 'pdv', 'cliente', 'doc', 'numDoc', 'nossoNumero', 'linhaDigitavel', 'obs', 'etapa', 'promessaEm', 'proxAcao', 'proxAcaoEm', 'responsavel', 'status', 'pagoEm', 'formaPagamento'];
function opsEditar(vista, id, campos, ctx, opc = {}) {
  const ix = indices(vista), b = ix.boletoPorId.get(id);
  if (!b) return [];
  const ops = [], usados = novosUsados();
  const limpos = {};
  for (const [k, v] of Object.entries(campos)) if (CAMPOS_EDITAVEIS.includes(k)) limpos[k] = k === 'doc' && v ? formatarDoc(v) : (k === 'valor' ? arred2(v) : v);
  const op = altOp('boletos', b, limpos, ctx);
  if (op) { ops.push(op); ops.push(histOp(vista, ctx, 'Editou boleto', b.id, Object.keys(op.c).map(k => `${ESQUEMA.boletos.porK[k].h}: ${fmtCampo(k, op.a[k])} → ${fmtCampo(k, op.c[k])}`).join('; '), usados)); }
  if (opc.proximos && b.lancamento) {
    const pb = lerParcela(b.parcela);
    const delta = limpos.vencimento && b.vencimento && isoValida(limpos.vencimento) ? difDias(limpos.vencimento, b.vencimento) : 0;
    const seguintes = (ix.porLanc.get(b.lancamento) || []).filter(x => x.id !== b.id && !x.excluidoEm && x.status === 'Em aberto' &&
      (pb && lerParcela(x.parcela) ? lerParcela(x.parcela).n > pb.n : (x.vencimento || '') > (b.vencimento || '')));
    for (const x of seguintes) {
      const c = {};
      for (const [k, v] of Object.entries(limpos)) {
        if (k === 'vencimento') { if (delta && x.vencimento) c.vencimento = somaDias(x.vencimento, delta); }
        else if (k === 'parcela' || k === 'status' || k === 'pagoEm' || k === 'promessaEm' || k === 'proxAcaoEm' || k === 'proxAcao' || k === 'numDoc' || k === 'nossoNumero' || k === 'linhaDigitavel') continue;
        else c[k] = v;
      }
      const o = altOp('boletos', x, c, ctx);
      if (o) { ops.push(o); ops.push(histOp(vista, ctx, 'Editou boleto (este e os próximos)', x.id, Object.keys(o.c).map(k => `${ESQUEMA.boletos.porK[k].h}: ${fmtCampo(k, o.a[k])} → ${fmtCampo(k, o.c[k])}`).join('; '), usados)); }
    }
  }
  return ops;
}
function fmtCampo(k, v) {
  if (vazio(v)) return '(vazio)';
  const col = ESQUEMA.boletos.porK[k];
  if (col && col.tipo === 'data') return fmtData(v);
  if (col && col.tipo === 'moeda') return fmtBRL(v);
  if (col && col.tipo === 'datahora') return serialParaTexto(v);
  return String(v);
}
function opsStatus(vista, ids, status, ctx, acao) {
  const ix = indices(vista), ops = [], usados = novosUsados();
  for (const id of ids) {
    const b = ix.boletoPorId.get(id); if (!b) continue;
    const c = { status };
    if (status === 'Em aberto') c.pagoEm = '';
    const o = altOp('boletos', b, c, ctx);
    if (o) { ops.push(o); ops.push(histOp(vista, ctx, acao || `Status: ${status}`, b.id, descBoleto(b), usados)); }
  }
  return ops;
}
function opsLixeira(vista, t, ids, ctx, restaurar) {
  const ops = [], usados = novosUsados();
  const porId = new Map(vista.tabs[t].linhas.map(l => [l.id, l]));
  for (const id of ids) {
    const l = porId.get(id); if (!l) continue;
    const o = altOp(t, l, restaurar ? { excluidoEm: '', excluidoPor: '' } : { excluidoEm: ctx.ts, excluidoPor: ctx.u }, ctx);
    if (o) { ops.push(o); ops.push(histOp(vista, ctx, (restaurar ? 'Restaurou da lixeira' : 'Pôs na lixeira') + (t === 'clientes' ? ' (cliente)' : ''), t === 'boletos' ? id : '', t === 'boletos' ? descBoleto(l) : `${l.nome || ''} ${l.doc || ''}`.trim(), usados)); }
  }
  return ops;
}

/* ---------------- Pagamentos ---------------- */
function opsPagamento(vista, id, pag, ctx, usados = novosUsados()) {
  const ix = indices(vista), b = ix.boletoPorId.get(id);
  if (!b || b.excluidoEm) return [];
  const ops = [];
  const pid = proximoId(vista, 'pagamentos', usados.pagamentos); usados.pagamentos.push(pid);
  const valor = arred2(pag.valor), desconto = arred2(pag.desconto || 0), juros = arred2(pag.juros || 0);
  const abat = arred2(valor - juros + desconto);
  const saldoAntes = saldoDe(b);
  const quita = cent(saldoAntes) - cent(abat) <= 0 || pag.quitar;
  ops.push({ op: 'cri', tab: 'pagamentos', linha: { id: pid, boleto: b.id, data: pag.data, valor, desconto, juros, forma: pag.forma || '', origem: pag.origem || 'Manual', obs: pag.obs || '', cliente: b.cliente || b.pdv || '', parcela: b.parcela || '', registradoEm: marca(ctx), registradoPor: ctx.u }, ts: ctx.ts, u: ctx.u, g: ctx.g });
  const c = { formaPagamento: pag.forma || b.formaPagamento || '' };
  if (quita) { c.status = 'Pago'; c.pagoEm = pag.data; c.promessaEm = ''; c.proxAcao = ''; c.proxAcaoEm = ''; }
  const o = altOp('boletos', b, c, ctx); if (o) ops.push(o);
  ops.push(histOp(vista, ctx, quita ? 'Baixa (pago)' : 'Pagamento parcial', b.id, `${fmtBRL(valor)} em ${fmtData(pag.data)}${pag.forma ? ' · ' + pag.forma : ''}${juros ? ' · juros/multa ' + fmtBRL(juros) : ''}${desconto ? ' · desconto ' + fmtBRL(desconto) : ''}${quita ? '' : ' · saldo ' + fmtBRL(Math.max(0, saldoAntes - abat))}${pag.origem && pag.origem !== 'Manual' ? ' · ' + pag.origem : ''}`, usados));
  return ops;
}
/* Baixa em lote: cada boleto selecionado é quitado pelo saldo */
function opsBaixaLote(vista, ids, { data, forma, comEncargos }, ctx) {
  const ix = indices(vista), ops = [], usados = novosUsados();
  let vistaAtual = vista;
  for (const id of ids) {
    const b = ix.boletoPorId.get(id); if (!emAberto(b || {})) continue;
    const s = saldoDe(b);
    let juros = 0;
    if (comEncargos) { const at = valorAtualizado(s, b.vencimento, data, cfgNum(vista, 'multa'), cfgNum(vista, 'juros')); juros = arred2(at.multa + at.juros); }
    const o = opsPagamento(vistaAtual, id, { data, valor: arred2(s + juros), juros, forma, origem: 'Baixa em lote', quitar: true }, ctx, usados);
    ops.push(...o);
  }
  return ops;
}
/* Estorno (reversão de baixa): marca o pagamento como estornado e reabre o boleto se precisar */
function opsEstorno(vista, pagIds, ctx, motivo) {
  const ix = indices(vista), ops = [], usados = novosUsados();
  const porId = new Map(vista.tabs.pagamentos.linhas.map(p => [p.id, p]));
  const afetados = new Map();
  for (const pid of pagIds) {
    const p = porId.get(pid); if (!p || p.estornadoEm) continue;
    ops.push({ op: 'alt', tab: 'pagamentos', id: p.id, c: { estornadoEm: ctx.ts, estornadoPor: ctx.u }, a: { estornadoEm: '', estornadoPor: '' }, ts: ctx.ts, u: ctx.u, g: ctx.g });
    afetados.set(p.boleto, (afetados.get(p.boleto) || 0) + cent(p.abatido != null ? p.abatido : abatidoPag(p)));
    ops.push(histOp(vista, ctx, 'Estornou pagamento', p.boleto, `${fmtBRL(p.valor)} de ${fmtData(p.data)}${motivo ? ' · ' + motivo : ''}`, usados));
  }
  for (const [bid, abat] of afetados) {
    const b = ix.boletoPorId.get(bid); if (!b) continue;
    const restante = (ix.pagPorBoleto.get(bid) || []).filter(p => !p.estornadoEm && !pagIds.includes(p.id)).reduce((s, p) => s + cent(p.abatido != null ? p.abatido : abatidoPag(p)), 0);
    if (b.status === 'Pago' && restante < cent(b.valor)) { const o = altOp('boletos', b, { status: 'Em aberto', pagoEm: '' }, ctx); if (o) ops.push(o); }
    void abat;
  }
  return ops;
}
/* Reabrir boleto pago: estorna os pagamentos registrados (ou só muda o status, se foi baixado à mão) */
function opsReabrir(vista, ids, ctx) {
  const ix = indices(vista); const ops = [];
  for (const id of ids) {
    const b = ix.boletoPorId.get(id); if (!b) continue;
    const pags = (ix.pagPorBoleto.get(id) || []).filter(p => !p.estornadoEm).map(p => p.id);
    if (pags.length) ops.push(...opsEstorno(vista, pags, ctx, 'boleto reaberto'));
    if (!ops.some(o => o.op === 'alt' && o.tab === 'boletos' && o.id === id)) ops.push(...opsStatus(vista, [id], 'Em aberto', ctx, 'Reabriu (voltou para Em aberto)'));
  }
  return ops;
}

/* ---------------- Cobrança: contato, etapa, responsável ---------------- */
function opsContato(vista, ids, dados, ctx) {
  const ix = indices(vista), ops = [], usados = novosUsados();
  const promessa = etapas(vista).find(e => /promessa/i.test(e));
  for (const id of ids) {
    const b = ix.boletoPorId.get(id); if (!b) continue;
    const cid = proximoId(vista, 'contatos', usados.contatos); usados.contatos.push(cid);
    ops.push({ op: 'cri', tab: 'contatos', linha: { id: cid, boleto: id, dataHora: marca(ctx), cliente: b.cliente || b.pdv || '', doc: b.doc || '', canal: dados.canal || '', falouCom: dados.falouCom || '', anotacao: dados.anotacao || '', etapa: dados.etapa || '', promessaEm: dados.promessaEm || '', proxAcao: dados.proxAcao || '', proxAcaoEm: dados.proxAcaoEm || '', registradoPor: ctx.u }, ts: ctx.ts, u: ctx.u, g: ctx.g });
    const c = {};
    if (dados.etapa) c.etapa = dados.etapa;
    if (dados.promessaEm !== undefined) c.promessaEm = dados.promessaEm || '';
    if (dados.promessaEm && !dados.etapa && promessa) c.etapa = promessa;
    c.proxAcao = dados.proxAcao || ''; c.proxAcaoEm = dados.proxAcaoEm || '';
    const o = altOp('boletos', b, c, ctx); if (o) ops.push(o);
    ops.push(histOp(vista, ctx, 'Registrou contato', id, [dados.canal, dados.falouCom && 'com ' + dados.falouCom, dados.anotacao, dados.promessaEm && 'promessa ' + fmtData(dados.promessaEm)].filter(Boolean).join(' · '), usados));
  }
  return ops;
}
function opsCampoLote(vista, ids, campos, ctx, acao) {
  const ix = indices(vista), ops = [], usados = novosUsados();
  for (const id of ids) {
    const b = ix.boletoPorId.get(id); if (!b) continue;
    const o = altOp('boletos', b, campos, ctx);
    if (o) { ops.push(o); ops.push(histOp(vista, ctx, acao, id, Object.keys(o.c).map(k => `${ESQUEMA.boletos.porK[k].h}: ${fmtCampo(k, o.c[k])}`).join('; '), usados)); }
  }
  return ops;
}

/* ---------------- Renegociação ---------------- */
function opsRenegociar(vista, ids, p, ctx) {
  const ix = indices(vista);
  const orig = ids.map(id => ix.boletoPorId.get(id)).filter(b => b && emAberto(b));
  if (!orig.length) return [];
  let total = somaCent(orig, saldoDe);
  if (p.comEncargos) total = somaCent(orig, b => valorAtualizado(saldoDe(b), b.vencimento, ctx.hoje, cfgNum(vista, 'multa'), cfgNum(vista, 'juros')).total);
  if (p.valorTotal > 0) total = arred2(p.valorTotal);
  const parcelas = gerarParcelas({ qtd: p.qtd, valor: total, venc1: p.venc1, modo: 'total', intervalo: p.intervalo, dias: p.dias });
  const b0 = orig[0];
  const de = orig.map(b => b.id).join('; ');
  const ops = opsLancamento(vista, { setor: b0.setor, pdv: b0.pdv, cliente: b0.cliente, doc: b0.doc, responsavel: b0.responsavel, obs: p.obs || `Renegociação dos boletos ${de}`, parcelas, renegociadoDe: de, criarCliente: false, acaoHist: 'Lançou (renegociação)' }, ctx);
  const lanc = ops.lancamento, usados = novosUsados();
  usados.historico.push(...ops.filter(o => o.tab === 'historico').map(o => o.linha.id));
  for (const b of orig) {
    const o = altOp('boletos', b, { status: 'Renegociado', renegociadoPara: String(lanc), promessaEm: '', proxAcao: '', proxAcaoEm: '' }, ctx);
    if (o) { ops.push(o); ops.push(histOp(vista, ctx, 'Renegociado', b.id, `Substituído pelo lançamento #${lanc} (${parcelas.length}x, total ${fmtBRL(total)})`, usados)); }
  }
  ops.lancamento = lanc; ops.total = total; ops.parcelas = parcelas;
  return ops;
}

/* ---------------- Clientes ---------------- */
const CAMPOS_CLIENTE = ['nome', 'setor', 'pdv', 'doc', 'telefone', 'whatsapp', 'email', 'contato', 'limite', 'responsavel', 'obs'];
function opsCliente(vista, id, dados, ctx) {
  const ops = [], usados = novosUsados();
  const limpo = {};
  for (const k of CAMPOS_CLIENTE) if (k in dados) limpo[k] = k === 'doc' && dados[k] ? formatarDoc(dados[k]) : k === 'limite' ? (vazio(dados[k]) ? '' : (isFinite(lerValor(dados[k])) ? lerValor(dados[k]) : '')) : String(dados[k] ?? '').trim();
  if (id) {
    const c = vista.tabs.clientes.linhas.find(x => x.id === id); if (!c) return [];
    const o = altOp('clientes', c, limpo, ctx);
    if (o) { ops.push(o); ops.push(histOp(vista, ctx, 'Editou cliente', '', `${c.nome || ''} · ` + Object.keys(o.c).map(k => `${ESQUEMA.clientes.porK[k].h}: ${vazio(o.c[k]) ? '(vazio)' : o.c[k]}`).join('; '), usados)); }
  } else {
    const nid = proximoId(vista, 'clientes');
    ops.push({ op: 'cri', tab: 'clientes', linha: { id: nid, ...limpo, criadoEm: marca(ctx), criadoPor: ctx.u, alteradoEm: ctx.ts, alteradoPor: ctx.u }, ts: ctx.ts, u: ctx.u, g: ctx.g });
    ops.push(histOp(vista, ctx, 'Cadastrou cliente', '', `${limpo.nome || ''} ${limpo.doc || ''}`.trim(), usados));
    ops.novoId = nid;
  }
  return ops;
}
function opsConfig(vista, k, v, ctx) { return igual(vista.config[k], v) ? [] : [{ op: 'cfg', aba: 'config', k, v, a: vista.config[k] ?? '', ts: ctx.ts, u: ctx.u, g: ctx.g }]; }

/* ---------------- Mensagens de cobrança ---------------- */
function varsMensagem(vista, b, hoje) {
  const at = valorAtualizado(saldoDe(b), b.vencimento, hoje, cfgNum(vista, 'multa'), cfgNum(vista, 'juros'));
  return { cliente: b.cliente || b.pdv || '', pdv: b.pdv || '', valor: fmtBRL(saldoDe(b)), valor_original: fmtBRL(b.valor), valor_atualizado: fmtBRL(at.total),
    vencimento: fmtData(b.vencimento), parcela: b.parcela || '', dias_atraso: at.dias, documento: b.numDoc || '', numero_documento: b.numDoc || '',
    linha_digitavel: b.linhaDigitavel ? fmtLinha(b.linhaDigitavel) : '(peça a 2ª via)', multa: fmtBRL(at.multa), juros: fmtBRL(at.juros), setor: b.setor || '' };
}

/* ---------------- Conciliação (retorno bancário / extrato) ---------------- */
const soDig = s => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
function sugerirBaixas(vista, itens, hoje) {
  const ab = vista.tabs.boletos.linhas.filter(emAberto);
  const porNN = new Map(), porDoc = new Map();
  for (const b of ab) {
    const nn = soDig(b.nossoNumero); if (nn) { if (!porNN.has(nn)) porNN.set(nn, []); porNN.get(nn).push(b); }
    const nd = normCab(b.numDoc); if (nd) { if (!porDoc.has(nd)) porDoc.set(nd, []); porDoc.get(nd).push(b); }
  }
  const usados = new Set();
  return itens.map((it, i) => {
    const valor = it.valorPago || it.valor || 0;
    let cand = [], motivo = '', conf = '';
    const nn = soDig(it.nossoNumero);
    if (nn) {
      cand = porNN.get(nn) || [];
      if (!cand.length) for (const [k, arr] of porNN) if (k.length >= 6 && (k.endsWith(nn) || nn.endsWith(k) || nn.slice(0, -1) === k || k.slice(0, -1) === nn)) cand = cand.concat(arr);
      if (cand.length) { motivo = 'nosso número'; conf = 'alta'; }
    }
    if (!cand.length && (it.documento || it.seuNumero)) {
      for (const d of [it.documento, it.seuNumero]) { const k = normCab(d); if (k && porDoc.has(k)) { cand = porDoc.get(k); motivo = 'nº do documento'; conf = 'alta'; break; } }
    }
    if (cand.length > 1) { const v = cand.filter(b => cent(saldoDe(b)) === cent(valor) || cent(b.valor) === cent(it.valorTitulo || valor)); if (v.length) cand = v; }
    if (!cand.length && valor > 0) {
      const v = ab.filter(b => cent(saldoDe(b)) === cent(valor) || cent(b.valor) === cent(it.valorTitulo || 0));
      const perto = v.filter(b => b.vencimento && Math.abs(difDias(b.vencimento, it.vencimento || it.data || hoje)) <= 10);
      if (perto.length === 1) { cand = perto; motivo = 'valor e data próximos'; conf = 'media'; }
      else if (v.length === 1) { cand = v; motivo = 'valor igual (único)'; conf = 'baixa'; }
      else if (v.length > 1) { cand = []; motivo = `${v.length} boletos com o mesmo valor`; conf = ''; }
    }
    const b = cand.find(x => !usados.has(x.id)) || null;
    if (b && conf) usados.add(b.id);
    const aplicar = !!b && it.liquidacao !== false && (conf === 'alta' || conf === 'media') && valor > 0;
    return { i, item: it, boleto: b, alternativas: cand, motivo: b ? motivo : (motivo || 'nenhum boleto em aberto confere'), confianca: b ? conf : '', aplicar };
  });
}

/* ---------------- Importação (CSV / XLSX / colado do Excel) ---------------- */
const CAMPOS_IMPORT = ['vencimento', 'valor', 'cliente', 'pdv', 'setor', 'doc', 'numDoc', 'nossoNumero', 'parcela', 'obs', 'responsavel', 'linhaDigitavel', 'status', 'pagoEm'];
function sugerirMapa(cabecalho) {
  const mapa = {}; const usados = new Set();
  cabecalho.forEach((h, i) => { const k = ESQUEMA.boletos.alias.get(normCab(h)); if (k && CAMPOS_IMPORT.includes(k) && !usados.has(k)) { mapa[k] = i; usados.add(k); } });
  return mapa;
}
function prepararImportacao(vista, linhas, mapa, hoje) {
  const exist = new Set(vista.tabs.boletos.linhas.filter(b => !b.excluidoEm && b.status !== 'Cancelado').map(b => [docLimpo(b.doc), b.vencimento, cent(b.valor), normCab(b.numDoc)].join('|')));
  const noArquivo = new Set();
  return linhas.map((l, i) => {
    const g = k => mapa[k] != null && mapa[k] !== '' ? l[+mapa[k]] : '';
    const r = { linha: i + 1, erros: [], avisos: [] };
    const lb = g('linhaDigitavel') ? lerBoleto(g('linhaDigitavel'), hoje) : null;
    r.vencimento = paraIso(g('vencimento')) || (lb && lb.ok ? lb.vencimento : '');
    const v = lerValor(g('valor')); r.valor = isFinite(v) ? v : (lb && lb.ok ? lb.valor : NaN);
    r.cliente = txtCel(g('cliente')); r.pdv = txtCel(g('pdv')); r.setor = txtCel(g('setor'));
    r.doc = g('doc') ? formatarDoc(g('doc')) : ''; r.numDoc = txtCel(g('numDoc')); r.nossoNumero = txtCel(g('nossoNumero'));
    r.parcela = txtCel(g('parcela')) || '1/1'; r.obs = txtCel(g('obs')); r.responsavel = txtCel(g('responsavel'));
    r.linhaDigitavel = lb && lb.ok ? lb.linha : txtCel(g('linhaDigitavel')).replace(/\D/g, '');
    r.status = g('status') ? normStatus(g('status')) : 'Em aberto'; r.pagoEm = paraIso(g('pagoEm'));
    if (!r.vencimento) r.erros.push(g('vencimento') ? `vencimento "${g('vencimento')}" não é uma data` : 'sem vencimento');
    if (!(r.valor > 0)) r.erros.push(g('valor') ? `valor "${g('valor')}" inválido` : 'sem valor');
    if (!r.pdv && !r.cliente && !r.doc) r.erros.push('sem cliente/PDV/CNPJ');
    if (r.doc) { const c = checarDoc(r.doc); if (!c.ok) r.avisos.push('CNPJ/CPF com dígito errado'); }
    if (lb && !lb.ok && g('linhaDigitavel')) r.avisos.push('linha digitável não confere');
    const chave = [docLimpo(r.doc), r.vencimento, cent(r.valor), normCab(r.numDoc)].join('|');
    if (exist.has(chave)) { r.duplicado = 'já existe na planilha'; }
    else if (noArquivo.has(chave)) r.duplicado = 'repetido no arquivo';
    noArquivo.add(chave);
    r.ok = !r.erros.length;
    r.importar = r.ok && !r.duplicado;
    return r;
  });
}
function opsImportacao(vista, linhas, ctx) {
  let v = vista; const todas = [];
  const grupos = new Map();
  for (const r of linhas) {
    const p = lerParcela(r.parcela);
    const chave = p && p.t > 1 && (r.doc || r.pdv) ? [docLimpo(r.doc), normCab(r.pdv), normCab(r.numDoc).replace(/\d{1,2}$/, ''), p.t, cent(r.valor)].join('|') : 'u' + r.linha;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(r);
  }
  for (const rs of grupos.values()) {
    const r0 = rs[0];
    const ops = opsLancamento(v, { setor: r0.setor, pdv: r0.pdv, cliente: r0.cliente, doc: r0.doc, obs: r0.obs, responsavel: r0.responsavel, acaoHist: 'Importou boleto',
      parcelas: rs.map(r => { const p = lerParcela(r.parcela) || { n: 1, t: 1 }; return { numero: p.n, total: p.t, valor: r.valor, venc: r.vencimento, numDoc: r.numDoc, nossoNumero: r.nossoNumero, linhaDigitavel: r.linhaDigitavel }; }) }, ctx);
    rs.forEach((r, k) => { const o = ops.filter(x => x.tab === 'boletos')[k]; if (o && (r.status !== 'Em aberto' || r.pagoEm)) { o.linha.status = r.status; o.linha.pagoEm = r.pagoEm; } });
    todas.push(...ops);
    v = aplicarOps(v, ops).doc;
  }
  return todas;
}

/* ---------------- Verificar planilha ---------------- */
function verificarPlanilha(vista, hoje) {
  const probs = [];
  const add = (tipo, gravidade, texto, ids, correcao) => probs.push({ tipo, gravidade, texto, ids: ids || [], correcao });
  const bol = vista.tabs.boletos.linhas;
  const reatrib = bol.filter(b => b._idNovo);
  if (reatrib.length) add('ids', 'media', `${plural(reatrib.length, 'linha')} da aba Boletos ${reatrib.length === 1 ? 'estava' : 'estavam'} sem ID ou com ID repetido (linha copiada no Excel). O sistema deu números novos.`, reatrib.map(b => b.id), 'gravar');
  for (const t of ['clientes', 'pagamentos', 'contatos']) { const n = vista.tabs[t].linhas.filter(l => l._idNovo).length; if (n) add('ids', 'media', `${plural(n, 'linha')} da aba ${ESQUEMA[t].aba} sem ID ou com ID repetido.`, [], 'gravar'); }
  const datasRuins = bol.filter(b => !b.excluidoEm && (!b.vencimento || !isoValida(b.vencimento)));
  if (datasRuins.length) add('datas', 'alta', `${plural(datasRuins.length, 'boleto')} sem vencimento ou com data inválida.`, datasRuins.map(b => b.id));
  const pagosSemData = bol.filter(b => !b.excluidoEm && b.status === 'Pago' && !b.pagoEm);
  if (pagosSemData.length) add('pagoSemData', 'baixa', `${plural(pagosSemData.length, 'boleto')} com status Pago mas sem "Pago em".`, pagosSemData.map(b => b.id));
  const valorRuim = bol.filter(b => !b.excluidoEm && !(typeof b.valor === 'number' && b.valor > 0));
  if (valorRuim.length) add('valor', 'alta', `${plural(valorRuim.length, 'boleto')} sem valor ou com valor inválido.`, valorRuim.map(b => b.id));
  const docRuim = bol.filter(b => !b.excluidoEm && b.doc && !checarDoc(b.doc).ok);
  if (docRuim.length) add('doc', 'baixa', `${plural(docRuim.length, 'boleto')} com CNPJ/CPF que não passa na conferência dos dígitos.`, docRuim.map(b => b.id));
  const docMal = bol.filter(b => b.doc && checarDoc(b.doc).ok && formatarDoc(b.doc) !== b.doc);
  if (docMal.length) add('docFormato', 'baixa', `${plural(docMal.length, 'CNPJ/CPF')} sem a formatação padrão (pontos e traço).`, docMal.map(b => b.id), 'formatarDoc');
  const espacos = bol.filter(b => ['setor', 'pdv', 'cliente', 'numDoc'].some(k => typeof b[k] === 'string' && b[k] !== b[k].trim().replace(/\s{2,}/g, ' ')));
  if (espacos.length) add('espacos', 'baixa', `${plural(espacos.length, 'boleto')} com espaços sobrando no setor, PDV, cliente ou nº do documento.`, espacos.map(b => b.id), 'espacos');
  const parcRuim = bol.filter(b => b.parcela && !lerParcela(b.parcela));
  if (parcRuim.length) add('parcelaFormato', 'baixa', `${plural(parcRuim.length, 'parcela')} fora do formato "2/5".`, parcRuim.map(b => b.id));
  const lancs = new Map();
  for (const b of bol) if (b.lancamento && !b.excluidoEm) { if (!lancs.has(b.lancamento)) lancs.set(b.lancamento, []); lancs.get(b.lancamento).push(b); }
  const incons = [];
  for (const [l, arr] of lancs) {
    const ps = arr.map(b => lerParcela(b.parcela)).filter(Boolean);
    const totais = new Set(ps.map(p => p.t));
    const nums = ps.map(p => p.n).sort((a, b) => a - b);
    const repetidas = nums.some((n, i) => i && nums[i - 1] === n);
    let falta = false;
    if (totais.size === 1 && nums.length) { const t = [...totais][0]; const min = nums[0]; for (let n = min; n <= t; n++) if (!nums.includes(n)) { falta = true; break; } }
    if (totais.size > 1 || repetidas || falta) incons.push({ l, arr, motivo: totais.size > 1 ? 'totais diferentes' : repetidas ? 'parcela repetida' : 'faltam parcelas' });
  }
  if (incons.length) add('parcelas', 'media', `${plural(incons.length, 'lançamento')} com parcelas inconsistentes (${incons.slice(0, 3).map(x => '#' + x.l + ': ' + x.motivo).join('; ')}${incons.length > 3 ? '…' : ''}).`, incons.flatMap(x => x.arr.map(b => b.id)));
  const idsBol = new Set(bol.map(b => b.id));
  const orfP = vista.tabs.pagamentos.linhas.filter(p => p.boleto && !idsBol.has(p.boleto));
  if (orfP.length) add('orfaos', 'media', `${plural(orfP.length, 'pagamento')} ligados a boletos que não existem mais (IDs ${[...new Set(orfP.map(p => p.boleto))].slice(0, 8).join(', ')}).`, []);
  const orfC = vista.tabs.contatos.linhas.filter(c => c.boleto && !idsBol.has(c.boleto));
  if (orfC.length) add('orfaos', 'baixa', `${plural(orfC.length, 'contato')} ligados a boletos que não existem mais.`, []);
  const dup = new Map();
  for (const b of bol) { if (b.excluidoEm || b.status === 'Cancelado' || b.status === 'Renegociado') continue; const k = [docLimpo(b.doc), b.vencimento, cent(b.valor), normCab(b.numDoc), b.parcela].join('|'); if (!dup.has(k)) dup.set(k, []); dup.get(k).push(b); }
  const dups = [...dup.values()].filter(a => a.length > 1);
  if (dups.length) add('duplicados', 'media', `${plural(dups.length, 'grupo')} de boletos possivelmente repetidos (mesmo CNPJ/CPF, vencimento, valor, documento e parcela).`, dups.flat().map(b => b.id));
  const semResp = bol.filter(b => emAberto(b) && b.responsavel && listaCfg(vista.config.responsaveis).length && !listaCfg(vista.config.responsaveis).some(r => semAcento(r) === semAcento(b.responsavel)));
  if (semResp.length) add('responsavel', 'baixa', `${plural(semResp.length, 'boleto')} com responsável que não está na lista da aba Config.`, semResp.map(b => b.id));
  void hoje;
  return probs;
}
function opsCorrecao(vista, prob, ctx) {
  const ix = indices(vista), ops = [];
  if (prob.correcao === 'formatarDoc') for (const id of prob.ids) { const b = ix.boletoPorId.get(id); const o = b && altOp('boletos', b, { doc: formatarDoc(b.doc) }, ctx); if (o) ops.push(o); }
  if (prob.correcao === 'espacos') for (const id of prob.ids) {
    const b = ix.boletoPorId.get(id); if (!b) continue; const c = {};
    for (const k of ['setor', 'pdv', 'cliente', 'numDoc']) if (typeof b[k] === 'string') c[k] = b[k].trim().replace(/\s{2,}/g, ' ');
    const o = altOp('boletos', b, c, ctx); if (o) ops.push(o);
  }
  return ops;
}

/* ---------------- Relatórios e gráficos ---------------- */
function porSetor(vista, hoje) {
  const m = new Map();
  for (const b of vista.tabs.boletos.linhas) {
    if (!emAberto(b)) continue;
    const k = b.setor || '(sem setor)'; const a = m.get(k) || { setor: k, aberto: 0, vencido: 0, qtd: 0, qtdVenc: 0 };
    a.aberto = arred2(a.aberto + saldoDe(b)); a.qtd++;
    if (b.vencimento && b.vencimento < hoje) { a.vencido = arred2(a.vencido + saldoDe(b)); a.qtdVenc++; }
    m.set(k, a);
  }
  return [...m.values()].map(a => ({ ...a, pct: a.aberto ? a.vencido / a.aberto : 0 })).sort((a, b) => b.vencido - a.vencido || b.aberto - a.aberto);
}
function previsao(vista, hoje, modo = 'semana', n = 12) {
  const out = [];
  const ab = vista.tabs.boletos.linhas.filter(emAberto);
  const atrasado = somaCent(ab.filter(b => b.vencimento && b.vencimento < hoje), saldoDe);
  let ini = modo === 'semana' ? inicioSemana(hoje) : primeiroDoMes(hoje);
  for (let i = 0; i < n; i++) {
    const fim = modo === 'semana' ? somaDias(ini, 7) : primeiroDoMes(ini, 1);
    const arr = ab.filter(b => b.vencimento && b.vencimento >= (i === 0 ? hoje : ini) && b.vencimento < fim);
    out.push({ ini, fim: somaDias(fim, -1), valor: somaCent(arr, saldoDe), qtd: arr.length, rot: modo === 'semana' ? fmtDataCurta(ini) : MESES_CURTO[partes(ini).m - 1] + '/' + String(partes(ini).y).slice(2) });
    ini = fim;
  }
  return { atrasado, itens: out };
}
function recebidoXaReceber(vista, hoje, meses = 6) {
  const out = [];
  for (let i = -(meses - 1); i <= 2; i++) {
    const ini = primeiroDoMes(hoje, i), fim = primeiroDoMes(hoje, i + 1);
    const rec = vista.tabs.pagamentos.linhas.filter(p => !p.estornadoEm && p.data >= ini && p.data < fim);
    const bolMes = vista.tabs.boletos.linhas.filter(b => !b.excluidoEm && b.vencimento >= ini && b.vencimento < fim && b.status !== 'Cancelado' && b.status !== 'Renegociado');
    const pagosSemReg = bolMes.filter(b => b.status === 'Pago' && !(b.valorPago > 0) && b.pagoEm >= ini && b.pagoEm < fim);
    out.push({ ini, rot: MESES_CURTO[partes(ini).m - 1] + '/' + String(partes(ini).y).slice(2), recebido: arred2(somaCent(rec, p => p.valor) + somaCent(pagosSemReg, b => b.valor)), aReceber: somaCent(bolMes.filter(emAberto), saldoDe), venceu: somaCent(bolMes, b => b.valor) });
  }
  return out;
}
function maioresDevedores(vista, hoje, n = 10, soVencidos = true) {
  const m = new Map();
  for (const b of vista.tabs.boletos.linhas) {
    if (!emAberto(b) || (soVencidos && !(b.vencimento && b.vencimento < hoje))) continue;
    const k = docLimpo(b.doc) || normCab(b.pdv) || normCab(b.cliente) || 'sem';
    const a = m.get(k) || { nome: b.cliente || b.pdv || '(sem nome)', doc: b.doc || '', pdv: b.pdv || '', valor: 0, qtd: 0, maisAntigo: b.vencimento };
    a.valor = arred2(a.valor + saldoDe(b)); a.qtd++; if (b.vencimento < a.maisAntigo) a.maisAntigo = b.vencimento;
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, n);
}
function calendarioMes(vista, ym, hoje) {
  const dias = new Map();
  for (const b of vista.tabs.boletos.linhas) {
    if (b.excluidoEm || !b.vencimento || b.vencimento.slice(0, 7) !== ym) continue;
    const d = dias.get(b.vencimento) || { aberto: 0, qtdAberto: 0, pago: 0, qtdPago: 0, vencido: 0 };
    if (b.status === 'Em aberto') { d.aberto = arred2(d.aberto + saldoDe(b)); d.qtdAberto++; if (b.vencimento < hoje) d.vencido++; }
    else if (b.status === 'Pago') { d.pago = arred2(d.pago + (Number(b.valor) || 0)); d.qtdPago++; }
    dias.set(b.vencimento, d);
  }
  return dias;
}
function extratoCliente(vista, chave) {
  const d = docLimpo(chave.doc), p = normCab(chave.pdv);
  const bol = vista.tabs.boletos.linhas.filter(b => !b.excluidoEm && (d ? docLimpo(b.doc) === d : p && normCab(b.pdv) === p));
  const ids = new Set(bol.map(b => b.id));
  const pags = vista.tabs.pagamentos.linhas.filter(x => ids.has(x.boleto));
  const conts = vista.tabs.contatos.linhas.filter(x => ids.has(x.boleto) && !x.excluidoEm);
  return { boletos: ordenarBoletos(bol.slice()), pagamentos: pags.sort((a, b) => (a.data || '').localeCompare(b.data || '')), contatos: conts.sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0)) };
}
function relatorioPeriodo(vista, ini, fim) {
  const bol = vista.tabs.boletos.linhas.filter(b => !b.excluidoEm);
  const ix = new Map(bol.map(b => [b.id, b]));
  const rec = vista.tabs.pagamentos.linhas.filter(p => !p.estornadoEm && p.data >= ini && p.data <= fim).map(p => ({ ...p, b: ix.get(p.boleto) }));
  const venc = bol.filter(b => b.vencimento >= ini && b.vencimento <= fim);
  const conts = vista.tabs.contatos.linhas.filter(c => !c.excluidoEm && c.dataHora >= isoParaSerial(ini) && c.dataHora < isoParaSerial(fim) + 1);
  const lancados = bol.filter(b => typeof b.criadoEm === 'number' && b.criadoEm >= isoParaSerial(ini) && b.criadoEm < isoParaSerial(fim) + 1);
  return { rec, venc, conts, lancados, totalRec: somaCent(rec, p => p.valor), totalVenc: somaCent(venc, b => b.valor), venceuAberto: somaCent(venc.filter(emAberto), saldoDe) };
}
