# Roteiro do facilitador
## Treinamento: Apresentações em HTML interativo, criadas com IA (Copilot)

| | |
|---|---|
| **Público** | Gestores e analistas (não precisam saber programar) |
| **Duração** | 2h30 (versão compacta de 90 min no final) |
| **Formato** | Presencial com notebooks ou Teams com compartilhamento de tela |
| **Turma ideal** | 8 a 25 pessoas (acima disso, tenha um monitor de apoio) |
| **Material** | Apresentação do treinamento (30 slides, em HTML) + este kit |

### Objetivos de aprendizagem — ao final, cada participante consegue:
1. Explicar, em linguagem simples, como a IA generativa produz texto e código — e por que ela erra.
2. Escrever um prompt com o método **CRIAR** e gerar uma apresentação HTML funcional no Copilot.
3. Refinar o resultado conversando com a IA (ajustes, correções, novos componentes).
4. Usar a **Skill** `apresentacao-html` e o **agente** Arquiteto de Apresentações.
5. Aplicar o checklist de qualidade e as regras de segurança de dados.

---

## Checklist pré-treinamento

### D-7
- [ ] Confirmar com a TI: licença Microsoft 365 Copilot dos participantes; **Skills no Copilot Chat**, **Cowork** e **Agent Builder** habilitados; se `.html` pode ser anexado/baixado no Teams/OneDrive.
- [ ] Instalar a fonte de títulos da marca nas máquinas da turma (se houver). Sem ela, os títulos aparecem em Mulish Black — funciona, mas perde personalidade. A Mulish já vai na pasta `fonts/` da skill.
- [ ] Colocar o logo e os ícones oficiais da empresa na pasta `marca/` (`logo.svg`, `logo-negativo.svg`, `icones/`) e validar o uso com a área de Marca.

### D-1
- [ ] Instalar a Skill na sua conta e criar os dois agentes (ver `copilot-m365/COMO-INSTALAR.md`).
- [ ] Rodar o fluxo completo uma vez: prompt → código → salvar `.html` → abrir no Edge → refinar.
- [ ] Compartilhar o link do agente com os participantes (ou deixar para fazer ao vivo no slide 22).
- [ ] Enviar aos participantes: link do kit (SharePoint/Teams) + pedido para testarem o login no Copilot.
- [ ] (Trilha avançada) VS Code + extensão GitHub Copilot instalados em pelo menos 1 máquina para a demo dos agentes.

### No dia
- [ ] Abrir o deck no **Edge**, tecla **F** (tela cheia). Tecla **P** abre o modo apresentador numa janela separada (permita pop-ups).
- [ ] Deixar abertos em abas: Copilot, Bloco de Notas e a pasta do kit.
- [ ] Testar som/tela no projetor; aumentar o zoom do Copilot para 125% na hora da demo.

---

## Atalhos do deck
| Tecla | Ação |
|---|---|
| → / espaço / PageDown | avançar (revela itens um a um quando houver) |
| ← / PageUp | voltar |
| O | mapa da apresentação (pular para qualquer slide) |
| N | notas do apresentador na parte de baixo |
| P | modo apresentador em outra janela (notas, próximo slide, cronômetro) |
| F | tela cheia |
| ? | ajuda |

---

## Roteiro minuto a minuto (2h30)

