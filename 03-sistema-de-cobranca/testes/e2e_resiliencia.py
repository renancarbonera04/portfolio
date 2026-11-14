#!/usr/bin/env python3
"""RESILIÊNCIA (file://, janelas nativas): a tela nunca trava e nada se perde.
 R1 JavaScript desligado          R2 JavaScript quebrado (erro no código)
 R3 IndexedDB e leitura de arquivo "pendurados" (nunca respondem)
 R4 planilha some (rede/renomeada) e volta     R5 planilha corrompida -> regravar a última boa
 R6 planilha com senha/rótulo (OLE)            R7 F5 no meio de uma gravação
 R8 "Não permitir" na pergunta do navegador    R9 pasta sem permissão de gravação
"""
import os, sys, time, shutil, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdialogo as X
import openpyxl
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get('E2E_RAIZ', '/tmp/e2e-boletos-res')
PASTA = os.path.join(RAIZ, 'rede', '00. Bases')
XLSX = os.path.join(PASTA, 'Boletos a cobrar.xlsx')
HTML = os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html')
OUT = os.path.join(AQUI, 'saida', 'e2e-resiliencia')
falhas = []

def ok(c, msg):
    print(('  ok    ' if c else '  FALHA ') + msg, flush=True)
    if not c: falhas.append(msg)

def n_linhas():
    wb = openpyxl.load_workbook(XLSX); ws = wb['Boletos']; cab = [c.value for c in ws[1]]
    return sum(1 for r in ws.iter_rows(min_row=2) if r[cab.index('ID')].value is not None)

def navegador(p, perfil, init=None, js=True):
    ctx = p.chromium.launch_persistent_context(os.path.join(RAIZ, perfil), headless=False, executable_path=X.CHROME, locale='pt-BR', java_script_enabled=js,
        args=['--no-sandbox', '--window-size=1300,860'], viewport={'width': 1280, 'height': 780})
    ctx.add_init_script("try{if(!localStorage.getItem('bc2.usuario'))localStorage.setItem('bc2.usuario','Rita')}catch(e){}")
    if init: ctx.add_init_script(init)
    pg = ctx.pages[0]; pg.erros = []
    pg.on('pageerror', lambda e: pg.erros.append(str(e)))
    pg.on('framenavigated', lambda f: print('     (navegou: %s)' % f.url[-40:], flush=True))
    return ctx, pg

def conectar_pasta(pg, url):
    pg.goto(url)
    pg.click('[data-ini="pasta"]')
    X.escolher_pasta(PASTA); X.permitir()
    pg.wait_for_function('A.podeGravar && S.vista && S.vista.tabs.boletos.linhas.length > 0', timeout=30000)

