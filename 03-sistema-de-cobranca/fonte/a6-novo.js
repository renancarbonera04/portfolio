/* =====================================================================
   TELA — Novo lançamento (teclado primeiro: Enter avança, Ctrl+Enter salva)
   ===================================================================== */
const NV = { previa: [], removeu: false };
function renderNovo() {
  atualizarListas();
  const modelos = lsJSON('bc2.modelos', []);
  $('#selModelo').innerHTML = `<option value="">Modelos…</option>${modelos.map((m, i) => `<option value="${i}">${esc(m.nome)}</option>`).join('')}${modelos.length ? '<option value="__apagar">Apagar um modelo…</option>' : ''}`;
  if (!NV.iniciado) { NV.iniciado = true; limparForm(); }
}
function gerarPrevia() {
  const total = limitar(parseInt($('#qtd').value, 10) || 1, 1, 360);
  const parcelado = total > 1;
  const modo = $('input[name=modo]:checked').value, intervalo = $('#intervalo').value;
  const inicio = limitar(parseInt($('#inicio').value, 10) || 1, 1, total);
  $('#boxModo').hidden = $('#boxIntervalo').hidden = $('#boxInicio').hidden = !parcelado;
  $('#boxDias').hidden = !parcelado || intervalo !== 'dias';
  $('#inicio').max = total;
  $('#rotVenc').textContent = parcelado ? `Vencimento da parcela ${inicio}/${total} *` : 'Vencimento *';
  $('#rotValor').textContent = !parcelado ? 'Valor *' : (modo === 'total' ? 'Valor total *' : 'Valor de cada parcela *');
  NV.previa = gerarParcelas({ qtd: total, inicio, valor: lerValor($('#valor').value), venc1: $('#venc1').value, modo, intervalo, dias: $('#dias').value });
  NV.removeu = false;
  renderPrevia();
}
function renderPrevia() {
  const tb = $('#previaCorpo');
  if (!NV.previa.length) {
    tb.innerHTML = `<tr><td colspan="4" class="vazio-previa">${NV.removeu ? 'Você tirou todas as parcelas. Mude algum campo acima para gerar de novo.' : 'Preencha o <b>valor</b> e o <b>vencimento</b> para ver as parcelas aqui.'}</td></tr>`;
  } else {
    const h = hoje();
    tb.innerHTML = NV.previa.map((p, i) => {
      let ds = '<span class="ds erro">informe a data</span>';
      if (p.venc && isoValida(p.venc)) { const d = diaSemana(p.venc), fds = d === 0 || d === 6, passou = p.venc < h; ds = `<span class="ds ${fds || passou ? 'alerta' : ''}">${DIAS_LONGO[d]}${fds ? ' · fim de semana' : ''}${passou ? ' · já venceu' : ''}</span>`; }
      return `<tr><td><span class="parc">${p.numero}/${p.total}</span></td>
        <td><div class="venc-cel"><input type="date" value="${p.venc}" data-i="${i}" data-campo="venc" aria-label="Vencimento da parcela ${p.numero}">${ds}</div></td>
        <td class="${p.valor > 0 ? '' : 'invalido'}"><input class="num" inputmode="decimal" value="${p.valor > 0 ? NUM2.format(p.valor) : ''}" data-i="${i}" data-campo="valor" aria-label="Valor da parcela ${p.numero}"></td>
        <td class="dir"><button type="button" class="icone del" data-rem="${i}" title="Tirar esta parcela" tabindex="-1">${ICON.x}</button></td></tr>`;
    }).join('');
  }
  atualizarTotalPrevia();
}
function atualizarTotalPrevia() {
  const n = NV.previa.length;
  const ult = NV.previa.reduce((m, p) => p.venc > m ? p.venc : m, '');
  $('#totalPrevia').innerHTML = n ? `<b>${fmtBRL(somaCent(NV.previa, p => p.valor || 0))}</b> em ${plural(n, 'parcela')}${n > 1 && ult ? ' · última vence em ' + fmtData(ult) : ''}` : '';
  const btn = $('#btnSalvar');
  btn.textContent = n > 1 ? `Salvar ${n} parcelas` : 'Salvar boleto';
  btn.disabled = !n;
  const rep = n && S.vista && $('#doc').value ? possiveisRepetidos(S.vista, $('#doc').value, NV.previa, $('#numDoc').value.trim()) : [];
  $('#avisoRepetido').textContent = rep.length ? `Atenção: já existe ${rep.length === 1 ? 'um boleto' : rep.length + ' boletos'} deste CNPJ/CPF com o mesmo vencimento e valor (ex.: parcela ${rep[0].parcela}, ${fmtData(rep[0].vencimento)}, ${fmtBRL(rep[0].valor)}).` : '';
}
$('#previaCorpo').addEventListener('change', e => {
  const el = e.target, p = NV.previa[Number(el.dataset.i)];
  if (!p) return;
  if (el.dataset.campo === 'venc') { p.venc = el.value; renderPrevia(); }
  if (el.dataset.campo === 'valor') { const v = lerValor(el.value); p.valor = v > 0 ? v : NaN; if (v > 0) el.value = NUM2.format(v); el.closest('td').classList.toggle('invalido', !(v > 0)); atualizarTotalPrevia(); }
});
$('#previaCorpo').addEventListener('click', e => { const b = e.target.closest('[data-rem]'); if (!b) return; NV.previa.splice(Number(b.dataset.rem), 1); NV.removeu = true; renderPrevia(); });
['qtd', 'valor', 'venc1', 'intervalo', 'dias', 'inicio'].forEach(id => $('#' + id).addEventListener('input', gerarPrevia));
$$('input[name=modo]').forEach(r => r.addEventListener('change', gerarPrevia));
$('#valor').addEventListener('blur', e => { const v = lerValor(e.target.value); if (v > 0) e.target.value = NUM2.format(v); });
$('#numDoc').addEventListener('input', debounce(atualizarTotalPrevia, 200));