| Tempo | Slides | O que fazer | Interação |
|---|---|---|---|
| 00:00 | 1–2 Capa e agenda | Abertura, combinados, objetivo. Pergunte: "quem já usou o Copilot esta semana?" | Mãos levantadas |
| 00:05 | 3–4 Por que HTML / A virada | Mostre que o deck **é** HTML feito com IA. Clique no comparativo. | — |
| 00:10 | 5–8 Parte 1: como a IA funciona | Demo da **próxima palavra**: baixe a temperatura e sorteie; depois suba. Ligue as camadas de **contexto** uma a uma. | Peça palpites antes de sortear |
| 00:25 | 9 Ecossistema Copilot | Explique as 4 portas de entrada e o que cada uma faz. Diga o que está liberado na empresa. | — |
| 00:35 | 10–13 Parte 2: CRIAR | Clique em cada letra. Compare prompt fraco × CRIAR (aponte o número inventado). No **Construtor**, preencha com um tema sugerido pela turma e copie. | Turma escolhe o tema |
| 00:55 | 14 **Demo ao vivo** | Faça os 6 passos de verdade no Copilot com o prompt do Construtor. Salve, abra, apresente. | Todos acompanham |
| 01:10 | 15 Refinar | Faça 2–3 refinamentos ao vivo (trocar gráfico, corrigir acento). | Turma sugere ajustes |
| 01:15 | 16–17 Galeria e marca | Mostre cada componente e o prompt para pedi-lo. No slide 17, passe pelas abas Cores, Tipografia, Forma e faixa, Logo (regras do guia de marca). | — |
| 01:25 | **Intervalo 10 min** | | |
| 01:35 | 18–21 Parte 3: Skills | Abra o SKILL.md no explorador do slide 20; explique frontmatter → instruções → recursos. Mostre a instalação. | — |
| 01:50 | 22–23 Agentes | Crie o Arquiteto **ao vivo** no Agent Builder (5 min). Rode o pipeline do slide 23 e, se possível, mostre no VS Code. | — |
| 02:00 | 24–25 Segurança e erros | Marque o checklist com a turma. Abra 2–3 erros no acordeão. | Checklist coletivo |
| 02:05 | 26–27 **Mão na massa** | Inicie o cronômetro (20 min). Circule ajudando. Bronze é obrigatório; Prata e Ouro para quem avançar. | Individual ou em duplas |
| 02:25 | 28 Quiz | Faça em voz alta; a turma vota antes de clicar. | Votação |
| 02:28 | 29–30 Kit e encerramento | Mostre onde está o kit, combine o desafio da semana, Q&A. | Perguntas |

### Versão compacta (90 min)
Slides 1–4 (8 min) → 6 e 7 (10 min) → 11, 13, 14 (25 min) → 16 (5 min) → 19, 20, 22 (15 min) → 24 (3 min) → 27 Bronze (20 min) → 28 e 30 (4 min).

---

## Falas-chave (para não esquecer)
- **"Você não programa — você descreve. E revisa."** O valor do gestor está na mensagem e na revisão, não no código.
- **"A IA prevê; ela não sabe."** Por isso: dados vêm de você, e todo número é conferido.
- **"Contexto é tudo."** Skill e agente são jeitos de dar o contexto certo, sempre, sem digitar de novo.
- **"Skill é o POP da IA."** Procedimento padrão que ela segue quando o assunto aparece.
- **"Agente é o especialista do time."** Tem função, regras e base de conhecimento próprias.

## Perguntas frequentes
**Preciso saber HTML?** Não. Você precisa saber descrever o que quer e conferir o resultado. Peça ao Copilot: "explique esta parte do código em 3 linhas".

**Posso colocar dados da empresa?** Somente no Copilot corporativo, logado com a conta corporativa, e seguindo as políticas internas de classificação da informação. Nunca em IAs públicas/pessoais.

**O Copilot cortou o código no meio.** Peça: "continue exatamente de onde parou" ou "divida o arquivo em 3 partes". No Cowork e no VS Code o arquivo é criado direto, sem esse limite.

**Posso transformar um PPT existente?** Sim: anexe o .pptx e peça "converta em apresentação HTML interativa no padrão da marca, mantendo o conteúdo".

**Como compartilho o HTML?** Envie o arquivo pelo Teams/OneDrive/SharePoint. Algumas políticas de e-mail bloqueiam `.html` anexado — prefira link. Quem receber deve **baixar e abrir** no navegador (a pré-visualização do SharePoint pode não executar o JavaScript).

**Dá para imprimir ou gerar PDF?** Sim: Ctrl+P → "Salvar como PDF" (o deck e o template têm layout de impressão: 1 slide por página).

**Os títulos não estão na fonte da marca.** A fonte não está instalada naquela máquina; o navegador usa o fallback (Mulish Black). Instale a fonte ou coloque o arquivo na pasta `fonts/` ao lado do HTML.

**O logo não aparece.** O HTML precisa estar na mesma pasta de `marca/`. A IA nunca deve redesenhar o logo.

**E se a IA gerar algo errado ou estranho?** Normal: refine. Descreva o que viu ("o botão não faz nada", "o gráfico ficou cortado") e peça a correção. Se travar, comece uma conversa nova colando o arquivo atual.

---

## Depois do treinamento
1. **Desafio da semana**: cada participante faz a próxima apresentação de reunião em HTML e posta no canal do Teams.
2. **Galeria**: crie uma pasta no SharePoint com as melhores apresentações (vira exemplo para a skill evoluir).
3. **Evolua a skill**: colete os prompts e ajustes mais pedidos e incorpore ao `SKILL.md` (versão 1.1, 1.2...).
4. **Pesquisa rápida** de satisfação (3 perguntas) e lista de quem quer a trilha avançada (VS Code + agentes).
