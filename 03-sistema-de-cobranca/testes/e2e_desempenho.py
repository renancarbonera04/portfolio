#!/usr/bin/env python3
"""DESEMPENHO com 10 mil boletos (file://, modo pasta, janelas nativas):
abrir, gravar uma alteração, filtrar/buscar, rolar a lista; mede também as "tarefas longas"
(tempo em que a tela fica sem responder) durante a gravação."""
import os, sys, time, shutil, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdialogo as X
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = '/tmp/e2e-boletos-perf'
PASTA = os.path.join(RAIZ, 'rede', '00. Bases')
XLSX = os.path.join(PASTA, 'Boletos a cobrar.xlsx')
N = int(os.environ.get('N_BOLETOS', '10000'))
falhas = []
def ok(c, msg):
    print(('  ok    ' if c else '  FALHA ') + msg, flush=True)
    if not c: falhas.append(msg)

def main():
    shutil.rmtree(RAIZ, ignore_errors=True); os.makedirs(PASTA)
    shutil.copy(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'), PASTA)
    info = json.loads(subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'grande', XLSX, str(N)], capture_output=True, text=True, check=True).stdout)
    print(f'planilha: {info["boletos"]} boletos, {info["kb"]} KB (Node: gerar {info["gerarMs"]} ms, ler {info["lerMs"]} ms)')
    X.iniciar_tela()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(os.path.join(RAIZ, 'perfil'), headless=False, executable_path=X.CHROME, locale='pt-BR', args=['--no-sandbox', '--window-size=1400,900'], viewport={'width': 1380, 'height': 820})
        ctx.add_init_script("try{localStorage.setItem('bc2.usuario','Perf')}catch(e){}; window.__longas=[]; try{new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__longas.push(Math.round(e.duration))}).observe({type:'longtask', buffered:true})}catch(e){}")
        pg = ctx.pages[0]; erros = []
        pg.on('pageerror', lambda e: erros.append(str(e)))
        pg.goto('file://' + os.path.join(PASTA, 'Boletos-a-cobrar-v2.html'))
        pg.click('[data-ini="pasta"]')
        X.escolher_pasta(PASTA)
        t0 = time.time(); X.permitir()
        pg.wait_for_function(f'S.vista && S.vista.tabs.boletos.linhas.length === {N}', timeout=120000)
        t_abrir = time.time() - t0
        ok(t_abrir < 15, f'abrir {N} boletos: {t_abrir:.1f} s (inclui a pergunta de permissão)')
        pg.wait_for_function('S.pend.length === 0 && !S.gravando', timeout=60000)
        time.sleep(1)
        pg.evaluate('window.__longas = []')
        t0 = time.time()
        pg.evaluate("executar('perf', opsEditar(S.vista, 5000, {obs: 'alteração de teste de desempenho'}, novoCtx(USUARIO())))")
        pg.wait_for_function('S.pend.length === 0 && !S.gravando', timeout=60000)
        t_gravar = time.time() - t0
        longas = pg.evaluate('window.__longas')
        ok(t_gravar < 8, f'gravar uma alteração na planilha de {N}: {t_gravar:.1f} s')
        ok(max(longas or [0]) < 600, f'tela sem travar durante a gravação: maior bloqueio {max(longas or [0])} ms ({len(longas)} tarefas longas)')
        pg.click('.aba[data-aba="boletos"]'); time.sleep(0.5)
        pg.select_option('#fStatus', 'todos'); time.sleep(0.5)
        t0 = time.time()
        pg.fill('#fBusca', 'Cliente fictício 1234')
        pg.wait_for_function("L.itens.length > 0 && L.itens.length < 50", timeout=10000)
        t_busca = time.time() - t0
        ok(t_busca < 2, f'buscar entre {N}: {t_busca * 1000:.0f} ms (inclui a espera de digitação de 160 ms)')
        pg.fill('#fBusca', '')
        pg.wait_for_function(f"L.itens.length > 5000", timeout=10000)
        t0 = time.time()
        for y in range(0, 200000, 20000):
            pg.evaluate(f"document.querySelector('#tv').scrollTop = {y}"); time.sleep(0.03)
        t_rolar = time.time() - t0
        ok(pg.evaluate("document.querySelectorAll('#tvCorpo .tv-lin').length") < 120, 'lista virtual: só desenha as linhas visíveis')
        ok(t_rolar < 3, f'rolar a lista inteira: {t_rolar:.1f} s')
        for aba in ['hoje', 'painel', 'calendario', 'clientes']:
            t0 = time.time(); pg.click(f'.aba[data-aba="{aba}"]'); pg.wait_for_timeout(50); dt = time.time() - t0
            ok(dt < 3, f'abrir a tela {aba}: {dt * 1000:.0f} ms')
        ok(not erros, f'sem erros de JavaScript {erros[:2]}')
        ctx.close()
    X.parar_tela()
    print('\nRESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S): {falhas}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
