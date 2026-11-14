---
description: Adiciona um componente interativo (gráfico, abas, quiz, linha do tempo, simulador) a uma apresentação existente
agent: designer-html
argument-hint: componente e slide
---

No arquivo aberto (${file}), adicione o componente **${input:componente:gráfico de barras animado | abas | quiz | linha do tempo | contador | simulador}**
no slide **${input:slide:nº ou título do slide}**, com este conteúdo/dados:

${input:conteudo:Cole os dados ou o texto}

Regras:
- Use o código-base de `.github/skills/apresentacao-html/references/componentes-interativos.md`.
- Mantenha os tokens do guia de marca (paleta, fonte de títulos, Mulish no texto) e as formas (cantos diagonais, curvatura, faixa); não adicione bibliotecas externas.
- Garanta que a animação dispare quando o slide entra e que as setas do teclado continuem funcionando.
- Ao final, diga em 2 linhas o que mudou.
