# Boletos a cobrar — V2 · Guia rápido do time

O sistema é **um arquivo só**: `Boletos-a-cobrar-v2.html`, na pasta do financeiro.
Os dados ficam na planilha **`Boletos a cobrar.xlsx`**, na mesma pasta da rede
(ex.: `\\servidor\...\financeiro\bases\`). Cada mudança que você faz é gravada
sozinha na planilha, na hora. Não precisa de internet.

## 1. Primeiro uso (cada pessoa, uma vez)

1. Abra a pasta da rede e dê **dois cliques** em `Boletos-a-cobrar-v2.html` (abre no Edge ou no Chrome).
2. Digite **seu nome**. Ele fica lembrado neste computador e aparece em "Alterado por".
3. Clique em **Escolher a pasta da planilha**, escolha a pasta `bases` e confirme.
   Quando o navegador perguntar, clique em **Permitir** (ou "Editar arquivos").
4. Se a planilha ainda for da V1, o sistema atualiza para a V2 sozinho e guarda uma cópia
   antes, na subpasta `backup`. Nenhum dado é apagado.

> Se aparecer que "este computador não deixa gravar pela pasta", o sistema passa a usar o
> outro caminho sozinho: escolher a planilha e responder **Sim** em "substituir". É seguro:
> ele regrava a planilha na mesma hora, com tudo dentro.

## 2. Todo dia

- Abra o arquivo. Você já vê os dados (a última cópia guardada no seu computador).
- Clique no botão verde **Liberar a planilha** e confirme a pergunta do navegador:
  - **Permitir**, ou
  - a janela da pasta (confirme a pasta), ou
  - a janela de arquivo: escolha `Boletos a cobrar.xlsx` e responda **Sim** em "substituir".
- Pronto: até fechar o navegador, nenhuma outra pergunta. F5 não pede de novo.

## 3. O indicador no topo

| Mostra | Quer dizer |
|---|---|
| **Salvo às 14:32** | Tudo gravado na planilha. |
| **Gravando…** | Gravando agora (leva 1 ou 2 segundos). |
| **Pendente: N alterações** | Ainda não conseguiu gravar (ex.: planilha aberta no Excel). **Suas alterações estão guardadas** neste computador e o sistema tenta de novo sozinho. |
| **Clique para liberar** | Falta liberar a gravação (item 2). |

Mesmo fechando o navegador ou dando F5 com algo pendente, nada se perde: na próxima vez
o sistema grava o que ficou guardado.

Ao lado aparece quem mais está com o sistema aberto ("Maria e João estão com o sistema aberto").

## 4. O dia a dia de cobrança

- **Hoje**: o que fazer hoje — promessas quebradas, ações marcadas para hoje, promessas que
  vencem hoje, boletos que vencem hoje e que venceram ontem (na segunda-feira inclui o fim de semana),
  e vencidos sem próxima ação. Botão **Só os meus** para ver só os seus.
- **Boletos**: a lista com busca, filtros, faixas de atraso (aging) e seleção de vários
  (Espaço ou clique na caixinha) para dar baixa em lote, mudar etapa, responsável etc.
  Clique num boleto (ou Enter) para abrir o painel do lado com tudo dele.
- **Registrar contato**: canal, com quem falou, anotação, promessa de pagamento e próxima ação.
- **Mensagem**: texto pronto para WhatsApp, e-mail ou recado, com juros/multa calculados.
  Botões para copiar e para abrir o WhatsApp/e-mail.
- **Dar baixa**: total ou parcial, com desconto e juros/multa cobrados. Errou? **Ctrl+Z**
  desfaz, ou **Estornar** o pagamento no painel do boleto.
- **Novo**: lançamento pelo teclado (Enter passa para o próximo campo, **Ctrl+Enter** salva).
  Cole a linha digitável e o sistema preenche valor e vencimento.
- **Conciliação**: importe o extrato (OFX), o retorno do banco (CNAB 240/400) ou um CSV;
  o sistema sugere as baixas e você confere antes de aplicar.
- **Clientes**, **Painel** (gráficos e relatório do período), **Calendário**.
- Em **Mais**: Importar planilha/CSV, Lixeira, Histórico, Verificar planilha, Configurações,
  Diagnóstico e Ajuda.

Atalhos: aperte **?** em qualquer tela para ver todos (H = Hoje, B = Boletos, N = Novo,
/ = buscar, R = baixa, C = contato, M = mensagem, Ctrl+Z / Ctrl+Y = desfazer / refazer).

## 5. Regras de convivência (importante)

1. **Não deixe a planilha aberta no Excel à toa.** Enquanto ela estiver aberta lá, ninguém
   grava pelo sistema (as alterações ficam esperando, sem se perder). Abriu? Salve e feche logo.
2. **Sem senha e sem rótulo de confidencialidade** na planilha. O navegador não consegue ler
   arquivos protegidos.
3. **Não apague linhas no Excel.** Use a **Lixeira** do sistema (dá para restaurar com um clique).
   Se alguém apagar no Excel, o sistema aceita, mas registra no Histórico o que foi apagado.
4. Pode **criar colunas e abas suas** na planilha (ex.: "Região", "Minhas notas") e fórmulas
   nelas: o sistema mantém. Não mude os títulos da primeira linha das abas do sistema.
5. **Todo mundo usa a V2.** A V1 não conhece as abas novas e gravaria por cima delas.
   (Se acontecer, a V2 recupera o que der e avisa.)
6. Não renomeie nem mova a planilha sem avisar o time.
7. Use o sistema em **uma aba só** do navegador (se abrir duas, ele avisa). Funciona, mas uma aba é mais simples.

## 6. Se aparecer um aviso

| Aviso | O que fazer |
|---|---|
| "A planilha está aberta no Excel" | Peça para quem está com ela aberta salvar e fechar. O sistema grava sozinho em seguida. |
| "Não achei a planilha" | A rede caiu ou alguém moveu/renomeou o arquivo. Confira a pasta. Se mudou de lugar, use **Trocar de planilha** (clique no indicador do topo). |
| "A planilha está com senha ou rótulo" | Abra no Excel, tire a senha/rótulo, salve e feche. |
| "A pasta da rede está demorando" | Rede lenta. O sistema tenta de novo; nada se perde. |
| "Fulano mudou \"Observação\" do boleto 12 depois de você; ficou a alteração dela" | Duas pessoas mudaram o mesmo campo do mesmo boleto quase juntas: fica a mudança mais recente. Confira o boleto. |
| Qualquer outra coisa | **Mais › Diagnóstico › Copiar relatório** e mande para quem cuida do sistema. |

**Backups**: a subpasta `backup` (ao lado da planilha) recebe uma cópia automática a cada
hora de uso e antes de operações grandes (importação, conciliação, renegociação, baixa em lote,
atualização da V1). Ficam as 30 mais recentes (dá para mudar em Configurações). Para baixar ou
voltar uma: **Mais › Diagnóstico › Backups**. (No computador em que a gravação é liberada pelo
"substituir", as cópias ficam guardadas no próprio navegador, no mesmo lugar do Diagnóstico.)

## 7. Primeiro dia: teste com o time (10 minutos)

1. Duas pessoas abrem o sistema, cada uma no seu computador, e liberam a gravação.
2. Ao mesmo tempo: uma lança um boleto novo, a outra registra um contato em outro boleto.
   Em poucos segundos, cada uma deve ver a mudança da outra, e o indicador deve mostrar "Salvo às…".
3. As duas mudam a **Observação do mesmo boleto** quase juntas: deve ficar a última, com aviso.
4. Uma terceira pessoa abre a planilha no Excel e deixa aberta; alguém faz uma mudança no sistema:
   deve aparecer "Pendente" e o aviso do Excel. Feche o Excel: em segundos deve voltar a "Salvo".
5. Abra a planilha no Excel (depois de fechar todos os testes) e confira se está tudo lá.

Se algo disso não acontecer, use **Mais › Diagnóstico › Copiar relatório** em cada computador.
