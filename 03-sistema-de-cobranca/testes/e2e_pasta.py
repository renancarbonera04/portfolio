#!/usr/bin/env python3
"""E2E principal: o sistema aberto por file:// (como no dia a dia), com as janelas NATIVAS do
Chromium dirigidas por xdotool. Modo PASTA (o recomendado):
  1. primeira vez: nome -> escolher a pasta -> "Permitir editar" -> criar a planilha
  2. lançar pelo teclado; conferir o .xlsx no disco com openpyxl
  3. F5: continua liberado (a permissão da pasta vale até fechar o navegador)
  4. fechar e abrir o navegador: mostra a cópia local + botão "Liberar a planilha" -> Permitir
  5. edição feita "no Excel" (openpyxl) aparece sozinha na tela; backup e presença na pasta
Uso: python3 testes/e2e_pasta.py   (precisa de Xvfb, openbox, xdotool, Chromium do Playwright)
"""
import os, sys, time, shutil, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdialogo as X
import openpyxl
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get('E2E_RAIZ', '/tmp/e2e-boletos')
PASTA = os.path.join(RAIZ, 'servidor', '3. FINANCEIRO', '00. Bases')
OUT = os.path.join(AQUI, 'saida', 'e2e-pasta')
falhas = []

def ok(c, msg):
    print(('  ok    ' if c else '  FALHA ') + msg, flush=True)
    if not c: falhas.append(msg)

