/* =====================================================================
   TELAS — Hoje, Boletos (lista virtual), detalhe do boleto e ações
   ===================================================================== */
const hoje = () => hojeLocal();
const cfgLista = k => listaCfg(S.vista.config[k]).length ? listaCfg(S.vista.config[k]) : listaCfg(CONFIG_PADRAO[k]);
function atualizado(b) { return valorAtualizado(saldoDe(b), b.vencimento, hoje(), cfgNum(S.vista, 'multa'), cfgNum(S.vista, 'juros')); }
function nomeB(b) { return b.cliente || b.pdv || '(sem nome)'; }
function tagSit(b) { const s = situacao(b, hoje(), cfgNum(S.vista, 'diasAlerta') || 7); return `<span class="tag ${s.cls}">${esc(s.txt)}</span>`; }
function opcoes(lista, atual, vazioRot) { return (vazioRot != null ? `<option value="">${esc(vazioRot)}</option>` : '') + lista.map(v => `<option${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join(''); }
function atualizarListas() {
  const v = S.vista; if (!v) return;
  const setores = [...new Set([...cfgLista('setores'), ...v.tabs.boletos.linhas.map(b => b.setor).filter(Boolean)])].sort((a, b) => COLL.compare(a, b));
  const resp = [...new Set([...listaCfg(v.config.responsaveis), USUARIO()].filter(x => x && x !== 'Sem nome'))].sort((a, b) => COLL.compare(a, b));
  const chave = setores.join('|') + '#' + resp.join('|') + '#' + v.tabs.clientes.linhas.length + '#' + v.tabs.boletos.linhas.length;
  if (atualizarListas.ultima === chave) return;
  atualizarListas.ultima = chave;
  $('#dlSetores').innerHTML = setores.map(s => `<option value="${esc(s)}">`).join('');
  $('#dlResp').innerHTML = resp.map(s => `<option value="${esc(s)}">`).join('');
  const cli = v.tabs.clientes.linhas.filter(c => !c.excluidoEm);
  $('#dlClientes').innerHTML = cli.slice(0, 3000).map(c => `<option value="${esc([c.nome, c.pdv && 'PDV ' + c.pdv, c.doc].filter(Boolean).join(' · '))}">`).join('');
  const pdvs = new Map();
  for (const c of cli) if (c.pdv) pdvs.set(c.pdv, c.nome);
  for (const b of v.tabs.boletos.linhas) if (b.pdv && !pdvs.has(b.pdv)) pdvs.set(b.pdv, b.cliente);
  $('#dlPdvs').innerHTML = [...pdvs].slice(0, 3000).map(([p, n]) => `<option value="${esc(p)}">${esc(n || '')}</option>`).join('');
}

/* ------------------------------------------------------------------ HOJE */
function renderHoje() {
  const v = S.vista, h = hoje();
  const k = kpis(v, h);
  const ag = agendaHoje(v, h, { usuario: USUARIO(), soMeus: UI.soMeus });
  const aging0 = aging(v.tabs.boletos.linhas.filter(b => !UI.soMeus || semAcento(b.responsavel) === semAcento(USUARIO())), h);
  const dataLonga = `${DIAS_LONGO[diaSemana(h)]}, ${partes(h).d} de ${MESES[partes(h).m - 1]}`;
  const grupo = g => g.itens.length ? `<section class="grupo-hoje ${g.cls}"><h3>${esc(g.rot)} <span class="n">${g.itens.length}</span><span class="tot num">${fmtBRL(g.total)}</span></h3>
    ${g.dica ? `<p class="dica" style="margin:-4px 2px 8px">${esc(g.dica)}</p>` : ''}
    <div class="lista-card">${g.itens.slice(0, 60).map(b => itemHoje(b, g.k)).join('')}${g.itens.length > 60 ? `<div class="item-hoje"><span class="sub">… e mais ${g.itens.length - 60}. Veja na aba Boletos.</span></div>` : ''}</div></section>` : '';
  const total = ag.reduce((s, g) => s + g.itens.length, 0);
  $('#p-hoje').innerHTML = `
    <div class="barra" style="margin-bottom:12px"><h2 style="margin:0;font-size:18px">Hoje · <span style="font-weight:600">${esc(dataLonga)}</span></h2><span class="esp"></span>
      <label class="check"><input type="checkbox" id="hojeMeus"${UI.soMeus ? ' checked' : ''}> Só os meus boletos</label></div>
    <div class="kpis">
      ${kpiHtml('perigo', 'Vencidos', k.vencidos, 'vencido')}${kpiHtml('hoje', 'Vencem hoje', k.hoje, 'hoje')}${kpiHtml('alerta', `Próximos ${k.diasAlerta} dias`, k.proximos, 'semana')}
      ${kpiHtml('', 'Total em aberto', k.aberto, 'aberto')}${kpiHtml('ok', 'Recebido no mês', k.recebidoMes, 'recebido')}
    </div>
    <div class="hoje-grid">
      <div>${total ? ag.map(grupo).join('') : `<div class="card vazio"><b>Agenda do dia vazia</b>Nenhuma promessa, ação ou vencimento pedindo atenção hoje${UI.soMeus ? ' nos seus boletos' : ''}.</div>`}</div>
      <aside class="pilha">
        <div class="card"><h3>Faixas de atraso <span class="sub">(saldo em aberto)</span></h3><div class="aging" style="grid-template-columns:1fr 1fr">${aging0.map((f, i) => `<button type="button" class="f${i}" data-faixa="${f.k}"><span>${esc(f.rot)}</span><b class="num">${fmtBRL(f.valor)}</b><small>${plural(f.qtd, 'boleto')}</small></button>`).join('')}</div></div>
        <div class="card"><h3>Atalhos</h3><div class="pilha" style="gap:8px">
          <button type="button" class="btn sec" data-ir="novo">Novo lançamento <kbd>N</kbd></button>
          <button type="button" class="btn sec" data-ir="conciliacao">Conciliar retorno do banco</button>
          <button type="button" class="btn sec" data-filtro="quebrada">Todas as promessas quebradas</button></div></div>
      </aside>
    </div>`;
}
function kpiHtml(cls, rot, k, filtro) { return `<button type="button" class="kpi ${cls}" data-kpi="${filtro}"><span>${esc(rot)}</span><strong class="num">${fmtBRL(k.valor)}</strong><small>${k.qtd ? plural(k.qtd, filtro === 'recebido' ? 'pagamento' : 'boleto') : 'nenhum'}</small></button>`; }
function itemHoje(b, grupo) {
  const at = atualizado(b);
  const sub = [b.pdv && 'PDV ' + b.pdv, b.setor, 'parcela ' + (b.parcela || '—'), b.vencimento && 'venc. ' + fmtDataCurta(b.vencimento), grupo === 'quebradas' && b.promessaEm && 'prometeu ' + fmtDataCurta(b.promessaEm), b.proxAcao && '→ ' + b.proxAcao, b.responsavel].filter(Boolean).join(' · ');
  return `<div class="item-hoje" data-abrir="${b.id}"><div style="min-width:0"><div class="t1">${esc(nomeB(b))}</div><div class="t2">${esc(sub)}</div></div>
    <div class="vl num">${fmtBRL(saldoDe(b))}${at.dias > 0 ? `<small>${fmtBRL(at.total)} com juros</small>` : ''}</div>
    <div class="ac"><button type="button" class="btn ok peq" data-a="baixa" data-id="${b.id}" title="Dar baixa (R)">${ICON.check}<span>Baixa</span></button><button type="button" class="icone" data-a="contato" data-id="${b.id}" title="Registrar contato (C)">${ICON.fone}</button><button type="button" class="icone" data-a="mensagem" data-id="${b.id}" title="Mensagem de cobrança (M)">${ICON.msg}</button></div></div>`;
}
$('#p-hoje').addEventListener('change', e => { if (e.target.id === 'hojeMeus') { UI.soMeus = e.target.checked; lsSet('bc2.soMeus', UI.soMeus ? '1' : '0'); renderHoje(); renderTopo(); } });
$('#p-hoje').addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (a) { e.stopPropagation(); return acaoBoleto(a.dataset.a, [+a.dataset.id]); }
  const ab = e.target.closest('[data-abrir]'); if (ab) return abrirGaveta(+ab.dataset.abrir);
  const k = e.target.closest('[data-kpi]'); if (k) return k.dataset.kpi === 'recebido' ? mostrarAba('painel') : irParaBoletos({ status: k.dataset.kpi });
  const f = e.target.closest('[data-faixa]'); if (f) return irParaBoletos({ status: f.dataset.faixa === 'avencer' ? 'aberto' : 'vencido', faixa: f.dataset.faixa });
  const fl = e.target.closest('[data-filtro]'); if (fl) return irParaBoletos({ status: fl.dataset.filtro });
  const ir = e.target.closest('[data-ir]'); if (ir) return mostrarAba(ir.dataset.ir);
});

/* --------------------------------------------------------------- BOLETOS */
const COLS_LISTA = {
  sel: { rot: '', w: '34px', fixa: 1 },
  vencimento: { rot: 'Vencimento', w: '108px', ord: 'vencimento', h: b => `<span class="num">${b.vencimento ? fmtData(b.vencimento) : '—'}</span>` },
  situacao: { rot: 'Situação', w: '160px', ord: 'vencimento', h: b => tagSit(b).replace(' · parcial', '') + (b.promessaEm && b.status === 'Em aberto' ? ` <span class="tag promessa" title="Promessa de pagamento">${fmtDataCurta(b.promessaEm)}</span>` : '') },
  cliente: { rot: 'Cliente / PDV', w: 'minmax(200px,1.6fr)', ord: 'cliente', h: b => `<div class="lin2 c-cliente"><b>${esc(nomeB(b))}</b><span class="t2l">${esc([b.pdv && 'PDV ' + b.pdv, b.setor, b.doc].filter(Boolean).join(' · '))}</span></div>` },
  parcela: { rot: 'Parcela', w: '62px', ord: 'parcela', h: b => b.lancamento ? `<button type="button" class="parc" data-lanc="${b.lancamento}" title="Ver todas as parcelas deste lançamento">${esc(b.parcela || '—')}</button>` : `<span class="parc">${esc(b.parcela || '—')}</span>` },
  valor: { rot: 'Valor', w: '104px', ord: 'valor', h: b => `<span class="num">${fmtBRL(b.valor)}</span>` },
  saldo: { rot: 'Saldo', w: '104px', ord: 'saldo', h: b => `<div class="lin2"><b class="num">${fmtBRL(saldoDe(b))}</b>${b.status === 'Em aberto' && typeof b.valor === 'number' && saldoDe(b) < b.valor - 0.004 ? `<span class="t2l">parcial de ${fmtBRL(b.valor)}</span>` : ''}</div>` },
  atualizado: { rot: 'Com juros', w: '100px', ord: 'saldo', h: b => { const a = atualizado(b); return a.dias > 0 ? `<span class="num" title="multa ${fmtBRL(a.multa)} + juros ${fmtBRL(a.juros)}">${fmtBRL(a.total)}</span>` : '<span class="sub">—</span>'; } },
  etapa: { rot: 'Etapa', w: '116px', ord: 'etapa', h: b => b.status === 'Em aberto' ? esc(b.etapa || etapaInicial) : '' },
  proxAcao: { rot: 'Próxima ação', w: '140px', ord: 'proxAcaoEm', h: b => b.proxAcaoEm || b.proxAcao ? `<div class="lin2"><span${b.proxAcaoEm && b.proxAcaoEm <= hoje() && b.status === 'Em aberto' ? ' style="color:var(--info);font-weight:700"' : ''}>${b.proxAcaoEm ? fmtDataCurta(b.proxAcaoEm) : ''}</span><span class="t2l">${esc(b.proxAcao || '')}</span></div>` : '' },
  responsavel: { rot: 'Responsável', w: '104px', ord: 'responsavel', h: b => esc(b.responsavel || '') },
  setor: { rot: 'Setor', w: '120px', ord: 'setor', h: b => esc(b.setor || '') },
  pdv: { rot: 'PDV', w: '90px', ord: 'pdv', h: b => esc(b.pdv || '') },
  doc: { rot: 'CNPJ/CPF', w: '150px', ord: 'doc', h: b => `<span class="num">${esc(b.doc || '')}</span>` },
  numDoc: { rot: 'Nº documento', w: '110px', ord: 'numDoc', h: b => esc(b.numDoc || '') },
  nossoNumero: { rot: 'Nosso número', w: '120px', h: b => esc(b.nossoNumero || '') },
  obs: { rot: 'Observação', w: '180px', h: b => esc(b.obs || '') },
  pagoEm: { rot: 'Pago em', w: '88px', ord: 'pagoEm', h: b => b.pagoEm ? fmtData(b.pagoEm) : '' },
  valorPago: { rot: 'Recebido', w: '100px', h: b => b.valorPago ? `<span class="num">${fmtBRL(b.valorPago)}</span>` : '' },
  formaPagamento: { rot: 'Forma', w: '100px', h: b => esc(b.formaPagamento || '') },
  status: { rot: 'Status', w: '96px', ord: 'status', h: b => esc(b.status) },
  id: { rot: 'ID', w: '58px', ord: 'id', h: b => `<span class="sub num">${b.id}</span>` },
  lancamento: { rot: 'Lanç.', w: '58px', ord: 'lancamento', h: b => `<span class="sub num">${b.lancamento || ''}</span>` },
  alteradoEm: { rot: 'Alterado', w: '150px', ord: 'alteradoEm', h: b => `<span class="sub">${esc(serialParaTexto(b.alteradoEm))} ${esc(b.alteradoPor || '')}</span>` },
  criadoEm: { rot: 'Cadastrado', w: '150px', ord: 'criadoEm', h: b => `<span class="sub">${esc(serialParaTexto(b.criadoEm))} ${esc(b.criadoPor || '')}</span>` },
  acoes: { rot: '', w: '104px', fixa: 1, h: b => b.excluidoEm ? `<button type="button" class="btn sec peq" data-a="restaurar" data-id="${b.id}">Restaurar</button>` : `${b.status === 'Em aberto' ? `<button type="button" class="icone" data-a="baixa" data-id="${b.id}" title="Dar baixa (R)" style="color:var(--ok)">${ICON.check}</button><button type="button" class="icone" data-a="contato" data-id="${b.id}" title="Registrar contato (C)">${ICON.fone}</button><button type="button" class="icone" data-a="mensagem" data-id="${b.id}" title="Mensagem (M)">${ICON.msg}</button>` : `<button type="button" class="icone" data-a="reabrir" data-id="${b.id}" title="Reabrir / estornar baixa">${ICON.desfaz}</button>`}` }
};
const COLS_PADRAO = ['sel', 'vencimento', 'situacao', 'cliente', 'parcela', 'saldo', 'atualizado', 'etapa', 'proxAcao', 'responsavel', 'acoes'];
const L = {
  f: Object.assign({ status: 'aberto', busca: '', setor: '', etapa: '', responsavel: '', faixa: '', de: '', ate: '', dia: '', lancamento: null, ids: null }, lsJSON('bc2.filtros', {})),
  ordem: lsGet('bc2.ordem', 'vencimento'), desc: lsGet('bc2.desc') === '1', agrupar: lsGet('bc2.agrupar', '1') === '1',
  cols: lsJSON('bc2.cols', COLS_PADRAO), sel: new Set(), foco: -1, itens: [], linhas: [], ultimoClique: -1, H: 46
};
L.f.lancamento = null; L.f.ids = null; L.f.dia = '';
function salvarPrefsLista() { const { lancamento, ids, dia, ...f } = L.f; lsSet('bc2.filtros', JSON.stringify(f)); lsSet('bc2.ordem', L.ordem); lsSet('bc2.desc', L.desc ? '1' : '0'); lsSet('bc2.agrupar', L.agrupar ? '1' : '0'); lsSet('bc2.cols', JSON.stringify(L.cols)); }
function irParaBoletos(f) {
  L.f = { ...L.f, busca: '', setor: '', etapa: '', faixa: '', de: '', ate: '', dia: '', lancamento: null, ids: null, responsavel: UI.soMeus ? '__meus' : '', ...f };
  mostrarAba('boletos');
}
/* Colunas que cabem na largura da tela (as menos importantes saem primeiro) */
const ORDEM_SAIR = ['criadoEm', 'alteradoEm', 'lancamento', 'id', 'formaPagamento', 'valorPago', 'pagoEm', 'obs', 'nossoNumero', 'numDoc', 'doc', 'pdv', 'setor', 'status', 'valor', 'atualizado', 'responsavel', 'proxAcao', 'etapa', 'parcela', 'situacao'];
const largMin = c => parseInt((/(\d+)px/.exec(COLS_LISTA[c].w) || [, 120])[1], 10);
function colunasAtivas() {
  if (window.innerWidth < 640) return ['sel', 'cliente', 'saldo'];
  let cols = L.cols.filter(c => COLS_LISTA[c]);
  const tv = $('#tv'), disp = (tv && tv.clientWidth) || (window.innerWidth - 40);
  for (const c of ORDEM_SAIR) { if (cols.reduce((s, x) => s + largMin(x), 0) <= disp) break; cols = cols.filter(x => x !== c); }
  return cols;
}
function filtrarLista() {
  const h = hoje(), dias = cfgNum(S.vista, 'diasAlerta') || 7;
  const f = { ...L.f, busca: semAcento(L.f.busca.trim()), usuario: USUARIO() };
  const arr = S.vista.tabs.boletos.linhas.filter(b => passaFiltro(b, f, h, dias));
  return ordenarBoletos(arr, L.ordem, L.desc);
}
function renderBoletos() {
  const p = $('#p-boletos');
  if (!p.dataset.montado) montarBoletos();
  const v = S.vista;
  const setores = [...new Set(v.tabs.boletos.linhas.map(b => b.setor).filter(Boolean))].sort((a, b) => COLL.compare(a, b));
  const resp = [...new Set([...listaCfg(v.config.responsaveis), ...v.tabs.boletos.linhas.map(b => b.responsavel).filter(Boolean)])].sort((a, b) => COLL.compare(a, b));
  $('#fSetor').innerHTML = opcoes(setores, L.f.setor, 'Todos os setores');
  $('#fEtapa').innerHTML = opcoes(etapas(v), L.f.etapa, 'Todas as etapas');
  $('#fResp').innerHTML = `<option value="">Todos os responsáveis</option><option value="__meus"${L.f.responsavel === '__meus' ? ' selected' : ''}>Meus boletos</option><option value="__ninguem"${L.f.responsavel === '__ninguem' ? ' selected' : ''}>Sem responsável</option>` + resp.map(r => `<option${r === L.f.responsavel ? ' selected' : ''}>${esc(r)}</option>`).join('');
  $('#fStatus').value = L.f.status; $('#fBusca').value = L.f.busca; $('#fFaixa').value = L.f.faixa; $('#fDe').value = L.f.de; $('#fAte').value = L.f.ate;
  $('#fAgrupar').checked = L.agrupar;
  const visoes = lsJSON('bc2.visoes', []);
  $('#fVisao').innerHTML = '<option value="">Visões salvas…</option>' + visoes.map((x, i) => `<option value="${i}">${esc(x.nome)}</option>`).join('') + '<option value="__salvar">+ Salvar a visão atual…</option>' + (visoes.length ? '<option value="__apagar">Apagar uma visão…</option>' : '');
  atualizarListaBoletos();
}
function montarBoletos() {
  const p = $('#p-boletos'); p.dataset.montado = '1';
  p.innerHTML = `
    <div class="filtros card">
      <input type="search" id="fBusca" placeholder="Buscar cliente, PDV, CNPJ, nº documento, ID…  ( / )" aria-label="Buscar">
      <select id="fStatus" aria-label="Situação">
        <option value="aberto">Em aberto</option><option value="vencido">Só vencidos</option><option value="hoje">Vencem hoje</option><option value="semana">Vencem em breve</option>
        <option value="mes">Vencem neste mês</option><option value="promessa">Com promessa</option><option value="quebrada">Promessa quebrada</option>
        <option value="pago">Pagos</option><option value="cancelado">Cancelados/renegociados</option><option value="todos">Todos</option><option value="lixeira">Na lixeira</option></select>
      <select id="fFaixa" aria-label="Faixa de atraso"><option value="">Qualquer atraso</option>${FAIXAS.map(f => `<option value="${f.k}">${esc(f.rot)}</option>`).join('')}</select>
      <select id="fSetor" aria-label="Setor"></select><select id="fEtapa" aria-label="Etapa"></select><select id="fResp" aria-label="Responsável"></select>
      <input type="date" id="fDe" title="Vencimento a partir de" aria-label="Vencimento de"><input type="date" id="fAte" title="Vencimento até" aria-label="Vencimento até">
      <select id="fVisao" aria-label="Visões salvas"></select>
      <label class="check"><input type="checkbox" id="fAgrupar"> Agrupar por mês</label>
      <button type="button" class="btn sec peq" id="btnColunas" title="Escolher colunas">${ICON.colunas} Colunas</button>
      <button type="button" class="btn sec peq" id="btnExportar" title="Exportar o que está filtrado">${ICON.baixar} Exportar</button>
      <button type="button" class="btn texto" id="btnLimparFiltros">Limpar filtros</button>
    </div>
    <div id="chipFiltro"></div>
    <div id="acoesLote"></div>
    <div class="resumo-lista" id="resumoLista"></div>
    <div class="tabela-v" id="tv" tabindex="0" aria-label="Lista de boletos (setas para navegar, Enter abre, espaço seleciona)">
      <div class="tv-cab" id="tvCab"></div><div class="tv-corpo" id="tvCorpo"></div>
    </div>`;
  const aplicar = () => { L.f.lancamento = null; L.f.ids = null; L.sel.clear(); salvarPrefsLista(); atualizarListaBoletos(); };
  $('#fBusca').addEventListener('input', debounce(() => { L.f.busca = $('#fBusca').value; aplicar(); }, 160));
  for (const [id, k] of [['fStatus', 'status'], ['fSetor', 'setor'], ['fEtapa', 'etapa'], ['fResp', 'responsavel'], ['fFaixa', 'faixa'], ['fDe', 'de'], ['fAte', 'ate']])
    $('#' + id).addEventListener('change', e => { L.f[k] = e.target.value; if (k === 'faixa' && L.f.faixa && L.f.status !== 'aberto' && L.f.status !== 'vencido') L.f.status = 'aberto'; aplicar(); if (k === 'faixa') $('#fStatus').value = L.f.status; });
  $('#fAgrupar').addEventListener('change', e => { L.agrupar = e.target.checked; salvarPrefsLista(); atualizarListaBoletos(); });
  $('#btnLimparFiltros').addEventListener('click', () => { L.f = { status: 'aberto', busca: '', setor: '', etapa: '', responsavel: '', faixa: '', de: '', ate: '', dia: '', lancamento: null, ids: null }; L.sel.clear(); salvarPrefsLista(); renderBoletos(); });
  $('#fVisao').addEventListener('change', async e => {
    const v = e.target.value; e.target.value = '';
    const visoes = lsJSON('bc2.visoes', []);
    if (v === '__salvar') { const n = await pedirTexto('Salvar visão', 'Nome para esta combinação de filtros, ordem e colunas:', '', 'Salvar'); if (n) { const { lancamento, ids, ...f } = L.f; visoes.push({ nome: n, f, ordem: L.ordem, desc: L.desc, cols: L.cols, agrupar: L.agrupar }); lsSet('bc2.visoes', JSON.stringify(visoes)); aviso('Visão salva.'); renderBoletos(); } return; }
    if (v === '__apagar') { const n = await pedirTexto('Apagar visão', 'Digite o nome da visão a apagar:', '', 'Apagar'); const i = visoes.findIndex(x => x.nome === n); if (i >= 0) { visoes.splice(i, 1); lsSet('bc2.visoes', JSON.stringify(visoes)); renderBoletos(); } return; }
    const x = visoes[+v]; if (!x) return;
    L.f = { ...L.f, ...x.f, lancamento: null, ids: null }; L.ordem = x.ordem; L.desc = x.desc; L.cols = x.cols; L.agrupar = x.agrupar; salvarPrefsLista(); renderBoletos();
  });
  $('#btnColunas').addEventListener('click', () => {
    abrirMenu($('#btnColunas'), `<div class="cols-menu">${Object.entries(COLS_LISTA).filter(([, c]) => !c.fixa).map(([k, c]) => `<label><input type="checkbox" data-col="${k}"${L.cols.includes(k) ? ' checked' : ''}> ${esc(c.rot)}</label>`).join('')}</div><hr><button data-m="padrao">Voltar ao padrão</button>`, m => { if (m === 'padrao') { L.cols = COLS_PADRAO.slice(); salvarPrefsLista(); atualizarListaBoletos(); } });
    $('#menuAberto').addEventListener('change', e => {
      const k = e.target.dataset.col; if (!k) return;
      const ordem = Object.keys(COLS_LISTA);
      L.cols = e.target.checked ? [...new Set([...L.cols, k])].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)) : L.cols.filter(c => c !== k);
      salvarPrefsLista(); atualizarListaBoletos();
    });
  });
  $('#btnExportar').addEventListener('click', () => abrirMenu($('#btnExportar'), '<button data-m="csv">Exportar para CSV (Excel)</button><button data-m="xlsx">Exportar para Excel (.xlsx)</button><button data-m="imprimir">Imprimir a lista</button>', m => exportarLista(m)));
  const tv = $('#tv');
  tv.addEventListener('scroll', () => requestAnimationFrame(desenharLinhas));
  window.addEventListener('resize', debounce(() => { if (UI.aba === 'boletos') atualizarListaBoletos(); }, 150));
  $('#tvCab').addEventListener('click', e => {
    const c = e.target.closest('[data-ord]');
    if (e.target.closest('#selTodos')) return;
    if (!c) return;
    if (L.ordem === c.dataset.ord) L.desc = !L.desc; else { L.ordem = c.dataset.ord; L.desc = false; }
    salvarPrefsLista(); atualizarListaBoletos();
  });
  $('#tvCab').addEventListener('change', e => { if (e.target.id === 'selTodos') { if (e.target.checked) L.itens.forEach(b => L.sel.add(b.id)); else L.sel.clear(); atualizarListaBoletos(); } });
  $('#tvCorpo').addEventListener('click', e => {
    const lanc = e.target.closest('[data-lanc]'); if (lanc) { e.stopPropagation(); L.f.lancamento = +lanc.dataset.lanc; L.sel.clear(); atualizarListaBoletos(); return; }
    const a = e.target.closest('[data-a]'); if (a) { e.stopPropagation(); acaoBoleto(a.dataset.a, [+a.dataset.id]); return; }
    const lin = e.target.closest('.tv-lin'); if (!lin) return;
    const i = +lin.dataset.i, b = L.linhas[i] && L.linhas[i].b; if (!b) return;
    if (e.target.closest('.c-sel') || e.ctrlKey || e.metaKey || e.shiftKey) {
      if (e.shiftKey && L.ultimoClique >= 0) { const [x, y] = [Math.min(L.ultimoClique, i), Math.max(L.ultimoClique, i)]; for (let k = x; k <= y; k++) if (L.linhas[k].b) L.sel.add(L.linhas[k].b.id); }
      else if (L.sel.has(b.id)) L.sel.delete(b.id); else L.sel.add(b.id);
      L.ultimoClique = i; L.foco = i; atualizarSelecao(); return;
    }
    L.foco = i; abrirGaveta(b.id);
  });
  tv.addEventListener('keydown', teclaLista);
  $('#acoesLote').addEventListener('click', e => { const b = e.target.closest('[data-lote]'); if (b) acaoLote(b.dataset.lote, b); });
  $('#chipFiltro').addEventListener('click', e => { if (e.target.closest('[data-limpa]')) { L.f.lancamento = null; L.f.ids = null; L.f.dia = ''; atualizarListaBoletos(); } });
}
function atualizarListaBoletos() {
  if (!S.vista || !$('#tv')) return;
  L.itens = filtrarLista();
  const idsVisiveis = new Set(L.itens.map(b => b.id));
  for (const id of [...L.sel]) if (!idsVisiveis.has(id)) L.sel.delete(id);
  const linhas = [];
  if (L.agrupar && (L.ordem === 'vencimento') && !L.f.lancamento && window.innerWidth >= 640) {
    let mes = null, grupo = null;
    for (const b of L.itens) {
      const m = b.vencimento ? b.vencimento.slice(0, 7) : 'sem';
      if (m !== mes) { mes = m; grupo = { grupo: m === 'sem' ? 'Sem vencimento' : nomeMes(m), itens: [] }; linhas.push(grupo); }
      grupo.itens.push(b); linhas.push({ b });
    }
    for (const g of linhas) if (g.grupo) g.tot = somaCent(g.itens, saldoDe);
  } else for (const b of L.itens) linhas.push({ b });
  L.linhas = linhas;
  const cols = colunasAtivas();
  L.H = window.innerWidth < 640 ? 58 : 46;
  L.grid = cols.map(c => COLS_LISTA[c].w).join(' ');
  L.minW = cols.reduce((s, c) => s + largMin(c), 0);
  $('#tvCab').style.gridTemplateColumns = L.grid;
  $('#tvCab').style.minWidth = L.minW + 'px';
  $('#tvCab').innerHTML = cols.map(c => c === 'sel' ? `<div class="c-sel"><input type="checkbox" id="selTodos" title="Selecionar todos os ${L.itens.length}" aria-label="Selecionar todos"${L.itens.length && L.sel.size === L.itens.length ? ' checked' : ''}></div>` : `<div${COLS_LISTA[c].ord ? ` data-ord="${COLS_LISTA[c].ord}"` : ''} class="c-${c}${L.ordem === COLS_LISTA[c].ord && (c !== 'situacao' && c !== 'atualizado') ? ' ord' + (L.desc ? ' desc' : '') : ''}">${esc(COLS_LISTA[c].rot)}</div>`).join('');
  $('#tvCorpo').style.height = (linhas.length * L.H) + 'px';
  const tot = somaCent(L.itens, saldoDe);
  $('#resumoLista').innerHTML = L.itens.length ? `<span><b>${plural(L.itens.length, 'boleto')}</b> · saldo ${fmtBRL(tot)}</span>${L.itens.length > 1 ? '<span class="sub">Clique para abrir · Ctrl+clique ou espaço para selecionar vários · Shift+clique seleciona um intervalo</span>' : ''}` : '';
  const chip = [];
  if (L.f.lancamento != null) chip.push(`Todas as parcelas do lançamento <b>#${L.f.lancamento}</b>`);
  if (L.f.dia) chip.push(`Vencimento em <b>${fmtData(L.f.dia)}</b>`);
  if (L.f.ids) chip.push(`<b>${L.f.ids.size}</b> boletos escolhidos`);
  $('#chipFiltro').innerHTML = chip.length ? `<div class="chip-filtro"><span>${chip.join(' · ')}</span><button type="button" class="btn sec peq" data-limpa="1">Voltar à lista</button></div>` : '';
  if (!linhas.length) $('#tvCorpo').innerHTML = `<div class="vazio" style="position:absolute;inset:0 0 auto 0">${S.vista.tabs.boletos.linhas.length ? '<b>Nada por aqui</b>Nenhum boleto com esses filtros.' : '<b>Nenhum boleto lançado ainda</b>Use "Novo lançamento" ou "Mais › Importar boletos".'}</div>`;
  L._desenhado = null;
  desenharLinhas();
  atualizarSelecao();
}
function desenharLinhas() {
  const tv = $('#tv'); if (!tv || !L.linhas.length) return;
  const H = L.H, topo = tv.scrollTop - 40, alt = tv.clientHeight + 80;
  const ini = Math.max(0, Math.floor(topo / H) - 6), fim = Math.min(L.linhas.length, Math.ceil((topo + alt) / H) + 6);
  const chave = `${ini}:${fim}:${S.versao}:${L.linhas.length}:${L.grid}:${L.sel.size}:${L.foco}`;
  if (L._desenhado === chave) return;
  L._desenhado = chave;
  const cols = colunasAtivas();
  const out = [];
  const h = hoje(), dAl = cfgNum(S.vista, 'diasAlerta') || 7;
  for (let i = ini; i < fim; i++) {
    const it = L.linhas[i];
    if (it.grupo) { out.push(`<div class="tv-grupo" style="top:${i * H}px"><span>${esc(it.grupo)}</span><span class="tot num">${plural(it.itens.length, 'boleto')} · <b>${fmtBRL(it.tot)}</b></span></div>`); continue; }
    const b = it.b, s = situacao(b, h, dAl);
    const sel = L.sel.has(b.id);
    const celulas = window.innerWidth < 640
      ? [`<div class="c-sel"><input type="checkbox"${sel ? ' checked' : ''} aria-label="Selecionar"></div>`, `<div class="lin2"><b>${esc(nomeB(b))}</b><span class="t2l">${b.vencimento ? fmtDataCurta(b.vencimento) : '—'} · ${esc(b.parcela || '')} · ${esc(s.txt)}</span></div>`, `<div class="c-saldo"><b class="num">${fmtBRL(saldoDe(b))}</b></div>`]
      : cols.map(c => c === 'sel' ? `<div class="c-sel"><input type="checkbox"${sel ? ' checked' : ''} aria-label="Selecionar"></div>` : `<div class="c-${c}">${COLS_LISTA[c].h(b)}</div>`);
    out.push(`<div class="tv-lin st-${s.cls}${sel ? ' sel' : ''}${i === L.foco ? ' foco' : ''}" data-i="${i}" style="top:${i * H}px;height:${H}px;grid-template-columns:${L.grid};min-width:${L.minW}px">${celulas.join('')}</div>`);
  }
  $('#tvCorpo').innerHTML = out.join('');
}
function atualizarSelecao() {
  L._desenhado = null; desenharLinhas();
  const n = L.sel.size, box = $('#acoesLote');
  const st = $('#selTodos'); if (st) st.checked = L.itens.length > 0 && n === L.itens.length;
  if (!n) { box.innerHTML = ''; return; }
  const bs = [...L.sel].map(id => S.ix.boletoPorId.get(id)).filter(Boolean);
  const lix = bs.every(b => b.excluidoEm);
  box.innerHTML = `<div class="acoes-lote"><b>${plural(n, 'selecionado')}</b><span class="num">${fmtBRL(somaCent(bs, saldoDe))}</span><span class="esp" style="flex:1"></span>
    ${lix ? '<button type="button" class="btn peq" data-lote="restaurar">Restaurar</button>' : `<button type="button" class="btn ok peq" data-lote="baixa">${ICON.check} Dar baixa</button>
    <button type="button" class="btn sec peq" data-lote="contato">Registrar contato</button><button type="button" class="btn sec peq" data-lote="etapa">Etapa…</button>
    <button type="button" class="btn sec peq" data-lote="responsavel">Responsável…</button><button type="button" class="btn sec peq" data-lote="renegociar">Renegociar</button>
    <button type="button" class="btn sec peq" data-lote="exportar">Exportar</button><button type="button" class="btn sec peq" data-lote="lixeira">${ICON.lixo} Lixeira</button>`}
    <button type="button" class="btn sec peq" data-lote="limpar">Limpar seleção</button></div>`;
}
function acaoLote(a, btn) {
  const ids = [...L.sel];
  if (a === 'limpar') { L.sel.clear(); atualizarSelecao(); return; }
  if (a === 'exportar') { exportarLista('xlsx', ids.map(id => S.ix.boletoPorId.get(id))); return; }
  if (a === 'etapa') { abrirMenu(btn, etapas(S.vista).map(e => `<button data-m="${esc(e)}">${esc(e)}</button>`).join(''), m => janelaEtapa(ids, m)); return; }
  if (a === 'responsavel') {
    const r = [...new Set([...listaCfg(S.vista.config.responsaveis), USUARIO()])].filter(x => x !== 'Sem nome');
    abrirMenu(btn, r.map(e => `<button data-m="${esc(e)}">${esc(e)}</button>`).join('') + '<hr><button data-m="__outro">Outro nome…</button><button data-m="__nenhum">Tirar o responsável</button>', async m => {
      if (m === '__outro') m = await pedirTexto('Responsável', 'Nome do responsável:', '', 'Aplicar'); if (m == null) return;
      executar(`Responsável: ${m === '__nenhum' ? '(nenhum)' : m} em ${plural(ids.length, 'boleto')}`, opsCampoLote(S.vista, ids, { responsavel: m === '__nenhum' ? '' : m }, novoCtx(USUARIO()), 'Mudou responsável'), { backup: ids.length > 20 ? 'responsavel em lote' : null });
    }); return;
  }
  acaoBoleto(a, ids);
}
function teclaLista(e) {
  if (e.target.closest('input,select,textarea,button')) { if (!(e.target.type === 'checkbox' && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) return; }
  const n = L.linhas.length; if (!n) return;
  const valida = i => L.linhas[i] && !L.linhas[i].grupo;
  const mover = (d, de = L.foco) => {
    let i = Math.max(0, Math.min(n - 1, de + d));
    while (!valida(i) && i + Math.sign(d || 1) >= 0 && i + Math.sign(d || 1) < n) i += Math.sign(d || 1);
    if (!valida(i)) { i = Math.max(0, Math.min(n - 1, de)); while (!valida(i) && i < n - 1) i++; }
    L.foco = i;
    const tv = $('#tv'); const y = i * L.H;
    if (y < tv.scrollTop + 40) tv.scrollTop = y - 40; else if (y + L.H > tv.scrollTop + tv.clientHeight) tv.scrollTop = y + L.H - tv.clientHeight;
    L._desenhado = null; desenharLinhas();
  };
  const b = L.linhas[L.foco] && L.linhas[L.foco].b;
  if (e.key === 'ArrowDown') { e.preventDefault(); mover(L.foco < 0 ? 1 : 1, L.foco < 0 ? -1 : L.foco); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
  else if (e.key === 'Home') { e.preventDefault(); mover(1, -1); }
  else if (e.key === 'End') { e.preventDefault(); mover(-1, n); }
  else if (e.key === 'Enter' && b) { e.preventDefault(); abrirGaveta(b.id); }
  else if (e.key === ' ' && b) { e.preventDefault(); if (L.sel.has(b.id)) L.sel.delete(b.id); else L.sel.add(b.id); atualizarSelecao(); }
  else if (b && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const k = e.key.toLowerCase();
    const alvo = L.sel.size ? [...L.sel] : [b.id];
    if (k === 'r') { e.preventDefault(); acaoBoleto('baixa', alvo); }
    else if (k === 'c') { e.preventDefault(); acaoBoleto('contato', alvo); }
    else if (k === 'm') { e.preventDefault(); acaoBoleto('mensagem', [b.id]); }
    else if (e.key === 'Delete') { e.preventDefault(); acaoBoleto('lixeira', alvo); }
  }
}

/* Exportar o que está na tela (CSV ou XLSX) */
async function exportarLista(tipo, lista) {
  const itens = lista || L.itens;
  if (tipo === 'imprimir') { imprimirPainel('p-boletos'); return; }
  const cols = ['id', 'vencimento', 'status', 'valor', 'saldo', 'valorPago', 'parcela', 'setor', 'pdv', 'cliente', 'doc', 'numDoc', 'nossoNumero', 'etapa', 'promessaEm', 'proxAcao', 'proxAcaoEm', 'responsavel', 'pagoEm', 'formaPagamento', 'obs', 'lancamento'];
  const nome = `Boletos ${carimboArquivo()}`;
  if (tipo === 'csv') {
    const def = ESQUEMA.boletos.porK;
    const linhas = [[...cols.map(k => def[k].h), 'Valor atualizado']];
    for (const b of itens) linhas.push([...cols.map(k => { const c = def[k], v = b[k]; if (vazio(v)) return ''; if (c.tipo === 'data') return fmtData(v); if (c.tipo === 'moeda') return NUM2.format(v); return v; }), NUM2.format(atualizado(b).total)]);
    baixarArquivo('﻿' + gerarCSV(linhas), nome + '.csv', 'text/csv;charset=utf-8');
    return;
  }
  const d = docVazio();
  d.config = { ...S.vista.config };
  d.tabs.boletos.linhas = itens.map(b => ({ ...b, _x: undefined, _r0: undefined }));
  d.tabs.boletos.ordem = cols.map(k => ({ k }));
  const ids = new Set(itens.map(b => b.id));
  d.tabs.pagamentos.linhas = S.vista.tabs.pagamentos.linhas.filter(p => ids.has(p.boleto));
  baixarArquivo(await gerarPlanilha(d), nome + '.xlsx');
}

/* --------------------------------------------------- DETALHE (gaveta) */
let G = { id: null, editando: false };
function abrirGaveta(id) {
  G = { id, editando: false };
  if (!$('#gaveta')) {
    const c = $('#camada');
    c.insertAdjacentHTML('afterbegin', '<div class="fundo" id="gFundo"></div><aside class="gaveta" id="gaveta" role="dialog" aria-modal="true" aria-labelledby="gTitulo"><div class="gaveta-topo" id="gTopo"></div><div class="gaveta-corpo" id="gCorpo"></div></aside>');
    $('#gFundo').addEventListener('click', fecharGaveta);
    $('#gaveta').addEventListener('click', cliqueGaveta);
    $('#gaveta').addEventListener('submit', submeterEdicao);
  }
  desenharGaveta();
  setTimeout(() => { const f = $('#gaveta .acoes-rapidas button'); if (f) f.focus(); }, 30);
}
function fecharGaveta() { const g = $('#gaveta'); if (!g) return; g.remove(); $('#gFundo').remove(); G.id = null; const tv = $('#tv'); if (UI.aba === 'boletos' && tv) tv.focus(); }
function atualizarGaveta() { if (G.id != null && $('#gaveta') && !G.editando) desenharGaveta(); }
function desenharGaveta() {
  const b = S.ix.boletoPorId.get(G.id);
  if (!b) { $('#gTopo').innerHTML = '<h2 id="gTitulo">Boleto não encontrado</h2><button type="button" class="icone" data-g="fechar" aria-label="Fechar">' + ICON.x + '</button>'; $('#gCorpo').innerHTML = '<p>Ele pode ter sido apagado direto na planilha.</p>'; return; }
  const at = atualizado(b), cli = clienteDoBoleto(S.ix, b);
  const chk = b.doc ? checarDoc(b.doc) : null;
  $('#gTopo').innerHTML = `<div style="min-width:0"><h2 id="gTitulo">${esc(nomeB(b))}</h2><span class="sub">${esc([b.pdv && 'PDV ' + b.pdv, b.setor, 'parcela ' + (b.parcela || '—'), 'ID ' + b.id].filter(Boolean).join(' · '))}</span><div style="margin-top:6px">${tagSit(b)} ${b.status === 'Em aberto' ? `<span class="tag info">${esc(b.etapa || etapaInicial)}</span>` : ''}</div></div><button type="button" class="icone" data-g="fechar" aria-label="Fechar (Esc)">${ICON.x}</button>`;
  if (G.editando) { $('#gCorpo').innerHTML = formEdicao(b); setTimeout(() => $('#eVenc') && $('#eVenc').focus(), 20); return; }
  const pags = (S.ix.pagPorBoleto.get(b.id) || []).slice().sort((x, y) => (y.registradoEm || 0) - (x.registradoEm || 0));
  const conts = S.ix.contPorBoleto.get(b.id) || [];
  const hist = S.vista.tabs.historico.linhas.filter(h => h.boleto === b.id);
  const tempo = [
    ...conts.map(c => ({ t: c.dataHora || 0, cls: '', html: `<div class="q"><b>${esc(c.canal || 'Contato')}</b>${c.falouCom ? ' com ' + esc(c.falouCom) : ''} · ${esc(serialParaTexto(c.dataHora))} · ${esc(c.registradoPor || '')}</div>${c.anotacao ? `<div>${esc(c.anotacao)}</div>` : ''}${c.promessaEm ? `<div class="tag promessa">Prometeu para ${fmtData(c.promessaEm)}</div>` : ''}${c.proxAcao || c.proxAcaoEm ? `<div class="sub">Próxima ação: ${esc(c.proxAcao || '')} ${c.proxAcaoEm ? fmtData(c.proxAcaoEm) : ''}</div>` : ''}` })),
    ...pags.map(p => ({ t: p.registradoEm || 0, cls: p.estornadoEm ? 'est' : 'pag', html: `<div class="q"><b>${p.estornadoEm ? 'Pagamento estornado' : 'Pagamento'}</b> · ${esc(fmtData(p.data))} · ${esc(p.forma || '')} · ${esc(p.registradoPor || '')}${p.origem && p.origem !== 'Manual' ? ' · ' + esc(p.origem) : ''}</div><div><b class="num">${fmtBRL(p.valor)}</b>${p.juros ? ` <span class="sub">(juros/multa ${fmtBRL(p.juros)})</span>` : ''}${p.desconto ? ` <span class="sub">(desconto ${fmtBRL(p.desconto)})</span>` : ''}${p.estornadoEm ? ` <span class="sub">estornado por ${esc(p.estornadoPor || '')} em ${esc(serialParaTexto(p.estornadoEm))}</span>` : ` <button type="button" class="btn texto" data-g="estornar" data-p="${p.id}">Estornar</button>`}</div>` })),
    ...hist.filter(x => !/contato|Baixa|Pagamento parcial|Estornou/.test(x.acao)).map(x => ({ t: x.dataHora || 0, cls: 'sis', html: `<div class="q"><b>${esc(x.acao)}</b> · ${esc(serialParaTexto(x.dataHora))} · ${esc(x.usuario || '')}</div>${x.detalhe ? `<div class="sub">${esc(x.detalhe)}</div>` : ''}` }))
  ].sort((a, c) => c.t - a.t);
  const reneg = b.renegociadoPara ? `<dt>Renegociado</dt><dd>No lançamento <button type="button" class="btn texto" data-g="lanc" data-l="${esc(b.renegociadoPara)}">#${esc(b.renegociadoPara)}</button></dd>` : '';
  const de = b.renegociadoDe ? `<dt>Renegociação de</dt><dd>${String(b.renegociadoDe).split(/[;,\s]+/).filter(Boolean).map(x => `<button type="button" class="btn texto" data-g="abrir" data-id="${esc(x)}">boleto ${esc(x)}</button>`).join(' ')}</dd>` : '';
  $('#gCorpo').innerHTML = `
    <div class="acoes-rapidas">${b.excluidoEm ? `<button type="button" class="btn" data-g="restaurar">Restaurar da lixeira</button>` : `
      ${b.status === 'Em aberto' ? `<button type="button" class="btn ok" data-g="baixa">${ICON.check} Dar baixa <kbd>R</kbd></button><button type="button" class="btn sec" data-g="contato">${ICON.fone} Contato <kbd>C</kbd></button><button type="button" class="btn sec" data-g="mensagem">${ICON.msg} Mensagem <kbd>M</kbd></button>` : `<button type="button" class="btn sec" data-g="reabrir">${ICON.desfaz} Reabrir (estornar baixa)</button>`}
      <button type="button" class="btn sec" data-g="editar">${ICON.editar} Editar <kbd>E</kbd></button><button type="button" class="btn sec" data-g="mais">${ICON.mais} Mais</button>`}</div>
    <div class="card" style="margin-bottom:12px"><dl class="dl">
      <dt>Saldo em aberto</dt><dd><b class="num" style="font-size:16px">${fmtBRL(saldoDe(b))}</b>${b.valor !== saldoDe(b) ? ` <span class="sub">de ${fmtBRL(b.valor)}</span>` : ''}</dd>
      ${at.dias > 0 ? `<dt>Atualizado hoje</dt><dd><b class="num">${fmtBRL(at.total)}</b> <span class="sub">${at.dias} dias · multa ${fmtBRL(at.multa)} + juros ${fmtBRL(at.juros)}</span></dd>` : ''}
      <dt>Vencimento</dt><dd>${b.vencimento ? fmtData(b.vencimento) + ' (' + DIAS_LONGO[diaSemana(b.vencimento)] + ')' : '—'}</dd>
      ${b.promessaEm ? `<dt>Promessa</dt><dd><span class="tag promessa">${fmtData(b.promessaEm)}</span>${b.promessaEm < hoje() && b.status === 'Em aberto' ? ' <span class="tag vencido">quebrada</span>' : ''}</dd>` : ''}
      ${b.proxAcao || b.proxAcaoEm ? `<dt>Próxima ação</dt><dd>${esc(b.proxAcao || '')} ${b.proxAcaoEm ? fmtData(b.proxAcaoEm) : ''}</dd>` : ''}
      <dt>Responsável</dt><dd>${esc(b.responsavel || '—')}</dd>
      ${b.pagoEm ? `<dt>Pago em</dt><dd>${fmtData(b.pagoEm)} ${b.formaPagamento ? '· ' + esc(b.formaPagamento) : ''}${b.valorPago ? ' · ' + fmtBRL(b.valorPago) : ''}</dd>` : ''}
    </dl></div>
    <div class="card" style="margin-bottom:12px"><h3>Dados do boleto</h3><dl class="dl">
      <dt>CNPJ/CPF</dt><dd>${esc(b.doc || '—')} ${chk && chk.tipo ? (chk.ok ? '<span class="tag pago">válido</span>' : '<span class="tag vencido">dígito errado</span>') : ''}</dd>
      <dt>Nº documento</dt><dd>${esc(b.numDoc || '—')}</dd>
      ${b.nossoNumero ? `<dt>Nosso número</dt><dd>${esc(b.nossoNumero)}</dd>` : ''}
      ${b.linhaDigitavel ? `<dt>Linha digitável</dt><dd><span class="num">${esc(fmtLinha(b.linhaDigitavel))}</span> <button type="button" class="btn texto" data-g="copiarLinha">${ICON.copiar} copiar</button></dd>` : ''}
      ${b.obs ? `<dt>Observação</dt><dd>${esc(b.obs)}</dd>` : ''}
      <dt>Lançamento</dt><dd>${b.lancamento ? `<button type="button" class="btn texto" data-g="lanc" data-l="${b.lancamento}">#${b.lancamento} · ver todas as parcelas</button>` : '—'}</dd>${reneg}${de}
      ${cli ? `<dt>Contato</dt><dd>${esc([cli.contato, cli.telefone, cli.whatsapp && 'Whats ' + cli.whatsapp, cli.email].filter(Boolean).join(' · ') || '—')} <button type="button" class="btn texto" data-g="cliente" data-c="${cli.id}">ficha do cliente</button></dd>` : ''}
      <dt>Cadastrado</dt><dd class="sub">${esc(serialParaTexto(b.criadoEm))} ${esc(b.criadoPor || '')}</dd>
      <dt>Alterado</dt><dd class="sub">${esc(serialParaTexto(b.alteradoEm))} ${esc(b.alteradoPor || '')}</dd>
      ${b.excluidoEm ? `<dt>Na lixeira</dt><dd class="sub">desde ${esc(serialParaTexto(b.excluidoEm))} (${esc(b.excluidoPor || '')})</dd>` : ''}
    </dl></div>
    <div class="card"><h3>Linha do tempo</h3>${tempo.length ? `<ul class="linha-tempo">${tempo.map(x => `<li class="${x.cls}">${x.html}</li>`).join('')}</ul>` : '<p class="sub">Nenhum contato ou pagamento registrado ainda.</p>'}</div>`;
}
function formEdicao(b) {
  const campo = (id, rot, val, tipo = 'text', extra = '') => `<div class="campo"><label for="${id}">${rot}</label><input id="${id}" type="${tipo}" value="${esc(val ?? '')}" ${extra}></div>`;
  return `<form id="formEdicao" class="card" novalidate><h3>Editar boleto</h3><div class="campos">
    ${campo('eVenc', 'Vencimento', b.vencimento, 'date')}${campo('eValor', 'Valor (R$)', typeof b.valor === 'number' ? NUM2.format(b.valor) : b.valor, 'text', 'inputmode="decimal"')}
    ${campo('eParcela', 'Parcela', b.parcela)}${campo('eSetor', 'Setor', b.setor, 'text', 'list="dlSetores"')}
    ${campo('ePdv', 'PDV', b.pdv, 'text', 'list="dlPdvs"')}${campo('eCliente', 'Cliente', b.cliente)}
    ${campo('eDoc', 'CNPJ/CPF', b.doc)}${campo('eNumDoc', 'Nº documento', b.numDoc)}
    ${campo('eNosso', 'Nosso número', b.nossoNumero)}${campo('eResp', 'Responsável', b.responsavel, 'text', 'list="dlResp"')}
    <div class="campo"><label for="eEtapa">Etapa de cobrança</label><select id="eEtapa">${opcoes(etapas(S.vista), b.etapa || etapaInicial)}</select></div>
    ${campo('ePromessa', 'Promessa de pagamento', b.promessaEm, 'date')}
    ${campo('eProx', 'Próxima ação', b.proxAcao)}${campo('eProxEm', 'Data da próxima ação', b.proxAcaoEm, 'date')}
    <div class="campo"><label for="eStatus">Status</label><select id="eStatus">${opcoes(STATUS, b.status)}</select></div>${campo('ePago', 'Pago em', b.pagoEm, 'date')}
    <div class="campo l2"><label for="eLinha">Linha digitável</label><input id="eLinha" value="${esc(b.linhaDigitavel || '')}" inputmode="numeric"></div>
    <div class="campo l2"><label for="eObs">Observação</label><input id="eObs" value="${esc(b.obs || '')}"></div>
    ${b.lancamento && (S.ix.porLanc.get(b.lancamento) || []).length > 1 ? `<label class="check l2" style="grid-column:1/-1"><input type="checkbox" id="eProximos"> Aplicar também às próximas parcelas em aberto deste lançamento (vencimento desloca pelos mesmos dias)</label>` : ''}
  </div><div class="modal-acoes"><button type="button" class="btn sec" data-g="cancelarEdicao">Cancelar</button><button type="submit" class="btn">Salvar alterações</button></div></form>`;
}
function submeterEdicao(e) {
  if (e.target.id !== 'formEdicao') return;
  e.preventDefault();
  const b = S.ix.boletoPorId.get(G.id); if (!b) return;
  const val = id => $('#' + id).value.trim();
  const v = lerValor(val('eValor'));
  if (!isoValida(val('eVenc'))) { aviso('Informe um vencimento válido.', { erro: true }); $('#eVenc').focus(); return; }
  if (!(v > 0)) { aviso('Informe um valor maior que zero.', { erro: true }); $('#eValor').focus(); return; }
  const campos = { vencimento: val('eVenc'), valor: v, parcela: val('eParcela'), setor: val('eSetor'), pdv: val('ePdv'), cliente: val('eCliente'), doc: val('eDoc'), numDoc: val('eNumDoc'), nossoNumero: val('eNosso'), responsavel: val('eResp'), etapa: val('eEtapa'), promessaEm: val('ePromessa'), proxAcao: val('eProx'), proxAcaoEm: val('eProxEm'), status: val('eStatus'), pagoEm: val('ePago'), linhaDigitavel: val('eLinha').replace(/\D/g, ''), obs: val('eObs') };
  if (campos.status !== 'Pago') campos.pagoEm = '';
  else if (!campos.pagoEm) campos.pagoEm = hoje();
  const ops = opsEditar(S.vista, b.id, campos, novoCtx(USUARIO()), { proximos: $('#eProximos') && $('#eProximos').checked });
  G.editando = false;
  executar(ops.length ? 'Boleto alterado' : 'Nada mudou', ops);
  desenharGaveta();
}
async function cliqueGaveta(e) {
  const g = e.target.closest('[data-g]'); if (!g) return;
  const id = G.id, a = g.dataset.g;
  if (a === 'fechar') return fecharGaveta();
  if (a === 'editar') { G.editando = true; return desenharGaveta(); }
  if (a === 'cancelarEdicao') { G.editando = false; return desenharGaveta(); }
  if (a === 'lanc') { fecharGaveta(); irParaBoletos({ lancamento: +g.dataset.l, status: 'todos' }); return; }
  if (a === 'abrir') return abrirGaveta(+g.dataset.id);
  if (a === 'cliente') { fecharGaveta(); abrirCliente(+g.dataset.c); return; }
  if (a === 'copiarLinha') { const b = S.ix.boletoPorId.get(id); if (await copiarTexto(b.linhaDigitavel)) aviso('Linha digitável copiada.'); return; }
  if (a === 'estornar') { const p = S.vista.tabs.pagamentos.linhas.find(x => x.id === +g.dataset.p); if (p && await confirmar('Estornar este pagamento?', `${fmtBRL(p.valor)} de ${fmtData(p.data)}. O boleto volta a ficar em aberto pelo valor estornado.`, 'Estornar', true)) executar('Pagamento estornado', opsEstorno(S.vista, [p.id], novoCtx(USUARIO()))); return; }
  if (a === 'mais') {
    const b = S.ix.boletoPorId.get(id);
    abrirMenu(g, `<button data-m="renegociar">Renegociar…</button><button data-m="duplicar">Duplicar (novo lançamento parecido)</button>${b.lancamento ? '<button data-m="lancamento">Ver lançamento inteiro</button><button data-m="lixeiraLanc">Pôr o lançamento inteiro na lixeira</button>' : ''}<button data-m="cancelar">Marcar como cancelado</button><hr><button data-m="lixeira">${ICON.lixo} Pôr na lixeira</button>`, m => {
      if (m === 'lancamento') { fecharGaveta(); irParaBoletos({ lancamento: b.lancamento, status: 'todos' }); }
      else if (m === 'lixeiraLanc') { const ids = (S.ix.porLanc.get(b.lancamento) || []).filter(x => !x.excluidoEm).map(x => x.id); executar(`Lançamento #${b.lancamento} na lixeira (${plural(ids.length, 'parcela')})`, opsLixeira(S.vista, 'boletos', ids, novoCtx(USUARIO()))); fecharGaveta(); }
      else if (m === 'duplicar') { fecharGaveta(); duplicarParaNovo(b); }
      else if (m === 'cancelar') executar('Boleto cancelado', opsStatus(S.vista, [b.id], 'Cancelado', novoCtx(USUARIO()), 'Cancelou'));
      else acaoBoleto(m, [id]);
    });
    return;
  }
  acaoBoleto(a, [id]);
}

