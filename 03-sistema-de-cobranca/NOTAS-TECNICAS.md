# Boletos a cobrar — V2 · Notas técnicas

Para quem for manter o sistema. O guia do time é o `GUIA.md`.

## 1. O que foi entregue

| Arquivo | O que é |
|---|---|
| `Boletos-a-cobrar-v2.html` | O sistema inteiro (HTML + CSS + JS, ~425 KB, sem nenhuma dependência, funciona offline via `file://`). |
| `GUIA.md` | Guia curto para o financeiro. |
| `NOTAS-TECNICAS.md` | Este arquivo. |
| `exemplo.xlsx` | Planilha com dados **fictícios** para treinar: clientes terminam em "(EXEMPLO)" e os únicos documentos são exemplos de manual (CNPJ 11.222.333/0001-81, o CNPJ alfanumérico 12.ABC.345/01DE-35 da Receita e o CPF de teste 529.982.247-25); os demais clientes ficam sem documento. Gerada por `node testes/ferramenta.mjs exemplo exemplo.xlsx`. |
| `fonte/` | O código-fonte separado por partes + `montar.py`, que gera o HTML. |
| `testes/` | Testes que podem ser rodados de novo (`bash testes/rodar_todos.sh`). |

Nada usa internet, CDN, biblioteca externa, API ou telemetria (requisito da empresa). O motor de
`.xlsx` (ZIP, XML, estilos) é próprio, usando só `CompressionStream`/`DecompressionStream` do navegador.

## 2. Organização do código

O HTML é montado por `python3 fonte/montar.py` a partir de:

- `cabeca.html` — `<head>`, índice das seções e um script **pequeno e independente** que roda antes de
  tudo: aplica o tema, captura qualquer erro de JS e mostra a caixa "Algo deu errado", e um vigia que,
  4 s depois do `load`, avisa se o código principal não terminou de carregar. Assim a tela nunca fica
  parada em "Carregando…". Há também o aviso para JavaScript desligado (`<noscript>`).
- `estilo.css`, `corpo.html` — aparência e estrutura (tema claro/escuro por variáveis CSS).
- **Núcleo** (funções puras, sem DOM, testáveis no Node), entre os marcadores `/*<NUCLEO>*/ … /*</NUCLEO>*/`:
  - `n1-util.js` — datas (sempre em horário local, sem `Date` UTC escondido), valores em centavos,
    parcelas, CPF/CNPJ (inclui CNPJ alfanumérico), linha digitável 47/48 e código de barras 44 com
    DVs e fator de vencimento (inclui a virada para 1000 em 22/02/2025), juros/multa, aging,
    modelos de mensagem, CSV, OFX, CNAB 240/400.
  - `n2-xlsx.js` — ZIP + leitura/escrita de `.xlsx`.
  - `n3-modelo.js` — esquema das abas, leitura tolerante (cabeçalhos por apelido), geração das abas.
  - `n4-sinc.js` — operações, mesclagem, verificação, proteção contra perdas, migração V1→V2.
  - `n5-dominio.js` — regras de negócio (lançamento, baixa, contato, renegociação, conciliação,
    importação, verificação da planilha, relatórios). Tudo devolve **operações**, nunca altera direto.
- **Aplicação** (DOM): `a1-base.js` (utilidades, tempo-limite, armazenamento local, avisos, janelas),
  `a2-acesso.js` (arquivos/pastas/permissões/backups/presença), `a3-sinc.js` (fila de gravação),
  `a4-inicio.js` (início, topo, faixas), `a5-cobranca.js` (Hoje, lista, gaveta, baixa, contato,
  mensagem, renegociação), `a6-novo.js` (lançamento), `a7-telas.js` (demais telas, atalhos, partida).

Para mudar: edite `fonte/`, rode `python3 fonte/montar.py` e os testes. Os testes carregam o núcleo
direto do HTML gerado (entre os marcadores), então testam o arquivo que vai para a pasta.

## 3. Acesso à planilha (File System Access API em `file://`)

O navegador só deixa gravar depois que a pessoa autoriza, e essa autorização **não sobrevive** a fechar
o navegador. O sistema tenta, nesta ordem, e guarda neste PC (localStorage `bc2.flags`) o que não funcionou,
para não repetir pergunta inútil:

