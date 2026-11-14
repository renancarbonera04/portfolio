# Biblioteca de prompts — Apresentações HTML com Copilot

Copie, troque o que está entre [colchetes] e cole no Copilot.
Se a **Skill** `apresentacao-html` ou o **agente** Arquiteto estiverem instalados, você pode encurtar os prompts — as regras de marca e técnicas já vêm de lá.

---

## 1. Criar do zero (método CRIAR completo)
```
[C] Sou [cargo/área] e vou apresentar "[tema]" para [público] em [X] minutos. Objetivo: [decisão ou ação esperada].
[R] Crie UM único arquivo HTML autocontido (HTML, CSS e JavaScript no mesmo arquivo, sem bibliotecas nem links externos), com [N] slides 16:9, pronto para abrir no Edge com duplo clique.
[I] Identidade (guia de marca da empresa): títulos curtos em CAIXA ALTA na fonte de títulos [nome da fonte] (fallback Mulish Black) e textos em 'Mulish'; cores por variáveis CSS: --fundo [#F6F6F3], --tinta [#172B4D] (texto e capa), --primaria [#1D4E89], --destaque [#2A78D6] (destaques e gráficos); cores de apoio só em detalhes. Cores chapadas; cards com cantos diagonais arredondados; logo apenas como <img src="marca/logo.svg">. Subtítulo em Mulish dizendo a conclusão. Tom [executivo/didático/inspirador].
[A] Interatividade: navegação por setas e botões, barra de progresso, tela cheia (F), notas do apresentador (N), [gráfico de barras animado / contadores / abas / linha do tempo / quiz].
[R] Regras: use só os dados abaixo — não invente números (use [XX] se faltar); <meta charset="UTF-8">; código comentado em português; antes do código, mostre o roteiro em tabela e espere meu OK.
Dados: [cole aqui]
```

## 2. Com a Skill instalada
```
/apresentacao-html [tema] para [público], [N] slides. Dados: [cole aqui]
```
ou, no Copilot Chat/Cowork: *"Use a skill apresentacao-html para criar..."*

## 3. Converter material existente
- **PPT → HTML:** `Converta o PowerPoint anexado em uma apresentação HTML interativa no padrão da marca. Mantenha o conteúdo, reescreva os títulos como mensagens e transforme tabelas em gráficos animados.`
- **Excel → gráficos:** `Use a planilha anexada (aba [nome]) para criar 4 slides: resumo com 3 contadores, evolução mensal em colunas, ranking em barras ordenadas e conclusões. Mostre o roteiro antes.`
- **Documento → treinamento:** `Transforme o documento anexado em um treinamento interativo de [X] minutos: linha do tempo, cards que viram com conceitos-chave e quiz final de 5 perguntas.`

## 4. Refinar (um pedido por vez funciona melhor)
- `Troque o gráfico do slide [N] por barras horizontais ordenadas do maior para o menor, com a meta na cor de acento.`
- `O slide [N] tem texto demais. Reduza para no máximo 3 bullets de até 8 palavras e mova o resto para as notas do apresentador.`
- `Reescreva todos os títulos como mensagens (a conclusão), no máximo 8 palavras.`
- `Adicione um slide de resumo executivo com 3 números-chave em contadores animados: [valores].`
- `Adicione abas no slide [N] com as categorias [A], [B] e [C].`
- `Adicione um quiz de 3 perguntas com feedback no final, sobre o conteúdo da apresentação.`
- `Adicione um simulador: controle deslizante de [variável] de [min] a [max] que recalcula [resultado] com a fórmula [fórmula].`
- `Escreva notas do apresentador para todos os slides (2–3 frases cada, com o tempo sugerido).`
- `Adapte esta apresentação para [outro público]: menos detalhe técnico, mais impacto no negócio.`

## 5. Corrigir problemas
- **Acentos estranhos (Ã§, Ã£):** `Os acentos aparecem quebrados. Garanta <meta charset="UTF-8"> no início do <head> e me lembre de salvar em UTF-8.`
- **Código cortado:** `Sua resposta foi cortada. Continue exatamente de onde parou, sem repetir o que já foi enviado.` / `Divida o arquivo completo em 3 partes numeradas.`
- **Nada acontece ao apertar as setas:** `A navegação não funciona. O console (F12) mostra: [cole o erro]. Explique a causa e devolva o arquivo corrigido.`
- **Gráfico não anima:** `O gráfico do slide [N] aparece sem animação. Faça a animação disparar sempre que o slide entrar.`
- **Títulos fora da fonte da marca:** `Declare @font-face para '[fonte de títulos]' com local('[fonte de títulos]') e url('fonts/[arquivo].woff2'), e para 'Mulish' com os arquivos da pasta fonts/; mantenha o fallback Mulish Black.`
- **Fora do guia de marca:** `Revise as cores: use só a paleta do guia de marca via variáveis (--fundo, --tinta, --primaria, --destaque; cores de apoio só em detalhes), sem degradês, e títulos curtos em caixa alta na fonte de títulos.`
- **Não cabe na tela do projetor:** `Use um palco fixo de 1600x900 escalado por JavaScript para caber em qualquer tela.`

## 6. Revisar antes de apresentar
```
Revise esta apresentação como um diretor exigente e como um especialista em acessibilidade:
1) números sem origem nos dados que passei; 2) títulos que não afirmam conclusão; 3) slides com mais de uma ideia;
4) contraste e tamanho de fonte; 5) qualquer link externo. Responda em tabela com prioridade e correção.
```

## 7. Aprender com o código
- `Explique em linguagem simples, em 5 linhas, como funciona a navegação deste arquivo.`
- `Onde eu mudo as cores e a fonte neste arquivo? Mostre só as linhas.`
- `Como faço para adicionar um novo slide igual ao slide [N]? Me dê o trecho para copiar.`
