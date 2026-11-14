// Testes unitários do núcleo (Node 20+):  node --test testes/
// Rodam sobre o Boletos-a-cobrar-v2.html entregue (o núcleo é extraído entre os marcadores).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { carregarNucleo } from './carregar-nucleo.mjs';
const N = carregarNucleo();
const aqui = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ datas */
test('datas: soma de meses ajusta fim de mês e ano bissexto', () => {
  assert.equal(N.somaMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(N.somaMeses('2028-01-31', 1), '2028-02-29');
  assert.equal(N.somaMeses('2026-01-31', 2), '2026-03-31');
  assert.equal(N.somaMeses('2026-12-15', 1), '2027-01-15');
  assert.equal(N.somaMeses('2026-03-31', -1), '2026-02-28');
  assert.equal(N.somaDias('2026-02-28', 1), '2026-03-01');
  assert.equal(N.somaDias('2028-02-28', 1), '2028-02-29');
  assert.equal(N.difDias('2026-03-01', '2026-02-01'), 28);
  assert.equal(N.diaSemana('2026-10-15'), 4);
  assert.equal(N.inicioSemana('2026-10-18'), '2026-10-12');
});
test('datas: conversões de série do Excel e leitura de textos', () => {
  assert.equal(N.isoParaSerial('1900-03-01'), 61);
  assert.equal(N.isoParaSerial('2026-10-15'), 46310);
  assert.equal(N.serialParaIso(46310), '2026-10-15');
  assert.equal(N.serialParaIso(46310.99999), '2026-10-15');
  assert.equal(N.paraIso('15/10/2026'), '2026-10-15');
  assert.equal(N.paraIso('5/1/26'), '2026-01-05');
  assert.equal(N.paraIso('2026-10-15T10:00'), '2026-10-15');
  assert.equal(N.paraIso('15102026'), '2026-10-15');
  assert.equal(N.paraIso('31/02/2026'), '');
  assert.equal(N.paraIso(46310), '2026-10-15');
  assert.equal(N.paraIso(46310 - 1462, 1462), '2026-10-15');   // date1904
  assert.equal(N.serialParaTexto(46310.5), '15/10/2026 12:00');
  assert.ok(N.isoValida('2028-02-29') && !N.isoValida('2026-02-29'));
});
test('datas: resultado não depende do fuso horário do computador', () => {
  for (const tz of ['America/Sao_Paulo', 'Asia/Tokyo', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
    const out = execNode(`const N=(await import('${path.join(aqui, 'carregar-nucleo.mjs')}')).carregarNucleo(); console.log(JSON.stringify([N.somaMeses('2026-01-31',1), N.gerarParcelas({qtd:3,valor:100,venc1:'2026-10-31'}).map(p=>p.venc), N.difDias('2026-11-02','2026-10-31'), N.serialParaIso(N.isoParaSerial('2026-10-18'))]))`, { TZ: tz });
    assert.deepEqual(JSON.parse(out), ['2026-02-28', ['2026-10-31', '2026-11-30', '2026-12-31'], 2, '2026-10-18'], tz);
  }
});
import { execFileSync } from 'node:child_process';
function execNode(codigo, env) { return execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { env: { ...process.env, ...env }, encoding: 'utf8' }).trim(); }

/* ------------------------------------------------------------ parcelas */
test('parcelas: total dividido — centavos que sobram vão na parcela 1', () => {
  const p = N.gerarParcelas({ qtd: 3, valor: 100, venc1: '2026-01-31', modo: 'total' });
  assert.deepEqual(p.map(x => x.valor), [33.34, 33.33, 33.33]);
  assert.deepEqual(p.map(x => x.venc), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(p.reduce((s, x) => s + Math.round(x.valor * 100), 0), 10000);
  const q = N.gerarParcelas({ qtd: 7, valor: '1.000,01', venc1: '2026-05-10', modo: 'total' });
  assert.equal(q.reduce((s, x) => s + Math.round(x.valor * 100), 0), 100001);
  assert.equal(q[0].valor, 142.91);   // 100001 = 14285*7 + 6 centavos que sobram
});
test('parcelas: valor por parcela, a cada X dias, começar da parcela N', () => {
  const p = N.gerarParcelas({ qtd: 5, inicio: 3, valor: 250, venc1: '2026-10-20', modo: 'parcela', intervalo: 'dias', dias: 15 });
  assert.deepEqual(p.map(x => `${x.numero}/${x.total}`), ['3/5', '4/5', '5/5']);
  assert.deepEqual(p.map(x => x.venc), ['2026-10-20', '2026-11-04', '2026-11-19']);
  assert.ok(p.every(x => x.valor === 250));
  assert.deepEqual(N.gerarParcelas({ qtd: 2, valor: 0, venc1: '2026-10-20' }), []);
  assert.deepEqual(N.gerarParcelas({ qtd: 2, valor: 10, venc1: '' }), []);
});
test('valores: leitura de números no formato brasileiro', () => {
  const casos = { '1.234,56': 1234.56, '1234,56': 1234.56, '1234.56': 1234.56, 'R$ 1.234': 1234, '1.234.567': 1234567, '0,1': 0.1, '-10,5': -10.5, '10,555': 10.56, ' 7 ': 7, 'abc': NaN, '': NaN };
  for (const [e, s] of Object.entries(casos)) Number.isNaN(s) ? assert.ok(Number.isNaN(N.lerValor(e)), e) : assert.equal(N.lerValor(e), s, e);
  assert.equal(N.somaCent([0.1, 0.2, 0.3]), 0.6);
  assert.equal(N.arred2(1.005), 1.01);
});

/* ----------------------------------------------------------- CPF/CNPJ */
test('CPF/CNPJ: validação, máscara e CNPJ alfanumérico', () => {
  assert.deepEqual(N.checarDoc('529.982.247-25'), { tipo: 'CPF', ok: true });
  assert.equal(N.checarDoc('529.982.247-24').ok, false);
  assert.equal(N.checarDoc('111.111.111-11').ok, false);
  assert.equal(N.checarDoc('11.222.333/0001-81').ok, true);
  assert.equal(N.checarDoc('11.222.333/0001-82').ok, false);
  assert.equal(N.checarDoc('12.ABC.345/01DE-35').ok, true);      // exemplo oficial da Receita
  assert.equal(N.checarDoc('12.ABC.345/01DE-36').ok, false);
  assert.equal(N.checarDoc('12abc34501de35').ok, true);
  assert.equal(N.formatarDoc('12abc34501de35'), '12.ABC.345/01DE-35');
  assert.equal(N.formatarDoc('52998224725'), '529.982.247-25');
  assert.equal(N.formatarDoc('11222333000181'), '11.222.333/0001-81');
  assert.equal(N.checarDoc('123').incompleto, true);
  assert.equal(N.checarDoc('').vazio, true);
});

/* --------------------------------------------------- linha digitável */
// Gerador independente (escrito de novo, de forma diferente) para conferir o leitor
function dvMod10(s) { let t = 0; [...s].reverse().forEach((c, i) => { const p = +c * (i % 2 ? 1 : 2); t += p > 9 ? p - 9 : p; }); return (10 - t % 10) % 10; }
function dvMod11Banco(s) { let t = 0; [...s].reverse().forEach((c, i) => { t += +c * (2 + i % 8); }); const r = 11 - t % 11; return r === 0 || r > 9 ? 1 : r; }
function montarBancario(banco, venc, valorCent, livre) {
  const fator = String(((Math.round((Date.UTC(...venc.split('-').map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(1997, 9, 7)) / 864e5) - 1000) % 9000) + 1000).padStart(4, '0');
  const semDv = banco + '9' + fator + String(valorCent).padStart(10, '0') + livre;
  const dv = dvMod11Banco(semDv);
  const barras = semDv.slice(0, 4) + dv + semDv.slice(4);
  const c1 = barras.slice(0, 4) + barras.slice(19, 24), c2 = barras.slice(24, 34), c3 = barras.slice(34, 44);
  return { barras, linha: c1 + dvMod10(c1) + c2 + dvMod10(c2) + c3 + dvMod10(c3) + barras[4] + barras.slice(5, 19) };
}
test('linha digitável bancária: DVs, valor, vencimento (inclui a virada do fator em 22/02/2025)', () => {
  for (const [banco, venc, v] of [['341', '2026-11-10', 123456], ['237', '2025-02-21', 100], ['001', '2025-02-22', 99999], ['104', '2030-01-02', 1500000], ['756', '2026-10-15', 4210]]) {
    const { linha, barras } = montarBancario(banco, venc, v, '1234567890123456789012345');
    const r = N.lerBoleto(linha, '2026-10-15');
    assert.ok(r.ok, `${banco} ${venc}: ${r.erros}`);
    assert.equal(r.vencimento, venc); assert.equal(r.valor, v / 100); assert.equal(r.banco, banco); assert.equal(r.barras, barras);
    const r2 = N.lerBoleto(barras, '2026-10-15');
    assert.ok(r2.ok); assert.equal(r2.linha, linha); assert.equal(r2.vencimento, venc);
    const ruim = linha.slice(0, 6) + ((+linha[6] + 1) % 10) + linha.slice(7);
    assert.equal(N.lerBoleto(ruim, '2026-10-15').ok, false);
  }
  assert.equal(N.lerBoleto('123').ok, false);
  assert.equal(N.dataDoFator(9999, '2026-10-15'), '2025-02-21');
  assert.equal(N.dataDoFator(1000, '2026-10-15'), '2025-02-22');
  assert.equal(N.dataDoFator(1000, '2000-01-01'), '2000-07-03');
});
test('linha digitável de arrecadação (48 dígitos, módulos 10 e 11)', () => {
  function montar(ref, valorCent, resto) {
    const semDv = '8' + '2' + ref + String(valorCent).padStart(11, '0') + resto;        // 43 dígitos sem o DV geral
    const mod = ref === '6' || ref === '7' ? dvMod10 : s => { let t = 0; [...s].reverse().forEach((c, i) => { t += +c * (2 + i % 8); }); const r = t % 11; return r === 0 || r === 1 ? 0 : r === 10 ? 1 : 11 - r; };
    const dv = mod(semDv);
    const barras = semDv.slice(0, 3) + dv + semDv.slice(3);
    let linha = ''; for (let i = 0; i < 4; i++) { const b = barras.slice(i * 11, i * 11 + 11); linha += b + mod(b); }
    return linha;
  }
  for (const ref of ['6', '8']) {
    const l = montar(ref, 15790, '0001' + '2'.repeat(25));
    assert.equal(l.length, 48);
    const r = N.lerBoleto(l);
    assert.ok(r.ok, ref + ' ' + r.erros); assert.equal(r.valor, 157.9); assert.equal(r.tipo, 'arrecadacao');
  }
});

/* ------------------------------------------------- juros, aging, modelo */
test('juros simples pro rata + multa, aging e mensagem', () => {
  assert.deepEqual(N.valorAtualizado(100, '2026-10-01', '2026-10-31', 2, 1), { dias: 30, multa: 2, juros: 1, total: 103 });
  assert.deepEqual(N.valorAtualizado(1000, '2026-10-10', '2026-10-25', 2, 1), { dias: 15, multa: 20, juros: 5, total: 1025 });
  assert.equal(N.valorAtualizado(100, '2026-10-20', '2026-10-15', 2, 1).total, 100);
  assert.equal(N.valorAtualizado(0, '2026-01-01', '2026-10-15', 2, 1).total, 0);
  assert.equal(N.faixaAtraso('2026-10-15', '2026-10-15'), 'avencer');
  assert.equal(N.faixaAtraso('2026-10-14', '2026-10-15'), 'd1');
  assert.equal(N.faixaAtraso('2026-10-07', '2026-10-15'), 'd8');
  assert.equal(N.faixaAtraso('2026-09-15', '2026-10-15'), 'd16');
  assert.equal(N.faixaAtraso('2026-09-14', '2026-10-15'), 'd31');
  assert.equal(N.faixaAtraso('2026-08-15', '2026-10-15'), 'd61');
  assert.equal(N.preencherModelo('Olá {Cliente}, {valor} {dias_atraso} {Dias Atraso} {xyz}', { cliente: 'Ana', valor: 'R$ 1,00', dias_atraso: 3 }), 'Olá Ana, R$ 1,00 3 3 {xyz}');
  assert.match(N.linkWhats('(11) 90000-0000', 'oi tudo bem?'), /^https:\/\/wa\.me\/5511900000000\?text=oi%20tudo%20bem%3F$/);
});
test('CSV, OFX e CNAB 240/400', () => {
  assert.deepEqual(N.lerCSV('a;b;c\r\n1;"x;y";"a ""q"""\n\n2;;3'), [['a', 'b', 'c'], ['1', 'x;y', 'a "q"'], ['2', '', '3']]);
  assert.deepEqual(N.lerCSV('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.equal(N.gerarCSV([['a;b', 'c"d', 1]]), '"a;b";"c""d";1');
  const ofx = 'OFXHEADER:100\n<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261014120000[-3:BRT]<TRNAMT>1500.50<FITID>abc1<MEMO>PIX RECEBIDO MERCADO<CHECKNUM>NF55</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261013<TRNAMT>-20,00<FITID>x2</STMTTRN></BANKTRANLIST></OFX>';
  const o = N.lerOFX(ofx);
  assert.equal(o.length, 2); assert.equal(o[0].data, '2026-10-14'); assert.equal(o[0].valor, 1500.5); assert.equal(o[0].documento, 'NF55'); assert.equal(o[1].valor, -20);
  const L = (s, n) => s.padEnd(n, ' ').slice(0, n);
  const set = (l, ini, txt) => l.slice(0, ini - 1) + txt + l.slice(ini - 1 + txt.length);
  let t = L('', 240); t = set(t, 1, '341'); t = set(t, 8, '3'); t = set(t, 14, 'T'); t = set(t, 16, '06'); t = set(t, 38, '00000000000012345678'); t = set(t, 59, 'NF 55          '); t = set(t, 74, '10102026'); t = set(t, 82, '000000000100000');
  let u = L('', 240); u = set(u, 1, '341'); u = set(u, 8, '3'); u = set(u, 14, 'U'); u = set(u, 18, '000000000001500'); u = set(u, 33, '000000000000000'); u = set(u, 78, '000000000101500'); u = set(u, 138, '14102026'); u = set(u, 146, '15102026');
  const c = N.lerCNAB([L('34100000', 240), t, u].join('\r\n'));
  assert.equal(c.formato, 'CNAB 240'); assert.equal(c.itens.length, 1);
  assert.deepEqual([c.itens[0].nossoNumero, c.itens[0].documento, c.itens[0].vencimento, c.itens[0].valorTitulo, c.itens[0].valorPago, c.itens[0].juros, c.itens[0].data, c.itens[0].liquidacao], ['12345678', 'NF 55', '2026-10-10', 1000, 1015, 15, '2026-10-14', true]);
  let d = L('1', 400); d = set(d, 71, '000000123456'); d = set(d, 109, '06'); d = set(d, 111, '141026'); d = set(d, 117, 'NF77      '); d = set(d, 147, '101026'); d = set(d, 153, '0000000050000'); d = set(d, 254, '0000000050000');
  let h = L('0', 400); h = set(h, 77, '237');
  const c4 = N.lerCNAB([h, d].join('\n'));
  assert.equal(c4.formato, 'CNAB 400'); assert.equal(c4.itens[0].nossoNumero, '123456'); assert.equal(c4.itens[0].valorPago, 500); assert.equal(c4.itens[0].documento, 'NF77'); assert.equal(c4.itens[0].data, '2026-10-14');
});

/* --------------------------------------------------- operações e merge */
const ctxDe = (u, ts) => ({ ts, u, g: u + ts, hoje: '2026-10-15' });
function base() {
  const d = N.docVazio();
  const ops = N.opsLancamento(d, { setor: 'Varejo', pdv: 'P1', cliente: 'Cliente 1', doc: '11222333000181', parcelas: N.gerarParcelas({ qtd: 3, valor: 300, venc1: '2026-10-10', modo: 'total' }) }, ctxDe('Ana', 46300));
  return N.aplicarOps(d, ops).doc;
}
const b1 = d => d.tabs.boletos.linhas.find(b => b.id === 1);
test('merge: pessoas diferentes mexendo em linhas diferentes', () => {
  const B = base();
  const opA = N.opsEditar(B, 1, { obs: 'liguei' }, ctxDe('Ana', 46301));
  const opB = N.opsEditar(B, 2, { responsavel: 'João' }, ctxDe('João', 46302));
  const depoisB = N.aplicarOps(B, opB).doc;                 // João gravou primeiro
  const r = N.aplicarOps(depoisB, opA);                      // Ana relê e aplica a dela por cima
  assert.equal(r.conflitos.length, 0);
  assert.equal(b1(r.doc).obs, 'liguei');
  assert.equal(r.doc.tabs.boletos.linhas.find(b => b.id === 2).responsavel, 'João');
});
test('merge: campos diferentes da mesma linha são preservados', () => {
  const B = base();
  const opA = N.opsEditar(B, 1, { obs: 'nota da Ana' }, ctxDe('Ana', 46301));
  const opB = N.opsEditar(B, 1, { responsavel: 'João', etapa: 'Contatado' }, ctxDe('João', 46302));
  const r = N.aplicarOps(N.aplicarOps(B, opB).doc, opA);
  assert.equal(r.conflitos.length, 0);
  assert.deepEqual([b1(r.doc).obs, b1(r.doc).responsavel, b1(r.doc).etapa], ['nota da Ana', 'João', 'Contatado']);
});
test('merge: mesmo campo da mesma linha — vale a alteração mais recente, com aviso', () => {
  const B = base();
  const antiga = N.opsEditar(B, 1, { obs: 'antiga' }, ctxDe('Ana', 46301.1));
  const nova = N.opsEditar(B, 1, { obs: 'nova' }, ctxDe('João', 46301.2));
  // a mais nova gravou primeiro; a antiga chega depois e perde
  let r = N.aplicarOps(N.aplicarOps(B, nova).doc, antiga);
  assert.equal(b1(r.doc).obs, 'nova');
  assert.equal(r.conflitos[0].tipo, 'perdeu');
  // a antiga gravou primeiro; a nova chega depois e ganha
  r = N.aplicarOps(N.aplicarOps(B, antiga).doc, nova);
  assert.equal(b1(r.doc).obs, 'nova');
  assert.equal(r.conflitos[0].tipo, 'ganhou'); assert.equal(r.conflitos[0].quem, 'Ana');
});
test('merge: dois lançamentos ao mesmo tempo com o mesmo ID provisório', () => {
  const B = base();
  const ca = ctxDe('Ana', 46305), cj = ctxDe('João', 46305.5);
  const opsA = N.opsLancamento(B, { pdv: 'PA', cliente: 'A', doc: '529.982.247-25', parcelas: N.gerarParcelas({ qtd: 2, valor: 50, venc1: '2026-11-01' }) }, ca);
  const opsJ = N.opsLancamento(B, { pdv: 'PJ', cliente: 'J', parcelas: N.gerarParcelas({ qtd: 1, valor: 70, venc1: '2026-11-02' }) }, cj);
  assert.equal(opsA[0].linha.id, opsJ[0].linha.id);          // ambos pensaram em ID 4
  const pagA = N.opsPagamento(N.aplicarOps(B, opsA).doc, opsA[0].linha.id, { data: '2026-11-01', valor: 50 }, ctxDe('Ana', 46305.1));
  const comJ = N.aplicarOps(B, opsJ).doc;                   // João gravou primeiro
  const r = N.aplicarOps(comJ, [...opsA, ...pagA]);
  const bol = r.doc.tabs.boletos.linhas;
  assert.equal(bol.length, 6);
  assert.equal(new Set(bol.map(b => b.id)).size, 6);
  const lancs = new Set(bol.map(b => b.lancamento));
  assert.equal(lancs.size, 3);                               // base + Ana + João, sem misturar
  const doJ = bol.find(b => b.pdv === 'PJ'), daA = bol.filter(b => b.pdv === 'PA');
  assert.equal(daA.length, 2); assert.ok(daA.every(b => b.lancamento === daA[0].lancamento && b.lancamento !== doJ.lancamento));
  const pag = r.doc.tabs.pagamentos.linhas[0];
  assert.equal(r.doc.tabs.boletos.linhas.find(b => b.id === pag.boleto).pdv, 'PA');   // pagamento seguiu o ID novo
  assert.equal(r.doc.tabs.boletos.linhas.find(b => b.id === pag.boleto).status, 'Pago');
  const rem = N.remapearOps([...opsA, ...pagA], r.remap, r.lancRemap);
  assert.notEqual(rem[0].linha.id, opsA[0].linha.id);
});
test('merge: aplicar a mesma operação duas vezes não duplica nada (idempotente)', () => {
  const B = base();
  const ops = [...N.opsLancamento(B, { pdv: 'X', parcelas: N.gerarParcelas({ qtd: 2, valor: 10, venc1: '2026-12-01' }) }, ctxDe('Ana', 46310)),
    ...N.opsContato(B, [1], { canal: 'WhatsApp', anotacao: 'ok', promessaEm: '2026-10-20' }, ctxDe('Ana', 46310.1))];
  const uma = N.aplicarOps(B, ops).doc;
  const duas = N.aplicarOps(uma, ops).doc;
  for (const t of N.TABS) assert.equal(duas.tabs[t].linhas.length, uma.tabs[t].linhas.length, t);
  assert.equal(b1(duas).promessaEm, '2026-10-20');
});
test('merge: edição direta no Excel + edição no sistema', () => {
  const B = base();
  const excel = N.clonarDoc(B);                      // alguém mudou o valor no Excel (sem "alterado em")
  excel.tabs.boletos.linhas[0] = { ...excel.tabs.boletos.linhas[0], valor: 999, obs: 'excel' };
  const meu = N.opsEditar(B, 1, { responsavel: 'Ana', obs: 'sistema' }, ctxDe('Ana', 46311));
  const r = N.aplicarOps(excel, meu);
  assert.equal(b1(r.doc).valor, 999);                // a mudança do Excel ficou
  assert.equal(b1(r.doc).responsavel, 'Ana');
  assert.equal(b1(r.doc).obs, 'sistema');            // mesmo campo: o sistema (mais recente) ganha e avisa
  assert.equal(r.conflitos.length, 1);
});
test('merge: linha apagada no Excel — a alteração vira aviso, não erro', () => {
  const B = base();
  const sem = N.clonarDoc(B); sem.tabs.boletos.linhas = sem.tabs.boletos.linhas.filter(b => b.id !== 1);
  const r = N.aplicarOps(sem, N.opsEditar(B, 1, { obs: 'x' }, ctxDe('Ana', 46311)));
  assert.equal(r.conflitos[0].tipo, 'sumiu'); assert.equal(r.doc.tabs.boletos.linhas.length, 2);
  assert.deepEqual(N.linhasSumidas(B, sem).map(x => x.linha.id), [1]);
});
test('merge: detectar gravação simultânea que desfez minha alteração', () => {
  const B = base();
  const meu = N.opsEditar(B, 1, { status: 'Pago', pagoEm: '2026-10-15' }, ctxDe('Ana', 46312));
  const gravado = N.aplicarOps(B, meu).doc;
  assert.ok(meu.filter(o => o.tab === 'boletos').every(o => N.opPresente(gravado, o)));
  // João gravou por cima com a versão antiga dele (sem a minha mudança), mexendo em outro campo
  const deJoao = N.aplicarOps(B, N.opsEditar(B, 1, { responsavel: 'João' }, ctxDe('João', 46312.1))).doc;
  assert.equal(N.opPresente(deJoao, meu[0]), false);
  // alguém mudou de propósito para um terceiro valor: não refaz
  const terceiro = N.clonarDoc(gravado); terceiro.tabs.boletos.linhas[0] = { ...terceiro.tabs.boletos.linhas[0], status: 'Cancelado' };
  assert.equal(N.opPresente(terceiro, meu[0]), true);
  // a mais recente foi apagada por uma gravação velha e depois alguém reaplicou uma mudança MAIS ANTIGA:
  // a mais recente tem de voltar (vale a alteração mais recente)
  const velha = N.opsEditar(B, 1, { obs: 'B' }, ctxDe('Bruno', 46312.2))[0];
  const nova = N.opsEditar(B, 1, { obs: 'D' }, ctxDe('Davi', 46312.3))[0];
  const reaplicadaVelha = N.aplicarOps(B, [velha]).doc;
  assert.equal(N.opPresente(reaplicadaVelha, nova), false);
  const corrigido = N.aplicarOps(reaplicadaVelha, [nova]).doc;
  assert.equal(b1(corrigido).obs, 'D');
  assert.equal(N.opPresente(corrigido, velha), true);         // e a mais velha aceita que perdeu
  const lanc = N.opsLancamento(B, { pdv: 'Y', parcelas: N.gerarParcelas({ qtd: 1, valor: 5, venc1: '2026-12-01' }) }, ctxDe('Ana', 46313));
  assert.equal(N.opPresente(B, lanc[0]), false);
  assert.equal(N.opPresente(N.aplicarOps(B, lanc).doc, lanc[0]), true);
});
test('merge: datas arredondadas pelo Excel (15 dígitos) ou por outro programa (milissegundo) não confundem o sistema', () => {
  const d0 = N.docVazio();
  const ops = N.opsLancamento(d0, { pdv: 'P', cliente: 'C', parcelas: N.gerarParcelas({ qtd: 12, valor: 1200, venc1: '2026-11-01', modo: 'total' }) }, N.novoCtx('Ana'));
  const gravado = N.aplicarOps(d0, ops).doc;
  assert.equal(new Set(gravado.tabs.boletos.linhas.map(l => N.carimbo('boletos', l))).size, 12, 'cada parcela tem carimbo próprio');
  const arredondar = (doc, f) => { const x = N.clonarDoc(doc); for (const t of N.TABS) x.tabs[t].linhas = x.tabs[t].linhas.map(l => { const c = { ...l }; for (const k of ['criadoEm', 'alteradoEm', 'dataHora', 'registradoEm']) if (typeof c[k] === 'number') c[k] = f(c[k]); return c; }); return x; };
  const modos = { milissegundo: x => Math.round(x * 864e5) / 864e5, excel15: x => +x.toPrecision(15), excel15ms: x => +(Math.round(x * 864e5) / 864e5).toPrecision(15) };
  for (const [nome, f] of Object.entries(modos)) {
    const ex = arredondar(gravado, f);
    assert.ok(ops.every(o => N.opPresente(ex, o)), nome + ': criações reconhecidas (não refaz)');
    const r = N.aplicarOps(ex, ops);
    assert.equal(r.doc.tabs.boletos.linhas.length, 12, nome + ': reaplicar não duplica boletos');
    assert.equal(r.doc.tabs.historico.linhas.length, ex.tabs.historico.linhas.length, nome + ': nem o histórico');
    assert.equal(N.linhasSumidas(gravado, ex).length, 0, nome + ': nenhuma linha dada como apagada');
    // minha edição gravada; depois alguém muda o mesmo campo no Excel (datas arredondadas): vale a do Excel
    const ed = N.opsEditar(gravado, 5, { obs: 'sistema' }, N.novoCtx('Ana'));
    const ex2 = arredondar(N.aplicarOps(gravado, ed).doc, f);
    ex2.tabs.boletos.linhas = ex2.tabs.boletos.linhas.map(l => l.id === 5 ? { ...l, obs: 'Excel' } : l);
    assert.equal(N.opPresente(ex2, ed[0]), true, nome + ': não regrava por cima da edição do Excel');
    const ed2 = N.opsEditar(ex2, 5, { responsavel: 'Ana' }, N.novoCtx('Ana'));
    const r2 = N.aplicarOps(ex2, ed2);
    assert.equal(r2.conflitos.length, 0, nome);
    assert.deepEqual([r2.doc.tabs.boletos.linhas.find(b => b.id === 5).obs, r2.doc.tabs.boletos.linhas.find(b => b.id === 5).responsavel], ['Excel', 'Ana'], nome);
  }
});
test('linhas antigas (V1) com a mesma data de criação: apagar uma no Excel é percebido', () => {
  const v1 = N.clonarDoc(base()); v1.tabs.boletos.linhas = v1.tabs.boletos.linhas.map(l => ({ ...l, criadoEm: 46000.5, criadoPor: '' }));
  const sem = N.clonarDoc(v1); sem.tabs.boletos.linhas = sem.tabs.boletos.linhas.filter(b => b.id !== 2);
  assert.deepEqual(N.linhasSumidas(v1, sem).map(x => x.linha.id), [2]);
  assert.deepEqual(N.linhasSumidas(v1, N.clonarDoc(v1)), []);
});
test('merge: configuração e proteção contra perda de colunas/abas (gravação por versão antiga)', () => {
  const B = base();
  const r = N.aplicarOps(B, N.opsConfig(B, 'multa', '3', ctxDe('Ana', 46314)));
  assert.equal(r.doc.config.multa, '3');
  const comResp = N.aplicarOps(B, N.opsEditar(B, 2, { responsavel: 'Ana', etapa: 'Contatado' }, ctxDe('Ana', 46314))).doc;
  const v1 = N.clonarDoc(comResp);
  v1.tabs.boletos.ordem = v1.tabs.boletos.ordem.filter(o => !['responsavel', 'etapa'].includes(o.k));
  v1.tabs.boletos.linhas = v1.tabs.boletos.linhas.map(({ responsavel, etapa, ...x }) => x);
  v1.tabs.historico = { ...N.tabVazia('historico') };
  const p = N.protegerPerdas(comResp, v1);
  assert.ok(p.precisaGravar);
  assert.equal(p.doc.tabs.boletos.linhas.find(b => b.id === 2).responsavel, 'Ana');
  assert.equal(p.doc.tabs.boletos.linhas.find(b => b.id === 2).etapa, 'Contatado');
  assert.equal(p.doc.tabs.historico.linhas.length, comResp.tabs.historico.linhas.length);
});
test('pagamento parcial, quitação, estorno, baixa em lote e desfazer', () => {
  let d = base();
  d = N.aplicarOps(d, N.opsPagamento(d, 1, { data: '2026-10-12', valor: 40, forma: 'PIX' }, ctxDe('Ana', 46320))).doc;
  assert.equal(b1(d).saldo, 60); assert.equal(b1(d).status, 'Em aberto');
  d = N.aplicarOps(d, N.opsPagamento(d, 1, { data: '2026-10-14', valor: 65, juros: 5, forma: 'PIX' }, ctxDe('Ana', 46321))).doc;
  assert.equal(b1(d).status, 'Pago'); assert.equal(b1(d).saldo, 0); assert.equal(b1(d).valorPago, 105); assert.equal(b1(d).pagoEm, '2026-10-14');
  const pagIds = d.tabs.pagamentos.linhas.map(p => p.id);
  d = N.aplicarOps(d, N.opsEstorno(d, [pagIds[1]], ctxDe('Ana', 46322))).doc;
  assert.equal(b1(d).status, 'Em aberto'); assert.equal(b1(d).saldo, 60);
  const lote = N.opsBaixaLote(d, [1, 2, 3], { data: '2026-10-15', forma: 'Boleto' }, ctxDe('João', 46323));
  const dl = N.aplicarOps(d, lote).doc;
  assert.ok(dl.tabs.boletos.linhas.every(b => b.status === 'Pago'));
  assert.equal(dl.tabs.pagamentos.linhas.filter(p => !p.estornadoEm).reduce((s, p) => s + p.valor, 0), 40 + 60 + 100 + 100);
  const desfaz = N.inverterOps(dl, lote, ctxDe('João', 46324));
  const dd = N.aplicarOps(dl, desfaz).doc;
  assert.ok(dd.tabs.boletos.linhas.every(b => b.status === 'Em aberto'));
  assert.equal(b1(dd).saldo, 60);
  const refaz = N.inverterOps(dd, desfaz, ctxDe('João', 46325));
  assert.ok(N.aplicarOps(dd, refaz).doc.tabs.boletos.linhas.every(b => b.status === 'Pago'));
});
test('renegociação gera novo parcelamento ligado aos originais', () => {
  const d = base();
  const ops = N.opsRenegociar(d, [1, 2], { qtd: 4, venc1: '2026-11-15', intervalo: 'mensal' }, ctxDe('Ana', 46330));
  const r = N.aplicarOps(d, ops).doc;
  const novos = r.tabs.boletos.linhas.filter(b => b.renegociadoDe);
  assert.equal(novos.length, 4);
  assert.equal(Math.round(novos.reduce((s, b) => s + b.valor, 0) * 100), 20000);
  assert.ok(r.tabs.boletos.linhas.filter(b => [1, 2].includes(b.id)).every(b => b.status === 'Renegociado' && b.renegociadoPara === String(novos[0].lancamento)));
  assert.equal(novos[0].renegociadoDe, '1; 2');
});
test('editar "este e os próximos" desloca vencimentos e copia campos', () => {
  const d = base();
  const ops = N.opsEditar(d, 1, { vencimento: '2026-10-15', valor: 120, obs: 'novo' }, ctxDe('Ana', 46340), { proximos: true });
  const r = N.aplicarOps(d, ops).doc;
  const l = r.tabs.boletos.linhas.sort((a, b) => a.id - b.id);
  assert.deepEqual(l.map(b => b.vencimento), ['2026-10-15', '2026-11-15', '2026-12-15']);
  assert.deepEqual(l.map(b => b.valor), [120, 120, 120]);
  assert.ok(l.every(b => b.obs === 'novo'));
});
test('conciliação sugere baixas por nosso número, documento e valor', () => {
  let d = base();
  d = N.aplicarOps(d, N.opsEditar(d, 1, { nossoNumero: '000012345678' }, ctxDe('Ana', 46350))).doc;
  d = N.aplicarOps(d, N.opsEditar(d, 2, { numDoc: 'NF 55' }, ctxDe('Ana', 46350.1))).doc;
  const s = N.sugerirBaixas(d, [{ nossoNumero: '12345678', valorPago: 100, data: '2026-10-14' }, { documento: 'nf55', valorPago: 100, data: '2026-10-14' }, { valorPago: 100, data: '2026-12-09', vencimento: '2026-12-10' }, { valorPago: 7, data: '2026-10-01' }], '2026-10-15');
  assert.deepEqual(s.map(x => x.boleto && x.boleto.id), [1, 2, 3, null]);
  assert.deepEqual(s.map(x => x.confianca), ['alta', 'alta', 'media', '']);
});
test('importação: validação linha a linha e duplicados', () => {
  const d = base();
  const linhas = [['15/11/2026', '1.000,00', 'Bar do Zé', '529.982.247-25', 'NF1'], ['', '10', 'X', '', ''], ['10/10/2026', '100,00', 'Cliente 1', '11.222.333/0001-81', ''], ['15/11/2026', '1.000,00', 'Bar do Zé', '529.982.247-25', 'NF1']];
  const mapa = { vencimento: 0, valor: 1, cliente: 2, doc: 3, numDoc: 4 };
  const r = N.prepararImportacao(d, linhas, mapa, '2026-10-15');
  assert.deepEqual(r.map(x => x.ok), [true, false, true, true]);
  assert.deepEqual(r.map(x => x.duplicado || ''), ['', '', 'já existe na planilha', 'repetido no arquivo']);
  const ops = N.opsImportacao(d, r.filter(x => x.importar), ctxDe('Ana', 46360));
  assert.equal(N.aplicarOps(d, ops).doc.tabs.boletos.linhas.length, 4);
  assert.deepEqual(N.sugerirMapa(['Data de vencimento', 'Valor (R$)', 'Razão social', 'CNPJ', 'Nº do boleto']), { vencimento: 0, valor: 1, cliente: 2, doc: 3, numDoc: 4 });
});
test('verificar planilha encontra problemas e corrige o que dá', () => {
  let d = base();
  d.tabs.boletos.linhas.push({ id: 9, vencimento: '', valor: 'abc', status: 'Em aberto', parcela: '2/5', lancamento: 1, doc: '11222333000181', setor: ' Varejo ' });
  const p = N.verificarPlanilha(d, '2026-10-15');
  const tipos = p.map(x => x.tipo);
  for (const t of ['datas', 'valor', 'docFormato', 'espacos', 'parcelas']) assert.ok(tipos.includes(t), t);
  const fix = N.opsCorrecao(d, p.find(x => x.tipo === 'docFormato'), ctxDe('Ana', 46370));
  assert.equal(N.aplicarOps(d, fix).doc.tabs.boletos.linhas.find(b => b.id === 9).doc, '11.222.333/0001-81');
});
test('agenda do dia: promessas quebradas, ações, vence hoje, venceu ontem', () => {
  let d = base();       // vencimentos 10/10, 10/11, 10/12
  d = N.aplicarOps(d, N.opsContato(d, [1], { promessaEm: '2026-10-14', canal: 'Ligação' }, ctxDe('Ana', 46380))).doc;
  d = N.aplicarOps(d, N.opsEditar(d, 2, { proxAcaoEm: '2026-10-15', proxAcao: 'ligar', vencimento: '2026-10-15' }, ctxDe('Ana', 46380.1))).doc;
  const g = Object.fromEntries(N.agendaHoje(d, '2026-10-15').map(x => [x.k, x.itens.map(b => b.id)]));
  assert.deepEqual(g.quebradas, [1]); assert.deepEqual(g.acoes, [2]); assert.deepEqual(g.venceHoje, []);
  const k = N.kpis(d, '2026-10-15');
  assert.equal(k.vencidos.qtd, 1); assert.equal(k.hoje.qtd, 1);
  assert.deepEqual(N.aging(d.tabs.boletos.linhas, '2026-10-15').map(f => f.qtd), [2, 1, 0, 0, 0, 0]);
});

/* --------------------------------------------------------- planilha */
test('xlsx: gravar e ler de novo preserva todos os dados (inclui caracteres especiais)', async () => {
  let d = base();
  d = N.aplicarOps(d, N.opsEditar(d, 1, { obs: 'Ação & "aspas" <tag> ção 🚀\nsegunda linha', numDoc: '000123' }, ctxDe('Ana', 46390))).doc;
  d = N.aplicarOps(d, N.opsPagamento(d, 2, { data: '2026-10-12', valor: 10.1, desconto: 0.05 }, ctxDe('Ana', 46391))).doc;
  d = N.aplicarOps(d, N.opsContato(d, [3], { canal: 'E-mail', anotacao: 'enviado' }, ctxDe('Ana', 46392))).doc;
  d = N.aplicarOps(d, N.opsConfig(d, 'setores', 'Varejo; Atacado', ctxDe('Ana', 46393))).doc;
  const bytes = await N.gerarPlanilha(d, { hoje: '2026-10-15' });
  const l = await N.lerPlanilha(bytes);
  for (const t of N.TABS) {
    assert.equal(l.tabs[t].linhas.length, d.tabs[t].linhas.length, t);
    for (const lin of d.tabs[t].linhas) {
      const x = l.tabs[t].linhas.find(y => y.id === lin.id);
      for (const c of N.ESQUEMA[t].cols) if (!N.vazio(lin[c.k])) assert.ok(N.igual(x[c.k], lin[c.k]), `${t}.${c.k}: ${x[c.k]} != ${lin[c.k]}`);
    }
  }
  assert.equal(l.config.setores, 'Varejo; Atacado');
  assert.equal(l.esquema, 2);
  // gravar de novo o que foi lido: idêntico e estilos não crescem
  const b2 = await N.gerarPlanilha(l, { hoje: '2026-10-15' });
  const l2 = await N.lerPlanilha(b2);
  const est1 = (await N.lerPacote(bytes)).stylesXml, est2 = (await N.lerPacote(b2)).stylesXml;
  assert.equal(est1.length, est2.length);
  assert.deepEqual(l2.tabs.boletos.linhas.map(b => [b.id, b.obs, b.saldo]), l.tabs.boletos.linhas.map(b => [b.id, b.obs, b.saldo]));
});
test('xlsx: arquivo vazio, corrompido, com senha (OLE) e outro formato geram mensagem clara', async () => {
  await assert.rejects(N.lerPlanilha(new Uint8Array()), e => e.tipo === 'vazia');
  await assert.rejects(N.lerPlanilha(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0])), e => e.tipo === 'protegida' && /SEM senha/.test(e.message));
  await assert.rejects(N.lerPlanilha(new TextEncoder().encode('a;b;c')), e => e.tipo === 'formato');
  const ok = await N.gerarPlanilha(base());
  await assert.rejects(N.lerPlanilha(ok.slice(0, ok.length - 300)), e => e.tipo === 'corrompida');
});
test('xlsx: fórmula em coluna do time acompanha a linha quando o sistema reordena', () => {
  assert.equal(N.deslocarFormula('TODAY()-A5', 3), 'TODAY()-A8');
  assert.equal(N.deslocarFormula('$A$5+B5*Plan2!C5+"A5"&\'Aba 1\'!D5', 2), '$A$5+B7*Plan2!C7+"A5"&\'Aba 1\'!D7');
  assert.equal(N.deslocarFormula('SUM(A2:A10)+LOG10(B2)+ATAN2(1,2)', -1), 'SUM(A1:A9)+LOG10(B1)+ATAN2(1,2)');
  assert.equal(N.deslocarFormula('A1', -1), '#REF!');
  assert.equal(N.deslocarFormula('Tabela1[@Valor]+A3', 1), 'Tabela1[@Valor]+A4');
});

/* --------------------------------------------------- migração V1 -> V2 */
test('migração V1→V2: planilha criada pela V1 abre, ganha as abas novas e não perde nada', async () => {
  const v1 = fs.readFileSync(path.join(aqui, 'dados', 'Boletos-a-cobrar-v1.html'), 'utf8');
  const fim = v1.lastIndexOf('/*', v1.indexOf('ONDE OS DADOS FICAM'));
  const script = v1.slice(v1.lastIndexOf('<script>') + 8, fim);
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, CompressionStream, DecompressionStream, Response, Blob, Intl, URL, document: {} });
  vm.runInContext(script, ctx);
  const lista = [
    { id: 1, lancamento: 1, vencimento: '2026-09-10', status: 'Em aberto', valor: 150.5, parcela: '1/2', setor: 'Varejo', pdv: 'P10', cliente: 'Mercado A', doc: '11.222.333/0001-81', numDoc: 'NF1', obs: 'obs & <x>', pagoEm: '', criado: 46000.5 },
    { id: 2, lancamento: 1, vencimento: '2026-10-10', status: 'Pago', valor: 150.5, parcela: '2/2', setor: 'Varejo', pdv: 'P10', cliente: 'Mercado A', doc: '11.222.333/0001-81', numDoc: 'NF1', obs: '', pagoEm: '2026-10-09', criado: 46000.5 },
    { id: 3, lancamento: 2, vencimento: '2026-11-01', status: 'Cancelado', valor: 99.99, parcela: '1/1', setor: 'Farmácias', pdv: 'P20', cliente: '', doc: '529.982.247-25', numDoc: '', obs: '', pagoEm: '', criado: 46001.25 }
  ];
  const blob = await vm.runInContext('gerarXlsx', ctx)(lista);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  fs.mkdirSync(path.join(aqui, 'saida'), { recursive: true });
  fs.writeFileSync(path.join(aqui, 'saida', 'v1-original.xlsx'), bytes);
  const d = await N.lerPlanilha(bytes);
  assert.equal(d.esquema, 1);
  assert.equal(d.tabs.boletos.linhas.length, 3);
  const b = d.tabs.boletos.linhas.find(x => x.id === 1);
  assert.deepEqual([b.vencimento, b.valor, b.parcela, b.doc, b.obs, b.status, b.lancamento], ['2026-09-10', 150.5, '1/2', '11.222.333/0001-81', 'obs & <x>', 'Em aberto', 1]);
  assert.equal(d.tabs.boletos.linhas.find(x => x.id === 2).pagoEm, '2026-10-09');
  assert.equal(d.tabs.boletos.linhas.find(x => x.id === 3).criadoEm, 46001.25);
  const v2 = await N.gerarPlanilha(N.migrarV1 ? N.migrarV1(d, { u: 'Migração', ts: 46310 }) : d, { hoje: '2026-10-15' });
  fs.writeFileSync(path.join(aqui, 'saida', 'v1-migrada.xlsx'), v2);
  const d2 = await N.lerPlanilha(v2);
  assert.equal(d2.esquema, 2);
  assert.equal(d2.tabs.boletos.linhas.length, 3);
  for (const x of d.tabs.boletos.linhas) {
    const y = d2.tabs.boletos.linhas.find(z => z.id === x.id);
    for (const k of ['vencimento', 'status', 'valor', 'parcela', 'setor', 'pdv', 'cliente', 'doc', 'numDoc', 'obs', 'pagoEm', 'lancamento', 'criadoEm']) assert.ok(N.igual(x[k], y[k]), `${k}: ${x[k]} vs ${y[k]}`);
  }
  // colunas da V1 continuam na mesma ordem, no começo
  assert.deepEqual(d2.tabs.boletos.ordem.slice(0, 14).map(o => o.k), ['vencimento', 'status', 'valor', 'parcela', 'setor', 'pdv', 'cliente', 'doc', 'numDoc', 'obs', 'pagoEm', 'id', 'lancamento', 'criadoEm']);
  assert.ok(d2.tabs.clientes.linhas.length >= 2, 'clientes criados a partir dos boletos');
});
