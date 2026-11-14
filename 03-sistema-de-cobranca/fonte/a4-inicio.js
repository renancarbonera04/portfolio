/* =====================================================================
   2.4 TELAS — topo, indicador de gravação, faixas, menus, tela inicial
   ===================================================================== */
const UI = { aba: lsGet('bc2.aba', 'hoje'), soMeus: lsGet('bc2.soMeus') === '1' };
function mostrarAba(nome) {
  if (!$('#p-' + nome)) nome = 'hoje';
  if (nome !== 'inicio') { UI.aba = nome; lsSet('bc2.aba', nome); }
  $$('.aba[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === nome));
  $('#abaMais').classList.toggle('ativa', ['importar', 'lixeira', 'historico', 'verificar', 'config', 'diagnostico', 'ajuda'].includes(nome));
  $$('.painel').forEach(p => p.classList.toggle('ativo', p.id === 'p-' + nome));
  $('#nav').hidden = nome === 'inicio';
  renderAba(nome);
  window.scrollTo(0, 0);
}
function renderAba(nome = UI.aba) {
  if (!S.vista && nome !== 'inicio' && nome !== 'ajuda' && nome !== 'diagnostico') return;
  try {
    const f = { hoje: renderHoje, boletos: renderBoletos, novo: renderNovo, clientes: renderClientes, painel: renderPainel, calendario: renderCalendario, conciliacao: renderConciliacao, importar: renderImportar, lixeira: renderLixeira, historico: renderHistorico, verificar: renderVerificar, config: renderConfig, diagnostico: renderDiagnostico, ajuda: renderAjuda }[nome];
    if (f) f();
  } catch (e) { diag('erro', `tela ${nome}: ${detalheErro(e)}`); window.__mostrarErro && window.__mostrarErro(`Erro ao montar a tela "${nome}": ${detalheErro(e)}`); }
}
function renderTudo() {
  if (!S.vista) return;
  renderTopo(); renderSalvo(); renderFaixas(); renderPresenca();
  renderAba(UI.aba);
  atualizarGaveta();
  if (A.modo === 'arquivo' && A.podeLer && !A.podeGravar) prepararEmSegundoPlano();
}
function renderTopo() {
  const k = kpis(S.vista, hojeLocal());
  $('#sub').textContent = `${plural(k.aberto.qtd, 'boleto')} em aberto · ${fmtBRL(k.aberto.valor)}` + (k.vencidos.qtd ? ` · ${k.vencidos.qtd} vencido${k.vencidos.qtd > 1 ? 's' : ''}` : '');
  const bv = $('#badgeVenc'); bv.hidden = !k.vencidos.qtd; bv.textContent = k.vencidos.qtd;
  const ag = agendaHoje(S.vista, hojeLocal(), { usuario: USUARIO(), soMeus: UI.soMeus });
  const nh = ag.filter(g => g.k !== 'semAcao').reduce((s, g) => s + g.itens.length, 0);
  const bh = $('#badgeHoje'); bh.hidden = !nh; bh.textContent = nh;
  $('#btnUsuario').textContent = USUARIO();
  atualizarListas();
}
/* Indicador permanente: "Salvo às 14:32" / "Gravando…" / "Pendente: N" / "Clique para liberar" */
function renderSalvo() {
  const c = $('#salvo'), t = $('#salvoTxt');
  let cls = '', txt = '';
  const n = nPend();
  if (!A.modo) { txt = 'Sem planilha'; }
  else if (A.modo === 'navegador') { cls = S.erro ? 'erro' : 'ok'; txt = S.erro ? 'Não guardado' : 'Guardado neste navegador'; }
  else if (S.gravando) { cls = 'gravando'; txt = 'Gravando…'; }
  else if (!A.podeGravar && (A.podeLer || n || S.daCache || S.base)) { cls = 'liberar'; txt = n ? `Clique para liberar a gravação (${plural(n, 'pendente')})` : (A.podeLer ? 'Somente leitura · clique para liberar a gravação' : 'Clique para liberar a planilha'); }
  else if (S.erro && S.erro.tipo !== 'semPermissao') { cls = n ? 'pendente' : 'erro'; txt = n ? `Pendente: ${plural(n, 'alteração', 'alterações')} (tentando de novo)` : 'Problema na planilha'; }
  else if (n) { cls = 'pendente'; txt = `Pendente: ${plural(n, 'alteração', 'alterações')}`; }
  else { cls = 'ok'; txt = S.salvoEm ? `Salvo às ${horaCurta(S.salvoEm)}` : (S.lidoEm ? `Atualizado às ${horaCurta(S.lidoEm)}` : 'Tudo gravado'); }
  c.className = 'salvo ' + cls;
  t.textContent = txt;
  c.title = (S.erro ? S.erro.msg + '\n' : '') + (A.nome ? `Planilha: ${A.nome}` : '');
  document.title = (n ? '• ' : '') + 'Boletos a cobrar';
}
function renderPresenca() {
  const p = $('#presenca');
  const nomes = [...new Set(S.presenca)].filter(Boolean);
  const ex = S.excel && S.excel.nome ? S.excel : null;
  if (!nomes.length && !ex) { p.hidden = true; return; }
  p.hidden = false;
  const txt = [nomes.length ? `${listaNomes(nomes)} ${nomes.length > 1 ? 'estão' : 'está'} com o sistema aberto` : '', ex ? `planilha aberta no Excel por ${ex.nome}` : ''].filter(Boolean).join(' · ');
  p.innerHTML = `<span class="bolinhas">${nomes.slice(0, 4).map(n => `<span class="bol" title="${esc(n)}">${esc(iniciais(n))}</span>`).join('')}</span><span class="txt">${esc(txt)}</span>`;
  p.title = txt;
}
/* Faixas no topo da tela: liberar, erros que precisam de atenção */
function renderFaixas() {
  const f = $('#faixas'); const out = [];
  if (A.modo && A.modo !== 'navegador') {
    if (!A.podeLer && !A.podeGravar) {
      const quando = S.daCache ? ` Você está vendo a cópia guardada neste computador (de ${S.daCache}).` : '';
      out.push(`<div class="faixa liberar"><p><b>Clique para liberar a planilha "${esc(A.nome)}".</b>${quando} ${A.modo === 'pasta' && A.flags.rpFalha ? 'Na janela que abrir, confirme a pasta e clique em "Permitir".' : ''} ${nPend() ? `<br>${nPend() > 1 ? `${nPend()} alterações suas estão guardadas e serão gravadas` : 'Uma alteração sua está guardada e será gravada'} logo depois.` : ''}</p><button type="button" class="btn grande" data-acao="liberar">Liberar a planilha</button></div>`);
    } else if (!A.podeGravar) {
      out.push(`<div class="faixa liberar"><p><b>Você está vendo os dados atuais, mas ainda não pode gravar.</b> Clique em "Liberar a gravação": o Windows vai perguntar se quer <b>substituir</b> "${esc(A.nome)}" — responda <b>Sim</b>. É seguro: o sistema regrava a planilha na mesma hora, com tudo dentro.${nPend() ? ` (${plural(nPend(), 'alteração esperando', 'alterações esperando')})` : ''}</p><button type="button" class="btn grande" data-acao="liberar">Liberar a gravação</button></div>`);
    }
  }
  if (S.erro && !['semPermissao'].includes(S.erro.tipo)) {
    const seg = S.erro.proxima ? Math.max(0, Math.round((S.erro.proxima - Date.now()) / 1000)) : 0;
    out.push(`<div class="faixa ${S.erro.tipo === 'protegida' ? 'erro' : 'aviso'}"><p>${esc(S.erro.msg)}${seg ? ` <span class="sub">(próxima tentativa em ${seg} s)</span>` : ''}</p>${S.erro.tipo !== 'protegida' ? '<button type="button" class="btn sec" data-acao="tentar">Tentar agora</button>' : ''}<button type="button" class="btn sec" data-acao="baixarCopia">Baixar cópia (.xlsx)</button></div>`);
  }
  if (S.ilegivelDesde && Date.now() - S.ilegivelDesde > 45000 && S.base && !S.daCache) {
    out.push(`<div class="faixa erro"><p><b>A planilha está ilegível há mais de 45 segundos</b> (${esc(S.ultimoErroLeitura)}). Se ninguém está gravando, ela pode ter sido danificada. Você pode regravá-la com a última versão boa que este computador leu (${S.lidoEm ? horaCurta(S.lidoEm) : '—'}), ou restaurar um backup.</p><button type="button" class="btn perigo" data-acao="regravarBoa">Regravar com a última versão boa</button><button type="button" class="btn sec" data-aba="diagnostico">Ver backups</button></div>`);
  }
  if (A.modo === 'navegador' && !lsGet('bc2.navAvisado')) out.push(`<div class="faixa info"><p>Os boletos estão guardados <b>só neste navegador</b>, neste computador. Baixe a planilha de vez em quando para ter uma cópia (menu do indicador no topo).</p><button type="button" class="btn sec" data-acao="okNav">Entendi</button></div>`);
  f.innerHTML = out.join('');
}
$('#faixas').addEventListener('click', async e => {
  const b = e.target.closest('[data-acao],[data-aba]'); if (!b) return;
  if (b.dataset.aba) return mostrarAba(b.dataset.aba);
  const a = b.dataset.acao;
  if (a === 'liberar') { b.disabled = true; try { await liberar(); } finally { b.disabled = false; } }
  else if (a === 'tentar') { S.tentativa = 0; agendarGravacao(0); }
  else if (a === 'baixarCopia') baixarCopia();
  else if (a === 'okNav') { lsSet('bc2.navAvisado', '1'); renderFaixas(); }
  else if (a === 'regravarBoa') regravarUltimaBoa();
});
setInterval(() => { if (S.erro && S.erro.proxima) renderFaixas(); }, 5000);
async function baixarCopia() {
  try {
    const bytes = await gerarPlanilha(S.vista);
    baixarArquivo(bytes, `${(A.nome || 'Boletos a cobrar').replace(/\.xlsx$/i, '')} - cópia ${carimboArquivo()}.xlsx`);
  } catch (e) { aviso('Não consegui gerar a cópia: ' + detalheErro(e), { erro: true }); }
}
async function regravarUltimaBoa() {
  if (!await confirmar('Regravar a planilha?', `A planilha "${A.nome}" será regravada com os dados que este computador leu às ${S.lidoEm ? horaCurta(S.lidoEm) : '—'}, mais as suas alterações pendentes. Use só se a planilha estiver mesmo danificada.`, 'Regravar', true)) return;
  naFila(async () => {
    try {
      const r2 = aplicarOps(S.base, S.pend);
      const bytes = await gerarPlanilha(r2.doc);
      await gravarBackup(S.bytes, 'antes de regravar', true);
      const m = await escreverBytes(bytes);
      S.base = r2.doc; S.meta = m; S.bytes = bytes; S.pend = []; salvarPend(); S.ilegivelDesde = 0; S.erro = null; S.salvoEm = new Date();
      aviso('Planilha regravada com a última versão boa.'); recalcular();
    } catch (e) { aviso('Não consegui regravar: ' + detalheErro(e), { erro: true }); }
  });
}

/* ---------- menu do indicador de gravação ---------- */
function abrirMenu(ancora, html, aoClicar) {
  fecharMenu();
  const m = document.createElement('div');
  m.className = 'menu'; m.id = 'menuAberto'; m.innerHTML = html;
  document.body.appendChild(m);
  const r = ancora.getBoundingClientRect();
  const w = m.offsetWidth;
  m.style.top = (r.bottom + window.scrollY + 4) + 'px';
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; fecharMenu(); aoClicar(b.dataset.m, b); });
  setTimeout(() => { const f = m.querySelector('button'); if (f) f.focus(); }, 10);
}
function fecharMenu() { const m = $('#menuAberto'); if (m) m.remove(); }
document.addEventListener('mousedown', e => { if (!e.target.closest('#menuAberto') && !e.target.closest('#salvo,#abaMais')) fecharMenu(); });
$('#salvo').addEventListener('click', () => {
  if (!A.modo) return;
  if (A.modo !== 'navegador' && !A.podeGravar && $('#menuAberto') == null && !S.gravando) { liberar(); return; }
  const n = nPend();
  let info;
  if (A.modo === 'navegador') info = 'Os boletos estão guardados só neste navegador, neste computador.';
  else if (S.erro) info = `<span class="erro">${esc(S.erro.msg)}</span>`;
  else info = `Gravando em <b>${esc(A.nome)}</b>${A.dir ? ` (pasta <b>${esc(A.dir.name)}</b>)` : ''}.<br>${S.salvoEm ? 'Última gravação às ' + horaCurta(S.salvoEm) + '. ' : ''}${S.lidoEm ? 'Última leitura às ' + horaCurta(S.lidoEm) + '.' : ''}`;
  const itens = [`<div class="info${S.erro ? ' erro' : ''}">${info}${n ? `<br><b>${plural(n, 'alteração', 'alterações')}</b> esperando gravação (guardadas neste navegador).` : ''}</div>`];
  if (n && A.podeGravar) itens.push('<button data-m="tentar" class="dest">Gravar agora</button>');
  if (A.modo !== 'navegador') itens.push('<button data-m="reler">Reler a planilha agora</button>');
  itens.push('<button data-m="baixar">Baixar uma cópia (.xlsx)</button>');
  if (A.modo === 'navegador') itens.push('<button data-m="importar">Importar planilha (.xlsx)…</button>');
  itens.push('<button data-m="diag">Diagnóstico e backups</button><hr><button data-m="trocar">Trocar de planilha…</button>');
  abrirMenu($('#salvo'), itens.join(''), async m => {
    if (m === 'tentar') { S.tentativa = 0; agendarGravacao(0); }
    else if (m === 'reler') { const mudou = await naFila(() => releitura(true)); aviso(mudou ? 'Planilha relida.' : 'A planilha não mudou.'); }
    else if (m === 'baixar') baixarCopia();
    else if (m === 'importar') importarParaNavegador();
    else if (m === 'diag') mostrarAba('diagnostico');
    else if (m === 'trocar') trocarPlanilha();
  });
});
$('#abaMais').addEventListener('click', () => {
  abrirMenu($('#abaMais'), [['importar', 'Importar boletos (CSV/Excel)'], ['lixeira', 'Lixeira'], ['historico', 'Histórico'], ['verificar', 'Verificar planilha'], ['config', 'Configurações'], ['diagnostico', 'Diagnóstico e backups'], ['ajuda', 'Ajuda e atalhos']].map(([k, t]) => `<button data-m="${k}">${t}</button>`).join(''), m => mostrarAba(m));
});
$$('.aba[data-aba]').forEach(b => b.addEventListener('click', () => mostrarAba(b.dataset.aba)));
$('#btnUsuario').addEventListener('click', async () => {
  const n = await pedirTexto('Seu nome', 'Aparece em "criado por/alterado por" e no filtro "meus boletos". Fica guardado só neste navegador.', USUARIO() === 'Sem nome' ? '' : USUARIO(), 'Salvar');
  if (n) { lsSet('bc2.usuario', n); renderTudo(); }
});
$('#btnTema').addEventListener('click', () => {
  const escuro = document.documentElement.getAttribute('data-tema') !== 'escuro';
  if (escuro) document.documentElement.setAttribute('data-tema', 'escuro'); else document.documentElement.removeAttribute('data-tema');
  lsSet('bc2.tema', escuro ? 'escuro' : 'claro');
  if (S.vista) renderAba();
});
$('#btnAtalhos').addEventListener('click', mostrarAtalhos);

