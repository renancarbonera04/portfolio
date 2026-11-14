/* =====================================================================
   NÚCLEO 3 — Esquema das abas, leitura da planilha para o modelo,
   migração V1→V2 e geração das abas do sistema (Boletos, Resumo, …).
   ===================================================================== */
const ESQUEMA_VERSAO = 2;
const STATUS = ['Em aberto', 'Pago', 'Cancelado', 'Renegociado'];
const C = (k, h, tipo, w, alias = [], extra = {}) => ({ k, h, tipo, w, alias: [normCab(h), ...alias.map(normCab)], ...extra });
const ESQUEMA = {
  boletos: {
    aba: 'Boletos', ordem: 1, cor: '1D6A56', apelidosAba: ['boletos', 'boletosacobrar'],
    cols: [
      C('vencimento', 'Vencimento', 'data', 12, ['venc', 'datavencimento', 'datadevencimento', 'dtvencimento']),
      C('status', 'Status', 'status', 13, ['situacao']),
      C('valor', 'Valor', 'moeda', 14, ['valorr', 'valorrs', 'valordoboleto', 'valororiginal', 'valordotitulo']),
      C('saldo', 'Saldo em aberto', 'moeda', 14, ['saldo', 'saldoaberto'], { derivada: true }),
      C('parcela', 'Parcela', 'txt@', 9, ['parc', 'parcelas']),
      C('setor', 'Setor', 'txt', 18, ['setordocliente', 'segmento']),
      C('pdv', 'PDV', 'txt@', 14, ['codigopdv', 'codpdv']),
      C('cliente', 'Cliente', 'txt', 30, ['razaosocial', 'clienterazaosocial', 'nome', 'sacado', 'pagador', 'nomedocliente']),
      C('doc', 'CNPJ/CPF', 'txt@', 20, ['cpfcnpj', 'cnpj', 'cpf', 'documento', 'cnpjcpfdocliente']),
      C('numDoc', 'Nº documento', 'txt@', 16, ['ndocumento', 'nodocumento', 'numdocumento', 'numerodocumento', 'ndoboleto', 'nboleto', 'noboleto', 'numeroboleto', 'numerodoboleto', 'numerodotitulo', 'ntitulo', 'seunumero', 'nf', 'notafiscal']),
      C('obs', 'Observação', 'txt', 32, ['obs', 'observacoes']),
      C('etapa', 'Etapa de cobrança', 'txt', 20, ['etapa', 'etapacobranca']),
      C('promessaEm', 'Promessa para', 'data', 13, ['promessa', 'promessadepagamento', 'datapromessa']),
      C('proxAcao', 'Próxima ação', 'txt', 24, ['proximaacao']),
      C('proxAcaoEm', 'Próxima ação em', 'data', 13, ['dataproximaacao']),
      C('responsavel', 'Responsável', 'txt', 16, ['responsavelcobranca', 'cobrador']),
      C('pagoEm', 'Pago em', 'data', 12, ['datapagamento', 'datadepagamento', 'pagamento', 'datadabaixa', 'baixa']),
      C('valorPago', 'Valor recebido', 'moeda', 14, ['valorpago'], { derivada: true }),
      C('formaPagamento', 'Forma de pagamento', 'txt', 16, ['forma', 'formapagamento']),
      C('nossoNumero', 'Nosso número', 'txt@', 18, ['nossonumero', 'nnumero']),
      C('linhaDigitavel', 'Linha digitável', 'txt@', 30, ['linhadigitavel', 'codigodebarras', 'codbarras']),
      C('id', 'ID', 'int', 7, []),
      C('lancamento', 'Lançamento', 'int', 11, []),
      C('renegociadoDe', 'Renegociação de', 'txt', 16, ['origemrenegociacao']),
      C('renegociadoPara', 'Renegociado em', 'txt', 15, ['renegociadoem', 'substituidopor']),
      C('criadoEm', 'Cadastrado em', 'datahora', 16, ['criadoem']),
      C('criadoPor', 'Cadastrado por', 'txt', 14, ['criadopor']),
      C('alteradoEm', 'Alterado em', 'datahora', 16, ['ultimaalteracao']),
      C('alteradoPor', 'Alterado por', 'txt', 14, []),
      C('excluidoEm', 'Na lixeira desde', 'datahora', 16, ['excluidoem', 'lixeira']),
      C('excluidoPor', 'Posto na lixeira por', 'txt', 14, ['excluidopor'])
    ]
  },
  clientes: {
    aba: 'Clientes', ordem: 3, cor: '2F6FB0', apelidosAba: ['clientes', 'cadastrodeclientes'],
    cols: [
      C('nome', 'Cliente', 'txt', 32, ['nome', 'razaosocial']), C('setor', 'Setor', 'txt', 18), C('pdv', 'PDV', 'txt@', 14),
      C('doc', 'CNPJ/CPF', 'txt@', 20, ['cpfcnpj', 'cnpj', 'cpf', 'documento']), C('telefone', 'Telefone', 'txt@', 16, ['fone', 'tel']),
      C('whatsapp', 'WhatsApp', 'txt@', 16, ['whats', 'celular', 'zap']), C('email', 'E-mail', 'txt', 26, ['email', 'emails']),
      C('contato', 'Pessoa de contato', 'txt', 18, ['contato', 'falarcom']), C('limite', 'Limite de crédito', 'moeda', 15, ['limite']),
      C('responsavel', 'Responsável', 'txt', 16), C('obs', 'Observações', 'txt', 32, ['obs', 'observacao']),
      C('id', 'ID', 'int', 7), C('criadoEm', 'Cadastrado em', 'datahora', 16), C('criadoPor', 'Cadastrado por', 'txt', 14),
      C('alteradoEm', 'Alterado em', 'datahora', 16), C('alteradoPor', 'Alterado por', 'txt', 14),
      C('excluidoEm', 'Na lixeira desde', 'datahora', 16, ['excluidoem']), C('excluidoPor', 'Posto na lixeira por', 'txt', 14)
    ]
  },
  pagamentos: {
    aba: 'Pagamentos', ordem: 4, cor: '1D7544', apelidosAba: ['pagamentos', 'recebimentos', 'baixas'],
    cols: [
      C('data', 'Data do pagamento', 'data', 13, ['data', 'datapagamento']), C('boleto', 'ID do boleto', 'int', 10, ['boleto', 'idboleto']),
      C('cliente', 'Cliente', 'txt', 28), C('parcela', 'Parcela', 'txt@', 9),
      C('valor', 'Valor recebido', 'moeda', 14, ['valor', 'valorpago']), C('desconto', 'Desconto', 'moeda', 12),
      C('juros', 'Juros/multa cobrados', 'moeda', 14, ['juros', 'jurosmulta', 'multa']), C('abatido', 'Abatido do saldo', 'moeda', 14, [], { derivada: true }),
      C('forma', 'Forma de pagamento', 'txt', 16, ['forma', 'formadepagamento']), C('origem', 'Origem', 'txt', 16), C('obs', 'Observação', 'txt', 28, ['obs']),
      C('id', 'ID', 'int', 7), C('registradoEm', 'Registrado em', 'datahora', 16), C('registradoPor', 'Registrado por', 'txt', 14),
      C('estornadoEm', 'Estornado em', 'datahora', 16), C('estornadoPor', 'Estornado por', 'txt', 14)
    ]
  },
  contatos: {
    aba: 'Contatos', ordem: 5, cor: '5B3A99', apelidosAba: ['contatos', 'cobrancas', 'historicodecontatos'],
    cols: [
      C('dataHora', 'Data/hora', 'datahora', 16, ['data', 'datahora']), C('boleto', 'ID do boleto', 'int', 10, ['boleto', 'idboleto']),
      C('cliente', 'Cliente', 'txt', 28), C('doc', 'CNPJ/CPF', 'txt@', 20, ['cpfcnpj', 'cnpj', 'cpf']),
      C('canal', 'Canal', 'txt', 12), C('falouCom', 'Quem atendeu', 'txt', 18, ['faloucom', 'atendeu']),
      C('anotacao', 'Anotação', 'txt', 40, ['anotacao', 'nota', 'obs']), C('etapa', 'Etapa', 'txt', 20),
      C('promessaEm', 'Promessa para', 'data', 13), C('proxAcao', 'Próxima ação', 'txt', 24), C('proxAcaoEm', 'Próxima ação em', 'data', 13),
      C('id', 'ID', 'int', 7), C('registradoPor', 'Registrado por', 'txt', 14), C('excluidoEm', 'Excluído em', 'datahora', 16, ['excluidoem'])
    ]
  },
  historico: {
    aba: 'Histórico', ordem: 6, cor: '80868B', apelidosAba: ['historico', 'log'],
    cols: [
      C('dataHora', 'Data/hora', 'datahora', 17, ['data']), C('usuario', 'Usuário', 'txt', 16, ['quem']),
      C('acao', 'Ação', 'txt', 26), C('boleto', 'ID do boleto', 'int', 10, ['boleto', 'idboleto']),
      C('detalhe', 'Detalhe', 'txt', 60), C('id', 'Nº', 'int', 8, ['id'])
    ]
  }
};
const TABS = Object.keys(ESQUEMA);
for (const t of TABS) {
  const e = ESQUEMA[t];
  e.porK = Object.fromEntries(e.cols.map(c => [c.k, c]));
  e.alias = new Map();
  for (const c of e.cols) for (const a of c.alias) if (!e.alias.has(a)) e.alias.set(a, c.k);
  e.derivadas = new Set(e.cols.filter(c => c.derivada).map(c => c.k));
}
/* Configuração (aba "Config"): rótulo visível, chave interna, padrão, explicação */
const CONFIG_DEF = [
  ['setores', 'Setores', '', 'Lista dos setores de cliente, separados por ponto e vírgula. Aparecem como sugestão no lançamento.'],
  ['responsaveis', 'Responsáveis (usuários)', '', 'Nomes de quem cobra, separados por ponto e vírgula. Usados no campo Responsável e no filtro "meus boletos".'],
  ['etapas', 'Etapas de cobrança', 'A cobrar; Contatado; Promessa de pagamento; Negociado; Protestado/Jurídico', 'Na ordem do processo, separadas por ponto e vírgula. A primeira é a etapa inicial de todo boleto.'],
  ['formas', 'Formas de pagamento', 'Boleto; PIX; Transferência; Depósito; Dinheiro; Cheque; Cartão', 'Opções ao dar baixa, separadas por ponto e vírgula.'],
  ['canais', 'Canais de contato', 'Ligação; WhatsApp; E-mail; Visita', 'Opções ao registrar um contato.'],
  ['multa', 'Multa por atraso (%)', '2', 'Percentual cobrado uma vez quando o boleto vence (ex.: 2).'],
  ['juros', 'Juros ao mês (%)', '1', 'Juros simples ao mês, proporcionais aos dias de atraso (ex.: 1 = 1% ao mês).'],
  ['diasAlerta', 'Dias para alerta de vencimento', '7', 'Boletos que vencem dentro deste número de dias aparecem em destaque.'],
  ['intervalo', 'Atualizar a tela a cada (segundos)', '5', 'De quanto em quanto tempo o sistema confere se alguém mudou a planilha (mínimo 2).'],
  ['backups', 'Backups a manter', '30', 'Quantas cópias de segurança automáticas guardar na subpasta "backup".'],
  ['modeloWhats', 'Modelo de mensagem – WhatsApp', 'Olá, {cliente}! Consta em aberto a parcela {parcela} no valor de {valor}, vencida em {vencimento} ({dias_atraso} dias). Valor atualizado: {valor_atualizado}. Podemos combinar o pagamento?', 'Variáveis: {cliente} {pdv} {valor} {valor_atualizado} {vencimento} {parcela} {dias_atraso} {documento} {linha_digitavel} {multa} {juros}.'],
  ['modeloEmailAssunto', 'Modelo de e-mail – assunto', 'Boleto em aberto – {cliente} – vencimento {vencimento}', 'Assunto do e-mail de cobrança.'],
  ['modeloEmail', 'Modelo de mensagem – e-mail', 'Prezados,\n\nIdentificamos em aberto o boleto {documento} (parcela {parcela}), no valor de {valor}, com vencimento em {vencimento}.\nValor atualizado até hoje: {valor_atualizado} ({dias_atraso} dias de atraso).\n\nLinha digitável: {linha_digitavel}\n\nCaso já tenha pago, por favor desconsidere e nos envie o comprovante.\n\nAtenciosamente,', 'Corpo do e-mail. Pode ter várias linhas.'],
  ['modeloTexto', 'Modelo de mensagem – texto curto', '{cliente}: parcela {parcela} de {valor} venceu em {vencimento}. Atualizado: {valor_atualizado}.', 'Texto curto (SMS, recado).']
];
const CONFIG_PADRAO = Object.fromEntries(CONFIG_DEF.map(d => [d[0], d[2]]));
const CONFIG_ALIAS = new Map(CONFIG_DEF.flatMap(d => [[normCab(d[1]), d[0]], [normCab(d[0]), d[0]]]));
const listaCfg = s => String(s == null ? '' : s).split(/[;\n]/).map(x => x.trim()).filter(Boolean);
const numCfg = (s, pad) => { const n = lerValor(s); return isFinite(n) ? n : pad; };

