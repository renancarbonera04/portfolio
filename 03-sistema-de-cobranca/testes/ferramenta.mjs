// Ferramenta de linha de comando usada pelos testes em Python (round-trip com openpyxl/LibreOffice).
//   node testes/ferramenta.mjs exemplo <saida.xlsx> [n]       gera planilha com dados fictícios
//   node testes/ferramenta.mjs ler <arquivo.xlsx>            imprime o modelo lido em JSON
//   node testes/ferramenta.mjs gravar <entrada> <saida> [obs] lê, aplica uma edição (obs do boleto 1) e grava
//   node testes/ferramenta.mjs v1 <saida.xlsx>               gera uma planilha no formato da V1 (com o código da V1)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarNucleo } from './carregar-nucleo.mjs';
const N = carregarNucleo();
const aqui = path.dirname(fileURLToPath(import.meta.url));
const [, , cmd, a1, a2, a3] = process.argv;

function rnd(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }
export function docExemplo(n = 60, hoje = N.hojeLocal(), seed = 7) {
  const r = rnd(seed);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  let d = N.docVazio();
  d.config.setores = 'Varejo; Atacado; Farmácias; Bares e restaurantes; Conveniência';
  d.config.responsaveis = 'Ana Souza; João Lima; Maria Alves; Pedro Rocha';
  const setores = N.listaCfg(d.config.setores), resp = N.listaCfg(d.config.responsaveis);
  const nomes = ['Mercado Bom Preço (EXEMPLO)', 'Bar do Zé (EXEMPLO)', 'Farmácia Saúde Já (EXEMPLO)', 'Distribuidora Norte (EXEMPLO)', 'Conveniência 24h (EXEMPLO)', 'Restaurante Sabor Caseiro (EXEMPLO)', 'Padaria Pão Quente (EXEMPLO)', 'Empório Central (EXEMPLO)', 'Lanchonete Esquina (EXEMPLO)', 'Atacado Boa Vista (EXEMPLO)', 'Adega do Porto (EXEMPLO)', 'Supermercado Exemplo (EXEMPLO)'];
  // Documentos de teste: só os exemplos de manual (CNPJ/CPF de teste e o CNPJ alfanumérico da Receita).
  // Os demais clientes ficam sem documento, para nenhum CNPJ real aparecer ligado a dados inventados.
  const cnpjs = ['11.222.333/0001-81', '12.ABC.345/01DE-35', '529.982.247-25'];
  const usu = ['Ana Souza', 'João Lima', 'Maria Alves'];
  let t = N.isoParaSerial(N.somaDias(hoje, -120)) + 0.4;
  const ctx = u => { t += 0.013 + r() * 0.05; return { ts: t, u, g: 'ex' + t, hoje }; };
  let k = 0;
  while (d.tabs.boletos.linhas.length < n) {
    const i = Math.floor(r() * nomes.length);
    const qtd = pick([1, 1, 1, 2, 3, 4, 6]);
    const venc1 = N.somaDias(hoje, Math.floor(r() * 150) - 100);
    const ops = N.opsLancamento(d, { setor: setores[i % setores.length], pdv: String(10200 + i * 37), cliente: nomes[i], doc: cnpjs[i] || '', numDoc: 'NF ' + (4000 + (k++)), responsavel: pick(resp), parcelas: N.gerarParcelas({ qtd, valor: Math.round(r() * 500000) / 100 + 80, venc1, modo: pick(['total', 'parcela']), intervalo: pick(['mensal', 'mensal', 'dias']), dias: 28 }) }, ctx(pick(usu)));
    d = N.aplicarOps(d, ops).doc;
  }
  for (const b of d.tabs.boletos.linhas.slice()) {
    const x = r();
    const atual = d.tabs.boletos.linhas.find(y => y.id === b.id);
    if (b.vencimento < hoje && x < 0.45) d = N.aplicarOps(d, N.opsPagamento(d, b.id, { data: N.somaDias(b.vencimento, Math.floor(r() * 6)), valor: atual.saldo, forma: pick(['PIX', 'Boleto', 'Transferência']) }, ctx(pick(usu)))).doc;
    else if (b.vencimento < hoje && x < 0.55) d = N.aplicarOps(d, N.opsPagamento(d, b.id, { data: N.somaDias(b.vencimento, 2), valor: N.arred2(atual.saldo / 2), forma: 'PIX' }, ctx(pick(usu)))).doc;
    else if (b.vencimento < hoje && x < 0.75) d = N.aplicarOps(d, N.opsContato(d, [b.id], { canal: pick(['Ligação', 'WhatsApp', 'E-mail']), falouCom: pick(['gerente', 'dono', 'financeiro']), anotacao: pick(['vai pagar na sexta', 'pediu 2ª via', 'não atendeu', 'disse que pagou, pedir comprovante']), promessaEm: x < 0.65 ? N.somaDias(hoje, Math.floor(r() * 8) - 4) : '', proxAcaoEm: N.somaDias(hoje, Math.floor(r() * 4) - 1), proxAcao: 'ligar de novo' }, ctx(pick(usu)))).doc;
    else if (x > 0.97) d = N.aplicarOps(d, N.opsStatus(d, [b.id], 'Cancelado', ctx(pick(usu)))).doc;
  }
  const l = d.tabs.boletos.linhas.find(b => b.status === 'Em aberto');
  if (l) d = N.aplicarOps(d, N.opsLixeira(d, 'boletos', [l.id], ctx('Ana Souza'))).doc;
  return d;
}
async function main() {
  if (cmd === 'exemplo') {
    const d = docExemplo(+a2 || 60);
    fs.writeFileSync(a1, await N.gerarPlanilha(d));
    console.log(JSON.stringify({ boletos: d.tabs.boletos.linhas.length }));
  } else if (cmd === 'grande') {        // planilha grande para teste de desempenho (sem passar pelo merge)
    const n = +a2 || 10000, d = N.docVazio(), r = rnd(11), hoje = N.hojeLocal();
    const setores = ['Varejo', 'Atacado', 'Farmácias', 'Bares e restaurantes', 'Conveniência'];
    let t = N.isoParaSerial(hoje) - 400;
    for (let i = 1; i <= n; i++) {
      const venc = N.somaDias(hoje, Math.floor(r() * 500) - 300), pago = venc < hoje && r() < 0.6;
      t += 0.03;
      d.tabs.boletos.linhas.push({ id: i, lancamento: Math.ceil(i / 3), vencimento: venc, status: pago ? 'Pago' : (r() < 0.03 ? 'Cancelado' : 'Em aberto'), valor: Math.round(r() * 800000) / 100 + 50,
        parcela: `${((i - 1) % 3) + 1}/3`, setor: setores[i % 5], pdv: String(10000 + (i % 1700)), cliente: `Cliente fictício ${i % 1700} (EXEMPLO)`, doc: '11.222.333/0001-81', numDoc: 'NF ' + (100000 + i),
        obs: r() < 0.2 ? 'observação de teste ' + i : '', etapa: 'A cobrar', responsavel: ['Ana', 'Bruno', 'Carla', 'Davi'][i % 4], pagoEm: pago ? venc : '', criadoEm: t, criadoPor: 'Gerador', alteradoEm: t, alteradoPor: 'Gerador' });
    }
    for (let i = 1; i <= 1700; i++) d.tabs.clientes.linhas.push({ id: i, nome: `Cliente fictício ${i % 1700} (EXEMPLO)`, pdv: String(10000 + (i % 1700)), setor: setores[i % 5], doc: '11.222.333/0001-81', criadoEm: t + i * 1e-6, criadoPor: 'Gerador' });
    for (let i = 1; i <= 3000; i++) d.tabs.historico.linhas.push({ id: i, dataHora: t + i * 1e-6, usuario: 'Gerador', acao: 'Lançou boleto', boleto: i, detalhe: 'teste de desempenho' });
    N.derivar(d);
    const t0 = Date.now(); const bytes = await N.gerarPlanilha(d); const tg = Date.now() - t0;
    fs.writeFileSync(a1, bytes);
    const t1 = Date.now(); await N.lerPlanilha(bytes); const tl = Date.now() - t1;
    console.log(JSON.stringify({ boletos: n, kb: Math.round(bytes.length / 1024), gerarMs: tg, lerMs: tl }));
  } else if (cmd === 'ler') {
    const d = await N.lerPlanilha(fs.readFileSync(a1));
    const out = { esquema: d.esquema, config: d.config, configExtra: d.configExtra, abas: d.pacote.abas.map(a => a.nome), tabs: {} };
    for (const t of N.TABS) out.tabs[t] = { ordem: d.tabs[t].ordem, n: d.tabs[t].linhas.length, linhas: d.tabs[t].linhas.map(l => ({ ...l, _x: l._x ? Object.fromEntries(Object.entries(l._x).map(([k, c]) => [k, { v: c.v, fx: c.fx }])) : undefined })), soltas: (d.tabs[t].soltas || []).length };
    console.log(JSON.stringify(out));
  } else if (cmd === 'gravar') {
    const d = await N.lerPlanilha(fs.readFileSync(a1));
    let doc = N.migrarV1(d);
    if (a3) doc = N.aplicarOps(doc, N.opsEditar(doc, doc.tabs.boletos.linhas[0].id, { obs: a3 }, N.novoCtx('Teste'))).doc;
    fs.writeFileSync(a2, await N.gerarPlanilha(doc));
    console.log('ok');
  } else if (cmd === 'v1') {
    const v1 = fs.readFileSync(path.join(aqui, 'dados', 'Boletos-a-cobrar-v1.html'), 'utf8');
    const fim = v1.lastIndexOf('/*', v1.indexOf('ONDE OS DADOS FICAM'));
    const ctx = vm.createContext({ console, TextEncoder, TextDecoder, CompressionStream, DecompressionStream, Response, Blob, Intl, URL, document: {} });
    vm.runInContext(v1.slice(v1.lastIndexOf('<script>') + 8, fim), ctx);
    const d = docExemplo(+a2 || 30);
    const lista = d.tabs.boletos.linhas.filter(b => !b.excluidoEm).map(b => ({ id: b.id, lancamento: b.lancamento, vencimento: b.vencimento, status: b.status === 'Renegociado' ? 'Cancelado' : b.status, valor: b.valor, parcela: b.parcela, setor: b.setor, pdv: b.pdv, cliente: b.cliente, doc: b.doc, numDoc: b.numDoc, obs: b.obs, pagoEm: b.pagoEm || '', criado: b.criadoEm }));
    const blob = await vm.runInContext('gerarXlsx', ctx)(lista);
    fs.writeFileSync(a1, new Uint8Array(await blob.arrayBuffer()));
    console.log(JSON.stringify({ boletos: lista.length }));
  } else { console.error('comando desconhecido'); process.exit(2); }
}
if (process.argv[1] && process.argv[1].endsWith('ferramenta.mjs')) main().catch(e => { console.error(e.stack || e); process.exit(1); });
