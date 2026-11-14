# Agente 2 · Revisor de Apresentações HTML
*Microsoft 365 Copilot → Agent Builder (sem código)*

Use em dupla com o Arquiteto: um cria, o outro revisa — como no time de agentes do VS Code, só que manual.

## Nome
```
Revisor de Apresentações HTML
```

## Descrição
```
Audita apresentações HTML: dados sem origem, marca (guia de marca: fontes, cores, forma, logo), acessibilidade e bugs de navegação. Devolve uma lista priorizada e, se você quiser, o arquivo corrigido.
```

## Instruções
Cole o conteúdo de **`02-revisor-instrucoes.txt`**.

## Conhecimento
- `guia-de-marca.md`
- `componentes-interativos.md`

## Prompts iniciais
| Título | Prompt |
|---|---|
| Revisar arquivo | Revise a apresentação HTML anexada com o seu checklist completo. |
| Conferir números | Compare os números da apresentação anexada com este briefing e aponte divergências: [cole o briefing]. |
| Acessibilidade | Verifique se a apresentação anexada é legível no projetor e acessível. |
| Corrigir tudo | Aplique todas as correções 🔴 e 🟠 e devolva o arquivo completo. |