def preparar():
    shutil.rmtree(RAIZ, ignore_errors=True)
    os.makedirs(PASTA)
    os.makedirs(OUT, exist_ok=True)
    shutil.copy(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'), PASTA)
    return 'file://' + os.path.join(PASTA, 'Boletos-a-cobrar-v2.html')

def abrir(p, perfil, url, locale='pt-BR'):
    ctx = p.chromium.launch_persistent_context(perfil, headless=False, executable_path=X.CHROME, locale=locale,
        args=['--no-sandbox', '--window-size=1400,900', '--no-first-run'], viewport={'width': 1380, 'height': 820})
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.erros = []
    pg.on('pageerror', lambda e: pg.erros.append(str(e)))
    pg.goto(url)
    return ctx, pg

def ler_xlsx(caminho):
    wb = openpyxl.load_workbook(caminho)
    ws = wb['Boletos']
    cab = [c.value for c in ws[1]]
    linhas = [dict(zip(cab, [c.value for c in r])) for r in ws.iter_rows(min_row=2) if r[cab.index('ID')].value is not None]
    return wb, linhas

def lancar(pg, setor, pdv, doc, cliente, valor, venc, qtd=1):
    pg.keyboard.press('n'); time.sleep(0.2)
    pg.fill('#setor', setor); pg.fill('#pdv', pdv); pg.fill('#doc', doc); pg.fill('#cliente', cliente)
    pg.fill('#qtd', str(qtd)); pg.fill('#venc1', venc); pg.fill('#valor', valor)
    pg.focus('#valor'); pg.keyboard.press('Control+Enter')

def main():
    url = preparar()
    X.iniciar_tela()
    xlsx = os.path.join(PASTA, 'Boletos a cobrar.xlsx')
    perfil = os.path.join(RAIZ, 'perfil-ana')
    with sync_playwright() as p:
        print('1) primeira vez: escolher a pasta e criar a planilha')
        ctx, pg = abrir(p, perfil, url)
        pg.fill('#jNome', 'Ana'); pg.keyboard.press('Enter')
        pg.click('[data-ini="pasta"]')
        X.escolher_pasta(PASTA)
        X.permitir()
        pg.wait_for_selector('#jTexto', timeout=15000)          # pasta vazia: pergunta o nome da planilha
        pg.keyboard.press('Enter')
        pg.wait_for_selector('#p-hoje.ativo', timeout=20000)
        ok(os.path.exists(xlsx), 'planilha criada na pasta da rede')
        ok(pg.evaluate('A.modo') == 'pasta' and pg.evaluate('A.podeGravar'), 'modo pasta com gravação liberada')
        X.foto(f'{OUT}/1-criada.png')

        print('2) lançar pelo teclado e conferir no disco')
        lancar(pg, 'Varejo', '5001', '11.222.333/0001-81', 'Mercado Rede', '900,00', '2026-11-10', qtd=3)
        pg.wait_for_function('S.pend.length === 0 && S.vista.tabs.boletos.linhas.length === 3', timeout=15000)
        _, linhas = ler_xlsx(xlsx)
        ok(len(linhas) == 3 and all(l['Cadastrado por'] == 'Ana' for l in linhas), 'as 3 parcelas estão no .xlsx, com "Cadastrado por"')
        ok(pg.inner_text('#salvoTxt').startswith('Salvo às'), 'indicador mostra "Salvo às ..."')

        print('3) F5 continua liberado, sem pergunta')
        pg.reload()
        pg.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length === 3 && A.podeGravar', timeout=15000)
        ok(not pg.query_selector('[data-acao="liberar"]'), 'depois do F5 não pede para liberar de novo')
        pg.evaluate("executar('teste', opsEditar(S.vista, 1, {obs: 'depois do F5'}, novoCtx(USUARIO())))")
        pg.wait_for_function('S.pend.length === 0', timeout=10000)
        _, linhas = ler_xlsx(xlsx)
        ok(any(l['Observação'] == 'depois do F5' for l in linhas), 'gravou depois do F5')
        ok(any(f.startswith('presenca - Ana') for f in os.listdir(os.path.join(PASTA, '_sistema'))), 'arquivo de presença criado em _sistema/')
        ok(os.path.isdir(os.path.join(PASTA, 'backup')) and len(os.listdir(os.path.join(PASTA, 'backup'))) >= 1, 'backup automático na subpasta backup/')
        ok(not pg.erros, 'sem erros de JavaScript (%s)' % pg.erros[:2])
        ctx.close()

        print('4) fechar e abrir o navegador: cópia local na hora + "Liberar a planilha"')
        t0 = time.time()
        ctx, pg = abrir(p, perfil, url)
        pg.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length === 3', timeout=10000)
        ok(time.time() - t0 < 10, 'tela com dados em menos de 10 s (%.1f s)' % (time.time() - t0))
        btn = pg.wait_for_selector('[data-acao="liberar"]', timeout=8000)
        ok(btn is not None, 'mostra o botão grande "Liberar a planilha"')
        X.foto(f'{OUT}/4-liberar.png')
        # alteração feita antes de liberar fica pendente e é gravada depois
        pg.evaluate("executar('antes de liberar', opsEditar(S.vista, 2, {obs: 'feito antes de liberar'}, novoCtx(USUARIO())))")
        ok(pg.evaluate('S.pend.length') >= 1, 'alteração antes de liberar fica pendente')
        pg.click('[data-acao="liberar"]')
        time.sleep(1.2)
        X.foto(f'{OUT}/4-prompt.png')
        X.permitir()
        pg.wait_for_function('A.podeGravar && S.pend.length === 0', timeout=20000)
        _, linhas = ler_xlsx(xlsx)
        ok(any(l['Observação'] == 'feito antes de liberar' for l in linhas), 'pendência gravada logo depois de liberar')

        print('5) edição feita no Excel aparece sozinha')
        wb = openpyxl.load_workbook(xlsx)
        ws = wb['Boletos']; cab = [c.value for c in ws[1]]
        for r in ws.iter_rows(min_row=2):
            if r[cab.index('ID')].value == 3:
                r[cab.index('Valor')].value = 1234.56
                r[cab.index('Observação')].value = 'mudado no Excel'
        n_antes = sum(1 for r in ws.iter_rows(min_row=2) if r[cab.index('ID')].value is not None)
        wb.save(xlsx)
        pg.wait_for_function("S.vista.tabs.boletos.linhas.find(b=>b.id===3).valor === 1234.56", timeout=15000)
        ok(True, 'mudança do Excel apareceu na tela sem recarregar')
        pg.evaluate("executar('x', opsEditar(S.vista, 3, {responsavel: 'Ana'}, novoCtx(USUARIO())))")
        pg.wait_for_function('S.pend.length === 0', timeout=10000)
        _, linhas = ler_xlsx(xlsx)
        l3 = [l for l in linhas if l['ID'] == 3][0]
        ok(l3['Valor'] == 1234.56 and l3['Observação'] == 'mudado no Excel' and l3['Responsável'] == 'Ana', f"gravação seguinte manteve a edição do Excel ({l3['Valor']}, {l3['Observação']}, {l3['Responsável']})")
        ok(len(linhas) == n_antes and len({l['ID'] for l in linhas}) == len(linhas), f'sem linhas duplicadas depois da edição no Excel ({len(linhas)} de {n_antes})')
        if falhas: print(pg.evaluate("DIAG.slice(-25).map(d=>d.h+' '+d.tipo+' '+d.msg).join('\\n')"))
        ok(not pg.erros, 'sem erros de JavaScript (%s)' % pg.erros[:2])
        X.foto(f'{OUT}/5-final.png')
        ctx.close()
    X.parar_tela()
    print('\nRESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S): {falhas}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
