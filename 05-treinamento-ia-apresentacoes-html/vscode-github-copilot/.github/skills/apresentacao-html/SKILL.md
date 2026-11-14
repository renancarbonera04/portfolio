---
name: apresentacao-html
description: Cria apresentações interativas em um único arquivo HTML seguindo o guia de marca da empresa (fontes, paleta via variáveis CSS, logo oficial como imagem), com navegação por teclado, notas do apresentador e componentes interativos (gráficos animados, abas, contadores, quiz, linha do tempo, simulador). Use quando o usuário pedir para criar, converter (PPT, Excel, PDF), revisar ou melhorar uma apresentação, deck, slides, pitch ou material de treinamento em HTML.
argument-hint: "[tema] [público] [nº de slides]"
---

# Apresentação HTML interativa

## Objetivo
Transformar um briefing (tema, público, mensagens e dados) em **um único arquivo `.html`** que abre com duplo clique no Edge ou no Chrome, funciona offline e segue o guia de marca da empresa. O HTML fica numa pasta junto com `marca/` (logo e ícones da empresa) e `fonts/` (Mulish).

## Fluxo de trabalho (siga nesta ordem)
1. **Entenda o briefing.** Se faltar algo essencial, faça no máximo 3 perguntas curtas: (a) público e objetivo da reunião; (b) mensagens-chave e dados disponíveis; (c) duração ou número de slides. Se o usuário pedir para seguir sem perguntas, assuma padrões razoáveis e liste as suposições no final.
2. **Proponha o roteiro** em tabela: nº | título (curto, caixa alta) | subtítulo (a conclusão) | conteúdo/dado | visual | interação. Aguarde o OK, a menos que o usuário peça para gerar direto.
3. **Gere o HTML** partindo de `assets/template-apresentacao.html` (copie tokens, cabeçalho, núcleo de navegação e componentes; troque só os slides).
4. **Autoverifique** com o checklist de qualidade abaixo.
5. **Entregue** o arquivo + "Como usar" (3 linhas) + até 3 sugestões de refinamento. Lembre o usuário de manter as pastas `marca/` e `fonts/` (de `assets/` desta skill) ao lado do HTML.

## Regras técnicas obrigatórias
- **Um único arquivo HTML**: CSS em `<style>`, JavaScript em `<script>`. Proibido: CDN, bibliotecas, Google Fonts, imagens da internet. Recursos locais permitidos apenas das pastas `marca/` e `fonts/`.
- Comece com `<!DOCTYPE html>`, `<html lang="pt-BR">`, `<meta charset="UTF-8">` e `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- **Palco 16:9** de 1600×900 px escalado via JavaScript para caber em qualquer tela.
- **Navegação**: ← → / PageUp PageDown / espaço / Home / End; botões; faixa de progresso; contador "3 / 12"; link direto `#/n`.
- **Atalhos**: `F` tela cheia · `N` notas do apresentador · `O` visão geral. Ignore atalhos com o foco em campos.
- **Notas do apresentador** em `<aside class="notes">` em cada slide.
- **Gráficos** só com SVG ou CSS, animados quando o slide entra, com rótulos de valor. Nunca dependa só da cor.
- **Código comentado em português**, em seções: 1 TOKENS · 2 LAYOUT · 3 COMPONENTES · 4 SLIDES · 5 SCRIPT.
- **Acessibilidade**: contraste AA, corpo ≥ 24 px, `aria-label` em botões de ícone, `prefers-reduced-motion`.
- **Arquivos longos**: se a resposta puder ser cortada, divida em partes ("Parte 1 de 3") e peça "continue".
- Com ferramenta de arquivos (VS Code, Cowork), **crie o arquivo** `apresentacoes/<tema-em-kebab-case>.html` e copie `assets/marca/` e `assets/fonts/` desta skill para `apresentacoes/marca/` e `apresentacoes/fonts/`.

## Identidade visual
Use **sempre** variáveis CSS — nunca cores soltas no código. O padrão abaixo é **neutro**: troque os valores pelos da sua marca em `references/guia-de-marca.md` e no template.