/* CNPJ/CPF: máscara e conferência (inclui CNPJ com letras) */
function validarDocUI(final) {
  const c = checarDoc($('#doc').value), dica = $('#dicaDoc');
  dica.className = 'dica'; dica.textContent = '';
  if (c.tipo && c.ok) { dica.textContent = '✓ ' + c.tipo + ' válido'; dica.classList.add('ok'); }
  else if (c.tipo) { dica.textContent = c.tipo + ' com dígito verificador errado'; dica.classList.add('erro'); }
  else if (c.incompleto && final) { dica.textContent = 'Use 11 dígitos (CPF) ou 14 caracteres (CNPJ, pode ter letras)'; dica.classList.add('erro'); }
  return c;
}
$('#doc').addEventListener('input', e => { const pos = e.target.selectionStart === e.target.value.length; e.target.value = formatarDoc(e.target.value); if (pos) e.target.selectionStart = e.target.selectionEnd = e.target.value.length; validarDocUI(false); });
$('#doc').addEventListener('blur', () => { validarDocUI(true); preencherPorCliente('doc'); atualizarTotalPrevia(); });

/* Cliente: pela busca, pelo PDV ou pelo CNPJ (cadastro de Clientes; senão, o último lançamento) */
function acharCliente(campo) {
  const ix = S.ix; if (!ix) return null;
  if (campo === 'busca') {
    const t = $('#fBuscaCli').value.trim(); if (!t) return null;
    const d = docLimpo(t.split(' · ').pop());
    const c = S.vista.tabs.clientes.linhas.find(c => !c.excluidoEm && [c.nome, c.pdv && 'PDV ' + c.pdv, c.doc].filter(Boolean).join(' · ') === t);
    if (c) return { c };
    const n = semAcento(t);
    const c2 = S.vista.tabs.clientes.linhas.find(c => !c.excluidoEm && (semAcento(c.nome) === n || normCab(c.pdv) === normCab(t) || (d.length >= 11 && docLimpo(c.doc) === d)));
    return c2 ? { c: c2 } : null;
  }
  if (campo === 'pdv') { const k = normCab($('#pdv').value); if (!k) return null; const c = ix.clientePorPdv.get(k); if (c) return { c }; const b = [...S.vista.tabs.boletos.linhas].reverse().find(b => normCab(b.pdv) === k); return b ? { b } : null; }
  if (campo === 'doc') { const k = docLimpo($('#doc').value); if (k.length < 11) return null; const c = ix.clientePorDoc.get(k); if (c) return { c }; const b = [...S.vista.tabs.boletos.linhas].reverse().find(b => docLimpo(b.doc) === k); return b ? { b } : null; }
  return null;
}
function preencherPorCliente(campo) {
  const r = acharCliente(campo); const dica = $('#dicaCli');
  if (!r) { if (campo === 'busca' && $('#fBuscaCli').value.trim()) { dica.textContent = 'Cliente não cadastrado: preencha os campos abaixo; ele será cadastrado ao salvar.'; dica.className = 'dica alerta'; } return; }
  const fonte = r.c ? { setor: r.c.setor, pdv: r.c.pdv, cliente: r.c.nome, doc: r.c.doc, responsavel: r.c.responsavel } : { setor: r.b.setor, pdv: r.b.pdv, cliente: r.b.cliente, doc: r.b.doc, responsavel: r.b.responsavel };
  let preencheu = false;
  for (const [id, v] of Object.entries(fonte)) { const el = $('#' + id); if (v && (campo === 'busca' || !el.value.trim())) { el.value = v; preencheu = true; el.closest('.campo').classList.remove('invalido'); } }
  if (preencheu) { dica.textContent = r.c ? `Dados do cadastro de clientes${r.c.limite ? ` · limite de crédito ${fmtBRL(r.c.limite)}` : ''}.` : 'Dados preenchidos com o último lançamento deste cliente.'; dica.className = 'dica ok'; validarDocUI(true); }
  if (r.c && r.c.limite) {
    const emAb = somaCent(S.vista.tabs.boletos.linhas.filter(b => emAberto(b) && (docLimpo(b.doc) === docLimpo(r.c.doc) && r.c.doc || normCab(b.pdv) === normCab(r.c.pdv) && r.c.pdv)), saldoDe);
    if (emAb > r.c.limite) { dica.textContent += ` Atenção: em aberto ${fmtBRL(emAb)} — acima do limite.`; dica.className = 'dica alerta'; }
  }
}
$('#fBuscaCli').addEventListener('change', () => preencherPorCliente('busca'));
$('#pdv').addEventListener('change', () => preencherPorCliente('pdv'));

