#!/usr/bin/env python3
"""Round-trip da planilha: gerar (sistema) -> editar com openpyxl (simulando o Excel) -> ler/gravar
no sistema -> conferir com openpyxl -> re-salvar com LibreOffice -> ler/gravar de novo -> PDF.
Também cobre a migração de uma planilha da V1 (com o "2/5" que o Excel transforma em data).

Uso: python3 testes/roundtrip.py [pasta_saida]   (precisa de node, openpyxl, soffice, pdftoppm)
"""
import json, os, shutil, subprocess, sys, datetime
import openpyxl
from openpyxl.workbook.defined_name import DefinedName

AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, 'saida', 'roundtrip')
os.makedirs(OUT, exist_ok=True)
FERR = os.path.join(AQUI, 'ferramenta.mjs')
falhas = []

def node(*args):
    r = subprocess.run(['node', FERR, *args], capture_output=True, text=True, timeout=300)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()

def ler(p):
    return json.loads(node('ler', p))

def checar(cond, msg):
    print(('  ok   ' if cond else '  FALHA ') + msg)
    if not cond:
        falhas.append(msg)

def cabecalho(ws):
    return {c.value: c.column for c in ws[1] if c.value}

a, b, c = (os.path.join(OUT, n) for n in ('a-sistema.xlsx', 'b-editado-excel.xlsx', 'c-sistema-de-novo.xlsx'))
print('1) sistema gera a planilha')
node('exemplo', a, '40')
doc_a = ler(a)
ids = sorted(l['id'] for l in doc_a['tabs']['boletos']['linhas'])
print('   boletos:', len(ids))

print('2) "Excel" (openpyxl) edita: coluna nova, fórmula, linha nova, linha copiada, linha apagada, total, aba nova, config')
wb = openpyxl.load_workbook(a)
ws = wb['Boletos']
H = cabecalho(ws)
col_id, col_valor, col_cli, col_venc, col_status = H['ID'], H['Valor'], H['Cliente'], H['Vencimento'], H['Status']
ultima_col = ws.max_column
L = openpyxl.utils.get_column_letter
def linhas_por_id():
    return {ws.cell(r, col_id).value: r for r in range(2, ws.max_row + 1) if ws.cell(r, col_id).value is not None}
alvo_valor, alvo_dup, alvo_del = ids[4], ids[6], ids[8]
ws.delete_rows(linhas_por_id()[alvo_del])          # apaga primeiro (o openpyxl não corrige fórmulas como o Excel)
linha_do = linhas_por_id()
ws.cell(linha_do[alvo_valor], col_valor, 777.77)
nova = ws.max_row + 1
ws.cell(nova, col_venc, datetime.datetime(2026, 12, 20))
ws.cell(nova, col_status, 'Em aberto')
ws.cell(nova, col_valor, 55.5)
ws.cell(nova, col_cli, 'Novo no Excel')
dup = ws.max_row + 1
for col in range(1, ultima_col + 1):
    ws.cell(dup, col, ws.cell(linha_do[alvo_dup], col).value)
ws.cell(dup, col_cli, 'Copiado no Excel')
ws.cell(1, ultima_col + 1, 'Região')
ws.cell(1, ultima_col + 2, 'Dias em atraso')
for r in range(2, ws.max_row + 1):
    ws.cell(r, ultima_col + 1, 'Sul' if r % 2 else 'Norte')
    ws.cell(r, ultima_col + 2, f'=IF({L(col_status)}{r}="Em aberto",TODAY()-{L(col_venc)}{r},"")')
tot = ws.max_row + 2
ws.cell(tot, col_cli, 'TOTAL (linha do time)')
ws.cell(tot, col_valor, f'=SUM({L(col_valor)}2:{L(col_valor)}{tot - 2})')
ws.column_dimensions[L(col_cli)].width = 50
nt = wb.create_sheet('Minhas notas')
nt['A1'] = 'Anotações do time'
nt['B2'] = 42
nt['B3'] = '=B2*2'
nt['C3'] = "=SUMIFS(Boletos!C:C,Boletos!B:B,\"Em aberto\")"
wb.defined_names['Taxa'] = DefinedName('Taxa', attr_text="'Minhas notas'!$B$2")
for w_ in wb.worksheets: w_.sheet_view.tabSelected = False
wb.active = wb.sheetnames.index('Minhas notas'); nt.sheet_view.tabSelected = True   # o time salvou com a aba dele aberta
cfg = wb['Config']
for r in range(2, cfg.max_row + 1):
    if cfg.cell(r, 1).value == 'Multa por atraso (%)':
        cfg.cell(r, 2).value = '2,5'
