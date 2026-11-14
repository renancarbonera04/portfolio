# Copilot do Microsoft 365 — como instalar a Skill e criar os agentes

> **Antes do treinamento, valide com a TI** o que está liberado no tenant da empresa: Skills no Copilot Chat, Copilot Cowork e Agent Builder dependem de licença e de habilitação pelo administrador.
> A Microsoft muda os nomes dos menus com frequência — em novembro de 2026 ela está unificando "Agentes", "Skills" e "Personalizar" em um único botão **Plugins**. Se o caminho abaixo estiver diferente, procure por *Skills*, *Plugins* ou *Agentes* no menu lateral do Copilot.

---

## A. Skill `apresentacao-html`

### Opção 1 — Upload pelo Copilot (Chat ou Cowork)
1. Abra o Copilot com a conta corporativa (copilot.cloud.microsoft, Teams ou Edge).
2. Vá em **Plugins / Skills** (ou **Personalizar → Skills** no Cowork) → seta ao lado de **Adicionar** → **Carregar skill**.
3. Compacte a pasta `vscode-github-copilot/.github/skills/apresentacao-html/` em **`apresentacao-html.zip`** (com o `SKILL.md` dentro da pasta) e envie.
   - Se o .zip for recusado, envie apenas o `SKILL.md` ou use a Opção 2.
4. Inicie uma conversa nova e teste: *"Crie uma apresentação HTML de 5 slides sobre [tema] usando a skill apresentacao-html"*.

### Opção 2 — Pasta no OneDrive (Copilot Cowork)
1. No seu OneDrive, crie: `Documentos/Cowork/skills/apresentacao-html/`
   (o nome da pasta precisa ser **idêntico** ao campo `name` do SKILL.md).
2. Copie para dentro dela o conteúdo de `vscode-github-copilot/.github/skills/apresentacao-html/` (SKILL.md + `references/` + `assets/`).
3. Abra uma conversa nova no Cowork — a skill aparece automaticamente.

### Para o time inteiro
Peça à TI para publicar a skill como plugin da organização (Centro de administração do Microsoft 365 → Agentes → Ferramentas → Carregar). Assim ninguém precisa instalar manualmente.

---

## B. Agentes no Agent Builder

1. No Copilot, clique em **Agentes/Plugins → Novo agente** (ou **Criar agente**).
2. Clique em **Ignorar / Configurar** para preencher manualmente (em vez de descrever por conversa).
3. Preencha **Nome, Descrição, Instruções** com os textos de `agentes/01-arquiteto-de-apresentacoes.md` e `01-arquiteto-instrucoes.txt`.
4. Em **Conhecimento**, anexe o template (`assets/`), o guia de marca e os componentes (`references/`) da skill.
   - Se `template-apresentacao.html` não for aceito, use `template-apresentacao.txt` (mesmo conteúdo).
5. Adicione os **prompts iniciais** sugeridos.
6. Teste no painel à direita → **Criar** → **Compartilhar** com o time.
7. Repita para o **Revisor** (`agentes/02-revisor-de-apresentacoes.md`).

---

## C. Sem Skills nem Agent Builder liberados?
O treinamento continua funcionando:
- Use a `roteiro/biblioteca-de-prompts.md`.
- Anexe o template (renomeado para `.txt`) e o `guia-de-marca.md` na conversa e peça: *"Siga este template e este guia de marca"*.
- Salve o HTML gerado numa pasta com `marca/` (logo da empresa) e `fonts/` (da skill) para o logo e as fontes aparecerem.
- Cole o conteúdo do `SKILL.md` no início da conversa — funciona como uma skill "manual".
