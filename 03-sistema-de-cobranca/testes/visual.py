#!/usr/bin/env python3
"""Fotos das telas em 390, 768 e 1440 px, tema claro e escuro, com dados de exemplo
(modo "guardar neste navegador", sem precisar de janelas). Gera testes/saida/visual/*.png
para olhar e falha se houver erro de JavaScript ou rolagem horizontal na página."""
import os, sys, time, base64, subprocess, json
from playwright.sync_api import sync_playwright
AQUI = os.path.dirname(os.path.abspath(__file__))
HTML = 'file://' + os.path.abspath(os.path.join(AQUI, '..', 'Boletos-a-cobrar-v2.html'))
OUT = os.path.join(AQUI, 'saida', 'visual')
os.makedirs(OUT, exist_ok=True)
EX = os.path.join(OUT, 'dados.xlsx')
subprocess.run(['node', os.path.join(AQUI, 'ferramenta.mjs'), 'exemplo', EX, '60'], check=True, capture_output=True)
B64 = base64.b64encode(open(EX, 'rb').read()).decode()
TELAS = os.environ.get('TELAS', 'hoje,boletos,novo,gaveta,baixa,contato,mensagem,clientes,cliente,painel,calendario,conciliacao,importar,lixeira,historico,verificar,config,diagnostico,ajuda,inicio').split(',')
LARGURAS = [int(x) for x in os.environ.get('LARGURAS', '390,768,1440').split(',')]
TEMAS = os.environ.get('TEMAS', 'claro,escuro').split(',')
problemas = []

def preparar(pg):
    pg.goto(HTML)
    pg.evaluate("""async b64 => { const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); lsSet('bc2.navAvisado','1'); await iniciarNavegador(u8); }""", B64)
    pg.wait_for_function('S.vista && S.vista.tabs.boletos.linhas.length > 10')

def foto(pg, nome):
    time.sleep(0.25)
    largura = pg.evaluate('document.documentElement.scrollWidth'); vis = pg.evaluate('window.innerWidth')
    if largura > vis + 1: problemas.append(f'{nome}: rolagem horizontal ({largura} > {vis})')
    pg.screenshot(path=os.path.join(OUT, nome + '.png'), full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for tema in TEMAS:
        for w in LARGURAS:
            ctx = b.new_context(viewport={'width': w, 'height': 860 if w > 500 else 780}, locale='pt-BR', color_scheme='dark' if tema == 'escuro' else 'light')
            ctx.add_init_script("try{localStorage.setItem('bc2.usuario','Ana Souza'); localStorage.setItem('bc2.tema','%s')}catch(e){}" % tema)
            pg = ctx.new_page(); erros = []
            pg.on('pageerror', lambda e: erros.append(str(e)))
            if 'inicio' in TELAS:
                pg.goto(HTML); pg.wait_for_selector('#p-inicio.ativo'); foto(pg, f'{w}-{tema}-inicio')
            preparar(pg)
            for t in TELAS:
                nome = f'{w}-{tema}-{t}'
                if t in ('hoje', 'boletos', 'novo', 'clientes', 'painel', 'calendario', 'conciliacao', 'importar', 'lixeira', 'historico', 'verificar', 'config', 'diagnostico', 'ajuda'):
                    pg.evaluate(f"fecharJanela(); fecharGaveta(); mostrarAba('{t}')")
                    if t == 'boletos': pg.evaluate("L.f.status='todos'; renderBoletos()")
                    if t == 'calendario': pg.evaluate("CA.dia = S.vista.tabs.boletos.linhas.find(b=>b.status==='Em aberto').vencimento; CA.ym = CA.dia.slice(0,7); renderCalendario()")
                    if t == 'conciliacao': pg.evaluate("lerConciliacao(`OFXHEADER:100\\n<OFX><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261014<TRNAMT>${S.vista.tabs.boletos.linhas.find(b=>b.status==='Em aberto').saldo.toFixed(2)}<FITID>1<MEMO>PIX</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261013<TRNAMT>12.34<FITID>2<MEMO>TED</STMTTRN></OFX>`, 'extrato.ofx')")
                    if t == 'importar': pg.evaluate("carregarImportacao('teste.csv', lerCSV('Vencimento;Valor;Cliente;CNPJ;Nº documento\\n15/11/2026;1.250,00;Bar Novo (EXEMPLO);529.982.247-25;NF 9\\n;10;Sem data;;\\n15/12/2026;99,90;Outro (EXEMPLO);11.222.333/0001-81;NF 10'))")
                    if t == 'diagnostico': time.sleep(0.6)
                    foto(pg, nome)
                elif t in ('gaveta', 'baixa', 'contato', 'mensagem'):
                    pg.evaluate("fecharJanela(); mostrarAba('boletos'); abrirGaveta(S.vista.tabs.boletos.linhas.filter(b=>b.status==='Em aberto' && b.vencimento < hojeLocal())[0].id)")
                    if t != 'gaveta': pg.evaluate(f"acaoBoleto('{t}', [G.id])")
                    foto(pg, nome)
                    pg.evaluate("fecharJanela(); fecharGaveta()")
                elif t == 'cliente':
                    pg.evaluate("mostrarAba('clientes'); abrirCliente(S.vista.tabs.clientes.linhas[0].id)")
                    foto(pg, nome); pg.evaluate('fecharJanela()')
            if erros: problemas.append(f'{w}-{tema}: erros JS {erros[:3]}')
            ctx.close()
    b.close()
print('\n'.join(problemas) if problemas else 'sem problemas detectados automaticamente')
print('fotos em', OUT)
sys.exit(1 if problemas else 0)
