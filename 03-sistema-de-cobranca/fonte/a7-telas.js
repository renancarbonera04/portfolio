/* =====================================================================
   TELAS — Clientes, Painel (gráficos e relatórios), Calendário,
   Conciliação, Importação, Lixeira, Histórico, Verificar, Config,
   Diagnóstico, Ajuda e atalhos de teclado
   ===================================================================== */
function imprimirPainel(id) {
  document.body.classList.add('imprimir-so'); $('#' + id).classList.add('imprimindo');
  setTimeout(() => { window.print(); document.body.classList.remove('imprimir-so'); $('#' + id).classList.remove('imprimindo'); }, 50);
}
/* ---------------- gráficos em SVG (feitos à mão) ---------------- */
const CORES_FAIXA = ['var(--accent)', '#e2c34d', '#e2a400', '#e07b39', '#d0482f', '#8e1b14'];
const larguraGraf = () => window.innerWidth < 600 ? 340 : 560;   // no celular, menos largura = letras maiores
function grafBarrasH(itens, opc = {}) {
  if (!itens.length) return '<p class="sub">Sem dados.</p>';
  const W = larguraGraf(), movel = W < 400, rotW = movel ? Math.min(opc.rotW || 150, 108) : (opc.rotW || 150), H = 26, alt = itens.length * H + 6;
  const max = Math.max(...itens.map(i => i.valor), 1);
  const barW = W - rotW - (movel ? 92 : 150);
  if (movel) itens = itens.map(i => ({ ...i, sub: '' }));
  return `<svg class="graf" viewBox="0 0 ${W} ${alt}" role="img" aria-label="${esc(opc.titulo || 'gráfico')}">${itens.map((it, k) => {
    const w = Math.max(it.valor > 0 ? 2 : 0, it.valor / max * barW), y = k * H + 3;
    return `<g${it.attr ? ' ' + it.attr : ''} style="${it.attr ? 'cursor:pointer' : ''}"><title>${esc(it.rot)}: ${esc(fmtBRL(it.valor))}${it.sub ? ' · ' + esc(it.sub) : ''}</title><text x="${rotW - 8}" y="${y + 15}" text-anchor="end" class="rotv">${esc(String(it.rot).slice(0, movel ? 15 : 24))}</text>
      <rect x="${rotW}" y="${y + 2}" width="${w}" height="${H - 10}" rx="4" style="fill:${it.cor || 'var(--accent)'}"/>
      <text x="${rotW + w + 6}" y="${y + 15}">${esc(fmtBRL(it.valor))}${it.sub ? ' · ' + esc(it.sub) : ''}</text></g>`;
  }).join('')}</svg>`;
}
function grafColunas(itens, opc = {}) {
  if (!itens.length) return '<p class="sub">Sem dados.</p>';
  const W = larguraGraf(), H = 200, base = 170, n = itens.length, larg = (W - 40) / n, passo = W < 400 && n > 7 ? 2 : 1;
  const series = opc.series || [{ k: 'valor', cor: 'var(--accent)' }];
  const max = Math.max(...itens.flatMap(i => series.map(s => i[s.k] || 0)), 1);
  const bw = Math.min(28, (larg - 8) / series.length);
  const linhas = [0.25, 0.5, 0.75, 1].map(f => `<line class="grade-l" x1="34" x2="${W}" y1="${base - f * (base - 18)}" y2="${base - f * (base - 18)}"/><text x="30" y="${base - f * (base - 18) + 4}" text-anchor="end">${esc(abrev(max * f))}</text>`).join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opc.titulo || 'gráfico')}">${linhas}<line class="eixo" x1="34" x2="${W}" y1="${base}" y2="${base}"/>${itens.map((it, k) => {
    const x0 = 40 + k * larg + (larg - bw * series.length) / 2;
    return series.map((s, j) => { const v = it[s.k] || 0, h = v / max * (base - 18); return `<rect x="${x0 + j * bw}" y="${base - h}" width="${bw - 2}" height="${h}" rx="3" style="fill:${s.cor}"><title>${esc(it.rot)} · ${esc(s.rot || '')} ${esc(fmtBRL(v))}${it.qtd != null ? ' · ' + plural(it.qtd, 'boleto') : ''}</title></rect>`; }).join('') +
      (k % passo === 0 ? `<text x="${40 + k * larg + larg / 2}" y="${base + 16}" text-anchor="middle">${esc(it.rot)}</text>` : '');
  }).join('')}</svg>`;
}
function abrev(v) { return v >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mi' : v >= 1e3 ? Math.round(v / 1e3) + ' mil' : String(Math.round(v)); }

/* ---------------- CLIENTES ---------------- */
const CL = { busca: '' };
function renderClientes() {
  const v = S.vista, h = hoje();
  const bol = v.tabs.boletos.linhas.filter(emAberto);
  const porCli = new Map();
  for (const b of bol) { const k = docLimpo(b.doc) || 'pdv:' + normCab(b.pdv); const a = porCli.get(k) || { ab: 0, venc: 0, n: 0 }; a.ab += cent(saldoDe(b)); if (b.vencimento && b.vencimento < h) a.venc += cent(saldoDe(b)); a.n++; porCli.set(k, a); }
  const busca = semAcento(CL.busca.trim());
  const lista = v.tabs.clientes.linhas.filter(c => !c.excluidoEm && (!busca || semAcento([c.nome, c.pdv, c.doc, docLimpo(c.doc), c.setor, c.contato, c.telefone, c.email, c.responsavel].join(' ')).includes(busca)))
    .map(c => ({ c, t: porCli.get(docLimpo(c.doc) || 'pdv:' + normCab(c.pdv)) || { ab: 0, venc: 0, n: 0 } }))
    .sort((a, b) => b.t.venc - a.t.venc || b.t.ab - a.t.ab || COLL.compare(a.c.nome || '', b.c.nome || ''));
  const p = $('#p-clientes');
  const foco = document.activeElement && document.activeElement.id === 'clBusca';
  p.innerHTML = `<div class="filtros card"><input type="search" id="clBusca" placeholder="Buscar cliente, PDV, CNPJ, contato…" value="${esc(CL.busca)}"><span class="esp" style="flex:1"></span><button type="button" class="btn" id="clNovo">Novo cliente</button></div>
    <div class="resumo-lista">${plural(lista.length, 'cliente')}${lista.length > 400 ? ' · mostrando os 400 primeiros (use a busca)' : ''}</div>
    <div class="lista-card tabela-wrap"><table class="tabela"><thead><tr><th>Cliente</th><th class="esconde-movel">PDV</th><th class="esconde-movel">CNPJ/CPF</th><th class="esconde-movel">Setor</th><th class="esconde-movel">Contato</th><th class="esconde-movel">Responsável</th><th class="dir">Em aberto</th><th class="dir">Vencido</th></tr></thead><tbody>
    ${lista.slice(0, 400).map(({ c, t }) => `<tr data-cli="${c.id}" style="cursor:pointer"><td><b>${esc(c.nome || '—')}</b></td><td class="esconde-movel">${esc(c.pdv || '')}</td><td class="num esconde-movel">${esc(c.doc || '')}</td><td class="esconde-movel">${esc(c.setor || '')}</td><td class="esconde-movel">${esc([c.contato, c.whatsapp || c.telefone].filter(Boolean).join(' · '))}</td><td class="esconde-movel">${esc(c.responsavel || '')}</td><td class="dir num">${t.ab ? fmtBRL(t.ab / 100) : ''}</td><td class="dir num" style="color:var(--danger)">${t.venc ? fmtBRL(t.venc / 100) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="vazio">Nenhum cliente. Eles são cadastrados sozinhos ao lançar boletos, ou pelo botão "Novo cliente".</td></tr>'}
    </tbody></table></div>`;
  if (foco) { const i = $('#clBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
$('#p-clientes').addEventListener('input', debounce(e => { if (e.target.id === 'clBusca') { CL.busca = e.target.value; renderClientes(); } }, 200));
$('#p-clientes').addEventListener('click', e => { if (e.target.closest('#clNovo')) return abrirCliente(null); const tr = e.target.closest('[data-cli]'); if (tr) abrirCliente(+tr.dataset.cli); });
function abrirCliente(id) {
  const c = id ? S.vista.tabs.clientes.linhas.find(x => x.id === id) : {};
  if (id && !c) return;
  const ext = id ? extratoCliente(S.vista, { doc: c.doc, pdv: c.pdv }) : null;
  const campo = (k, rot, tipo = 'text', extra = '') => `<div class="campo"><label for="k_${k}">${rot}</label><input id="k_${k}" type="${tipo}" value="${esc(k === 'limite' && typeof c[k] === 'number' ? NUM2.format(c[k]) : c[k] ?? '')}" ${extra}></div>`;
  const ab = ext ? ext.boletos.filter(emAberto) : [];
  const box = abrirJanela(`<form novalidate id="formCli"><div class="barra"><h3 style="margin:0">${id ? esc(c.nome || 'Cliente') : 'Novo cliente'}</h3><span class="esp" style="flex:1"></span>${id ? `<button type="button" class="btn sec peq" data-k="lancar">Novo lançamento</button><button type="button" class="btn sec peq" data-k="imprimir">${ICON.imprimir} Imprimir extrato</button>` : ''}</div>
    <div class="campos" style="margin-top:12px">${campo('nome', 'Nome / razão social *')}${campo('pdv', 'PDV')}${campo('doc', 'CNPJ/CPF')}${campo('setor', 'Setor', 'text', 'list="dlSetores"')}
    ${campo('contato', 'Pessoa de contato')}${campo('telefone', 'Telefone')}${campo('whatsapp', 'WhatsApp')}${campo('email', 'E-mail', 'email')}
    ${campo('limite', 'Limite de crédito (R$)', 'text', 'inputmode="decimal"')}${campo('responsavel', 'Responsável', 'text', 'list="dlResp"')}
    <div class="campo l2"><label for="k_obs">Observações</label><textarea id="k_obs" rows="2">${esc(c.obs || '')}</textarea></div></div>
    <div class="modal-acoes">${id ? `<button type="button" class="btn sec esq" data-k="lixeira">${ICON.lixo} Pôr na lixeira</button>` : ''}<button type="button" class="btn sec" data-k="fechar">Fechar</button><button type="submit" class="btn">${id ? 'Salvar' : 'Cadastrar'}</button></div>
    ${ext ? `<div id="extrato" style="margin-top:16px"><h3>Extrato · em aberto ${fmtBRL(somaCent(ab, saldoDe))} (${plural(ab.length, 'boleto')})</h3>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Venc.</th><th>Parcela</th><th>Nº doc</th><th>Situação</th><th class="dir">Valor</th><th class="dir">Saldo</th></tr></thead><tbody>
      ${ext.boletos.map(b => `<tr data-bol="${b.id}" style="cursor:pointer"><td>${fmtData(b.vencimento)}</td><td>${esc(b.parcela || '')}</td><td>${esc(b.numDoc || '')}</td><td>${tagSit(b)}</td><td class="dir num">${fmtBRL(b.valor)}</td><td class="dir num">${fmtBRL(saldoDe(b))}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Nenhum boleto.</td></tr>'}</tbody></table></div>
      ${ext.pagamentos.length ? `<h3 style="margin-top:14px">Pagamentos</h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Boleto</th><th>Forma</th><th class="dir">Valor</th></tr></thead><tbody>${ext.pagamentos.map(p => `<tr><td>${fmtData(p.data)}</td><td>${p.boleto} · ${esc(p.parcela || '')}</td><td>${esc(p.forma || '')}${p.estornadoEm ? ' <span class="tag vencido">estornado</span>' : ''}</td><td class="dir num">${fmtBRL(p.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${ext.contatos.length ? `<h3 style="margin-top:14px">Contatos</h3><ul class="linha-tempo">${ext.contatos.slice(0, 30).map(x => `<li><div class="q"><b>${esc(x.canal || '')}</b> · ${esc(serialParaTexto(x.dataHora))} · ${esc(x.registradoPor || '')}</div><div>${esc(x.anotacao || '')}</div></li>`).join('')}</ul>` : ''}
    </div>` : ''}</form>`, { largo: true });
  box.addEventListener('click', async e => {
    const k = e.target.closest('[data-k]'), bol = e.target.closest('[data-bol]');
    if (bol) { fecharJanela(); abrirGaveta(+bol.dataset.bol); return; }
    if (!k) return;
    if (k.dataset.k === 'fechar') fecharJanela();
    if (k.dataset.k === 'lixeira') { fecharJanela(); executar('Cliente na lixeira', opsLixeira(S.vista, 'clientes', [id], novoCtx(USUARIO()))); }
    if (k.dataset.k === 'lancar') { fecharJanela(); mostrarAba('novo'); limparForm(); for (const [i, kk] of [['setor', 'setor'], ['pdv', 'pdv'], ['cliente', 'nome'], ['doc', 'doc'], ['responsavel', 'responsavel']]) $('#' + i).value = c[kk] || ''; validarDocUI(true); $('#numDoc').focus(); }
    if (k.dataset.k === 'imprimir') imprimirExtrato(c, ext);
  });
  box.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const dados = Object.fromEntries(CAMPOS_CLIENTE.map(k => [k, ($('#k_' + k, box) || {}).value || '']));
    if (!dados.nome.trim()) { aviso('Informe o nome.', { erro: true }); return; }
    if (dados.doc && !checarDoc(dados.doc).ok) aviso('Atenção: o CNPJ/CPF não passou na conferência dos dígitos.', { alerta: true });
    const ops = opsCliente(S.vista, id, dados, novoCtx(USUARIO()));
    fecharJanela();
    executar(id ? 'Cliente atualizado' : 'Cliente cadastrado', ops);
  };
}
function imprimirExtrato(c, ext) {
  const ab = ext.boletos.filter(emAberto);
  $('#p-impressao').innerHTML = `<div class="card"><h2>Extrato do cliente — ${esc(c.nome || '')}</h2><p class="sub">${esc([c.pdv && 'PDV ' + c.pdv, c.doc, c.setor].filter(Boolean).join(' · '))} · emitido em ${fmtData(hoje())} por ${esc(USUARIO())}</p>
    <p><b>Em aberto: ${fmtBRL(somaCent(ab, saldoDe))}</b> em ${plural(ab.length, 'boleto')} · vencido: ${fmtBRL(somaCent(ab.filter(b => b.vencimento < hoje()), saldoDe))}</p>
    <table class="tabela"><thead><tr><th>Vencimento</th><th>Parcela</th><th>Nº doc</th><th>Situação</th><th class="dir">Valor</th><th class="dir">Saldo</th><th class="dir">Atualizado</th></tr></thead><tbody>
    ${ext.boletos.map(b => `<tr><td>${fmtData(b.vencimento)}</td><td>${esc(b.parcela || '')}</td><td>${esc(b.numDoc || '')}</td><td>${esc(situacao(b, hoje()).txt)}</td><td class="dir">${fmtBRL(b.valor)}</td><td class="dir">${fmtBRL(saldoDe(b))}</td><td class="dir">${emAberto(b) ? fmtBRL(atualizado(b).total) : ''}</td></tr>`).join('')}</tbody></table>
    ${ext.pagamentos.length ? `<h3 style="margin-top:12px">Pagamentos</h3><table class="tabela"><thead><tr><th>Data</th><th>Parcela</th><th>Forma</th><th class="dir">Valor</th></tr></thead><tbody>${ext.pagamentos.filter(p => !p.estornadoEm).map(p => `<tr><td>${fmtData(p.data)}</td><td>${esc(p.parcela || '')}</td><td>${esc(p.forma || '')}</td><td class="dir">${fmtBRL(p.valor)}</td></tr>`).join('')}</tbody></table>` : ''}</div>`;
  imprimirPainel('p-impressao');
}
/* ---------------- PAINEL ---------------- */
const PN = { periodo: 'mes', de: '', ate: '' };
function renderPainel() {
  const v = S.vista, h = hoje();
  const ag = aging(v.tabs.boletos.linhas, h);
  const set = porSetor(v, h).slice(0, 10);
  const sem = previsao(v, h, 'semana', 12), mes = previsao(v, h, 'mes', 6);
  const rx = recebidoXaReceber(v, h, 6);
  const dev = maioresDevedores(v, h, 10);
  const [de, ate] = periodoRel();
  const rel = relatorioPeriodo(v, de, ate);
  $('#p-painel').innerHTML = `<div class="grade2">
    <div class="card"><h3>Faixas de atraso <span class="sub">saldo em aberto · clique para ver</span></h3>${grafBarrasH(ag.map((f, i) => ({ rot: f.rot, valor: f.valor, sub: plural(f.qtd, 'boleto'), cor: CORES_FAIXA[i], attr: `data-faixa="${f.k}"` })), { titulo: 'Faixas de atraso' })}</div>
    <div class="card"><h3>Inadimplência por setor <span class="sub">valor vencido (% do aberto)</span></h3>${grafBarrasH(set.map(s => ({ rot: s.setor, valor: s.vencido, sub: Math.round(s.pct * 100) + '%', cor: 'var(--danger)', attr: `data-setor="${esc(s.setor)}"` })), { titulo: 'Inadimplência por setor' })}</div>
    <div class="card"><h3>Previsão de recebimento por semana <span class="sub">${sem.atrasado ? 'mais ' + fmtBRL(sem.atrasado) + ' já vencidos' : ''}</span></h3>${grafColunas(sem.itens, { titulo: 'Previsão por semana' })}</div>
    <div class="card"><h3>Previsão por mês</h3>${grafColunas(mes.itens, { titulo: 'Previsão por mês' })}</div>
    <div class="card"><h3>Recebido x a receber</h3>${grafColunas(rx.map(x => ({ rot: x.rot, rec: x.recebido, ab: x.aReceber })), { series: [{ k: 'rec', cor: 'var(--ok)', rot: 'recebido' }, { k: 'ab', cor: 'var(--warn-bd)', rot: 'a receber' }], titulo: 'Recebido x a receber' })}<div class="leg"><span><i style="background:var(--ok)"></i>Recebido no mês</span><span><i style="background:var(--warn-bd)"></i>Ainda em aberto (vencimento no mês)</span></div></div>
    <div class="card"><h3>Maiores devedores <span class="sub">vencidos</span></h3>${grafBarrasH(dev.map(d => ({ rot: d.nome, valor: d.valor, sub: plural(d.qtd, 'boleto'), cor: 'var(--danger)', attr: `data-busca="${esc(d.doc || d.pdv)}"` })), { rotW: 190, titulo: 'Maiores devedores' })}</div>
  </div>
  <div class="card" style="margin-top:14px" id="relatorio">
    <div class="barra nao-imprime"><h3 style="margin:0">Relatório</h3><span class="esp" style="flex:1"></span>
      <select id="rpPer" style="width:auto">${[['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['mesPassado', 'Mês passado'], ['outro', 'Período…']].map(([k, r]) => `<option value="${k}"${PN.periodo === k ? ' selected' : ''}>${r}</option>`).join('')}</select>
      <input type="date" id="rpDe" value="${de}" style="width:auto"${PN.periodo === 'outro' ? '' : ' hidden'}><input type="date" id="rpAte" value="${ate}" style="width:auto"${PN.periodo === 'outro' ? '' : ' hidden'}>
      <button type="button" class="btn sec peq" id="rpImprimir">${ICON.imprimir} Imprimir</button></div>
    <h2 style="margin:12px 0 4px">Relatório de ${fmtData(de)}${de !== ate ? ' a ' + fmtData(ate) : ''}</h2><p class="sub">Emitido em ${fmtData(hoje())} por ${esc(USUARIO())}</p>
    <div class="kpis k4">${[['Recebido', fmtBRL(rel.totalRec), plural(rel.rec.length, 'pagamento')], ['Venceu no período', fmtBRL(rel.totalVenc), plural(rel.venc.length, 'boleto')], ['Ainda em aberto (do período)', fmtBRL(rel.venceuAberto), ''], ['Contatos feitos', String(rel.conts.length), plural(rel.lancados.length, 'boleto lançado', 'boletos lançados')]].map(([a, b, c]) => `<div class="kpi" style="cursor:default"><span>${a}</span><strong class="num">${b}</strong><small>${c}</small></div>`).join('')}</div>
    <h3>Recebimentos</h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Cliente</th><th>Parcela</th><th>Forma</th><th>Quem</th><th class="dir">Valor</th></tr></thead><tbody>${rel.rec.map(p => `<tr><td>${fmtData(p.data)}</td><td>${esc(p.b ? nomeB(p.b) : p.cliente || '')}</td><td>${esc(p.parcela || '')}</td><td>${esc(p.forma || '')}</td><td>${esc(p.registradoPor || '')}</td><td class="dir num">${fmtBRL(p.valor)}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Nenhum.</td></tr>'}</tbody></table></div>
    <h3 style="margin-top:14px">Vencimentos do período ainda em aberto</h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Venc.</th><th>Cliente</th><th>Parcela</th><th>Etapa</th><th>Responsável</th><th class="dir">Saldo</th></tr></thead><tbody>${rel.venc.filter(emAberto).map(b => `<tr><td>${fmtData(b.vencimento)}</td><td>${esc(nomeB(b))}</td><td>${esc(b.parcela || '')}</td><td>${esc(b.etapa || '')}</td><td>${esc(b.responsavel || '')}</td><td class="dir num">${fmtBRL(saldoDe(b))}</td></tr>`).join('') || '<tr><td colspan="6" class="sub">Nenhum.</td></tr>'}</tbody></table></div>
    <h3 style="margin-top:14px">Contatos</h3><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando</th><th>Cliente</th><th>Canal</th><th>Anotação</th><th>Quem</th></tr></thead><tbody>${rel.conts.slice(0, 300).map(c => `<tr><td>${esc(serialParaTexto(c.dataHora))}</td><td>${esc(c.cliente || '')}</td><td>${esc(c.canal || '')}</td><td>${esc(c.anotacao || '')}</td><td>${esc(c.registradoPor || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="sub">Nenhum.</td></tr>'}</tbody></table></div>
  </div>`;
}
function periodoRel() {
  const h = hoje();
  if (PN.periodo === 'hoje') return [h, h];
  if (PN.periodo === 'semana') { const i = inicioSemana(h); return [i, somaDias(i, 6)]; }
  if (PN.periodo === 'mesPassado') return [primeiroDoMes(h, -1), somaDias(primeiroDoMes(h), -1)];
  if (PN.periodo === 'outro' && isoValida(PN.de) && isoValida(PN.ate)) return [PN.de, PN.ate];
  return [primeiroDoMes(h), somaDias(primeiroDoMes(h, 1), -1)];
}
$('#p-painel').addEventListener('change', e => {
  if (e.target.id === 'rpPer') { PN.periodo = e.target.value; if (PN.periodo === 'outro') { const [a, b] = [primeiroDoMes(hoje()), hoje()]; PN.de = PN.de || a; PN.ate = PN.ate || b; } renderPainel(); }
  if (e.target.id === 'rpDe') { PN.de = e.target.value; renderPainel(); }
  if (e.target.id === 'rpAte') { PN.ate = e.target.value; renderPainel(); }
});
$('#p-painel').addEventListener('click', e => {
  if (e.target.closest('#rpImprimir')) { $('#p-painel').classList.add('so-relatorio'); imprimirRelatorio(); return; }
  const f = e.target.closest('[data-faixa]'); if (f) return irParaBoletos({ status: f.dataset.faixa === 'avencer' ? 'aberto' : 'vencido', faixa: f.dataset.faixa });
  const s = e.target.closest('[data-setor]'); if (s) return irParaBoletos({ status: 'vencido', setor: s.dataset.setor === '(sem setor)' ? '' : s.dataset.setor });
  const d = e.target.closest('[data-busca]'); if (d) return irParaBoletos({ status: 'vencido', busca: d.dataset.busca });
});
function imprimirRelatorio() {
  const est = document.createElement('style');
  est.textContent = '@media print{#p-painel>.grade2{display:none!important}}';
  document.head.appendChild(est);
  imprimirPainel('p-painel');
  setTimeout(() => est.remove(), 1000);
}

/* ---------------- CALENDÁRIO ---------------- */
const CA = { ym: hojeLocal().slice(0, 7), dia: '' };
function renderCalendario() {
  const v = S.vista, h = hoje();
  const dias = calendarioMes(v, CA.ym, h);
  const ini = CA.ym + '-01', dsem = diaSemana(ini);
  const primeiro = somaDias(ini, -dsem);
  const cel = [];
  for (let i = 0; i < 42; i++) {
    const d = somaDias(primeiro, i);
    if (i >= 35 && d.slice(0, 7) !== CA.ym) break;
    const x = dias.get(d);
    const fora = d.slice(0, 7) !== CA.ym, fds = diaSemana(d) === 0 || diaSemana(d) === 6;
    cel.push(`<button type="button" class="${fora ? 'fora ' : ''}${d === h ? 'hoje ' : ''}${d === CA.dia ? 'sel ' : ''}${fds ? 'fds ' : ''}${x && x.vencido ? 'venc' : ''}" data-dia="${d}" aria-label="${fmtData(d)}${x ? ': ' + plural(x.qtdAberto, 'boleto em aberto', 'boletos em aberto') : ''}"><span class="d">${partes(d).d}</span>${x && x.qtdAberto ? `<span class="v num">${esc(fmtBRL(x.aberto))}</span><span class="q">${plural(x.qtdAberto, 'em aberto')}</span>` : ''}${x && x.qtdPago ? `<span class="pg">${x.qtdPago} pago${x.qtdPago > 1 ? 's' : ''}</span>` : ''}</button>`);
  }
  const doMes = [...dias.values()];
  const listaDia = CA.dia ? ordenarBoletos(v.tabs.boletos.linhas.filter(b => !b.excluidoEm && b.vencimento === CA.dia)) : [];
  $('#p-calendario').innerHTML = `<div class="card"><div class="barra" style="margin-bottom:10px"><button type="button" class="btn sec peq" data-mes="-1" aria-label="Mês anterior">‹</button><h3 style="margin:0;min-width:180px;text-align:center">${esc(nomeMes(CA.ym))}</h3><button type="button" class="btn sec peq" data-mes="1" aria-label="Próximo mês">›</button><button type="button" class="btn texto" data-mes="0">Hoje</button><span class="esp" style="flex:1"></span><span class="sub">Em aberto no mês: <b>${fmtBRL(somaCent(doMes, x => x.aberto))}</b> · ${plural(doMes.reduce((s, x) => s + x.qtdAberto, 0), 'boleto')}</span></div>
    <div class="cal">${DIAS.map(d => `<div class="dsem">${d}</div>`).join('')}${cel.join('')}</div></div>
    ${CA.dia ? `<div class="card" style="margin-top:14px"><div class="barra"><h3 style="margin:0">Vencimentos de ${fmtData(CA.dia)} (${DIAS_LONGO[diaSemana(CA.dia)]})</h3><span class="esp" style="flex:1"></span><button type="button" class="btn sec peq" data-lista="1">Abrir na lista</button></div>
      <div class="lista-card" style="margin-top:10px">${listaDia.length ? listaDia.map(b => `<div class="item-hoje" data-abrir="${b.id}"><div style="min-width:0"><div class="t1">${esc(nomeB(b))}</div><div class="t2">${esc([b.pdv && 'PDV ' + b.pdv, 'parcela ' + (b.parcela || ''), b.responsavel].filter(Boolean).join(' · '))}</div></div><div class="vl num">${fmtBRL(saldoDe(b) || b.valor)}</div><div>${tagSit(b)}</div></div>`).join('') : '<div class="vazio">Nenhum boleto vence neste dia.</div>'}</div></div>` : ''}`;
}
$('#p-calendario').addEventListener('click', e => {
  const m = e.target.closest('[data-mes]'); if (m) { CA.ym = m.dataset.mes === '0' ? hoje().slice(0, 7) : primeiroDoMes(CA.ym + '-01', +m.dataset.mes).slice(0, 7); CA.dia = ''; renderCalendario(); return; }
  const d = e.target.closest('[data-dia]'); if (d) { CA.dia = d.dataset.dia; if (CA.dia.slice(0, 7) !== CA.ym) CA.ym = CA.dia.slice(0, 7); renderCalendario(); return; }
  const a = e.target.closest('[data-abrir]'); if (a) return abrirGaveta(+a.dataset.abrir);
  if (e.target.closest('[data-lista]')) irParaBoletos({ status: 'todos', dia: CA.dia });
});

/* ---------------- CONCILIAÇÃO (retorno bancário, OFX, CSV) ---------------- */
const CO = { itens: null, sug: null, origem: '', formato: '', avisos: [], csv: null };
function renderConciliacao() {
  const p = $('#p-conciliacao');
  if (!CO.sug) {
    p.innerHTML = `<div class="card" style="max-width:820px"><h2>Conciliar pagamentos</h2><p class="sub">Leia o arquivo de retorno do banco (CNAB 240 ou 400), um extrato OFX ou uma planilha CSV com os pagamentos. O sistema sugere qual boleto cada pagamento quita; você confere e só então aplica.</p>
      <div class="barra" style="margin-top:12px"><button type="button" class="btn" id="coArq">Escolher arquivo (.ret, .txt, .ofx, .csv)</button><span class="sub">ou cole abaixo as linhas copiadas do Excel/extrato (com cabeçalho):</span></div>
      <textarea id="coColar" rows="6" style="margin-top:10px" placeholder="Data;Valor;Documento;Nosso número"></textarea>
      <div class="barra" style="margin-top:8px"><button type="button" class="btn sec" id="coLerColado">Ler o texto colado</button></div></div>`;
    if (CO.csv) renderMapaCSV();
    return;
  }
  const n = CO.sug.filter(s => s.aplicar && s.boleto).length;
  const tot = somaCent(CO.sug.filter(s => s.aplicar && s.boleto), s => s.item.valorPago || s.item.valor || 0);
  p.innerHTML = `<div class="card"><div class="barra"><h2 style="margin:0">Conferência · ${esc(CO.origem)}</h2><span class="tag info">${esc(CO.formato)}</span><span class="esp" style="flex:1"></span><button type="button" class="btn sec" id="coVoltar">Ler outro arquivo</button><button type="button" class="btn" id="coAplicar"${n ? '' : ' disabled'}>Aplicar ${plural(n, 'baixa')} (${fmtBRL(tot)})</button></div>
    ${CO.avisos.map(a => `<p class="dica alerta">${esc(a)}</p>`).join('')}
    <p class="sub">Marque o que deve virar baixa. Itens que não são liquidação (ex.: entrada, baixa sem pagamento) ou sem boleto correspondente ficam desmarcados.</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th><input type="checkbox" id="coTodos" aria-label="Marcar todos"></th><th>Data</th><th class="dir">Valor pago</th><th>Documento / nosso número</th><th>Boleto sugerido</th><th>Confere por</th></tr></thead><tbody>
    ${CO.sug.map((s, i) => { const it = s.item, b = s.boleto; return `<tr class="${s.aplicar ? 'sel' : ''}"><td><input type="checkbox" data-co="${i}"${s.aplicar ? ' checked' : ''}${b ? '' : ' disabled'}></td><td>${fmtData(it.data)}</td><td class="dir num">${fmtBRL(it.valorPago || it.valor || 0)}${it.juros ? `<br><span class="sub">juros ${fmtBRL(it.juros)}</span>` : ''}</td>
      <td>${esc([it.documento, it.seuNumero, it.nossoNumero && 'NN ' + it.nossoNumero].filter(Boolean).join(' · ') || it.descricao || '')}${it.ocorrencia ? `<br><span class="sub">ocorrência ${esc(it.ocorrencia)}${it.liquidacao === false ? ' (não é liquidação)' : ''}</span>` : ''}</td>
      <td>${b ? `<b>${esc(nomeB(b))}</b><br><span class="sub">ID ${b.id} · ${esc(b.parcela || '')} · venc. ${fmtData(b.vencimento)} · saldo ${fmtBRL(saldoDe(b))}</span>` : '<span class="sub">—</span>'}${s.alternativas.length > 1 ? `<br><select data-alt="${i}" style="height:28px;margin-top:4px">${s.alternativas.map(x => `<option value="${x.id}"${b && x.id === b.id ? ' selected' : ''}>ID ${x.id} · ${esc(nomeB(x))} · ${fmtBRL(saldoDe(x))}</option>`).join('')}</select>` : ''}<br><button type="button" class="btn texto" data-id-man="${i}">escolher pelo ID…</button></td>
      <td>${s.confianca ? `<span class="tag ${s.confianca === 'alta' || s.confianca === 'manual' ? 'pago' : s.confianca === 'media' ? 'breve' : 'vencido'}">${esc({ alta: 'confiável', media: 'provável', baixa: 'conferir', manual: 'escolhido' }[s.confianca] || s.confianca)}</span> ` : ''}<span class="sub">${esc(s.motivo)}</span></td></tr>`; }).join('')}
    </tbody></table></div></div>`;
}
async function lerConciliacao(txt, nome) {
  CO.origem = nome; CO.avisos = []; CO.csv = null;
  if (/<OFX>|<STMTTRN>/i.test(txt)) { CO.formato = 'Extrato OFX'; CO.itens = lerOFX(txt).filter(t => t.valor > 0).map(t => ({ ...t, valorPago: t.valor })); }
  else {
    const c = lerCNAB(txt);
    if (c.formato) { CO.formato = c.formato + (c.banco ? ' · banco ' + c.banco + (BANCOS[c.banco] ? ' ' + BANCOS[c.banco] : '') : ''); CO.itens = c.itens; CO.avisos = c.avisos; }
    else { CO.csv = lerCSV(txt); renderConciliacao(); return; }
  }
  if (!CO.itens.length) { aviso('Nenhum pagamento encontrado no arquivo.', { erro: true }); return; }
  CO.sug = sugerirBaixas(S.vista, CO.itens, hoje());
  renderConciliacao();
}
function renderMapaCSV() {
  const linhas = CO.csv; if (!linhas || !linhas.length) return;
  const cab = linhas[0];
  const aliases = { data: ['data', 'datapagamento', 'dtpagamento', 'datacredito', 'pagamento', 'dataliquidacao'], valor: ['valor', 'valorpago', 'valorrecebido', 'credito', 'vlrpago'], documento: ['documento', 'ndocumento', 'numerodocumento', 'seunumero', 'nf', 'historico'], nossoNumero: ['nossonumero', 'nnumero'] };
  const auto = k => { const i = cab.findIndex(h => aliases[k].includes(normCab(h))); return i; };
  const sel = (k, rot) => `<div class="campo"><label>${rot}</label><select data-map="${k}"><option value="-1">(não tem)</option>${cab.map((h, i) => `<option value="${i}"${auto(k) === i ? ' selected' : ''}>${esc(h || 'Coluna ' + (i + 1))}</option>`).join('')}</select></div>`;
  $('#p-conciliacao').insertAdjacentHTML('beforeend', `<div class="card" style="max-width:820px;margin-top:14px" id="coMapa"><h3>Quais colunas são o quê? (${plural(linhas.length - 1, 'linha')})</h3><div class="campos">${sel('data', 'Data do pagamento')}${sel('valor', 'Valor pago')}${sel('documento', 'Nº documento')}${sel('nossoNumero', 'Nosso número')}</div><div class="modal-acoes"><button type="button" class="btn" id="coMapaOk">Continuar</button></div></div>`);
}
$('#p-conciliacao').addEventListener('click', async e => {
  if (e.target.closest('#coArq')) { const f = await escolherArquivo('.ret,.txt,.ofx,.csv,.rem,.cnab,text/plain'); if (!f) return; const buf = await f.arrayBuffer(); let txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf); lerConciliacao(txt, f.name); return; }
  if (e.target.closest('#coLerColado')) { const t = $('#coColar').value; if (t.trim()) lerConciliacao(t, 'texto colado'); return; }
  if (e.target.closest('#coMapaOk')) {
    const m = Object.fromEntries($$('[data-map]').map(s => [s.dataset.map, +s.value]));
    if (m.valor < 0) { aviso('Escolha a coluna do valor.', { erro: true }); return; }
    CO.formato = 'Planilha/CSV';
    CO.itens = CO.csv.slice(1).map(l => ({ data: m.data >= 0 ? paraIso(l[m.data]) : hoje(), valorPago: lerValor(l[m.valor]), documento: m.documento >= 0 ? l[m.documento] : '', nossoNumero: m.nossoNumero >= 0 ? l[m.nossoNumero] : '' })).filter(x => x.valorPago > 0);
    CO.csv = null; CO.sug = sugerirBaixas(S.vista, CO.itens, hoje()); renderConciliacao(); return;
  }
  if (e.target.closest('#coVoltar')) { CO.sug = null; CO.itens = null; renderConciliacao(); return; }
  const man = e.target.closest('[data-id-man]');
  if (man) { const s = CO.sug[+man.dataset.idMan]; const v = await pedirTexto('Escolher boleto', 'ID do boleto (aparece no detalhe do boleto e na coluna ID da planilha):', s.boleto ? String(s.boleto.id) : '', 'Usar'); const b = v && S.ix.boletoPorId.get(+v); if (v && !b) aviso('Não achei esse ID.', { erro: true }); if (b) { s.boleto = b; s.aplicar = emAberto(b); s.confianca = 'manual'; s.motivo = 'escolhido por você'; } renderConciliacao(); return; }
  if (e.target.closest('#coAplicar')) {
    const sel = CO.sug.filter(s => s.aplicar && s.boleto && emAberto(S.ix.boletoPorId.get(s.boleto.id) || {}));
    const ctx = novoCtx(USUARIO()); let v = S.vista; const ops = []; const usados = novosUsados();
    for (const s of sel) {
      const b = S.ix.boletoPorId.get(s.boleto.id), it = s.item;
      const pago = it.valorPago || it.valor || 0, saldo = saldoDe(b);
      const juros = arred2(Math.max(it.juros || 0, pago > saldo ? pago - saldo + (it.desconto || 0) : 0));
      const o = opsPagamento(v, b.id, { data: it.data || hoje(), valor: pago, juros, desconto: it.desconto || 0, forma: CO.formato.startsWith('Extrato') ? 'Transferência' : 'Boleto', origem: `${CO.formato.split(' ·')[0]} (${CO.origem})`, obs: [it.documento, it.nossoNumero && 'NN ' + it.nossoNumero].filter(Boolean).join(' · ') }, ctx, usados);
      ops.push(...o); v = aplicarOps(v, o).doc;
    }
    executar(`Conciliação: ${plural(sel.length, 'baixa aplicada', 'baixas aplicadas')}`, ops, { backup: 'conciliacao' });
    CO.sug = null; CO.itens = null; renderConciliacao();
  }
});
$('#p-conciliacao').addEventListener('change', e => {
  const c = e.target.closest('[data-co]'); if (c) { CO.sug[+c.dataset.co].aplicar = c.checked; renderConciliacao(); return; }
  if (e.target.id === 'coTodos') { for (const s of CO.sug) if (s.boleto) s.aplicar = e.target.checked; renderConciliacao(); return; }
  const a = e.target.closest('[data-alt]'); if (a) { const s = CO.sug[+a.dataset.alt]; s.boleto = S.ix.boletoPorId.get(+a.value); renderConciliacao(); }
});

/* ---------------- IMPORTAR boletos ---------------- */
const IM = { grade: null, cab: true, mapa: {}, prev: null, nome: '' };
function renderImportar() {
  const p = $('#p-importar');
  if (!IM.grade) {
    p.innerHTML = `<div class="card" style="max-width:860px"><h2>Importar boletos</h2><p class="sub">De uma planilha (.xlsx), de um CSV, ou colando linhas copiadas do Excel. Você escolhe o que é cada coluna, vê a prévia com os problemas de cada linha e os possíveis repetidos, e só então importa. Antes de importar o sistema faz um backup.</p>
      <div class="barra" style="margin-top:12px"><button type="button" class="btn" id="imArq">Escolher arquivo (.xlsx ou .csv)</button></div>
      <textarea id="imColar" rows="7" style="margin-top:12px" placeholder="Cole aqui (Ctrl+V) as linhas copiadas do Excel, com a linha de títulos"></textarea>
      <div class="barra" style="margin-top:8px"><button type="button" class="btn sec" id="imLerColado">Usar o texto colado</button></div></div>`;
    return;
  }
  const cab = IM.cab ? IM.grade[0] : IM.grade[0].map((_, i) => 'Coluna ' + letraCol(i + 1));
  const dados = IM.cab ? IM.grade.slice(1) : IM.grade;
  IM.prev = prepararImportacao(S.vista, dados, IM.mapa, hoje());
  const ok = IM.prev.filter(r => r.importar).length;
  const rot = { vencimento: 'Vencimento *', valor: 'Valor *', cliente: 'Cliente', pdv: 'PDV', setor: 'Setor', doc: 'CNPJ/CPF', numDoc: 'Nº documento', nossoNumero: 'Nosso número', parcela: 'Parcela (ex.: 2/5)', obs: 'Observação', responsavel: 'Responsável', linhaDigitavel: 'Linha digitável', status: 'Status', pagoEm: 'Pago em' };
  p.innerHTML = `<div class="card"><div class="barra"><h2 style="margin:0">Importar · ${esc(IM.nome)}</h2><span class="esp" style="flex:1"></span><button type="button" class="btn sec" id="imVoltar">Outro arquivo</button><button type="button" class="btn" id="imOk"${ok ? '' : ' disabled'}>Importar ${plural(ok, 'boleto')}</button></div>
    <label class="check" style="margin:10px 0"><input type="checkbox" id="imCab"${IM.cab ? ' checked' : ''}> A primeira linha tem os títulos das colunas</label>
    <div class="campos c3">${CAMPOS_IMPORT.map(k => `<div class="campo"><label>${rot[k]}</label><select data-im="${k}"><option value="">(não tem)</option>${cab.map((h, i) => `<option value="${i}"${String(IM.mapa[k]) === String(i) ? ' selected' : ''}>${esc(h || 'Coluna ' + letraCol(i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
    <p class="sub" style="margin-top:10px">${plural(IM.prev.length, 'linha')} · <b>${ok}</b> prontas para importar · ${IM.prev.filter(r => !r.ok).length} com erro · ${IM.prev.filter(r => r.duplicado).length} possivelmente repetidas (desmarcadas; marque se quiser importar mesmo assim)</p>
    <div class="tabela-wrap"><table class="tabela"><thead><tr><th></th><th>#</th><th>Vencimento</th><th class="dir">Valor</th><th>Cliente / PDV</th><th>CNPJ/CPF</th><th>Nº doc</th><th>Parcela</th><th>Situação</th></tr></thead><tbody>
    ${IM.prev.slice(0, 300).map((r, i) => `<tr class="${!r.ok ? 'ruim' : r.duplicado ? 'dup' : ''}"><td><input type="checkbox" data-imp="${i}"${r.importar ? ' checked' : ''}${r.ok ? '' : ' disabled'}></td><td>${r.linha}</td><td>${r.vencimento ? fmtData(r.vencimento) : ''}</td><td class="dir num">${r.valor > 0 ? fmtBRL(r.valor) : ''}</td><td>${esc([r.cliente, r.pdv].filter(Boolean).join(' · '))}</td><td>${esc(r.doc)}</td><td>${esc(r.numDoc)}</td><td>${esc(r.parcela)}</td><td>${r.erros.length ? `<span class="dica erro">${esc(r.erros.join('; '))}</span>` : ''}${r.duplicado ? `<span class="tag breve">${esc(r.duplicado)}</span>` : ''}${r.avisos.length ? `<span class="dica alerta">${esc(r.avisos.join('; '))}</span>` : ''}${r.ok && !r.duplicado && !r.avisos.length ? '<span class="tag pago">ok</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div>${IM.prev.length > 300 ? '<p class="sub">Mostrando as 300 primeiras linhas; todas as marcadas serão importadas.</p>' : ''}</div>`;
}
async function carregarImportacao(nome, grade) {
  grade = grade.filter(l => l.some(c => String(c ?? '').trim() !== ''));
  if (!grade.length) { aviso('Não encontrei linhas no arquivo.', { erro: true }); return; }
  const largura = Math.max(...grade.map(l => l.length));
  IM.grade = grade.map(l => Array.from({ length: largura }, (_, i) => l[i] ?? ''));
  IM.nome = nome; IM.cab = true;
  IM.mapa = sugerirMapa(IM.grade[0].map(String));
  if (!Object.keys(IM.mapa).length) IM.cab = false;
  renderImportar();
}
$('#p-importar').addEventListener('click', async e => {
  if (e.target.closest('#imArq')) {
    const f = await escolherArquivo('.xlsx,.csv,.txt'); if (!f) return;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      if (buf[0] === 0x50 && buf[1] === 0x4B || buf[0] === 0xD0) {
        const pac = await lerPacote(buf);
        const a = pac.abas.find(x => /\/worksheet$/.test(x.tipoRel)) || pac.abas[0];
        const g = await gradeDaAba(pac.txt(a.caminho), pac.sst);
        const grade = []; for (let r = 1; r <= g.maxR; r++) { const cels = g.linhas.get(r); grade.push(Array.from({ length: g.maxC }, (_, c) => { const cel = cels && cels.get(c + 1); return cel ? cel.v : ''; })); }
        carregarImportacao(`${f.name} (aba ${a.nome})`, grade);
      } else { let t = new TextDecoder('utf-8').decode(buf); if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf); carregarImportacao(f.name, lerCSV(t)); }
    } catch (err) { aviso(msgErroAcesso(err), { erro: true, ms: 10000 }); }
    return;
  }
  if (e.target.closest('#imLerColado')) { const t = $('#imColar').value; if (t.trim()) carregarImportacao('texto colado', lerCSV(t, t.includes('\t') ? '\t' : undefined)); return; }
  if (e.target.closest('#imVoltar')) { IM.grade = null; renderImportar(); return; }
  if (e.target.closest('#imOk')) {
    const sel = IM.prev.filter(r => r.importar && r.ok);
    if (!sel.length) return;
    const ops = opsImportacao(S.vista, sel, novoCtx(USUARIO()));
    executar(`Importação: ${plural(sel.length, 'boleto importado', 'boletos importados')}`, ops, { backup: 'importacao' });
    IM.grade = null; renderImportar(); mostrarAba('boletos');
  }
});
$('#p-importar').addEventListener('change', e => {
  const m = e.target.closest('[data-im]'); if (m) { IM.mapa[m.dataset.im] = m.value === '' ? undefined : +m.value; renderImportar(); return; }
  if (e.target.id === 'imCab') { IM.cab = e.target.checked; renderImportar(); return; }
  const c = e.target.closest('[data-imp]'); if (c) IM.prev[+c.dataset.imp].importar = c.checked;
});

/* ---------------- LIXEIRA, HISTÓRICO, VERIFICAR ---------------- */
function renderLixeira() {
  const v = S.vista;
  const bol = v.tabs.boletos.linhas.filter(b => b.excluidoEm).sort((a, b) => b.excluidoEm - a.excluidoEm);
  const cli = v.tabs.clientes.linhas.filter(c => c.excluidoEm);
  $('#p-lixeira').innerHTML = `<div class="card"><div class="barra"><h2 style="margin:0">Lixeira</h2><span class="sub">Nada é apagado de verdade: o que está aqui continua na planilha (aba Boletos, coluna "Na lixeira desde") e volta com um clique.</span></div>
    <h3 style="margin-top:14px">Boletos (${bol.length})</h3>${bol.length ? `<div class="barra" style="margin-bottom:8px"><button type="button" class="btn sec peq" data-lx="todos">Restaurar todos</button></div>` : ''}
    <div class="lista-card">${bol.slice(0, 500).map(b => `<div class="item-hoje" data-abrir="${b.id}"><div style="min-width:0"><div class="t1">${esc(nomeB(b))}</div><div class="t2">${esc([b.pdv && 'PDV ' + b.pdv, 'parcela ' + (b.parcela || ''), 'venc. ' + fmtData(b.vencimento), 'na lixeira desde ' + serialParaTexto(b.excluidoEm), b.excluidoPor].filter(Boolean).join(' · '))}</div></div><div class="vl num">${fmtBRL(b.valor)}</div><div><button type="button" class="btn sec peq" data-rest="${b.id}">Restaurar</button></div></div>`).join('') || '<div class="vazio">A lixeira de boletos está vazia.</div>'}</div>
    <h3 style="margin-top:14px">Clientes (${cli.length})</h3><div class="lista-card">${cli.map(c => `<div class="item-hoje"><div><div class="t1">${esc(c.nome || '')}</div><div class="t2">${esc([c.pdv, c.doc].filter(Boolean).join(' · '))}</div></div><div></div><div><button type="button" class="btn sec peq" data-restcli="${c.id}">Restaurar</button></div></div>`).join('') || '<div class="vazio">Nenhum cliente na lixeira.</div>'}</div></div>`;
}
$('#p-lixeira').addEventListener('click', e => {
  const r = e.target.closest('[data-rest]'); if (r) { e.stopPropagation(); return acaoBoleto('restaurar', [+r.dataset.rest]); }
  const rc = e.target.closest('[data-restcli]'); if (rc) return executar('Cliente restaurado', opsLixeira(S.vista, 'clientes', [+rc.dataset.restcli], novoCtx(USUARIO()), true));
  if (e.target.closest('[data-lx="todos"]')) return acaoBoleto('restaurar', S.vista.tabs.boletos.linhas.filter(b => b.excluidoEm).map(b => b.id));
  const a = e.target.closest('[data-abrir]'); if (a) abrirGaveta(+a.dataset.abrir);
});
const HI = { busca: '', n: 300 };
function renderHistorico() {
  const busca = semAcento(HI.busca.trim());
  const l = S.vista.tabs.historico.linhas.filter(h => !busca || semAcento([h.usuario, h.acao, h.detalhe, 'id' + h.boleto, h.boleto].join(' ')).includes(busca)).sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0) || b.id - a.id);
  const foco = document.activeElement && document.activeElement.id === 'hiBusca';
  $('#p-historico').innerHTML = `<div class="filtros card"><input type="search" id="hiBusca" placeholder="Filtrar por usuário, ação, ID do boleto…" value="${esc(HI.busca)}"><span class="sub">${plural(l.length, 'registro')} · aba "Histórico" da planilha (só acrescenta)</span></div>
    <div class="lista-card tabela-wrap"><table class="tabela"><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Boleto</th><th>Detalhe</th></tr></thead><tbody>
    ${l.slice(0, HI.n).map(h => `<tr><td class="num" style="white-space:nowrap">${esc(serialParaTexto(h.dataHora))}</td><td>${esc(h.usuario || '')}</td><td>${esc(h.acao || '')}</td><td>${h.boleto ? `<button type="button" class="btn texto" data-abrir="${h.boleto}">${h.boleto}</button>` : ''}</td><td class="sub">${esc(h.detalhe || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="vazio">Nada registrado ainda.</td></tr>'}</tbody></table></div>
    ${l.length > HI.n ? `<div class="barra" style="margin-top:10px"><button type="button" class="btn sec" id="hiMais">Mostrar mais</button></div>` : ''}`;
  if (foco) { const i = $('#hiBusca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
$('#p-historico').addEventListener('input', debounce(e => { if (e.target.id === 'hiBusca') { HI.busca = e.target.value; HI.n = 300; renderHistorico(); } }, 200));
$('#p-historico').addEventListener('click', e => { if (e.target.closest('#hiMais')) { HI.n += 500; renderHistorico(); } const a = e.target.closest('[data-abrir]'); if (a) abrirGaveta(+a.dataset.abrir); });
function renderVerificar() {
  const probs = verificarPlanilha(S.vista, hoje());
  $('#p-verificar').innerHTML = `<div class="card" style="max-width:900px"><div class="barra"><h2 style="margin:0">Verificar planilha</h2><span class="esp" style="flex:1"></span><button type="button" class="btn sec" id="vfDeNovo">Verificar de novo</button></div>
    <p class="sub">Confere IDs repetidos, datas e valores inválidos, parcelas inconsistentes, CNPJ/CPF, linhas órfãs e possíveis duplicidades. O que dá para corrigir sozinho tem o botão "Corrigir" (faz backup antes).</p>
    ${probs.length ? `<div class="lista-card">${probs.map((p, i) => `<div class="item-hoje" style="cursor:default"><div style="min-width:0"><div class="t1"><span class="tag ${p.gravidade === 'alta' ? 'vencido' : p.gravidade === 'media' ? 'breve' : ''}">${p.gravidade}</span> ${esc(p.texto)}</div></div><div>${p.ids.length ? `<button type="button" class="btn sec peq" data-vf-ver="${i}">Ver ${plural(p.ids.length, 'boleto')}</button>` : ''}</div><div>${p.correcao ? `<button type="button" class="btn peq" data-vf-cor="${i}">Corrigir</button>` : ''}</div></div>`).join('')}</div>` : '<div class="faixa info"><p>Nenhum problema encontrado. 👍</p></div>'}</div>`;
  renderVerificar.probs = probs;
}
$('#p-verificar').addEventListener('click', e => {
  const v = e.target.closest('[data-vf-ver]'); if (v) { const p = renderVerificar.probs[+v.dataset.vfVer]; return irParaBoletos({ status: 'todos', ids: new Set(p.ids) }); }
  const c = e.target.closest('[data-vf-cor]');
  if (c) {
    const p = renderVerificar.probs[+c.dataset.vfCor];
    if (p.correcao === 'gravar') { S.precisaGravar = true; S.backupMotivo = 'verificar planilha'; agendarGravacao(0); aviso('Os números novos serão gravados na planilha.'); }
    else executar(`Correção: ${p.texto.slice(0, 60)}`, opsCorrecao(S.vista, p, novoCtx(USUARIO())), { backup: 'verificar planilha' });
    setTimeout(renderVerificar, 300);
    return;
  }
  if (e.target.closest('[id="vfDeNovo"]')) renderVerificar();
});

/* ---------------- CONFIG ---------------- */
function renderConfig() {
  const v = S.vista;
  if ($('#p-config').contains(document.activeElement) && document.activeElement.matches('input,textarea')) return;   // não atrapalha quem está digitando
  $('#p-config').innerHTML = `<div class="card" style="max-width:980px"><h2>Configurações do time</h2><p class="sub">Ficam na aba "Config" da planilha (valem para todos). Cada campo é gravado ao sair dele. Também dá para editar direto no Excel.</p>
    <div class="campos" style="margin-top:12px">${CONFIG_DEF.map(([k, rot, , expl]) => { const longo = /^modelo|etapas|setores|responsaveis|formas|canais/.test(k) && k !== 'modeloEmailAssunto'; return `<div class="campo${longo ? ' l2' : ''}"><label for="cfg_${k}">${esc(rot)}</label>${longo ? `<textarea id="cfg_${k}" data-cfg="${k}" rows="${/^modelo/.test(k) ? 5 : 2}">${esc(v.config[k] ?? '')}</textarea>` : `<input id="cfg_${k}" data-cfg="${k}" value="${esc(v.config[k] ?? '')}">`}<span class="dica">${esc(expl)}</span></div>`; }).join('')}</div>
    ${v.configExtra.length ? `<h3 style="margin-top:16px">Outras linhas da aba Config (do time)</h3><dl class="dl">${v.configExtra.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : ''}</div>
    <div class="card" style="max-width:980px;margin-top:14px"><h2>Só neste computador</h2><div class="barra"><button type="button" class="btn sec" id="cfgNome">Seu nome: ${esc(USUARIO())}</button><button type="button" class="btn sec" id="cfgTema">Alternar tema claro/escuro</button><button type="button" class="btn sec" id="cfgLimparPrefs">Voltar filtros e colunas ao padrão</button></div></div>`;
}
$('#p-config').addEventListener('change', e => {
  const k = e.target.dataset.cfg; if (!k) return;
  let val = e.target.value.trim();
  if (['multa', 'juros', 'diasAlerta', 'intervalo', 'backups'].includes(k) && val && !isFinite(lerValor(val))) { aviso('Use só número (ex.: 2 ou 1,5).', { erro: true }); return; }
  executar(`Configuração "${CONFIG_DEF.find(d => d[0] === k)[1]}" alterada`, opsConfig(S.vista, k, val, novoCtx(USUARIO())), { silencioso: false });
});
$('#p-config').addEventListener('click', e => {
  if (e.target.closest('#cfgNome')) $('#btnUsuario').click();
  if (e.target.closest('#cfgTema')) $('#btnTema').click();
  if (e.target.closest('#cfgLimparPrefs')) { ['bc2.filtros', 'bc2.ordem', 'bc2.desc', 'bc2.agrupar', 'bc2.cols'].forEach(lsDel); L.cols = COLS_PADRAO.slice(); L.ordem = 'vencimento'; L.desc = false; aviso('Pronto.'); }
});

/* ---------------- DIAGNÓSTICO ---------------- */
async function renderDiagnostico() {
  const p = $('#p-diagnostico');
  const perm = async (h, m) => h ? await permissao(h, m) : '—';
  const info = [
    ['Versão do sistema', VERSAO_APP + ` (esquema da planilha ${ESQUEMA_VERSAO})`],
    ['Navegador', navigator.userAgent],
    ['Endereço', location.protocol === 'file:' ? 'arquivo local (file://)' : location.origin],
    ['Gravar em arquivo (File System Access)', `${TEM_FSA ? 'sim' : 'NÃO'} · escolher pasta: ${TEM_PASTA ? 'sim' : 'não'}`],
    ['Modo', { pasta: 'pasta da planilha', arquivo: 'arquivo (Substituir)', navegador: 'só neste navegador' }[A.modo] || 'nenhum'],
    ['Planilha', A.nome || '—'], ['Pasta', A.dir ? A.dir.name : '—'],
    ['Permissão da pasta', `leitura: ${await perm(A.dir, 'read')} · gravação: ${await perm(A.dir, 'readwrite')}`],
    ['Permissão do arquivo', `leitura: ${await perm(A.arq, 'read')} · gravação: ${await perm(A.arqG, 'readwrite')}`],
    ['Pode ler / gravar agora', `${A.podeLer ? 'sim' : 'não'} / ${A.podeGravar ? 'sim' : 'não'}`],
    ['Comportamento deste PC', `pedir permissão direto: ${A.flags.rpFalha ? 'NÃO funciona (usa janelas)' : 'tenta primeiro'} · gravar pela pasta: ${A.flags.dirFalha ? 'NÃO funciona' : 'ok/sem teste'}`],
    ['Alterações pendentes', `${nPend()} (${S.pend.length} operações)`], ['Aguardando confirmação', String(S.conf.length)],
    ['Última leitura / gravação', `${S.lidoEm ? S.lidoEm.toLocaleString('pt-BR') : '—'} / ${S.salvoEm ? S.salvoEm.toLocaleString('pt-BR') : '—'}`],
    ['Arquivo', S.meta ? `${(S.meta.size / 1024).toFixed(0)} KB · modificado ${new Date(S.meta.lastModified).toLocaleString('pt-BR')}` : '—'],
    ['Linhas', S.vista ? TABS.map(t => `${ESQUEMA[t].aba} ${S.vista.tabs[t].linhas.length}`).join(' · ') : '—'],
    ['Presença', [...S.presenca].join(', ') || '—'], ['Excel aberto', S.excel ? S.excel.nome : 'não detectado'],
    ['Último erro', S.erro ? `${S.erro.tipo}: ${S.erro.tecnico || S.erro.msg}` : '—']
  ];
  const backups = await listarBackups().catch(() => []);
  p.innerHTML = `<div class="card" style="max-width:1000px"><div class="barra"><h2 style="margin:0">Diagnóstico</h2><span class="esp" style="flex:1"></span><button type="button" class="btn" id="dgCopiar">${ICON.copiar} Copiar relatório</button><button type="button" class="btn sec" id="dgReler">Reler agora</button><button type="button" class="btn sec" id="dgGravar">Gravar agora</button></div>
    <dl class="dl" style="margin-top:12px">${info.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>
    <div class="barra" style="margin-top:12px"><button type="button" class="btn sec peq" id="dgFlags">Esquecer o comportamento deste PC (testar de novo)</button><button type="button" class="btn sec peq" id="dgBaixarPend"${S.pend.length ? '' : ' disabled'}>Baixar planilha com as pendências</button><button type="button" class="btn sec peq" id="dgDescartar"${S.pend.length ? '' : ' disabled'}>Descartar pendências…</button></div></div>
    <div class="card" style="max-width:1000px;margin-top:14px"><h3>Backups (${backups.length})</h3><p class="sub">${A.modo === 'pasta' ? 'Ficam na subpasta "backup" (de hora em hora e antes de operações em massa) e alguns também neste navegador.' : 'Ficam neste navegador (este modo não tem acesso à pasta). Antes de operações em massa e da atualização para a V2 também é baixada uma cópia.'}</p>
    <div class="lista-card">${backups.slice(0, 60).map((b, i) => `<div class="item-hoje" style="cursor:default"><div class="t1" style="white-space:normal">${esc(b.nome)} <span class="tag">${b.onde}</span></div><div></div><div class="barra"><button type="button" class="btn sec peq" data-bk="${i}" data-acao="baixar">Baixar</button><button type="button" class="btn sec peq" data-bk="${i}" data-acao="restaurar">Restaurar…</button></div></div>`).join('') || '<div class="vazio">Nenhum backup ainda.</div>'}</div></div>
    <div class="card" style="max-width:1000px;margin-top:14px"><h3>Últimas operações</h3><pre style="white-space:pre-wrap;font-size:12px;max-height:340px;overflow:auto;background:var(--gray);padding:10px;border-radius:8px">${esc(DIAG.slice(-80).reverse().map(d => `${d.h} [${d.tipo}] ${d.msg}`).join('\n'))}</pre></div>`;
  renderDiagnostico.backups = backups; renderDiagnostico.info = info;
}
$('#p-diagnostico').addEventListener('click', async e => {
  const id = (e.target.closest('button') || {}).id;
  if (id === 'dgCopiar') { const txt = renderDiagnostico.info.map(([a, b]) => `${a}: ${b}`).join('\n') + '\n\nÚltimas operações:\n' + DIAG.slice(-80).map(d => `${d.h} [${d.tipo}] ${d.msg}`).join('\n'); aviso(await copiarTexto(txt) ? 'Relatório copiado. Cole no e-mail ou chat para quem cuida do sistema.' : 'Não consegui copiar.'); }
  if (id === 'dgReler') { await naFila(() => releitura(true)); renderDiagnostico(); }
  if (id === 'dgGravar') { S.precisaGravar = true; agendarGravacao(0); setTimeout(renderDiagnostico, 1500); }
  if (id === 'dgFlags') { A.flags = {}; salvarFlags(); A.rpNegadoNaSessao = false; aviso('Ok: na próxima liberação o sistema testa tudo de novo.'); renderDiagnostico(); }
  if (id === 'dgBaixarPend') baixarCopia();
  if (id === 'dgDescartar') {
    if (!await confirmar('Descartar as alterações pendentes?', `${plural(nPend(), 'alteração')} deste navegador ainda não foi gravada na planilha. Antes de descartar, uma planilha com elas será baixada (pasta Downloads), para nada se perder.`, 'Baixar e descartar', true)) return;
    await baixarCopia();
    await naFila(() => { S.pend = []; salvarPend(); recalcular(); });
    renderDiagnostico(); aviso('Pendências descartadas (a cópia foi baixada).');
  }
  const bk = e.target.closest('[data-bk]');
  if (bk) {
    const b = renderDiagnostico.backups[+bk.dataset.bk];
    let bytes;
    try { bytes = b.bytes || new Uint8Array(await comTempo(b.h.getFile().then(f => f.arrayBuffer()), 60000, 'ler o backup')); }
    catch (err) { aviso(msgErroAcesso(err), { erro: true }); return; }
    if (bk.dataset.acao === 'baixar') { baixarArquivo(bytes, b.nome); return; }
    try { await lerPlanilha(bytes); } catch (err) { aviso('Este backup não pôde ser lido: ' + err.message, { erro: true }); return; }
    if (!await confirmar('Restaurar este backup?', `A planilha "${A.nome}" volta a ser o backup "${b.nome}". O estado atual é guardado como outro backup antes. Alterações feitas depois do backup se perdem (ficam no backup do estado atual).`, 'Restaurar', true)) return;
    naFila(async () => {
      try {
        if (S.bytes) await gravarBackup(S.bytes, 'antes de restaurar backup', true);
        const m = await escreverBytes(bytes);
        S.meta = null; await releitura(true); aviso('Backup restaurado.');
        diag('info', 'backup restaurado: ' + b.nome); void m;
      } catch (err) { aviso('Não consegui restaurar: ' + detalheErro(err), { erro: true }); }
    });
  }
});

/* ---------------- AJUDA e ATALHOS ---------------- */
const ATALHOS = [['?', 'Mostrar os atalhos'], ['H', 'Tela Hoje'], ['B', 'Lista de boletos'], ['N', 'Novo lançamento'], ['L', 'Clientes'], ['P', 'Painel'], ['K', 'Calendário'], ['/', 'Buscar boletos'], ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Esc', 'Fechar janela ou detalhe'],
  ['↑ ↓ (na lista)', 'Andar pelos boletos'], ['Enter (na lista)', 'Abrir o boleto'], ['Espaço (na lista)', 'Selecionar vários'], ['R', 'Dar baixa (boleto aberto ou selecionados)'], ['C', 'Registrar contato'], ['M', 'Mensagem de cobrança'], ['E', 'Editar (no detalhe)'], ['Delete (na lista)', 'Pôr na lixeira'],
  ['Enter (no lançamento)', 'Ir para o próximo campo'], ['Ctrl+Enter', 'Salvar o lançamento / registrar o contato']];
function mostrarAtalhos() { abrirJanela(`<h3>Atalhos de teclado</h3><div class="atalhos" style="margin-top:10px">${ATALHOS.map(([k, t]) => `<span>${k.split(' / ').map(x => `<kbd>${esc(x)}</kbd>`).join(' / ')}</span><span>${esc(t)}</span>`).join('')}</div><div class="modal-acoes"><button type="button" class="btn" onclick="fecharJanela()">Fechar</button></div>`); }
function renderAjuda() {
  $('#p-ajuda').innerHTML = `<div class="card ajuda" style="max-width:900px"><h2>Ajuda rápida</h2>
    <h3>Como abrir</h3><p>Dê dois cliques em <b>Boletos-a-cobrar-v2.html</b> (na pasta do financeiro), no Edge ou no Chrome. Na primeira vez, informe seu nome e escolha a <b>pasta</b> onde está a planilha (ex.: <code>\\\\servidor\\…\\financeiro\\bases</code>).</p>
    <h3>Liberar a gravação (todo dia)</h3><p>O navegador só deixa gravar depois que você autoriza. Ao abrir, clique no botão verde <b>Liberar a planilha</b> e confirme: dependendo do computador aparece "Permitir" (clique nele) ou a janela da pasta/arquivo (confirme a pasta, ou escolha a planilha e responda <b>Sim</b> em "substituir"). Depois disso, nenhuma outra pergunta até fechar o navegador.</p>
    <h3>Gravação automática</h3><p>Cada mudança é gravada sozinha na planilha. O indicador no topo mostra: <b>Salvo às 14:32</b> (tudo certo), <b>Gravando…</b>, <b>Pendente: N alterações</b> (o sistema está tentando de novo, por exemplo porque alguém está com a planilha aberta no Excel) ou <b>Clique para liberar</b>. Pendências ficam guardadas no navegador: mesmo fechando ou dando F5, nada se perde e tudo é gravado depois.</p>
    <h3>Várias pessoas ao mesmo tempo</h3><p>Até 4 pessoas podem usar juntas. Antes de gravar, o sistema relê a planilha e junta as mudanças de todos (linha por linha). Se duas pessoas mudarem o mesmo campo do mesmo boleto, fica a mudança mais recente e aparece um aviso. A tela se atualiza sozinha a cada poucos segundos.</p>
    <h3>Regras de convivência do time</h3><ul><li><b>Não deixe a planilha aberta no Excel</b> à toa: enquanto ela estiver aberta lá, ninguém consegue gravar pelo sistema (as alterações ficam esperando).</li><li>Se editar no Excel, salve e feche logo. O sistema absorve as mudanças.</li><li><b>Não coloque senha nem rótulo de confidencialidade</b> na planilha: o navegador não consegue ler arquivos assim.</li><li>Não apague linhas no Excel: use a <b>lixeira</b> do sistema (dá para restaurar). Linhas apagadas no Excel ficam registradas no Histórico.</li><li>Não mexa na primeira linha (títulos) das abas do sistema. Colunas e abas novas que vocês criarem são mantidas.</li><li>Todos devem usar esta versão (V2). A V1 grava a planilha sem as abas novas.</li><li>Use o sistema em uma aba só do navegador.</li></ul>
    <h3>Se der erro</h3><ul><li><b>"A planilha está aberta no Excel"</b>: peça para quem está com ela aberta fechar; o sistema grava sozinho em seguida.</li><li><b>"Não achei a planilha"</b>: a rede caiu ou alguém renomeou/moveu o arquivo. Confira a pasta; se mudou, use "Trocar de planilha" no indicador do topo.</li><li><b>"A planilha está com senha ou rótulo"</b>: tire a senha/rótulo no Excel.</li><li>Qualquer outra coisa: <b>Mais › Diagnóstico › Copiar relatório</b> e envie para quem cuida do sistema. Há backups automáticos na subpasta <b>backup</b>.</li></ul>
    <h3>Atalhos de teclado</h3><div class="atalhos">${ATALHOS.map(([k, t]) => `<span>${k.split(' / ').map(x => `<kbd>${esc(x)}</kbd>`).join(' / ')}</span><span>${esc(t)}</span>`).join('')}</div></div>`;
}
/* ---------------- teclado global ---------------- */
document.addEventListener('keydown', e => {
  const digitando = e.target.closest('input,textarea,select,[contenteditable]');
  if (e.key === 'Escape') { if ($('#menuAberto')) return fecharMenu(); if (_janela) return fecharJanela(); if (G.id != null) return fecharGaveta(); }
  if ((e.ctrlKey || e.metaKey) && !digitando && S.vista) {
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); return; }
    if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); return; }
  }
  if (digitando || e.ctrlKey || e.metaKey || e.altKey || _janela || !S.vista) return;
  const k = e.key.toLowerCase();
  if (G.id != null && $('#gaveta')) {
    const b = S.ix.boletoPorId.get(G.id);
    if (b && k === 'r' && b.status === 'Em aberto') { e.preventDefault(); return acaoBoleto('baixa', [b.id]); }
    if (b && k === 'c') { e.preventDefault(); return acaoBoleto('contato', [b.id]); }
    if (b && k === 'm') { e.preventDefault(); return acaoBoleto('mensagem', [b.id]); }
    if (b && k === 'e') { e.preventDefault(); G.editando = true; return desenharGaveta(); }
    return;
  }
  if (e.target.closest('#tv')) return;
  const ir = { h: 'hoje', b: 'boletos', n: 'novo', l: 'clientes', p: 'painel', k: 'calendario' }[k];
  if (e.key === '?') { e.preventDefault(); mostrarAtalhos(); }
  else if (e.key === '/') { e.preventDefault(); mostrarAba('boletos'); setTimeout(() => $('#fBusca').focus(), 20); }
  else if (ir) { e.preventDefault(); mostrarAba(ir); if (ir === 'novo') setTimeout(() => $('#fBuscaCli').focus(), 20); if (ir === 'boletos') setTimeout(() => $('#tv').focus(), 20); }
});

/* ---------------- partida ---------------- */
iniciar().catch(e => { diag('erro', 'iniciar: ' + detalheErro(e)); mostrarInicio(msgErroAcesso(e)); });