1. **`requestPermission`** no identificador guardado (IndexedDB). Um clique em "Liberar a planilha" + "Permitir".
   Relato do time: no Windows deles, em `file://`, isso dá `SecurityError` → marca `rpFalha` e pula.
2. **Modo pasta**: `showDirectoryPicker({mode:'readwrite', startIn: <pasta guardada>})`. Um clique + confirmar
   a pasta (+ "Permitir"/"Editar arquivos"). Dá acesso à planilha, à subpasta `backup/`, aos arquivos de
   presença e ao arquivo `~$` do Excel (para dizer *quem* está com a planilha aberta). Se der
   `SecurityError`/`NotAllowedError`, marca `dirFalha` e passa ao modo arquivo.
3. **Modo arquivo ("Substituir")**: abre a planilha (somente leitura), e o botão "Liberar a gravação" abre o
   "Salvar como" já na planilha; a pessoa confirma **Substituir** e o sistema ganha `readwrite`.
   **Achado importante (testado no Chromium):** o "Salvar como" + "Substituir" **trunca o arquivo para 0 bytes**
   na hora em que a pessoa confirma. Por isso o sistema relê a planilha e **gera os bytes completos ANTES**
   de abrir a janela e grava imediatamente depois (a janela entre truncar e regravar fica em milissegundos).
   Se a gravação falhar nesse instante, baixa uma cópia de segurança. Teste E2E prova que mudanças de outra
   pessoa gravadas segundos antes do "Substituir" são preservadas.
   Nesse modo, F5 exige liberar de novo (comportamento do Chrome).
4. **"Guardar só neste navegador"** (último recurso): dados no IndexedDB, com importar/baixar `.xlsx`.

Se a página for aberta por `http(s)` (não é o uso previsto), o sistema detecta e usa `requestPermission`
normalmente. No modo pasta, a permissão sobrevive a F5 enquanto o navegador estiver aberto.
Os flags podem ser zerados em **Mais › Diagnóstico**.

## 4. Gravação e mesclagem (4 pessoas, sem trava de verdade)

**Não existe trava real entre computadores** numa pasta de rede via navegador. A mitigação:

- **Cada ação vira operações** pequenas: `cri` (cria linha), `alt` (muda campos, guardando o valor anterior),
  `cfg` (configuração). Ficam pendentes no navegador até serem gravadas — por isso F5, fechar o navegador
  ou queda de rede não perdem nada (detalhes na seção 6).
- **Ciclo de gravação** (fila única, nunca duas ao mesmo tempo): se a planilha mudou (data/tamanho),
  relê → aplica as operações pendentes **por cima da versão mais nova** → gera o `.xlsx` → confere de novo
  data/tamanho logo antes de gravar (se mudou, recomeça; até 8 vezes com espera aleatória) → grava.
  Falhas (Excel aberto, rede) entram em nova tentativa sozinha: 2, 4, 8, 16, 32, 60 s (+ aleatório), sem limite.
- **Regras de mesclagem**:
  - linhas diferentes e campos diferentes da mesma linha: tudo é mantido;
  - mesmo campo da mesma linha: **vale a alteração mais recente** (pela data/hora da operação, comparada com
    "Alterado em" da linha), com aviso discreto para quem perdeu/ganhou;
  - criação é idempotente: cada linha criada leva um **carimbo** (data/hora de criação + quem criou);
    reaplicar a mesma criação não duplica;
  - IDs e números de lançamento iguais criados ao mesmo tempo por duas pessoas: o segundo é renumerado e as
    operações seguintes acompanham;
  - linhas que ganharam ID na leitura (digitadas no Excel) são localizadas por assinatura
    (vencimento, valor, parcela, documento, PDV).
- **Verificação depois de gravar**: 2,5–4,5 s depois de cada gravação o sistema relê a planilha. Durante 3 minutos,
  se uma alteração já gravada sumiu (alguém gravou por cima com uma versão anterior), ela é refeita
  automaticamente. Um "terceiro valor" posto depois (por exemplo, no Excel) é respeitado.
- **Datas/horas em "fatias" de ~8,6 ms (1e-7 dia)**: o Excel guarda só 15 dígitos e outros programas
  (ex.: openpyxl) arredondam ao milissegundo; isso mudava o carimbo de criação e fazia o sistema achar que
  linhas tinham sumido. Com a grade, o valor sobrevive aos arredondamentos; comparações de data/hora usam
  folga de meia fatia. Teste unitário específico cobre os três tipos de arredondamento.