```css
@font-face{font-family:'Mulish';src:local('Mulish'),url('fonts/Mulish-Regular.woff2') format('woff2');font-weight:400}
/* + Mulish Light 300, Bold 700 e Black 900 (arquivos em fonts/) */
:root{
  --titulo:'Mulish','Segoe UI',Arial,sans-serif;  /* títulos curtos, CAIXA ALTA, peso 900 */
  --texto:'Mulish','Segoe UI',Arial,sans-serif;   /* textos, dados, legendas */
  /* Paleta primária — ocupa a maior parte da composição */
  --fundo:#F6F6F3;     /* fundo dos slides de conteúdo */
  --tinta:#172B4D;     /* texto, capa, divisórias */
  --primaria:#1D4E89;  /* divisórias, campos de cor */
  --destaque:#2A78D6;  /* destaques, gráficos, botões, faixa */
  /* Paleta de apoio — só detalhes, destaques e diferenciação */
  --acento:#E0A100; --sucesso:#2E8B57; --info:#1BA6C9; --alerta:#C0583A;
  /* Curvatura dos campos de cor (pequena / média / grande) */
  --raio-p:34px; --raio-m:66px; --raio-g:100px;
  --diag:26px 0 26px 0;  /* cards: cantos diagonais arredondados */
}
```
- **Tipografia**: fonte de títulos só em títulos e chamadas curtas, em CAIXA ALTA (nunca em parágrafos ou títulos longos). *Mulish* para todo o resto (Light para subtítulos, Regular para texto, Bold para ênfase). Números-chave grandes em Mulish Light, na cor de destaque.
- **Composição**: um título curto + subtítulo que afirma a conclusão ("Sul cresceu 12% no tri"). Uma ideia por slide.
- **Fundos**: conteúdo em `--fundo`; capa/divisórias/encerramento em `--tinta`, `--primaria` ou `--destaque`, **cores chapadas, sem degradê**.
- **Forma**: campos de cor sólida com um canto curvo e, opcionalmente, uma **faixa** na cor de destaque no limite superior do campo. Cards com cantos diagonais arredondados. Faixa de progresso no rodapé.
- **Logo**: só o arquivo da empresa, via `<img src="marca/logo.svg">` (fundo claro) ou `marca/logo-negativo.svg` (fundo escuro). **Nunca peça para a IA desenhar, recolorir, rotacionar ou distorcer o logo**, nem digitar o código SVG dele.
- **Ícones**: só os da biblioteca da empresa (`marca/icones/`), sem rotacionar ou esticar.
- Guia completo: `references/guia-de-marca.md`.

## Qual componente usar
O código-base de cada um está em `references/componentes-interativos.md`.

| Quero mostrar... | Componente |
|---|---|
| Evolução no tempo | Colunas animadas (canto superior direito curvo) |
| Comparação entre itens | Barras horizontais ordenadas (maior → menor), meta na cor de acento |
| Um número de impacto | Contador animado em Mulish Light, na cor de destaque |
| Várias categorias no mesmo slide | Abas |
| Detalhe sob demanda | Acordeão (`<details>`) ou card que vira |
| Marcos de um projeto | Linha do tempo clicável |
| Engajar ou checar entendimento | Quiz com feedback |
| Cenários "e se" | Simulador com controle deslizante |
| Mensagem de destaque | Campo de cor com curvatura + faixa |

## Dados e conteúdo
- Use **apenas** números fornecidos pelo usuário ou presentes nos arquivos anexados. Se faltar, use `[XX]` e avise — **nunca invente números**.
- Cite fonte e data dos dados no rodapé do slide (`.fonte-dados`).
- Não inclua dados pessoais ou confidenciais que não estejam no briefing.

## Checklist de qualidade (rode antes de entregar)
- [ ] Abre com duplo clique, sem erros no console (F12); acentos corretos (UTF-8).
- [ ] Navegação por teclado e clique do primeiro ao último slide.
- [ ] Números conferem com o briefing; `[XX]` sinalizados.
- [ ] Fonte de títulos só em títulos curtos e em caixa alta; textos em Mulish.
- [ ] Só cores da paleta, via variáveis; cores de apoio apenas em detalhes; sem degradês.
- [ ] Logo e ícones apenas como `<img>` dos arquivos de `marca/`, na versão de cor correta para o fundo.
- [ ] Nenhuma dependência externa (procure por `http` no código).
- [ ] Notas do apresentador em todos os slides de conteúdo; legível no projetor.

## Formato da resposta
1. Roteiro (se ainda não aprovado).
2. Arquivo completo em um único bloco de código `html` — ou o arquivo criado no workspace.
3. **Como usar**: salvar como `.html` (UTF-8) na mesma pasta de `marca/` e `fonts/` → abrir no Edge/Chrome → `F` tela cheia, `N` notas, `O` visão geral.
4. Até 3 sugestões de melhoria.