/* Linha digitável / código de barras */
$('#linha').addEventListener('input', () => {
  const dica = $('#dicaLinha'), d = $('#linha').value.replace(/\D/g, '');
  dica.className = 'dica'; dica.textContent = '';
  if (d.length < 44) { if (d.length > 0) dica.textContent = `${d.length} dígitos…`; return; }
  const r = lerBoleto(d, hoje());
  if (!r.ok) { dica.textContent = 'Não confere: ' + r.erros.join('; ') + '. Confira os números.'; dica.className = 'dica erro'; return; }
  if (r.vencimento) $('#venc1').value = r.vencimento;
  if (r.valor > 0) $('#valor').value = NUM2.format(r.valor);
  dica.textContent = `✓ ${r.tipo === 'bancario' ? 'Boleto ' + (r.nomeBanco || 'banco ' + r.banco) : 'Conta/convênio'}${r.vencimento ? ' · vence ' + fmtData(r.vencimento) : ''}${r.valor ? ' · ' + fmtBRL(r.valor) : ''}`;
  dica.className = 'dica ok';
  gerarPrevia();
});

$('#form').addEventListener('input', e => { const c = e.target.closest('.campo'); if (c) c.classList.remove('invalido'); });
/* Enter avança para o próximo campo; no último, salva. Ctrl+Enter salva de qualquer lugar. */
$('#form').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) { $('#form').requestSubmit(); return; }
  const campos = $$('#form input:not([type=radio]):not([type=hidden]), #form select, #form button[type=submit]').filter(el => el.offsetParent !== null && !el.disabled && el.id !== 'selModelo');
  const i = campos.indexOf(e.target);
  const prox = campos[i + 1];
  if (prox) { prox.focus(); if (prox.select && prox.tagName === 'INPUT' && prox.type !== 'date') prox.select(); } else $('#form').requestSubmit();
});
function limparForm(manterCliente) {
  const guarda = manterCliente ? ['setor', 'pdv', 'cliente', 'doc', 'responsavel'].map(id => [id, $('#' + id).value]) : [];
  $('#form').reset();
  for (const [id, v] of guarda) $('#' + id).value = v;
  if (!manterCliente) { $('#setor').value = lsGet('bc2.ultimoSetor', ''); $('#responsavel').value = lsGet('bc2.ultimoResp', ''); }
  $('#intervalo').value = lsGet('bc2.ultimoIntervalo', 'mensal');
  $$('.campo.invalido').forEach(c => c.classList.remove('invalido'));
  ['dicaDoc', 'dicaCli', 'dicaLinha'].forEach(id => { $('#' + id).textContent = ''; });
  gerarPrevia();
}
$('#btnLimpar').addEventListener('click', () => { limparForm(); $('#fBuscaCli').focus(); });
$('#btnSalvarModelo').addEventListener('click', async () => {
  const nome = await pedirTexto('Salvar como modelo', 'Para lançamentos que se repetem (ex.: mensalidade). Fica guardado neste navegador.', $('#cliente').value || $('#pdv').value, 'Salvar');
  if (!nome) return;
  const campos = Object.fromEntries(['setor', 'pdv', 'cliente', 'doc', 'responsavel', 'numDoc', 'obs', 'qtd', 'valor', 'intervalo', 'dias'].map(id => [id, $('#' + id).value]));
  campos.modo = $('input[name=modo]:checked').value;
  const l = lsJSON('bc2.modelos', []).filter(m => m.nome !== nome); l.push({ nome, campos }); l.sort((a, b) => COLL.compare(a.nome, b.nome));
  lsSet('bc2.modelos', JSON.stringify(l)); renderNovo(); aviso('Modelo salvo.');
});
$('#selModelo').addEventListener('change', async e => {
  const v = e.target.value; e.target.value = '';
  const l = lsJSON('bc2.modelos', []);
  if (v === '__apagar') { const n = await pedirTexto('Apagar modelo', 'Nome do modelo:', '', 'Apagar'); if (n) { lsSet('bc2.modelos', JSON.stringify(l.filter(m => m.nome !== n))); renderNovo(); } return; }
  const m = l[+v]; if (!m) return;
  limparForm();
  for (const [id, val] of Object.entries(m.campos)) { if (id === 'modo') { const r = $(`input[name=modo][value="${val}"]`); if (r) r.checked = true; } else if ($('#' + id)) $('#' + id).value = val; }
  validarDocUI(true); gerarPrevia(); $('#venc1').focus();
  aviso(`Modelo "${m.nome}" carregado: confira o vencimento.`);
});
function duplicarParaNovo(b) {
  mostrarAba('novo');
  limparForm();
  for (const [id, k] of [['setor', 'setor'], ['pdv', 'pdv'], ['cliente', 'cliente'], ['doc', 'doc'], ['responsavel', 'responsavel'], ['obs', 'obs']]) $('#' + id).value = b[k] || '';
  $('#valor').value = typeof b.valor === 'number' ? NUM2.format(b.valor) : '';
  if (b.vencimento) $('#venc1').value = somaMeses(b.vencimento, 1);
  validarDocUI(true); gerarPrevia();
  $('#numDoc').focus();
  aviso('Copiado de outro boleto: confira o nº do documento e o vencimento.');
}

