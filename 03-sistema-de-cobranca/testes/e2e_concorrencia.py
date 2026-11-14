#!/usr/bin/env python3
"""CONCORRÊNCIA: 4 navegadores (4 perfis = 4 PCs) gravando no MESMO .xlsx ao mesmo tempo,
abertos por file:// com as janelas nativas (modo pasta).
  A. linhas diferentes: cada um edita os seus boletos, lança boletos novos e dá baixas
  B. mesma linha: campos diferentes (todos ficam) e o mesmo campo (fica um, igual em todos)
  C. "Excel segurando o arquivo" (chattr +i): gravação falha, fica pendente, avisa e se recupera
No fim: nada se perde, e as 4 telas mostram exatamente o que está no arquivo.
"""
import os, sys, time, shutil, subprocess, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xdialogo as X
from playwright.sync_api import sync_playwright

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.environ.get('E2E_RAIZ', '/tmp/e2e-boletos-conc')
PASTA = os.path.join(RAIZ, 'rede', '3. FINANCEIRO', '00. Bases')
XLSX = os.path.join(PASTA, 'Boletos a cobrar.xlsx')
OUT = os.path.join(AQUI, 'saida', 'e2e-concorrencia')
USUARIOS = ['Ana', 'Bruno', 'Carla', 'Davi']
N_ACOES = int(os.environ.get('N_ACOES', '12'))
falhas = []

def ok(c, msg):
    print(('  ok    ' if c else '  FALHA ') + msg, flush=True)
    if not c: falhas.append(msg)

def ler_arquivo():
    r = subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'ler', XLSX], capture_output=True, text=True, timeout=120)
    if r.returncode: raise RuntimeError(r.stderr)
    return json.loads(r.stdout)

def resumo(boletos):
    return sorted((b['id'], b.get('obs', ''), b.get('status'), round(b.get('valor') or 0, 2), b.get('responsavel', ''), b.get('etapa', ''), b.get('promessaEm', ''), b.get('lancamento')) for b in boletos)

def vista(pg):
    return pg.evaluate("JSON.stringify(S.vista.tabs.boletos.linhas.map(b=>({id:b.id,obs:b.obs||'',status:b.status,valor:b.valor,responsavel:b.responsavel||'',etapa:b.etapa||'',promessaEm:b.promessaEm||'',lancamento:b.lancamento})))")

def esperar_sossego(pgs, extra=12, limite=150):
    """Espera todos terminarem de gravar e mais 'extra' segundos sem nada pendente (releituras/verificações)."""
    t0 = time.time(); quieto = None
    while time.time() - t0 < limite:
        pend = [pg.evaluate('S.pend.length + (S.gravando ? 1 : 0)') for pg in pgs]
        if sum(pend) == 0:
            quieto = quieto or time.time()
            if time.time() - quieto >= extra: return True
        else: quieto = None
        time.sleep(0.5)
    print('   pendências ainda:', [pg.evaluate('S.pend.length') for pg in pgs])
    return False

def convergiu(pgs, rotulo):
    for pg in pgs: pg.evaluate('naFila(() => releitura(true))')
    time.sleep(2.5)
    arq = ler_arquivo()
    alvo = resumo(arq['tabs']['boletos']['linhas'])
    iguais = [resumo(json.loads(vista(pg))) == alvo for pg in pgs]
    ok(all(iguais), f'{rotulo}: as 4 telas iguais ao arquivo ({iguais})')
    return arq

