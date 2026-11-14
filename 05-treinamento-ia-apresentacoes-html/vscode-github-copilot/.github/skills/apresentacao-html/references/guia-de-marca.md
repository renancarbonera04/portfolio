# Guia de marca para apresentações HTML (modelo)

> Este arquivo é um **modelo neutro**. Substitua cada item pelas regras do guia de marca da sua empresa. A IA lê este arquivo como fonte de verdade para a identidade visual.

## Tipografia
| Uso | Fonte | Regra |
|---|---|---|
| Títulos e chamadas curtas | `--titulo` (padrão: Mulish Black) | CAIXA ALTA, no máximo ~6 palavras, nunca em parágrafos |
| Subtítulos | Mulish Light | Afirma a conclusão do slide |
| Texto, dados, legendas | Mulish Regular / Bold | Corpo ≥ 24 px no palco de 1600×900 |
| Números-chave | Mulish Light, cor `--destaque` | Grandes, com unidade menor ao lado |

## Paleta
| Token | Cor | Uso |
|---|---|---|
| `--fundo` | `#F6F6F3` | Fundo dos slides de conteúdo |
| `--tinta` | `#172B4D` | Texto, capa, divisórias |
| `--primaria` | `#1D4E89` | Divisórias, campos de cor |
| `--destaque` | `#2A78D6` | Destaques, gráficos, botões, faixa |
| `--acento` | `#E0A100` | Meta em gráficos, detalhes |
| `--sucesso` / `--alerta` / `--info` | `#2E8B57` / `#C0583A` / `#1BA6C9` | Feedback (quiz, status), só em detalhes |

Regras: cores chapadas, sem degradê; a paleta primária ocupa a maior parte da composição; cores de apoio só em detalhes.

## Forma
- Cards com cantos diagonais arredondados (`border-radius: var(--diag)`).
- Campos de cor com um canto curvo (`--raio-p`, `--raio-m`, `--raio-g`) e, opcionalmente, uma faixa na cor de destaque no topo.
- Barras e colunas com um canto arredondado.

## Logo e ícones
- Coloque os arquivos oficiais da sua empresa em `marca/`: `logo.svg` (para fundo claro), `logo-negativo.svg` (para fundo escuro) e `icones/`.
- Use sempre como `<img>`. **Nunca** peça para a IA desenhar, recolorir, rotacionar, distorcer ou aplicar efeitos no logo.

## Tom
Executivo e direto: um título-mensagem por slide, uma ideia por slide, números sempre com fonte e data.