$('#form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!S.vista) { aviso('Abra a planilha antes de lançar.', { erro: true }); return; }
  const val = id => $('#' + id).value.trim();
  const dados = { setor: val('setor'), pdv: val('pdv'), cliente: val('cliente'), doc: formatarDoc(val('doc')), numDoc: val('numDoc'), nossoNumero: val('nossoNumero'), obs: val('obs'), responsavel: val('responsavel'), linhaDigitavel: val('linha').replace(/\D/g, ''), parcelas: NV.previa.map(p => ({ ...p })) };
  const faltam = [];
  [['setor', 'setor'], ['pdv', 'PDV'], ['doc', 'CNPJ/CPF']].forEach(([id, nome]) => { if (!dados[id]) { faltam.push(nome); $('#' + id).closest('.campo').classList.add('invalido'); } });
  if (faltam.length) { aviso('Preencha: ' + faltam.join(', '), { erro: true }); $('.campo.invalido input').focus(); return; }
  if (!dados.parcelas.length) { aviso('Não há parcelas para salvar. Preencha valor e vencimento.', { erro: true }); $('#valor').focus(); return; }
  if (dados.parcelas.some(p => !isoValida(p.venc) || !(p.valor > 0))) { aviso('Confira as datas e valores das parcelas marcadas.', { erro: true }); return; }
  const c = validarDocUI(true);
  if (!c.ok && !await confirmar('CNPJ/CPF parece errado', `"${dados.doc}" não passou na conferência dos dígitos. Salvar mesmo assim?`, 'Salvar mesmo assim')) { $('#doc').focus(); return; }
  const rep = possiveisRepetidos(S.vista, dados.doc, dados.parcelas, dados.numDoc);
  if (rep.length && !await confirmar('Possível lançamento repetido', `Já existe ${rep.length === 1 ? 'um boleto' : rep.length + ' boletos'} com o mesmo CNPJ/CPF, vencimento e valor (ex.: parcela ${rep[0].parcela}, ${fmtData(rep[0].vencimento)}, ${fmtBRL(rep[0].valor)}). Salvar mesmo assim?`, 'Salvar mesmo assim')) return;
  if (dados.linhaDigitavel && dados.parcelas.length > 1) dados.linhaDigitavel = '';        // a linha digitável é de um boleto só
  const ops = opsLancamento(S.vista, dados, novoCtx(USUARIO()));
  lsSet('bc2.ultimoSetor', dados.setor); if (dados.responsavel) lsSet('bc2.ultimoResp', dados.responsavel); lsSet('bc2.ultimoIntervalo', $('#intervalo').value);
  const n = dados.parcelas.length;
  executar(`${n === 1 ? 'Boleto salvo' : n + ' parcelas salvas'} · lançamento #${ops.lancamento}${ops.clienteCriado ? ' · cliente cadastrado' : ''}`, ops);
  limparForm();
  $('#fBuscaCli').focus();
});