- **Edição direta no Excel** é absorvida na próxima leitura (a tela se atualiza sozinha, a cada 5 s — configurável;
  30 s com a aba do navegador em segundo plano). A atualização não atrapalha quem está digitando.
- **Linhas apagadas no Excel** são aceitas (o Excel manda), mas depois de 90 s são registradas no Histórico com
  os dados da linha. **Colunas ou abas inteiras do sistema que sumirem** (ex.: alguém gravou com a V1) são
  recuperadas da última leitura e regravadas, com aviso.
- **Presença**: modo pasta → arquivos `_sistema/presenca - <nome>.txt` (atualizados a cada 30 s, válidos por 6 min);
  modo arquivo → chave `presenca:<nome>` na aba oculta `_Sistema` (gravada no máximo a cada 3 min).
- **Excel com a planilha aberta**: no modo pasta, o arquivo `~$<nome>` revela quem está com ela aberta
  ("A planilha está aberta no Excel por Maria"). As alterações ficam pendentes e são gravadas quando o Excel fechar.

Desfazer/refazer (Ctrl+Z/Ctrl+Y) geram operações inversas (não "voltam o arquivo"); por isso funcionam mesmo
depois que outras pessoas gravaram. Criação desfeita vai para a lixeira; pagamento desfeito vira estorno.

## 5. Formato da planilha

Abas do sistema (os títulos da linha 1 são lidos por apelido, sem acento/maiúscula; a ordem das colunas pode mudar):

- **Boletos**: Vencimento, Status, Valor, Saldo em aberto\*, Parcela, Setor, PDV, Cliente, CNPJ/CPF, Nº documento,
  Observação, Etapa de cobrança, Promessa para, Próxima ação, Próxima ação em, Responsável, Pago em,
  Valor recebido\*, Forma de pagamento, Nosso número, Linha digitável, ID, Lançamento, Renegociação de,
  Renegociado em, Cadastrado em, Cadastrado por, Alterado em, Alterado por, Na lixeira desde, Posto na lixeira por.
- **Clientes**: Cliente, Setor, PDV, CNPJ/CPF, Telefone, WhatsApp, E-mail, Pessoa de contato, Limite de crédito,
  Responsável, Observações, ID, Cadastrado em/por, Alterado em/por, Na lixeira desde, Posto na lixeira por.
- **Pagamentos**: Data do pagamento, ID do boleto, Cliente, Parcela, Valor recebido, Desconto, Juros/multa cobrados,
  Abatido do saldo\*, Forma de pagamento, Origem, Observação, ID, Registrado em/por, Estornado em/por.
- **Contatos**: Data/hora, ID do boleto, Cliente, CNPJ/CPF, Canal, Quem atendeu, Anotação, Etapa, Promessa para,
  Próxima ação, Próxima ação em, ID, Registrado por, Excluído em.
- **Histórico** (só acrescenta): Data/hora, Usuário, Ação, ID do boleto, Detalhe, Nº.
- **Resumo**: fórmulas vivas (`SUMIFS`/`COUNTIFS`, que o Excel em português mostra como `SOMASES`/`CONT.SES`, sobre a aba Boletos) **com o valor já calculado** gravado
  junto (quem abre sem recalcular vê números certos); `fullCalcOnLoad` ligado.
- **Config**: Chave | Configuração | Valor | Explicação. Chaves: `setores`, `responsaveis`, `etapas`, `formas`,
  `canais`, `multa`, `juros`, `diasAlerta`, `intervalo`, `backups`, `modeloWhats`, `modeloEmailAssunto`,
  `modeloEmail`, `modeloTexto`. Linhas extras que o time puser são mantidas.
- **_Sistema** (oculta): `versao_esquema` (= 2), presença do modo arquivo.

\* colunas calculadas pelo sistema (ignoradas na leitura).

Datas são números de série do Excel com formato de data; valores são números com formato de moeda;
textos com zeros à esquerda (PDV, documento, CNPJ, linha digitável) são gravados como texto.
A aba Boletos tem filtro, painel congelado, formatação condicional (na lixeira, pagos, cancelados/renegociados,
vencidos, vencendo nos próximos dias), validação de lista em Status/Etapa/Responsável/Forma de pagamento,
área e títulos de impressão.