def main():
    shutil.rmtree(RAIZ, ignore_errors=True); os.makedirs(PASTA); os.makedirs(OUT, exist_ok=True)
    shutil.copy(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'), PASTA)
    subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'exemplo', XLSX, '40'], check=True, capture_output=True)
    base = ler_arquivo()
    ids_abertos = [b['id'] for b in base['tabs']['boletos']['linhas'] if b['status'] == 'Em aberto' and not b.get('excluidoEm')]
    n_bol0 = base['tabs']['boletos']['n']
    url = 'file://' + os.path.join(PASTA, 'Boletos-a-cobrar-v2.html')
    X.iniciar_tela(1600, 1000)
    with sync_playwright() as p:
        ctxs, pgs = [], []
        print('0) abrindo 4 navegadores (4 perfis) na mesma pasta')
        for i, u in enumerate(USUARIOS):
            ctx = p.chromium.launch_persistent_context(os.path.join(RAIZ, 'perfil-' + u), headless=False, executable_path=X.CHROME, locale='pt-BR',
                args=['--no-sandbox', f'--window-size=900,700', f'--window-position={i * 40},{i * 40}'], viewport={'width': 880, 'height': 600})
            ctx.add_init_script(f"try{{localStorage.setItem('bc2.usuario','{u}')}}catch(e){{}}")
            pg = ctx.pages[0]; pg.erros = []
            pg.on('pageerror', lambda e, pg=pg: pg.erros.append(str(e)))
            pg.goto(url)
            pg.click('[data-ini="pasta"]')
            X.escolher_pasta(PASTA); X.permitir()
            pg.wait_for_function('A.podeGravar && S.vista && S.vista.tabs.boletos.linhas.length > 0', timeout=30000)
            ctxs.append(ctx); pgs.append(pg)
        ok(all(pg.evaluate('A.modo') == 'pasta' for pg in pgs), '4 navegadores conectados no modo pasta')

        print(f'A) linhas diferentes: {N_ACOES} ações por pessoa, ao mesmo tempo')
        random.seed(5)
        meus = {u: ids_abertos[k::4][:N_ACOES] for k, u in enumerate(USUARIOS)}
        esperado_obs = {}
        n_lanc = 0; n_pag = 0
        for i in range(N_ACOES):
            for k, (u, pg) in enumerate(zip(USUARIOS, pgs)):
                acao = i % 3
                if acao == 0 and meus[u]:
                    bid = meus[u][i % len(meus[u])]
                    txt = f'{u}-{i}'
                    pg.evaluate(f"executar('obs', opsEditar(S.vista, {bid}, {{obs: '{txt}'}}, novoCtx(USUARIO())), {{silencioso:true}})")
                    esperado_obs[bid] = txt
                elif acao == 1:
                    pg.evaluate(f"executar('lanc', opsLancamento(S.vista, {{setor:'Teste', pdv:'C{k}{i}', cliente:'Concorrência {u} {i}', doc:'529.982.247-25', parcelas: gerarParcelas({{qtd:2, valor:100, venc1:'2026-12-01', modo:'total'}})}}, novoCtx(USUARIO())), {{silencioso:true}})")
                    n_lanc += 2
                else:
                    cand = [b for b in meus[u] if b not in esperado_obs]
                    if cand:
                        bid = cand[0]; meus[u].remove(bid)
                        pg.evaluate(f"executar('pag', opsPagamento(S.vista, {bid}, {{data:'2026-10-15', valor: 10, forma:'PIX'}}, novoCtx(USUARIO())), {{silencioso:true}})")
                        n_pag += 1
            time.sleep(random.uniform(0.05, 0.35))
        ok(esperar_sossego(pgs), 'todos terminaram de gravar')
        arq = convergiu(pgs, 'A')
        bol = {b['id']: b for b in arq['tabs']['boletos']['linhas']}
        perdidas = [bid for bid, txt in esperado_obs.items() if bol.get(bid, {}).get('obs') != txt]
        ok(not perdidas, f'todas as {len(esperado_obs)} edições estão no arquivo (perdidas: {perdidas})')
        novos = [b for b in arq['tabs']['boletos']['linhas'] if str(b.get('cliente', '')).startswith('Concorrência')]
        ok(len(novos) == n_lanc, f'todos os boletos lançados estão no arquivo ({len(novos)} de {n_lanc})')
        ok(len(set(b['id'] for b in arq['tabs']['boletos']['linhas'])) == arq['tabs']['boletos']['n'], 'nenhum ID repetido')
        lancs = {}
        for b in novos: lancs.setdefault(b['lancamento'], set()).add(b['cliente'])
        ok(all(len(v) == 1 for v in lancs.values()) and len(lancs) == n_lanc // 2, f'cada lançamento com as suas 2 parcelas, sem misturar ({len(lancs)} lançamentos)')
        pags = arq['tabs']['pagamentos']['linhas']
        ok(len(pags) == base['tabs']['pagamentos']['n'] + n_pag, f'todos os pagamentos registrados ({len(pags) - base["tabs"]["pagamentos"]["n"]} de {n_pag})')
        hist = arq['tabs']['historico']['n'] - base['tabs']['historico']['n']
        ok(hist >= len(esperado_obs) + n_lanc + n_pag, f'histórico com as ações de todos ({hist})')
        pgs[0].evaluate('naFila(atualizarPresencaPasta)'); time.sleep(1.5)
        pres = pgs[0].evaluate('S.presenca')
        ok(set(pres) == {'Bruno', 'Carla', 'Davi'}, f'presença: Ana vê que Bruno, Carla e Davi estão com o sistema aberto ({pres})')
        ok('estão com o sistema aberto' in pgs[0].inner_text('#presenca'), 'aviso de presença no topo: ' + pgs[0].inner_text('#presenca'))
        refeitas = sum(pg.evaluate("DIAG.filter(d => /sobrescrita/.test(d.msg)).length") for pg in pgs)
        print(f'   (alterações refeitas por gravação simultânea: {refeitas})')

        print('B) mesma linha: campos diferentes e o mesmo campo, ao mesmo tempo')
        alvo = [b for b in ids_abertos if b not in esperado_obs and all(b not in m for m in meus.values())][:1] or [ids_abertos[-1]]
        alvo = alvo[0]
        campos = [("responsavel", "'Ana'"), ("etapa", "'Contatado'"), ("proxAcao", "'ligar 15h'"), ("promessaEm", "'2026-10-30'")]
        for (c, v), pg in zip(campos, pgs):
            pg.evaluate(f"executar('campo', opsEditar(S.vista, {alvo}, {{{c}: {v}}}, novoCtx(USUARIO())), {{silencioso:true}})")
        ok(esperar_sossego(pgs), 'gravações da mesma linha terminaram')
        arq = convergiu(pgs, 'B1')
        b = next(x for x in arq['tabs']['boletos']['linhas'] if x['id'] == alvo)
        ok((b.get('responsavel'), b.get('etapa'), b.get('proxAcao'), b.get('promessaEm')) == ('Ana', 'Contatado', 'ligar 15h', '2026-10-30'), f'campos diferentes da mesma linha: os 4 ficaram ({b.get("responsavel")}, {b.get("etapa")}, {b.get("proxAcao")}, {b.get("promessaEm")})')
        for k, pg in enumerate(pgs):
            pg.evaluate(f"executar('mesmo', opsEditar(S.vista, {alvo}, {{obs: 'versão de {USUARIOS[k]}'}}, novoCtx(USUARIO())), {{silencioso:true}})")
            time.sleep(0.02)
        ok(esperar_sossego(pgs), 'gravações do mesmo campo terminaram')
        arq = convergiu(pgs, 'B2')
        b = next(x for x in arq['tabs']['boletos']['linhas'] if x['id'] == alvo)
        ok(b.get('obs') == 'versão de Davi', f'mesmo campo: ficou a mais recente ("{b.get("obs")}", esperado "versão de Davi") e todos veem a mesma')

        print('C) planilha "presa" (como aberta no Excel): gravação falha, fica pendente e volta sozinha')
        subprocess.run(['chattr', '+i', XLSX], check=True)
        try:
            pgs[1].evaluate(f"executar('preso', opsEditar(S.vista, {alvo}, {{obs: 'gravado depois de soltar'}}, novoCtx(USUARIO())))")
            pgs[1].wait_for_function("S.erro && S.erro.tipo === 'ocupada'", timeout=20000)
            ok(True, 'erro reconhecido como "planilha ocupada"')
            txt = pgs[1].inner_text('#salvoTxt')
            ok(txt.startswith('Pendente'), f'indicador mostra "{txt}"')
            ok('aguarde' in pgs[1].inner_text('#faixas') and 'sem perder nada' in pgs[1].inner_text('#faixas'), 'mensagem clara: feche ou aguarde, nada se perde')
            pgs[1].screenshot(path=f'{OUT}/C-ocupada.png')
            time.sleep(4)
        finally:
            subprocess.run(['chattr', '-i', XLSX], check=True)
        pgs[1].evaluate('agendarGravacao(0)')
        pgs[1].wait_for_function('S.pend.length === 0 && !S.erro', timeout=60000)
        arq = convergiu(pgs, 'C')
        ok(next(x for x in arq['tabs']['boletos']['linhas'] if x['id'] == alvo).get('obs') == 'gravado depois de soltar', 'gravou sozinho depois que o arquivo foi solto')
        ok(not any(f.endswith('.crswap') for f in os.listdir(PASTA)), 'sem .crswap sobrando na pasta')
        errs = [e for pg in pgs for e in pg.erros]
        ok(not errs, f'sem erros de JavaScript {errs[:2]}')
        bks = os.listdir(os.path.join(PASTA, 'backup'))
        ok(1 <= len(bks) <= 4, f'backups automáticos sem exagero ({len(bks)})')
        for ctx in ctxs: ctx.close()
    X.parar_tela()
    print('\nRESULTADO:', 'TUDO OK' if not falhas else f'{len(falhas)} FALHA(S): {falhas}')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