function normStatus(v) {
  const s = semAcento(String(v == null ? '' : v)).trim();
  if (!s) return 'Em aberto';
  if (s.startsWith('pag') || s === 'quitado' || s === 'liquidado' || s === 'recebido') return 'Pago';
  if (s.startsWith('canc')) return 'Cancelado';
  if (s.startsWith('reneg')) return 'Renegociado';
  return 'Em aberto';
}
const txtCel = v => v == null ? '' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(+v.toPrecision(15))) : typeof v === 'boolean' ? (v ? 'VERDADEIRO' : 'FALSO') : String(v).trim();
function paraDataHora(v, off) {
  if (typeof v === 'number') return v > 0 ? v + off : '';
  const s = txtCel(v); if (!s) return '';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) { const iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`; if (isoValida(iso)) return isoParaSerial(iso) + ((+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) / 86400; }
  const m2 = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m2 && isoValida(m2[1])) return isoParaSerial(m2[1]) + ((+m2[2] || 0) * 3600 + (+m2[3] || 0) * 60 + (+m2[4] || 0)) / 86400;
  return '';
}
function converterLeitura(col, v, off) {
  switch (col.tipo) {
    case 'data': { if (vazio(v)) return ''; const iso = paraIso(v, off); return iso || txtCel(v); }
    case 'datahora': { if (vazio(v)) return ''; const n = paraDataHora(v, off); return n === '' ? txtCel(v) : n; }
    case 'moeda': { if (vazio(v)) return ''; const n = typeof v === 'number' ? arred2(v) : lerValor(v); return isFinite(n) ? n : txtCel(v); }
    case 'int': { const n = typeof v === 'number' ? v : Number(txtCel(v).replace(/\D/g, '') || NaN); return isFinite(n) && n > 0 ? Math.round(n) : ''; }
    case 'status': return normStatus(v);
    default:
      if (col.k === 'parcela' && typeof v === 'number' && Number.isInteger(v) && v > 1000) { const { m, d } = partes(serialParaIso(v + off)); return `${d}/${m}`; }
      return txtCel(v);
  }
}

/* ---------------- Leitura: planilha -> modelo ---------------- */
function tabVazia(t) { return { linhas: [], ordem: ESQUEMA[t].cols.map(c => ({ k: c.k })), soltas: [], cols: [], presente: false, linhaCab: 1 }; }
function docVazio() {
  const tabs = {}; for (const t of TABS) tabs[t] = tabVazia(t);
  return { esquema: ESQUEMA_VERSAO, tabs, config: { ...CONFIG_PADRAO }, configExtra: [], sistema: {}, pacote: null, avisos: [], abaConfigPresente: false };
}
function lerTabela(t, grade, off) {
  const def = ESQUEMA[t];
  let linhaCab = -1, mapa = null, melhor = 0;
  for (let r = 1; r <= Math.min(grade.maxR, 12); r++) {
    const cels = grade.linhas.get(r); if (!cels) continue;
    let n = 0; for (const [, cel] of cels) if (typeof cel.v === 'string' && def.alias.has(normCab(cel.v))) n++;
    if (n > melhor && n >= (t === 'boletos' ? 2 : 2)) { melhor = n; linhaCab = r; }
  }
  if (linhaCab < 0) return null;
  const cab = grade.linhas.get(linhaCab);
  mapa = new Map(); const ordem = []; const usadosK = new Set(), usadosX = new Set();
  for (let c = 1; c <= grade.maxC; c++) {
    const cel = cab.get(c);
    const txt = cel ? txtCel(cel.v) : '';
    const k = txt ? def.alias.get(normCab(txt)) : null;
    if (k && !usadosK.has(k)) { usadosK.add(k); mapa.set(c, { k }); ordem.push({ k }); }
    else {
      let temDado = !!txt;
      if (!temDado) for (const [r, cels] of grade.linhas) if (r > linhaCab && cels.has(c)) { temDado = true; break; }
      if (!temDado) { mapa.set(c, null); ordem.push({ vazia: true }); continue; }
      let nome = txt || `Coluna ${letraCol(c)}`; let n = 2;
      while (usadosX.has(nome) || def.alias.has(normCab(nome)) && usadosK.has(def.alias.get(normCab(nome)))) nome = `${txt || 'Coluna ' + letraCol(c)} (${n++})`;
      usadosX.add(nome); mapa.set(c, { x: nome, sCab: cel && cel.s }); ordem.push({ x: nome });
    }
  }
  while (ordem.length && ordem[ordem.length - 1].vazia) ordem.pop();
  const linhas = [], soltas = [];
  const rs = [...grade.linhas.keys()].filter(r => r > linhaCab).sort((a, b) => a - b);
  for (const r of rs) {
    const cels = grade.linhas.get(r);
    const lin = {}; let temK = false, temX = false;
    for (const [c, cel] of cels) {
      const m = mapa.get(c);
      if (m === undefined || m === null) { if (cel.v !== '' || cel.fx) { (lin._fora || (lin._fora = [])).push([c, cel]); temX = true; } continue; }
      if (m.k) {
        const col = def.porK[m.k];
        if (cel.fx !== undefined && col.derivada) continue;
        const v = converterLeitura(col, cel.v, off);
        if (!vazio(v) && !(col.tipo === 'status' && vazio(cel.v))) { lin[m.k] = v; temK = true; }
      } else if (cel.v !== '' || cel.fx !== undefined) { (lin._x || (lin._x = {}))[m.x] = cel; temX = true; }
    }
    lin._r0 = r;
    let formulaConhecida = false;
    for (const [c, cel] of cels) { const m = mapa.get(c); if (m && m.k && cel.fx !== undefined && !def.porK[m.k].derivada) formulaConhecida = true; }
    const ehLinha = formulaConhecida ? false : t === 'boletos'
      ? ['vencimento', 'valor', 'cliente', 'doc', 'pdv', 'id', 'numDoc'].some(k => !vazio(lin[k]))
      : TABS.includes(t) && def.cols.some(c => !c.derivada && c.k !== 'status' && !vazio(lin[c.k]));
    if (ehLinha) {
      if (t === 'boletos' && vazio(lin.status)) lin.status = 'Em aberto';
      linhas.push(lin);
    } else if (temK || temX) soltas.push({ r0: r, cels });
  }
  return { linhas, ordem, soltas, linhaCab, presente: true, mapaCol: mapa };
}
/* IDs ausentes, inválidos ou repetidos (linha copiada no Excel) ganham um novo número.
   Regra determinística (ordem das linhas no arquivo): todos os computadores chegam ao mesmo resultado. */
function atribuirIds(linhas) {
  const vistos = new Set();
  let max = linhas.reduce((m, b) => Math.max(m, typeof b.id === 'number' ? b.id : 0), 0);
  let n = 0;
  for (const b of linhas) {
    if (typeof b.id !== 'number' || vistos.has(b.id)) { b._idOriginal = b.id; b.id = ++max; b._idNovo = true; n++; }
    vistos.add(b.id);
  }
  return n;
}
async function lerPlanilha(buf) {
  const pacote = await lerPacote(buf);
  const doc = docVazio();
  doc.pacote = pacote; doc.esquema = 1;
  const off = pacote.date1904 ? 1462 : 0;
  const achadas = {};
  const grades = new Map();
  const grade = async a => { if (!grades.has(a)) { const xml = a.caminho ? pacote.txt(a.caminho) : null; grades.set(a, xml ? { g: await gradeDaAba(xml, pacote.sst), cols: colsDaAba(xml) } : null); } return grades.get(a); };
  for (const a of pacote.abas) {
    if (!/\/worksheet$/.test(a.tipoRel)) continue;
    const n = normCab(a.nome);
    for (const t of TABS) if (!achadas[t] && ESQUEMA[t].apelidosAba.includes(n)) achadas[t] = a;
    if (n === 'config' || n === 'configuracoes' || n === 'configuracao') achadas.config = achadas.config || a;
    if (n === 'sistema') achadas.sistema = achadas.sistema || a;
  }
  if (!achadas.boletos) {     // V1: procura a aba que tenha Vencimento e Valor no cabeçalho
    for (const a of pacote.abas) {
      if (!/\/worksheet$/.test(a.tipoRel) || Object.values(achadas).includes(a)) continue;
      const g = await grade(a); if (!g) continue;
      const tb = lerTabela('boletos', g.g, off);
      if (tb && tb.ordem.some(o => o.k === 'vencimento') && tb.ordem.some(o => o.k === 'valor')) { achadas.boletos = a; break; }
    }
  }
  if (!achadas.boletos) throw new ErroPlanilha('semBoletos', 'Não encontrei a aba "Boletos" nesta planilha (ela precisa ter as colunas Vencimento e Valor). Confira se escolheu a planilha certa.');
  for (const t of TABS) {
    const a = achadas[t]; if (!a) continue;
    const g = await grade(a); if (!g) continue;
    const tb = lerTabela(t, g.g, off);
    if (!tb) { if (t === 'boletos') throw new ErroPlanilha('semBoletos', 'A aba "Boletos" não tem o cabeçalho esperado (Vencimento, Valor…). Não mexa na primeira linha da aba.'); continue; }
    tb.cols = g.cols; tb.nomeAba = a.nome;
    atribuirIds(tb.linhas);
    doc.tabs[t] = tb;
  }
  doc.nomesAbas = Object.fromEntries(Object.entries(achadas).map(([k, a]) => [k, a.nome]));
  if (achadas.config) {
    const g = await grade(achadas.config);
    doc.abaConfigPresente = true;
    if (g) for (const [r, cels] of [...g.g.linhas].sort((a, b) => a[0] - b[0])) {
      if (r === 1) continue;
      const rot = cels.get(1) ? txtCel(cels.get(1).v) : ''; if (!rot) continue;
      const val = cels.get(2) ? txtCel(cels.get(2).v) : '';
      const k = CONFIG_ALIAS.get(normCab(rot));
      if (k) doc.config[k] = val; else doc.configExtra.push([rot, val, cels.get(3) ? txtCel(cels.get(3).v) : '']);
    }
  }
  if (achadas.sistema) {
    const g = await grade(achadas.sistema);
    if (g) for (const [r, cels] of g.g.linhas) { if (r === 1) continue; const k = cels.get(1) ? txtCel(cels.get(1).v) : ''; if (k) doc.sistema[k] = cels.get(2) ? cels.get(2).v : ''; }
    doc.esquema = +doc.sistema.versao_esquema || 1;
  }
  doc.abasSistemaNomes = new Set(Object.values(achadas).map(a => a.nome));
  derivar(doc);
  return doc;
}

/* ---------------- Campos derivados (saldo, valor recebido) ---------------- */
function abatidoPag(p) { return arred2((Number(p.valor) || 0) - (Number(p.juros) || 0) + (Number(p.desconto) || 0)); }
function derivar(doc) {
  const porBoleto = new Map();
  for (const p of doc.tabs.pagamentos.linhas) {
    p.abatido = abatidoPag(p);
    if (p.estornadoEm || !p.boleto) continue;
    const a = porBoleto.get(p.boleto) || { rec: 0, ab: 0, ult: '' };
    a.rec += cent(p.valor); a.ab += cent(p.abatido); if ((p.data || '') > a.ult) a.ult = p.data || '';
    porBoleto.set(p.boleto, a);
  }
  for (let i = 0; i < doc.tabs.boletos.linhas.length; i++) {
    let b = doc.tabs.boletos.linhas[i];
    const a = porBoleto.get(b.id);
    const valor = typeof b.valor === 'number' ? b.valor : 0;
    let saldo = b.status === 'Em aberto' ? Math.max(0, cent(valor) - (a ? a.ab : 0)) / 100 : 0;
    const valorPago = a ? a.rec / 100 : (b.status === 'Pago' ? '' : '');
    if (b.status === 'Em aberto' && a && saldo <= 0 && valor > 0) {         // pagamentos já cobrem o valor: quita
      b = doc.tabs.boletos.linhas[i] = { ...b, status: 'Pago', pagoEm: b.pagoEm || a.ult }; saldo = 0;
    }
    if (b.saldo !== saldo || b.valorPago !== valorPago) doc.tabs.boletos.linhas[i] = { ...b, saldo, valorPago };
  }
}

/* ---------------- Escrita: modelo -> abas ---------------- */
/* Célula compacta: sem "r" quando é a coluna seguinte (o Excel aceita), xml:space só se precisar */
const precisaPreserve = v => /^\s|\s$|[\n\r\t]/.test(v);
function celXml(ref, s, v, comoTexto) {
  const r = ref ? ` r="${ref}"` : '', st = s ? ` s="${s}"` : '';
  if (vazio(v)) return '';
  if (typeof v === 'number' && !comoTexto) return `<c${r}${st}><v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c${r}${st} t="b"><v>${v ? 1 : 0}</v></c>`;
  const txt = String(v);
  return `<c${r}${st} t="inlineStr"><is><t${precisaPreserve(txt) ? ' xml:space="preserve"' : ''}>${xEsc(txt)}</t></is></c>`;
}
function celExtraXml(ref, cel, dr) {
  const a = (ref ? ` r="${ref}"` : '') + (cel.s !== undefined ? ` s="${cel.s}"` : '');
  if (cel.fx !== undefined) {
    const f = `<f>${xEsc(deslocarFormula(cel.fx, dr))}</f>`;
    if (typeof cel.v === 'number') return `<c${a}>${f}<v>${cel.v}</v></c>`;
    if (typeof cel.v === 'boolean') return `<c${a} t="b">${f}<v>${cel.v ? 1 : 0}</v></c>`;
    if (cel.t === 'e') return `<c${a} t="e">${f}<v>${xEsc(cel.v)}</v></c>`;
    if (cel.v === '' || cel.v == null) return `<c${a}>${f}</c>`;
    return `<c${a} t="str">${f}<v>${xEsc(cel.v)}</v></c>`;
  }
  if (cel.t === 'e') return `<c${a} t="e"><v>${xEsc(cel.v)}</v></c>`;
  if (typeof cel.v === 'number') return `<c${a}><v>${cel.v}</v></c>`;
  if (typeof cel.v === 'boolean') return `<c${a} t="b"><v>${cel.v ? 1 : 0}</v></c>`;
  if (cel.v === '' || cel.v == null) return cel.s !== undefined ? `<c${a}/>` : '';
  const txt = String(cel.v);
  return `<c${a} t="inlineStr"><is><t${precisaPreserve(txt) ? ' xml:space="preserve"' : ''}>${xEsc(txt)}</t></is></c>`;
}
function estiloCol(col, est) {
  switch (col.tipo) {
    case 'data': return est.data; case 'datahora': return ['criadoEm', 'alteradoEm', 'excluidoEm', 'registradoEm', 'estornadoEm'].includes(col.k) ? est.cinzaDataHora : est.dataHora;
    case 'moeda': return est.moeda; case 'int': return col.k === 'id' || col.k === 'lancamento' ? est.cinza : est.int;
    case 'status': return est.centro; case 'txt@': return est.texto;
    default: return ['criadoPor', 'alteradoPor', 'excluidoPor', 'registradoPor', 'estornadoPor'].includes(col.k) ? est.cinza : est.padrao;
  }
}
function valorEscrita(col, v) {
  if (vazio(v)) return '';
  if (col.tipo === 'data') { const s = isoParaSerial(v); return s === null ? String(v) : s; }
  if (col.tipo === 'moeda' && typeof v === 'number') return arred2(v);
  return v;
}
function colunasFinais(t, tab) {
  const def = ESQUEMA[t];
  const ordem = (tab.ordem || []).filter(o => o.k ? def.porK[o.k] : true).map(o => ({ ...o }));
  const tem = new Set(ordem.filter(o => o.k).map(o => o.k));
  for (const c of def.cols) if (!tem.has(c.k)) ordem.push({ k: c.k });
  return ordem;
}
function cmpBoleto(a, b) {
  const la = a.excluidoEm ? 1 : 0, lb = b.excluidoEm ? 1 : 0;
  if (la !== lb) return la - lb;
  return (a.vencimento || '9999').localeCompare(b.vencimento || '9999') ||
    COLL.compare(a.setor || '', b.setor || '') || COLL.compare(a.pdv || '', b.pdv || '') ||
    ((lerParcela(a.parcela) || { n: 0 }).n - (lerParcela(b.parcela) || { n: 0 }).n) || (a.id - b.id);
}
function ordenarTab(t, linhas) {
  const l = linhas.slice();
  if (t === 'boletos') l.sort(cmpBoleto);
  else if (t === 'clientes') l.sort((a, b) => ((a.excluidoEm ? 1 : 0) - (b.excluidoEm ? 1 : 0)) || COLL.compare(a.nome || '', b.nome || '') || a.id - b.id);
  else l.sort((a, b) => a.id - b.id);
  return l;
}
async function xmlTabela(t, tab, est, opc = {}) {
  const def = ESQUEMA[t];
  const ordem = colunasFinais(t, tab);
  const nCols = Math.max(ordem.length, 1);
  const UC = letraCol(nCols);
  const linhas = ordenarTab(t, tab.linhas);
  const letra = {}; ordem.forEach((o, i) => { if (o.k) letra[o.k] = letraCol(i + 1); });
  const larg = i => {
    const c = (tab.cols || []).find(x => i >= x.min && i <= x.max);
    const o = ordem[i - 1];
    const w = c && c.width ? c.width : (o.k ? def.porK[o.k].w : 14);
    return `<col min="${i}" max="${i}" width="${+w.toFixed ? +(+w).toFixed(2) : w}" customWidth="1"${c && c.hidden ? ' hidden="1"' : ''}/>`;
  };
  const out = [];
  out.push(`<row r="1" ht="30" customHeight="1">${ordem.map((o, i) => {
    const ref = letraCol(i + 1) + '1';
    if (o.k) return celXml(ref, est.cab, def.porK[o.k].h);
    if (o.x) return celXml(ref, est.cabExtra, o.x);
    return '';
  }).join('')}</row>`);
  let r = 1;
  const estCols = ordem.map(o => o.k ? estiloCol(def.porK[o.k], est) : 0);
  const letras = ordem.map((o, i) => letraCol(i + 1));
  const cols = ordem.map(o => o.k ? def.porK[o.k] : null);
  let n = 0;
  for (const lin of linhas) {
    if (++n % 1500 === 0) await ceder();
    r++;
    const dr = lin._r0 ? r - lin._r0 : 0;
    let cels = '', ult = 0;
    for (let i = 0; i < ordem.length; i++) {
      const o = ordem[i], col = cols[i];
      let x = '';
      const ref = i === ult ? '' : letras[i] + r;       // sem "r" quando é a coluna logo depois da anterior
      if (col) x = celXml(ref, estCols[i], valorEscrita(col, lin[o.k]), col.tipo === 'txt@' || col.tipo === 'txt');
      else if (o.x && lin._x && lin._x[o.x]) x = celExtraXml(ref, lin._x[o.x], dr);
      if (x) { cels += x; ult = i + 1; }
    }
    if (lin._fora) for (const [c, cel] of lin._fora) if (c > ordem.length) cels += celExtraXml(letraCol(c) + r, cel, dr);
    out.push(`<row r="${r}">${cels}</row>`);
  }
  const ultDado = r;
  for (const s of tab.soltas || []) {        // linhas que não são registros (totais, notas do time): vão para o fim,
    r++;                                     // com as fórmulas como estão (ex.: =SOMA(C2:C40) não deve "andar")
    let cels = '';
    for (const [c, cel] of [...s.cels].sort((a, b) => a[0] - b[0])) cels += celExtraXml(letraCol(c) + r, cel, 0);
    out.push(`<row r="${r}">${cels}</row>`);
  }
  const faixa = Math.max(2000, ultDado + 2000);
  const cf = opc.cf ? opc.cf(letra, UC, faixa) : '';
  const dv = opc.dv ? opc.dv(letra, faixa) : '';
  const xml = XML_TOPO + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheetPr>${def.cor ? `<tabColor rgb="FF${def.cor}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<dimension ref="A1:${letraCol(Math.max(nCols, 1))}${Math.max(r, 1)}"/>` +
    `<sheetViews><sheetView${opc.ativa ? ' tabSelected="1"' : ''} workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${Array.from({ length: nCols }, (_, i) => larg(i + 1)).join('')}</cols>` +
    `<sheetData>${out.join('')}</sheetData>` +
    `<autoFilter ref="A1:${UC}${Math.max(ultDado, 2)}"/>` + cf + dv +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>';
  const q = `'${def.aba.replace(/'/g, "''")}'`;
  const chaveImp = opc.colunasImpressao ? Math.max(...opc.colunasImpressao.map(k => ordem.findIndex(o => o.k === k) + 1)) : 0;
  return { xml, filtro: `${q}!$A$1:$${UC}$${Math.max(ultDado, 2)}`, impressao: chaveImp ? `${q}!$A$1:$${letraCol(chaveImp)}$${Math.max(ultDado, 2)}` : '', titulos: `${q}!$1:$1`, letra, ordem, linhas, ultDado };
}
const regra = (dxf, pri, f, parar) => `<cfRule type="expression" dxfId="${dxf}" priority="${pri}"${parar ? ' stopIfTrue="1"' : ''}><formula>${xEsc(f)}</formula></cfRule>`;
function listaValidacao(sqref, itens, titulo) {
  const txt = itens.map(s => s.replace(/"/g, '')).join(',');
  if (!itens.length || txt.length > 250) return '';
  return `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${sqref}"><formula1>"${xEsc(txt)}"</formula1></dataValidation>`;
}
function cfBoletos(dxf, diasAlerta) {
  return (L, UC, faixa) => {
    const st = `$${L.status}2`, v = `$${L.vencimento}2`, lx = `$${L.excluidoEm}2`;
    return `<conditionalFormatting sqref="A2:${UC}${faixa}">` +
      regra(dxf.lixeira, 1, `${lx}<>""`, true) + regra(dxf.pago, 2, `${st}="Pago"`, true) +
      regra(dxf.cancelado, 3, `OR(${st}="Cancelado",${st}="Renegociado")`, true) +
      regra(dxf.vencido, 4, `AND(${st}="Em aberto",${v}<>"",${v}<TODAY())`, true) +
      regra(dxf.breve, 5, `AND(${st}="Em aberto",${v}<>"",${v}-TODAY()<=${diasAlerta})`, true) +
      '</conditionalFormatting>';
  };
}
function dvBoletos(cfg) {
  return (L, faixa) => {
    const v = [listaValidacao(`${L.status}2:${L.status}${faixa}`, STATUS), listaValidacao(`${L.etapa}2:${L.etapa}${faixa}`, listaCfg(cfg.etapas)),
      listaValidacao(`${L.responsavel}2:${L.responsavel}${faixa}`, listaCfg(cfg.responsaveis)), listaValidacao(`${L.formaPagamento}2:${L.formaPagamento}${faixa}`, listaCfg(cfg.formas))].filter(Boolean);
    return v.length ? `<dataValidations count="${v.length}">${v.join('')}</dataValidations>` : '';
  };
}

/* Aba Resumo: fórmulas vivas + valores já calculados (para quem abre sem recalcular) */
function xmlResumo(doc, L, est, hoje) {
  const B = c => `Boletos!$${L[c]}:$${L[c]}`;
  const SAL = B('saldo'), ST = B('status'), VE = B('vencimento'), LX = B('excluidoEm'), PG = B('pagoEm'), VP = B('valorPago'), SE = B('setor');
  const AB = `${ST},"Em aberto",${LX},""`;
  const bol = doc.tabs.boletos.linhas.filter(b => !b.excluidoEm);
  const abertos = bol.filter(b => b.status === 'Em aberto');
  const somaS = arr => somaCent(arr, b => b.saldo || 0);
  const d = b => b.vencimento || '';
  const L2 = []; let r = 0;
  const row = cels => { r++; L2.push(`<row r="${r}">${cels}</row>`); };
  const t = (ref, s, v) => celXml(ref, s, v, true);
  const f = (ref, s, form, cache) => `<c r="${ref}" s="${s}"><f>${xEsc(form)}</f><v>${cache}</v></c>`;
  row(t('A1', est.titulo, 'Resumo dos boletos a cobrar'));
  row(t('A2', est.nota, `Atualiza sozinho com os dados da aba "Boletos" (valores em aberto consideram pagamentos parciais). Gerado pelo sistema em ${fmtData(hoje)}; não edite esta aba, ela é refeita a cada gravação.`));
  r++;
  row(t('A4', est.cab, 'Situação') + t('B4', est.cab, 'Valor em aberto') + t('C4', est.cab, 'Boletos'));
  const sit = [
    ['Total em aberto', 'padrao', 'moeda', 'int', '', abertos],
    ['Vencidos (não pagos)', 'verm', 'moedaVerm', 'intVerm', `,${VE},"<"&TODAY()`, abertos.filter(b => d(b) && d(b) < hoje)],
    ['Vencem hoje', 'ambar', 'moedaAmbar', 'intAmbar', `,${VE},TODAY()`, abertos.filter(b => d(b) === hoje)],
    [`Vencem nos próximos ${doc.config.diasAlerta || 7} dias`, 'ambar', 'moedaAmbar', 'intAmbar', `,${VE},">"&TODAY(),${VE},"<="&TODAY()+${+doc.config.diasAlerta || 7}`, abertos.filter(b => d(b) > hoje && difDias(d(b), hoje) <= (+doc.config.diasAlerta || 7))]
  ];
  for (const [rot, e1, e2, e3, crit, arr] of sit) { const rr = r + 1; row(t('A' + rr, est[e1], rot) + f('B' + rr, est[e2], `SUMIFS(${SAL},${AB}${crit})`, somaS(arr)) + f('C' + rr, est[e3], `COUNTIFS(${AB}${crit})`, arr.length)); }
  const iniMes = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)', fimMes = 'DATE(YEAR(TODAY()),MONTH(TODAY())+1,1)';
  const pagosMes = doc.tabs.pagamentos.linhas.filter(p => !p.estornadoEm && p.data && p.data.slice(0, 7) === hoje.slice(0, 7));
  {
    const pc = colunasFinais('pagamentos', doc.tabs.pagamentos);
    const P = k => { const l = letraCol(pc.findIndex(o => o.k === k) + 1); return `Pagamentos!$${l}:$${l}`; };
    const rr = r + 1, crit = `${P('data')},">="&${iniMes},${P('data')},"<"&${fimMes},${P('estornadoEm')},""`;
    row(t('A' + rr, est.padrao, 'Recebido neste mês (aba Pagamentos)') + f('B' + rr, est.moeda, `SUMIFS(${P('valor')},${crit})`, somaCent(pagosMes, p => p.valor)) + f('C' + rr, est.int, `COUNTIFS(${crit})`, pagosMes.length));
  }
  r++;
  row(t('A' + (r + 1), est.cab, 'Faixa de atraso') + t('B' + (r + 1), est.cab, 'Valor em aberto') + t('C' + (r + 1), est.cab, 'Boletos'));
  for (const fx of FAIXAS) {
    const arr = abertos.filter(b => faixaAtraso(d(b), hoje) === fx.k);
    let crit;
    if (fx.k === 'avencer') crit = `,${VE},">="&TODAY()`;
    else crit = `,${VE},"<="&(TODAY()-${fx.min})` + (isFinite(fx.max) ? `,${VE},">="&(TODAY()-${fx.max})` : '');
    const rr = r + 1;
    if (fx.k === 'avencer') {
      row(t('A' + rr, est.padrao, 'A vencer (inclui sem data)') + f('B' + rr, est.moeda, `SUMIFS(${SAL},${AB}${crit})+SUMIFS(${SAL},${AB},${VE},"")`, somaS(arr)) + f('C' + rr, est.int, `COUNTIFS(${AB}${crit})+COUNTIFS(${AB},${VE},"")`, arr.length));
    } else row(t('A' + rr, est[fx.min > 30 ? 'verm' : 'padrao'], fx.rot + ' de atraso') + f('B' + rr, est[fx.min > 30 ? 'moedaVerm' : 'moeda'], `SUMIFS(${SAL},${AB}${crit})`, somaS(arr)) + f('C' + rr, est[fx.min > 30 ? 'intVerm' : 'int'], `COUNTIFS(${AB}${crit})`, arr.length));
  }
  r++;
  const rMes = r + 1;
  row(t('A' + rMes, est.cab, 'Mês de vencimento') + t('B' + rMes, est.cab, 'A receber (em aberto)') + t('C' + rMes, est.cab, 'Boletos em aberto') + t('D' + rMes, est.cab, 'Já pago (valor recebido)'));
  const mes0 = primeiroDoMes(hoje);
  const antes = abertos.filter(b => d(b) && d(b) < mes0);
  { const rr = r + 1; row(t('A' + rr, est.verm, 'Meses anteriores (atrasados)') + f('B' + rr, est.moedaVerm, `SUMIFS(${SAL},${AB},${VE},"<"&$A$${rr + 1})`, somaS(antes)) + f('C' + rr, est.intVerm, `COUNTIFS(${AB},${VE},"<"&$A$${rr + 1})`, antes.length)); }
  for (let i = 0; i < 12; i++) {
    const rr = r + 1, a = primeiroDoMes(hoje, i), z = primeiroDoMes(hoje, i + 1);
    const fA = i === 0 ? 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)' : `DATE(YEAR(A${rr - 1}),MONTH(A${rr - 1})+1,1)`;
    const noMes = `${VE},">="&A${rr},${VE},"<"&DATE(YEAR(A${rr}),MONTH(A${rr})+1,1)`;
    const ab = abertos.filter(b => d(b) >= a && d(b) < z);
    const pg = bol.filter(b => b.status === 'Pago' && d(b) >= a && d(b) < z);
    const at = i === 0;
    row(f('A' + rr, est[at ? 'mesAt' : 'mes'], fA, isoParaSerial(a)) + f('B' + rr, est[at ? 'moedaAt' : 'moeda'], `SUMIFS(${SAL},${AB},${noMes})`, somaS(ab)) +
      f('C' + rr, est[at ? 'intAt' : 'int'], `COUNTIFS(${AB},${noMes})`, ab.length) + f('D' + rr, est[at ? 'moedaAt' : 'moeda'], `SUMIFS(${VP},${ST},"Pago",${LX},"",${noMes})`, somaCent(pg, b => b.valorPago || b.valor || 0)));
  }
  { const rr = r + 1; const depois = abertos.filter(b => d(b) >= primeiroDoMes(hoje, 12)); row(t('A' + rr, est.padrao, 'Depois disso') + f('B' + rr, est.moeda, `SUMIFS(${SAL},${AB},${VE},">="&DATE(YEAR(A${rr - 1}),MONTH(A${rr - 1})+1,1))`, somaS(depois)) + f('C' + rr, est.int, `COUNTIFS(${AB},${VE},">="&DATE(YEAR(A${rr - 1}),MONTH(A${rr - 1})+1,1))`, depois.length)); }
  r++;
  const rSet = r + 1;
  row(t('A' + rSet, est.cab, 'Setor') + t('B' + rSet, est.cab, 'Em aberto') + t('C' + rSet, est.cab, 'Vencido') + t('D' + rSet, est.cab, '% vencido'));
  const setores = [...new Set(abertos.map(b => b.setor || ''))].sort((a, b) => COLL.compare(a, b));
  for (const s of setores) {
    const rr = r + 1; const arr = abertos.filter(b => (b.setor || '') === s); const venc = arr.filter(b => d(b) && d(b) < hoje);
    const ab = somaS(arr), vc = somaS(venc);
    row(t('A' + rr, est.padrao, s || '(sem setor)') + f('B' + rr, est.moeda, `SUMIFS(${SAL},${AB},${SE},${s ? 'A' + rr : '""'})`, ab) +
      f('C' + rr, est.moeda, `SUMIFS(${SAL},${AB},${SE},${s ? 'A' + rr : '""'},${VE},"<"&TODAY())`, vc) + f('D' + rr, est.pct, `IF(B${rr}=0,0,C${rr}/B${rr})`, ab ? Math.round(vc / ab * 10000) / 10000 : 0));
  }
  return XML_TOPO + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheetPr><tabColor rgb="FF8F5600"/><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<dimension ref="A1:D${r}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
    '<cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="4" width="20" customWidth="1"/></cols>' +
    `<sheetData>${L2.join('')}</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>';
}
function xmlConfig(doc, est) {
  const L = [`<row r="1" ht="22" customHeight="1">${celXml('A1', est.cab, 'Configuração', true)}${celXml('B1', est.cab, 'Valor', true)}${celXml('C1', est.cab, 'Para que serve', true)}</row>`];
  let r = 1;
  for (const [k, rot, , expl] of CONFIG_DEF) { r++; L.push(`<row r="${r}">${celXml('A' + r, est.cfgChave, rot, true)}${celXml('B' + r, est.cfgValor, doc.config[k] ?? '', true)}${celXml('C' + r, est.nota, expl, true)}</row>`); }
  for (const [rot, val, expl] of doc.configExtra) { r++; L.push(`<row r="${r}">${celXml('A' + r, est.cfgChave, rot, true)}${celXml('B' + r, est.cfgValor, val, true)}${celXml('C' + r, est.nota, expl, true)}</row>`); }
  r += 2;
  L.push(`<row r="${r}">${celXml('A' + r, est.nota, 'Edite só a coluna "Valor". Listas: itens separados por ponto e vírgula (;). Percentuais: só o número (ex.: 2 ou 1,5). Esta aba é lida pelo sistema a cada atualização.', true)}</row>`);
  return XML_TOPO + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheetPr><tabColor rgb="FF66706B"/></sheetPr><dimension ref="A1:C${r}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
    '<cols><col min="1" max="1" width="36" customWidth="1"/><col min="2" max="2" width="70" customWidth="1"/><col min="3" max="3" width="70" customWidth="1"/></cols>' +
    `<sheetData>${L.join('')}</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>`;
}
function xmlSistema(doc, est) {
  const L = [`<row r="1">${celXml('A1', est.cab, 'Chave', true)}${celXml('B1', est.cab, 'Valor', true)}</row>`];
  let r = 1;
  const chaves = Object.keys(doc.sistema).sort();
  for (const k of chaves) { r++; const v = doc.sistema[k]; L.push(`<row r="${r}">${celXml('A' + r, est.padrao, k, true)}${celXml('B' + r, typeof v === 'number' ? est.dataHora : est.padrao, v, typeof v !== 'number')}</row>`); }
  return XML_TOPO + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><dimension ref="A1:B${r}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
    '<cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="2" width="40" customWidth="1"/></cols>' +
    `<sheetData>${L.join('')}</sheetData></worksheet>`;
}
const casa = nomes => nome => nomes.includes(normCab(nome));
/* Gera o .xlsx completo (Uint8Array) a partir do modelo */
async function gerarPlanilha(doc, opc = {}) {
  const hoje = opc.hoje || hojeLocal();
  const estilos = prepararEstilos(doc.pacote ? doc.pacote.stylesXml : null);
  const est = estilos.idx;
  doc.sistema.versao_esquema = ESQUEMA_VERSAO;
  for (const t of TABS) doc.tabs[t].presente = true;
  doc.abaConfigPresente = true;
  doc.sistema.aviso = 'Aba interna do sistema Boletos a cobrar. Não apague.';
  const tb = await xmlTabela('boletos', doc.tabs.boletos, est, { ativa: true, cf: cfBoletos(estilos.dxf, +doc.config.diasAlerta || 7), dv: dvBoletos(doc.config),
    colunasImpressao: ['vencimento', 'status', 'valor', 'saldo', 'parcela', 'setor', 'pdv', 'cliente', 'doc', 'numDoc', 'etapa', 'responsavel'] });
  const abas = [
    { chave: 'boletos', nome: (doc.nomesAbas && doc.nomesAbas.boletos) || 'Boletos', xml: tb.xml, filtro: tb.filtro, impressao: tb.impressao, titulos: tb.titulos, ativa: true, ordem: 1 },
    { chave: 'resumo', nome: 'Resumo', xml: xmlResumo(doc, tb.letra, est, hoje), ordem: 2 }
  ];
  for (const t of ['clientes', 'pagamentos', 'contatos', 'historico']) {
    const x = await xmlTabela(t, doc.tabs[t], est, {});
    abas.push({ chave: t, nome: (doc.nomesAbas && doc.nomesAbas[t]) || ESQUEMA[t].aba, xml: x.xml, filtro: x.filtro, titulos: x.titulos, ordem: ESQUEMA[t].ordem });
  }
  abas.push({ chave: 'config', nome: (doc.nomesAbas && doc.nomesAbas.config) || 'Config', xml: xmlConfig(doc, est), ordem: 7 });
  abas.push({ chave: 'sistema', nome: '_Sistema', xml: xmlSistema(doc, est), oculta: true, ordem: 9 });
  const apel = { boletos: ESQUEMA.boletos.apelidosAba, resumo: ['resumo'], config: ['config', 'configuracoes', 'configuracao'], sistema: ['sistema'] };
  for (const a of abas) {
    const nomes = [normCab(a.nome), ...(apel[a.chave] || (ESQUEMA[a.chave] ? ESQUEMA[a.chave].apelidosAba : []))];
    a.casaCom = casa(nomes); a.inserirAntes = true;
  }
  return montarXlsx(doc.pacote, abas, estilos.xml, { titulo: 'Boletos a cobrar' });
}