**O que o time pode fazer na planilha e é preservado**: abas próprias (com fórmulas, nomes definidos,
formatação), colunas próprias nas abas do sistema (inclusive com fórmulas — as referências acompanham a linha
quando o sistema reordena), linhas de total com fórmula no fim (mantidas como estão), largura de colunas,
aba ativa (testado com openpyxl e LibreOffice). **Não é preservado nas abas do sistema**: comentários/notas,
tabelas do Excel (ListObject), gráficos e imagens dentro delas, formatação manual de células (o sistema regrava
o estilo padrão). Gráficos e imagens em abas próprias do time: as partes do arquivo ligadas a essas abas são
copiadas como estão, mas isso **não foi testado com um gráfico real** do Excel.

## 6. Proteções contra perda de dados

- **Pendências no navegador** até a gravação confirmar, recuperadas após F5/fechar/reiniciar. Cada **aba** guarda
  as suas numa chave própria, em dois lugares: localStorage `bc2.pend:<planilha>#<aba>` (gravação imediata,
  sobrevive a fechar na mesma hora) e IndexedDB `pend:<planilha>#<aba>` (consistente entre abas); ao ler, vale a
  cópia mais nova. **Achado nos testes:** com duas abas abertas em `file://`, o Chromium às vezes mantém o
  localStorage de cada aba separado e, ao recarregar uma delas, perde o que ela gravou ali — por isso o IndexedDB.
  Pendências de uma aba fechada (sem sinal de vida há 3 min) são adotadas pela próxima aba que abrir ou pela que
  já estiver aberta; uma marca `pendFeito:` no IndexedDB impede adotar a mesma coisa duas vezes. Abrir o sistema
  em duas abas mostra um aviso ("é melhor usar uma aba só"), via `BroadcastChannel`.
- Cópia local da última planilha lida (IndexedDB `cache:<planilha>`): abre na hora, mesmo antes de liberar.
- Backups automáticos: modo pasta → `backup/<planilha> - AAAA-MM-DD HHhMM - <motivo> - <pessoa>.xlsx`
  a cada hora de uso (um por hora para o time todo) e **sempre** antes de: atualização da V1, importação,
  conciliação, renegociação, baixa em lote (≥ 10), lixeira/mudança em lote (> 20), correções do "Verificar
  planilha", regravar a última versão boa, restaurar backup. Mantém os N mais recentes (Config `backups`, padrão 30).
  Fora do modo pasta: até 8 backups no IndexedDB, baixáveis no Diagnóstico.
- Antes de qualquer "descartar pendências", o sistema baixa um `.xlsx` de segurança com elas aplicadas.
- Planilha corrompida/vazia (ex.: lida no meio da gravação de outra pessoa): não grava por cima; depois de 45 s
  ilegível oferece "Regravar com a última versão boa" (com backup antes).
- Planilha com senha ou rótulo de confidencialidade (arquivo OLE, começa com `D0 CF 11 E0`): mensagem dizendo que
  precisa ficar **sem senha e sem rótulo**; nada é gravado por cima.
- Toda operação de arquivo/pasta/IndexedDB/permissão tem tempo-limite (`comTempo`), inclusive listar pastas,
  presença, backups e o arquivo `~$` do Excel; nenhuma espera infinita trava a tela ou a fila de gravação. A fila
  ainda tem uma rede de segurança (5 min por tarefa) e, se uma gravação passar de 2,5 min, aparece um aviso.
  Se o IndexedDB travar, o sistema para de esperar por ele por 1 minuto e segue com o localStorage.
- A tela não fica presa em "Carregando…": a tela inicial aparece na hora; erros de JS aparecem numa caixa; um vigia
  avisa se o código não terminou de carregar; JavaScript desligado mostra o que fazer.

## 7. Migração V1 → V2

Automática e determinística (dois PCs chegam ao mesmo resultado), na primeira gravação feita pela V2:
backup da planilha da V1 antes (na pasta `backup/`, ou download se não estiver no modo pasta); todas as linhas e
colunas da V1 mantidas (inclusive datas digitadas como texto); cadastro de Clientes criado a partir dos boletos
(um por CNPJ/CPF, ou por PDV); setores levados para a Config; linha no Histórico. **Depois de migrar, ninguém
deve usar a V1** — ela regravaria a planilha sem as abas novas (a V2 detecta e recupera o que der, com aviso).

