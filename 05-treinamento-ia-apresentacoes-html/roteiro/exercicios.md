# Mão na massa — Desafio em 3 níveis

Tempo sugerido: **20 a 25 minutos**. Bronze é para todos; Prata e Ouro para quem terminar antes.
Pode ser feito individualmente ou em duplas (uma pessoa "pilota" o Copilot, a outra revisa).

> **Dados fictícios para o exercício** — use estes se não quiser usar dados reais da sua área.
> *Regional Exemplo · 3º trimestre (valores ilustrativos)*
> - Volume (mil unidades): Jul 120 · Ago 135 · Set 142 · Meta do trimestre 390
> - Cobertura de clientes: 78% → 86%
> - Crescimento por canal: Bares 14% · Supermercados 9% · Adegas 6% · Conveniência 3%
> - Ações do Q4: (1) roteiro inteligente de visitas; (2) kit de execução para adegas; (3) treinamento de vendedores
> - Pergunta para o quiz: "Qual canal mais cresceu?" → Bares

---

## 🥉 Bronze — Minha primeira apresentação HTML
**Objetivo:** gerar, salvar e apresentar um HTML funcional usando só o Copilot Chat.
1. No slide 13 do treinamento (Construtor de prompts), preencha com os dados acima e clique em **Copiar prompt**.
2. Cole no Copilot. Aprove o roteiro. Peça o código completo.
3. Salve como `minha-apresentacao.html` (Bloco de Notas → Salvar como → Tipo: *Todos os arquivos* → Codificação: *UTF-8*).
4. Abra no Edge e navegue do início ao fim.
5. Faça **1 refinamento** (ex.: "transforme o slide de canais em barras ordenadas").

**Critérios de sucesso:** abre sem erros · 4+ slides · navegação por setas · paleta e fontes do guia de marca · logo oficial aparecendo (HTML salvo na pasta com `marca/`) · nenhum número inventado.

## 🥈 Prata — Interatividade com a Skill
**Objetivo:** usar a Skill (ou o SKILL.md colado na conversa) para elevar o nível.
1. Peça, usando a skill `apresentacao-html`, uma apresentação com: resumo executivo com **3 contadores animados**, **colunas** de volume mensal com a meta, **abas** com as 3 ações do Q4 e **quiz** final.
2. Peça notas do apresentador para todos os slides.
3. Rode o checklist de qualidade (slide 24) e corrija pelo menos 1 item com a IA.

**Critérios de sucesso:** 3 componentes interativos funcionando · notas com a tecla N · checklist completo.

## 🥇 Ouro — Seu próprio agente
**Objetivo:** criar o agente e gerar uma apresentação inteira por ele.
- **Trilha M365:** crie o **Arquiteto de Apresentações** no Agent Builder (textos em `copilot-m365/agentes/`), anexe o conhecimento, teste e compartilhe com sua dupla. Use o starter "Planilha → gráficos" com uma planilha de dados fictícios.
- **Trilha VS Code:** copie a pasta `.github` do kit para um projeto, selecione o agente **roteirista**, cole o briefing, aprove o roteiro e use os botões de handoff até o **revisor**.

**Critérios de sucesso:** agente criado e testado · roteiro antes do código · revisão feita pelo Revisor (agente) · apresentação final aberta e projetada.

---

## Rubrica rápida (para o facilitador)
| Critério | 0 | 1 | 2 |
|---|---|---|---|
| Funciona (abre, navega, sem erros) | não abre | abre com falhas | perfeito |
| Mensagem (títulos-conclusão, 1 ideia/slide) | tema solto | parcial | todos os slides |
| Dados (sem invenção, com fonte) | número inventado | sem fonte | ok |
| Marca (guia de marca: fontes, paleta, forma, logo oficial) | fora do padrão | parcial | ok |
| Interatividade útil (não só enfeite) | nenhuma | 1 componente | 2+ alinhados à mensagem |

**8–10:** pronto para usar em reunião · **5–7:** mais uma rodada de refinamento · **0–4:** refazer com a skill/agente.