cfg.cell(cfg.max_row + 2, 1, 'Anotação do time na Config')
cfg.cell(cfg.max_row, 2, 'mantida')
wb.save(b)

print('3) sistema lê a planilha editada')
d = ler(b)
bol = {l['id']: l for l in d['tabs']['boletos']['linhas']}
checar(abs(bol[alvo_valor]['valor'] - 777.77) < 1e-9, 'valor alterado no Excel foi lido')
novos = [l for l in d['tabs']['boletos']['linhas'] if l.get('cliente') == 'Novo no Excel']
checar(len(novos) == 1 and novos[0]['id'] > max(ids) and novos[0]['vencimento'] == '2026-12-20', 'linha digitada no Excel (sem ID) ganhou ID novo')
copias = [l for l in d['tabs']['boletos']['linhas'] if l.get('cliente') == 'Copiado no Excel']
checar(len(copias) == 1 and copias[0]['id'] != alvo_dup and bol[alvo_dup]['cliente'] != 'Copiado no Excel', 'linha copiada (ID repetido) ganhou ID novo e a original manteve o seu')
checar(alvo_del not in bol, 'linha apagada no Excel não aparece')
ordem = [o.get('x') or o.get('k') for o in d['tabs']['boletos']['ordem']]
checar('Região' in ordem and 'Dias em atraso' in ordem, 'colunas novas do time reconhecidas')
checar(d['tabs']['boletos']['soltas'] == 1, 'linha de total do time guardada (não vira boleto)')
checar(d['config']['multa'] == '2,5', 'config editada no Excel foi lida')
checar(any(x[0] == 'Anotação do time na Config' for x in d['configExtra']), 'linha extra na Config preservada')

print('4) sistema grava (com uma edição)')
node('gravar', b, c, 'editado pelo sistema')
wc = openpyxl.load_workbook(c)
checar('Minhas notas' in wc.sheetnames, 'aba do time preservada')
checar(wc['Minhas notas']['B3'].value == '=B2*2' and wc['Minhas notas']['B2'].value == 42, 'conteúdo e fórmula da aba do time preservados')
checar('Taxa' in wc.defined_names, 'nome definido do time preservado')
checar(wc['_Sistema'].sheet_state == 'hidden', 'aba _Sistema oculta')
sel = [w_.title for w_ in wc.worksheets if w_.sheet_view.tabSelected]
checar(sel == ['Minhas notas'], f'só uma aba selecionada (sem abas agrupadas no Excel): {sel}')
w = wc['Boletos']
H2 = cabecalho(w)
checar('Região' in H2 and 'Dias em atraso' in H2, 'colunas do time continuam no cabeçalho')
cd, cv, cst, ci, cobs = H2['Dias em atraso'], H2['Vencimento'], H2['Status'], H2['ID'], H2['Observação']
erradas = 0
n_dados = 0
for r in range(2, w.max_row + 1):
    f = w.cell(r, cd).value
    if w.cell(r, ci).value is None:
        continue
    n_dados += 1
    esperado = f'=IF({L(cst)}{r}="Em aberto",TODAY()-{L(cv)}{r},"")'
    if f != esperado:
        erradas += 1
        if erradas < 3:
            print('     linha', r, repr(f), '!=', esperado)
checar(erradas == 0, f'fórmula do time acompanhou a linha após a reordenação ({n_dados} linhas)')
regiao_ok = all(w.cell(r, H2['Região']).value in ('Sul', 'Norte') for r in range(2, n_dados + 2))
checar(regiao_ok, 'valores da coluna Região preservados em todas as linhas')
total_r = [r for r in range(2, w.max_row + 1) if w.cell(r, H2['Cliente']).value == 'TOTAL (linha do time)']
checar(len(total_r) == 1 and total_r[0] > n_dados + 1 and str(w.cell(total_r[0], H2['Valor']).value).startswith('=SUM('), 'linha de total foi para o fim com a fórmula')
checar(abs((w.column_dimensions[L(H2['Cliente'])].width or 0) - 50) < 0.6, 'largura de coluna ajustada no Excel preservada')
checar(any(w.cell(r, cobs).value == 'editado pelo sistema' for r in range(2, w.max_row + 1)), 'edição do sistema gravada')
checar(len(w.conditional_formatting) >= 1, 'formatação condicional presente')
checar(len(w.data_validations.dataValidation) >= 1, 'validação de lista no Status presente')
checar(w.freeze_panes == 'A2', 'painel congelado')
checar(w.auto_filter.ref and w.auto_filter.ref.startswith('A1:'), 'filtro automático')
vencs = [w.cell(r, cv).value for r in range(2, n_dados + 2) if w.cell(r, H2['Na lixeira desde']).value is None]
checar(vencs == sorted(vencs, key=lambda x: x or datetime.datetime(9999, 1, 1)), 'aba Boletos ordenada por vencimento')
checar(wc['Resumo']['B5'].value and str(wc['Resumo']['B5'].value).startswith('=SUMIFS('), 'Resumo com fórmulas vivas')