## 8. Desempenho (medido, 10 mil boletos, Chromium em máquina virtual)

| Medida | Resultado |
|---|---|
| Tamanho da planilha (10 mil boletos, 1.700 clientes, 3 mil linhas de histórico) | 659 KB |
| Abrir (inclui a pergunta de permissão) | 1,9 s |
| Gravar uma alteração (reler + mesclar + gerar + gravar) | 1,4 s |
| Maior bloqueio da tela durante a gravação | 147 ms |
| Buscar (inclui 160 ms de espera da digitação) | 207 ms |
| Rolar a lista inteira | 0,3 s |
| Abrir as telas Hoje / Painel / Calendário / Clientes | 98–155 ms |

Numa pasta de rede, some o tempo de ler e gravar ~0,7 MB pela rede (normalmente menos de 1 s numa rede de escritório).

A leitura e a geração do `.xlsx` são assíncronas em blocos (a tela continua respondendo); a lista é virtual
(só desenha as linhas visíveis).

## 9. Testes (`bash testes/rodar_todos.sh`)

Requisitos: Linux, Node 20+, Python 3 com `openpyxl` e `playwright`, Chromium, LibreOffice, `pdftoppm`, Xvfb, openbox,
xdotool, root (o `chattr` simula a planilha travada). O caminho do Chromium usado nos testes com janelas reais vem da
variável `CHROME` (padrão: o Chromium do Playwright). Os testes com janelas reais dirigem as caixas de diálogo do
Linux (GTK); no Windows elas são diferentes, então lá só os testes unitários (`node --test testes/unitarios.test.mjs`)
rodam como estão. Fotos e arquivos gerados vão para `testes/saida/`.

| Script | O que testa |
|---|---|
| `unitarios.test.mjs` | 33 testes do núcleo: datas (independe do fuso), parcelas, centavos, CPF/CNPJ alfanumérico, linha digitável (DVs, fator com virada de 2025), juros, CSV/OFX/CNAB, mesclagem (todos os casos acima, inclusive arredondamento de datas pelo Excel), pagamentos/estorno/lote/desfazer, renegociação, conciliação, importação, verificação, agenda do dia, `.xlsx` ida-e-volta, erros (vazio, corrompido, senha), fórmulas do time, migração V1 com o código real da V1. |
| `roundtrip.py` | Planilha editada pelo openpyxl simulando o Excel (apagar linha, linha nova sem ID, linha duplicada, colunas e fórmulas do time, linha de total, aba própria com nome definido, Config) → sistema → LibreOffice → sistema → PDF; migração V1. |
| `smoke_navegador.py` | Fluxo rápido sem janelas (modo navegador). |
| `e2e_pasta.py` | `file://` com as janelas reais do Chromium (Xvfb + xdotool): escolher pasta, permitir, lançar pelo teclado, F5, fechar/abrir o navegador, edição no Excel aparecendo sozinha. |
| `e2e_arquivo.py` | Modo "Substituir" com `requestPermission` e pasta bloqueados: truncamento, mudança de outra pessoa segundos antes, F5. |
| `e2e_concorrencia.py` | 4 navegadores (Ana, Bruno, Carla, Davi) na mesma planilha: linhas diferentes, mesma linha/campos diferentes, mesmo campo (vale o mais recente), planilha travada (simula Excel) e recuperação. |
| `e2e_abas.py` | Duas abas no mesmo navegador com gravação falhando: cada uma guarda as suas pendências, F5 recupera só as dela, aba fechada com pendência é recuperada e gravada pela próxima aba, aviso de aba repetida. |
| `e2e_resiliencia.py` | JS desligado, JS quebrado, IndexedDB/leitura pendurados, planilha some e volta, corrompida, com senha, F5 no meio da gravação, "Não permitir", pasta sem permissão. |
| `e2e_desempenho.py` | 10 mil boletos (números acima). |
| `visual.py` | 120 fotos (20 telas × 390/768/1440 px × claro/escuro) em `testes/saida/visual/`, falha com erro de JS ou rolagem horizontal. |

`node testes/ferramenta.mjs exemplo <saida.xlsx> [n]` gera uma planilha de exemplo; `... ler <arquivo>` mostra
como o sistema lê uma planilha (útil para diagnosticar).

## 10. Limitações conhecidas (honestas)

