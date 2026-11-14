#!/usr/bin/env python3
"""Monta o arquivo único Boletos-a-cobrar-v2.html a partir das partes desta pasta.
O HTML gerado é o que vale (é ele que os testes usam); as partes só facilitam a manutenção."""
import os
AQUI = os.path.dirname(os.path.abspath(__file__))
L = lambda n: open(os.path.join(AQUI, n), encoding='utf-8').read()
nucleo = ['n1-util.js', 'n2-xlsx.js', 'n3-modelo.js', 'n4-sinc.js', 'n5-dominio.js']
app = ['a1-base.js', 'a2-acesso.js', 'a3-sinc.js', 'a4-inicio.js', 'a5-cobranca.js', 'a6-novo.js', 'a7-telas.js']
html = (L('cabeca.html') + L('estilo.css') + L('corpo.html') +
        '<script>\n"use strict";\n/* =====================================================================\n   1. NÚCLEO — funções puras (testadas em Node: testes/unitarios.test.mjs)\n   ===================================================================== */\n/*<NUCLEO>*/\n' +
        '\n'.join(L(n) for n in nucleo) + '\n/*</NUCLEO>*/\n' + '\n'.join(L(n) for n in app) + '\n</script>\n</body>\n</html>\n')
saida = os.path.join(os.path.dirname(AQUI), 'Boletos-a-cobrar-v2.html')
open(saida, 'w', encoding='utf-8').write(html)
print(saida, len(html.encode('utf-8')) // 1024, 'KB')
