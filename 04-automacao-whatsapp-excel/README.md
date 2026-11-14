# 📲 Excel + WhatsApp: primeiro contato automático com clientes

Macro em **VBA** que lê uma base de clientes no Excel e envia, pelo **WhatsApp Web**, uma mensagem de apresentação personalizada para cada cliente, registrando o resultado na própria planilha.

Criei para acelerar o primeiro contato da rotina de cobrança no meu estágio em Finanças. Esta é a versão pública: **sem dados reais, sem marca e sem o nome da planilha interna**.

## Como funciona

Para cada cliente com a coluna **Status** vazia:

1. Junta todas as linhas do mesmo cliente (vários títulos geram **uma mensagem só**).
2. Valida e normaliza o telefone (DDD, DDI 55, zeros à esquerda); se for inválido, marca `ERRO` sem tentar enviar.
3. Abre a conversa pelo link `web.whatsapp.com/send?phone=…`, que funciona mesmo com número não salvo e não corre o risco de abrir a conversa de outra pessoa.
4. **Confere na tela** que a mensagem certa apareceu na caixa de texto antes de enviar.
5. Envia e **confere que a caixa esvaziou** (envio confirmado).
6. Escreve `ENVIADO dd/mm/aaaa hh:mm`, `NAO ENVIADO – motivo` ou `VERIFICAR` na planilha.

## Pensado para não dar errado

| Risco | Proteção |
|---|---|
| Mandar mensagem para a pessoa errada | Abre a conversa pelo número (nunca pela busca) e confere o texto antes de enviar |
| Usuário mexer no computador durante o envio | Se o navegador perde o foco, a macro **para com segurança**; clicar fora é o botão de "parar" |
| Envio que não se confirma | Apaga o rascunho e marca como não enviado; um envio incerto vira `VERIFICAR` e interrompe |
| Excesso de mensagens seguidas | Limite por execução e pausa aleatória entre clientes |
| Travar no meio e perder o controle | Salva a planilha a cada 20 envios e mostra um resumo no final |
| Testar sem incomodar cliente | `TELEFONE_TESTE` manda todas as mensagens para um número seu |

Detalhes técnicos: APIs do Windows para área de transferência, teclado e janelas, codificação de URL em UTF-8 (acentos e emojis) e leitura da planilha em memória de uma vez só.

## Como usar

1. Abra [`modelo-base-clientes.xlsx`](modelo-base-clientes.xlsx) (dados fictícios) e salve como `.xlsm`.
2. No Excel: **Alt+F11 › Inserir › Módulo** e cole o conteúdo de [`ApresentacaoWhatsApp.bas`](ApresentacaoWhatsApp.bas).
3. No topo do código, ajuste `NOME_REMETENTE`, `EMPRESA`, `UNIDADE` e, para testar, coloque o seu número em `TELEFONE_TESTE`.
4. Deixe o WhatsApp Web aberto no navegador e rode a macro `EnviarApresentacaoPDV`.

| Coluna | Conteúdo |
|---|---|
| D | Nome fantasia |
| E | Código do cliente (PDV) |
| I | Telefone |
| L | Status (preenchido pela macro) |

> Use apenas com clientes que já têm relação com a empresa e respeite os termos de uso do WhatsApp.

Funciona junto com o [sistema de cobrança em HTML](../03-sistema-de-cobranca/), que organiza o acompanhamento depois do primeiro contato.