- **Sem trava real**: entre a última conferência de data/tamanho e a gravação há uma janela de milissegundos em que
  duas gravações podem se cruzar. A verificação depois de gravar (3 min, com o navegador aberto) refaz a alteração
  que ficou de fora; se a pessoa fechar o navegador nesse intervalo, a verificação continua na próxima abertura
  (as confirmações pendentes ficam guardadas), mas só se for dentro dos 3 minutos.
- **"Mais recente vale"** depende do relógio de cada PC (Windows em domínio costuma estar sincronizado).
- Excel aberto: só o modo pasta descobre *quem* está com a planilha aberta; no modo arquivo a mensagem é genérica.
- **Modo "Substituir"**: entre o truncamento e a regravação há milissegundos em que o arquivo está vazio; se outra
  pessoa ler exatamente nesse instante, o sistema dela vê "ilegível", não grava por cima e tenta de novo.
- Exclusões feitas no Excel são aceitas (só registradas). Para excluir, use a Lixeira.
- O Histórico só cresce (sem rotação; foi pedido não elaborar auditoria). Com o tempo pode ser arquivado à mão
  (recortar linhas antigas para outra planilha).
- Modelos de lançamento, visões salvas, colunas e filtros ficam **por navegador** (localStorage), não na planilha.
- Recorrência: há **modelos** e "clonar lançamento"; não existe geração automática de boletos recorrentes.
- CNAB 400: posições do nosso número configuradas para Bradesco (237) e Itaú (341) conforme os layouts conhecidos,
  **sem nenhum arquivo real de banco para conferir**; outros bancos mostram aviso para conferir linha a linha. CNAB 240 segue o padrão FEBRABAN (segmentos T/U).
  A tela de conferência sempre mostra tudo antes de aplicar.
- O nome do usuário é só o que a pessoa digita (sem controle de acesso, como pedido).

## 11. O que NÃO foi possível testar aqui (ambiente Linux sem rede Windows)

- Pasta de rede Windows de verdade (UNC/unidade mapeada), com a latência e as travas do SMB.
- **Excel desktop de verdade segurando o arquivo**: simulado com `chattr +i` (erro de permissão) e com o arquivo
  `~$`. O nome exato do erro que o Chrome/Edge dá no Windows com o arquivo travado não foi visto; erros
  desconhecidos caem no mesmo tratamento (pendente + nova tentativa), então nada se perde, mas o texto pode ser o
  genérico "Não consegui gravar…".
- **Microsoft Edge e Chrome no Windows**: testado só no Chromium 141 do Linux. O comportamento de
  `requestPermission` no Windows (o `SecurityError` relatado) foi tratado pelo fallback, não reproduzido.
- 4 computadores reais: simulado com 4 perfis de navegador independentes na mesma máquina e no mesmo arquivo.
- Arquivo com rótulo de confidencialidade real (Microsoft Purview): testado só com um arquivo OLE sintético.

**Validação no dia 1** (ver `GUIA.md`, seção 7): duas pessoas, cada uma no seu PC, editando ao mesmo tempo na pasta
real; depois alguém deixa a planilha aberta no Excel e confere o "Pendente" e a recuperação. Se algo falhar:
**Mais › Diagnóstico › Copiar relatório** em cada PC (traz versão, modo de acesso, flags, últimos eventos e erros).

## 12. Decisões tomadas (reversíveis)

- Modo pasta como recomendado (dá backups e presença por arquivo); modo arquivo como alternativa automática.
- Intervalo de atualização padrão 5 s (Config `intervalo`, mínimo 2).
- Backup de hora em hora (um por hora para o time) + antes de operações grandes; 30 mantidos.
- Colunas "Saldo em aberto" e "Valor recebido" calculadas pelo sistema (derivadas dos Pagamentos).
- Pagamento: abatido do saldo = valor recebido − juros/multa cobrados + desconto. Quando o abatido cobre o saldo,
  o boleto fica Pago (com "Pago em" e forma); senão, fica em aberto com saldo menor (pagamento parcial).
- Juros simples pro rata dia (juros ao mês ÷ 30 × dias) + multa única; ambos configuráveis.
- "Venceu ontem" na segunda-feira inclui sábado e domingo.
- Na tela de celular a lista mostra só cliente e saldo (o resto no painel do boleto).
- A V2 grava a aba ativa que o time deixou (se for uma aba própria) e mantém só uma aba selecionada.
