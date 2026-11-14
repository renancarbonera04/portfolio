#!/usr/bin/env bash
# Roda todos os testes do sistema. Uso: bash testes/rodar_todos.sh
# Requisitos: node 20+, python3 com openpyxl e playwright, Chromium do Playwright, LibreOffice (soffice),
# pdftoppm, Xvfb, openbox, xdotool; root (ou sudo) para o chattr dos testes de arquivo travado.
set -u
cd "$(dirname "$0")/.."
python3 fonte/montar.py >/dev/null 2>&1 || true
r=0
passo() { echo; echo "=== $1"; shift; "$@" || { echo ">>> FALHOU: $*"; r=1; }; }
passo "unitários (Node)"            node --test testes/unitarios.test.mjs
passo "round-trip openpyxl/LibreOffice" python3 testes/roundtrip.py
passo "fumaça (headless)"           python3 testes/smoke_navegador.py
passo "E2E modo pasta (file://)"    python3 testes/e2e_pasta.py
passo "E2E modo arquivo/Substituir" python3 testes/e2e_arquivo.py
passo "E2E concorrência 4 PCs"      python3 testes/e2e_concorrencia.py
passo "duas abas no mesmo navegador" python3 testes/e2e_abas.py
passo "E2E resiliência"             python3 testes/e2e_resiliencia.py
passo "E2E desempenho 10 mil"       python3 testes/e2e_desempenho.py
passo "telas (390/768/1440, claro/escuro)" python3 testes/visual.py
echo; [ $r -eq 0 ] && echo "TODOS OS TESTES PASSARAM" || echo "ALGUM TESTE FALHOU"
exit $r
