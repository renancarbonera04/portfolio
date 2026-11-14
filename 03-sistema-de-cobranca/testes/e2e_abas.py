#!/usr/bin/env python3
"""DUAS ABAS no mesmo navegador (headless, modo "guardar neste navegador"):
as pendências de uma aba não apagam as da outra; ao fechar uma aba com alterações
pendentes, a outra (ou a próxima que abrir) as recupera e grava; aviso de aba repetida."""
import os, sys, time, base64, subprocess, json
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__))
HTML = 'file://' + os.path.abspath(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'))
OUT = os.path.join(AQUI, 'saida'); os.makedirs(OUT, exist_ok=True)
EX = os.path.join(OUT, 'abas.xlsx')
subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'exemplo', EX, '20'], check=True, capture_output=True)
B64 = base64.b64encode(open(EX, 'rb').read()).decode()
falhas = []
def ok(c, msg):
    print(('  ok    ' if c else '  FALHA ') + msg, flush=True)
    if not c: falhas.append(msg)
REG = "(async () => ({ abas: Object.fromEntries(Object.entries((await entradasPend()).out).map(([k, x]) => [k, x.e])) }))()"
OBS = "(id => S.vista.tabs.boletos.linhas.find(b => b.id === id).obs)"

with sync_playwright() as p:
    import shutil, tempfile
    perfil = tempfile.mkdtemp(prefix='abas-')         # perfil gravado em disco, como o navegador de verdade
    ctx = p.chromium.launch_persistent_context(perfil, headless=True, locale='pt-BR')
    b = ctx
    ctx.add_init_script("try{if(!localStorage.getItem('bc2.usuario')){localStorage.setItem('bc2.usuario','Ana'); localStorage.setItem('bc2.navAvisado','1')}}catch(e){}; window.__teste = {vidaMs: 1500}")
    erros = []
    a = ctx.pages[0] if ctx.pages else ctx.new_page(); a.on('pageerror', lambda e: erros.append(str(e)))
    a.goto(HTML)
    a.evaluate("async b64 => { const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await iniciarNavegador(u8); }", B64)
    a.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length > 5')
    bb = ctx.new_page(); bb.on('pageerror', lambda e: erros.append(str(e)))
    bb.goto(HTML)
    bb.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length > 5', timeout=15000)
    time.sleep(0.8)
    avisos = a.eval_on_selector_all('.toast span', 'l => l.map(x => x.textContent)') + bb.eval_on_selector_all('.toast span', 'l => l.map(x => x.textContent)')
    ok(any('outra aba' in t for t in avisos), 'avisa que o sistema está aberto em outra aba')
    ids = a.evaluate("S.vista.tabs.boletos.linhas.filter(b => !b.excluidoEm).slice(0, 3).map(b => b.id)")
    print('1) as duas abas com alterações pendentes (gravação falhando)')
    for pg in (a, bb): pg.evaluate("window.__teste.falharGravacao = 'NoModificationAllowedError'; 0")
    a.evaluate(f"executar('A', opsEditar(S.vista, {ids[0]}, {{obs: 'feito na aba A'}}, novoCtx(USUARIO())))")
    bb.evaluate(f"executar('B', opsEditar(S.vista, {ids[1]}, {{obs: 'feito na aba B'}}, novoCtx(USUARIO())))")
    a.wait_for_function('S.erro && S.pend.length > 0', timeout=10000); bb.wait_for_function('S.erro && S.pend.length > 0', timeout=10000)
    time.sleep(1)
    ra, rb = a.evaluate(REG)['abas'], bb.evaluate(REG)['abas']
    ida, idb = a.evaluate('ABA_ID'), bb.evaluate('ABA_ID')
    ok(ida != idb and ida in ra and idb in rb and ida in rb and idb in ra and 'feito na aba A' in json.dumps(ra[ida], ensure_ascii=False) and 'feito na aba B' in json.dumps(rb[idb], ensure_ascii=False),
       'cada aba guarda as suas pendências numa chave própria, e uma vê as da outra')
    print('2) F5 na aba B: recupera só as dela')
    bb.reload(); bb.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length > 5', timeout=15000)
    ok(bb.evaluate(f"{OBS}({ids[1]})") == 'feito na aba B' and bb.evaluate(f"{OBS}({ids[0]})") != 'feito na aba A', 'depois do F5 a aba B tem a alteração dela (e não a da A, que continua aberta)')
    bb.evaluate("window.__teste.falharGravacao = 'NoModificationAllowedError'; 0")
    print('3) fechar a aba A com alteração pendente: a próxima aba que abrir recupera e grava')
    a.close()
    time.sleep(2.5)
    bb.evaluate('gravarMinha(); 0')            # a aba B está viva (sinal de vida agora)
    c = ctx.new_page(); c.on('pageerror', lambda e: erros.append(str(e)))
    c.add_init_script("window.__teste.orfaMs = 1800")
    c.goto(HTML)
    c.wait_for_function(f"S.pend.length === 0 && !S.gravando && S.base && S.base.tabs.boletos.linhas.find(b => b.id === {ids[0]}).obs === 'feito na aba A'", timeout=30000)
    ok(True, 'a aba nova recuperou e gravou a pendência da aba A (fechada)')
    ok(bb.evaluate('S.pend.length') > 0, 'a aba B (aberta) continua com a pendência dela')
    c.close()
    bb.evaluate("window.__teste.falharGravacao = null; S.tentativa = 0; agendarGravacao(0); 0")
    bb.wait_for_function('S.pend.length === 0 && !S.gravando', timeout=30000)
    gravado = bb.evaluate(f"(async () => {{ const r = await lerRemoto(true); return [{ids[0]}, {ids[1]}].map(i => r.doc.tabs.boletos.linhas.find(b => b.id === i).obs); }})()")
    ok(gravado == ['feito na aba A', 'feito na aba B'], f'as duas alterações foram gravadas ({gravado})')
    ok(all(not e['ops'] for e in bb.evaluate(REG)['abas'].values()), 'nada pendente sobrando')
    print('4) aba fechada com pendência e nenhuma outra aberta: a próxima que abrir recupera')
    bb.evaluate("window.__teste.falharGravacao = 'NoModificationAllowedError'; 0")
    bb.evaluate(f"executar('C', opsEditar(S.vista, {ids[2]}, {{obs: 'aba fechada'}}, novoCtx(USUARIO())))")
    bb.wait_for_function('S.erro && S.pend.length > 0', timeout=10000)
    bb.close()
    c = ctx.new_page(); c.on('pageerror', lambda e: erros.append(str(e)))
    c.add_init_script("window.__teste.orfaMs = 1")
    c.goto(HTML)
    c.wait_for_function(f"S.pend.length === 0 && !S.gravando && S.base && S.base.tabs.boletos.linhas.find(b => b.id === {ids[2]}).obs === 'aba fechada'", timeout=30000)
    ok(True, 'a próxima aba recuperou e gravou a pendência da aba fechada')
    ok(not erros, f'sem erros de JavaScript {erros[:2]}')
    b.close()
print('\nRESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S): {falhas}')
sys.exit(1 if falhas else 0)