/* ---------- tela inicial: onde está a planilha ---------- */
function mostrarInicio(erro) {
  $('#nav').hidden = true;
  $('#sub').textContent = 'Escolha onde fica a planilha';
  const rec = TEM_PASTA && !A.flags.dirFalha;
  $('#p-inicio').innerHTML = `<div class="inicio"><div class="card" style="padding:22px">
    <h2 style="font-size:19px">Onde fica a planilha do time?</h2>
    <p class="lead">Os boletos ficam numa planilha do Excel (.xlsx) na pasta da rede do financeiro. Cada alteração feita aqui é gravada nela na hora; até 4 pessoas podem usar ao mesmo tempo. Nada sai do computador.</p>
    ${TEM_FSA ? `<div class="opcoes">
      ${TEM_PASTA ? `<button type="button" class="opcao${rec ? ' rec' : ''}" data-ini="pasta"><b>Escolher a pasta da planilha${rec ? ' (recomendado)' : ''}</b><span>Ex.: \\\\servidor\\…\\financeiro\\bases. Dá para gravar backups automáticos e ver quem está usando.</span></button>` : ''}
      <button type="button" class="opcao${rec ? '' : ' rec'}" data-ini="arquivo"><b>Escolher a planilha (.xlsx)</b><span>Uma planilha já criada por este sistema (V1 ou V2) ou do time.</span></button>
      <button type="button" class="opcao" data-ini="nova"><b>Criar planilha nova</b><span>${TEM_PASTA ? 'Você escolhe a pasta; a planilha é criada nela.' : 'Escolha um nome NOVO (se escolher um arquivo existente, ele será substituído).'}</span></button>
      <button type="button" class="opcao" data-ini="navegador"><b>Guardar só neste navegador</b><span>Sem planilha compartilhada. Para quando o navegador não deixa gravar arquivos.</span></button>
    </div>` : `<div class="faixa aviso"><p>Este navegador não deixa gravar direto num arquivo. Abra este arquivo no <b>Microsoft Edge</b> ou no <b>Google Chrome</b> atualizados. Se não puder, guarde os boletos aqui no navegador e baixe a planilha sempre que quiser.</p></div>
      <div class="barra"><button type="button" class="btn" data-ini="navegador">Guardar neste navegador</button><button type="button" class="btn sec" data-ini="importarNav">Importar planilha (.xlsx)</button></div>`}
    <p class="dica erro" id="inicioErro" style="margin-top:12px">${esc(erro || '')}</p>
    <ol class="passos">
      <li>Todo dia, ao abrir este arquivo, clique em <b>Liberar a planilha</b> e confirme a pergunta do navegador. Depois disso, nenhuma outra pergunta.</li>
      <li>Evite deixar a planilha aberta no Excel: enquanto ela estiver aberta lá, o sistema não consegue gravar (suas alterações ficam guardadas e são gravadas quando o Excel fechar).</li>
      <li>Não coloque senha nem rótulo de confidencialidade na planilha.</li>
    </ol>
  </div></div>`;
  $$('.painel').forEach(p => p.classList.toggle('ativo', p.id === 'p-inicio'));
  renderSalvo();
}
$('#p-inicio').addEventListener('click', async e => {
  const b = e.target.closest('[data-ini]'); if (!b) return;
  const erro = msg => { $('#inicioErro').textContent = msg || ''; };
  erro('');
  try {
    if (b.dataset.ini === 'pasta') await iniciarPorPasta();
    else if (b.dataset.ini === 'arquivo') await iniciarPorArquivo();
    else if (b.dataset.ini === 'nova') await iniciarNova();
    else if (b.dataset.ini === 'navegador') await iniciarNavegador();
    else if (b.dataset.ini === 'importarNav') await importarParaNavegador();
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    diag('erro', 'início: ' + detalheErro(err));
    if ((b.dataset.ini === 'pasta' || b.dataset.ini === 'nova') && err && (err.name === 'SecurityError' || err.name === 'NotAllowedError') && !/gesture|activation/i.test(err.message || '')) {
      A.flags.dirFalha = true; salvarFlags();
      mostrarInicio('Este computador não deixa escolher a pasta. Use "Escolher a planilha (.xlsx)".');
      return;
    }
    erro(msgErroAcesso(err));
  }
});
async function conectarArquivo(modo, dir, arq, nome) {
  A.modo = modo; A.dir = dir || null; A.arq = arq; A.arqG = null; A.nome = nome || arq.name;
  await atualizarPermissoes();
  S.conf = []; S.pend = await carregarPend(); S.meta = null; S.base = null; S.daCache = null; S.desfazer = []; S.refazer = []; S.erro = null;
  const r = await comTempo(lerRemoto(true), 90000, 'abrir a planilha');
  if (!r.doc) throw Object.assign(new Error('A planilha está vazia (0 bytes). Se alguém está gravando agora, espere alguns segundos e tente de novo; senão, restaure um backup.'), { tipo: 'vazia' });
  integrar(r);
  await lembrarAcesso();
  entrarApp();
  if (nPend()) aviso(`${plural(nPend(), 'alteração que não tinha sido gravada foi recuperada', 'alterações que não tinham sido gravadas foram recuperadas')} e ${nPend() > 1 ? 'serão gravadas' : 'será gravada'} agora.`, { ms: 8000 });
  if (A.podeGravar) agendarGravacao(0);
  if (A.modo === 'pasta') naFila(atualizarPresencaPasta);
}
async function iniciarPorPasta() {
  const dir = await janelaPasta();
  const rw = await permissao(dir, 'readwrite');
  if (rw !== 'granted') { A.flags.dirFalha = true; salvarFlags(); }
  const lista = await planilhasDaPasta(dir);
  let nome;
  if (!lista.length) {
    if (rw !== 'granted') throw new Error('Esta pasta não tem nenhuma planilha .xlsx, e este computador não deixa criar arquivos por aqui. Use "Criar planilha nova".');
    nome = await pedirTexto('Criar a planilha nesta pasta', `A pasta "${dir.name}" não tem planilha. Qual nome usar?`, 'Boletos a cobrar.xlsx', 'Criar');
    if (!nome) return;
    if (!/\.xlsx$/i.test(nome)) nome += '.xlsx';
    const h = await comTempo(dir.getFileHandle(nome, { create: true }), 10000, 'criar a planilha');
    const f = await comTempo(h.getFile(), 10000, 'criar a planilha');
    if (f.size === 0) { A.modo = 'pasta'; A.dir = dir; A.nome = nome; A.arq = A.arqG = h; A.podeLer = A.podeGravar = true; await escreverBytes(await gerarPlanilha(docVazio())); }
  } else if (lista.length === 1) nome = lista[0];
  else {
    nome = await new Promise(res => {
      let v = null;
      const box = abrirJanela(`<h3>Qual é a planilha dos boletos?</h3><p>A pasta "${esc(dir.name)}" tem mais de uma planilha.</p><div class="pilha" style="gap:6px">${lista.map(n => `<button type="button" class="opcao" data-n="${esc(n)}"><b>${esc(n)}</b></button>`).join('')}</div><div class="modal-acoes"><button type="button" class="btn sec" data-n="">Cancelar</button></div>`, { aoFechar: () => res(v) });
      box.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; v = b.dataset.n || null; fecharJanela(); });
    });
    if (!nome) return;
  }
  const arq = await comTempo(dir.getFileHandle(nome), 10000, 'achar a planilha na pasta');
  await conectarArquivo(rw === 'granted' ? 'pasta' : 'arquivo', dir, arq, nome);
  if (rw !== 'granted') aviso('Este computador não deixa gravar pela pasta. Use o botão "Liberar a gravação" (confirme "Substituir").', { alerta: true, ms: 12000 });
}
async function iniciarPorArquivo() {
  const h = await janelaAbrir();
  await conectarArquivo('arquivo', null, h, h.name);
  if (!A.podeGravar && !EH_HTTP && !A.flags.rpFalha) {
    try { if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') { await atualizarPermissoes(); agendarGravacao(0); } }
    catch (e) { diag('erro', 'requestPermission inicial: ' + detalheErro(e)); A.flags.rpFalha = true; salvarFlags(); }
    renderFaixas(); renderSalvo();
  }
}
async function iniciarNova() {
  if (TEM_PASTA && !A.flags.dirFalha) {
    const dir = await janelaPasta();
    if ((await permissao(dir, 'readwrite')) !== 'granted') { A.flags.dirFalha = true; salvarFlags(); throw new Error('Este computador não deixa criar arquivos pela pasta. Clique de novo em "Criar planilha nova" para usar a outra forma.'); }
    let nome = await pedirTexto('Nome da planilha nova', `Ela será criada na pasta "${dir.name}".`, 'Boletos a cobrar.xlsx', 'Criar');
    if (!nome) return;
    if (!/\.xlsx$/i.test(nome)) nome += '.xlsx';
    let existe = false; try { await comTempo(dir.getFileHandle(nome), 10000, 'olhar a pasta'); existe = true; } catch (e) { if (e.name === 'Tempo') throw e; }
    if (existe) throw new Error(`Já existe "${nome}" nessa pasta. Para usar a planilha que já existe, escolha "Escolher a pasta da planilha"; para criar outra, use outro nome.`);
    const h = await comTempo(dir.getFileHandle(nome, { create: true }), 10000, 'criar a planilha');
    A.modo = 'pasta'; A.dir = dir; A.nome = nome; A.arq = A.arqG = h; A.podeLer = A.podeGravar = true;
    await escreverBytes(await gerarPlanilha(docVazio()));
    await conectarArquivo('pasta', dir, h, nome);
    aviso(`Planilha "${nome}" criada. Já pode lançar.`);
    return;
  }
  const h = await janelaSalvar('Boletos a cobrar.xlsx');
  A.modo = 'arquivo'; A.arq = A.arqG = h; A.nome = h.name; A.podeLer = A.podeGravar = true;
  await escreverBytes(await gerarPlanilha(docVazio()));
  await conectarArquivo('arquivo', null, h, h.name);
  aviso(`Planilha "${h.name}" criada. Já pode lançar.`);
}
async function iniciarNavegador(bytes) {
  A.modo = 'navegador'; A.dir = A.arq = A.arqG = null; A.nome = 'Boletos a cobrar (navegador).xlsx'; A.podeLer = A.podeGravar = true;
  const atual = await idbGet('nav:dados');
  if (bytes || !atual) await escreverBytes(bytes || await gerarPlanilha(docVazio()));
  S.pend = await carregarPend(); S.meta = null; S.base = null; S.erro = null;
  const r = await lerRemoto(true);
  integrar(r);
  await lembrarAcesso();
  entrarApp();
  if (S.pend.length) agendarGravacao(0);      // pendências da última vez (ou de outra aba fechada)
}
async function importarParaNavegador() {
  const f = await escolherArquivo('.xlsx');
  if (!f) return;
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const d = await lerPlanilha(bytes);
    const atual = await idbGet('nav:dados');
    if (atual && atual.bytes) {
      if (!await confirmar('Substituir os dados deste navegador?', `Os boletos guardados neste navegador serão trocados pelos ${d.tabs.boletos.linhas.length} de "${f.name}". Antes, uma cópia do que existe hoje será baixada.`, 'Substituir', true)) return;
      baixarArquivo(atual.bytes, `Boletos do navegador antes de importar ${carimboArquivo()}.xlsx`);
    }
    const bytes2 = await gerarPlanilha(migrarV1(d));
    await idbSet('nav:dados', { bytes: bytes2, lastModified: Date.now() });
    await iniciarNavegador();
    aviso(`${plural(d.tabs.boletos.linhas.length, 'boleto importado', 'boletos importados')} de "${f.name}".`);
  } catch (e) { aviso(msgErroAcesso(e), { erro: true, ms: 12000 }); }
}
async function trocarPlanilha() {
  await naFila(() => {});                       // espera terminar a gravação em andamento
  if (nPend() && !await confirmar('Há alterações não gravadas', `${plural(nPend(), 'alteração continua guardada', 'alterações continuam guardadas')} neste navegador e ${nPend() > 1 ? 'serão gravadas' : 'será gravada'} quando você abrir esta mesma planilha de novo.`, 'Trocar mesmo assim')) return;
  salvarPend();
  A.modo = null; A.dir = A.arq = A.arqG = null; A.nome = ''; A.podeLer = A.podeGravar = false;
  S.base = S.vista = null; S.pend = []; S.erro = null;
  await idbSet('acesso', undefined); lsDel('bc2.modo');
  fecharGaveta();
  mostrarInicio();
}
function entrarApp() {
  $('#nav').hidden = false;
  if (S.base && !S.vista) { S.vista = S.base; S.ix = indices(S.vista); }
  mostrarAba(UI.aba === 'inicio' ? 'hoje' : UI.aba);
  if (S.base) recalcular(); else renderTudo();
  anunciarAba();
}

