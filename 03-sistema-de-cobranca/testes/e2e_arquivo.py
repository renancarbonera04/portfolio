#!/usr/bin/env python3
"""E2E do modo ARQUIVO (o caminho que comprovadamente funciona em file:// no Windows):
abrir a planilha (leitura) e liberar a gravação escolhendo o MESMO arquivo em "Salvar como"
e confirmando "Substituir". Simula o PC em que requestPermission() dá SecurityError
(marca rpFalha/dirFalha antes de abrir). Confere que:
  - antes de liberar, a tela já mostra os dados atuais e se atualiza sozinha;
  - mudanças de outra pessoa feitas antes de liberar NÃO se perdem (o Chrome esvazia o arquivo
    em "Substituir"; o sistema relê e prepara tudo antes);
  - pendências feitas antes de liberar são gravadas junto;
  - depois do F5: abrir + substituir de novo, e nada se perde.
"""
import os, sys, time, shutil, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdialogo as X
import openpyxl
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get('E2E_RAIZ', '/tmp/e2e-boletos-arq')
PASTA = os.path.join(RAIZ, 'rede', '3. FINANCEIRO', '00. Bases')
XLSX = os.path.join(PASTA, 'Boletos a cobrar.xlsx')
OUT = os.path.join(AQUI, 'saida', 'e2e-arquivo')
falhas = []

def ok(c, msg):
    print(('  ok    ' if c else '  FALHA ') + msg, flush=True)
    if not c: falhas.append(msg)

def linhas():
    wb = openpyxl.load_workbook(XLSX); ws = wb['Boletos']; cab = [c.value for c in ws[1]]
    return wb, ws, cab, [dict(zip(cab, [c.value for c in r])) for r in ws.iter_rows(min_row=2) if r[cab.index('ID')].value is not None]

def editar_no_excel(id_, campo, valor):
    wb, ws, cab, _ = linhas()
    for r in ws.iter_rows(min_row=2):
        if r[cab.index('ID')].value == id_: r[cab.index(campo)].value = valor
    wb.save(XLSX)

def main():
    shutil.rmtree(RAIZ, ignore_errors=True); os.makedirs(PASTA); os.makedirs(OUT, exist_ok=True)
    shutil.copy(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'), PASTA)
    subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'exemplo', XLSX, '25'], check=True, capture_output=True)
    n0 = len(linhas()[3])
    url = 'file://' + os.path.join(PASTA, 'Boletos-a-cobrar-v2.html')
    X.iniciar_tela()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(os.path.join(RAIZ, 'perfil-joao'), headless=False, executable_path=X.CHROME, locale='pt-BR',
            args=['--no-sandbox', '--window-size=1400,900'], viewport={'width': 1380, 'height': 820})
        ctx.add_init_script("try{localStorage.setItem('bc2.flags', JSON.stringify({rpFalha:true, dirFalha:true})); if(!localStorage.getItem('bc2.usuario')) localStorage.setItem('bc2.usuario','João');}catch(e){}")
        pg = ctx.pages[0]; erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        pg.goto(url)
        print('1) abrir a planilha (só leitura)')
        pg.click('[data-ini="arquivo"]')
        X.abrir_arquivo(XLSX)
        pg.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length > 0', timeout=20000)
        ok(pg.evaluate('A.podeLer && !A.podeGravar'), 'abriu só para leitura')
        ok(pg.query_selector('[data-acao="liberar"]') is not None, 'mostra o botão "Liberar a gravação"')
        ok(pg.evaluate('S.vista.tabs.boletos.linhas.length') == n0, f'mostra os {n0} boletos da planilha')
        pg.screenshot(path=f'{OUT}/1-leitura.png')

        print('2) outra pessoa muda a planilha; a tela atualiza sozinha (mesmo sem gravação)')
        editar_no_excel(2, 'Observação', 'mudança de outra pessoa')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.find(b=>b.id===2).obs === 'mudança de outra pessoa'", timeout=15000)
        ok(True, 'mudança externa apareceu')
        pg.evaluate("executar('pendente', opsEditar(S.vista, 3, {obs: 'feito pelo João antes de liberar'}, novoCtx(USUARIO())))")
        ok(pg.evaluate('nPend()') == 1, 'alteração ficou pendente (1)')
        editar_no_excel(4, 'Observação', 'outra mudança logo antes de liberar')
        time.sleep(0.3)

        print('3) Liberar a gravação: "Salvar como" no mesmo arquivo + Substituir')
        pg.click('[data-acao="liberar"]')
        X.salvar_como(XLSX, substituir=True)
        pg.wait_for_function('A.podeGravar && S.pend.length === 0', timeout=20000)
        _, _, _, l = linhas()
        por = {x['ID']: x for x in l}
        ok(len(l) == n0, f'nenhuma linha perdida ({len(l)} = {n0})')
        ok(por[2]['Observação'] == 'mudança de outra pessoa', 'mudança de outra pessoa preservada')
        ok(por[4]['Observação'] == 'outra mudança logo antes de liberar', 'mudança feita segundos antes de liberar preservada (releitura antes de substituir)')
        ok(por[3]['Observação'] == 'feito pelo João antes de liberar', 'pendência gravada junto')
        ok(not any(f.endswith('.crswap') for f in os.listdir(PASTA)), 'sem arquivo temporário .crswap sobrando')

        print('4) depois de liberado, grava direto, sem perguntas')
        pg.evaluate("executar('x', opsEditar(S.vista, 5, {responsavel: 'João'}, novoCtx(USUARIO())))")
        pg.wait_for_function('S.pend.length === 0', timeout=10000)
        ok(next(x for x in linhas()[3] if x['ID'] == 5)['Responsável'] == 'João', 'gravou sem nova pergunta')

        print('5) F5: abrir + substituir de novo')
        pg.reload()
        pg.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length > 0', timeout=15000)
        ok(pg.evaluate('!A.podeGravar'), 'depois do F5 precisa liberar de novo (comportamento do Chrome com "Substituir")')
        pg.evaluate("executar('y', opsEditar(S.vista, 6, {obs: 'feito depois do F5'}, novoCtx(USUARIO())))")
        pg.click('[data-acao="liberar"]')
        X.abrir_arquivo(XLSX)
        pg.wait_for_function('A.podeLer', timeout=15000)
        pg.wait_for_selector('[data-acao="liberar"]', timeout=8000)
        pg.screenshot(path=f'{OUT}/5-segundo-passo.png')
        pg.click('[data-acao="liberar"]')
        X.salvar_como(XLSX, substituir=True)
        pg.wait_for_function('A.podeGravar && S.pend.length === 0', timeout=20000)
        _, _, _, l = linhas()
        por = {x['ID']: x for x in l}
        ok(len(l) == n0 and por[6]['Observação'] == 'feito depois do F5' and por[5]['Responsável'] == 'João', 'tudo gravado e nada perdido depois do F5')
        ok(pg.evaluate("S.vista.tabs.historico.linhas.filter(h=>h.usuario==='João').length") >= 3, 'histórico registra as ações do João')
        ok(not erros, 'sem erros de JavaScript %s' % erros[:2])
        ctx.close()
    X.parar_tela()
    print('\nRESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S): {falhas}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