/* --------------------------------------------------- ações e janelas */
function acaoBoleto(a, ids) {
  ids = ids.filter(id => S.ix.boletoPorId.has(id));
  if (!ids.length) return;
  const ctx = () => novoCtx(USUARIO());
  if (a === 'baixa') return ids.length === 1 ? janelaBaixa(ids[0]) : janelaBaixaLote(ids);
  if (a === 'contato') return janelaContato(ids);
  if (a === 'mensagem') return janelaMensagem(ids[0]);
  if (a === 'renegociar') return janelaRenegociar(ids);
  if (a === 'reabrir') { const b = S.ix.boletoPorId.get(ids[0]); return executar(ids.length > 1 ? `${plural(ids.length, 'boleto reaberto', 'boletos reabertos')}` : `Reaberto: ${nomeB(b)}`, opsReabrir(S.vista, ids, ctx())); }
  if (a === 'lixeira') { const r = executar(ids.length > 1 ? `${plural(ids.length, 'boleto')} na lixeira` : 'Boleto na lixeira', opsLixeira(S.vista, 'boletos', ids, ctx()), { backup: ids.length > 20 ? 'lixeira em lote' : null }); if (r) { L.sel.clear(); if (G.id && ids.includes(G.id)) fecharGaveta(); } return; }
  if (a === 'restaurar') { executar(ids.length > 1 ? `${plural(ids.length, 'boleto restaurado', 'boletos restaurados')}` : 'Boleto restaurado', opsLixeira(S.vista, 'boletos', ids, ctx(), true)); L.sel.clear(); return; }
}
function opcoesForma(atual) { return opcoes(cfgLista('formas'), atual || lsGet('bc2.ultimaForma', '')); }
function janelaBaixa(id) {
  const b = S.ix.boletoPorId.get(id); if (!b || b.status !== 'Em aberto') return;
  const s = saldoDe(b), at = atualizado(b);
  const box = abrirJanela(`<form novalidate><h3>Dar baixa</h3><p>${esc(nomeB(b))} · parcela ${esc(b.parcela || '—')} · saldo <b>${fmtBRL(s)}</b>${at.dias > 0 ? ` · atualizado <b>${fmtBRL(at.total)}</b> (${at.dias} dias)` : ''}</p>
    <div class="campos">
      <div class="campo"><label for="bData">Data do pagamento</label><input id="bData" type="date" value="${hoje()}"></div>
      <div class="campo"><label for="bForma">Forma de pagamento</label><select id="bForma">${opcoesForma()}</select></div>
      <div class="campo"><label for="bValor">Valor recebido (R$)</label><input id="bValor" inputmode="decimal" value="${NUM2.format(s)}" autofocus></div>
      <div class="campo"><label for="bJuros">Juros/multa cobrados (R$)</label><input id="bJuros" inputmode="decimal" value="0,00"></div>
      <div class="campo"><label for="bDesc">Desconto dado (R$)</label><input id="bDesc" inputmode="decimal" value="0,00"></div>
      <div class="campo"><label for="bObs">Observação</label><input id="bObs"></div>
      ${at.dias > 0 ? `<label class="check l2" style="grid-column:1/-1"><input type="checkbox" id="bEncargos"> Cobrou multa e juros (${fmtBRL(at.multa + at.juros)}): somar ao valor recebido</label>` : ''}
    </div>
    <p class="dica" id="bResumo" style="margin-top:10px"></p>
    <div class="modal-acoes"><button type="button" class="btn sec" data-f="1">Cancelar</button><button type="submit" class="btn">Confirmar baixa</button></div></form>`);
  const calc = () => {
    const v = lerValor($('#bValor', box).value) || 0, j = lerValor($('#bJuros', box).value) || 0, d = lerValor($('#bDesc', box).value) || 0;
    const resta = arred2(s - (v - j + d));
    $('#bResumo', box).innerHTML = resta <= 0.004 ? `<span class="dica ok">Quita o boleto.${resta < -0.004 ? ` Recebido a mais: ${fmtBRL(-resta)}.` : ''}</span>` : `<span class="dica alerta">Pagamento parcial: fica um saldo de <b>${fmtBRL(resta)}</b> em aberto.</span>`;
  };
  box.addEventListener('input', calc);
  box.addEventListener('change', e => {
    if (e.target.id === 'bEncargos') { const enc = arred2(at.multa + at.juros); $('#bJuros', box).value = NUM2.format(e.target.checked ? enc : 0); $('#bValor', box).value = NUM2.format(e.target.checked ? arred2(s + enc) : s); calc(); }
    if (e.target.id === 'bValor' || e.target.id === 'bJuros' || e.target.id === 'bDesc') { const v = lerValor(e.target.value); if (isFinite(v)) e.target.value = NUM2.format(v); }
  });
  calc();
  box.querySelector('[data-f]').onclick = fecharJanela;
  box.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const v = lerValor($('#bValor', box).value), j = lerValor($('#bJuros', box).value) || 0, d = lerValor($('#bDesc', box).value) || 0, data = $('#bData', box).value;
    if (!(v > 0) && !(d > 0)) { aviso('Informe o valor recebido.', { erro: true }); return; }
    if (!isoValida(data)) { aviso('Informe a data do pagamento.', { erro: true }); return; }
    const forma = $('#bForma', box).value; lsSet('bc2.ultimaForma', forma);
    fecharJanela();
    const ops = opsPagamento(S.vista, id, { data, valor: v || 0, juros: j, desconto: d, forma, obs: $('#bObs', box).value.trim() }, novoCtx(USUARIO()));
    executar(ops.some(o => o.tab === 'boletos' && o.c && o.c.status === 'Pago') ? `Baixa: ${nomeB(b)} (${fmtBRL(v)})` : `Pagamento parcial: ${fmtBRL(v)}`, ops);
  };
}
function janelaBaixaLote(ids) {
  const bs = ids.map(id => S.ix.boletoPorId.get(id)).filter(b => b && emAberto(b));
  if (!bs.length) { aviso('Nenhum dos selecionados está em aberto.'); return; }
  const tot = somaCent(bs, saldoDe), totAt = somaCent(bs, b => atualizado(b).total);
  const box = abrirJanela(`<form novalidate><h3>Baixa em lote</h3><p>${plural(bs.length, 'boleto')} em aberto · saldo total <b>${fmtBRL(tot)}</b>. Cada um é quitado pelo seu saldo.</p>
    <div class="campos"><div class="campo"><label for="lData">Data do pagamento</label><input id="lData" type="date" value="${hoje()}"></div>
    <div class="campo"><label for="lForma">Forma de pagamento</label><select id="lForma">${opcoesForma()}</select></div>
    ${totAt > tot ? `<label class="check l2" style="grid-column:1/-1"><input type="checkbox" id="lEnc"> Cobrou multa e juros (total com encargos ${fmtBRL(totAt)})</label>` : ''}</div>
    <div class="modal-acoes"><button type="button" class="btn sec" data-f="1">Cancelar</button><button type="submit" class="btn" autofocus>Dar baixa em ${plural(bs.length, 'boleto')}</button></div></form>`);
  box.querySelector('[data-f]').onclick = fecharJanela;
  box.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const data = $('#lData', box).value, forma = $('#lForma', box).value;
    if (!isoValida(data)) { aviso('Informe a data.', { erro: true }); return; }
    lsSet('bc2.ultimaForma', forma);
    fecharJanela();
    executar(`Baixa em lote: ${plural(bs.length, 'boleto')} (${fmtBRL(tot)})`, opsBaixaLote(S.vista, bs.map(b => b.id), { data, forma, comEncargos: $('#lEnc', box) && $('#lEnc', box).checked }, novoCtx(USUARIO())), { backup: bs.length >= 10 ? 'baixa em lote' : null });
    L.sel.clear();
  };
}
function janelaContato(ids) {
  const bs = ids.map(id => S.ix.boletoPorId.get(id)).filter(Boolean);
  const b = bs[0], cli = clienteDoBoleto(S.ix, b);
  const ets = etapas(S.vista), prom = ets.find(x => /promessa/i.test(x)) || '';
  const canais = cfgLista('canais');
  const ultimo = lsGet('bc2.ultimoCanal', canais[0]);
  const box = abrirJanela(`<form novalidate><h3>Registrar contato</h3><p>${bs.length > 1 ? plural(bs.length, 'boleto') + ' · ' : ''}${esc(nomeB(b))}${cli && (cli.telefone || cli.whatsapp) ? ` · ${esc(cli.whatsapp || cli.telefone)}` : ''}</p>
    <div class="campo" style="margin-bottom:10px"><span class="rot">Canal</span><div class="seg">${canais.map((c, i) => `<input type="radio" name="canal" id="cc${i}" value="${esc(c)}"${c === ultimo ? ' checked' : ''}><label for="cc${i}">${esc(c)}</label>`).join('')}</div></div>
    <div class="campos">
      <div class="campo"><label for="cFalou">Quem atendeu</label><input id="cFalou" value="${esc(cli && cli.contato || '')}" autofocus></div>
      <div class="campo"><label for="cEtapa">Etapa depois do contato</label><select id="cEtapa">${opcoes(ets, ets.includes(ets[1]) && (b.etapa || ets[0]) === ets[0] ? ets[1] : (b.etapa || ets[0]))}</select></div>
      <div class="campo l2"><label for="cNota">Anotação</label><textarea id="cNota" rows="3" placeholder="O que foi conversado"></textarea></div>
      <div class="campo"><label for="cPromessa">Promessa de pagamento para</label><input id="cPromessa" type="date" value="${esc(b.promessaEm && b.promessaEm >= hoje() ? b.promessaEm : '')}"></div>
      <div class="campo"><label for="cProxEm">Próxima ação em</label><input id="cProxEm" type="date"><div class="barra" style="gap:4px;margin-top:4px">${[['amanhã', 1], ['+2 dias', 2], ['+1 semana', 7]].map(([t, d]) => `<button type="button" class="btn sec peq" data-dias="${d}">${t}</button>`).join('')}</div></div>
      <div class="campo l2"><label for="cProx">Próxima ação</label><input id="cProx" placeholder="Ex.: ligar de novo, mandar 2ª via"></div>
    </div>
    <div class="modal-acoes"><button type="button" class="btn sec" data-f="1">Cancelar</button><button type="submit" class="btn">Registrar <kbd>Ctrl+Enter</kbd></button></div></form>`);
  box.querySelector('[data-f]').onclick = fecharJanela;
  box.addEventListener('click', e => { const d = e.target.closest('[data-dias]'); if (d) { $('#cProxEm', box).value = somaDias(hoje(), +d.dataset.dias); if (!$('#cProx', box).value) $('#cProx', box).value = 'Cobrar de novo'; } });
  box.addEventListener('change', e => { if (e.target.id === 'cPromessa' && e.target.value && prom) $('#cEtapa', box).value = prom; });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); box.querySelector('form').requestSubmit(); } });
  box.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const canal = (box.querySelector('input[name=canal]:checked') || {}).value || '';
    lsSet('bc2.ultimoCanal', canal);
    const dados = { canal, falouCom: $('#cFalou', box).value.trim(), anotacao: $('#cNota', box).value.trim(), etapa: $('#cEtapa', box).value, promessaEm: $('#cPromessa', box).value, proxAcao: $('#cProx', box).value.trim(), proxAcaoEm: $('#cProxEm', box).value };
    fecharJanela();
    executar(`Contato registrado${bs.length > 1 ? ` em ${plural(bs.length, 'boleto')}` : ''}`, opsContato(S.vista, bs.map(x => x.id), dados, novoCtx(USUARIO())));
  };
}
function janelaEtapa(ids, etapa) {
  const precisaData = /promessa/i.test(etapa);
  if (!precisaData) { executar(`Etapa "${etapa}" em ${plural(ids.length, 'boleto')}`, opsCampoLote(S.vista, ids, { etapa }, novoCtx(USUARIO()), 'Mudou etapa')); return; }
  const box = abrirJanela(`<form><h3>${esc(etapa)}</h3><p>Para qual data o cliente prometeu pagar?</p><input id="pData" type="date" value="${somaDias(hoje(), 1)}" autofocus><div class="modal-acoes"><button type="button" class="btn sec" data-f="1">Cancelar</button><button type="submit" class="btn">Aplicar</button></div></form>`);
  box.querySelector('[data-f]').onclick = fecharJanela;
  box.querySelector('form').onsubmit = e => { e.preventDefault(); const d = $('#pData', box).value; fecharJanela(); executar(`Promessa para ${fmtData(d)} em ${plural(ids.length, 'boleto')}`, opsCampoLote(S.vista, ids, { etapa, promessaEm: d }, novoCtx(USUARIO()), 'Registrou promessa')); };
}
function janelaMensagem(id) {
  const b = S.ix.boletoPorId.get(id); if (!b) return;
  const cli = clienteDoBoleto(S.ix, b);
  const vars = varsMensagem(S.vista, b, hoje());
  const modelos = { whats: ['WhatsApp', S.vista.config.modeloWhats], email: ['E-mail', S.vista.config.modeloEmail], texto: ['Texto curto', S.vista.config.modeloTexto] };
  const tel = cli && (cli.whatsapp || cli.telefone) || '';
  const box = abrirJanela(`<h3>Mensagem de cobrança</h3><p>${esc(nomeB(b))} · ${esc(b.parcela || '')} · venc. ${fmtData(b.vencimento)} · ${vars.dias_atraso ? vars.dias_atraso + ' dias de atraso · ' : ''}atualizado ${esc(vars.valor_atualizado)}</p>
    <div class="seg" style="margin-bottom:10px">${Object.entries(modelos).map(([k, [r]], i) => `<input type="radio" name="mod" id="md${k}" value="${k}"${i === 0 ? ' checked' : ''}><label for="md${k}">${r}</label>`).join('')}</div>
    <div class="campo" id="mAssuntoBox" hidden><label for="mAssunto">Assunto</label><input id="mAssunto"></div>
    <div class="campo"><label for="mTexto">Texto (pode editar antes de copiar)</label><textarea id="mTexto" rows="9"></textarea></div>
    <div class="campos" style="margin-top:10px"><div class="campo"><label for="mTel">WhatsApp / telefone</label><input id="mTel" value="${esc(tel)}" placeholder="(11) 99999-9999"></div><div class="campo"><label for="mEmail">E-mail</label><input id="mEmail" value="${esc(cli && cli.email || '')}"></div></div>
    <div class="modal-acoes"><button type="button" class="btn sec esq" data-m="contato">Registrar contato</button><button type="button" class="btn sec" data-m="email">Abrir e-mail</button><button type="button" class="btn sec" data-m="whats">Abrir WhatsApp</button><button type="button" class="btn" data-m="copiar">${ICON.copiar} Copiar</button></div>`, { largo: false });
  const montar = () => {
    const k = box.querySelector('input[name=mod]:checked').value;
    $('#mTexto', box).value = preencherModelo(modelos[k][1], vars);
    $('#mAssuntoBox', box).hidden = k !== 'email';
    $('#mAssunto', box).value = preencherModelo(S.vista.config.modeloEmailAssunto, vars);
  };
  montar();
  box.addEventListener('change', e => { if (e.target.name === 'mod') montar(); });
  box.addEventListener('click', async e => {
    const m = e.target.closest('[data-m]'); if (!m) return;
    const txt = $('#mTexto', box).value;
    if (m.dataset.m === 'copiar') { aviso(await copiarTexto(txt) ? 'Mensagem copiada.' : 'Não consegui copiar; selecione o texto e use Ctrl+C.'); }
    if (m.dataset.m === 'whats') { const t = $('#mTel', box).value; if (!t.replace(/\D/g, '')) { aviso('Informe o número do WhatsApp.', { erro: true }); return; } window.open(linkWhats(t, txt), '_blank', 'noopener'); }
    if (m.dataset.m === 'email') { const a = document.createElement('a'); a.href = `mailto:${encodeURIComponent($('#mEmail', box).value)}?subject=${encodeURIComponent($('#mAssunto', box).value)}&body=${encodeURIComponent(txt)}`; a.click(); }
    if (m.dataset.m === 'contato') { const canal = { whats: 'WhatsApp', email: 'E-mail', texto: '' }[box.querySelector('input[name=mod]:checked').value]; fecharJanela(); janelaContato([id]); if (canal) { const r = [...document.querySelectorAll('input[name=canal]')].find(x => x.value === canal); if (r) r.checked = true; $('#cNota').value = 'Mensagem de cobrança enviada'; } }
  });
}
function janelaRenegociar(ids) {
  const bs = ids.map(id => S.ix.boletoPorId.get(id)).filter(b => b && emAberto(b));
  if (!bs.length) { aviso('Selecione boletos em aberto para renegociar.', { erro: true }); return; }
  const docs = new Set(bs.map(b => docLimpo(b.doc) || normCab(b.pdv)));
  const tot = somaCent(bs, saldoDe), totAt = somaCent(bs, b => atualizado(b).total);
  const box = abrirJanela(`<form novalidate><h3>Renegociar</h3><p>${plural(bs.length, 'boleto')} · saldo ${fmtBRL(tot)}${totAt > tot ? ` · com multa e juros ${fmtBRL(totAt)}` : ''}${docs.size > 1 ? '<br><b style="color:var(--warn)">Atenção: os boletos são de clientes diferentes.</b>' : ''}</p>
    <div class="campos">
      ${totAt > tot ? `<label class="check l2" style="grid-column:1/-1"><input type="checkbox" id="rEnc"> Incluir multa e juros no novo valor</label>` : ''}
      <div class="campo"><label for="rTotal">Valor total renegociado (R$)</label><input id="rTotal" inputmode="decimal" value="${NUM2.format(tot)}"></div>
      <div class="campo"><label for="rQtd">Parcelas</label><input id="rQtd" type="number" min="1" max="120" value="3" autofocus></div>
      <div class="campo"><label for="rVenc">1º vencimento</label><input id="rVenc" type="date" value="${somaDias(hoje(), 7)}"></div>
      <div class="campo"><label for="rInt">Intervalo</label><select id="rInt"><option value="mensal">Todo mês</option><option value="dias">A cada 30 dias</option></select></div>
      <div class="campo l2"><label for="rObs">Observação</label><input id="rObs" value="Renegociação dos boletos ${esc(bs.map(b => b.id).join(', '))}"></div>
    </div>
    <div class="tabela-wrap" style="margin-top:10px"><table class="tabela"><thead><tr><th>Parcela</th><th>Vencimento</th><th class="dir">Valor</th></tr></thead><tbody id="rPrev"></tbody></table></div>
    <div class="modal-acoes"><button type="button" class="btn sec" data-f="1">Cancelar</button><button type="submit" class="btn">Renegociar</button></div></form>`);
  const prev = () => {
    const p = gerarParcelas({ qtd: $('#rQtd', box).value, valor: lerValor($('#rTotal', box).value), venc1: $('#rVenc', box).value, modo: 'total', intervalo: $('#rInt', box).value, dias: 30 });
    $('#rPrev', box).innerHTML = p.map(x => `<tr><td><span class="parc">${x.numero}/${x.total}</span></td><td>${fmtData(x.venc)}</td><td class="dir num">${fmtBRL(x.valor)}</td></tr>`).join('');
  };
  box.addEventListener('input', prev);
  box.addEventListener('change', e => { if (e.target.id === 'rEnc') { $('#rTotal', box).value = NUM2.format(e.target.checked ? totAt : tot); prev(); } });
  prev();
  box.querySelector('[data-f]').onclick = fecharJanela;
  box.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const total = lerValor($('#rTotal', box).value);
    if (!(total > 0) || !isoValida($('#rVenc', box).value)) { aviso('Confira o valor e o vencimento.', { erro: true }); return; }
    const ops = opsRenegociar(S.vista, bs.map(b => b.id), { qtd: $('#rQtd', box).value, venc1: $('#rVenc', box).value, intervalo: $('#rInt', box).value, dias: 30, valorTotal: total, obs: $('#rObs', box).value.trim() }, novoCtx(USUARIO()));
    fecharJanela();
    executar(`Renegociado: ${plural(ops.parcelas.length, 'parcela nova', 'parcelas novas')} (${fmtBRL(ops.total)})`, ops, { backup: 'renegociacao' });
    L.sel.clear();
  };
}