print('5) LibreOffice re-salva a planilha (sharedStrings, outros estilos) e o sistema lê/grava de novo')
lo = os.path.join(OUT, 'lo')
shutil.rmtree(lo, ignore_errors=True)
os.makedirs(lo)
subprocess.run(['soffice', '--headless', '--convert-to', 'xlsx', '--outdir', lo, c], capture_output=True, timeout=180)
dlo = os.path.join(lo, os.path.basename(c))
checar(os.path.exists(dlo), 'LibreOffice abriu e salvou')
d2 = ler(dlo)
n_c = ler(c)['tabs']['boletos']['n']
checar(d2['tabs']['boletos']['n'] == n_c, f'mesmo número de boletos depois do LibreOffice ({d2["tabs"]["boletos"]["n"]} = {n_c})')
e = os.path.join(OUT, 'e-depois-do-libreoffice.xlsx')
node('gravar', dlo, e, 'de novo')
we = openpyxl.load_workbook(e)
checar('Minhas notas' in we.sheetnames and 'Dias em atraso' in cabecalho(we['Boletos']), 'abas e colunas do time sobrevivem ao LibreOffice + sistema')

print('6) PDF pelo LibreOffice (para olhar)')
subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', OUT, c], capture_output=True, timeout=180)
pdf = c[:-5] + '.pdf'
checar(os.path.exists(pdf), 'PDF gerado')
subprocess.run(['pdftoppm', '-r', '60', '-png', '-f', '1', '-l', '3', pdf, os.path.join(OUT, 'pagina')], capture_output=True)

print('7) migração V1 -> V2 (com "2/5" virado em data pelo Excel)')
v1 = os.path.join(OUT, 'v1.xlsx')
node('v1', v1, '25')
w1 = openpyxl.load_workbook(v1)
s1 = w1['Boletos']
H1 = cabecalho(s1)
s1.cell(2, H1['Parcela']).value = datetime.datetime(2026, 5, 2)    # o Excel transformou "2/5" em 02/mai
s1.cell(2, H1['Parcela']).number_format = 'd/m'
w1.save(v1)
dv1 = ler(v1)
checar(dv1['esquema'] == 1, 'planilha da V1 reconhecida como esquema 1')
checar(any(l['parcela'] == '2/5' for l in dv1['tabs']['boletos']['linhas']), '"2/5" convertido em data pelo Excel volta a ser 2/5')
v2 = os.path.join(OUT, 'v1-migrada.xlsx')
node('gravar', v1, v2)
dv2 = ler(v2)
checar(dv2['esquema'] == 2 and dv2['tabs']['boletos']['n'] == dv1['tabs']['boletos']['n'], 'migrada para V2 sem perder linhas')
checar(dv2['tabs']['clientes']['n'] > 0, 'cadastro de clientes criado na migração')
w2 = openpyxl.load_workbook(v2)
checar(all(n in w2.sheetnames for n in ('Boletos', 'Resumo', 'Clientes', 'Pagamentos', 'Contatos', 'Histórico', 'Config', '_Sistema')), 'abas da V2 criadas')
checar([c.value for c in w2['Boletos'][1]][:14] == ['Vencimento', 'Status', 'Valor', 'Parcela', 'Setor', 'PDV', 'Cliente', 'CNPJ/CPF', 'Nº documento', 'Observação', 'Pago em', 'ID', 'Lançamento', 'Cadastrado em'], 'colunas da V1 mantidas na mesma ordem')

print()
print('RESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S)')
sys.exit(1 if falhas else 0)
