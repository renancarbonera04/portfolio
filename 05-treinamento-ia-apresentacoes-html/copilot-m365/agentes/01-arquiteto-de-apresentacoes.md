# Agente 1 · Arquiteto de Apresentações
*Microsoft 365 Copilot → Agent Builder (sem código)*

Copie cada campo abaixo para a aba **Configurar** do Agent Builder.

---

## Nome
```
Arquiteto de Apresentações
```

## Descrição
```
Cria apresentações interativas em HTML no padrão visual da empresa a partir do seu briefing, planilha ou PPT — com roteiro, gráficos animados, quiz e notas do apresentador. Também ajusta e corrige arquivos HTML.
```

## Instruções
Cole o conteúdo completo de **`01-arquiteto-instrucoes.txt`** (≈ 4.500 caracteres; o limite do campo é 8.000).

## Conhecimento (anexe os arquivos da skill em `vscode-github-copilot/.github/skills/apresentacao-html/`)
| Arquivo | Para que serve |
|---|---|
| `assets/template-apresentacao.html` (renomeie para `.txt` se o .html não for aceito) | Núcleo de navegação e estrutura base no padrão do guia de marca |
| `references/guia-de-marca.md` | Resumo do guia de marca da empresa: tipografia, paleta, curvatura, faixa, logo e ícones |
| O guia de marca oficial em PDF (opcional) | O guia completo, se o tamanho for aceito |
| `references/componentes-interativos.md` | Código dos gráficos, abas, quiz, linha do tempo etc. |

> Dica: se a sua organização preferir, suba esses arquivos para uma pasta do SharePoint do time e aponte o agente para ela — assim todos atualizam no mesmo lugar.

## Prompts iniciais (conversation starters)
| Título | Prompt |
|---|---|
| Criar do zero | Quero criar uma apresentação interativa. Faça as perguntas do briefing. |
| Converter PPT | Converta o PowerPoint anexado em uma apresentação HTML interativa no padrão da marca, mantendo o conteúdo e melhorando os títulos. |
| Planilha → gráficos | Use a planilha anexada para montar 5 slides com gráficos animados e um slide de conclusões. Mostre o roteiro antes. |
| Adicionar quiz | Adicione um quiz de 3 perguntas com feedback ao final da apresentação que vou colar. |
| Treinamento | Monte um treinamento interativo de 20 minutos sobre [tema], com linha do tempo e quiz. |
| Corrigir erro | Minha apresentação HTML está com um problema: [descreva]. Vou colar o código. |

## Recursos / capacidades
- **Pesquisa na web**: desligada (o agente deve usar só os dados fornecidos).
- **Interpretador de código** (se disponível na sua licença): opcional — ajuda a ler planilhas grandes.

## Teste antes de publicar (aba "Testar"/"Try it")
1. Use o starter **Criar do zero** com o briefing do exercício Bronze.
2. Confira se ele mostrou o roteiro antes do código.
3. Salve o HTML, abra no Edge e rode o checklist.
4. Peça um número que não existe ("qual foi o crescimento em outubro?") — ele deve responder `[XX]` e avisar, sem inventar.

## Compartilhar com o time
Crie o agente → **Compartilhar** → escolha pessoas/grupo do time. Quem recebe o link encontra o agente na lista de agentes/plugins do Copilot.