/* ---------- partida ---------- */
async function pedirNome() {
  return new Promise(res => {
    const box = abrirJanela(`<h3>Bem-vindo! Qual é o seu nome?</h3><p>Ele aparece nos boletos que você cria ou altera e no filtro "meus boletos". Fica guardado só neste navegador.</p><form><input id="jNome" autofocus placeholder="Ex.: Maria Alves" list="dlResp"><div class="modal-acoes"><button type="submit" class="btn">Continuar</button></div></form>`, { fixa: true, aoFechar: () => res() });
    box.querySelector('form').onsubmit = e => { e.preventDefault(); const v = box.querySelector('#jNome').value.trim(); if (!v) { box.querySelector('#jNome').focus(); return; } lsSet('bc2.usuario', v); fecharJanela(); };
  });
}
async function iniciar() {
  window.__appOk = true;
  $('#btnUsuario').textContent = USUARIO();
  renderSalvo();
  if (!lsGet('bc2.usuario')) await pedirNome();
  $('#btnUsuario').textContent = USUARIO();
  const seguro = /[?&]seguro/.test(location.search);
  let tem = false;
  try { tem = !seguro && await comTempo(restaurarAcesso(), 5000, 'lembrar a planilha'); } catch (e) { diag('erro', 'restaurar acesso: ' + detalheErro(e)); }
  if (!tem) { mostrarInicio(seguro ? 'Modo de segurança: escolha a planilha.' : ''); return; }
  if (A.modo === 'navegador') { try { await iniciarNavegador(); } catch (e) { mostrarInicio(msgErroAcesso(e)); } return; }
  // Mostra na hora a última cópia guardada; a planilha atual vem logo em seguida
  S.pend = await carregarPend();
  const cache = await idbGet('cache:' + chaveArquivo());
  if (cache && cache.bytes) {
    try { S.base = await comTempo(lerPlanilha(cache.bytes), 30000, 'abrir a cópia local'); S.bytes = cache.bytes; const d = new Date(cache.quando); S.daCache = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${horaCurta(d)}`; }
    catch (e) { diag('erro', 'cache ilegível: ' + detalheErro(e)); }
  }
  if (!S.base) { S.base = docVazio(); S.daCache = 'nenhuma cópia guardada'; }
  entrarApp();
  try { await atualizarPermissoes(); } catch (e) { diag('erro', 'permissões: ' + detalheErro(e)); }
  renderFaixas(); renderSalvo();
  if (A.podeLer) {
    try { await naFila(() => releitura(true)); if (A.podeGravar) agendarGravacao(0); if (A.modo === 'pasta') naFila(atualizarPresencaPasta); }
    catch (e) { aviso(msgErroAcesso(e), { erro: true }); }
  }
}
