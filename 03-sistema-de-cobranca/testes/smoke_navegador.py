#!/usr/bin/env python3
"""Fumaça rápida (headless) no modo "guardar neste navegador": percorre as telas e as ações
principais e falha se aparecer qualquer erro de JavaScript."""
import os, sys, time
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__))
HTML = 'file://' + os.path.abspath(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'))
OUT = os.path.join(AQUI, 'saida', 'smoke')
os.makedirs(OUT, exist_ok=True)
erros = []

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME') or None)
        ctx = b.new_context(viewport={'width': 1440, 'height': 900})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: erros.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: m.type == 'error' and erros.append('console: ' + m.text))
        pg.goto(HTML)
        pg.fill('#jNome', 'Ana Teste')
        pg.keyboard.press('Enter')
        pg.click('[data-ini="navegador"]')
        pg.wait_for_selector('#p-hoje.ativo')
        # lançamento com 3 parcelas, pelo teclado
        pg.keyboard.press('n')
        pg.fill('#setor', 'Varejo'); pg.fill('#pdv', '1234'); pg.fill('#doc', '11222333000181'); pg.fill('#cliente', 'Mercado Teste')
        pg.fill('#qtd', '3'); pg.fill('#venc1', '2026-09-30'); pg.fill('#valor', '1.000,00')
        pg.click('label[for=mTotal]')
        pg.keyboard.press('Control+Enter')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.length === 3")
        pg.wait_for_function("S.pend.length === 0", timeout=8000)
        # outro lançamento simples
        pg.fill('#fBuscaCli', 'Mercado Teste · PDV 1234 · 11.222.333/0001-81'); pg.dispatch_event('#fBuscaCli', 'change')
        pg.fill('#venc1', '2026-10-15'); pg.fill('#valor', '250')
        pg.click('#btnSalvar')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.length === 4")
        for aba in ['hoje', 'boletos', 'clientes', 'painel', 'calendario', 'conciliacao']:
            pg.click(f'.aba[data-aba="{aba}"]'); time.sleep(0.15)
            pg.screenshot(path=f'{OUT}/{aba}.png', full_page=True)
        for aba in ['importar', 'lixeira', 'historico', 'verificar', 'config', 'diagnostico', 'ajuda']:
            pg.evaluate(f"mostrarAba('{aba}')"); time.sleep(0.15)
            pg.screenshot(path=f'{OUT}/{aba}.png', full_page=True)
        # lista: abrir boleto, dar baixa parcial, contato, mensagem
        pg.click('.aba[data-aba="boletos"]')
        pg.select_option('#fStatus', 'todos')
        pg.click('.tv-lin >> nth=0')
        pg.wait_for_selector('#gaveta')
        pg.screenshot(path=f'{OUT}/gaveta.png')
        pg.click('[data-g="baixa"]')
        pg.fill('#bValor', '100'); pg.click('.modal button[type=submit]')
        pg.wait_for_function("S.vista.tabs.pagamentos.linhas.length === 1")
        pg.click('[data-g="contato"]')
        pg.fill('#cNota', 'ligou e prometeu'); pg.fill('#cPromessa', '2026-10-20')
        pg.keyboard.press('Control+Enter')
        pg.wait_for_function("S.vista.tabs.contatos.linhas.length === 1")
        pg.click('[data-g="mensagem"]'); time.sleep(0.2)
        pg.screenshot(path=f'{OUT}/mensagem.png')
        txt = pg.input_value('#mTexto')
        assert 'Mercado Teste' in txt and 'R$' in txt, txt
        pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
        # seleção múltipla + baixa em lote + desfazer
        pg.focus('#tv'); pg.keyboard.press('Home')
        pg.keyboard.press('Space'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Space')
        n_sel = pg.evaluate('L.sel.size')
        assert n_sel == 2, n_sel
        pg.click('[data-lote="baixa"]'); pg.click('.modal button[type=submit]')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.filter(b=>b.status==='Pago').length >= 2")
        pg.evaluate('desfazer()')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.filter(b=>b.status==='Pago').length === 0")
        pg.evaluate('refazer()')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.filter(b=>b.status==='Pago').length >= 2")
        # renegociação, lixeira, restaurar
        ids = pg.evaluate("S.vista.tabs.boletos.linhas.filter(b=>b.status==='Em aberto').map(b=>b.id)")
        pg.evaluate(f"janelaRenegociar({ids[:1]})"); pg.click('.modal button[type=submit]')
        pg.wait_for_function("S.vista.tabs.boletos.linhas.some(b=>b.status==='Renegociado')")
        pg.evaluate(f"acaoBoleto('lixeira', [{ids[0]}])")
        pg.evaluate(f"acaoBoleto('restaurar', [{ids[0]}])")
        pg.wait_for_function("S.pend.length === 0", timeout=8000)
        # recarrega: dados persistem
        pg.reload()
        pg.wait_for_function("S.vista && S.vista.tabs.boletos.linhas.length >= 4", timeout=10000)
        n = pg.evaluate('S.vista.tabs.boletos.linhas.length')
        hist = pg.evaluate('S.vista.tabs.historico.linhas.length')
        print('boletos após F5:', n, 'histórico:', hist)
        # exportação CSV e XLSX
        with pg.expect_download() as d:
            pg.evaluate("exportarLista('csv')")
        d.value.save_as(f'{OUT}/export.csv')
        with pg.expect_download() as d:
            pg.evaluate("exportarLista('xlsx')")
        d.value.save_as(f'{OUT}/export.xlsx')
        pg.evaluate("document.documentElement.setAttribute('data-tema','escuro'); mostrarAba('painel')")
        pg.screenshot(path=f'{OUT}/painel-escuro.png', full_page=True)
        b.close()
    if erros:
        print('ERROS DE JAVASCRIPT:'); [print('  ', e) for e in erros]
        sys.exit(1)
    print('fumaça OK')

main()