def main():
    shutil.rmtree(RAIZ, ignore_errors=True); os.makedirs(PASTA); os.makedirs(OUT, exist_ok=True)
    shutil.copy(HTML, PASTA)
    subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'exemplo', XLSX, '30'], check=True, capture_output=True)
    url = 'file://' + os.path.join(PASTA, 'Boletos-a-cobrar-v2.html')
    n0 = n_linhas()
    X.iniciar_tela()
    with sync_playwright() as p:
        print('R1) JavaScript desligado')
        ctx, pg = navegador(p, 'perfil-semjs', js=False)
        pg.goto(url); time.sleep(1)
        txt = pg.inner_text('body')
        ok('JavaScript está desligado' in txt and pg.is_visible('#semJs'), 'mostra o aviso "JavaScript está desligado" com o que fazer')
        pg.screenshot(path=f'{OUT}/R1-sem-js.png'); ctx.close()

        print('R2) erro no código: aviso visível, sem tela parada')
        quebrado = os.path.join(RAIZ, 'quebrado.html')
        t = open(HTML, encoding='utf-8').read().replace('/*</NUCLEO>*/', '/*</NUCLEO>*/\nnaoExiste.chamar();\n', 1)
        open(quebrado, 'w', encoding='utf-8').write(t)
        ctx, pg = navegador(p, 'perfil-quebrado')
        pg.goto('file://' + quebrado); time.sleep(5)
        ok(pg.is_visible('#erroFatal') and 'naoExiste' in pg.inner_text('#erroFatalTxt'), 'caixa "Algo deu errado" com o erro')
        ok('não terminou de carregar' in pg.inner_text('#erroFatalTxt'), 'vigia avisa que o código não terminou de carregar')
        pg.screenshot(path=f'{OUT}/R2-quebrado.png'); ctx.close()

        print('R3) armazenamento e leitura que nunca respondem')
        trava_idb = "(()=>{const o=indexedDB.open.bind(indexedDB); indexedDB.open=function(){return {set onupgradeneeded(f){}, set onsuccess(f){}, set onerror(f){}, set onblocked(f){}}};})();"
        ctx, pg = navegador(p, 'perfil-trava', init=trava_idb)
        t0 = time.time(); pg.goto(url)
        pg.wait_for_selector('#p-inicio.ativo [data-ini="pasta"]', timeout=12000)
        ok(time.time() - t0 < 12, f'IndexedDB pendurado: tela inicial utilizável em {time.time() - t0:.1f} s')
        ctx.close()
        ctx, pg = navegador(p, 'perfil-trava2')
        conectar_pasta(pg, url)
        pg.evaluate("FileSystemFileHandle.prototype.getFile = function(){ return new Promise(()=>{}); }; 0")
        pg.evaluate("executar('teste trava', opsEditar(S.vista, 1, {obs:'durante a trava'}, novoCtx(USUARIO())))")
        pg.wait_for_function("S.erro && S.erro.tipo === 'tempo'", timeout=40000)
        ok(True, 'leitura pendurada vira aviso "a pasta da rede está demorando" (tempo limite)')
        ok(pg.evaluate('nPend()') == 1, 'a alteração continua guardada')
        ok(pg.is_enabled('.aba[data-aba="boletos"]'), 'a tela continua respondendo')
        pg.screenshot(path=f'{OUT}/R3-trava.png')
        pg.reload()
        pg.wait_for_function('A.podeGravar && S.pend.length === 0 && !S.gravando', timeout=30000)
        gravou = 'durante a trava' in json.dumps(json.loads(subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'ler', XLSX], capture_output=True, text=True).stdout)['tabs']['boletos']['linhas'], ensure_ascii=False)
        ok(gravou, 'depois do F5 a pendência foi gravada')
        if not gravou: print(pg.evaluate("DIAG.slice(-25).map(d=>d.h+' '+d.tipo+' '+d.msg).join('\\n')"))

        print('R4) planilha some e volta')
        os.rename(XLSX, XLSX + '.sumiu')
        pg.evaluate("naFila(()=>releitura(true))")
        pg.wait_for_function("S.erro && S.erro.tipo === 'sumiu'", timeout=20000)
        msg = pg.evaluate("S.erro.msg") + ' ' + pg.inner_text('#faixas')
        ok('Não achei' in msg, 'avisa que não achou a planilha (%s)' % pg.evaluate("S.erro.msg")[:90])
        pg.evaluate("executar('enquanto sumida', opsEditar(S.vista, 2, {obs:'gravado quando voltou'}, novoCtx(USUARIO())))")
        time.sleep(2)
        os.rename(XLSX + '.sumiu', XLSX)
        pg.evaluate("S.tentativa=0; agendarGravacao(0)")
        pg.wait_for_function('S.pend.length === 0 && !S.erro', timeout=40000)
        ok(n_linhas() == n0, 'voltou e gravou sem perder linhas')

        print('R5) planilha corrompida: não grava por cima; oferece regravar a última boa')
        open(XLSX, 'wb').write(b'PK\x03\x04' + os.urandom(3000))
        pg.evaluate("naFila(()=>releitura(true))")
        pg.wait_for_function('S.ilegivelDesde > 0', timeout=20000)
        ok(open(XLSX, 'rb').read(4) == b'PK\x03\x04' and os.path.getsize(XLSX) == 3004, 'o arquivo corrompido não foi sobrescrito sozinho')
        pg.evaluate('S.ilegivelDesde = Date.now() - 60000; renderFaixas()')
        pg.wait_for_selector('[data-acao="regravarBoa"]', timeout=5000)
        pg.screenshot(path=f'{OUT}/R5-corrompida.png')
        pg.click('[data-acao="regravarBoa"]'); pg.click('.modal [data-r="1"]')
        try: pg.wait_for_function('S.ilegivelDesde === 0', timeout=60000)
        except Exception:
            print(pg.evaluate("JSON.stringify({il:S.ilegivelDesde, erro:S.erro&&S.erro.msg, grav:S.gravando, pend:S.pend.length})"))
            print(pg.evaluate("DIAG.slice(-20).map(d=>d.h+' '+d.tipo+' '+d.msg).join('\\n')")); raise
        ok(n_linhas() == n0, f'regravada com a última versão boa ({n_linhas()} linhas)')

        print('R6) planilha com senha/rótulo (OLE)')
        guard = open(XLSX, 'rb').read()
        open(XLSX, 'wb').write(bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) + b'\0' * 2000)
        pg.evaluate("naFila(()=>releitura(true))")
        pg.wait_for_function("S.erro && S.erro.tipo === 'protegida'", timeout=20000)
        ok('SEM senha e SEM rótulo' in pg.inner_text('#faixas'), 'mensagem simples: a planilha precisa ficar SEM senha e SEM rótulo')
        pg.screenshot(path=f'{OUT}/R6-senha.png')
        open(XLSX, 'wb').write(guard)
        pg.evaluate("S.erro=null; naFila(()=>releitura(true))")
        time.sleep(2)

        print('R7) F5 no meio de uma gravação')
        pg.evaluate("window.__teste={atrasoGravacao: 5000}; executar('no meio', opsEditar(S.vista, 3, {obs:'sobreviveu ao F5'}, novoCtx(USUARIO())))")
        pg.wait_for_function('S.gravando', timeout=5000)
        pg.reload()
        pg.wait_for_function('A.podeGravar && S.vista && S.pend.length === 0', timeout=30000)
        d = json.loads(subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'ler', XLSX], capture_output=True, text=True).stdout)
        ok(any(b.get('obs') == 'sobreviveu ao F5' for b in d['tabs']['boletos']['linhas']), 'a alteração feita antes do F5 foi gravada depois')
        ok(n_linhas() == n0, 'sem perder linhas')
        ok(not any(f.endswith('.crswap') for f in os.listdir(PASTA)), 'sem .crswap sobrando')

        print('R9) pasta sem permissão de gravação')
        subprocess.run(['chattr', '+i', PASTA], check=True)
        try:
            pg.evaluate("executar('sem permissao', opsEditar(S.vista, 4, {obs:'gravado depois'}, novoCtx(USUARIO())))")
            pg.wait_for_function("S.erro && S.tentativa >= 1", timeout=20000)
            ok(pg.evaluate('nPend()') == 1, 'falhou sem perder a alteração')
        finally:
            subprocess.run(['chattr', '-i', PASTA], check=True)
        pg.evaluate("S.tentativa=0; agendarGravacao(0)")
        pg.wait_for_function('S.pend.length === 0 && !S.erro', timeout=40000)
        ok(True, 'gravou sozinho quando a pasta voltou a permitir')
        ok(not pg.erros, f'sem erros de JavaScript {pg.erros[:2]}')
        ctx.close()

        print('R8) "Não permitir" na pergunta do navegador')
        ctx, pg = navegador(p, 'perfil-trava2')
        pg.goto(url)
        pg.wait_for_selector('[data-acao="liberar"]', timeout=15000)
        pg.click('[data-acao="liberar"]'); time.sleep(1.2)
        X.focar(X.janela_chromium()); X.tecla('Return'); time.sleep(1)     # foco padrão = "Não permitir"
        pg.wait_for_function('!A.podeGravar', timeout=5000)
        time.sleep(1)
        ok(pg.is_visible('[data-acao="liberar"]'), 'continua mostrando o botão Liberar, sem travar')
        ok(any('Clique de novo' in t for t in pg.eval_on_selector_all('.toast span', 'l => l.map(x => x.textContent)')), 'explica que é só clicar de novo')
        pg.screenshot(path=f'{OUT}/R8-negado.png')
        ctx.close()
    X.parar_tela()
    print('\nRESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S): {falhas}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
